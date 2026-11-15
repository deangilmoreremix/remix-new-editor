// [remix] Port I1: model manager. Owns install state, a serial download queue, consent / licence / capability / quota gates, progress, cancel and delete.
// The actual download is delegated to a `ModelLoader` (the real one warms the transformers.js pipeline in a worker, whose files land in ModelCache;
// tests inject a mock). The manager never downloads without a recorded consent and never offers a model whose licence is not verified.
import { MODEL_CATALOG, estimateBytes, isDownloadable, modelById, type Backend, type ModelEntry } from './catalog';
import { checkQuota, pickBackend, type Capabilities } from './capabilities';
import { ConsentRequiredError, ConsentStore } from './consent';
import { ModelCache } from './model-cache';

export type ModelStatus = 'not-installed' | 'queued' | 'downloading' | 'installed' | 'error' | 'unavailable';
export interface ModelState { id: string; status: ModelStatus; progress: number; loadedBytes: number; totalBytes: number; error?: string; installedBytes?: number; backend?: Backend }
export interface DownloadHooks { signal: AbortSignal; onProgress: (loaded: number, total: number) => void }
export interface ModelLoader { prepare(model: ModelEntry, backend: Backend, hooks: DownloadHooks): Promise<void> }
export interface ManagerDeps { cache: ModelCache; consent: ConsentStore; loader: ModelLoader; capabilities: () => Promise<Capabilities>; now?: () => number }

export class DownloadCancelled extends Error { constructor() { super('Download cancelled'); this.name = 'AbortError'; } }

export class ModelManager {
  private states = new Map<string, ModelState>();
  private controllers = new Map<string, AbortController>();
  private listeners = new Set<() => void>();
  private chain: Promise<void> = Promise.resolve();
  private snapshot: ModelState[] = [];

  constructor(private d: ManagerDeps) {
    for (const m of MODEL_CATALOG) this.states.set(m.id, { id: m.id, status: isDownloadable(m) ? 'not-installed' : 'unavailable', progress: 0, loadedBytes: 0, totalBytes: 0 });
    this.rebuild();
  }

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  getSnapshot = (): ModelState[] => this.snapshot;
  state(id: string): ModelState | undefined { return this.states.get(id); }
  isInstalled(id: string): boolean { return this.states.get(id)?.status === 'installed'; }
  private rebuild() { this.snapshot = [...this.states.values()].map((s) => ({ ...s })); for (const l of this.listeners) l(); }
  private set(id: string, p: Partial<ModelState>) { const s = this.states.get(id); if (!s) return; Object.assign(s, p); this.rebuild(); }

  /** Read completion markers from storage (call once at startup and after external changes). */
  async refresh(): Promise<void> {
    const markers = new Map((await this.d.cache.store.listMarkers()).map((m) => [m.id, m]));
    for (const m of MODEL_CATALOG) {
      const s = this.states.get(m.id)!;
      if (s.status === 'downloading' || s.status === 'queued') continue;
      const mk = markers.get(m.id);
      if (!isDownloadable(m)) { this.states.set(m.id, { ...s, status: 'unavailable' }); continue; }
      this.states.set(m.id, mk ? { ...s, status: 'installed', progress: 1, installedBytes: mk.bytes, backend: mk.backend as Backend, error: undefined } : { ...s, status: 'not-installed', progress: 0, installedBytes: undefined });
    }
    this.rebuild();
  }

  /**
   * Download a model. `acceptedLicence` must be true: it is passed only by the UI's explicit "Download" action after the licence, size and source were shown.
   * Resolves when installed; rejects with ConsentRequiredError / AbortError / Error. Downloads run one at a time.
   */
  download(id: string, opts: { acceptedLicence?: boolean; backend?: Backend } = {}): Promise<void> {
    const m = modelById(id);
    if (!m) return Promise.reject(new Error(`Unknown model "${id}"`));
    if (!isDownloadable(m)) return Promise.reject(new Error(m.disabledReason ?? `"${m.name}" is not available (licence ${m.licence.status}).`));
    const cur = this.states.get(id)!;
    if (cur.status === 'installed') return Promise.resolve();
    if (cur.status === 'queued' || cur.status === 'downloading') return Promise.reject(new Error('Already downloading'));
    if (opts.acceptedLicence) this.d.consent.grant(m, this.d.now?.());
    else if (!this.d.consent.has(m)) return Promise.reject(new ConsentRequiredError(id));
    const ac = new AbortController(); this.controllers.set(id, ac);
    this.set(id, { status: 'queued', progress: 0, loadedBytes: 0, totalBytes: 0, error: undefined });
    const run = this.chain.then(() => this.runDownload(m, ac, opts.backend));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async runDownload(m: ModelEntry, ac: AbortController, preferred?: Backend): Promise<void> {
    const id = m.id;
    try {
      if (ac.signal.aborted) throw new DownloadCancelled();
      const caps = await this.d.capabilities();
      const backend = pickBackend(caps, preferred);
      if (!backend) throw new Error('This browser cannot run local AI models (no WebAssembly or WebGPU).');
      const need = estimateBytes(m, backend);
      const q = checkQuota(need, caps.storage);
      if (!q.ok) throw new Error(q.message);
      this.set(id, { status: 'downloading', totalBytes: need, backend });
      await this.d.loader.prepare(m, backend, {
        signal: ac.signal,
        onProgress: (loaded, total) => { const t = total > 0 ? total : need; this.set(id, { loadedBytes: loaded, totalBytes: t, progress: Math.min(1, t ? loaded / t : 0) }); },
      });
      if (ac.signal.aborted) throw new DownloadCancelled();
      const usage = (await this.d.cache.usageByRepo())[m.repo];
      const bytes = usage?.bytes ?? 0;
      await this.d.cache.store.setMarker({ id, repo: m.repo, backend, bytes, at: this.d.now?.() ?? Date.now() });
      this.set(id, { status: 'installed', progress: 1, installedBytes: bytes, backend });
    } catch (e) {
      const cancelled = ac.signal.aborted || (e as Error)?.name === 'AbortError';
      await this.d.cache.deleteRepo(m.repo).catch(() => 0); // no partial model left behind
      this.set(id, cancelled ? { status: 'not-installed', progress: 0, loadedBytes: 0, error: undefined } : { status: 'error', error: (e as Error)?.message ?? String(e) });
      throw cancelled ? new DownloadCancelled() : e;
    } finally {
      this.controllers.delete(id);
    }
  }

  /** Cancel a queued or running download. */
  cancel(id: string): void { this.controllers.get(id)?.abort(); }

  /** Remove the model's cached files, its install marker and the stored consent. */
  async remove(id: string): Promise<void> {
    const m = modelById(id); if (!m) return;
    this.cancel(id);
    await this.d.cache.deleteRepo(m.repo);
    await this.d.cache.store.deleteMarker(id);
    this.d.consent.revoke(id);
    this.set(id, { status: isDownloadable(m) ? 'not-installed' : 'unavailable', progress: 0, loadedBytes: 0, installedBytes: undefined, error: undefined });
  }

  /** Throw ConsentRequiredError unless the model is installed (features call this instead of downloading implicitly). */
  requireInstalled(id: string): void { if (!this.isInstalled(id)) throw new ConsentRequiredError(id); }
}
