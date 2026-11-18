// [remix] Stage 4: cancellable long jobs. One AbortController per job key; the UI shows the running list and can cancel any of them.
export interface JobInfo { key: string; label: string; progress: number; startedAt: number }

export class JobRegistry {
  private jobs = new Map<string, { info: JobInfo; ac: AbortController }>();
  private listeners = new Set<() => void>();
  private snap: JobInfo[] = [];

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  list(): JobInfo[] { return this.snap; }
  private emit() { this.snap = [...this.jobs.values()].map((j) => ({ ...j.info })); this.listeners.forEach((f) => f()); }

  /** Start a job. A second start with the same key cancels the first. Resolves with fn's result; rejects with AbortError when cancelled. */
  async run<T>(key: string, label: string, fn: (signal: AbortSignal, progress: (fraction: number) => void) => Promise<T>): Promise<T> {
    this.cancel(key);
    const ac = new AbortController();
    const entry = { info: { key, label, progress: 0, startedAt: Date.now() }, ac };
    this.jobs.set(key, entry);
    this.emit();
    try {
      return await fn(ac.signal, (p) => { entry.info.progress = Math.min(1, Math.max(0, p)); this.emit(); });
    } finally {
      if (this.jobs.get(key) === entry) { this.jobs.delete(key); this.emit(); }
    }
  }

  cancel(key: string): boolean { const j = this.jobs.get(key); if (!j) return false; j.ac.abort(); return true; }
  cancelAll(): number { let n = 0; for (const k of [...this.jobs.keys()]) if (this.cancel(k)) n++; return n; }
}

export const jobs = new JobRegistry();
export const isAbort = (e: unknown): boolean => (e as { name?: string } | null)?.name === 'AbortError';
