-- DJASSA Lot 3K: durable payment, commission and payout foundation.
-- Additive only. Does not call PawaPay, confirm payments, or switch live JSON flows.

ALTER TABLE djassa_payments
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'XOF',
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payer_phone_masked TEXT,
  ADD COLUMN IF NOT EXISTS provider_status TEXT,
  ADD COLUMN IF NOT EXISTS provider_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS failure_message TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'djassa_payments_currency_xof'
  ) THEN
    ALTER TABLE djassa_payments
      ADD CONSTRAINT djassa_payments_currency_xof
      CHECK (currency = 'XOF') NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_djassa_payments_order_created
  ON djassa_payments(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_djassa_payments_status_created
  ON djassa_payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_djassa_payments_provider_ref
  ON djassa_payments(provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

-- Provider callbacks are stored once by provider event/deposit reference.
-- Store only redacted/minimized payloads; never persist API secrets or PINs.
CREATE TABLE IF NOT EXISTS djassa_payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_key TEXT NOT NULL,
  provider_reference TEXT,
  event_type TEXT NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received','processing','processed','ignored','failed')),
  payload_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE(provider, provider_event_key)
);
CREATE INDEX IF NOT EXISTS idx_djassa_payment_webhooks_pending
  ON djassa_payment_webhook_events(received_at)
  WHERE processing_status IN ('received','failed');
CREATE INDEX IF NOT EXISTS idx_djassa_payment_webhooks_reference
  ON djassa_payment_webhook_events(provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS djassa_payment_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES djassa_payments(id) ON DELETE CASCADE,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('api','webhook','reconciliation','admin')),
  provider_status TEXT,
  actor_user_id UUID REFERENCES djassa_users(id) ON DELETE SET NULL,
  event_key TEXT NOT NULL UNIQUE,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_payment_status_events_payment
  ON djassa_payment_status_events(payment_id, created_at DESC);

-- One immutable financial commission record per beneficiary and business event.
CREATE TABLE IF NOT EXISTS djassa_commission_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES djassa_orders(id),
  beneficiary_user_id UUID REFERENCES djassa_users(id) ON DELETE SET NULL,
  beneficiary_role TEXT NOT NULL CHECK (beneficiary_role IN ('seller','driver','company','platform')),
  commission_type TEXT NOT NULL,
  basis_amount_fcfa BIGINT NOT NULL CHECK (basis_amount_fcfa >= 0),
  rate_basis_points INTEGER CHECK (rate_basis_points IS NULL OR rate_basis_points BETWEEN 0 AND 10000),
  fixed_amount_fcfa BIGINT CHECK (fixed_amount_fcfa IS NULL OR fixed_amount_fcfa >= 0),
  commission_amount_fcfa BIGINT NOT NULL CHECK (commission_amount_fcfa >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accrued','reversed','cancelled')),
  ledger_transaction_key TEXT UNIQUE,
  calculation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accrued_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_djassa_commissions_order
  ON djassa_commission_entries(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_djassa_commissions_beneficiary
  ON djassa_commission_entries(beneficiary_user_id, status, created_at DESC);

-- Payout requests are distinct from wallet debits: funds must be held atomically
-- before a provider payout is sent, then finalized/released from verified result.
CREATE TABLE IF NOT EXISTS djassa_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES djassa_wallets(id),
  owner_user_id UUID NOT NULL REFERENCES djassa_users(id),
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa > 0),
  fee_fcfa BIGINT NOT NULL DEFAULT 0 CHECK (fee_fcfa >= 0),
  net_amount_fcfa BIGINT NOT NULL CHECK (net_amount_fcfa >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'XOF' CHECK (currency = 'XOF'),
  payout_provider TEXT NOT NULL,
  payout_method TEXT NOT NULL,
  destination_masked TEXT NOT NULL,
  destination_ciphertext TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','held','processing','completed','rejected','failed','cancelled')),
  hold_ledger_key TEXT UNIQUE,
  settlement_ledger_key TEXT UNIQUE,
  failure_code TEXT,
  failure_message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_djassa_payout_owner_date
  ON djassa_payout_requests(owner_user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_djassa_payout_status_date
  ON djassa_payout_requests(status, requested_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_djassa_payout_provider_reference
  ON djassa_payout_requests(payout_provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS djassa_payout_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_request_id UUID NOT NULL REFERENCES djassa_payout_requests(id) ON DELETE CASCADE,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('api','provider_webhook','reconciliation','admin')),
  event_key TEXT NOT NULL UNIQUE,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_payout_events_request
  ON djassa_payout_status_events(payout_request_id, created_at DESC);

-- Ledger references allow deterministic reconciliation without trusting cached balances.
ALTER TABLE djassa_wallet_ledger
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS source_system TEXT NOT NULL DEFAULT 'djassa',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS uq_djassa_wallet_ledger_idempotency
  ON djassa_wallet_ledger(idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';

CREATE TABLE IF NOT EXISTS djassa_financial_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('payments','wallets','commissions','payouts','all')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','matched','mismatch','failed')),
  source_totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  ledger_totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  mismatch_count INTEGER NOT NULL DEFAULT 0 CHECK (mismatch_count >= 0),
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_djassa_financial_reconciliation_date
  ON djassa_financial_reconciliation_runs(started_at DESC);
