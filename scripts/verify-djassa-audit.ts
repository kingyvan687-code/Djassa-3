import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import WebSocket from 'ws';

const ROOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA_DIR = path.join(ROOT_DIR, 'server', 'data');
const TEST_PORT = 3199;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const WEBHOOK_SECRET = 'djassa_test_hmac_webhook_secret_32bytes_min!';

function copyDirRecursive(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function clearAndRestoreDir(backupSrc: string, targetDir: string) {
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  if (fs.existsSync(backupSrc)) {
    copyDirRecursive(backupSrc, targetDir);
  }
}

async function api(
  urlPath: string,
  options: RequestInit & { token?: string; extraHeaders?: Record<string, string> } = {}
): Promise<{ status: number; json: any; headers: Headers }> {
  const { token, extraHeaders, ...rest } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extraHeaders || {})
  };
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    ...rest,
    headers
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, headers: res.headers };
}

async function waitForServer(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Timeout en attendant le démarrage du serveur de test DJASSA.');
}

async function loginSeed(email: string, password: string): Promise<{ token: string; user: any }> {
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  assert.equal(res.status, 200, `Échec login ${email}: ${JSON.stringify(res.json)}`);
  assert.ok(res.json?.token, `Jeton manquant pour ${email}`);
  return { token: res.json.token, user: res.json.user };
}

