-- DJASSA Lot 3N: administration control-plane foundation.
-- Additive schema only. Existing admin UI/API continues using its current
-- repositories until a separately tested route-by-route cutover.

CREATE TABLE IF NOT EXISTS djassa_admin_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  value_version INTEGER NOT NULL DEFAULT 1 CHECK (value_version > 0),
  updated_by UUID REFERENCES djassa_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS djassa_admin_setting_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB NOT NULL,
  changed_by UUID REFERENCES djassa_users(id) ON DELETE SET NULL,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_admin_setting_history_key_date
  ON djassa_admin_setting_history(setting_key, created_at DESC);

-- Explicit per-admin grants allow future least-privilege staff accounts.
-- A grant is effective only while the user has an active admin membership.
CREATE TABLE IF NOT EXISTS djassa_admin_user_permission_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES djassa_users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES djassa_permissions(permission_key) ON DELETE CASCADE,
  granted_by UUID REFERENCES djassa_users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_key)
);
CREATE INDEX IF NOT EXISTS idx_djassa_admin_user_grants_active
  ON djassa_admin_user_permission_grants(user_id, permission_key)
  WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION djassa_admin_user_has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM djassa_memberships m
    WHERE m.user_id = p_user_id
      AND m.role = 'admin' AND m.status = 'active'
  ) AND (
    EXISTS (
      SELECT 1 FROM djassa_admin_user_permission_grants g
      WHERE g.user_id = p_user_id
        AND g.permission_key = p_permission
        AND g.revoked_at IS NULL
        AND (g.expires_at IS NULL OR g.expires_at > now())
    )
    OR NOT EXISTS (
      SELECT 1 FROM djassa_admin_user_permission_grants g
      WHERE g.user_id = p_user_id
        AND g.revoked_at IS NULL
        AND (g.expires_at IS NULL OR g.expires_at > now())
    ) AND djassa_has_permission(p_user_id, p_permission)
  );
$$;

-- Provider secrets must be encrypted by the application before persistence.
-- Never store plaintext API keys in this table or in audit metadata.
CREATE TABLE IF NOT EXISTS djassa_admin_api_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN
    ('payments','ai_text','ai_image','ai_video','maps','storage','messaging','analytics','other')),
  status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled','sandbox','active','degraded')),
  secret_ciphertext TEXT,
  secret_key_version TEXT,
  public_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  monthly_limit_fcfa BIGINT CHECK (monthly_limit_fcfa IS NULL OR monthly_limit_fcfa >= 0),
  alert_threshold_percent INTEGER NOT NULL DEFAULT 80 CHECK (alert_threshold_percent BETWEEN 1 AND 100),
  last_health_check_at TIMESTAMPTZ,
  last_health_status TEXT CHECK (last_health_status IS NULL OR last_health_status IN ('ok','warning','failed')),
  updated_by UUID REFERENCES djassa_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS djassa_admin_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('promotion','advertising')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','active','paused','completed','cancelled')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  budget_fcfa BIGINT CHECK (budget_fcfa IS NULL OR budget_fcfa >= 0),
  spent_fcfa BIGINT NOT NULL DEFAULT 0 CHECK (spent_fcfa >= 0),
  discount_type TEXT CHECK (discount_type IS NULL OR discount_type IN ('fixed','percent')),
  discount_value BIGINT CHECK (discount_value IS NULL OR discount_value >= 0),
  max_discount_fcfa BIGINT CHECK (max_discount_fcfa IS NULL OR max_discount_fcfa >= 0),
  promo_code TEXT,
  targeting JSONB NOT NULL DEFAULT '{}'::jsonb,
  creative JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES djassa_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CHECK (discount_type <> 'percent' OR discount_value IS NULL OR discount_value <= 100)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_djassa_campaign_promo_code
  ON djassa_admin_campaigns(lower(promo_code))
  WHERE promo_code IS NOT NULL AND promo_code <> '';
CREATE INDEX IF NOT EXISTS idx_djassa_campaigns_status_dates
  ON djassa_admin_campaigns(status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS djassa_admin_action_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES djassa_users(id),
  approved_by UUID REFERENCES djassa_users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','executed')),
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  decided_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (approved_by IS NULL OR approved_by <> requested_by)
);
CREATE INDEX IF NOT EXISTS idx_djassa_admin_approvals_queue
  ON djassa_admin_action_approvals(status, expires_at, created_at);

CREATE TABLE IF NOT EXISTS djassa_admin_dashboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_key TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metrics JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end > period_start),
  UNIQUE(snapshot_key, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_djassa_admin_snapshots_generated
  ON djassa_admin_dashboard_snapshots(snapshot_key, generated_at DESC);

-- Make individual admin grants additive to the existing role catalogue.
-- Existing global admin grants remain unchanged; granular staff delegation
-- requires removing the corresponding global role grant in a controlled
-- operational migration, not in this schema-only foundation.
COMMENT ON TABLE djassa_admin_api_providers IS
  'Provider metadata and encrypted secret ciphertext only; plaintext secrets are forbidden.';
COMMENT ON TABLE djassa_admin_action_approvals IS
  'Two-person approval queue for sensitive administrative operations; execution remains application-controlled.';
