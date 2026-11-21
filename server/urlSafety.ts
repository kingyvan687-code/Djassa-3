import net from 'node:net';

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const norm = ip.toLowerCase();
  if (norm === '::1' || norm === '::') return true;
  if (norm.startsWith('fc') || norm.startsWith('fd')) return true; // unique local
  if (norm.startsWith('fe80:')) return true; // link-local
  if (norm.startsWith('::ffff:')) {
    const mappedV4 = norm.slice('::ffff:'.length);
    if (net.isIPv4(mappedV4)) return isPrivateIpv4(mappedV4);
  }
  return false;
}

/**
 * Validates outbound webhook / HTTP callback URLs against SSRF targets.
 * Blocks private networks, loopback interfaces, link-local / cloud metadata IPs,
 * and non-HTTPS schemes in production.
 */
export function validateSafeOutboundUrl(rawUrl: string): { safe: boolean; url?: URL; reason?: string } {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return { safe: false, reason: 'URL vide' };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { safe: false, reason: 'Syntaxe URL invalide' };
  }

  const isProd = process.env.NODE_ENV === 'production';
  const allowLocalTest = !isProd && process.env.DJASSA_ALLOW_LOCAL_WEBHOOKS === 'true';

  if (parsed.protocol !== 'https:' && !(allowLocalTest && parsed.protocol === 'http:')) {
    return { safe: false, reason: 'Protocole HTTPS obligatoire pour les webhooks sortants' };
  }

  if (parsed.username || parsed.password) {
    return { safe: false, reason: 'Identifiants intégrés interdits dans une URL sortante' };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) return { safe: false, reason: 'Hôte manquant' };

  if (!allowLocalTest) {
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === 'metadata.google.internal'
    ) {
      return { safe: false, reason: 'Cible locale ou métadonnées cloud interdite (protection SSRF)' };
    }

    const ipFamily = net.isIP(host);
    if (ipFamily === 4 && isPrivateIpv4(host)) {
      return { safe: false, reason: 'Adresse IPv4 privée ou réservée interdite (protection SSRF)' };
    }
    if (ipFamily === 6 && isPrivateIpv6(host)) {
      return { safe: false, reason: 'Adresse IPv6 privée ou loopback interdite (protection SSRF)' };
    }
  }

  return { safe: true, url: parsed };
}
