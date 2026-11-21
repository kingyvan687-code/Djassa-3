import crypto from 'node:crypto';
import { databaseHealth, query, withTransaction } from '../database';

export function deterministicDomainUuid(seed: string): string {
  const hex = crypto.createHash('sha256').update(`djassa-uuid:${seed}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function isPgReady(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  const health = await databaseHealth();
  return health.connected;
}

export async function upsertPgStoreAndProduct(product: {
  id: string;
  sellerId: string;
  sellerName: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  stock: number;
  category: string;
  images: string[];
  variants?: Array<{ type: string; options: string[] }>;
  status: string;
  mediaBytes?: number;
}): Promise<void> {
  if (!(await isPgReady())) return;
  const sellerUserUuid = deterministicDomainUuid(`user:${product.sellerId}`);
  const storeUuid = deterministicDomainUuid(`store:${product.sellerId}`);
  const prodUuid = deterministicDomainUuid(`product:${product.id}`);

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO djassa_users(id, email, display_name, status)
       VALUES($1::uuid, $2, $3, 'active')
       ON CONFLICT (id) DO NOTHING`,
      [sellerUserUuid, `${product.sellerId}@djassa.internal`, product.sellerName || 'Vendeur DJASSA']
    );
    await client.query(
      `INSERT INTO djassa_stores(id, owner_user_id, name, status, city, metadata)
       VALUES($1::uuid, $2::uuid, $3, 'active', 'Abidjan', $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()`,
      [storeUuid, sellerUserUuid, product.sellerName || 'Boutique DJASSA', JSON.stringify({ legacySellerId: product.sellerId })]
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
        product.name,
        product.description || '',
        Math.round(product.price),
        product.originalPrice ? Math.round(product.originalPrice) : null,
        Math.max(0, Math.floor(product.stock)),
        ['draft', 'published', 'paused', 'archived'].includes(product.status) ? product.status : 'published',
        product.category || 'Mode',
        JSON.stringify(product.variants || []),
        JSON.stringify(product.images || []),
        JSON.stringify({ legacyProductId: product.id, mediaBytes: product.mediaBytes || 0 })
      ]
    );

    await client.query(`DELETE FROM djassa_product_media WHERE product_id = $1::uuid`, [prodUuid]);
    for (let i = 0; i < (product.images || []).length; i++) {
      await client.query(
        `INSERT INTO djassa_product_media(product_id, media_type, media_url, position)
         VALUES($1::uuid, 'image', $2, $3)`,
        [prodUuid, product.images[i], i]
      );
    }
  });
}

export async function archivePgProduct(productId: string): Promise<void> {
  if (!(await isPgReady())) return;
  const prodUuid = deterministicDomainUuid(`product:${productId}`);
  await query(
    `UPDATE djassa_products SET status = 'archived', updated_at = now() WHERE id = $1::uuid`,
    [prodUuid]
  );
}

