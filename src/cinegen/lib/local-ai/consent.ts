// [remix] Port I1: explicit, per-model, per-licence-version consent before any model download. Stored in localStorage (injectable for tests).
// A model is never downloaded unless `hasConsent(model)` is true; consent is bound to the licence string shown, so a catalogue licence change re-asks.
import type { ModelEntry } from './catalog';

export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
const KEY = 'cinegen.localAi.consent.v1';

export class ConsentRequiredError extends Error {
  readonly modelId: string;
  constructor(modelId: string, message?: string) {
    super(message ?? `The "${modelId}" model has not been downloaded yet. Open Media tools > Local AI, review its licence and size, and choose Download.`);
    this.name = 'ConsentRequiredError';
    this.modelId = modelId;
  }
}

const memory = (): KeyValueStore => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }; };
const defaultStore = (): KeyValueStore => { try { if (typeof localStorage !== 'undefined') { localStorage.getItem(KEY); return localStorage; } } catch { /* blocked */ } return memory(); };

/** What the user agreed to: model + licence name + source. Changing any invalidates the stored consent. */
export const consentFingerprint = (m: ModelEntry): string => `${m.id}|${m.repo}|${m.licence.name}|${m.licence.status}`;

export class ConsentStore {
  private store: KeyValueStore;
  constructor(store: KeyValueStore = defaultStore()) { this.store = store; }
  private read(): Record<string, { fp: string; at: number }> { try { return JSON.parse(this.store.getItem(KEY) || '{}') as Record<string, { fp: string; at: number }>; } catch { return {}; } }
  has(m: ModelEntry): boolean { return this.read()[m.id]?.fp === consentFingerprint(m); }
  grant(m: ModelEntry, now = Date.now()): void { const all = this.read(); all[m.id] = { fp: consentFingerprint(m), at: now }; this.store.setItem(KEY, JSON.stringify(all)); }
  revoke(id: string): void { const all = this.read(); delete all[id]; this.store.setItem(KEY, JSON.stringify(all)); }
}
