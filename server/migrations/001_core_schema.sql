-- DJASSA central data model (PostgreSQL)
-- Apply with: npm run db:migrate
-- This migration creates the shared data foundation; it does not migrate
-- existing localStorage/demo records automatically.

CREATE TABLE IF NOT EXISTS djassa_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','suspended','closed')),
  email_verified_at TIMESTAMPTZ,
  phone_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_djassa_users_email_ci ON djassa_users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_djassa_users_phone ON djassa_users (phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS djassa_credentials (
  user_id UUID PRIMARY KEY REFERENCES djassa_users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TIMESTAMPTZ,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS djassa_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES djassa_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('client','seller','driver','company','admin')),
  tenant_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','suspended','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_djassa_memberships_tenant ON djassa_memberships(tenant_id, role, status);

CREATE TABLE IF NOT EXISTS djassa_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES djassa_users(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES djassa_memberships(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  device_label TEXT,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_sessions_user_active ON djassa_sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS djassa_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES djassa_users(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','closed')),
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS djassa_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES djassa_stores(id),
  title TEXT NOT NULL,
  description TEXT,
  price_fcfa BIGINT NOT NULL CHECK (price_fcfa >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','paused','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_products_store_status ON djassa_products(store_id, status);

CREATE TABLE IF NOT EXISTS djassa_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  client_user_id UUID NOT NULL REFERENCES djassa_users(id),
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment','paid','preparing','ready_for_pickup','assigned','in_transit','delivered','cancelled','refunded','disputed')),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','processing','confirmed','failed','cancelled','partially_refunded','refunded')),
  currency CHAR(3) NOT NULL DEFAULT 'XOF' CHECK (currency = 'XOF'),
  subtotal_fcfa BIGINT NOT NULL CHECK (subtotal_fcfa >= 0),
  delivery_fee_fcfa BIGINT NOT NULL DEFAULT 0 CHECK (delivery_fee_fcfa >= 0),
  total_fcfa BIGINT NOT NULL CHECK (total_fcfa >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_orders_client_date ON djassa_orders(client_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS djassa_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES djassa_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES djassa_products(id),
  store_id UUID NOT NULL REFERENCES djassa_stores(id),
  product_title_snapshot TEXT NOT NULL,
  unit_price_fcfa BIGINT NOT NULL CHECK (unit_price_fcfa >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_fcfa BIGINT NOT NULL CHECK (line_total_fcfa >= 0)
);
CREATE INDEX IF NOT EXISTS idx_djassa_order_items_order ON djassa_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_djassa_order_items_store ON djassa_order_items(store_id);

CREATE TABLE IF NOT EXISTS djassa_delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES djassa_orders(id),
  company_id UUID REFERENCES djassa_users(id),
  driver_id UUID REFERENCES djassa_users(id),
  status TEXT NOT NULL DEFAULT 'unassigned'
    CHECK (status IN ('unassigned','offered','accepted','pickup_confirmed','in_transit','delivered','failed','reassigned','cancelled')),
  pickup_proof JSONB,
  delivery_proof JSONB,
  accepted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_delivery_driver_status ON djassa_delivery_assignments(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_djassa_delivery_company_status ON djassa_delivery_assignments(company_id, status);

CREATE TABLE IF NOT EXISTS djassa_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES djassa_orders(id),
  provider TEXT NOT NULL,
  provider_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','confirmed','failed','cancelled','refunded')),
  verified_webhook_at TIMESTAMPTZ,
  provider_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_reference)
);

CREATE TABLE IF NOT EXISTS djassa_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES djassa_users(id),
  currency CHAR(3) NOT NULL DEFAULT 'XOF' CHECK (currency = 'XOF'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, currency)
);

-- The ledger is the source of truth. Do not update a wallet balance directly.
CREATE TABLE IF NOT EXISTS djassa_wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES djassa_wallets(id),
  transaction_key TEXT NOT NULL UNIQUE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit','debit','hold','release','fee','refund','adjustment')),
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','reversed','rejected')),
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_djassa_ledger_wallet_date ON djassa_wallet_ledger(wallet_id, created_at DESC);

CREATE TABLE IF NOT EXISTS djassa_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS djassa_conversation_members (
  conversation_id UUID NOT NULL REFERENCES djassa_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES djassa_users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(conversation_id, user_id)
);
CREATE TABLE IF NOT EXISTS djassa_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES djassa_conversations(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES djassa_users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_djassa_messages_conversation_date ON djassa_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS djassa_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES djassa_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_notifications_user_date ON djassa_notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS djassa_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES djassa_users(id),
  actor_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  result TEXT NOT NULL CHECK (result IN ('success','denied','failure')),
  ip_address INET,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_audit_events_date ON djassa_audit_events(created_at DESC);