async function testWebSocketRejectsUnauthenticated(wsPath: string): Promise<{ rejected: boolean; details: string }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}${wsPath}`);
    let settled = false;
    const finish = (rejected: boolean, details: string) => {
      if (settled) return;
      settled = true;
      try {
        ws.terminate();
      } catch {
        // ignore
      }
      resolve({ rejected, details });
    };
    ws.on('open', () => finish(false, 'Connexion WebSocket acceptée sans authentification'));
    ws.on('unexpected-response', (_req, res) => {
      finish(res.statusCode === 401, `HTTP ${res.statusCode} avant upgrade`);
    });
    ws.on('close', (code, reason) => {
      finish(code >= 4000 || code === 1006 || code === 1008, `Fermeture WS code=${code} reason=${reason.toString()}`);
    });
    ws.on('error', (err) => {
      finish(true, err.message);
    });
    setTimeout(() => finish(false, 'Timeout WS'), 5000);
  });
}

async function runSuite() {
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'djassa-e2e-backup-'));
  const backupDataDir = path.join(backupDir, 'data');
  if (fs.existsSync(DATA_DIR)) {
    copyDirRecursive(DATA_DIR, backupDataDir);
  }

  let child: ChildProcess | null = null;
  let serverStderr = '';
  const results: Array<{ id: number; name: string; status: 'PASS' | 'FAIL'; detail?: string }> = [];

  try {
    const tsxBin = path.join(ROOT_DIR, 'node_modules', '.bin', 'tsx');
    child = spawn(tsxBin, ['server.ts'], {
      cwd: ROOT_DIR,
      detached: true,
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        DJASSA_PAYMENT_WEBHOOK_SECRET: WEBHOOK_SECRET,
        NODE_ENV: 'development'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stderr?.on('data', (chunk) => {
      serverStderr += chunk.toString();
    });

    await waitForServer();

    const step = async (id: number, name: string, fn: () => Promise<string | void>) => {
      try {
        const detail = await fn();
        results.push({ id, name, status: 'PASS', detail: detail || 'OK' });
        console.log(`[PASS] #${id} ${name}${detail ? ` — ${detail}` : ''}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id, name, status: 'FAIL', detail: msg });
        console.error(`[FAIL] #${id} ${name} — ${msg}`);
        throw err;
      }
    };

    let clientSession = await loginSeed('client@djassa.ci', process.env.DJASSA_SEED_CLIENT_PASSWORD || 'Client123');
    const seller1Session = await loginSeed('vendeur@djassa.ci', process.env.DJASSA_SEED_SELLER_PASSWORD || 'Vendeur123');
    const driver1Session = await loginSeed('livreur@djassa.ci', process.env.DJASSA_SEED_DRIVER_PASSWORD || 'Livreur123');
    const driver2Session = await loginSeed('livreur2@djassa.ci', process.env.DJASSA_SEED_DRIVER_PASSWORD || 'Livreur123');
    const companySession = await loginSeed('entreprise@djassa.ci', process.env.DJASSA_SEED_COMPANY_PASSWORD || 'Entreprise123');
    const adminSession = await loginSeed('admin@djassa.ci', process.env.DJASSA_SEED_ADMIN_PASSWORD || 'Admin123');

    // Scenario 1: Real authentication, scrypt verification, forbid admin registration, /me & logout revocation
    let registeredClientToken = '';
    let registeredClientId = '';
    await step(1, 'Authentification réelle scrypt, refus admin auto-register, /me et révocation logout', async () => {
      const uniqueEmail = `client.e2e.${Date.now()}@djassa.ci`;
      const regAdminAttempt = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Escalade',
          email: uniqueEmail,
          password: 'Password2026!',
          role: 'admin'
        })
      });
      assert.ok(
        regAdminAttempt.status === 201 || regAdminAttempt.status === 403,
        `Statut inattendu sur register role=admin: ${regAdminAttempt.status}`
      );
      if (regAdminAttempt.status === 201) {
        assert.notEqual(regAdminAttempt.json.user.role, 'admin', 'Un utilisateur public ne doit jamais obtenir role=admin');
        assert.equal(regAdminAttempt.json.user.role, 'client');
        registeredClientToken = regAdminAttempt.json.token;
        registeredClientId = regAdminAttempt.json.user.id;
      } else {
        const regClient = await api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name: 'Client E2E', email: uniqueEmail, password: 'Password2026!', role: 'client' })
        });
        assert.equal(regClient.status, 201);
        registeredClientToken = regClient.json.token;
        registeredClientId = regClient.json.user.id;
      }

      const badLogin = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: uniqueEmail, password: 'WrongPassword!' })
      });
      assert.equal(badLogin.status, 401);

      const goodLogin = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: uniqueEmail, password: 'Password2026!' })
      });
      assert.equal(goodLogin.status, 200);
      registeredClientToken = goodLogin.json.token;

      const meOk = await api('/api/auth/me', { token: registeredClientToken });
      assert.equal(meOk.status, 200);
      assert.equal(meOk.json.user.email, uniqueEmail);

      const tempSession = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: uniqueEmail, password: 'Password2026!' })
      });
      const logoutRes = await api('/api/auth/logout', { method: 'POST', token: tempSession.json.token });
      assert.equal(logoutRes.status, 200);
      const afterLogoutMe = await api('/api/auth/me', { token: tempSession.json.token });
      assert.equal(afterLogoutMe.status, 401, 'Session révoquée doit être rejetée');

      return `Inscription non-admin + scrypt + logout révoqué vérifiés (${uniqueEmail})`;
    });

    // Scenario 2: RBAC role isolation across spaces
    await step(2, 'Isolation stricte des rôles RBAC (401/403)', async () => {
      const noToken = await api('/api/commerce/bootstrap');
      assert.equal(noToken.status, 401);

      const clientCreateProd = await api('/api/commerce/products', {
        method: 'POST',
        token: clientSession.token,
        body: JSON.stringify({ name: 'Produit Piraté', price: 5000, stock: 5 })
      });
      assert.equal(clientCreateProd.status, 403);

      const clientPatchConfig = await api('/api/commerce/config', {
        method: 'PATCH',
        token: clientSession.token,
        body: JSON.stringify({ sellerCommissionRate: 0 })
      });
      assert.equal(clientPatchConfig.status, 403);

      const sellerDeclareBreakdown = await api('/api/commerce/deliveries/ord-unknown/breakdown', {
        method: 'POST',
        token: seller1Session.token,
        body: JSON.stringify({ breakdownType: 'engine' })
      });
      assert.ok([403, 404].includes(sellerDeclareBreakdown.status));

      const driverReassign = await api('/api/commerce/deliveries/ord-unknown/reassign', {
        method: 'POST',
        token: driver1Session.token,
        body: JSON.stringify({ newDriverId: 'driver-2' })
      });
      assert.equal(driverReassign.status, 403);

      return 'Client/Vendeur/Livreur isolés (401/403 conformes)';
    });

    // Scenario 3: Anti-tampering (CORS, issue-session locked, /api/:collection admin-only)
    await step(3, 'Anti-falsification CORS, issue-session verrouillé & collections admin uniquement', async () => {
      const evilCors = await api('/api/health', {
        extraHeaders: { Origin: 'https://evil-attacker.example' }
      });
      assert.equal(evilCors.headers.get('access-control-allow-origin'), null, 'CORS wildcard ou origine tierce interdite');

      const forgedSession = await api('/api/security/auth/issue-session', {
        method: 'POST',
        body: JSON.stringify({ accountId: 'hacker', accountEmail: 'admin@djassa.ci', role: 'admin' })
      });
      assert.equal(forgedSession.status, 401, 'issue-session ne doit pas délivrer de session sans authentification');

      const clientRawCol = await api('/api/users', { token: clientSession.token });
      assert.equal(clientRawCol.status, 403, 'Accès brut /api/:collection interdit aux non-admins');

      return 'CORS bloqué sur origine étrangère, issue-session 401, collection brute 403';
    });

    // Scenario 4: Seller Product CRUD + cross-seller block
    let seller1ProductId = '';
    let seller2ProductId = '';
    await step(4, 'CRUD produits vendeur + blocage modification/suppression inter-vendeur', async () => {
      const seller2Email = `vendeur2.e2e.${Date.now()}@djassa.ci`;
      const regSeller2 = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Boutique Concurrente', email: seller2Email, password: 'SellerPassword1!', role: 'seller' })
      });
      assert.equal(regSeller2.status, 201);
      const seller2Token = regSeller2.json.token;

      const createP1 = await api('/api/commerce/products', {
        method: 'POST',
        token: seller1Session.token,
        body: JSON.stringify({ name: 'Pagne Wax E2E', price: 12000, stock: 5, category: 'Mode' })
      });
      assert.equal(createP1.status, 201);
      seller1ProductId = createP1.json.product.id;

      const createP2 = await api('/api/commerce/products', {
        method: 'POST',
        token: seller2Token,
        body: JSON.stringify({ name: 'Chaussures Vendeur 2', price: 15000, stock: 4, category: 'Chaussures' })
      });
      assert.equal(createP2.status, 201);
      seller2ProductId = createP2.json.product.id;

      const crossEdit = await api(`/api/commerce/products/${seller1ProductId}`, {
        method: 'PATCH',
        token: seller2Token,
        body: JSON.stringify({ price: 100 })
      });
      assert.equal(crossEdit.status, 403);

      const crossDelete = await api(`/api/commerce/products/${seller1ProductId}`, {
        method: 'DELETE',
        token: seller2Token
      });
      assert.equal(crossDelete.status, 403);

      const validEdit = await api(`/api/commerce/products/${seller1ProductId}`, {
        method: 'PATCH',
        token: seller1Session.token,
        body: JSON.stringify({ price: 12500, stock: 4 })
      });
      assert.equal(validEdit.status, 200);
      assert.equal(validEdit.json.product.price, 12500);
      assert.equal(validEdit.json.product.stock, 4);

      return `Produit ${seller1ProductId} protégé contre vendeur tiers`;
    });

    // Scenario 5: Atomic order creation, server price enforcement, multi-seller forbidden, stock check
    let cancelOrderId = '';
    await step(5, 'Commande atomique serveur, anti-multi-vendeur, OTP aléatoire & contrôle stock', async () => {
      // Multi-seller must fail
      const multiSeller = await api('/api/commerce/orders', {
        method: 'POST',
        token: clientSession.token,
        body: JSON.stringify({
          items: [
            { productId: seller1ProductId, quantity: 1 },
            { productId: seller2ProductId, quantity: 1 }
          ],
          paymentMethod: 'wave',
          deliveryAddress: {
            commune: 'Cocody',
            quartier: 'Angré',
            details: 'Carrefour Gestoci',
            recipientName: 'Amina',
            phone: '+2250700000001'
          },
          selectedDriverId: 'driver-1',
          deliveryMode: 'normal'
        })
      });
      assert.equal(multiSeller.status, 400);
      assert.equal(multiSeller.json.error, 'MULTI_SELLER_CART_FORBIDDEN');

      // Insufficient stock must fail
      const tooMuch = await api('/api/commerce/orders', {
        method: 'POST',
        token: clientSession.token,
        body: JSON.stringify({
          items: [{ productId: seller1ProductId, quantity: 99 }],
          paymentMethod: 'wave',
          deliveryAddress: {
            commune: 'Cocody',
            quartier: 'Angré',
            details: 'Carrefour Gestoci',
            recipientName: 'Amina',
            phone: '+2250700000001'
          },
          selectedDriverId: 'driver-1',
          deliveryMode: 'normal'
        })
      });
      assert.equal(tooMuch.status, 409);
      assert.equal(tooMuch.json.error, 'INSUFFICIENT_STOCK');

      // Client tampering price in payload must be ignored by server
      const validOrder = await api('/api/commerce/orders', {
        method: 'POST',
        token: clientSession.token,
        body: JSON.stringify({
          items: [{ productId: seller1ProductId, quantity: 2, price: 1 }],
          paymentMethod: 'wave',
          deliveryAddress: {
            commune: 'Cocody',
            quartier: 'Angré',
            details: 'Carrefour Gestoci',
            recipientName: 'Amina',
            phone: '+2250700000001'
          },
          selectedDriverId: 'driver-1',
          deliveryMode: 'normal'
        })
      });
      assert.equal(validOrder.status, 201);
      cancelOrderId = validOrder.json.order.id;
      assert.equal(validOrder.json.order.subtotal, 25000, 'Sous-total doit utiliser le prix catalogue (2 x 12500)');
      assert.equal(validOrder.json.order.serviceFee, 250, 'Frais de service 1% (250 FCFA)');
      assert.equal(validOrder.json.order.total, 26750, 'Total = 25000 + 1500 livraison normale + 250 frais de service (1%)');
      assert.match(String(validOrder.json.order.otpCode), /^\d{4}$/, 'OTP à 4 chiffres généré serveur');
      assert.equal(validOrder.json.order.paymentStatus, 'pending', 'Sans passerelle, le paiement reste pending');

      const catalog = await api('/api/commerce/products');
      const prodAfter = catalog.json.products.find((p: any) => p.id === seller1ProductId);
      assert.equal(prodAfter.stock, 2, 'Stock décrémenté atomiquement de 4 à 2');

      return `Commande ${validOrder.json.order.orderNumber} (OTP=${validOrder.json.order.otpCode}, Stock 4->2)`;
    });

    // Scenario 6: Order cancellation + atomic stock restoration
    await step(6, 'Annulation commande et restauration atomique du stock', async () => {
      const cancelRes = await api(`/api/commerce/orders/${cancelOrderId}/status`, {
        method: 'PATCH',
        token: clientSession.token,
        body: JSON.stringify({ status: 'cancelled' })
      });
      assert.equal(cancelRes.status, 200);
      assert.equal(cancelRes.json.order.status, 'cancelled');
      assert.equal(cancelRes.json.stockRestored, true);

      const catalog = await api('/api/commerce/products');
      const prodRestored = catalog.json.products.find((p: any) => p.id === seller1ProductId);
      assert.equal(prodRestored.stock, 4, 'Stock restauré de 2 à 4 après annulation');
      return 'Stock restauré atomiquement (2 -> 4)';
    });

    // Create two fresh orders for Delivery Scenarios 8 & 9/10
    const orderDirectRes = await api('/api/commerce/orders', {
      method: 'POST',
      token: clientSession.token,
      body: JSON.stringify({
        items: [{ productId: seller1ProductId, quantity: 1 }],
        paymentMethod: 'wave',
        deliveryAddress: {
          commune: 'Plateau',
          quartier: 'Cité Administrative',
          details: 'Tour B',
          recipientName: 'Amina',
          phone: '+2250700000001'
        },
        selectedDriverId: 'driver-1',
        deliveryMode: 'normal'
      })
    });
    assert.equal(orderDirectRes.status, 201);
    const directOrder = orderDirectRes.json.order;

    // Scenario 7: Payment honesty + HMAC webhook signature verification
    await step(7, 'Paiement honnête (pending) + Webhook HMAC valide vs invalide', async () => {
      assert.equal(directOrder.paymentStatus, 'pending');
      assert.equal(orderDirectRes.json.providerConfigured, false);

      const badWebhook = await api('/api/commerce/payments/webhook', {
        method: 'POST',
        extraHeaders: { 'x-djassa-webhook-signature': 'invalid-hmac-signature' },
        body: JSON.stringify({ paymentId: directOrder.paymentId, status: 'confirmed' })
      });
      assert.equal(badWebhook.status, 401);

      const payload = {
        paymentId: directOrder.paymentId,
        orderId: directOrder.id,
        providerReference: 'WAVE-TX-998811',
        status: 'confirmed'
      };
      const validSig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(payload)).digest('hex');
      const goodWebhook = await api('/api/commerce/payments/webhook', {
        method: 'POST',
        extraHeaders: { 'x-djassa-webhook-signature': validSig },
        body: JSON.stringify(payload)
      });
      assert.equal(goodWebhook.status, 200);
      assert.equal(goodWebhook.json.order.paymentStatus, 'paid');
      assert.equal(goodWebhook.json.order.status, 'passed');

      const replayWebhook = await api('/api/commerce/payments/webhook', {
        method: 'POST',
        extraHeaders: { 'x-djassa-webhook-signature': validSig },
        body: JSON.stringify(payload)
      });
      assert.equal(replayWebhook.status, 200);
      assert.equal(replayWebhook.json.idempotent, true);

      return 'Webhook invalide rejeté 401, webhook HMAC valide -> paid + idempotent';
    });

    // Scenario 8: Complete normal delivery flow + 150 FCFA fixed commission settlement
    await step(8, 'Livraison complète (pickup photo + OTP + commission fixe 150 FCFA idempotente)', async () => {
      const sellerWalletBefore = (await api('/api/commerce/wallets/me', { token: seller1Session.token })).json.balanceFcfa;
      const driverWalletBefore = (await api('/api/commerce/wallets/me', { token: driver1Session.token })).json.balanceFcfa;
      const companyWalletBefore = (await api('/api/commerce/wallets/me', { token: companySession.token })).json.balanceFcfa;

      const prepDirect = await api(`/api/commerce/orders/${directOrder.id}/status`, {
        method: 'PATCH',
        token: seller1Session.token,
        body: JSON.stringify({ status: 'preparing' })
      });
      assert.equal(prepDirect.status, 200);

      const readyDirect = await api(`/api/commerce/orders/${directOrder.id}/status`, {
        method: 'PATCH',
        token: seller1Session.token,
        body: JSON.stringify({ status: 'ready_for_pickup' })
      });
      assert.equal(readyDirect.status, 200);

      const acc = await api(`/api/commerce/deliveries/${directOrder.id}/accept`, {
        method: 'POST',
        token: driver1Session.token
      });
      assert.equal(acc.status, 200);

      const noPhoto = await api(`/api/commerce/deliveries/${directOrder.id}/pickup`, {
        method: 'POST',
        token: driver1Session.token,
        body: JSON.stringify({})
      });
      assert.equal(noPhoto.status, 400);

      const pickupOk = await api(`/api/commerce/deliveries/${directOrder.id}/pickup`, {
        method: 'POST',
        token: driver1Session.token,
        body: JSON.stringify({ photo: 'data:image/png;base64,pickup_proof_ok', signedBy: 'Boutique Wax' })
      });
      assert.equal(pickupOk.status, 200);
      assert.equal(pickupOk.json.order.status, 'in_delivery');

      const wrongOtp = await api(`/api/commerce/deliveries/${directOrder.id}/deliver`, {
        method: 'POST',
        token: driver1Session.token,
        body: JSON.stringify({ otpCode: '0000', photo: 'data:image/png;base64,drop_proof' })
      });
      assert.equal(wrongOtp.status, 400);
      assert.equal(wrongOtp.json.error, 'INVALID_OTP');

      const deliverOk = await api(`/api/commerce/deliveries/${directOrder.id}/deliver`, {
        method: 'POST',
        token: driver1Session.token,
        body: JSON.stringify({
          otpCode: directOrder.otpCode,
          photo: 'data:image/png;base64,drop_proof',
          signedBy: 'Amina'
        })
      });
      assert.equal(deliverOk.status, 200);
      assert.equal(deliverOk.json.order.status, 'delivered');

      const deliverReplay = await api(`/api/commerce/deliveries/${directOrder.id}/deliver`, {
        method: 'POST',
        token: driver1Session.token,
        body: JSON.stringify({ otpCode: directOrder.otpCode, photo: 'data:image/png;base64,drop_proof' })
      });
      assert.equal(deliverReplay.status, 200);
      assert.equal(deliverReplay.json.idempotent, true);

      const sellerWalletAfter = (await api('/api/commerce/wallets/me', { token: seller1Session.token })).json.balanceFcfa;
      const driverWalletAfter = (await api('/api/commerce/wallets/me', { token: driver1Session.token })).json.balanceFcfa;
      const companyWalletAfter = (await api('/api/commerce/wallets/me', { token: companySession.token })).json.balanceFcfa;

      assert.equal(sellerWalletAfter - sellerWalletBefore, directOrder.subtotal - 150, 'Vendeur crédité (subtotal - 150 FCFA)');
      assert.ok(driverWalletAfter > driverWalletBefore, 'Livreur crédité (frais livraison net de commission 150 FCFA)');
      assert.ok(companyWalletAfter >= companyWalletBefore, 'Entreprise créditée si partenaire flotte');

      return `Commission fixe 150 FCFA réglée & idempotente (Vendeur +${sellerWalletAfter - sellerWalletBefore} FCFA)`;
    });

    // Scenario 9 & 10: Block reassignment without breakdown + Full breakdown reassignment + handover flow
    const orderBreakdownRes = await api('/api/commerce/orders', {
      method: 'POST',
      token: clientSession.token,
      body: JSON.stringify({
        items: [{ productId: seller1ProductId, quantity: 1 }],
        paymentMethod: 'orange_money',
        deliveryAddress: {
          commune: 'Marcory',
          quartier: 'Zone 4',
          details: 'Rue Lumière',
          recipientName: 'Amina',
          phone: '+2250700000001'
        },
        selectedDriverId: 'driver-1',
        deliveryMode: 'express'
      })
    });
    assert.equal(orderBreakdownRes.status, 201);
    const brOrder = orderBreakdownRes.json.order;

    const brPayPayload = {
      paymentId: brOrder.paymentId,
      orderId: brOrder.id,
      providerReference: `OM-BR-${Date.now()}`,
      status: 'confirmed'
    };
    const brSig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(brPayPayload)).digest('hex');
    const brWebhook = await api('/api/commerce/payments/webhook', {
      method: 'POST',
      extraHeaders: { 'x-djassa-webhook-signature': brSig },
      body: JSON.stringify(brPayPayload)
    });
    assert.equal(brWebhook.status, 200);

    const brPrep = await api(`/api/commerce/orders/${brOrder.id}/status`, {
      method: 'PATCH',
      token: seller1Session.token,
      body: JSON.stringify({ status: 'preparing' })
    });
    assert.equal(brPrep.status, 200);

    const brReady = await api(`/api/commerce/orders/${brOrder.id}/status`, {
      method: 'PATCH',
      token: seller1Session.token,
      body: JSON.stringify({ status: 'ready_for_pickup' })
    });
    assert.equal(brReady.status, 200);

    const brAccept = await api(`/api/commerce/deliveries/${brOrder.id}/accept`, {
      method: 'POST',
      token: driver1Session.token
    });
    assert.equal(brAccept.status, 200);

    const brPickup = await api(`/api/commerce/deliveries/${brOrder.id}/pickup`, {
      method: 'POST',
      token: driver1Session.token,
      body: JSON.stringify({ photo: 'data:image/png;base64,pickup_proof_preserved', signedBy: 'Boutique Wax' })
    });
    assert.equal(brPickup.status, 200);

    await step(9, 'Blocage strict réattribution manuelle sans signalement « Je suis en panne »', async () => {
      const blockedReassign = await api(`/api/commerce/deliveries/${brOrder.id}/reassign`, {
        method: 'POST',
        token: companySession.token,
        body: JSON.stringify({ newDriverId: 'driver-2' })
      });
      assert.equal(blockedReassign.status, 409);
      assert.equal(blockedReassign.json.error, 'REASSIGNMENT_FORBIDDEN_WITHOUT_BREAKDOWN');
      return 'HTTP 409 REASSIGNMENT_FORBIDDEN_WITHOUT_BREAKDOWN confirmé';
    });

    await step(10, 'Workflow complet panne -> réattribution intelligente -> blocage avant passation -> livraison', async () => {
      const declareBr = await api(`/api/commerce/deliveries/${brOrder.id}/breakdown`, {
        method: 'POST',
        token: driver1Session.token,
        body: JSON.stringify({
          breakdownType: 'engine',
          breakdownLabel: 'Panne moteur — Je suis en panne',
          urgency: 'critical',
          currentLocation: 'Pont Houphouët-Boigny'
        })
      });
      assert.equal(declareBr.status, 200);
      assert.equal(declareBr.json.order.breakdownDeclared, true);
      assert.equal(declareBr.json.suggestedReplacementDriver?.id, 'driver-2');

      const reassignOk = await api(`/api/commerce/deliveries/${brOrder.id}/reassign`, {
        method: 'POST',
        token: companySession.token,
        body: JSON.stringify({
          newDriverId: 'driver-2',
          meetingPoint: 'Station Total Pont FHB',
          notes: 'Relais prioritaire client VIP'
        })
      });
      assert.equal(reassignOk.status, 200);
      assert.equal(reassignOk.json.order.driverId, 'driver-2');
      assert.equal(reassignOk.json.order.pickupProof.photo, 'data:image/png;base64,pickup_proof_preserved');
      assert.equal(reassignOk.json.order.reassignmentHistory.length, 1);
      assert.equal(reassignOk.json.order.handoverRequired, true);
      assert.equal(reassignOk.json.order.handoverStatus, 'pending_handover');

      const deliverBeforeHandover = await api(`/api/commerce/deliveries/${brOrder.id}/deliver`, {
        method: 'POST',
        token: driver2Session.token,
        body: JSON.stringify({ otpCode: brOrder.otpCode, photo: 'data:image/png;base64,premature' })
      });
      assert.equal(deliverBeforeHandover.status, 409);
      assert.equal(deliverBeforeHandover.json.error, 'HANDOVER_REQUIRED_BEFORE_DELIVERY');

      const handoverConfirm = await api(`/api/commerce/deliveries/${brOrder.id}/handover-confirm`, {
        method: 'POST',
        token: driver2Session.token,
        body: JSON.stringify({ notes: 'Colis intact reçu au point de relais' })
      });
      assert.equal(handoverConfirm.status, 200);
      assert.equal(handoverConfirm.json.order.handoverStatus, 'confirmed');

      const finalDeliver = await api(`/api/commerce/deliveries/${brOrder.id}/deliver`, {
        method: 'POST',
        token: driver2Session.token,
        body: JSON.stringify({ otpCode: brOrder.otpCode, photo: 'data:image/png;base64,final_proof' })
      });
      assert.equal(finalDeliver.status, 200);
      assert.equal(finalDeliver.json.order.status, 'delivered');

      return 'Preuve initiale préservée + historique complet + passation obligatoire + livraison finale réussie';
    });

    // Scenario 11: Authoritative server withdrawals
    await step(11, 'Retraits serveur autoritaires (rejet négatif/dépassement, débit frais réels)', async () => {
      const negWithdraw = await api('/api/commerce/withdrawals', {
        method: 'POST',
        token: seller1Session.token,
        body: JSON.stringify({ amountFcfa: -5000, channel: 'Wave CI', payoutTarget: '+2250700001122' })
      });
      assert.equal(negWithdraw.status, 400);

      const walletBefore = (await api('/api/commerce/wallets/me', { token: seller1Session.token })).json.balanceFcfa;
      const hugeWithdraw = await api('/api/commerce/withdrawals', {
        method: 'POST',
        token: seller1Session.token,
        body: JSON.stringify({ amountFcfa: walletBefore + 9999999, channel: 'Wave CI', payoutTarget: '+2250700001122' })
      });
      assert.equal(hugeWithdraw.status, 400);
      assert.equal(hugeWithdraw.json.error, 'INSUFFICIENT_SERVER_BALANCE');

      const validWithdraw = await api('/api/commerce/withdrawals', {
        method: 'POST',
        token: seller1Session.token,
        body: JSON.stringify({ amountFcfa: 5000, channel: 'Wave CI', payoutTarget: '+2250700001122' })
      });
      assert.equal(validWithdraw.status, 200);
      assert.equal(validWithdraw.json.withdrawal.amountFcfa, 5000);
      assert.equal(validWithdraw.json.withdrawal.feeFcfa, 500);
      assert.equal(validWithdraw.json.withdrawal.netAmountFcfa, 4500);
      assert.equal(validWithdraw.json.newBalanceFcfa, walletBefore - 5000);

      return `Solde ${walletBefore} -> ${validWithdraw.json.newBalanceFcfa} FCFA (frais 10% calculés serveur)`;
    });

    // Scenario 12: AI Credits (pending recharge, bonus cooldown, deduction, idempotency, admin verify & refund)
    await step(12, 'Crédits IA (bonus 24h, recharge pending, débit idempotent, validation & refund admin)', async () => {
      const bonus1 = await api('/api/credits/claim-daily-bonus', { method: 'POST', token: registeredClientToken });
      assert.equal(bonus1.status, 200);
      assert.equal(bonus1.json.creditsAdded, 10);

      const bonus2 = await api('/api/credits/claim-daily-bonus', { method: 'POST', token: registeredClientToken });
      assert.equal(bonus2.status, 429);

      const rchPending = await api('/api/credits/recharge/confirm', {
        method: 'POST',
        token: registeredClientToken,
        body: JSON.stringify({ amountFcfa: 3500, paymentMethod: 'wave', phoneNumber: '0700112233' })
      });
      assert.equal(rchPending.status, 202);
      assert.equal(rchPending.json.pending, true);
      assert.equal(rchPending.json.newBalance, 10, 'Recharge non vérifiée ne doit pas créditer le solde');

      const deductChat = await api('/api/credits/deduct', {
        method: 'POST',
        token: registeredClientToken,
        body: JSON.stringify({ serviceType: 'chat', idempotencyKey: 'e2e-chat-1' })
      });
      assert.equal(deductChat.status, 200);
      assert.equal(deductChat.json.newBalance, 5);

      const deductIdem = await api('/api/credits/deduct', {
        method: 'POST',
        token: registeredClientToken,
        body: JSON.stringify({ serviceType: 'chat', idempotencyKey: 'e2e-chat-1' })
      });
      assert.equal(deductIdem.status, 200);
      assert.equal(deductIdem.json.isDuplicate, true);

      const deductInsufficient = await api('/api/credits/deduct', {
        method: 'POST',
        token: registeredClientToken,
        body: JSON.stringify({ serviceType: 'image', idempotencyKey: 'e2e-img-fail' })
      });
      assert.equal(deductInsufficient.status, 402);

      const nonAdminVerify = await api(`/api/credits/recharge/${rchPending.json.recharge.id}/verify`, {
        method: 'POST',
        token: registeredClientToken
      });
      assert.equal(nonAdminVerify.status, 403);

      const adminVerify = await api(`/api/credits/recharge/${rchPending.json.recharge.id}/verify`, {
        method: 'POST',
        token: adminSession.token
      });
      assert.equal(adminVerify.status, 200);
      assert.equal(adminVerify.json.newBalance, 355);

      const nonAdminRefund = await api('/api/credits/refund', {
        method: 'POST',
        token: registeredClientToken,
        body: JSON.stringify({ usageId: deductChat.json.usage.id })
      });
      assert.equal(nonAdminRefund.status, 403);

      const adminRefund = await api('/api/credits/refund', {
        method: 'POST',
        token: adminSession.token,
        body: JSON.stringify({ usageId: deductChat.json.usage.id, reason: 'Test E2E' })
      });
      assert.equal(adminRefund.status, 200);
      assert.equal(adminRefund.json.newBalance, 360);

      return 'Bonus 24h + pending recharge + idempotence + 402 + RBAC verify/refund validés';
    });

    // Scenario 13: Chat isolation & notifications read-all
    await step(13, 'Isolation messagerie participants & marquage notifications lues', async () => {
      const thirdPartyRead = await api('/api/commerce/chat/conv-client-seller-1/messages', {
        token: registeredClientToken
      });
      assert.equal(thirdPartyRead.status, 403, 'Un tiers non participant ne doit pas lire la conversation');

      const clientSend = await api('/api/commerce/chat/conv-client-seller-1/messages', {
        method: 'POST',
        token: clientSession.token,
        body: JSON.stringify({ body: 'Bonjour boutique, test E2E sécurisé.' })
      });
      assert.equal(clientSend.status, 201);

      const readAll = await api('/api/commerce/notifications/read-all', {
        method: 'POST',
        token: clientSession.token
      });
      assert.equal(readAll.status, 200);
      return `Participant autorisé (${registeredClientId} bloqué 403)`;
    });

    // Scenario 14: Admin platform config update + fixed 150 FCFA consistency
    await step(14, 'Configuration tarifs Admin (commission fixe 150 FCFA cohérente)', async () => {
      const patchCfg = await api('/api/commerce/config', {
        method: 'PATCH',
        token: adminSession.token,
        body: JSON.stringify({
          commissionModel: 'fixed_fcfa',
          marketplaceCommissionRate: 150,
          sellerCommissionRate: 150,
          driverCommissionRate: 150
        })
      });
      assert.equal(patchCfg.status, 200);
      assert.equal(patchCfg.json.platformConfig.marketplaceCommissionRate, 150);
      assert.equal(patchCfg.json.platformConfig.commissionModel, 'fixed_fcfa');
      return 'Configuration 150 FCFA fixe persistée et lue';
    });

    // Scenario 15: Honest DB health & unauthenticated WebSocket rejection
    await step(15, 'Santé PostgreSQL honnête (/api/health/database) & rejet WebSocket anonyme', async () => {
      const dbHealth = await api('/api/health/database');
      assert.ok([200, 503].includes(dbHealth.status));
      assert.equal(typeof dbHealth.json.configured, 'boolean');
      assert.equal(typeof dbHealth.json.connected, 'boolean');
      if (!process.env.DATABASE_URL) {
        assert.equal(dbHealth.json.configured, false);
        assert.equal(dbHealth.json.connected, false);
      }

      const wsCheck = await testWebSocketRejectsUnauthenticated('/api/live-voice');
      assert.equal(wsCheck.rejected, true, `WS anonyme aurait dû être rejeté: ${wsCheck.details}`);
      return `DB(${dbHealth.json.configured}/${dbHealth.json.connected}) & WS anonyme rejeté (${wsCheck.details})`;
    });

    console.log(`\n✅ TOUS LES 15 SCÉNARIOS E2E DJASSA ONT RÉUSSI (${results.length}/15 PASS).`);
  } catch (err) {
    console.error('\n❌ ÉCHEC SUITE E2E DJASSA:', err);
    if (serverStderr.trim()) {
      console.error('--- Server stderr tail ---\n', serverStderr.slice(-1500));
    }
    process.exitCode = 1;
  } finally {
    if (child?.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // already exited
      }
      await new Promise((r) => setTimeout(r, 400));
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        // already exited
      }
    }
    clearAndRestoreDir(backupDataDir, DATA_DIR);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
}

await runSuite();
process.exit(process.exitCode || 0);
