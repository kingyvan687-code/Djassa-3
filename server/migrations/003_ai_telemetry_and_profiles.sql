-- DJASSA profiles metadata, API provider telemetry & quotas, AI credit recharges & delivery incidents
-- Apply with: npm run db:migrate

CREATE TABLE IF NOT EXISTS djassa_user_profiles (
  user_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('client','seller','driver','company','admin')),
  account_plan TEXT NOT NULL DEFAULT 'gratuit',
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','verified','rejected','suspended')),
  commune TEXT,
  quartier TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS djassa_ai_credit_recharges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa > 0),
  credits INTEGER NOT NULL CHECK (credits > 0),
  payment_method TEXT NOT NULL,
  phone_number TEXT,
  payment_fee_fcfa BIGINT NOT NULL DEFAULT 0 CHECK (payment_fee_fcfa >= 0),
  net_revenue_fcfa BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected','failed')),
  provider_reference TEXT UNIQUE,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_ai_recharges_user_status ON djassa_ai_credit_recharges(user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS djassa_api_provider_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id TEXT NOT NULL,
  service_type TEXT NOT NULL,
  app_space TEXT NOT NULL CHECK (app_space IN ('client','seller','driver','company','admin')),
  user_id TEXT,
  units_consumed INTEGER NOT NULL DEFAULT 1 CHECK (units_consumed >= 0),
  cost_fcfa NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost_fcfa >= 0),
  revenue_fcfa NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (revenue_fcfa >= 0),
  status TEXT NOT NULL CHECK (status IN ('success','failed','refunded')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_api_telemetry_provider_date ON djassa_api_telemetry(provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS djassa_delivery_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  company_id TEXT,
  driver_id TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'high' CHECK (urgency IN ('low','medium','high','critical')),
  location_label TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reassigned','resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_djassa_delivery_incidents_order ON djassa_delivery_incidents(order_id, status);
