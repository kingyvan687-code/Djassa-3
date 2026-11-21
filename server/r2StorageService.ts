import crypto from 'node:crypto';

export function getR2StorageConfig() {
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = (process.env.R2_BUCKET || '').trim();
  const publicUrl = (process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  const endpoint = accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '';
  return {
    configured: Boolean(accountId && accessKeyId && secretAccessKey && bucket),
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicUrl,
    endpoint,
    envVar: 'R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET'
  };
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function createR2PresignedUrl(params: {
  method: 'GET' | 'PUT';
  objectKey: string;
  expiresInSeconds?: number;
  contentType?: string;
}): { ok: boolean; url?: string; publicAssetUrl?: string; error?: string } {
  const cfg = getR2StorageConfig();
  if (!cfg.configured) {
    return { ok: false, error: 'R2_NOT_CONFIGURED' };
  }

  const cleanKey = params.objectKey.replace(/^\/+/, '');
  const expires = Math.min(3600, Math.max(60, params.expiresInSeconds || 900));
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${cfg.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host'
  });

  const canonicalUri = `/${encodeURIComponent(cfg.bucket)}/${cleanKey.split('/').map(encodeURIComponent).join('/')}`;
  const canonicalRequest = [
    params.method,
    canonicalUri,
    queryParams.toString(),
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD'
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');

  const kDate = hmacSha256(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  queryParams.append('X-Amz-Signature', signature);
  const url = `https://${host}${canonicalUri}?${queryParams.toString()}`;
  const publicAssetUrl = cfg.publicUrl ? `${cfg.publicUrl}/${cleanKey}` : undefined;

  return { ok: true, url, publicAssetUrl };
}

export async function probeR2Endpoint(): Promise<{
  configured: boolean;
  status: number;
  ms: number;
  error: string | null;
}> {
  const cfg = getR2StorageConfig();
  if (!cfg.configured) {
    return { configured: false, status: 0, ms: 0, error: 'Variables R2_* absentes' };
  }
  const start = Date.now();
  try {
    const res = await fetch(cfg.endpoint, { method: 'HEAD', signal: AbortSignal.timeout(2500) });
    return {
      configured: true,
      status: res.status,
      ms: Date.now() - start,
      error: res.status > 0 ? null : `HTTP ${res.status}`
    };
  } catch (err) {
    return {
      configured: true,
      status: 0,
      ms: Date.now() - start,
      error: (err as Error).message || 'Endpoint R2 injoignable'
    };
  }
}
