import crypto from 'node:crypto';
import { query, withTransaction } from '../database';
import { deterministicDomainUuid, isPgReady } from './commercePgRepository';
import { encryptSecretValue } from '../secretCrypto';

export async function upsertPgNotificationPreferences(
  userId: string,
  prefs: {
    inAppEnabled?: boolean;
    pushEnabled?: boolean;
    orderUpdates?: boolean;
    deliveryUpdates?: boolean;
    messagesEnabled?: boolean;
    marketingEnabled?: boolean;
    quietHours?: Record<string, unknown>;
  }
): Promise<void> {
  if (!(await isPgReady())) return;
  const userUuid = deterministicDomainUuid(`user:${userId}`);
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO djassa_users(id, email, display_name, status) VALUES($1::uuid,$2,$3,'active') ON CONFLICT (id) DO NOTHING`,
      [userUuid, `${userId}@djassa.internal`, 'Utilisateur DJASSA']
    );
    await client.query(
      `INSERT INTO djassa_notification_preferences(
         user_id, in_app_enabled, push_enabled, order_updates, delivery_updates, messages_enabled, marketing_enabled, quiet_hours
       )
       VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET
         in_app_enabled = EXCLUDED.in_app_enabled,
         push_enabled = EXCLUDED.push_enabled,
         order_updates = EXCLUDED.order_updates,
         delivery_updates = EXCLUDED.delivery_updates,
         messages_enabled = EXCLUDED.messages_enabled,
         marketing_enabled = EXCLUDED.marketing_enabled,
         quiet_hours = EXCLUDED.quiet_hours,
         updated_at = now()`,
      [
        userUuid,
        prefs.inAppEnabled ?? true,
        prefs.pushEnabled ?? true,
        prefs.orderUpdates ?? true,
        prefs.deliveryUpdates ?? true,
        prefs.messagesEnabled ?? true,
        prefs.marketingEnabled ?? false,
        JSON.stringify(prefs.quietHours || {})
      ]
    );
  });
}

export async function registerPgPushToken(input: {
  userId: string;
  platform: 'android' | 'ios' | 'web';
  provider: 'fcm' | 'apns' | 'web_push';
  rawToken: string;
  deviceLabel?: string;
}): Promise<void> {
  if (!(await isPgReady())) return;
  const userUuid = deterministicDomainUuid(`user:${input.userId}`);
  const tokenHash = crypto.createHash('sha256').update(input.rawToken).digest('hex');
  const encrypted = encryptSecretValue(input.rawToken);
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO djassa_users(id, email, display_name, status) VALUES($1::uuid,$2,$3,'active') ON CONFLICT (id) DO NOTHING`,
      [userUuid, `${input.userId}@djassa.internal`, 'Utilisateur DJASSA']
    );
    await client.query(
      `INSERT INTO djassa_device_push_tokens(user_id, platform, provider, token_hash, token_ciphertext, device_label, active, last_seen_at)
       VALUES($1::uuid,$2,$3,$4,$5,$6,true,now())
       ON CONFLICT (provider, token_hash) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         token_ciphertext = EXCLUDED.token_ciphertext,
         device_label = EXCLUDED.device_label,
         active = true,
         revoked_at = NULL,
         last_seen_at = now()`,
      [userUuid, input.platform, input.provider, tokenHash, encrypted.ciphertext, input.deviceLabel || null]
    );
  });
}

export async function syncPgChatMessage(input: {
  conversationId: string;
  participantIds: string[];
  title: string;
  messageId: string;
  senderId: string;
  body: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'system';
}): Promise<void> {
  if (!(await isPgReady())) return;
  const convUuid = deterministicDomainUuid(`conv:${input.conversationId}`);
  const msgUuid = deterministicDomainUuid(`msg:${input.messageId}`);
  const senderUuid = deterministicDomainUuid(`user:${input.senderId}`);

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO djassa_conversations(id, conversation_type, title, last_message_at, metadata)
       VALUES($1::uuid, 'direct', $2, now(), $3::jsonb)
       ON CONFLICT (id) DO UPDATE SET last_message_at = now()`,
      [convUuid, input.title, JSON.stringify({ legacyConversationId: input.conversationId })]
    );
    for (const pid of input.participantIds) {
      const pUuid = deterministicDomainUuid(`user:${pid}`);
      await client.query(
        `INSERT INTO djassa_users(id, email, display_name, status) VALUES($1::uuid,$2,$3,'active') ON CONFLICT (id) DO NOTHING`,
        [pUuid, `${pid}@djassa.internal`, pid]
      );
      await client.query(
        `INSERT INTO djassa_conversation_members(conversation_id, user_id) VALUES($1::uuid,$2::uuid) ON CONFLICT DO NOTHING`,
        [convUuid, pUuid]
      );
    }
    await client.query(
      `INSERT INTO djassa_messages(id, conversation_id, sender_user_id, body, message_type, client_message_id)
       VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6)
       ON CONFLICT (id) DO NOTHING`,
      [msgUuid, convUuid, senderUuid, input.body, input.messageType, input.messageId]
    );
  });
}
