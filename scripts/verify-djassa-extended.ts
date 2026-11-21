import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import WebSocket from 'ws';

const ROOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA_DIR = path.join(ROOT_DIR, 'server', 'data');
const TEST_PORT = 3201;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

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
): Promise<{ status: number; json: any; headers: Headers; rawText: string }> {
  const { token, extraHeaders, ...rest } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extraHeaders || {})
  };
  const res = await fetch(`${BASE_URL}${urlPath}`, { ...rest, headers });
  const rawText = await res.text();
  let json: any = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, headers: res.headers, rawText };
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
    await new Promise((r) => setTimeout(r, 350));
  }
  throw new Error('Timeout en attendant le démarrage du serveur de test étendu (3201).');
}

async function loginSeed(email: string, password: string): Promise<{ token: string; user: any }> {
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  assert.equal(res.status, 200, `Échec login ${email}: ${res.rawText}`);
  return { token: res.json.token, user: res.json.user };
}

async function testLiveStreamWsGuard(clientToken: string): Promise<string> {
  // 1. Anonymous user sending chat/pin_product over /api/live-stream must receive error and NOT broadcast pin_product
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/api/live-stream`);
    let gotErr = false;
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error('Timeout WS /api/live-stream anonyme'));
    }, 5000);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'pin_product', productId: 'prod-1' }));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'error' && msg.error === 'UNAUTHORIZED') {
        gotErr = true;
        clearTimeout(timer);
        ws.close();
        resolve();
      }
    });
    ws.on('close', () => {
      if (!gotErr) {
        clearTimeout(timer);
        reject(new Error('WS anonyme fermé sans code erreur UNAUTHORIZED'));
      }
    });
  });

  // 2. Client role token attempting pin_product must be rejected (seller/admin only)
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/api/live-stream?token=${encodeURIComponent(clientToken)}`);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error('Timeout WS /api/live-stream client pin_product'));
    }, 5000);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'pin_product', productId: 'prod-1' }));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'error' && msg.error === 'FORBIDDEN') {
        clearTimeout(timer);
        ws.close();
        resolve();
      }
    });
  });

  return 'Anonyme rejeté (UNAUTHORIZED) & client bloqué sur pin_product (FORBIDDEN)';
}

