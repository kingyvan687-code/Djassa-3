-- DJASSA Lot 3F: central identity/space authorization foundation.
-- This does not switch authentication reads away from auth_users.json.
-- Existing API permission checks remain authoritative until a separately
-- tested cutover is approved.

ALTER TABLE djassa_memberships
  ADD COLUMN IF NOT EXISTS display_label TEXT,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE djassa_sessions
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_djassa_memberships_user_active
  ON djassa_memberships(user_id, created_at)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS djassa_permissions (
  permission_key TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS djassa_role_permission_grants (
  role TEXT NOT NULL CHECK (role IN ('client','seller','driver','company','admin')),
  permission_key TEXT NOT NULL REFERENCES djassa_permissions(permission_key) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(role, permission_key)
);

-- Permission catalog mirrors the existing server-side security middleware.
INSERT INTO djassa_permissions(permission_key, description) VALUES
  ('viewDashboard', 'Consulter le tableau de bord administratif'),
  ('modifySettings', 'Modifier les paramètres de la plateforme'),
  ('managePermissions', 'Gérer les permissions administratives'),
  ('manageSessions', 'Gérer les sessions de sécurité'),
  ('manageAlerts', 'Gérer les alertes de sécurité'),
  ('manageIncidents', 'Gérer les incidents'),
  ('manageFinanceProtection', 'Gérer les protections financières'),
  ('executeProtectionActions', 'Exécuter les actions de protection'),
  ('viewLoginLogs', 'Consulter les journaux de connexion'),
  ('viewIntrusions', 'Consulter les détections d’intrusion'),
  ('viewCyberattacks', 'Consulter les alertes de cyberattaque')
ON CONFLICT (permission_key) DO NOTHING;

-- No grants are assigned to client/seller/driver/company. Administrative
-- grants are seeded only for admin; granular staff delegation is a later step.
INSERT INTO djassa_role_permission_grants(role, permission_key)
SELECT 'admin', permission_key FROM djassa_permissions
ON CONFLICT (role, permission_key) DO NOTHING;

CREATE OR REPLACE FUNCTION djassa_has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM djassa_memberships m
    JOIN djassa_role_permission_grants g ON g.role = m.role
    WHERE m.user_id = p_user_id
      AND m.status = 'active'
      AND g.permission_key = p_permission
  );
$$;

COMMENT ON FUNCTION djassa_has_permission(UUID, TEXT) IS
  'Central PostgreSQL permission lookup. Application middleware cutover must be separately tested.';
