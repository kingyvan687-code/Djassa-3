/**
 * DJASSA shared data adapter.
 *
 * Demo mode:
 * - same-origin tabs/windows share localStorage;
 * - BroadcastChannel gives immediate cross-tab updates.
 *
 * Production mode:
 * Replace the persistence functions with the same backend/API contract.
 * The domain models and keys stay unchanged.
 */
export const DJASSA_SHARED_KEYS = [
  'djassa_products','djassa_sellers','djassa_orders','djassa_conversations',
  'djassa_messages','djassa_notifs','djassa_comments','djassa_cart',
  'djassa_user_profile','djassa_admin_users','djassa_audit_logs',
  'djassa_platform_config','djassa_drivers','djassa_driver_balance',
  'djassa_driver_online','djassa_payments','djassa_wallets',
  'djassa_commissions','djassa_deliveries','djassa_partnerships',
  'djassa_returns','djassa_incidents','djassa_tryon_history',
  'djassa_seller_creations'
] as const;

export type DjassaSharedKey = typeof DJASSA_SHARED_KEYS[number];
const CHANNEL_NAME = 'djassa-shared-data-v2';
let channel: BroadcastChannel | null = null;
const memoryStorageFallback = new Map<string, string>();

export function safeStorageGet(key: string): string | null {
  if (typeof window === 'undefined') return memoryStorageFallback.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryStorageFallback.get(key) ?? null;
  }
}

export function safeStorageSet(key: string, value: string): void {
  memoryStorageFallback.set(key, value);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Restricted iframe or storage quota exceeded; keep in-memory fallback
  }
}

export function safeStorageRemove(key: string): void {
  memoryStorageFallback.delete(key);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage restriction errors
  }
}

export function safeStorageKeys(prefix?: string): string[] {
  if (typeof window === 'undefined') {
    return Array.from(memoryStorageFallback.keys()).filter((k) => !prefix || k.startsWith(prefix));
  }
  try {
    const keys = Object.keys(window.localStorage);
    return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
  } catch {
    return Array.from(memoryStorageFallback.keys()).filter((k) => !prefix || k.startsWith(prefix));
  }
}

function getChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return channel;
}

export function publishSharedChange(key: DjassaSharedKey) {
  try { getChannel()?.postMessage({ type: 'djassa:changed', key }); } catch {}
}

export function subscribeSharedChanges(onChange: (key: DjassaSharedKey) => void) {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key && (DJASSA_SHARED_KEYS as readonly string[]).includes(event.key)) {
      onChange(event.key as DjassaSharedKey);
    }
  };
  const ch = getChannel();
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === 'djassa:changed' &&
        (DJASSA_SHARED_KEYS as readonly string[]).includes(event.data.key)) {
      onChange(event.data.key as DjassaSharedKey);
    }
  };
  try {
    window.addEventListener('storage', onStorage);
  } catch {}
  try {
    ch?.addEventListener('message', onMessage);
  } catch {}
  return () => {
    try {
      window.removeEventListener('storage', onStorage);
    } catch {}
    try {
      ch?.removeEventListener('message', onMessage);
    } catch {}
  };
}

export function readShared<T>(key: DjassaSharedKey, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = safeStorageGet(key);
    if (raw == null || raw === '' || raw === 'null' || raw === 'undefined') return fallback;
    const parsed = JSON.parse(raw);
    if (parsed == null) return fallback;
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    if (
      typeof fallback === 'object' &&
      !Array.isArray(fallback) &&
      fallback !== null &&
      (typeof parsed !== 'object' || Array.isArray(parsed))
    ) {
      return fallback;
    }
    return parsed as T;
  } catch { return fallback; }
}

export function writeShared<T>(key: DjassaSharedKey, value: T) {
  if (typeof window === 'undefined') return;
  try {
    safeStorageSet(key, JSON.stringify(value));
    publishSharedChange(key);
  } catch {}
}

export function writeSharedScalar(key: DjassaSharedKey, value: string) {
  if (typeof window === 'undefined') return;
  try {
    safeStorageSet(key, value);
    publishSharedChange(key);
  } catch {}
}
