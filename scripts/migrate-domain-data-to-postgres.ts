import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

const APPLY = process.argv.includes('--apply');
const LOCAL_CHECK_ONLY = process.argv.includes('--local-check');
const DATA_DIR = path.resolve(process.env.DJASSA_DATA_DIR || 'server/data');

const sha256 = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');

function deterministicUuid(seed: string): string {
  const hex = sha256(`djassa-uuid:${seed}`);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function readJsonIfExists<T>(fileName: string): { exists: boolean; sha: string | null; data: T | null; parseError?: string } {
  const full = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(full)) return { exists: false, sha: null, data: null };
  const raw = fs.readFileSync(full);
  try {
    return { exists: true, sha: sha256(raw), data: JSON.parse(raw.toString('utf8')) as T };
  } catch (err) {
    return {
      exists: true,
      sha: sha256(raw),
      data: null,
      parseError: err instanceof Error ? err.message : 'JSON invalide'
    };
  }
}

function mapOrderStatusToPg(status: string): string {
  if (status === 'passed') return 'paid';
  if (status === 'driver_assigned') return 'assigned';
  if (status === 'in_delivery') return 'in_transit';
  const allowed = new Set([
    'pending_payment',
    'paid',
    'preparing',
    'ready_for_pickup',
    'assigned',
    'in_transit',
    'delivered',
    'cancelled',
    'refunded',
    'disputed'
  ]);
  return allowed.has(status) ? status : 'pending_payment';
}

function mapPaymentStatusToPg(status: string): string {
  if (status === 'paid') return 'confirmed';
  const allowed = new Set(['pending', 'processing', 'confirmed', 'failed', 'cancelled', 'partially_refunded', 'refunded']);
  return allowed.has(status) ? status : 'pending';
}

function normalizeVehicle(vehicleType: string): 'motorcycle' | 'car' | 'van' | 'truck' | 'other' {
  const v = String(vehicleType || '').toLowerCase();
  if (v.includes('camion') || v.includes('truck')) return 'truck';
  if (v.includes('fourgon') || v.includes('van') || v.includes('tricycle')) return 'van';
  if (v.includes('voiture') || v.includes('car')) return 'car';
  return 'motorcycle';
}

interface ValidationSummary {
  errors: string[];
  warnings: string[];
  counts: {
    products: number;
    orders: number;
    payments: number;
    withdrawals: number;
    deliveryCompanies: number;
    drivers: number;
    locationPings: number;
    conversations: number;
    messages: number;
    notifications: number;
    aiAccounts: number;
    aiRecharges: number;
    aiUsages: number;
    adminSettings: number;
    adminCampaigns: number;
    adminProviders: number;
    clientProfiles: number;
  };
  totals: {
    productStockUnits: number;
    ordersTotalFcfa: number;
    confirmedPaymentsFcfa: number;
    withdrawalsFcfa: number;
    aiCreditsBalance: number;
    ledgerNetByAccount: Record<string, number>;
  };
}

async function ensureUser(client: PoolClient, userId: string, displayName: string, email?: string) {
  const uid = deterministicUuid(`user:${userId}`);
  const safeEmail = (email || `${userId.replace(/[^a-zA-Z0-9._-]/g, '_')}@djassa.internal`).toLowerCase();
  await client.query(
    `INSERT INTO djassa_users(id, email, display_name, status)
     VALUES($1::uuid, $2, $3, 'active')
     ON CONFLICT (id) DO UPDATE SET display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), djassa_users.display_name)`,
    [uid, safeEmail, displayName || userId]
  );
  return uid;
}

async function stageRecord(
  client: PoolClient,
  batchId: string,
  collectionPath: string,
  recordKey: string,
  payload: unknown,
  validationStatus: 'valid' | 'rejected' = 'valid',
  validationErrors: string[] = []
) {
  const serialized = JSON.stringify(payload ?? {});
  await client.query(
    `INSERT INTO djassa_legacy_import_records(
       batch_id, collection_path, record_key, payload, payload_sha256, validation_status, validation_errors
     )
     VALUES($1::uuid, $2, $3, $4::jsonb, $5, $6, $7::jsonb)
     ON CONFLICT (batch_id, collection_path, record_key) DO UPDATE SET
       payload = EXCLUDED.payload,
       payload_sha256 = EXCLUDED.payload_sha256,
       validation_status = EXCLUDED.validation_status,
       validation_errors = EXCLUDED.validation_errors`,
    [batchId, collectionPath, recordKey, serialized, sha256(serialized), validationStatus, JSON.stringify(validationErrors)]
  );
}

