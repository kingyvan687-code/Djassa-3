-- DJASSA commerce, breakdown reassignments, withdrawals & AI credits persistence
-- Apply with: npm run db:migrate

CREATE TABLE IF NOT EXISTS djassa_platform_config (
  config_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS djassa_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  account_role TEXT NOT NULL CHECK (account_role IN ('seller','driver','company')),
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa > 0),
  fee_fcfa BIGINT NOT NULL DEFAULT 0 CHECK (fee_fcfa >= 0),
  net_amount_fcfa BIGINT NOT NULL CHECK (net_amount_fcfa >= 0),
  channel TEXT NOT NULL,
  payout_target_masked TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','held_security','rejected','failed')),
  suspicion_reasons JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_djassa_withdrawals_account ON djassa_withdrawals(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS djassa_breakdown_reassignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  broken_driver_id TEXT NOT NULL,
  new_driver_id TEXT,
  reason TEXT NOT NULL,
  location_label TEXT,
  pickup_proof JSONB,
  handover_status TEXT NOT NULL DEFAULT 'awaiting_reassignment'
    CHECK (handover_status IN ('awaiting_reassignment','assigned_pending_handover','handover_confirmed','delivered')),
  handover_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_reassignments_order ON djassa_breakdown_reassignments(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS djassa_ai_credit_accounts (
  user_id TEXT PRIMARY KEY,
  balance_credits INTEGER NOT NULL DEFAULT 0 CHECK (balance_credits >= 0),
  last_daily_bonus_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS djassa_ai_credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('recharge','deduct','refund','bonus')),
  credits_delta INTEGER NOT NULL,
  amount_fcfa BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_ai_tx_user ON djassa_ai_credit_transactions(user_id, created_at DESC);
