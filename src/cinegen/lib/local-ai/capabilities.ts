// [remix] Port I1: what this browser can run. Pure over an injectable environment so it is unit-testable; `detectCapabilities()` probes the real one.
import type { Backend } from './catalog';

export interface EnvProbe {
  hasWebGpu: boolean;
  /** WebAssembly present */
  hasWasm: boolean;
  /** WASM SIMD validates (onnxruntime-web picks the simd build) */
  hasSimd: boolean;
  /** SharedArrayBuffer usable => requires crossOriginIsolated (COOP + COEP headers) */
  crossOriginIsolated: boolean;
  hasSharedArrayBuffer: boolean;
  hasIndexedDb: boolean;
  hasOpfs: boolean;
  hardwareConcurrency: number;
  storage?: { quota?: number; usage?: number };
}

export interface Capabilities extends EnvProbe {
  /** onnxruntime-web WASM threads: only with cross-origin isolation. This app sets no COOP/COEP, so this is normally false and inference is single-threaded. */
  wasmThreads: boolean;
  /** backends in order of preference */
  backends: Backend[];
  notes: string[];
}

// smallest module using an i32x4 SIMD op; WebAssembly.validate tells us if the engine supports SIMD
const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

export async function probeEnvironment(g: typeof globalThis = globalThis): Promise<EnvProbe> {
  const nav = (g as { navigator?: Navigator & { gpu?: { requestAdapter?: () => Promise<unknown> } } }).navigator;
  let hasWebGpu = false;
  try { hasWebGpu = !!(nav?.gpu && await nav.gpu.requestAdapter?.()); } catch { hasWebGpu = false; }
  const wa = (g as { WebAssembly?: typeof WebAssembly }).WebAssembly;
  let hasSimd = false;
  try { hasSimd = !!wa && wa.validate(SIMD_PROBE); } catch { hasSimd = false; }
  let storage: EnvProbe['storage'];
  try { storage = await nav?.storage?.estimate?.(); } catch { storage = undefined; }
  return {
    hasWebGpu, hasWasm: !!wa, hasSimd,
    crossOriginIsolated: !!(g as { crossOriginIsolated?: boolean }).crossOriginIsolated,
    hasSharedArrayBuffer: typeof (g as { SharedArrayBuffer?: unknown }).SharedArrayBuffer !== 'undefined',
    hasIndexedDb: typeof (g as { indexedDB?: unknown }).indexedDB !== 'undefined',
    hasOpfs: typeof nav?.storage?.getDirectory === 'function',
    hardwareConcurrency: nav?.hardwareConcurrency ?? 1,
    storage,
  };
}

export function describeCapabilities(p: EnvProbe): Capabilities {
  const wasmThreads = p.crossOriginIsolated && p.hasSharedArrayBuffer && p.hasWasm;
  const backends: Backend[] = [];
  if (p.hasWebGpu) backends.push('webgpu');
  if (p.hasWasm) backends.push('wasm');
  const notes: string[] = [];
  if (!p.hasWasm) notes.push('WebAssembly is unavailable: local AI cannot run in this browser.');
  if (!p.hasWebGpu) notes.push('No WebGPU adapter: models run on WebAssembly (CPU), which is slower but works everywhere.');
  if (p.hasWasm && !p.hasSimd) notes.push('WebAssembly SIMD is unavailable: inference will be much slower.');
  if (!wasmThreads) notes.push('Multi-threaded WebAssembly needs cross-origin isolation (COOP + COEP headers), which this app does not set. Local AI runs single-threaded on WASM; WebGPU is unaffected.');
  if (!p.hasIndexedDb) notes.push('IndexedDB is unavailable: downloaded models cannot be cached and would be re-downloaded every time.');
  return { ...p, wasmThreads, backends, notes };
}

export async function detectCapabilities(): Promise<Capabilities> { return describeCapabilities(await probeEnvironment()); }

export function pickBackend(c: Pick<Capabilities, 'backends'>, prefer?: Backend): Backend | null {
  if (prefer && c.backends.includes(prefer)) return prefer;
  return c.backends[0] ?? null;
}

export interface QuotaCheck { ok: boolean; needBytes: number; freeBytes: number | null; message?: string }
/** Storage-quota check before a download. Unknown quota => allowed (the browser may still refuse). Requires 10% headroom over the model size. */
export function checkQuota(needBytes: number, storage?: { quota?: number; usage?: number }): QuotaCheck {
  if (!storage || !Number.isFinite(storage.quota)) return { ok: true, needBytes, freeBytes: null };
  const free = Math.max(0, (storage.quota ?? 0) - (storage.usage ?? 0));
  const ok = free >= needBytes * 1.1;
  return { ok, needBytes, freeBytes: free, message: ok ? undefined : `Not enough browser storage: ${fmtBytes(needBytes)} needed, about ${fmtBytes(free)} free.` };
}

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 MB';
  return n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1024 ** 2))} MB`;
}
