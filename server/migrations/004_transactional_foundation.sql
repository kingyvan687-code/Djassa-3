-- DJASSA Lot 3C: durable primitives for transactional commerce and safe cutover.
-- This migration intentionally does not import JSON files or switch live reads/writes.
-- The cutover must be performed module-by-module after reconciliation and tests.

CREATE TABLE IF NOT EXISTS djassa_stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES djassa_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES djassa_products(id),
  variant_key TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved','committed','released','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  committed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, product_id, variant_key)
);
CREATE INDEX IF NOT EXISTS idx_djassa_stock_reservations_expiry
  ON djassa_stock_reservations(expires_at) WHERE status = 'reserved';
CREATE INDEX IF NOT EXISTS idx_djassa_stock_reservations_product
  ON djassa_stock_reservations(product_id, status);

CREATE TABLE IF NOT EXISTS djassa_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES djassa_products(id),
  order_id UUID REFERENCES djassa_orders(id) ON DELETE SET NULL,
  movement_key TEXT NOT NULL UNIQUE,
  movement_type TEXT NOT NULL
    CHECK (movement_type IN ('reserve','commit','release','restock','adjustment')),
  quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
  variant_key TEXT NOT NULL DEFAULT '',
  actor_user_id UUID REFERENCES djassa_users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_stock_movements_product_date
  ON djassa_stock_movements(product_id, created_at DESC);

-- Transactional outbox: write business state and its event in the same DB transaction.
-- Consumers must claim rows with FOR UPDATE SKIP LOCKED and use event_key idempotently.
CREATE TABLE IF NOT EXISTS djassa_outbox_events (
  id BIGSERIAL PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','published','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_outbox_pending
  ON djassa_outbox_events(available_at, id) WHERE status IN ('pending','failed');

-- Records controlled imports from legacy JSON stores. A batch is not marked
-- complete until counts and financial/stock totals have been reconciled.
CREATE TABLE IF NOT EXISTS djassa_legacy_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','running','validated','committed','rejected')),
  source_record_count BIGINT NOT NULL DEFAULT 0 CHECK (source_record_count >= 0),
  imported_record_count BIGINT NOT NULL DEFAULT 0 CHECK (imported_record_count >= 0),
  rejected_record_count BIGINT NOT NULL DEFAULT 0 CHECK (rejected_record_count >= 0),
  reconciliation JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_name, source_sha256)
);

-- A credit account has one balance row; transaction keys prevent duplicate grants/deductions.
CREATE INDEX IF NOT EXISTS idx_djassa_ai_credit_account_date
  ON djassa_ai_credit_transactions(user_id, created_at DESC);

-- Basic integrity checks for existing account tables.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_djassa_ai_credit_balance_nonnegative'
  ) THEN
    ALTER TABLE djassa_ai_credit_accounts
      ADD CONSTRAINT chk_djassa_ai_credit_balance_nonnegative
      CHECK (balance_credits >= 0) NOT VALID;
  END IF;
END $$;
