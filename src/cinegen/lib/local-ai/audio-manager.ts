// [remix] Port I2: on-demand model manager for local audio generation. Pure logic (no browser APIs): everything environment-specific
// (capability check, Cache Storage, storage quota, the actual pipelines) is injected through `ManagerDeps`, so it is unit-tested with
// mocks. Guarantees: nothing is downloaded without recorded consent; non-commercial / unverified models stay blocked until the
// user opts in (unverified: never); the download can be cancelled (abort signal) and its partial cache removed; one generation runs
// at a time (queue) and a queued job can be cancelled; installed models can be deleted.
import { AUDIO_MODELS, type AudioModel, blockedReason, getAudioModel } from './models-audio';

export type ModelStatus = 'absent' | 'downloading' | 'ready' | 'error';
export type Device = 'webgpu' | 'wasm';
export interface ModelState { status: ModelStatus; progress: number; message: string; error?: string; cached: boolean; consent: boolean; optedIn: boolean; device?: Device }

export type GenerateRequest =
  | { kind: 'tts'; text: string; voice: string; speed: number }
  | { kind: 'music'; prompt: string; seconds: number };
export interface RawAudio { samples: Float32Array; sampleRate: number }
export interface GenerateIo { signal: AbortSignal; onProgress: (message: string, fraction?: number) => void }
export interface ModelRuntime { generate(req: GenerateRequest, io: GenerateIo): Promise<RawAudio>; dispose(): Promise<void> }

export interface ManagerDeps {
  capability(): { webgpu: boolean; wasm: boolean };
  isCached(m: AudioModel): Promise<boolean>;
  deleteCache(m: AudioModel): Promise<void>;
  /** bytes used / available in this origin's storage, or null when the browser cannot say */
  quota(): Promise<{ usage: number; quota: number } | null>;
  load(m: AudioModel, device: Device, io: { signal: AbortSignal; onProgress: (message: string, fraction: number) => void }): Promise<ModelRuntime>;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}

export type ErrorCode = 'unknown-model' | 'consent-required' | 'blocked' | 'unsupported' | 'insufficient-storage' | 'cancelled' | 'failed';
export class ManagerError extends Error { constructor(public code: ErrorCode, message: string) { super(message); this.name = 'ManagerError'; } }

const CONSENT_KEY = 'cinegen.localai.audio.consent.v1';
const MB = 1e6;
/** free-space headroom required on top of the download (the browser stores the file and the runtime decodes it) */
export const QUOTA_HEADROOM = 1.25;

interface Job { id: number; model: AudioModel; ctl: AbortController; run: () => Promise<void>; reject: (e: unknown) => void }

export class AudioModelManager {
  private states = new Map<string, ModelState>();
  private runtimes = new Map<string, ModelRuntime>();
  private installs = new Map<string, { ctl: AbortController; promise: Promise<void> }>();
  private listeners = new Set<() => void>();
  private queue: Job[] = [];
  private running: Job | null = null;
  private seq = 0;
  private consents: Record<string, { at: number; optedIn: boolean }> = {};

  constructor(private deps: ManagerDeps) {
    try { this.consents = JSON.parse(deps.storage?.getItem(CONSENT_KEY) ?? '{}') || {}; } catch { this.consents = {}; }
  }

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { for (const l of [...this.listeners]) l(); }
  private model(id: string): AudioModel { const m = getAudioModel(id); if (!m) throw new ManagerError('unknown-model', `Unknown model "${id}".`); return m; }
  private patch(id: string, p: Partial<ModelState>) { this.states.set(id, { ...this.getState(id), ...p }); this.emit(); }

  getState(id: string): ModelState {
    const base: ModelState = this.states.get(id) ?? { status: 'absent', progress: 0, message: '', cached: false, consent: false, optedIn: false };
    const c = this.consents[id];
    return { ...base, consent: !!c, optedIn: !!c?.optedIn };
  }

  /** Refresh `cached` from Cache Storage (call when the panel opens). */
  async refresh(): Promise<void> {
    for (const m of AUDIO_MODELS) {
      if (this.getState(m.id).status === 'downloading') continue;
      const cached = await this.deps.isCached(m).catch(() => false);
      this.patch(m.id, { cached });
    }
  }

  /** Record the user's explicit consent to download `id` (and, for non-commercial models, their acknowledgement). */
  grantConsent(id: string, opts: { nonCommercialAck?: boolean } = {}): void {
    const m = this.model(id);
    const optedIn = !!opts.nonCommercialAck;
    const why = blockedReason(m, optedIn);
    if (why) throw new ManagerError('blocked', why);
    this.consents[id] = { at: Date.now(), optedIn };
    this.saveConsents();
    this.emit();
  }
  revokeConsent(id: string): void { delete this.consents[id]; this.saveConsents(); this.emit(); }
  private saveConsents() { try { this.deps.storage?.setItem(CONSENT_KEY, JSON.stringify(this.consents)); } catch { /* not persisted: asked again next session */ } }

  /** Why `id` cannot be installed, without side effects. */
  async preflight(id: string): Promise<ManagerError | null> {
    const m = this.model(id);
    const st = this.getState(id);
    const why = blockedReason(m, st.optedIn);
    if (why) return new ManagerError('blocked', why);
    if (!st.consent) return new ManagerError('consent-required', `Download of ${m.name} (${m.sizeMB} MB) needs your consent first.`);
    const cap = this.deps.capability();
    if (!cap.webgpu && !cap.wasm) return new ManagerError('unsupported', 'This browser has neither WebGPU nor WebAssembly, so local models cannot run.');
    if (!st.cached) {
      const q = await this.deps.quota().catch(() => null);
      if (q) {
        const need = m.sizeMB * MB * QUOTA_HEADROOM; const free = q.quota - q.usage;
        if (free < need) return new ManagerError('insufficient-storage', `Not enough browser storage: ${m.name} needs about ${Math.ceil(need / MB)} MB free, ${Math.max(0, Math.floor(free / MB))} MB available. Delete other models or free disk space.`);
      }
    }
    return null;
  }

