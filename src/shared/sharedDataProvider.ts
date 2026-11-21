/**
 * DJASSA shared data provider contract.
 * Demo provider remains local; a real API provider can implement this contract.
 */
export type EntityId = string;

export interface DjassaEvent {
  id: EntityId;
  type: string;
  entityId?: EntityId;
  actorId?: EntityId;
  createdAt: string;
  payload?: Record<string, unknown>;
}

export interface SharedDataProvider {
  get<T>(collection: string, id?: EntityId): Promise<T | T[] | null>;
  create<T>(collection: string, data: T): Promise<T>;
  update<T>(collection: string, id: EntityId, data: Partial<T>): Promise<T>;
  delete(collection: string, id: EntityId): Promise<void>;
  subscribe(listener: (event: DjassaEvent) => void): () => void;
}

/**
 * Local demo implementation. It is deliberately isolated behind the same
 * contract that a future backend adapter will implement.
 */
export class LocalDjassaProvider implements SharedDataProvider {
  private listeners = new Set<(event: DjassaEvent) => void>();

  async get<T>(collection: string, id?: EntityId): Promise<T | T[] | null> {
    const raw = localStorage.getItem(`djassa_${collection}`);
    if (!raw) return id ? null : [];
    const value = JSON.parse(raw);
    if (!id) return value as T[];
    return (Array.isArray(value) ? value.find((x: any) => x.id === id) ?? null : null) as T | null;
  }

  async create<T>(collection: string, data: T): Promise<T> {
    const raw = localStorage.getItem(`djassa_${collection}`);
    const list = raw ? JSON.parse(raw) : [];
    list.push(data);
    localStorage.setItem(`djassa_${collection}`, JSON.stringify(list));
    this.emit({ id: crypto.randomUUID(), type: `${collection}.created`, entityId: (data as any).id, createdAt: new Date().toISOString() });
    return data;
  }

  async update<T>(collection: string, id: EntityId, patch: Partial<T>): Promise<T> {
    const raw = localStorage.getItem(`djassa_${collection}`);
    const list = raw ? JSON.parse(raw) : [];
    const index = list.findIndex((x: any) => x.id === id);
    if (index < 0) throw new Error(`Entity not found: ${collection}/${id}`);
    list[index] = { ...list[index], ...patch };
    localStorage.setItem(`djassa_${collection}`, JSON.stringify(list));
    this.emit({ id: crypto.randomUUID(), type: `${collection}.updated`, entityId: id, createdAt: new Date().toISOString(), payload: patch as Record<string, unknown> });
    return list[index] as T;
  }

  async delete(collection: string, id: EntityId): Promise<void> {
    const raw = localStorage.getItem(`djassa_${collection}`);
    const list = raw ? JSON.parse(raw) : [];
    localStorage.setItem(`djassa_${collection}`, JSON.stringify(list.filter((x: any) => x.id !== id)));
    this.emit({ id: crypto.randomUUID(), type: `${collection}.deleted`, entityId: id, createdAt: new Date().toISOString() });
  }

  subscribe(listener: (event: DjassaEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: DjassaEvent) {
    this.listeners.forEach(listener => listener(event));
    try { window.dispatchEvent(new CustomEvent('djassa:data-event', { detail: event })); } catch {}
  }
}
