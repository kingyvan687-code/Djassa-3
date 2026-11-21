export function getFcmConfig() {
  const projectId = (process.env.FCM_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '').trim();
  const serverKey = (process.env.FCM_SERVER_KEY || '').trim();
  const pushWebhookUrl = (process.env.PUSH_WEBHOOK_URL || '').trim();
  const endpoint = pushWebhookUrl || (serverKey ? 'https://fcm.googleapis.com/fcm/send' : '');
  return {
    configured: Boolean(serverKey || pushWebhookUrl),
    projectId: projectId || null,
    serverKey,
    endpoint,
    envVar: 'FCM_PROJECT_ID / FCM_SERVER_KEY'
  };
}

export async function probeFcmConnectivity(): Promise<{
  configured: boolean;
  ok: boolean;
  status: number;
  ms: number;
  error: string | null;
}> {
  const cfg = getFcmConfig();
  if (!cfg.configured) {
    return {
      configured: false,
      ok: false,
      status: 0,
      ms: 0,
      error: 'Non configuré : FCM_PROJECT_ID / FCM_SERVER_KEY absents côté serveur'
    };
  }
  const start = Date.now();
  try {
    const res = await fetch('https://fcm.googleapis.com/', { method: 'HEAD', signal: AbortSignal.timeout(2500) });
    return {
      configured: true,
      ok: res.status > 0 && res.status < 500,
      status: res.status,
      ms: Date.now() - start,
      error: res.status > 0 && res.status < 500 ? null : `HTTP ${res.status}`
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      status: 0,
      ms: Date.now() - start,
      error: (err as Error).message || 'Connectivité FCM indisponible'
    };
  }
}