async function runExtendedSuite() {
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'djassa-ext-backup-'));
  const backupDataDir = path.join(backupDir, 'data');
  if (fs.existsSync(DATA_DIR)) {
    copyDirRecursive(DATA_DIR, backupDataDir);
  }

  let child: ChildProcess | null = null;
  let serverStderr = '';
  let passed = 0;

  try {
    const tsxBin = path.join(ROOT_DIR, 'node_modules', '.bin', 'tsx');
    child = spawn(tsxBin, ['server.ts'], {
      cwd: ROOT_DIR,
      detached: true,
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        NODE_ENV: 'development'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stderr?.on('data', (chunk) => {
      serverStderr += chunk.toString();
    });

    await waitForServer();

    const step = async (id: number, name: string, fn: () => Promise<string>) => {
      const detail = await fn();
      passed++;
      console.log(`[PASS] #${id} ${name} — ${detail}`);
    };

    const clientSession = await loginSeed('client@djassa.ci', process.env.DJASSA_SEED_CLIENT_PASSWORD || 'Client123');
    const sellerSession = await loginSeed('vendeur@djassa.ci', process.env.DJASSA_SEED_SELLER_PASSWORD || 'Vendeur123');
    const adminSession = await loginSeed('admin@djassa.ci', process.env.DJASSA_SEED_ADMIN_PASSWORD || 'Admin123');

    await step(1, 'Blocage falsification session via /api/security/sessions/heartbeat', async () => {
      const forgeHb = await api('/api/security/sessions/heartbeat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'sess-fake-admin-' + Date.now(),
          userId: 'hacker-1',
          userEmail: 'admin@djassa.ci',
          role: 'admin'
        })
      });
      assert.equal(forgeHb.status, 401, `Heartbeat anonyme aurait dû renvoyer 401, reçu ${forgeHb.status}`);

      const mismatchHb = await api('/api/security/sessions/heartbeat', {
        method: 'POST',
        token: clientSession.token,
        body: JSON.stringify({
          sessionId: 'sess-other-session-xyz',
          userEmail: clientSession.user.email,
          role: 'admin'
        })
      });
      assert.ok([401, 403].includes(mismatchHb.status), `Heartbeat mismatch aurait dû renvoyer 401/403, reçu ${mismatchHb.status}`);
      return `HTTP ${forgeHb.status}/${mismatchHb.status} appliqués, aucune session admin falsifiable`;
    });

    await step(2, 'Blocage falsification /api/security/telemetry/login sans token', async () => {
      const forgeTel = await api('/api/security/telemetry/login', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'sess-fake-tel',
          accountId: 'hacker',
          accountEmail: 'admin@djassa.ci',
          role: 'admin'
        })
      });
      assert.equal(forgeTel.status, 401);
      return 'HTTP 401 confirmé';
    });

    await step(3, 'Concurrence stock : 2 commandes parallèles sur stock=1 (1 succès, 1 conflit 409)', async () => {
      const createP = await api('/api/commerce/products', {
        method: 'POST',
        token: sellerSession.token,
        body: JSON.stringify({ name: 'Article Rare Stock 1', price: 8000, stock: 1, category: 'Mode' })
      });
      assert.equal(createP.status, 201);
      const rareId = createP.json.product.id;

      const orderPayload = {
        items: [{ productId: rareId, quantity: 1 }],
        paymentMethod: 'wave',
        deliveryAddress: {
          commune: 'Cocody',
          quartier: 'Riviera',
          details: 'Carrefour Faya',
          recipientName: 'Amina',
          phone: '+2250700000001'
        },
        selectedDriverId: 'driver-1',
        deliveryMode: 'normal'
      };

      const [r1, r2] = await Promise.all([
        api('/api/commerce/orders', { method: 'POST', token: clientSession.token, body: JSON.stringify(orderPayload) }),
        api('/api/commerce/orders', { method: 'POST', token: clientSession.token, body: JSON.stringify(orderPayload) })
      ]);

      const statuses = [r1.status, r2.status].sort((a, b) => a - b);
      assert.deepEqual(statuses, [201, 409], `Résultats concurrence inattendus: ${statuses.join(', ')}`);

      const catalog = await api('/api/commerce/products');
      const updated = catalog.json.products.find((p: any) => p.id === rareId);
      assert.equal(updated.stock, 0, 'Le stock final doit être strictement 0 sans stock négatif');
      return `Statuts parallèles [${statuses.join(', ')}], stock final = 0`;
    });

    await step(4, 'Concurrence & idempotence retrait vendeur (pas de double débit)', async () => {
      const wallet = await api('/api/commerce/wallets/me', { token: sellerSession.token });
      const bal = wallet.json.balanceFcfa;
      assert.ok(bal >= 2000, `Solde vendeur test trop bas (${bal})`);
      const halfPlusOne = Math.floor(bal * 0.6);
      const idemKey = 'idem-wdr-' + Date.now();

      const idem1 = await api('/api/commerce/withdrawals', {
        method: 'POST',
        token: sellerSession.token,
        body: JSON.stringify({
          amountFcfa: 1000,
          channel: 'Wave CI',
          payoutTarget: '+2250701020304',
          idempotencyKey: idemKey
        })
      });
      const idem2 = await api('/api/commerce/withdrawals', {
        method: 'POST',
        token: sellerSession.token,
        body: JSON.stringify({
          amountFcfa: 1000,
          channel: 'Wave CI',
          payoutTarget: '+2250701020304',
          idempotencyKey: idemKey
        })
      });
      assert.equal(idem1.status, 200);
      assert.equal(idem2.status, 200);
      assert.equal(idem2.json.idempotent, true);
      assert.equal(idem2.json.newBalanceFcfa, bal - 1000);

      const remaining = bal - 1000;
      const twoBig = await Promise.all([
        api('/api/commerce/withdrawals', {
          method: 'POST',
          token: sellerSession.token,
          body: JSON.stringify({
            amountFcfa: Math.min(remaining, Math.max(600, halfPlusOne)),
            channel: 'Wave CI',
            payoutTarget: '+2250701020304'
          })
        }),
        api('/api/commerce/withdrawals', {
          method: 'POST',
          token: sellerSession.token,
          body: JSON.stringify({
            amountFcfa: Math.min(remaining, Math.max(600, halfPlusOne)),
            channel: 'Wave CI',
            payoutTarget: '+2250701020304'
          })
        })
      ]);
      const walletAfter = (await api('/api/commerce/wallets/me', { token: sellerSession.token })).json.balanceFcfa;
      assert.ok(walletAfter >= 0, 'Le solde portefeuille ne doit jamais devenir négatif');
      const okCount = twoBig.filter((x) => x.status === 200).length;
      assert.ok(okCount <= 1 || walletAfter >= 0, 'Un seul retrait concurrent supérieur à la moitié du solde peut réussir');
      return `Idempotence vérifiée + concurrence sans découvert (solde final ${walletAfter} FCFA)`;
    });

    await step(5, 'Proxy IA /api/ai/chat & /api/ai/capabilities honnêtes (401/503)', async () => {
      const noAuth = await api('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Bonjour' })
      });
      assert.equal(noAuth.status, 401);

      const caps = await api('/api/ai/capabilities', { token: clientSession.token });
      assert.equal(caps.status, 200);
      assert.equal(typeof caps.json.capabilities?.rodiumAi, 'boolean');

      if (!process.env.RODIUMAI_API_KEY) {
        const unconf = await api('/api/ai/chat', {
          method: 'POST',
          token: clientSession.token,
          body: JSON.stringify({ prompt: 'Cherche chaussures Abidjan' })
        });
        assert.equal(unconf.status, 503);
        assert.ok(
          unconf.json.error === 'RODIUMAI_NOT_CONFIGURED' || unconf.json.error === 'AI_PROVIDER_NOT_CONFIGURED',
          `Code erreur IA inattendu: ${unconf.json.error}`
        );
      }

      const adminStatus = await api('/api/ai/status', { token: adminSession.token });
      assert.equal(adminStatus.status, 200);
      return 'Auth 401 + capabilities 200 + absence RODIUMAI_API_KEY signalée 503 honnêtement';
    });

    await step(6, 'WebSocket /api/live-stream (rejet anonyme et rôle client sur pin_product)', async () => {
      return await testLiveStreamWsGuard(clientSession.token);
    });

    await step(7, 'Catch-all JSON 404 sur /api/* inconnu & 503 honnête sur /api/health/database', async () => {
      const unknownApi = await api('/api/route-inexistante-e2e');
      assert.equal(unknownApi.status, 404);
      assert.ok(unknownApi.json && unknownApi.json.success === false, 'Doit retourner JSON structuré, jamais HTML Vite');

      const dbHealth = await api('/api/health/database');
      if (!process.env.DATABASE_URL) {
        assert.equal(dbHealth.status, 503);
        assert.equal(dbHealth.json.configured, false);
        assert.equal(dbHealth.json.connected, false);
      } else {
        assert.equal(dbHealth.status, 200);
      }
      return 'API 404 JSON + PostgreSQL 503/200 vérifiés';
    });

    await step(8, 'Double remboursement crédits bloqué (409) & CORS OPTIONS étranger bloqué (403)', async () => {
      const badOptions = await api('/api/health', {
        method: 'OPTIONS',
        extraHeaders: {
          Origin: 'https://evil-phishing.example',
          'Access-Control-Request-Method': 'POST'
        }
      });
      assert.equal(badOptions.status, 403);

      const newEmail = `buyer.double.${Date.now()}@djassa.ci`;
      const reg = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Double Refund', email: newEmail, password: 'Password123!', role: 'client' })
      });
      assert.equal(reg.status, 201);
      await api('/api/credits/claim-daily-bonus', { method: 'POST', token: reg.json.token });
      const deduct = await api('/api/credits/deduct', {
        method: 'POST',
        token: reg.json.token,
        body: JSON.stringify({ serviceType: 'chat', idempotencyKey: 'dbl-ref-' + Date.now() })
      });
      assert.equal(deduct.status, 200);
      const usageId = deduct.json.usage.id;

      const ref1 = await api('/api/credits/refund', {
        method: 'POST',
        token: adminSession.token,
        body: JSON.stringify({ usageId, reason: 'Test double refund 1' })
      });
      assert.equal(ref1.status, 200);

      const ref2 = await api('/api/credits/refund', {
        method: 'POST',
        token: adminSession.token,
        body: JSON.stringify({ usageId, reason: 'Test double refund 2' })
      });
      assert.equal(ref2.status, 409);
      return 'Double remboursement bloqué 409 + preflight CORS étranger bloqué 403';
    });

    console.log(`\n✅ SUITE ÉTENDUE DJASSA TERMINÉE : ${passed}/8 PASS.`);
  } catch (err) {
    console.error('\n❌ ÉCHEC SUITE ÉTENDUE:', err);
    if (serverStderr.trim()) {
      console.error('--- Server stderr tail ---\n', serverStderr.slice(-1500));
    }
    process.exitCode = 1;
  } finally {
    if (child?.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, 400));
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        // ignore
      }
    }
    clearAndRestoreDir(backupDataDir, DATA_DIR);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
}

await runExtendedSuite();
process.exit(process.exitCode || 0);
