import { query, withTransaction } from '../database';
import { deterministicDomainUuid, isPgReady } from './commercePgRepository';
import { encryptSecretValue, maskSecretValue } from '../secretCrypto';

export async function syncPgAdminSetting(input: {
  key: string;
  value: unknown;
  changedByUserId: string;
  reason?: string;
}): Promise<void> {
  if (!(await isPgReady())) return;
  const actorUuid = deterministicDomainUuid(`user:${input.changedByUserId}`);
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO djassa_users(id, email, display_name, status) VALUES($1::uuid,$2,'Admin DJASSA','active') ON CONFLICT (id) DO NOTHING`,
      [actorUuid, `${input.changedByUserId}@djassa.internal`]
    );
    const prev = await client.query<{ setting_value: unknown }>(
      `SELECT setting_value FROM djassa_admin_settings WHERE setting_key = $1`,
      [input.key]
    );
    await client.query(
      `INSERT INTO djassa_admin_settings(setting_key, setting_value, value_version, updated_by, updated_at)
       VALUES($1,$2::jsonb,1,$3::uuid,now())
       ON CONFLICT (setting_key) DO UPDATE SET
         setting_value = EXCLUDED.setting_value,
         value_version = djassa_admin_settings.value_version + 1,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()`,
      [input.key, JSON.stringify(input.value), actorUuid]
    );
    await client.query(
      `INSERT INTO djassa_admin_setting_history(setting_key, previous_value, new_value, changed_by, change_reason)
       VALUES($1,$2::jsonb,$3::jsonb,$4::uuid,$5)`,
      [
        input.key,
        prev.rows[0] ? JSON.stringify(prev.rows[0].setting_value) : null,
        JSON.stringify(input.value),
        actorUuid,
        input.reason || 'Admin control-plane update'
      ]
    );
  });
}

export async function syncPgApiProviderSecret(input: {
  providerKey: string;
  displayName: string;
  serviceType: 'payments' | 'ai_text' | 'ai_image' | 'ai_video' | 'maps' | 'storage' | 'messaging' | 'analytics' | 'other';
  status: 'disabled' | 'sandbox' | 'active' | 'degraded';
  plaintextSecret?: string;
  publicConfig: Record<string, unknown>;
  monthlyLimitFcfa?: number | null;
  alertThresholdPercent?: number;
  updatedByUserId: string;
}): Promise<void> {
  if (!(await isPgReady())) return;
  const actorUuid = deterministicDomainUuid(`user:${input.updatedByUserId}`);
  const encrypted = input.plaintextSecret ? encryptSecretValue(input.plaintextSecret) : null;
  const safePublicConfig = {
    ...input.publicConfig,
    ...(input.plaintextSecret ? { secretMasked: maskSecretValue(input.plaintextSecret) } : {})
  };
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO djassa_users(id, email, display_name, status) VALUES($1::uuid,$2,'Admin DJASSA','active') ON CONFLICT (id) DO NOTHING`,
      [actorUuid, `${input.updatedByUserId}@djassa.internal`]
    );
    await client.query(
      `INSERT INTO djassa_admin_api_providers(
         provider_key, display_name, service_type, status, secret_ciphertext, secret_key_version,
         public_config, monthly_limit_fcfa, alert_threshold_percent, updated_by, updated_at
       )
       VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::uuid,now())
       ON CONFLICT (provider_key) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         status = EXCLUDED.status,
         secret_ciphertext = COALESCE(EXCLUDED.secret_ciphertext, djassa_admin_api_providers.secret_ciphertext),
         secret_key_version = COALESCE(EXCLUDED.secret_key_version, djassa_admin_api_providers.secret_key_version),
         public_config = EXCLUDED.public_config,
         monthly_limit_fcfa = EXCLUDED.monthly_limit_fcfa,
         alert_threshold_percent = EXCLUDED.alert_threshold_percent,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()`,
      [
        input.providerKey,
        input.displayName,
        input.serviceType,
        input.status,
        encrypted?.ciphertext || null,
        encrypted?.keyVersion || null,
        JSON.stringify(safePublicConfig),
        input.monthlyLimitFcfa ?? null,
        input.alertThresholdPercent ?? 80,
        actorUuid
      ]
    );
  });
}

export async function syncPgApprovalRequest(input: {
  id: string;
  actionKey: string;
  resourceType: string;
  resourceId: string;
  requestedByUserId: string;
  approvedByUserId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'executed';
  requestPayload: Record<string, unknown>;
  decisionReason?: string;
}): Promise<void> {
  if (!(await isPgReady())) return;
  const reqUuid = deterministicDomainUuid(`user:${input.requestedByUserId}`);
  const appUuid = input.approvedByUserId ? deterministicDomainUuid(`user:${input.approvedByUserId}`) : null;
  const approvalUuid = deterministicDomainUuid(`approval:${input.id}`);
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO djassa_users(id, email, display_name, status) VALUES($1::uuid,$2,'Admin DJASSA','active') ON CONFLICT (id) DO NOTHING`,
      [reqUuid, `${input.requestedByUserId}@djassa.internal`]
    );
    if (appUuid) {
      await client.query(
        `INSERT INTO djassa_users(id, email, display_name, status) VALUES($1::uuid,$2,'Admin Approbateur','active') ON CONFLICT (id) DO NOTHING`,
        [appUuid, `${input.approvedByUserId}@djassa.internal`]
      );
    }
    await client.query(
      `INSERT INTO djassa_admin_action_approvals(
         id, action_key, resource_type, resource_id, requested_by, approved_by, status, request_payload, decision_reason, decided_at
       )
       VALUES($1::uuid,$2,$3,$4,$5::uuid,$6::uuid,$7,$8::jsonb,$9,CASE WHEN $7 IN ('approved','rejected') THEN now() ELSE NULL END)
       ON CONFLICT (id) DO UPDATE SET
         approved_by = EXCLUDED.approved_by,
         status = EXCLUDED.status,
         decision_reason = EXCLUDED.decision_reason,
         decided_at = COALESCE(djassa_admin_action_approvals.decided_at, EXCLUDED.decided_at)`,
      [
        approvalUuid,
        input.actionKey,
        input.resourceType,
        input.resourceId,
        reqUuid,
        appUuid,
        input.status,
        JSON.stringify(input.requestPayload),
        input.decisionReason || null
      ]
    );
  });
}

export async function listPgAdminSettingsSnapshot() {
  if (!(await isPgReady())) return null;
  return query<{ setting_key: string; setting_value: unknown; value_version: number; updated_at: string }>(
    `SELECT setting_key, setting_value, value_version, updated_at::text FROM djassa_admin_settings ORDER BY setting_key`
  );
}
