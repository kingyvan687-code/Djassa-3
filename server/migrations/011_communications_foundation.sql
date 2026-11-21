-- DJASSA Lot 3M: communications and notification foundation.
-- Additive schema only. This does NOT enable websocket delivery, FCM, SMS,
-- email, or switch existing JSON/localStorage communication flows.

ALTER TABLE djassa_conversations
  ADD COLUMN IF NOT EXISTS conversation_type TEXT NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS context_type TEXT,
  ADD COLUMN IF NOT EXISTS context_id TEXT,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'djassa_conversations_type_check'
  ) THEN
    ALTER TABLE djassa_conversations
      ADD CONSTRAINT djassa_conversations_type_check
      CHECK (conversation_type IN ('direct','group','order_support','delivery_support','company_team')) NOT VALID;
  END IF;
END $$;

ALTER TABLE djassa_conversation_members
  ADD COLUMN IF NOT EXISTS member_role TEXT,
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_djassa_conversation_members_user_active
  ON djassa_conversation_members(user_id, joined_at DESC)
  WHERE removed_at IS NULL;

ALTER TABLE djassa_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS attachment_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES djassa_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_message_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'djassa_messages_type_check'
  ) THEN
    ALTER TABLE djassa_messages
      ADD CONSTRAINT djassa_messages_type_check
      CHECK (message_type IN ('text','image','video','audio','file','system')) NOT VALID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_djassa_messages_sender_client_id
  ON djassa_messages(sender_user_id, client_message_id)
  WHERE client_message_id IS NOT NULL AND client_message_id <> '';

CREATE INDEX IF NOT EXISTS idx_djassa_messages_conversation_cursor
  ON djassa_messages(conversation_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS djassa_conversation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES djassa_conversations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES djassa_users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN
    ('created','member_added','member_removed','member_left','title_changed','archived','unarchived')),
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_conversation_events_conversation
  ON djassa_conversation_events(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS djassa_message_receipts (
  message_id UUID NOT NULL REFERENCES djassa_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES djassa_users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  PRIMARY KEY(message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_djassa_message_receipts_user_unread
  ON djassa_message_receipts(user_id, read_at)
  WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS djassa_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES djassa_users(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  order_updates BOOLEAN NOT NULL DEFAULT true,
  delivery_updates BOOLEAN NOT NULL DEFAULT true,
  messages_enabled BOOLEAN NOT NULL DEFAULT true,
  marketing_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS djassa_device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES djassa_users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('android','ios','web')),
  provider TEXT NOT NULL DEFAULT 'fcm' CHECK (provider IN ('fcm','apns','web_push')),
  token_hash TEXT NOT NULL,
  token_ciphertext TEXT NOT NULL,
  device_label TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, token_hash)
);
CREATE INDEX IF NOT EXISTS idx_djassa_push_tokens_user_active
  ON djassa_device_push_tokens(user_id, platform)
  WHERE active = true AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS djassa_notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES djassa_notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','push','email','sms')),
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','sent','delivered','failed','cancelled')),
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_redacted TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_djassa_notification_deliveries_queue
  ON djassa_notification_deliveries(status, next_attempt_at, created_at)
  WHERE status IN ('queued','failed');
CREATE INDEX IF NOT EXISTS idx_djassa_notification_deliveries_notification
  ON djassa_notification_deliveries(notification_id, created_at);

CREATE INDEX IF NOT EXISTS idx_djassa_notifications_unread
  ON djassa_notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;
