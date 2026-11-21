import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const LOCAL_DEV_KEY_FILE = path.join(DATA_DIR, '.admin_secrets_key');

function resolveEncryptionKey(): { key: Buffer; version: string } {
  const dedicatedAdminKey =
    (process.env.DJASSA_ADMIN_SECRET_KEY || process.env.DJASSA_ADMIN_SECRETS_KEY || '').trim();
  const envSecret =
    dedicatedAdminKey ||
    (process.env.DJASSA_BACKUP_KEY || '').trim() ||
    (process.env.DJASSA_SECURITY_SECRET || '').trim();

  if (envSecret) {
    return {
      key: crypto.createHash('sha256').update(`djassa-secrets-v1:${envSecret}`).digest(),
      version: dedicatedAdminKey ? 'env-admin-v1' : 'env-shared-v1'
    };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DJASSA_ADMIN_SECRET_KEY_REQUIRED_IN_PRODUCTION');
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  let localHex = '';
  if (fs.existsSync(LOCAL_DEV_KEY_FILE)) {
    localHex = fs.readFileSync(LOCAL_DEV_KEY_FILE, 'utf8').trim();
  }
  if (!/^[a-f0-9]{64}$/i.test(localHex)) {
    localHex = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(LOCAL_DEV_KEY_FILE, localHex, { mode: 0o600 });
    fs.chmodSync(LOCAL_DEV_KEY_FILE, 0o600);
  }
  return {
    key: Buffer.from(localHex, 'hex'),
    version: 'dev-file-v1'
  };
}

export function encryptSecretValue(plaintext: string): { ciphertext: string; keyVersion: string } {
  const clean = String(plaintext || '');
  if (!clean) {
    throw new Error('EMPTY_SECRET_CANNOT_BE_ENCRYPTED');
  }
  const { key, version } = resolveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`,
    keyVersion: version
  };
}

export function decryptSecretValue(ciphertext: string): string {
  const parts = String(ciphertext || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('INVALID_SECRET_CIPHERTEXT');
  }
  const [, ivHex, tagHex, dataHex] = parts;
  const { key } = resolveEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

export function maskSecretValue(secret: string | null | undefined): string {
  const clean = String(secret || '').trim();
  if (!clean) return 'Non configuré';
  if (clean.length <= 6) return '••••••';
  return `${clean.slice(0, 3)}***${clean.slice(-4)}`;
}
