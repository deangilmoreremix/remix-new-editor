// [remix] Port I1: main-thread client for local-ai.worker.js. One lazily created worker; requests are matched by id; aborting a request terminates the worker
// (the only way to stop a running ONNX inference or a model load), and the next request creates a fresh one. Injectable `createWorker` for tests.
import type { Backend } from './catalog';
import type { ModelEntry } from './catalog';
import type { DownloadHooks, ModelLoader } from './manager';
import type { WorkerModelRef, WorkerRequest, WorkerResponse } from './worker-protocol';

export interface WorkerLike { postMessage(m: unknown, t?: Transferable[]): void; terminate(): void; onmessage: ((e: MessageEvent<WorkerResponse>) => void) | null; onerror: ((e: ErrorEvent) => void) | null }
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export const abortError = (msg = 'Cancelled'): Error => Object.assign(new Error(msg), { name: 'AbortError' });

export const refOf = (m: ModelEntry, backend: Backend): WorkerModelRef => ({ id: m.id, kind: m.kind, repo: m.repo, backend });

export class LocalAiClient implements ModelLoader {
  private worker: WorkerLike | null = null;
  private seq = 0;
  private pending = new Map<number, { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void; onProgress?: (l: number, t: number) => void }>();
  constructor(private createWorker: () => WorkerLike = () => new Worker(new URL('./local-ai.worker.js', import.meta.url), { type: 'module' }) as unknown as WorkerLike) {}

  private ensure(): WorkerLike {
    if (this.worker) return this.worker;
    const w = this.createWorker();
    w.onmessage = ({ data }) => {
      const p = this.pending.get(data.id); if (!p) return;
      if (data.type === 'progress') { p.onProgress?.(data.loaded, data.total); return; }
      this.pending.delete(data.id);
      if (data.type === 'error') p.reject(new Error(data.message)); else p.resolve(data);
    };
    w.onerror = (e) => this.killAll(new Error(e.message || 'The local AI worker failed.'));
    this.worker = w;
    return w;
  }
  private killAll(err: Error) { const p = [...this.pending.values()]; this.pending.clear(); this.worker?.terminate(); this.worker = null; for (const x of p) x.reject(err); }
  dispose() { this.killAll(abortError('Local AI worker stopped')); }

  request<T extends WorkerResponse>(req: DistOmit<WorkerRequest, 'id'>, opts: { signal?: AbortSignal; onProgress?: (l: number, t: number) => void; transfer?: Transferable[] } = {}): Promise<T> {
    if (opts.signal?.aborted) return Promise.reject(abortError());
    const w = this.ensure(); const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => { this.killAll(abortError()); };
      opts.signal?.addEventListener('abort', onAbort, { once: true });
      const clean = () => opts.signal?.removeEventListener('abort', onAbort);
      this.pending.set(id, { resolve: (r) => { clean(); resolve(r as T); }, reject: (e) => { clean(); reject(e); }, onProgress: opts.onProgress });
      w.postMessage({ ...req, id }, opts.transfer);
    });
  }

  async prepare(model: ModelEntry, backend: Backend, hooks: DownloadHooks): Promise<void> {
    await this.request({ type: 'prepare', model: refOf(model, backend) }, { signal: hooks.signal, onProgress: hooks.onProgress });
  }
}
