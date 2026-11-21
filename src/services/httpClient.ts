import { getSecurityToken } from './securityService';

export interface HttpFetchOptions extends RequestInit {
  timeoutMs?: number;
  /** Opt-in short TTL in-memory cache ONLY for public non-sensitive read endpoints. */
  cacheTtlMs?: number;
  /** Deduplicate simultaneous identical GET requests. */
  dedupe?: boolean;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const inflightGets = new Map<string, Promise<unknown>>();
const publicResponseCache = new Map<string, { expiresAt: number; data: unknown }>();

export function invalidatePublicHttpCache(prefix?: string): void {
  if (!prefix) {
    publicResponseCache.clear();
    return;
  }
  for (const key of publicResponseCache.keys()) {
    if (key.includes(prefix)) {
      publicResponseCache.delete(key);
    }
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const callerSignal = options.signal;
  if (typeof AbortController === 'undefined') {
    return fetch(url, options);
  }
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError' && !callerSignal?.aborted) {
      const timeoutErr = new Error('Délai de connexion dépassé. Vérifiez votre réseau et réessayez.') as Error & {
        status?: number;
        code?: string;
      };
      timeoutErr.status = 408;
      timeoutErr.code = 'REQUEST_TIMEOUT';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (callerSignal) {
      callerSignal.removeEventListener('abort', onCallerAbort);
    }
  }
}

export async function apiJsonFetch<T>(url: string, options: HttpFetchOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, cacheTtlMs = 0, dedupe = true, ...fetchInit } = options;
  const method = (fetchInit.method || 'GET').toUpperCase();
  const token = getSecurityToken();
  const cacheKey = `${method}:${url}`;

  if (method === 'GET' && cacheTtlMs > 0) {
    const cached = publicResponseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
    if (cached) {
      publicResponseCache.delete(cacheKey);
    }
  }

  const runRequest = async (): Promise<T> => {
    const res = await fetchWithTimeout(
      url,
      {
        ...fetchInit,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(fetchInit.headers || {})
        }
      },
      timeoutMs
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.message || data?.error || `Erreur serveur (${res.status})`) as Error & {
        status?: number;
        code?: string;
      };
      err.status = res.status;
      err.code = data?.error;
      throw err;
    }
    if (method === 'GET' && cacheTtlMs > 0) {
      publicResponseCache.set(cacheKey, {
        expiresAt: Date.now() + cacheTtlMs,
        data
      });
    }
    return data as T;
  };

  if (method === 'GET' && dedupe && !fetchInit.signal) {
    const inflightKey = `${cacheKey}:${token ? token.slice(-12) : 'anon'}`;
    const existing = inflightGets.get(inflightKey);
    if (existing) {
      return existing as Promise<T>;
    }
    const promise = runRequest().finally(() => {
      inflightGets.delete(inflightKey);
    });
    inflightGets.set(inflightKey, promise);
    return promise;
  }

  return runRequest();
}
