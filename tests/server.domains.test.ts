// @vitest-environment node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../server';
import { commerceDb } from '../server/commerceModule';
import { SELLER_STORAGE_QUOTA_BYTES } from '../server/adminControlPlaneModule';

let app: Awaited<ReturnType<typeof createApp>>['app'];
const runTag = crypto.randomUUID().slice(0, 8);
const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const dataSnapshots = new Map<string, Buffer>();
let originalWebhookSecret: string | undefined;

let clientToken = '';
let unrelatedClientToken = '';
let sellerToken = '';
let adminToken = '';
let secondAdminToken = '';

const createdOrderIds: string[] = [];

async function loginSeeded(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(typeof res.body.token).toBe('string');
  return res.body.token;
}

describe('DJASSA 3-Space Domain (Client, Seller, Admin), Control-Plane & Security Integration Tests', () => {
  beforeAll(async () => {
    process.env.VITEST = 'true';
    originalWebhookSecret = process.env.GENIUSPAY_WEBHOOK_SECRET;

    if (fs.existsSync(DATA_DIR)) {
      for (const entry of fs.readdirSync(DATA_DIR)) {
        if (entry.endsWith('.json')) {
          dataSnapshots.set(entry, fs.readFileSync(path.join(DATA_DIR, entry)));
        }
      }
    }

    const serverApp = await createApp({ attachVite: false });
    app = serverApp.app;

    // Register two fresh clients for clean isolation tests
    const regClient1 = await request(app).post('/api/auth/register').send({
      name: `Client Test ${runTag}`,
      email: `domain.client1.${runTag}@djassa-test.ci`,
      password: 'Password!2026',
      phone: '+225 07 11 22 33 44',
      role: 'client'
    });
    expect(regClient1.status).toBe(201);
    clientToken = regClient1.body.token;

    const regClient2 = await request(app).post('/api/auth/register').send({
      name: `Client Isolé ${runTag}`,
      email: `domain.client2.${runTag}@djassa-test.ci`,
      password: 'Password!2026',
      phone: '+225 07 55 66 77 88',
      role: 'client'
    });
    expect(regClient2.status).toBe(201);
    unrelatedClientToken = regClient2.body.token;

    // Authenticate Seller and Admin spaces with seeded dev accounts
    sellerToken = await loginSeeded('vendeur@djassa.ci', process.env.DJASSA_SEED_SELLER_PASSWORD || 'Vendeur123');
    adminToken = await loginSeeded('admin@djassa.ci', process.env.DJASSA_SEED_ADMIN_PASSWORD || 'Admin123');

    const switchRes = await request(app)
      .post('/api/security/auth/switch-test-role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffId: 'sec-agent-soc' });
    expect(switchRes.status).toBe(200);
    expect(typeof switchRes.body.token).toBe('string');
    secondAdminToken = switchRes.body.token;
  });

  afterAll(() => {
    if (originalWebhookSecret === undefined) {
      delete process.env.GENIUSPAY_WEBHOOK_SECRET;
    } else {
      process.env.GENIUSPAY_WEBHOOK_SECRET = originalWebhookSecret;
    }

    if (fs.existsSync(DATA_DIR)) {
      for (const [fileName, buf] of dataSnapshots.entries()) {
        fs.writeFileSync(path.join(DATA_DIR, fileName), buf);
      }
      for (const entry of fs.readdirSync(DATA_DIR)) {
        if (entry.endsWith('.json') && !dataSnapshots.has(entry)) {
          fs.unlinkSync(path.join(DATA_DIR, entry));
        }
      }
    }
  });

  it('enforces 3-space authorization boundaries and blocks deprecated driver/company registration & routes', async () => {
    const clientSellerStorage = await request(app)
      .get('/api/commerce/seller/storage')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(clientSellerStorage.status).toBe(403);
    expect(clientSellerStorage.body.error).toBe('SELLER_ROLE_REQUIRED');

    const clientPayoutSettings = await request(app)
      .get('/api/commerce/seller/payout-settings')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(clientPayoutSettings.status).toBe(403);
    expect(clientPayoutSettings.body.error).toBe('SELLER_OR_ADMIN_REQUIRED');

    const sellerAdminApprovals = await request(app)
      .get('/api/admin/control-plane/approvals')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(sellerAdminApprovals.status).toBe(403);

    // Registration for removed roles driver / company must be rejected
    const regDriver = await request(app).post('/api/auth/register').send({
      name: `Driver Attempt ${runTag}`,
      email: `driver.${runTag}@djassa-test.ci`,
      password: 'Password!2026',
      role: 'driver'
    });
    expect(regDriver.status).toBe(400);
    expect(regDriver.body.error).toBe('INVALID_ACCOUNT_ROLE');

    const regCompany = await request(app).post('/api/auth/register').send({
      name: `Company Attempt ${runTag}`,
      email: `company.${runTag}@djassa-test.ci`,
      password: 'Password!2026',
      role: 'company'
    });
    expect(regCompany.status).toBe(400);
    expect(regCompany.body.error).toBe('INVALID_ACCOUNT_ROLE');

    // Removed legacy logistics endpoints are no longer active
    const legacyCompanyOffers = await request(app)
      .patch('/api/commerce/delivery/company/offers')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ normalPrice: 1200 });
    expect(legacyCompanyOffers.status).toBe(410);
  });

  it('enforces the 5 Go seller storage quota on product create and update', async () => {
    const storageRes = await request(app)
      .get('/api/commerce/seller/storage')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(storageRes.status).toBe(200);
    expect(storageRes.body.storage.quotaBytes).toBe(SELLER_STORAGE_QUOTA_BYTES);

    const overCreate = await request(app)
      .post('/api/commerce/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: `Lot Trop Volumineux ${runTag}`,
        price: 15000,
        stock: 3,
        category: 'Mode',
        mediaBytes: SELLER_STORAGE_QUOTA_BYTES + 1024
      });
    expect(overCreate.status).toBe(413);
    expect(overCreate.body.error).toBe('SELLER_STORAGE_QUOTA_EXCEEDED');

    const okCreate = await request(app)
      .post('/api/commerce/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: `Robe Wax ${runTag}`,
        price: 18000,
        stock: 5,
        category: 'Mode',
        mediaBytes: 512_000
      });
    expect(okCreate.status).toBe(201);
    const createdProductId = okCreate.body.product.id;

    const overPatch = await request(app)
      .patch(`/api/commerce/products/${createdProductId}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ mediaBytes: SELLER_STORAGE_QUOTA_BYTES + 2048 });
    expect(overPatch.status).toBe(413);
    expect(overPatch.body.error).toBe('SELLER_STORAGE_QUOTA_EXCEEDED');

    const delRes = await request(app)
      .delete(`/api/commerce/products/${createdProductId}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(delRes.status).toBe(200);
  });

  it('persists seller payout settings, calculates 150 FCFA fixed DJASSA commission, and serves scoped order receipts', async () => {
    const payoutPut = await request(app)
      .put('/api/commerce/seller/payout-settings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        preferredChannel: 'wave',
        wavePhone: '+225 07 48 99 12 34',
        accountHolderName: 'Boutique Adjamé Wax'
      });
    expect(payoutPut.status).toBe(200);
    expect(payoutPut.body.settings.preferredChannel).toBe('wave');

    const payoutGet = await request(app)
      .get('/api/commerce/seller/payout-settings')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(payoutGet.status).toBe(200);
    expect(payoutGet.body.settings.wavePhone).toBe('+225 07 48 99 12 34');

    const orderRes = await request(app)
      .post('/api/commerce/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ productId: 'prod-1', quantity: 1 }],
        paymentMode: 'online',
        paymentMethod: 'wave',
        deliveryAddress: {
          commune: 'Adjamé',
          quartier: 'Roxy',
          recipientName: 'Kouassi Client',
          phone: '+225 07 11 22 33 44'
        }
      });
    expect(orderRes.status).toBe(201);
    const ord = orderRes.body.order;
    createdOrderIds.push(ord.id);
    expect(ord.deliveryFee).toBe(0);
    expect(ord.deliveryMode).toBe('seller_managed');
    expect(ord.commissionFcfa).toBe(150);
    expect(ord.clientFeeFcfa).toBe(Math.round(ord.subtotal * 0.065));
    expect(ord.sellerNetFcfa).toBe(Math.max(0, ord.subtotal - 150));

    // Client receipt vs Admin receipt scoping
    const clientReceipt = await request(app)
      .get(`/api/commerce/orders/${ord.id}/receipt`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(clientReceipt.status).toBe(200);
    expect(clientReceipt.body.perspective).toBe('client');
    expect(clientReceipt.body.receipt.commissionFcfa).toBe(150);

    // Unrelated client cannot view someone else's order receipt
    const forbiddenReceipt = await request(app)
      .get(`/api/commerce/orders/${ord.id}/receipt`)
      .set('Authorization', `Bearer ${unrelatedClientToken}`);
    expect(forbiddenReceipt.status).toBe(404);

    // Seller commissions endpoint returns order & summary
    const commRes = await request(app)
      .get('/api/commerce/commissions')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(commRes.status).toBe(200);
    expect(commRes.body.entries.some((e: { orderId: string }) => e.orderId === ord.id)).toBe(true);
  });

  it('synchronizes admin promo campaigns, enforces two-person approvals, encrypts API secrets and blocks SSRF', async () => {
    const promoCode = `AUDIT${runTag.slice(0, 4).toUpperCase()}`;
    const cmpRes = await request(app)
      .post('/api/admin/control-plane/campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        campaignType: 'promotion',
        name: `Campagne Audit ${runTag}`,
        status: 'active',
        discountType: 'fixed',
        discountValue: 2500,
        minSubtotalFcfa: 10000,
        promoCode
      });
    expect(cmpRes.status).toBe(201);

    const promoCheck = await request(app)
      .post('/api/commerce/promo/validate')
      .send({ code: promoCode, subtotal: 25000 });
    expect(promoCheck.status).toBe(200);
    expect(promoCheck.body.valid).toBe(true);
    expect(promoCheck.body.discountFcfa).toBe(2500);

    // Two-person approval workflow
    const reqApproval = await request(app)
      .post('/api/admin/control-plane/approvals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        actionKey: 'security_policy_update',
        resourceType: 'control_plane_policy',
        resourceId: `pol-test-${runTag}`,
        requestPayload: { amountFcfa: 400000 }
      });
    expect(reqApproval.status).toBe(201);
    const approvalId = reqApproval.body.approval.id;

    // Self-approval blocked
    const selfDecide = await request(app)
      .post(`/api/admin/control-plane/approvals/${approvalId}/decide`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'approved', reason: 'Auto-validation interdite' });
    expect(selfDecide.status).toBe(409);
    expect(selfDecide.body.error).toBe('SELF_APPROVAL_FORBIDDEN');

    // Second staff member approval succeeds
    const otherDecide = await request(app)
      .post(`/api/admin/control-plane/approvals/${approvalId}/decide`)
      .set('Authorization', `Bearer ${secondAdminToken}`)
      .send({ decision: 'approved', reason: 'Vérifié par analyste SOC' });
    expect(otherDecide.status).toBe(200);
    expect(otherDecide.body.approval.status).toBe('approved');

    // SSRF protection on provider URLs
    const ssrfRes = await request(app)
      .patch('/api/admin/control-plane/providers/custom-ssrf')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        displayName: 'Test SSRF',
        serviceType: 'other',
        status: 'sandbox',
        publicConfig: { webhookUrl: 'http://169.254.169.254/latest/meta-data/' }
      });
    expect(ssrfRes.status).toBe(400);
    expect(ssrfRes.body.error).toBe('UNSAFE_PROVIDER_URL');

    // Secret encryption without exposing ciphertext
    const rawSecret = `sk_live_audit_${runTag}_secret_token`;
    const provPatch = await request(app)
      .patch(`/api/admin/control-plane/providers/audit_${runTag.toLowerCase()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        displayName: 'Audit Provider',
        serviceType: 'messaging',
        status: 'sandbox',
        apiKey: rawSecret,
        publicConfig: { baseUrl: 'https://api.djassa.ci/v1/hooks' }
      });
    expect(provPatch.status).toBe(200);
    expect(provPatch.body.provider.hasEncryptedSecret).toBe(true);
    expect(provPatch.body.provider.secretCiphertext).toBeUndefined();
    expect(JSON.stringify(provPatch.body)).not.toContain(rawSecret);

    const provList = await request(app)
      .get('/api/admin/control-plane/providers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(provList.status).toBe(200);
    expect(JSON.stringify(provList.body)).not.toContain(rawSecret);
    expect(JSON.stringify(provList.body)).not.toContain('secretCiphertext');
  });

  it('verifies webhook HMAC on raw body, preserves idempotency, restores stock on cancel, and never simulates GeniusPay live calls', async () => {
    const productBefore = commerceDb.products.find((p) => p.id === 'prod-2')!;
    const stockBeforeOrder = productBefore.stock;

    const orderRes = await request(app)
      .post('/api/commerce/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ productId: 'prod-2', quantity: 2 }],
        paymentMode: 'online',
        paymentMethod: 'orange_money',
        deliveryAddress: {
          commune: 'Marcory',
          quartier: 'Zone 4',
          recipientName: 'Kouassi Client',
          phone: '+225 07 11 22 33 44'
        }
      });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.order.id;
    const paymentId = orderRes.body.payment.id;
    createdOrderIds.push(orderId);
    expect(productBefore.stock).toBe(stockBeforeOrder - 2);

    // Without GENIUSPAY_API_KEY, live verify-provider reports unconfigured 503 honestly
    if (!process.env.GENIUSPAY_API_KEY) {
      const verifyLive = await request(app)
        .post(`/api/commerce/payments/${paymentId}/verify-provider`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect(verifyLive.status).toBe(503);
      expect(verifyLive.body.error).toBe('GENIUSPAY_NOT_CONFIGURED');
    }

    const secret = `test_wh_secret_${runTag}`;
    process.env.GENIUSPAY_WEBHOOK_SECRET = secret;
    const payloadObj = {
      eventId: `evt-${runTag}`,
      paymentId,
      orderId,
      providerReference: `OM-CI-${runTag}`,
      status: 'confirmed'
    };
    const rawJson = JSON.stringify(payloadObj);
    const validSig = crypto.createHmac('sha256', secret).update(rawJson).digest('hex');

    // Bad HMAC rejected with 401
    const badWh = await request(app)
      .post('/api/commerce/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Djassa-Webhook-Signature', '0'.repeat(64))
      .send(rawJson);
    expect(badWh.status).toBe(401);
    expect(badWh.body.error).toBe('INVALID_WEBHOOK_SIGNATURE');

    // Valid HMAC confirms payment & advances order status
    const okWh = await request(app)
      .post('/api/commerce/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Djassa-Webhook-Signature', validSig)
      .send(rawJson);
    expect(okWh.status).toBe(200);
    expect(okWh.body.order.paymentStatus).toBe('paid');
    expect(okWh.body.order.status).toBe('passed');

    // Replay returns idempotent: true without double-processing
    const replayWh = await request(app)
      .post('/api/commerce/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Djassa-Webhook-Signature', validSig)
      .send(rawJson);
    expect(replayWh.status).toBe(200);
    expect(replayWh.body.idempotent).toBe(true);

    // Cancelling the order restores inventory atomically
    const cancelRes = await request(app)
      .patch(`/api/commerce/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'cancelled' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.stockRestored).toBe(true);
    expect(productBefore.stock).toBe(stockBeforeOrder);
  });

  it('rotates sessions cleanly and enforces body size limits', async () => {

    // Session rotation invalidates the old token and activates the new token
    const rotateRes = await request(app)
      .post('/api/auth/sessions/rotate')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(rotateRes.status).toBe(200);
    const rotatedToken = rotateRes.body.token as string;
    expect(typeof rotatedToken).toBe('string');
    expect(rotatedToken).not.toBe(clientToken);

    const oldTokenMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(oldTokenMe.status).toBe(401);

    const newTokenMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${rotatedToken}`);
    expect(newTokenMe.status).toBe(200);

    // Body limit (> 256 Ko on /api/auth/*) rejected with 413 PAYLOAD_TOO_LARGE
    const oversizedPayload = JSON.stringify({ email: 'a@b.ci', password: 'x'.repeat(280_000) });
    const limitRes = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(oversizedPayload);
    expect(limitRes.status).toBe(413);
    expect(limitRes.body.error).toBe('PAYLOAD_TOO_LARGE');
  });
});