  /** Download (if needed) and load the model. Idempotent while an install is running. Rejects with ManagerError. */
  install(id: string): Promise<void> {
    const m = this.model(id);
    if (this.runtimes.has(id)) return Promise.resolve();
    const running = this.installs.get(id); if (running) return running.promise;
    const ctl = new AbortController();
    const promise = (async () => {
      try {
      const bad = await this.preflight(id);
      if (bad) { this.patch(id, { status: 'error', error: bad.message, message: bad.message }); throw bad; }
      const cap = this.deps.capability();
      const device: Device = m.loader.devices.find((d) => (d === 'webgpu' ? cap.webgpu : cap.wasm)) ?? 'wasm';
      const cached = this.getState(id).cached;
      this.patch(id, { status: 'downloading', progress: 0, error: undefined, device, message: cached ? 'Loading from cache…' : `Downloading ${m.name} (${m.sizeMB} MB)…` });
      try {
        const rt = await this.deps.load(m, device, { signal: ctl.signal, onProgress: (message, fraction) => this.patch(id, { message, progress: Math.max(0, Math.min(1, fraction)) }) });
        if (ctl.signal.aborted) { await rt.dispose().catch(() => undefined); throw new ManagerError('cancelled', 'Cancelled.'); }
        this.runtimes.set(id, rt);
        this.patch(id, { status: 'ready', progress: 1, message: 'Ready', cached: true });
      } catch (e) {
        if (ctl.signal.aborted || (e as ManagerError)?.code === 'cancelled') {
          // an aborted download leaves partial files in the cache: remove them so the displayed state is true
          await this.deps.deleteCache(m).catch(() => undefined);
          this.patch(id, { status: 'absent', progress: 0, message: 'Cancelled', error: undefined, cached: false });
          throw new ManagerError('cancelled', 'Download cancelled.');
        }
        const msg = e instanceof Error ? e.message : String(e);
        this.patch(id, { status: 'error', error: msg, message: msg });
        throw e instanceof ManagerError ? e : new ManagerError('failed', msg);
      }
      } finally { this.installs.delete(id); }
    })();
    this.installs.set(id, { ctl, promise });
    promise.catch(() => undefined);
    return promise;
  }

  /** Cancel a running download / load. */
  cancelInstall(id: string): boolean { const i = this.installs.get(id); if (!i) return false; i.ctl.abort(); return true; }

  /** Unload and delete the cached files of `id`; generations using it are cancelled. */
  async remove(id: string): Promise<void> {
    const m = this.model(id);
    this.cancelInstall(id);
    for (const j of [...this.queue, ...(this.running ? [this.running] : [])].filter((q) => q.model.id === id)) this.cancelJob(j.id);
    await this.installs.get(id)?.promise.catch(() => undefined);
    const rt = this.runtimes.get(id); this.runtimes.delete(id);
    await rt?.dispose().catch(() => undefined);
    await this.deps.deleteCache(m).catch(() => undefined);
    this.patch(id, { status: 'absent', progress: 0, message: 'Deleted', error: undefined, cached: false });
  }

  /** Queue a generation. Resolves with raw audio. `cancel()` aborts it whether it is queued or running. */
  generate(id: string, req: GenerateRequest, onProgress: (message: string, fraction?: number) => void = () => undefined): { promise: Promise<RawAudio>; cancel: () => void; jobId: number } {
    const ctl = new AbortController();
    const jobId = ++this.seq;
    const cancelled = () => new ManagerError('cancelled', 'Cancelled.');
    const promise = new Promise<RawAudio>((resolve, reject) => {
      let model: AudioModel;
      try {
        model = this.model(id);
        if (model.purpose !== (req.kind === 'tts' ? 'tts' : 'music')) throw new ManagerError('failed', `${model.name} cannot make ${req.kind === 'tts' ? 'speech' : 'music'}.`);
      } catch (e) { reject(e); return; }
      const job: Job = {
        id: jobId, model, ctl, reject,
        run: async () => {
          try {
            if (ctl.signal.aborted) throw cancelled();
            if (!this.runtimes.has(id)) { onProgress('Preparing model…'); await this.install(id); }
            const rt = this.runtimes.get(id); if (!rt) throw new ManagerError('failed', 'Model is not loaded.');
            if (ctl.signal.aborted) throw cancelled();
            const out = await rt.generate(req, { signal: ctl.signal, onProgress });
            if (ctl.signal.aborted) throw cancelled();
            resolve(out);
          } catch (e) { reject(ctl.signal.aborted ? cancelled() : e); }
        },
      };
      this.queue.push(job); this.emit(); void this.pump();
    });
    promise.catch(() => undefined);
    return { promise, jobId, cancel: () => { this.cancelJob(jobId); } };
  }

  /** Jobs waiting (not the running one). */
  get queued(): number { return this.queue.length; }
  get busy(): boolean { return !!this.running; }

  private cancelJob(jobId: number): boolean {
    const i = this.queue.findIndex((j) => j.id === jobId);
    if (i >= 0) { const [j] = this.queue.splice(i, 1); j.ctl.abort(); j.reject(new ManagerError('cancelled', 'Cancelled.')); this.emit(); return true; }
    if (this.running?.id === jobId) { this.running.ctl.abort(); this.cancelInstall(this.running.model.id); return true; }
    return false;
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    const job = this.queue.shift(); if (!job) return;
    this.running = job; this.emit();
    try { await job.run(); } finally { this.running = null; this.emit(); void this.pump(); }
  }
}
