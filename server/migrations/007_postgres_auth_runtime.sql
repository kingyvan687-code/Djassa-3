-- DJASSA Lot 3H: runtime constraints/indexes for the PostgreSQL auth adapter.
-- The adapter is intentionally not the active HTTP auth backend until cutover tests pass.
CREATE INDEX IF NOT EXISTS idx_djassa_credentials_lock
  ON djassa_credentials(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_djassa_sessions_token_live
  ON djassa_sessions(token_hash, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_djassa_membership_auth_lookup
  ON djassa_memberships(user_id, role, status, created_at);

CREATE TABLE IF NOT EXISTS djassa_auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES djassa_users(id) ON DELETE SET NULL,
  email_snapshot TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('register','login_success','login_failure','logout','session_revoked','login_locked')),
  role_snapshot TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_auth_events_user_date
  ON djassa_auth_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_djassa_auth_events_email_date
  ON djassa_auth_events(lower(email_snapshot), created_at DESC);