export async function reservePgInventoryForOrder(input: {
  orderId: string;
  orderNumber: string;
  clientId: string;
  sellerId: string;
  sellerName: string;
  subtotal: number;
  discount: number;
  promoCode?: string;
  serviceFee: number;
  clientFeeFcfa?: number;
  commissionFcfa?: number;
  commissionStatus?: string;
  sellerNetFcfa?: number;
  sellerPayoutStatus?: string;
  paymentMode?: 'online' | 'cod';
  paymentStatus?: string;
  initialStatus?: string;
  deliveryFee: number;
  total: number;
  deliveryMode: string;
  deliveryAddress: Record<string, unknown>;
  paymentId?: string;
  paymentMethod?: string;
  payerPhoneMasked?: string;
  providerReference?: string;
  checkoutGroupId?: string;
  idempotencyKey?: string;
  expiresAtIso: string;
  items: Array<{
    productId: string;
    productTitle: string;
    productImage: string;
    price: number;
    quantity: number;
    variant: Record<string, string>;
  }>;
}): Promise<void> {
  if (!(await isPgReady())) return;
  const orderUuid = deterministicDomainUuid(`order:${input.orderId}`);
  const clientUuid = deterministicDomainUuid(`user:${input.clientId}`);
  const sellerUserUuid = deterministicDomainUuid(`user:${input.sellerId}`);
  const storeUuid = deterministicDomainUuid(`store:${input.sellerId}`);
  const paymentMode = input.paymentMode === 'cod' ? 'cod' : 'online';
  const pgOrderStatus = input.initialStatus === 'passed' ? 'paid' : 'pending_payment';
  const pgPaymentStatus = input.paymentStatus || (paymentMode === 'cod' ? 'cod_pending' : 'pending');
  const clientFeeFcfa = Math.max(0, Math.round(input.clientFeeFcfa ?? input.serviceFee ?? 0));
  const commissionFcfa = Math.max(0, Math.round(input.commissionFcfa ?? 150));
  const commissionStatus = input.commissionStatus || 'pending';
  const sellerNetFcfa = Math.max(0, Math.round(input.sellerNetFcfa ?? Math.max(0, input.subtotal - input.discount - commissionFcfa)));
  const sellerPayoutStatus = input.sellerPayoutStatus || (paymentMode === 'cod' ? 'not_applicable' : 'pending_payment');

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO djassa_users(id, email, display_name, status) VALUES($1::uuid, $2, $3, 'active') ON CONFLICT (id) DO NOTHING`,
      [clientUuid, `${input.clientId}@djassa.internal`, 'Client DJASSA']
    );
    await client.query(
      `INSERT INTO djassa_users(id, email, display_name, status) VALUES($1::uuid, $2, $3, 'active') ON CONFLICT (id) DO NOTHING`,
      [sellerUserUuid, `${input.sellerId}@djassa.internal`, input.sellerName || 'Vendeur DJASSA']
    );
    await client.query(
      `INSERT INTO djassa_stores(id, owner_user_id, name, status) VALUES($1::uuid, $2::uuid, $3, 'active') ON CONFLICT (id) DO NOTHING`,
      [storeUuid, sellerUserUuid, input.sellerName || 'Boutique DJASSA']
    );

    await client.query(
      `INSERT INTO djassa_orders(
         id, order_number, client_user_id, status, payment_status, currency,
         subtotal_fcfa, delivery_fee_fcfa, discount_fcfa, service_fee_fcfa, total_fcfa,
         delivery_address, delivery_mode, promo_code, idempotency_key,
         payment_mode, client_fee_fcfa, commission_fcfa, commission_status, seller_net_fcfa, seller_payout_status,
         metadata
       )
       VALUES($1::uuid,$2,$3::uuid,$4,$5,'XOF',$6,0,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb)
       ON CONFLICT (order_number) DO NOTHING`,
      [
        orderUuid,
        input.orderNumber,
        clientUuid,
        pgOrderStatus,
        pgPaymentStatus,
        input.subtotal,
        input.discount,
        clientFeeFcfa,
        input.total,
        JSON.stringify(input.deliveryAddress),
        'seller_managed',
        input.promoCode || null,
        input.idempotencyKey || null,
        paymentMode,
        clientFeeFcfa,
        commissionFcfa,
        commissionStatus,
        sellerNetFcfa,
        sellerPayoutStatus,
        JSON.stringify({
          legacyOrderId: input.orderId,
          ...(input.checkoutGroupId ? { checkoutGroupId: input.checkoutGroupId } : {})
        })
      ]
    );

    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      const itemUuid = deterministicDomainUuid(`order_item:${input.orderId}:${i}`);
      const prodUuid = deterministicDomainUuid(`product:${item.productId}`);

      await client.query(
        `INSERT INTO djassa_products(id, store_id, title, price_fcfa, stock_quantity, status)
         VALUES($1::uuid, $2::uuid, $3, $4, $5, 'published')
         ON CONFLICT (id) DO NOTHING`,
        [prodUuid, storeUuid, item.productTitle, item.price, item.quantity]
      );

      // Row-level lock on product stock before reserving
      const locked = await client.query<{ stock_quantity: number }>(
        `SELECT stock_quantity FROM djassa_products WHERE id = $1::uuid FOR UPDATE`,
        [prodUuid]
      );
      if (locked.rows[0] && locked.rows[0].stock_quantity >= item.quantity) {
        const nextStock = locked.rows[0].stock_quantity - item.quantity;
        await client.query(
          `UPDATE djassa_products SET stock_quantity = $2, updated_at = now() WHERE id = $1::uuid`,
          [prodUuid, nextStock]
        );
        await client.query(
          `INSERT INTO djassa_inventory_movements(product_id, store_id, order_id, movement_key, movement_type, quantity_delta, quantity_after, reason)
           VALUES($1::uuid,$2::uuid,$3::uuid,$4,'reservation',$5,$6,'Réservation commande client')
           ON CONFLICT (movement_key) DO NOTHING`,
          [prodUuid, storeUuid, orderUuid, `reserve:${input.orderId}:${i}`, -item.quantity, nextStock]
        );
      }

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
          item.productTitle,
          item.price,
          item.quantity,
          item.price * item.quantity,
          JSON.stringify(item.variant || {}),
          item.productImage || null,
          input.sellerName
        ]
      );

      await client.query(
        `INSERT INTO djassa_inventory_reservations(order_id, order_item_id, product_id, variant_key, quantity, status, expires_at)
         VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::timestamptz)
         ON CONFLICT (order_item_id) DO NOTHING`,
        [
          orderUuid,
          itemUuid,
          prodUuid,
          JSON.stringify(item.variant || {}),
          item.quantity,
          pgOrderStatus === 'paid' ? 'consumed' : 'reserved',
          input.expiresAtIso
        ]
      );
    }

    if (input.paymentId) {
      const paymentUuid = deterministicDomainUuid(`payment:${input.paymentId}`);
      await client.query(
        `INSERT INTO djassa_payments(
           id, order_id, provider, provider_reference, idempotency_key, amount_fcfa, status,
           payment_method, payer_phone_masked, provider_status
         )
         VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          paymentUuid,
          orderUuid,
          input.paymentMethod || 'wave',
          input.providerReference || input.paymentId,
          input.paymentId,
          input.total,
          paymentMode === 'cod' ? 'pending' : 'pending',
          input.paymentMethod || 'wave',
          input.payerPhoneMasked || null,
          input.providerReference ? 'pending' : null
        ]
      );
    }

    await client.query(
      `INSERT INTO djassa_order_status_events(order_id, from_status, to_status, note)
       VALUES($1::uuid, NULL, $2, 'Commande créée et stock réservé')`,
      [orderUuid, pgOrderStatus]
    );
  });
}

