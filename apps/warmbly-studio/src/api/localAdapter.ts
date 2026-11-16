import type { Workspace } from '../types';
import type { Action, WarmblyAdapter } from './actions';
import { reduce } from './reducer';
import { buildSeed } from './seed';
import { rollDay, tick } from './engine';

export interface LocalAdapterOptions { storageKey?: string; persist?: boolean; seed?: () => Workspace }

export function createLocalAdapter(opts: LocalAdapterOptions = {}): WarmblyAdapter & { advanceDays(days: number): Promise<Workspace> } {
  const key = opts.storageKey ?? 'warmbly-studio:v1';
  const persist = opts.persist ?? true;
  let ws: Workspace | null = null;
  let offsetMs = 0;
  const listeners = new Set<(w: Workspace) => void>();
  const now = () => new Date(Date.now() + offsetMs);

  const read = (): Workspace | null => { if (!persist) return null; try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as Workspace : null; } catch { return null; } };
  const write = (w: Workspace) => { if (!persist) return; try { localStorage.setItem(key, JSON.stringify(w)); } catch { /* quota or private mode */ } };
  const set = (w: Workspace) => { ws = w; write(w); listeners.forEach(l => l(w)); return w; };
  const ensure = () => ws ?? (ws = read() ?? (opts.seed ? opts.seed() : buildSeed(now())));

  return {
    kind: 'local', now,
    async load() { return ensure(); },
    async dispatch(action: Action) { return set(reduce(ensure(), action, now())); },
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async reset() { offsetMs = 0; return set(opts.seed ? opts.seed() : buildSeed(now())); },
    async advanceDays(days: number) {
      let w = ensure();
      for (let d = 0; d < days; d++) {
        const base = new Date(now().getTime() + 86_400_000); offsetMs += 86_400_000;
        for (let h = 9; h < 17; h++) { const t = new Date(base); t.setHours(h, 0, 0, 0); w = tick(w, t); }
        w = rollDay(w);
      }
      return set(w);
    },
  };
}
