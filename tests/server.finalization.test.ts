// @vitest-environment node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../server';
import { commerceDb } from '../server/commerceModule';
import { controlPlaneDb } from '../server/adminControlPlaneModule';
import { computeServerLedgerBalance, securityDb } from '../server/securityModule';
import { decryptSecretValue, encryptSecretValue } from '../server/secretCrypto';

let app: Awaited<ReturnType<typeof createApp>>['app'];
const runTag = crypto.randomUUID().slice(0, 8);
const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const dataSnapshots = new Map<string, Buffer>();

let origWebhookSecret: string | undefined;
let origGeniusSecret: string | undefined;
let origAdminKey: string | undefined;

let clientToken = '';
let sellerToken = '';
let adminToken = '';
let secondAdminToken = '';
let sellerAccountId = '';
let p1Id = '';
let p2Id = '';

function signWebhookPayload(body: unknown, secret: string): string {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
}

describe('DJASSA Finalization Audit Integration Tests (Secrets, Multi-Seller, Webhooks, Two-Person, PWA)', () => {
  beforeAll(async () => {
    process.env.VITEST = 'true';
    origWebhookSecret = process.env.DJASSA_PAYMENT_WEBHOOK_SECRET;
    origGeniusSecret = process.env.GENIUSPAY_WEBHOOK_SECRET;
    origAdminKey = process.env.DJASSA_ADMIN_SECRET_KEY;

    process.env.GENIUSPAY_WEBHOOK_SECRET = `test-genius-wh-${runTag}`;
    process.env.DJASSA_PAYMENT_WEBHOOK_SECRET = `test-genius-wh-${runTag}`;
    process.env.DJASSA_ADMIN_SECRET_KEY = `admin-aes-key-${runTag}-0123456789abcdef`;

    if (fs.existsSync(DATA_DIR)) {
      for (const entry of fs.readdirSync(DATA_DIR)) {
        if (entry.endsWith('.json')) {
          dataSnapshots.set(entry, fs.readFileSync(path.join(DATA_DIR, entry)));
        }
      }
    }

    const serverApp = await createApp({ attachVite: false });
    app = serverApp.app;

    const regClient = await request(app).post('/api/auth/register').send({
      name: `Client Final ${runTag}`,
      email: `final.client.${runTag}@djassa-test.ci`,
      password: 'Password!2026',
      phone: '+225 07 10 20 30 40',
      role: 'client'
    });
    expect(regClient.status).toBe(201);
    clientToken = regClient.body.token;

    const sellerLogin = await request(app).post('/api/auth/login').send({
      email: 'vendeur@djassa.ci',
      password: process.env.DJASSA_SEED_SELLER_PASSWORD || 'Vendeur123'
    });
    expect(sellerLogin.status).toBe(200);
    sellerToken = sellerLogin.body.token;
    sellerAccountId = sellerLogin.body.user.tenantId || sellerLogin.body.user.id;

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@djassa.ci',
      password: process.env.DJASSA_SEED_ADMIN_PASSWORD || 'Admin123'
    });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.token;

    const switchRes = await request(app)
      .post('/api/security/auth/switch-test-role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffId: 'sec-agent-soc' });
    expect(switchRes.status).toBe(200);
    secondAdminToken = switchRes.body.token;

    // Seed two published products from distinct sellers for multi-seller tests
    p1Id = `prod-ms-1-${runTag}`;
    p2Id = `prod-ms-2-${runTag}`;
    const nowIso = new Date().toISOString();
    commerceDb.products.unshift(
      {
        id: p1Id,
        name: `Pagne Royal ${runTag}`,
        description: 'Pagne authentique',
        price: 15000,
        stock: 8,
        inStock: true,
        category: 'Mode',
        sellerId: 'seller-1',
        sellerName: 'Boutique Adjamé 1',
        images: ['https://example.com/p1.jpg'],
        status: 'published',
        parcelClass: 'standard',
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: p2Id,
        name: `Sac Cuir ${runTag}`,
        description: 'Sac artisanal',
        price: 10000,
        stock: 6,
        inStock: true,
        category: 'Accessoires',
        sellerId: `seller-alt-${runTag}`,
        sellerName: 'Boutique Cocody 2',
        images: ['https://example.com/p2.jpg'],
        status: 'published',
        parcelClass: 'standard',
        createdAt: nowIso,
        updatedAt: nowIso
      }
    );
  });

  afterAll(() => {
    const restoreEnv = (k: string, val: string | undefined) => {
      if (val === undefined) delete process.env[k];
      else process.env[k] = val;
    };
    restoreEnv('DJASSA_PAYMENT_WEBHOOK_SECRET', origWebhookSecret);
    restoreEnv('GENIUSPAY_WEBHOOK_SECRET', origGeniusSecret);
    restoreEnv('DJASSA_ADMIN_SECRET_KEY', origAdminKey);

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

  it('encrypts and decrypts API secrets using DJASSA_ADMIN_SECRET_KEY with AES-256-GCM', () => {
    const enc = encryptSecretValue('sk_live_djassa_test_998877');
    expect(enc.keyVersion).toBe('env-admin-v1');
    expect(enc.ciphertext.startsWith('v1:')).toBe(true);
    expect(decryptSecretValue(enc.ciphertext)).toBe('sk_live_djassa_test_998877');
    expect(() => decryptSecretValue(`${enc.ciphertext}00`)).toThrow();
  });

  it('keeps single-seller /api/commerce/orders guard and completes atomic multi-seller checkout + group webhook', async () => {
    const legacyReject = await request(app)
      .post('/api/commerce/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [
          { productId: p1Id, quantity: 1 },
          { productId: p2Id, quantity: 1 }
        ],
        paymentMode: 'online',
        paymentMethod: 'wave',
        deliveryAddress: {
          commune: 'Cocody',
          quartier: 'Angré',
          details: 'Rue 8e Tranche',
          recipientName: 'Aya Koné',
          phone: '+225 07 10 20 30 40'
        }
      });
    expect(legacyReject.status).toBe(400);
    expect(legacyReject.body.error).toBe('MULTI_SELLER_CART_FORBIDDEN');

    const idemKey = `ms-${runTag}`;
    const multiRes = await request(app)
      .post('/api/commerce/orders/multi-seller')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [
          { productId: p1Id, quantity: 2 },
          { productId: p2Id, quantity: 1 }
        ],
        paymentMode: 'online',
        paymentMethod: 'wave',
        promoCode: 'ADJAME10',
        idempotencyKey: idemKey,
        deliveryAddress: {
          commune: 'Cocody',
          quartier: 'Angré',
          details: 'Rue 8e Tranche',
          recipientName: 'Aya Koné',
          phone: '+225 07 10 20 30 40'
        }
      });

    expect(multiRes.status).toBe(201);
    expect(multiRes.body.success).toBe(true);
    expect(multiRes.body.checkoutGroupId).toMatch(/^grp-/);
    expect(multiRes.body.orders).toHaveLength(2);
    expect(commerceDb.products.find((p) => p.id === p1Id)?.stock).toBe(6);
    expect(commerceDb.products.find((p) => p.id === p2Id)?.stock).toBe(5);

    // Idempotent duplicate submission returns existing group without double-decrementing stock
    const dupRes = await request(app)
      .post('/api/commerce/orders/multi-seller')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [
          { productId: p1Id, quantity: 2 },
          { productId: p2Id, quantity: 1 }
        ],
        paymentMode: 'online',
        paymentMethod: 'wave',
        idempotencyKey: idemKey,
        deliveryAddress: {
          commune: 'Cocody',
          quartier: 'Angré',
          details: 'Rue 8e Tranche',
          recipientName: 'Aya Koné',
          phone: '+225 07 10 20 30 40'
        }
      });
    expect(dupRes.status).toBe(200);
    expect(dupRes.body.isDuplicate).toBe(true);
    expect(commerceDb.products.find((p) => p.id === p1Id)?.stock).toBe(6);

    // Confirm full multi-seller group via signed webhook
    const whBody = {
      eventId: `evt-grp-${runTag}`,
      checkoutGroupId: multiRes.body.checkoutGroupId,
      status: 'COMPLETED',
      providerReference: `gp-${multiRes.body.checkoutGroupId}`
    };
    const whRes = await request(app)
      .post('/api/commerce/payments/webhook')
      .set('x-geniuspay-signature', signWebhookPayload(whBody, process.env.GENIUSPAY_WEBHOOK_SECRET!))
      .send(whBody);
    expect(whRes.status).toBe(200);
    expect(whRes.body.success).toBe(true);
    for (const o of multiRes.body.orders) {
      const updated = commerceDb.orders.find((cand) => cand.id === o.id);
      expect(updated?.paymentStatus).toBe('paid');
      expect(updated?.status).toBe('passed');
    }
  });

  it('keeps AI credit recharge pending until signed GeniusPay webhook confirms once (idempotent replay)', async () => {
    const beforeBal = await request(app)
      .get('/api/credits/balance')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(beforeBal.status).toBe(200);
    const startBalance = beforeBal.body.balance;

    const rchRes = await request(app)
      .post('/api/credits/recharge/confirm')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ amountFcfa: 3500, paymentMethod: 'wave', phoneNumber: '+2250701020304' });
    expect(rchRes.status).toBe(202);
    expect(rchRes.body.pending).toBe(true);
    expect(rchRes.body.newBalance).toBe(startBalance);

    const rechargeId = rchRes.body.recharge.id;
    const creditsExpected = rchRes.body.recharge.credits;

    const whBody = {
      eventId: `evt-rch-${runTag}`,
      depositId: rechargeId,
      status: 'COMPLETED',
      providerReference: rechargeId
    };
    const sig = signWebhookPayload(whBody, process.env.GENIUSPAY_WEBHOOK_SECRET!);

    const firstConfirm = await request(app)
      .post('/api/commerce/payments/webhook')
      .set('x-geniuspay-signature', sig)
      .send(whBody);
    expect(firstConfirm.status).toBe(200);
    expect(firstConfirm.body.newBalance).toBe(startBalance + creditsExpected);

    // Replay with different eventId still must not double-credit confirmed recharge
    const replayBody = { ...whBody, eventId: `evt-rch-replay-${runTag}` };
    const replayConfirm = await request(app)
      .post('/api/commerce/payments/webhook')
      .set('x-geniuspay-signature', signWebhookPayload(replayBody, process.env.GENIUSPAY_WEBHOOK_SECRET!))
      .send(replayBody);
    expect(replayConfirm.status).toBe(200);
    expect(replayConfirm.body.idempotent).toBe(true);
    expect(replayConfirm.body.newBalance).toBe(startBalance + creditsExpected);
  });

  it('enforces two-person approval on held withdrawal and credits back wallet on GeniusPay payout failure webhook', async () => {
    // Top up seller balance cleanly so we can create a suspicious large/first-time withdrawal
    securityDb.financeLedger.unshift({
      id: `led-seed-${runTag}`,
      accountId: sellerAccountId,
      accountEmail: 'vendeur@djassa.ci',
      accountName: 'Vendeur Test',
      spaceRole: 'seller',
      type: 'credit',
      amountFcfa: 900000,
      commissionFcfa: 0,
      channel: 'test_topup',
      payoutTarget: '+22507****99',
      reference: `TOPUP-${runTag}`,
      status: 'valide',
      createdAt: new Date().toISOString()
    });
    const initialBal = computeServerLedgerBalance(sellerAccountId);
    expect(initialBal).toBeGreaterThanOrEqual(900000);

    // Trigger held_security withdrawal (> 500,000 FCFA threshold)
    const wdrRes = await request(app)
      .post('/api/commerce/withdrawals')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        amountFcfa: 600000,
        channel: 'wave',
        payoutTarget: '+2250748991234',
        idempotencyKey: `wdr-${runTag}`
      });
    expect(wdrRes.status).toBe(200);
    expect(wdrRes.body.withdrawal.status).toBe('held_security');
    const withdrawalId = wdrRes.body.withdrawal.id;

    // Available balance should reflect the hold immediately
    expect(computeServerLedgerBalance(sellerAccountId)).toBe(initialBal - 600000);

    // Approval must be enqueued in control plane
    const approval = controlPlaneDb.approvals.find((a) => a.resourceId === withdrawalId);
    expect(approval).toBeTruthy();

    // Second admin approves the withdrawal
    const approveRes = await request(app)
      .post(`/api/admin/control-plane/approvals/${approval!.id}/decide`)
      .set('Authorization', `Bearer ${secondAdminToken}`)
      .send({ decision: 'approved', reason: 'Double validation OK' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.approval.status).toBe('approved');
    expect(commerceDb.withdrawals.find((w) => w.id === withdrawalId)?.status).toBe('completed');
    // Balance after release + debit remains initialBal - 600000
    expect(computeServerLedgerBalance(sellerAccountId)).toBe(initialBal - 600000);

    // Now simulate an asynchronous GeniusPay payout failure webhook
    const failBody = {
      eventId: `evt-payout-fail-${runTag}`,
      payoutId: withdrawalId,
      status: 'FAILED'
    };
    const failWh = await request(app)
      .post('/api/commerce/payments/webhook')
      .set('x-geniuspay-signature', signWebhookPayload(failBody, process.env.GENIUSPAY_WEBHOOK_SECRET!))
      .send(failBody);
    expect(failWh.status).toBe(200);
    expect(commerceDb.withdrawals.find((w) => w.id === withdrawalId)?.status).toBe('failed');
    // Automatic credit-back restores full balance
    expect(computeServerLedgerBalance(sellerAccountId)).toBe(initialBal);
  });

  it('serves valid PWA manifest, RGBA PNG icons, and service worker script', () => {
    const manifestPath = path.resolve(process.cwd(), 'public', 'manifest.webmanifest');
    const swPath = path.resolve(process.cwd(), 'public', 'sw.js');
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(fs.existsSync(swPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.id).toBe('/');
    expect(Array.isArray(manifest.icons)).toBe(true);
    const pngIcons = manifest.icons.filter((i: { type?: string }) => i.type === 'image/png');
    expect(pngIcons.length).toBeGreaterThanOrEqual(3);
    for (const icon of pngIcons) {
      const iconFile = path.resolve(process.cwd(), 'public', icon.src.replace(/^\//, ''));
      expect(fs.existsSync(iconFile)).toBe(true);
      const buf = fs.readFileSync(iconFile);
      expect(buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
    }

    const swSource = fs.readFileSync(swPath, 'utf8');
    expect(swSource).toContain("addEventListener('install'");
    expect(swSource).toContain("addEventListener('fetch'");
    expect(swSource).toContain("addEventListener('push'");
  });
});