export async function recordPgOrderStatusTransition(input: {
  orderId: string;
  fromStatus: string | null;
  toStatus: string;
  paymentStatus?: string;
  commissionStatus?: string;
  sellerPayoutStatus?: string;
  sellerPayoutReference?: string | null;
  sellerPayoutChannel?: string | null;
  sellerPayoutPhone?: string | null;
  providerFeeFcfa?: number | null;
  note?: string;
}): Promise<void> {
  if (!(await isPgReady())) return;
  const orderUuid = deterministicDomainUuid(`order:${input.orderId}`);
  const pgOrderStatus = input.toStatus === 'passed' ? 'paid' : input.toStatus;

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE djassa_orders
          SET status = $2,
              payment_status = COALESCE($3, payment_status),
              commission_status = COALESCE($4, commission_status),
              seller_payout_status = COALESCE($5, seller_payout_status),
              seller_payout_reference = COALESCE($6, seller_payout_reference),
              seller_payout_channel = COALESCE($7, seller_payout_channel),
              seller_payout_phone = COALESCE($8, seller_payout_phone),
              provider_fee_fcfa = COALESCE($9, provider_fee_fcfa),
              updated_at = now()
        WHERE id = $1::uuid`,
      [
        orderUuid,
        pgOrderStatus,
        input.paymentStatus === 'paid' ? 'confirmed' : input.paymentStatus || null,
        input.commissionStatus || null,
        input.sellerPayoutStatus || null,
        input.sellerPayoutReference || null,
        input.sellerPayoutChannel || null,
        input.sellerPayoutPhone || null,
        input.providerFeeFcfa !== undefined ? input.providerFeeFcfa : null
      ]
    );

    if (pgOrderStatus === 'paid') {
      await client.query(
        `UPDATE djassa_inventory_reservations SET status = 'consumed', resolved_at = now()
          WHERE order_id = $1::uuid AND status = 'reserved'`,
        [orderUuid]
      );
    } else if (pgOrderStatus === 'cancelled') {
      const reserved = await client.query<{ id: string; product_id: string; quantity: number }>(
        `UPDATE djassa_inventory_reservations SET status = 'released', resolved_at = now()
          WHERE order_id = $1::uuid AND status = 'reserved'
          RETURNING id::text, product_id::text, quantity`,
        [orderUuid]
      );
      for (const r of reserved.rows) {
        const upd = await client.query<{ store_id: string; stock_quantity: number }>(
          `UPDATE djassa_products SET stock_quantity = stock_quantity + $2, updated_at = now()
            WHERE id = $1::uuid RETURNING store_id::text, stock_quantity`,
          [r.product_id, r.quantity]
        );
        if (upd.rows[0]) {
          await client.query(
            `INSERT INTO djassa_inventory_movements(product_id, store_id, order_id, movement_key, movement_type, quantity_delta, quantity_after, reason)
             VALUES($1::uuid,$2::uuid,$3::uuid,$4,'release',$5,$6,'Annulation / libération réservation')
             ON CONFLICT (movement_key) DO NOTHING`,
            [r.product_id, upd.rows[0].store_id, orderUuid, `release:${r.id}`, r.quantity, upd.rows[0].stock_quantity]
          );
        }
      }
    }

    await client.query(
      `INSERT INTO djassa_order_status_events(order_id, from_status, to_status, note)
       VALUES($1::uuid, $2, $3, $4)`,
      [orderUuid, input.fromStatus, pgOrderStatus, input.note || null]
    );
  });
}

export async function expirePgStaleReservations(): Promise<number> {
  if (!(await isPgReady())) return 0;
  return withTransaction(async (client) => {
    const expired = await client.query<{ id: string; order_id: string; product_id: string; quantity: number }>(
      `UPDATE djassa_inventory_reservations
          SET status = 'expired', resolved_at = now()
        WHERE status = 'reserved' AND expires_at <= now()
        RETURNING id::text, order_id::text, product_id::text, quantity`
    );
    for (const row of expired.rows) {
      const upd = await client.query<{ store_id: string; stock_quantity: number }>(
        `UPDATE djassa_products SET stock_quantity = stock_quantity + $2, updated_at = now()
          WHERE id = $1::uuid RETURNING store_id::text, stock_quantity`,
        [row.product_id, row.quantity]
      );
      if (upd.rows[0]) {
        await client.query(
          `INSERT INTO djassa_inventory_movements(product_id, store_id, order_id, movement_key, movement_type, quantity_delta, quantity_after, reason)
           VALUES($1::uuid,$2::uuid,$3::uuid,$4,'release',$5,$6,'Expiration réservation 15 minutes')
           ON CONFLICT (movement_key) DO NOTHING`,
          [row.product_id, upd.rows[0].store_id, row.order_id, `expire:${row.id}`, row.quantity, upd.rows[0].stock_quantity]
        );
      }
      await client.query(
        `UPDATE djassa_orders SET status = 'cancelled', payment_status = 'failed', updated_at = now()
          WHERE id = $1::uuid AND status = 'pending_payment'`,
        [row.order_id]
      );
    }
    return expired.rows.length;
  });
}

export async function getPgCommerceSummary() {
  if (!(await isPgReady())) return null;
  const rows = await query<{ products: string; orders: string }>(
    `SELECT (SELECT count(*) FROM djassa_products)::text AS products,
            (SELECT count(*) FROM djassa_orders)::text AS orders`
  );
  return rows[0] || null;
}
