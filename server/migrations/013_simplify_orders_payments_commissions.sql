-- Simplified DJASSA Orders, Online/COD Payment Modes, 6.5% Client Fee, 150 FCFA Seller Commission & Payout Settings
-- Additive & preserves all historical orders, payments, ledger and commission records.

ALTER TABLE djassa_orders
  ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'online'
    CHECK (payment_mode IN ('online', 'cod')),
  ADD COLUMN IF NOT EXISTS client_fee_fcfa BIGINT NOT NULL DEFAULT 0
    CHECK (client_fee_fcfa >= 0),
  ADD COLUMN IF NOT EXISTS commission_fcfa BIGINT NOT NULL DEFAULT 150
    CHECK (commission_fcfa >= 0),
  ADD COLUMN IF NOT EXISTS commission_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (commission_status IN ('pending', 'collected', 'paid', 'cancelled')),
  ADD COLUMN IF NOT EXISTS seller_net_fcfa BIGINT NOT NULL DEFAULT 0
    CHECK (seller_net_fcfa >= 0),
  ADD COLUMN IF NOT EXISTS seller_payout_status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (seller_payout_status IN (
      'not_applicable',
      'pending_payment',
      'pending_config',
      'pending_seller_account',
      'initiated',
      'completed',
      'failed'
    )),
  ADD COLUMN IF NOT EXISTS seller_payout_reference TEXT,
  ADD COLUMN IF NOT EXISTS seller_payout_channel TEXT
    CHECK (seller_payout_channel IS NULL OR seller_payout_channel IN ('wave', 'orange_money')),
  ADD COLUMN IF NOT EXISTS seller_payout_phone TEXT,
  ADD COLUMN IF NOT EXISTS provider_fee_fcfa BIGINT;

CREATE INDEX IF NOT EXISTS idx_djassa_orders_payment_mode_status
  ON djassa_orders(payment_mode, payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_djassa_orders_commission_status
  ON djassa_orders(commission_status, created_at DESC);

CREATE TABLE IF NOT EXISTS djassa_seller_payout_accounts (
  seller_id TEXT PRIMARY KEY,
  seller_user_id UUID REFERENCES djassa_users(id) ON DELETE SET NULL,
  preferred_channel TEXT NOT NULL CHECK (preferred_channel IN ('wave', 'orange_money')),
  payout_phone TEXT NOT NULL,
  account_holder_name TEXT,
  geniuspay_recipient_id TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS djassa_commission_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES djassa_orders(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL,
  commission_fcfa BIGINT NOT NULL CHECK (commission_fcfa >= 0),
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('online', 'cod')),
  settlement_method TEXT NOT NULL CHECK (settlement_method IN ('online_split', 'wave', 'orange_money', 'admin_verified')),
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'collected' CHECK (status IN ('pending', 'collected', 'paid', 'cancelled')),
  recorded_by TEXT,
  notes TEXT,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, settlement_method)
);

CREATE INDEX IF NOT EXISTS idx_djassa_commission_settlements_seller
  ON djassa_commission_settlements(seller_id, settled_at DESC);