async function main() {
  if (APPLY && process.env.DJASSA_CONFIRM_DOMAIN_IMPORT !== 'YES') {
    throw new Error('Pour appliquer l’import réel, définir DJASSA_CONFIRM_DOMAIN_IMPORT=YES après sauvegarde vérifiée.');
  }

  const commerceFile = readJsonIfExists<any>('commerce_db.json');
  const creditsFile = readJsonIfExists<any>('credits_billing.json');
  const controlPlaneFile = readJsonIfExists<any>('admin_control_plane.json');
  const clientStateFile = readJsonIfExists<any>('client_state.json');
  const securityFile = readJsonIfExists<any>('security_db.json');

  const summary: ValidationSummary = {
    errors: [],
    warnings: [],
    counts: {
      products: 0,
      orders: 0,
      payments: 0,
      withdrawals: 0,
      deliveryCompanies: 0,
      drivers: 0,
      locationPings: 0,
      conversations: 0,
      messages: 0,
      notifications: 0,
      aiAccounts: 0,
      aiRecharges: 0,
      aiUsages: 0,
      adminSettings: 0,
      adminCampaigns: 0,
      adminProviders: 0,
      clientProfiles: 0
    },
    totals: {
      productStockUnits: 0,
      ordersTotalFcfa: 0,
      confirmedPaymentsFcfa: 0,
      withdrawalsFcfa: 0,
      aiCreditsBalance: 0,
      ledgerNetByAccount: {}
    }
  };

  for (const [label, f] of [
    ['commerce_db.json', commerceFile],
    ['credits_billing.json', creditsFile],
    ['admin_control_plane.json', controlPlaneFile],
    ['client_state.json', clientStateFile],
    ['security_db.json', securityFile]
  ] as const) {
    if (f.parseError) summary.errors.push(`${label}: JSON invalide (${f.parseError})`);
    else if (!f.exists) summary.warnings.push(`${label}: fichier absent (ignoré).`);
  }

  const commerce = commerceFile.data || {};
  const credits = creditsFile.data || {};
  const controlPlane = controlPlaneFile.data || {};
  const clientState = clientStateFile.data || {};
  const securityDb = securityFile.data || {};

  const products: any[] = Array.isArray(commerce.products) ? commerce.products : [];
  const orders: any[] = Array.isArray(commerce.orders) ? commerce.orders : [];
  const payments: any[] = Array.isArray(commerce.payments) ? commerce.payments : [];
  const withdrawals: any[] = Array.isArray(commerce.withdrawals) ? commerce.withdrawals : [];
  const companies: any[] = Array.isArray(commerce.deliveryCompanies) ? commerce.deliveryCompanies : [];
  const drivers: any[] = Array.isArray(commerce.drivers) ? commerce.drivers : [];
  const locationPings: any[] = Array.isArray(commerce.locationPings) ? commerce.locationPings : [];
  const conversations: any[] = Array.isArray(commerce.conversations) ? commerce.conversations : [];
  const messagesByConv: Record<string, any[]> =
    commerce.messages && typeof commerce.messages === 'object' ? commerce.messages : {};
  const notifications: any[] = Array.isArray(commerce.notifications) ? commerce.notifications : [];
  const financeLedger: any[] = Array.isArray(securityDb.financeLedger) ? securityDb.financeLedger : [];

  // Validate products & stocks
  const seenOrderNumbers = new Set<string>();
  for (const p of products) {
    if (!p?.id || !p?.sellerId) {
      summary.errors.push(`Produit invalide sans id/sellerId: ${JSON.stringify(p)?.slice(0, 80)}`);
      continue;
    }
    const stock = Number(p.stock ?? 0);
    const price = Number(p.price ?? 0);
    if (!Number.isFinite(stock) || stock < 0) summary.errors.push(`Produit ${p.id}: stock négatif (${stock})`);
    if (!Number.isFinite(price) || price < 0) summary.errors.push(`Produit ${p.id}: prix négatif (${price})`);
    summary.counts.products++;
    summary.totals.productStockUnits += Math.max(0, Math.floor(stock));
  }

  // Validate orders & totals
  for (const o of orders) {
    if (!o?.id || !o?.orderNumber || !o?.clientId) {
      summary.errors.push(`Commande invalide sans id/orderNumber/clientId`);
      continue;
    }
    if (seenOrderNumbers.has(o.orderNumber)) {
      summary.errors.push(`Numéro de commande dupliqué: ${o.orderNumber}`);
    }
    seenOrderNumbers.add(o.orderNumber);
    const items: any[] = Array.isArray(o.items) ? o.items : [];
    const expectedSub = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
    if (Number(o.subtotal || 0) !== expectedSub) {
      summary.warnings.push(`Commande ${o.orderNumber}: écart subtotal (${o.subtotal} vs lignes=${expectedSub}).`);
    }
    const total = Math.max(0, Math.round(Number(o.total || 0)));
    summary.counts.orders++;
    summary.totals.ordersTotalFcfa += total;
  }

  // Validate payments
  for (const pay of payments) {
    if (!pay?.id || !pay?.orderId) {
      summary.errors.push(`Paiement invalide sans id/orderId`);
      continue;
    }
    const amt = Math.round(Number(pay.amountFcfa || 0));
    if (amt <= 0) summary.errors.push(`Paiement ${pay.id}: montant <= 0`);
    summary.counts.payments++;
    if (mapPaymentStatusToPg(pay.status) === 'confirmed') {
      summary.totals.confirmedPaymentsFcfa += amt;
    }
  }

  // Validate ledger sums (non-negative balances)
  for (const entry of financeLedger) {
    const acc = String(entry?.accountId || '');
    const amt = Math.round(Number(entry?.amountFcfa || 0));
    if (!acc || amt <= 0) continue;
    const prev = summary.totals.ledgerNetByAccount[acc] || 0;
    if (entry.type === 'credit' || entry.type === 'release') {
      summary.totals.ledgerNetByAccount[acc] = prev + amt;
    } else if (entry.type === 'debit' || entry.type === 'hold') {
      summary.totals.ledgerNetByAccount[acc] = prev - amt;
    }
  }
  for (const [acc, bal] of Object.entries(summary.totals.ledgerNetByAccount)) {
    if (bal < 0) summary.errors.push(`Compte portefeuille ${acc}: solde net négatif dans le ledger (${bal} FCFA)`);
  }

  for (const w of withdrawals) {
    const amt = Math.round(Number(w?.amountFcfa || 0));
    if (amt > 0) summary.totals.withdrawalsFcfa += amt;
    summary.counts.withdrawals++;
  }

  summary.counts.deliveryCompanies = companies.length;
  summary.counts.drivers = drivers.length;
  summary.counts.locationPings = locationPings.length;
  summary.counts.conversations = conversations.length;
  summary.counts.messages = Object.values(messagesByConv).reduce((acc, list) => acc + (Array.isArray(list) ? list.length : 0), 0);
  summary.counts.notifications = notifications.length;

  const aiAccountsObj: Record<string, any> = credits.accounts && typeof credits.accounts === 'object' ? credits.accounts : {};
  const aiRecharges: any[] = Array.isArray(credits.recharges) ? credits.recharges : [];
  const aiUsages: any[] = Array.isArray(credits.usages) ? credits.usages : [];
  for (const [uid, acc] of Object.entries(aiAccountsObj)) {
    const bal = Math.floor(Number(acc?.balance || 0));
    if (bal < 0) summary.errors.push(`Compte crédits IA ${uid}: solde négatif (${bal})`);
    summary.counts.aiAccounts++;
    summary.totals.aiCreditsBalance += Math.max(0, bal);
  }
  summary.counts.aiRecharges = aiRecharges.length;
  summary.counts.aiUsages = aiUsages.length;

  const settingsObj: Record<string, any> =
    controlPlane.settings && typeof controlPlane.settings === 'object' ? controlPlane.settings : {};
  const campaigns: any[] = Array.isArray(controlPlane.campaigns) ? controlPlane.campaigns : [];
  const providers: any[] = Array.isArray(controlPlane.providers) ? controlPlane.providers : [];
  summary.counts.adminSettings = Object.keys(settingsObj).length;
  summary.counts.adminCampaigns = campaigns.length;
  summary.counts.adminProviders = providers.length;

  const clientProfiles: Record<string, any> =
    clientState.profiles && typeof clientState.profiles === 'object' ? clientState.profiles : {};
  summary.counts.clientProfiles = Object.keys(clientProfiles).length;

  console.log('=== DJASSA MIGRATION DOMAINE VERS POSTGRESQL ===');
  console.log(`Mode : ${APPLY ? 'APPLY (TRANSACTIONNEL + COMMIT)' : LOCAL_CHECK_ONLY ? 'LOCAL CHECK ONLY' : 'PREVIEW (ROLLBACK TRANSACTIONNEL)'}`);
  console.log(`Répertoire source : ${DATA_DIR}`);
  console.log('Comptes / volumes validés :', JSON.stringify(summary.counts));
  console.log('Totaux réconciliation source :', JSON.stringify({
    productStockUnits: summary.totals.productStockUnits,
    ordersTotalFcfa: summary.totals.ordersTotalFcfa,
    confirmedPaymentsFcfa: summary.totals.confirmedPaymentsFcfa,
    withdrawalsFcfa: summary.totals.withdrawalsFcfa,
    aiCreditsBalance: summary.totals.aiCreditsBalance
  }));
  if (summary.warnings.length > 0) {
    console.warn(`Avertissements (${summary.warnings.length}) :`, summary.warnings);
  }

  if (summary.errors.length > 0) {
    console.error(`Erreurs bloquantes (${summary.errors.length}) :`);
    summary.errors.forEach((e) => console.error(`- ${e}`));
    process.exitCode = 2;
    return;
  }

  if (LOCAL_CHECK_ONLY) {
    console.log('Validation locale terminée sans erreur bloquante.');
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL manquant : impossible d’exécuter le staging/import PostgreSQL.');
  }

  const combinedSha = sha256(
    [commerceFile.sha || '', creditsFile.sha || '', controlPlaneFile.sha || '', clientStateFile.sha || '', securityFile.sha || ''].join(':')
  );
  const totalSourceRecords = Object.values(summary.counts).reduce((a, b) => a + b, 0);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10000,
    ...(process.env.DATABASE_SSL === 'true'
      ? { ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } }
      : {})
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const batchRes = await client.query<{ id: string }>(
      `INSERT INTO djassa_legacy_import_batches(
         source_name, source_sha256, status, source_record_count, started_at
       )
       VALUES('domain_full_import', $1, 'running', $2, now())
       ON CONFLICT (source_name, source_sha256) DO UPDATE SET
         status = 'running',
         source_record_count = EXCLUDED.source_record_count,
         started_at = now()
       RETURNING id::text`,
      [combinedSha, totalSourceRecords]
    );
    const batchId = batchRes.rows[0].id;
    let importedCount = 0;

    // 1. Products & Stores
    for (const p of products) {
      await stageRecord(client, batchId, 'commerce_db.products', String(p.id), p);
      const sellerUserUuid = await ensureUser(client, String(p.sellerId), String(p.sellerName || 'Vendeur DJASSA'));
      const storeUuid = deterministicUuid(`store:${p.sellerId}`);
      const prodUuid = deterministicUuid(`product:${p.id}`);
      await client.query(
        `INSERT INTO djassa_stores(id, owner_user_id, name, status, city, metadata)
         VALUES($1::uuid, $2::uuid, $3, 'active', 'Abidjan', $4::jsonb)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()`,
        [storeUuid, sellerUserUuid, p.sellerName || 'Boutique DJASSA', JSON.stringify({ legacySellerId: p.sellerId })]
      );
      await client.query(
        `INSERT INTO djassa_products(
           id, store_id, title, description, price_fcfa, original_price_fcfa,
           stock_quantity, status, category, variants, media, metadata
         )
         VALUES($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           price_fcfa = EXCLUDED.price_fcfa,
           original_price_fcfa = EXCLUDED.original_price_fcfa,
           stock_quantity = EXCLUDED.stock_quantity,
           status = EXCLUDED.status,
           category = EXCLUDED.category,
           variants = EXCLUDED.variants,
           media = EXCLUDED.media,
           metadata = EXCLUDED.metadata,
           updated_at = now()`,
        [
          prodUuid,
          storeUuid,
          String(p.name || 'Produit DJASSA'),
          String(p.description || ''),
          Math.round(Number(p.price || 0)),
          p.originalPrice ? Math.round(Number(p.originalPrice)) : null,
          Math.max(0, Math.floor(Number(p.stock || 0))),
          ['draft', 'published', 'paused', 'archived'].includes(p.status) ? p.status : 'published',
          String(p.category || 'Mode'),
          JSON.stringify(p.variants || []),
          JSON.stringify(p.images || []),
          JSON.stringify({ legacyProductId: p.id, mediaBytes: Number(p.mediaBytes || 0) })
        ]
      );
      const imgs: string[] = Array.isArray(p.images) ? p.images : [];
      await client.query(`DELETE FROM djassa_product_media WHERE product_id = $1::uuid`, [prodUuid]);
      for (let i = 0; i < imgs.length; i++) {
        await client.query(
          `INSERT INTO djassa_product_media(product_id, media_type, media_url, position)
           VALUES($1::uuid, 'image', $2, $3)`,
          [prodUuid, String(imgs[i]), i]
        );
      }
      importedCount++;
    }

    // 2. Delivery companies & drivers
    for (const c of companies) {
      await stageRecord(client, batchId, 'commerce_db.deliveryCompanies', String(c.id), c);
      const compUuid = await ensureUser(client, String(c.id), String(c.tradeName || c.name || c.id));
      await client.query(
        `INSERT INTO djassa_delivery_companies(user_id, legal_name, verification_status, service_zones, contact_phone)
         VALUES($1::uuid, $2, 'verified', $3::jsonb, $4)
         ON CONFLICT (user_id) DO UPDATE SET
           legal_name = EXCLUDED.legal_name,
           service_zones = EXCLUDED.service_zones,
           updated_at = now()`,
        [compUuid, String(c.name || c.tradeName || c.id), JSON.stringify(c.coverageZones || []), c.phone || null]
      );
      const mins = parseInt(String(c.pickupTime || '25').replace(/[^\d]/g, ''), 10) || 25;
      await client.query(`UPDATE djassa_delivery_service_offers SET active = false WHERE company_user_id = $1::uuid`, [compUuid]);
      for (const offer of [
        { code: 'normal', label: 'Livraison Standard', price: Number(c.normalPrice || 1500), mins },
        { code: 'express', label: 'Livraison Express', price: Number(c.expressPrice || 2500), mins: Math.max(10, Math.round(mins * 0.6)) }
      ]) {
        await client.query(
          `INSERT INTO djassa_delivery_service_offers(company_user_id, service_code, display_name, price_fcfa, estimated_minutes, parcel_class, active)
           VALUES($1::uuid, $2, $3, $4, $5, 'standard', true)`,
          [compUuid, offer.code, offer.label, Math.round(offer.price), offer.mins]
        );
      }
      importedCount++;
    }

    for (const d of drivers) {
      await stageRecord(client, batchId, 'commerce_db.drivers', String(d.id), d);
      const drvUuid = await ensureUser(client, String(d.id), String(d.name || d.id));
      const compUuid = d.companyId ? deterministicUuid(`user:${d.companyId}`) : null;
      await client.query(
        `INSERT INTO djassa_driver_profiles(
           user_id, company_user_id, driver_type, verification_status, availability_status, vehicle_type, vehicle_registration
         )
         VALUES($1::uuid, $2::uuid, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id) DO UPDATE SET
           company_user_id = EXCLUDED.company_user_id,
           availability_status = EXCLUDED.availability_status,
           vehicle_type = EXCLUDED.vehicle_type,
           updated_at = now()`,
        [
          drvUuid,
          compUuid,
          d.partnerType === 'company' ? 'employee' : 'independent',
          d.verified ? 'verified' : 'pending',
          d.available ? 'available' : 'offline',
          normalizeVehicle(d.vehicleType),
          d.vehiclePlate || null
        ]
      );
      importedCount++;
    }

    // 3. Orders, Items, Assignments
    for (const o of orders) {
      await stageRecord(client, batchId, 'commerce_db.orders', String(o.id), o);
      const orderUuid = deterministicUuid(`order:${o.id}`);
      const clientUuid = await ensureUser(client, String(o.clientId), String(o.clientName || o.clientId));
      const sellerUserUuid = await ensureUser(client, String(o.sellerId), String(o.sellerName || 'Vendeur DJASSA'));
      const storeUuid = deterministicUuid(`store:${o.sellerId}`);
      await client.query(
        `INSERT INTO djassa_stores(id, owner_user_id, name, status) VALUES($1::uuid, $2::uuid, $3, 'active') ON CONFLICT (id) DO NOTHING`,
        [storeUuid, sellerUserUuid, String(o.sellerName || 'Boutique DJASSA')]
      );
      await client.query(
        `INSERT INTO djassa_orders(
           id, order_number, client_user_id, status, payment_status, currency,
           subtotal_fcfa, delivery_fee_fcfa, discount_fcfa, service_fee_fcfa, total_fcfa,
           delivery_address, delivery_mode, promo_code, metadata, created_at
         )
         VALUES($1::uuid,$2,$3::uuid,$4,$5,'XOF',$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14::jsonb,COALESCE($15::timestamptz,now()))
         ON CONFLICT (order_number) DO UPDATE SET
           status = EXCLUDED.status,
           payment_status = EXCLUDED.payment_status,
           updated_at = now()`,
        [
          orderUuid,
          String(o.orderNumber),
          clientUuid,
          mapOrderStatusToPg(o.status),
          mapPaymentStatusToPg(o.paymentStatus),
          Math.max(0, Math.round(Number(o.subtotal || 0))),
          Math.max(0, Math.round(Number(o.deliveryFee || 0))),
          Math.max(0, Math.round(Number(o.discount || 0))),
          Math.max(0, Math.round(Number(o.serviceFee || 0))),
          Math.max(0, Math.round(Number(o.total || 0))),
          JSON.stringify(o.deliveryAddress || {}),
          o.deliveryMode || 'normal',
          o.promoCode || null,
          JSON.stringify({ legacyOrderId: o.id }),
          o.createdAt || null
        ]
      );
      const items: any[] = Array.isArray(o.items) ? o.items : [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const itemUuid = deterministicUuid(`order_item:${o.id}:${i}`);
        const prodUuid = deterministicUuid(`product:${it.productId}`);
        await client.query(
          `INSERT INTO djassa_products(id, store_id, title, price_fcfa, stock_quantity, status)
           VALUES($1::uuid, $2::uuid, $3, $4, 0, 'published') ON CONFLICT (id) DO NOTHING`,
          [prodUuid, storeUuid, String(it.productTitle || 'Article'), Math.max(0, Math.round(Number(it.price || 0)))]
        );
        await client.query(
          `INSERT INTO djassa_order_items(
             id, order_id, product_id, store_id, product_title_snapshot,
             unit_price_fcfa, quantity, line_total_fcfa, variant_snapshot, product_image_snapshot, seller_name_snapshot
           )
           VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9::jsonb,$10,$11)
           ON CONFLICT (id) DO NOTHING`,
          [
            itemUuid,
            orderUuid,
            prodUuid,
            storeUuid,
            String(it.productTitle || 'Article'),
            Math.max(0, Math.round(Number(it.price || 0))),
            Math.max(1, Math.floor(Number(it.quantity || 1))),
            Math.max(0, Math.round(Number(it.price || 0) * Number(it.quantity || 1))),
            JSON.stringify(it.variant || {}),
            it.productImage || null,
            o.sellerName || null
          ]
        );
      }

      const assignUuid = deterministicUuid(`assign:${o.id}`);
      const drvUuid = o.driverId ? await ensureUser(client, String(o.driverId), String(o.driverName || o.driverId)) : null;
      const compUuid = o.deliveryCompanyId ? await ensureUser(client, String(o.deliveryCompanyId), String(o.deliveryCompanyName || o.deliveryCompanyId)) : null;
      await client.query(
        `INSERT INTO djassa_delivery_assignments(id, order_id, company_id, driver_id, status, parcel_class)
         VALUES($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6)
         ON CONFLICT (id) DO UPDATE SET driver_id = EXCLUDED.driver_id, status = EXCLUDED.status`,
        [
          assignUuid,
          orderUuid,
          compUuid,
          drvUuid,
          o.status === 'delivered' ? 'delivered' : o.status === 'in_delivery' ? 'in_transit' : o.driverId ? 'accepted' : 'unassigned',
          ['small', 'standard', 'large', 'bulky'].includes(o.parcelClass) ? o.parcelClass : 'standard'
        ]
      );
      importedCount++;
    }

    // 4. Payments
    for (const pay of payments) {
      await stageRecord(client, batchId, 'commerce_db.payments', String(pay.id), pay);
      const payUuid = deterministicUuid(`payment:${pay.id}`);
      const orderUuid = deterministicUuid(`order:${pay.orderId}`);
      await client.query(
        `INSERT INTO djassa_payments(
           id, order_id, provider, provider_reference, idempotency_key, amount_fcfa, status, payment_method, created_at
         )
         VALUES($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, now()))
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, provider_reference = EXCLUDED.provider_reference`,
        [
          payUuid,
          orderUuid,
          String(pay.provider || 'geniuspay'),
          pay.providerReference || null,
          String(pay.idempotencyKey || `import-pay-${pay.id}`),
          Math.max(1, Math.round(Number(pay.amountFcfa || 1))),
          mapPaymentStatusToPg(pay.status),
          pay.provider || 'wave',
          pay.createdAt || null
        ]
      );
      importedCount++;
    }

    // 5. Security Finance Ledger -> Wallets & Wallet Ledger
    for (const entry of financeLedger) {
      if (!entry?.id || !entry?.accountId || !(Number(entry?.amountFcfa) > 0)) continue;
      const ownerUuid = await ensureUser(client, String(entry.accountId), String(entry.accountName || entry.accountId), entry.accountEmail);
      const wRes = await client.query<{ id: string }>(
        `INSERT INTO djassa_wallets(owner_user_id, currency) VALUES($1::uuid, 'XOF')
         ON CONFLICT (owner_user_id, currency) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id
         RETURNING id::text`,
        [ownerUuid]
      );
      const entryType = ['credit', 'debit', 'hold', 'release', 'fee', 'refund', 'adjustment'].includes(entry.type)
        ? entry.type
        : 'adjustment';
      await client.query(
        `INSERT INTO djassa_wallet_ledger(
           wallet_id, transaction_key, entry_type, amount_fcfa, status, description, idempotency_key, source_system, posted_at
         )
         VALUES($1::uuid, $2, $3, $4, 'posted', $5, $2, 'legacy_json_import', COALESCE($6::timestamptz, now()))
         ON CONFLICT (transaction_key) DO NOTHING`,
        [
          wRes.rows[0].id,
          String(entry.id),
          entryType,
          Math.round(Number(entry.amountFcfa)),
          String(entry.description || 'Import historique'),
          entry.createdAt || null
        ]
      );
    }

    // 6. Withdrawals
    for (const w of withdrawals) {
      await stageRecord(client, batchId, 'commerce_db.withdrawals', String(w.id), w);
      await client.query(
        `INSERT INTO djassa_withdrawals(
           account_id, account_role, amount_fcfa, fee_fcfa, net_amount_fcfa, channel, payout_target_masked, reference, status, created_at
         )
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10::timestamptz,now()))
         ON CONFLICT (reference) DO UPDATE SET status = EXCLUDED.status`,
        [
          String(w.accountId),
          ['seller', 'driver', 'company'].includes(w.accountRole) ? w.accountRole : 'seller',
          Math.max(1, Math.round(Number(w.amountFcfa || 1))),
          Math.max(0, Math.round(Number(w.feeFcfa || 0))),
          Math.max(0, Math.round(Number(w.netAmountFcfa || w.amountFcfa || 0))),
          String(w.channel || 'Wave CI'),
          String(w.payoutTarget || '****'),
          String(w.reference || w.id),
          ['pending', 'processing', 'completed', 'held_security', 'rejected', 'failed'].includes(w.status) ? w.status : 'pending',
          w.createdAt || null
        ]
      );
      importedCount++;
    }

    // 7. GPS Location Pings
    for (const ping of locationPings) {
      if (!ping?.orderId || !ping?.driverId) continue;
      const assignUuid = deterministicUuid(`assign:${ping.orderId}`);
      const drvUuid = deterministicUuid(`user:${ping.driverId}`);
      const existsAssign = await client.query(`SELECT 1 FROM djassa_delivery_assignments WHERE id = $1::uuid`, [assignUuid]);
      if (existsAssign.rows.length > 0) {
        await client.query(
          `INSERT INTO djassa_delivery_location_pings(assignment_id, driver_user_id, latitude, longitude, accuracy_m, recorded_at, source)
           VALUES($1::uuid, $2::uuid, $3, $4, $5, COALESCE($6::timestamptz, now()), 'device')
           ON CONFLICT (assignment_id, driver_user_id, recorded_at) DO NOTHING`,
          [assignUuid, drvUuid, Number(ping.lat), Number(ping.lng), ping.accuracyM ?? null, ping.recordedAt || null]
        );
      }
      importedCount++;
    }

    // 8. Communications & Notifications
    for (const conv of conversations) {
      await stageRecord(client, batchId, 'commerce_db.conversations', String(conv.id), conv);
      const convUuid = deterministicUuid(`conv:${conv.id}`);
      await client.query(
        `INSERT INTO djassa_conversations(id, conversation_type, title, last_message_at, metadata)
         VALUES($1::uuid, 'direct', $2, COALESCE($3::timestamptz, now()), $4::jsonb)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, last_message_at = EXCLUDED.last_message_at`,
        [convUuid, String(conv.title || 'Discussion DJASSA'), conv.updatedAt || null, JSON.stringify({ legacyConversationId: conv.id })]
      );
      const pIds: string[] = Array.isArray(conv.participantIds) ? conv.participantIds : [];
      for (const pid of pIds) {
        const pUuid = await ensureUser(client, String(pid), String(pid));
        await client.query(
          `INSERT INTO djassa_conversation_members(conversation_id, user_id) VALUES($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`,
          [convUuid, pUuid]
        );
      }
      const msgs = messagesByConv[conv.id] || [];
      for (const m of msgs) {
        const mUuid = deterministicUuid(`msg:${m.id}`);
        const sUuid = await ensureUser(client, String(m.senderId || 'system'), String(m.senderName || 'Système'));
        await client.query(
          `INSERT INTO djassa_messages(id, conversation_id, sender_user_id, body, message_type, client_message_id, created_at)
           VALUES($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, COALESCE($7::timestamptz, now()))
           ON CONFLICT (id) DO NOTHING`,
          [
            mUuid,
            convUuid,
            sUuid,
            String(m.body || ''),
            ['text', 'image', 'video', 'audio', 'file', 'system'].includes(m.type) ? m.type : 'text',
            String(m.id),
            m.createdAt || null
          ]
        );
        importedCount++;
      }
      importedCount++;
    }

    for (const n of notifications) {
      await stageRecord(client, batchId, 'commerce_db.notifications', String(n.id), n);
      const nUuid = deterministicUuid(`notif:${n.id}`);
      const uUuid = await ensureUser(client, String(n.userId || 'system'), String(n.userId || 'Utilisateur'));
      await client.query(
        `INSERT INTO djassa_notifications(id, user_id, type, title, body, read_at, created_at)
         VALUES($1::uuid, $2::uuid, $3, $4, $5, CASE WHEN $6 THEN now() ELSE NULL END, COALESCE($7::timestamptz, now()))
         ON CONFLICT (id) DO NOTHING`,
        [nUuid, uUuid, String(n.type || 'info'), String(n.title || 'Notification'), n.body || '', Boolean(n.read), n.createdAt || null]
      );
      importedCount++;
    }

    // 9. Client State Profiles & AI Credits
    for (const [uid, prof] of Object.entries(clientProfiles)) {
      await stageRecord(client, batchId, 'client_state.profiles', uid, prof);
      await ensureUser(client, uid, String(prof?.username || uid));
      await client.query(
        `INSERT INTO djassa_user_profiles(user_id, role, commune, quartier, metadata, updated_at)
         VALUES($1, 'client', $2, $3, $4::jsonb, COALESCE($5::timestamptz, now()))
         ON CONFLICT (user_id) DO UPDATE SET commune = EXCLUDED.commune, quartier = EXCLUDED.quartier, metadata = EXCLUDED.metadata, updated_at = now()`,
        [uid, prof?.commune || null, prof?.quartier || null, JSON.stringify(prof || {}), prof?.updatedAt || null]
      );
      importedCount++;
    }

    for (const [uid, acc] of Object.entries(aiAccountsObj)) {
      await stageRecord(client, batchId, 'credits_billing.accounts', uid, acc);
      await client.query(
        `INSERT INTO djassa_ai_credit_accounts(user_id, balance_credits, last_daily_bonus_at, updated_at)
         VALUES($1, $2, $3::timestamptz, COALESCE($4::timestamptz, now()))
         ON CONFLICT (user_id) DO UPDATE SET
           balance_credits = EXCLUDED.balance_credits,
           last_daily_bonus_at = EXCLUDED.last_daily_bonus_at,
           updated_at = now()`,
        [uid, Math.max(0, Math.floor(Number(acc?.balance || 0))), acc?.lastBonusAt || null, acc?.updatedAt || null]
      );
      importedCount++;
    }

    for (const r of aiRecharges) {
      await stageRecord(client, batchId, 'credits_billing.recharges', String(r.id), r);
      await client.query(
        `INSERT INTO djassa_ai_credit_recharges(
           id, user_id, amount_fcfa, credits, payment_method, phone_number, payment_fee_fcfa, net_revenue_fcfa, status, provider_reference, created_at
         )
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11::timestamptz,now()))
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
        [
          String(r.id),
          String(r.userId),
          Math.max(1, Math.round(Number(r.amountFcfa || 1))),
          Math.max(1, Math.floor(Number(r.credits || 1))),
          String(r.paymentMethod || 'wave'),
          r.phoneNumber || null,
          Math.max(0, Math.round(Number(r.paymentFeeFcfa || 0))),
          Math.round(Number(r.netRevenueFcfa || r.amountFcfa || 0)),
          ['pending', 'confirmed', 'rejected', 'failed'].includes(r.status) ? r.status : 'pending',
          r.providerReference || null,
          r.createdAt || null
        ]
      );
      importedCount++;
    }

    // 10. Admin Control Plane (settings, campaigns, encrypted providers)
    for (const [k, s] of Object.entries(settingsObj)) {
      await stageRecord(client, batchId, 'admin_control_plane.settings', k, s);
      await client.query(
        `INSERT INTO djassa_admin_settings(setting_key, setting_value, value_version, updated_at)
         VALUES($1, $2::jsonb, $3, COALESCE($4::timestamptz, now()))
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, value_version = EXCLUDED.value_version, updated_at = now()`,
        [k, JSON.stringify(s?.value ?? null), Math.max(1, Number(s?.version || 1)), s?.updatedAt || null]
      );
      importedCount++;
    }

    for (const cmp of campaigns) {
      await stageRecord(client, batchId, 'admin_control_plane.campaigns', String(cmp.id), cmp);
      const cmpUuid = deterministicUuid(`campaign:${cmp.id}`);
      await client.query(
        `INSERT INTO djassa_admin_campaigns(
           id, campaign_type, name, status, starts_at, ends_at, budget_fcfa, spent_fcfa, discount_type, discount_value, max_discount_fcfa, promo_code, creative
         )
         VALUES($1::uuid,$2,$3,$4,$5::timestamptz,$6::timestamptz,$7,$8,$9,$10,$11,$12,$13::jsonb)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
        [
          cmpUuid,
          cmp.campaignType === 'advertising' ? 'advertising' : 'promotion',
          String(cmp.name || 'Campagne'),
          ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'].includes(cmp.status) ? cmp.status : 'active',
          cmp.startsAt || null,
          cmp.endsAt || null,
          cmp.budgetFcfa ?? null,
          Math.max(0, Number(cmp.spentFcfa || 0)),
          cmp.discountType || null,
          cmp.discountValue ?? null,
          cmp.maxDiscountFcfa ?? null,
          cmp.promoCode || null,
          JSON.stringify({ description: cmp.description || '', minSubtotalFcfa: cmp.minSubtotalFcfa || 0 })
        ]
      );
      importedCount++;
    }

    for (const p of providers) {
      await stageRecord(client, batchId, 'admin_control_plane.providers', String(p.providerKey), { ...p, secretCiphertext: '[ENCRYPTED]' });
      await client.query(
        `INSERT INTO djassa_admin_api_providers(
           provider_key, display_name, service_type, status, secret_ciphertext, secret_key_version, public_config, monthly_limit_fcfa, alert_threshold_percent
         )
         VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
         ON CONFLICT (provider_key) DO UPDATE SET status = EXCLUDED.status, public_config = EXCLUDED.public_config, updated_at = now()`,
        [
          String(p.providerKey),
          String(p.displayName || p.providerKey),
          ['payments', 'ai_text', 'ai_image', 'ai_video', 'maps', 'storage', 'messaging', 'analytics', 'other'].includes(p.serviceType)
            ? p.serviceType
            : 'other',
          ['disabled', 'sandbox', 'active', 'degraded'].includes(p.status) ? p.status : 'disabled',
          p.secretCiphertext || null,
          p.secretKeyVersion || null,
          JSON.stringify(p.publicConfig || {}),
          p.monthlyLimitFcfa ?? null,
          p.alertThresholdPercent ?? 80
        ]
      );
      importedCount++;
    }

    // Reconcile PG counts against source counts inside the transaction
    const reconQuery = await client.query<{
      pg_products: string;
      pg_orders: string;
      pg_payments: string;
      pg_orders_total: string;
      pg_ai_credits: string;
    }>(
      `SELECT
         (SELECT count(*) FROM djassa_products)::text AS pg_products,
         (SELECT count(*) FROM djassa_orders)::text AS pg_orders,
         (SELECT count(*) FROM djassa_payments)::text AS pg_payments,
         (SELECT COALESCE(sum(total_fcfa), 0) FROM djassa_orders)::text AS pg_orders_total,
         (SELECT COALESCE(sum(balance_credits), 0) FROM djassa_ai_credit_accounts)::text AS pg_ai_credits`
    );
    const pgTotals = reconQuery.rows[0];
    const reconciliationReport = {
      sourceCounts: summary.counts,
      sourceTotals: {
        ordersTotalFcfa: summary.totals.ordersTotalFcfa,
        aiCreditsBalance: summary.totals.aiCreditsBalance
      },
      pgCounts: {
        products: Number(pgTotals.pg_products),
        orders: Number(pgTotals.pg_orders),
        payments: Number(pgTotals.pg_payments)
      },
      pgTotals: {
        ordersTotalFcfa: Number(pgTotals.pg_orders_total),
        aiCreditsBalance: Number(pgTotals.pg_ai_credits)
      }
    };

    const mismatch =
      reconciliationReport.pgCounts.products < summary.counts.products ||
      reconciliationReport.pgCounts.orders < summary.counts.orders ||
      reconciliationReport.pgCounts.payments < summary.counts.payments ||
      reconciliationReport.pgTotals.ordersTotalFcfa < summary.totals.ordersTotalFcfa ||
      reconciliationReport.pgTotals.aiCreditsBalance < summary.totals.aiCreditsBalance;

    if (mismatch) {
      await client.query('ROLLBACK');
      console.error('Écart de réconciliation PostgreSQL détecté; rollback effectué :', JSON.stringify(reconciliationReport));
      process.exitCode = 2;
      return;
    }

    if (APPLY) {
      await client.query(
        `UPDATE djassa_legacy_import_batches
            SET status = 'committed',
                imported_record_count = $2,
                reconciliation = $3::jsonb,
                completed_at = now()
          WHERE id = $1::uuid`,
        [batchId, importedCount, JSON.stringify(reconciliationReport)]
      );
      await client.query(
        `INSERT INTO djassa_audit_events(action, resource_type, resource_id, result, metadata)
         VALUES('legacy_domain_import', 'domain_json_stores', $1, 'success', $2::jsonb)`,
        [combinedSha, JSON.stringify(reconciliationReport)]
      );
      await client.query('COMMIT');
      console.log('✅ Import transactionnel domaine vers PostgreSQL validé et commité :', JSON.stringify(reconciliationReport));
    } else {
      await client.query('ROLLBACK');
      console.log('ℹ️  Mode PREVIEW : réconciliation PostgreSQL OK, ROLLBACK exécuté sans écriture définitive.', JSON.stringify(reconciliationReport));
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Import domaine refusé :', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
