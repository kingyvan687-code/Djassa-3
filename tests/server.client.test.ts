// @vitest-environment node
import crypto from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../server';
import { commerceDb } from '../server/commerceModule';

let app: Awaited<ReturnType<typeof createApp>>['app'];
let clientToken = '';
let clientUid = '';
let otherToken = '';
let createdOrderId = '';
let sampleProductId = '';
const runTag = crypto.randomUUID().slice(0, 8);
const primaryEmail = `client.${runTag}@djassa-test.ci`;
const secondaryEmail = `autre.${runTag}@djassa-test.ci`;
const initialPassword = 'TestPassword!2026';
const updatedPassword = 'NewPassword!2026';

describe('DJASSA Client Backend & Security Tests', () => {
  beforeAll(async () => {
    process.env.VITEST = 'true';
    const serverApp = await createApp({ attachVite: false });
    app = serverApp.app;
  });

  it('blocks unauthenticated access to protected client endpoints with 401', async () => {
    const res1 = await request(app).get('/api/client/bootstrap');
    expect(res1.status).toBe(401);

    const res2 = await request(app).get('/api/credits/balance');
    expect(res2.status).toBe(401);

    const res3 = await request(app).get('/api/commerce/chat/conversations');
    expect(res3.status).toBe(401);
  });

  it('blocks public registration with admin role (privilege escalation protection)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Tentative Admin',
      email: `evil.${runTag}@djassa-test.ci`,
      password: initialPassword,
      role: 'admin',
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ADMIN_REGISTRATION_FORBIDDEN');
  });

  it('registers, authenticates with scrypt+HMAC, and checks current user profile', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Kouassi Aya',
      email: primaryEmail,
      password: initialPassword,
      phone: '+225 07 01 02 03 04',
      role: 'client',
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    expect(typeof regRes.body.token).toBe('string');
    clientToken = regRes.body.token;
    clientUid = regRes.body.user.id;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(primaryEmail);
    expect(meRes.body.user.role).toBe('client');
  });

  it('enforces username uniqueness across accounts (409 USERNAME_TAKEN)', async () => {
    const reg2 = await request(app).post('/api/auth/register').send({
      name: 'Koné Mariam',
      email: secondaryEmail,
      password: initialPassword,
      role: 'client',
    });
    expect(reg2.status).toBe(201);
    otherToken = reg2.body.token;

    const uniqueHandle = `aya_ci_${runTag}`;
    const res1 = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ username: uniqueHandle, bio: 'Cliente Cocody' });
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ username: uniqueHandle });
    expect(res2.status).toBe(409);
    expect(res2.body.error).toBe('USERNAME_ALREADY_TAKEN');
  });

  it('requires valid current password before changing password and accepts new password on login', async () => {
    const badRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ currentPassword: 'WrongPassword123', newPassword: updatedPassword });
    expect(badRes.status).toBe(401);

    const okRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ currentPassword: initialPassword, newPassword: updatedPassword });
    expect(okRes.status).toBe(200);
    expect(okRes.body.success).toBe(true);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: primaryEmail,
      password: updatedPassword,
    });
    expect(loginRes.status).toBe(200);
    expect(typeof loginRes.body.token).toBe('string');
    clientToken = loginRes.body.token;
  });

  it('grants the free client bonus additively and enforces a rolling 24-hour cooldown', async () => {
    const first = await request(app)
      .post('/api/credits/claim-daily-bonus')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);
    expect(first.body.creditsAdded).toBe(10);
    const balanceAfterFirst = first.body.newBalance;

    const second = await request(app)
      .post('/api/credits/claim-daily-bonus')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(second.status).toBe(429);
    expect(second.body.error).toBe('DAILY_BONUS_COOLDOWN');
    expect(second.body.newBalance).toBe(balanceAfterFirst);
  });

  it('prevents horizontal IDOR and admin-only route access from a client token', async () => {
    const idorCredits = await request(app)
      .get('/api/credits/balance/client-demo-1')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(idorCredits.status).toBe(403);

    const adminStats = await request(app)
      .get('/api/credits/admin/stats')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(adminStats.status).toBe(403);
  });

  it('persists client preferences across bootstrap calls', async () => {
    const putRes = await request(app)
      .put('/api/client/preferences')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        privacy: {
          privateAccount: true,
          allowMessages: 'friends',
          allowComments: 'everyone',
          allowMentions: 'friends',
          showActivityStatus: false,
          personalizedAds: false,
          twoFactorEnabled: true,
          blockedSellerIds: ['seller-blocked-1'],
        },
        language: 'fr-FR',
        display: { theme: 'dark', fontSize: 'large', reduceMotion: true },
      });
    expect(putRes.status).toBe(200);
    expect(putRes.body.preferences.privacy.privateAccount).toBe(true);
    expect(putRes.body.preferences.language).toBe('fr-FR');

    const bootRes = await request(app)
      .get('/api/client/bootstrap')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(bootRes.status).toBe(200);
    expect(bootRes.body.preferences.privacy.privateAccount).toBe(true);
    expect(bootRes.body.preferences.display.fontSize).toBe('large');
  });

  it('rejects unsupported MIME attachments on support tickets and stores valid tickets', async () => {
    const badTicket = await request(app)
      .post('/api/client/tickets')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        ticketType: 'problem',
        category: 'Bug application',
        description: 'Fichier exécutable interdit',
        attachments: [
          {
            name: 'payload.exe',
            mimeType: 'application/x-msdownload',
            size: 120,
            dataUrl: 'data:application/x-msdownload;base64,TVqQ',
          },
        ],
      });
    expect(badTicket.status).toBe(400);
    expect(['MALICIOUS_FILE_REJECTED', 'UNSUPPORTED_ATTACHMENT_TYPE']).toContain(badTicket.body.error);

    const okTicket = await request(app)
      .post('/api/client/tickets')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        ticketType: 'problem',
        category: 'Livraison moto',
        description: 'Colis en retard sur Cocody Riviera.',
        attachments: [
          {
            name: 'preuve.png',
            mimeType: 'image/png',
            size: 24,
            dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
          },
        ],
      });
    expect(okTicket.status).toBe(201);
    expect(okTicket.body.ticket.id).toMatch(/^TCK-/);
    expect(okTicket.body.ticket.attachments).toHaveLength(1);
  });

  it('persists AI conversations and deletes viewing history entries', async () => {
    const aiSave = await request(app)
      .post('/api/client/ai-conversations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Recherche Sneakers Abidjan',
        dateLabel: "Aujourd'hui",
        messages: [
          { id: 'm1', sender: 'user', text: 'Je veux des baskets blanches', timestamp: '10:00' },
        ],
      });
      expect(aiSave.status).toBe(201);
      const convId = aiSave.body.conversation.id;

    const aiList = await request(app)
      .get('/api/client/ai-conversations')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(aiList.status).toBe(200);
    expect(aiList.body.conversations.some((c: { id: string }) => c.id === convId)).toBe(true);

    const putHist = await request(app)
      .put('/api/client/interactions')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        viewingHistory: [
          { videoId: 'vid-a', viewedAt: new Date().toISOString() },
          { videoId: 'vid-b', viewedAt: new Date().toISOString() },
        ],
      });
    expect(putHist.status).toBe(200);

    const delOne = await request(app)
      .delete('/api/client/viewing-history/vid-a')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(delOne.status).toBe(200);
    expect(delOne.body.viewingHistory).toHaveLength(1);
    expect(delOne.body.viewingHistory[0].videoId).toBe('vid-b');

    const delAi = await request(app)
      .delete(`/api/client/ai-conversations/${convId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(delAi.status).toBe(200);
  });

  it('creates an idempotent order and rejects reviews for non-delivered orders or invalid ratings', async () => {
    const prodsRes = await request(app).get('/api/commerce/products');
    expect(prodsRes.status).toBe(200);
    const inStockProduct = (prodsRes.body.products || []).find((p: { stock?: number }) => (p.stock || 0) >= 2);
    expect(inStockProduct).toBeDefined();
    sampleProductId = inStockProduct.id;

    const idemKey = `idem-${runTag}`;
    const payload = {
      items: [{ productId: sampleProductId, quantity: 1 }],
      paymentMode: 'online',
      paymentMethod: 'wave',
      idempotencyKey: idemKey,
      deliveryAddress: {
        recipientName: 'Kouassi Aya',
        phone: '+225 07 01 02 03 04',
        commune: 'Cocody',
        quartier: 'Riviera 2',
        details: 'Près du carrefour',
      },
    };

    const orderRes1 = await request(app)
      .post('/api/commerce/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(payload);
    expect(orderRes1.status).toBe(201);
    expect(orderRes1.body.order.total).toBeGreaterThan(0);
    createdOrderId = orderRes1.body.order.id;

    const orderRes2 = await request(app)
      .post('/api/commerce/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(payload);
    expect(orderRes2.status).toBe(200);
    expect(orderRes2.body.isDuplicate).toBe(true);
    expect(orderRes2.body.order.id).toBe(createdOrderId);

    const reviewNonDelivered = await request(app)
      .post(`/api/client/orders/${createdOrderId}/review`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ rating: 5, comment: 'Trop tôt' });
    expect(reviewNonDelivered.status).toBe(400);
    expect(reviewNonDelivered.body.error).toBe('ORDER_NOT_DELIVERED');

    // Mark delivered in in-memory store to test boundary rating validation
    const orderObj = commerceDb.orders.find((o) => o.id === createdOrderId);
    expect(orderObj).toBeDefined();
    if (orderObj) {
      orderObj.status = 'delivered';
    }

    const badRating = await request(app)
      .post(`/api/client/orders/${createdOrderId}/review`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ rating: 0, comment: 'Note invalide' });
    expect(badRating.status).toBe(400);
    expect(badRating.body.error).toBe('INVALID_RATING');

    const goodRating = await request(app)
      .post(`/api/client/orders/${createdOrderId}/review`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ rating: 5, comment: 'Livraison rapide et article conforme !' });
    expect(goodRating.status).toBe(201);
    expect(goodRating.body.review.rating).toBe(5);
  });

  it('validates promo codes server-side, applies 6.5% online fee / 0% COD fee & 150 FCFA commission, and supports payment retry', async () => {
    const badPromo = await request(app)
      .post('/api/commerce/promo/validate')
      .send({ code: 'INVALIDE99', subtotal: 25000 });
    expect(badPromo.status).toBe(400);
    expect(badPromo.body.valid).toBe(false);

    const lowSubtotalPromo = await request(app)
      .post('/api/commerce/promo/validate')
      .send({ code: 'DJASSA', subtotal: 5000 });
    expect(lowSubtotalPromo.status).toBe(400);
    expect(lowSubtotalPromo.body.error).toBe('PROMO_MIN_SUBTOTAL');

    const okPromo = await request(app)
      .post('/api/commerce/promo/validate')
      .send({ code: 'BIENVENUE', subtotal: 25000 });
    expect(okPromo.status).toBe(200);
    expect(okPromo.body.valid).toBe(true);
    expect(okPromo.body.discountFcfa).toBe(2500);

    const prodsRes = await request(app).get('/api/commerce/products');
    const prod = (prodsRes.body.products || []).find((p: { stock?: number; price?: number }) => (p.stock || 0) >= 3 && (p.price || 0) >= 10000);
    expect(prod).toBeDefined();

    const ordRes = await request(app)
      .post('/api/commerce/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ productId: prod.id, quantity: 1 }],
        paymentMode: 'online',
        paymentMethod: 'orange_money',
        promoCode: 'BIENVENUE',
        idempotencyKey: `checkout-${runTag}`,
        deliveryAddress: {
          recipientName: 'Kouassi Aya',
          phone: '+225 07 01 02 03 04',
          commune: 'Adjamé',
          quartier: 'Liberté',
          details: 'Face pharmacie principale',
        },
      });
    expect(ordRes.status).toBe(201);
    const created = ordRes.body.order;
    const expectedDiscount = Math.min(5000, Math.round(created.subtotal * 0.1));
    const merchandiseNet = Math.max(0, created.subtotal - expectedDiscount);
    const expectedClientFee = Math.round(merchandiseNet * 0.065);
    expect(created.deliveryFee).toBe(0);
    expect(created.clientFeeFcfa).toBe(expectedClientFee);
    expect(created.commissionFcfa).toBe(150);
    expect(created.discount).toBe(expectedDiscount);
    expect(created.total).toBe(merchandiseNet + expectedClientFee);
    expect(created.paymentMode).toBe('online');
    expect(created.paymentStatus).toBe('pending');

    // Cash on Delivery (COD) applies 0% client fee, 0 FCFA delivery, and 150 FCFA DJASSA commission
    const codRes = await request(app)
      .post('/api/commerce/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ productId: prod.id, quantity: 1 }],
        paymentMode: 'cod',
        idempotencyKey: `checkout-cod-${runTag}`,
        deliveryAddress: {
          recipientName: 'Kouassi Aya',
          phone: '+225 07 01 02 03 04',
          commune: 'Adjamé',
          quartier: 'Liberté',
          details: 'Face pharmacie principale',
        },
      });
    expect(codRes.status).toBe(201);
    expect(codRes.body.order.paymentMode).toBe('cod');
    expect(codRes.body.order.paymentMethod).toBe('cash_on_delivery');
    expect(codRes.body.order.paymentStatus).toBe('cod_pending');
    expect(codRes.body.order.clientFeeFcfa).toBe(0);
    expect(codRes.body.order.deliveryFee).toBe(0);
    expect(codRes.body.order.commissionFcfa).toBe(150);
    expect(codRes.body.order.total).toBe(codRes.body.order.subtotal);

    const statusRes = await request(app)
      .get(`/api/commerce/orders/${created.id}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.order.id).toBe(created.id);

    const retryRes = await request(app)
      .post(`/api/commerce/orders/${created.id}/retry-payment`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ paymentMethod: 'wave' });
    expect(retryRes.status).toBe(200);
    expect(retryRes.body.order.paymentMethod).toBe('wave');
    expect(retryRes.body.order.paymentStatus).toBe('pending');
  });

  it('expires unpaid stock reservations and restores inventory exactly once', async () => {
    const productsBefore = await request(app).get('/api/commerce/products');
    const product = (productsBefore.body.products || []).find((p: { stock?: number }) => (p.stock || 0) >= 2);
    expect(product).toBeDefined();
    const stockBefore = product.stock;
    const salesBefore = product.salesCount || 0;

    const orderRes = await request(app)
      .post('/api/commerce/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ productId: product.id, quantity: 1 }],
        paymentMode: 'online',
        paymentMethod: 'wave',
        idempotencyKey: `expiry-${runTag}`,
        deliveryAddress: {
          recipientName: 'Kouassi Aya', phone: '+225 07 01 02 03 04',
          commune: 'Cocody', quartier: 'Riviera 2', details: 'Test expiration'
        }
      });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.order.id;
    const order = commerceDb.orders.find((candidate) => candidate.id === orderId);
    expect(order?.reservationExpiresAt).toBeTruthy();
    expect(order?.status).toBe('pending_payment');

    if (order) order.reservationExpiresAt = new Date(Date.now() - 60_000).toISOString();
    const triggerSweep = await request(app).get('/api/commerce/products');
    expect(triggerSweep.status).toBe(200);

    const expiredOrder = commerceDb.orders.find((candidate) => candidate.id === orderId);
    const productAfter = commerceDb.products.find((candidate) => candidate.id === product.id);
    expect(expiredOrder?.status).toBe('cancelled');
    expect(expiredOrder?.stockRestored).toBe(true);
    expect(productAfter?.stock).toBe(stockBefore);
    expect(productAfter?.salesCount || 0).toBe(salesBefore);

    await request(app).get('/api/commerce/products');
    expect(productAfter?.stock).toBe(stockBefore);
  });

  it('issues ephemeral WS ticket and opens persistent support chat conversation', async () => {
    const wsRes = await request(app)
      .post('/api/client/ws-ticket')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(wsRes.status).toBe(200);
    expect(typeof wsRes.body.ticket).toBe('string');

    const supportRes = await request(app)
      .post('/api/client/support-chat')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ topic: 'Question suivi livraison' });
    expect(supportRes.status).toBe(200);
    expect(supportRes.body.conversation).toBeDefined();
    expect(Array.isArray(supportRes.body.messages)).toBe(true);
  });

  it('fails honestly with 503 and without deducting credits when RodiumAI key is absent', async () => {
    const origRodium = process.env.RODIUMAI_API_KEY;
    delete process.env.RODIUMAI_API_KEY;

    try {
      const balBefore = await request(app)
        .get('/api/credits/balance')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(balBefore.status).toBe(200);
      const beforeCredits = balBefore.body.balance;

      const aiChat = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ prompt: 'Bonjour' });
      expect(aiChat.status).toBe(503);
      expect(aiChat.body.error).toBe('RODIUMAI_NOT_CONFIGURED');

      const aiVideo = await request(app)
        .post('/api/ai/video')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ prompt: 'Vidéo promo chaussures' });
      expect(aiVideo.status).toBe(503);
      expect(aiVideo.body.error).toBe('RODIUMAI_NOT_CONFIGURED');

      const balAfter = await request(app)
        .get('/api/credits/balance')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(balAfter.body.balance).toBe(beforeCredits);
    } finally {
      if (origRodium !== undefined) process.env.RODIUMAI_API_KEY = origRodium;
    }
  });

  it('accepts official client subscriptions (300/600/1200 FCFA), preserves >=3500 FCFA rule on classic recharges, rejects invalid amounts/methods, and enforces atomic GeniusPay webhook verification', async () => {
    const origWebhookSecret = process.env.GENIUSPAY_WEBHOOK_SECRET;
    const origApiKey = process.env.GENIUSPAY_API_KEY;
    const origApiSecret = process.env.GENIUSPAY_API_SECRET;
    process.env.GENIUSPAY_WEBHOOK_SECRET = 'test_webhook_secret_djassa_2026';
    delete process.env.GENIUSPAY_API_KEY;
    delete process.env.GENIUSPAY_API_SECRET;

    try {
      // 1. Classic recharge < 3500 FCFA without planId MUST still be blocked
      const tooLowClassic = await request(app)
        .post('/api/credits/recharge/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ amountFcfa: 1000, paymentMethod: 'wave' });
      expect(tooLowClassic.status).toBe(400);
      expect(tooLowClassic.body.error).toBe('MIN_RECHARGE_REQUIRED');

      // 2. Classic recharge >= 3500 FCFA stays accepted (pending, zero immediate credits)
      const classicOk = await request(app)
        .post('/api/credits/recharge/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ amountFcfa: 3500, paymentMethod: 'card' });
      expect(classicOk.status).toBe(202);
      expect(classicOk.body.pending).toBe(true);
      expect(classicOk.body.recharge.credits).toBe(350);

      // 3. Rejects incompatible payment methods & tampered subscription price
      const badMethod = await request(app)
        .post('/api/credits/recharge/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ planId: 'mini', amountFcfa: 300, paymentMethod: 'moov' });
      expect(badMethod.status).toBe(400);
      expect(badMethod.body.error).toBe('INVALID_PAYMENT_METHOD');

      const tamperedPrice = await request(app)
        .post('/api/credits/recharge/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ planId: 'premium', amountFcfa: 300, credits: 99999, paymentMethod: 'wave' });
      expect(tamperedPrice.status).toBe(400);
      expect(tamperedPrice.body.error).toBe('PLAN_PRICE_MISMATCH');

      // 4. Accepts DJASSA Mini (300 FCFA = 30), Plus (600 FCFA = 60), Premium (1200 FCFA = 120)
      const balBeforeRes = await request(app)
        .get('/api/credits/balance')
        .set('Authorization', `Bearer ${clientToken}`);
      const priorBalance = balBeforeRes.body.balance;

      const miniRes = await request(app)
        .post('/api/credits/recharge/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ planId: 'mini', purchaseType: 'subscription', amountFcfa: 300, paymentMethod: 'wave' });
      expect(miniRes.status).toBe(202);
      expect(miniRes.body.pending).toBe(true);
      expect(miniRes.body.recharge.status).toBe('pending');
      expect(miniRes.body.recharge.credits).toBe(30);
      expect(miniRes.body.newBalance).toBe(priorBalance);

      const plusRes = await request(app)
        .post('/api/credits/recharge/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ planId: 'plus', purchaseType: 'subscription', amountFcfa: 600, paymentMethod: 'orange_money' });
      expect(plusRes.status).toBe(202);
      expect(plusRes.body.recharge.credits).toBe(60);

      const premRes = await request(app)
        .post('/api/credits/recharge/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ planId: 'premium', purchaseType: 'subscription', amountFcfa: 1200, paymentMethod: 'mtn_momo' });
      expect(premRes.status).toBe(202);
      expect(premRes.body.recharge.credits).toBe(120);

      // Balance MUST STILL equal priorBalance before webhook confirmation
      const balWhilePending = await request(app)
        .get('/api/credits/balance')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(balWhilePending.body.balance).toBe(priorBalance);

      // 5. Webhook security checks: invalid signature rejected, wrong amount rejected, pending ignored
      const miniId = miniRes.body.recharge.id;
      const signWebhook = (body: object) =>
        crypto.createHmac('sha256', process.env.GENIUSPAY_WEBHOOK_SECRET!).update(JSON.stringify(body)).digest('hex');

      const badSigPayload = { status: 'COMPLETED', reference: miniId, amount: 300, metadata: { rechargeId: miniId, userId: clientUid } };
      const badSigRes = await request(app)
        .post('/api/commerce/payments/webhook')
        .set('x-geniuspay-signature', 'invalid_hmac_sig')
        .send(badSigPayload);
      expect(badSigRes.status).toBe(401);

      const pendingWhPayload = { status: 'PENDING', reference: miniId, amount: 300, metadata: { rechargeId: miniId, userId: clientUid } };
      const pendingWhRes = await request(app)
        .post('/api/commerce/payments/webhook')
        .set('x-geniuspay-signature', signWebhook(pendingWhPayload))
        .send(pendingWhPayload);
      expect(pendingWhRes.status).toBe(202);
      expect(pendingWhRes.body.pending).toBe(true);

      const wrongAmtPayload = { status: 'COMPLETED', reference: miniId, amount: 100, metadata: { rechargeId: miniId, userId: clientUid } };
      const wrongAmtRes = await request(app)
        .post('/api/commerce/payments/webhook')
        .set('x-geniuspay-signature', signWebhook(wrongAmtPayload))
        .send(wrongAmtPayload);
      expect(wrongAmtRes.status).toBe(409);

      const wrongUserPayload = { status: 'COMPLETED', reference: miniId, amount: 300, metadata: { rechargeId: miniId, userId: 'evil-other-user' } };
      const wrongUserRes = await request(app)
        .post('/api/commerce/payments/webhook')
        .set('x-geniuspay-signature', signWebhook(wrongUserPayload))
        .send(wrongUserPayload);
      expect(wrongUserRes.status).toBe(409);

      // 6. Valid GeniusPay webhook credits atomically & activates activePlan='mini'
      const validWhPayload = { status: 'COMPLETED', reference: miniId, amount: 300, metadata: { rechargeId: miniId, userId: clientUid } };
      const validWhRes = await request(app)
        .post('/api/commerce/payments/webhook')
        .set('x-geniuspay-signature', signWebhook(validWhPayload))
        .send(validWhPayload);
      expect(validWhRes.status).toBe(200);
      expect(validWhRes.body.success).toBe(true);
      expect(validWhRes.body.recharge.credits).toBe(30);
      expect(validWhRes.body.newBalance).toBe(priorBalance + 30);
      expect(validWhRes.body.activePlan).toBe('mini');

      // 7. Duplicate webhook replay MUST NOT double-credit (idempotency)
      const replayRes = await request(app)
        .post('/api/commerce/payments/webhook')
        .set('x-geniuspay-signature', signWebhook(validWhPayload))
        .send(validWhPayload);
      expect(replayRes.status).toBe(200);
      expect(replayRes.body.idempotent).toBe(true);
      expect(replayRes.body.newBalance).toBe(priorBalance + 30);

      // 8. Second confirmed subscription (Plus = 600 FCFA -> +60 crédits) adds strictly on top of existing balance
      const plusId = plusRes.body.recharge.id;
      const plusWhPayload = { status: 'COMPLETED', reference: plusId, amount: 600, metadata: { rechargeId: plusId, userId: clientUid } };
      const plusWhRes = await request(app)
        .post('/api/commerce/payments/webhook')
        .set('x-geniuspay-signature', signWebhook(plusWhPayload))
        .send(plusWhPayload);
      expect(plusWhRes.status).toBe(200);
      expect(plusWhRes.body.newBalance).toBe(priorBalance + 90);
      expect(plusWhRes.body.activePlan).toBe('plus');

      const statusRes = await request(app)
        .get(`/api/credits/recharge/${encodeURIComponent(plusId)}/status`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.confirmed).toBe(true);
      expect(statusRes.body.activePlan).toBe('plus');
      expect(statusRes.body.newBalance).toBe(priorBalance + 90);
    } finally {
      if (origWebhookSecret !== undefined) process.env.GENIUSPAY_WEBHOOK_SECRET = origWebhookSecret;
      else delete process.env.GENIUSPAY_WEBHOOK_SECRET;
      if (origApiKey !== undefined) process.env.GENIUSPAY_API_KEY = origApiKey;
      if (origApiSecret !== undefined) process.env.GENIUSPAY_API_SECRET = origApiSecret;
    }
  });

  it('initiates live GeniusPay deposit with exact method mapping, returns checkoutUrl without crediting, and resolves local mannequin assets on try-on', async () => {
    const origApiKey = process.env.GENIUSPAY_API_KEY;
    const origApiSecret = process.env.GENIUSPAY_API_SECRET;
    const origRodiumKey = process.env.RODIUMAI_API_KEY;
    process.env.GENIUSPAY_API_KEY = 'gp_test_key';
    process.env.GENIUSPAY_API_SECRET = 'gp_test_secret';
    process.env.RODIUMAI_API_KEY = 'rodium_test_key';

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('geniuspay.ci')) {
        const sent = JSON.parse(String(init?.body || '{}'));
        expect(sent.payment_method).toBe('orange_money');
        expect(sent.amount).toBe(1200);
        return new Response(
          JSON.stringify({
            data: {
              id: 'dep_gp_12345',
              status: 'pending',
              checkout_url: 'https://pay.genius.ci/checkout/dep_gp_12345'
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('rodium')) {
        const sent = JSON.parse(String(init?.body || '{}'));
        expect(sent.prompt).toContain('Ronde');
        expect(sent.prompt).toContain('L/XL');
        expect(sent.reference_images?.[0]).toMatch(/^data:image\/jpeg;base64,/);
        return new Response(
          JSON.stringify({
            data: [{ b64_json: 'iVBORw0KGgo=' }]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    try {
      const balBefore = (
        await request(app).get('/api/credits/balance').set('Authorization', `Bearer ${clientToken}`)
      ).body.balance;

      const gpInit = await request(app)
        .post('/api/credits/recharge/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          planId: 'premium',
          purchaseType: 'subscription',
          amountFcfa: 1200,
          paymentMethod: 'orange_money',
          phoneNumber: '+225 07 01 02 03 04'
        });
      expect(gpInit.status).toBe(202);
      expect(gpInit.body.pending).toBe(true);
      expect(gpInit.body.checkoutUrl).toBe('https://pay.genius.ci/checkout/dep_gp_12345');
      expect(gpInit.body.newBalance).toBe(balBefore);

      // Test virtual try-on resolves local full-body mannequin path and passes morphology/size to RodiumAI
      const tryOnRes = await request(app)
        .post('/api/ai/try-on')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          userPhoto: '/src/assets/images/mannequin_femme_ronde_1795126009968.jpg',
          productImage: 'https://example.com/robe.jpg',
          productName: 'Robe Wax Moderne',
          productCategory: 'Mode Femme',
          modelName: 'Fatou',
          modelGender: 'female',
          morphology: 'Ronde',
          size: 'L/XL',
          color: 'Orange Terracotta',
          viewAngle: 'front'
        });
      expect(tryOnRes.status).toBe(200);
      expect(tryOnRes.body.success).toBe(true);
      expect(tryOnRes.body.model).toBe('qwen-image-2.1-turbo');
      expect(tryOnRes.body.newBalance).toBe(balBefore - 10);
      expect(tryOnRes.body.imageDataUrl).toMatch(/^data:image\//);
    } finally {
      fetchSpy.mockRestore();
      if (origApiKey !== undefined) process.env.GENIUSPAY_API_KEY = origApiKey;
      else delete process.env.GENIUSPAY_API_KEY;
      if (origApiSecret !== undefined) process.env.GENIUSPAY_API_SECRET = origApiSecret;
      else delete process.env.GENIUSPAY_API_SECRET;
      if (origRodiumKey !== undefined) process.env.RODIUMAI_API_KEY = origRodiumKey;
      else delete process.env.RODIUMAI_API_KEY;
    }
  });

  it('serves public catalog and enforces 5/day visitor AI quota plus idempotent guest-merge', async () => {
    const pubRes = await request(app).get('/api/commerce/public-catalog');
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.success).toBe(true);
    expect(Array.isArray(pubRes.body.products)).toBe(true);
    expect(pubRes.body.platformConfig).toBeDefined();

    const testGuestId = `guest-${runTag}-vitest`;
    const quotaRes = await request(app)
      .get('/api/client/visitor-quota')
      .set('x-guest-id', testGuestId);
    expect(quotaRes.status).toBe(200);
    expect(quotaRes.body.limits).toEqual({
      dailyLikes: 10,
      dailyFavorites: 5,
      dailyAiQuestions: 5,
    });
    expect(quotaRes.body.ai.remaining).toBe(5);

    const origRodiumKey = process.env.RODIUMAI_API_KEY;
    process.env.RODIUMAI_API_KEY = 'test-rodium-visitor-key';
    const chatFetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('rodium')) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Voici des baskets disponibles à Adjamé dès 12 000 FCFA.' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    try {
      for (let i = 1; i <= 5; i += 1) {
        const aiRes = await request(app)
          .post('/api/ai/chat')
          .set('x-guest-id', testGuestId)
          .send({ prompt: `Question visiteur ${i}` });
        expect(aiRes.status).toBe(200);
        expect(aiRes.body.success).toBe(true);
        expect(aiRes.body.guestQuota.used).toBe(i);
        expect(aiRes.body.guestQuota.remaining).toBe(5 - i);
      }

      const blockedRes = await request(app)
        .post('/api/ai/chat')
        .set('x-guest-id', testGuestId)
        .send({ prompt: 'Sixième question visiteur' });
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error).toBe('GUEST_AI_QUOTA_REACHED');
      expect(blockedRes.body.message).toBe(
        "Tu as utilisé tes questions gratuites du jour. Connecte-toi ou crée un compte DJASSA pour continuer à discuter avec l'assistant IA, profiter de plus d'accès et sauvegarder tes conversations."
      );
    } finally {
      chatFetchSpy.mockRestore();
      if (origRodiumKey !== undefined) process.env.RODIUMAI_API_KEY = origRodiumKey;
      else delete process.env.RODIUMAI_API_KEY;
    }

    const mergePayload = {
      guestId: testGuestId,
      likedVideoIds: ['prod-merge-1', 'prod-merge-2'],
      savedVideoIds: ['prod-merge-1'],
      searchHistory: ['baskets wax'],
      viewingHistory: [{ videoId: 'prod-merge-1', watchedAt: new Date().toISOString(), durationSec: 18, completed: true }],
      aiConversation: {
        id: `guest-ai-${runTag}`,
        title: 'Conseils tenues Abidjan',
        dateLabel: "Aujourd'hui",
        messages: [{ id: 'gm1', sender: 'user', text: 'Robe wax Cocody', timestamp: '12:00' }],
      },
    };

    const merge1 = await request(app)
      .post('/api/client/guest-merge')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(mergePayload);
    expect(merge1.status).toBe(200);
    expect(merge1.body.success).toBe(true);
    expect(merge1.body.interactions.likedVideoIds).toContain('prod-merge-1');

    // Second identical merge must stay idempotent (no duplicate AI conversations or interactions)
    const merge2 = await request(app)
      .post('/api/client/guest-merge')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(mergePayload);
    expect(merge2.status).toBe(200);
    const matchingLikes = (merge2.body.interactions.likedVideoIds as string[]).filter((id) => id === 'prod-merge-1');
    expect(matchingLikes).toHaveLength(1);
    const matchingConvs = (merge2.body.aiConversations as Array<{ id: string }>).filter(
      (c) => c.id === `guest-ai-${runTag}`
    );
    expect(matchingConvs).toHaveLength(1);
  });

  it('revokes session token cleanly on server logout', async () => {
    expect(clientUid).toBeTruthy();
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(logoutRes.status).toBe(200);

    const afterLogout = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(afterLogout.status).toBe(401);
  });
});
