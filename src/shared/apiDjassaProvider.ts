import type { DjassaEvent, EntityId, SharedDataProvider } from './sharedDataProvider';

export interface ApiDjassaProviderOptions {
  baseUrl: string;
  token?: string;
}

/**
 * Production-ready adapter boundary.
 * It talks to the central DJASSA API instead of browser localStorage.
 * The API contract is intentionally collection-based so Client, Seller,
 * Driver and Admin can share the same entities and IDs.
 */
export class ApiDjassaProvider implements SharedDataProvider {
  private baseUrl: string;
  private token?: string;
  private listeners = new Set<(event: DjassaEvent) => void>();
  private eventSource?: EventSource;

  constructor(options: ApiDjassaProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
    if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
      const tokenQuery = this.token ? `?token=${encodeURIComponent(this.token)}` : "";
      this.eventSource = new EventSource(`${this.baseUrl}/api/events${tokenQuery}`);
      this.eventSource.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as DjassaEvent;
          this.listeners.forEach(listener => listener(event));
        } catch {}
      };
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `DJASSA API error ${response.status}`);
    }
    return response.status === 204 ? undefined as T : response.json();
  }

  get<T>(collection: string, id?: EntityId) {
    return this.request<T | T[] | null>(`/api/${encodeURIComponent(collection)}${id ? `/${encodeURIComponent(id)}` : ''}`);
  }

  create<T>(collection: string, data: T) {
    return this.request<T>(`/api/${encodeURIComponent(collection)}`, { method: 'POST', body: JSON.stringify(data) });
  }

  update<T>(collection: string, id: EntityId, data: Partial<T>) {
    return this.request<T>(`/api/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  delete(collection: string, id: EntityId) {
    return this.request<void>(`/api/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  subscribe(listener: (event: DjassaEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose() {
    this.eventSource?.close();
    this.listeners.clear();
  }
}
