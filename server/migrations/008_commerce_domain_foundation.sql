-- Lot 3J: additive commerce-domain foundation.
-- Safe to apply to an existing 001/002 schema. Does not switch API routes
-- from commerce_db.json; application cutover is a later, separately tested step.

ALTER TABLE djassa_stores
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE djassa_products
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS original_price_fcfa BIGINT,
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS media JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'djassa_products_original_price_nonnegative'
  ) THEN
    ALTER TABLE djassa_products
      ADD CONSTRAINT djassa_products_original_price_nonnegative
      CHECK (original_price_fcfa IS NULL OR original_price_fcfa >= 0) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_djassa_products_category_status
  ON djassa_products(category, status);
CREATE INDEX IF NOT EXISTS idx_djassa_products_updated
  ON djassa_products(updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_djassa_products_store_sku
  ON djassa_products(store_id, sku) WHERE sku IS NOT NULL AND sku <> '';

ALTER TABLE djassa_orders
  ADD COLUMN IF NOT EXISTS discount_fcfa BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee_fcfa BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT,
  ADD COLUMN IF NOT EXISTS promo_code TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'djassa_orders_discount_nonnegative'
  ) THEN
    ALTER TABLE djassa_orders
      ADD CONSTRAINT djassa_orders_discount_nonnegative CHECK (discount_fcfa >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'djassa_orders_service_fee_nonnegative'
  ) THEN
    ALTER TABLE djassa_orders
      ADD CONSTRAINT djassa_orders_service_fee_nonnegative CHECK (service_fee_fcfa >= 0) NOT VALID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_djassa_orders_idempotency
  ON djassa_orders(client_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';

ALTER TABLE djassa_order_items
  ADD COLUMN IF NOT EXISTS variant_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS product_image_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS seller_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS sku_snapshot TEXT;

CREATE TABLE IF NOT EXISTS djassa_product_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES djassa_products(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  media_url TEXT NOT NULL,
  poster_url TEXT,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  alt_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_product_media_product
  ON djassa_product_media(product_id, position, created_at);

CREATE TABLE IF NOT EXISTS djassa_inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES djassa_orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES djassa_order_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES djassa_products(id),
  variant_key TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved','consumed','released','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(order_item_id)
);
CREATE INDEX IF NOT EXISTS idx_djassa_inventory_reservations_expiry
  ON djassa_inventory_reservations(expires_at)
  WHERE status = 'reserved';
CREATE INDEX IF NOT EXISTS idx_djassa_inventory_reservations_product
  ON djassa_inventory_reservations(product_id, status);

CREATE TABLE IF NOT EXISTS djassa_inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES djassa_products(id),
  store_id UUID NOT NULL REFERENCES djassa_stores(id),
  order_id UUID REFERENCES djassa_orders(id),
  movement_key TEXT NOT NULL UNIQUE,
  movement_type TEXT NOT NULL CHECK (movement_type IN
    ('opening','restock','reservation','sale','release','return','adjustment')),
  quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
  quantity_after INTEGER CHECK (quantity_after IS NULL OR quantity_after >= 0),
  reason TEXT,
  actor_user_id UUID REFERENCES djassa_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_inventory_movements_product_date
  ON djassa_inventory_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_djassa_inventory_movements_order
  ON djassa_inventory_movements(order_id) WHERE order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS djassa_order_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES djassa_orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_user_id UUID REFERENCES djassa_users(id),
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_order_status_events_order
  ON djassa_order_status_events(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS djassa_commerce_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES djassa_users(id),
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_payload JSONB,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','completed','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(actor_user_id, operation, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_djassa_commerce_idempotency_created
  ON djassa_commerce_idempotency(created_at);
