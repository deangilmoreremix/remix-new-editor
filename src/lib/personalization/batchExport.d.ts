export interface BatchItem { id: string; name: string; [key: string]: unknown }
export interface BatchResult<T = unknown> { id: string; name: string; ok: boolean; value?: T; error?: string }
export interface BatchOutcome<T = unknown> { results: BatchResult<T>[]; cancelled: boolean }
export function safeFileName(name: unknown, fallback?: string): string
export function uniqueFileName(base: string, used: Set<string>, ext?: string): string
export function runBatch<I extends BatchItem, T = unknown>(
  items: I[],
  renderOne: (item: I, ctx: { index: number; total: number; signal?: AbortSignal; onProgress: (p: number) => void }) => Promise<T>,
  opts?: {
    signal?: AbortSignal
    onProgress?: (overall: number, info: { index: number; total: number; item: I; stage: string }) => void
    onItem?: (result: BatchResult<T>, index: number) => void | Promise<void>
  },
): Promise<BatchOutcome<T>>
export function summarizeBatch(outcome: BatchOutcome, opts?: { noun?: string }): string
