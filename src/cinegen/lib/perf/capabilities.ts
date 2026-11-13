// [remix] Stage 4: browser capability report, in one place. Every probe takes the global object as a parameter so it can be tested with
// mocked globals; the UI (components/edit/stage4/media-health.tsx) calls detectCapabilities() with the real window.
export type CapStatus = 'yes' | 'no' | 'partial';
export interface Capability { id: string; label: string; status: CapStatus; detail: string; needed: string }

type G = Record<string, any>;

const has = (g: G, name: string) => typeof g[name] !== 'undefined';

function webgl2(g: G): { ok: boolean; detail: string } {
  try {
    const doc = g.document as Document | undefined;
    if (!doc) return { ok: has(g, 'WebGL2RenderingContext'), detail: has(g, 'WebGL2RenderingContext') ? 'constructor present (no document to test a context)' : 'WebGL2RenderingContext missing' };
    const c = doc.createElement('canvas');
    const ctx = c.getContext('webgl2');
    return ctx ? { ok: true, detail: 'context created' } : { ok: false, detail: 'getContext("webgl2") returned null (disabled or blocked GPU)' };
  } catch (e) { return { ok: false, detail: `probe failed: ${e instanceof Error ? e.message : String(e)}` }; }
}

async function opfs(g: G): Promise<{ ok: boolean; detail: string }> {
  const dir = g.navigator?.storage?.getDirectory;
  if (typeof dir !== 'function') return { ok: false, detail: 'navigator.storage.getDirectory missing' };
  try { await g.navigator.storage.getDirectory(); return { ok: true, detail: 'origin private file system available' }; } catch (e) { return { ok: false, detail: `getDirectory() rejected: ${e instanceof Error ? e.message : String(e)}` }; }
}

async function mediaCaps(g: G): Promise<{ status: CapStatus; detail: string }> {
  const mc = g.navigator?.mediaCapabilities;
  if (!mc?.decodingInfo) return { status: 'no', detail: 'navigator.mediaCapabilities missing' };
  const probes: Array<[string, { type: 'file'; video: { contentType: string; width: number; height: number; bitrate: number; framerate: number } }]> = [
    ['H.264 1080p30', { type: 'file', video: { contentType: 'video/mp4; codecs="avc1.640028"', width: 1920, height: 1080, bitrate: 8_000_000, framerate: 30 } }],
    ['VP9 1080p30', { type: 'file', video: { contentType: 'video/webm; codecs="vp09.00.40.08"', width: 1920, height: 1080, bitrate: 6_000_000, framerate: 30 } }],
    ['H.264 4K30', { type: 'file', video: { contentType: 'video/mp4; codecs="avc1.640033"', width: 3840, height: 2160, bitrate: 30_000_000, framerate: 30 } }],
  ];
  const parts: string[] = []; let smooth = 0; let ok = 0;
  for (const [label, cfg] of probes) {
    try {
      const r = await mc.decodingInfo(cfg);
      if (r.supported) ok++;
      if (r.smooth) smooth++;
      parts.push(`${label}: ${r.supported ? (r.smooth ? 'smooth' : 'supported, may stutter') : 'unsupported'}${r.powerEfficient ? ', hardware' : ''}`);
    } catch { parts.push(`${label}: probe failed`); }
  }
  return { status: ok === 0 ? 'no' : smooth === probes.length ? 'yes' : 'partial', detail: parts.join('; ') };
}

export async function detectCapabilities(g: G = globalThis as G): Promise<Capability[]> {
  const out: Capability[] = [];
  const add = (id: string, label: string, status: CapStatus, detail: string, needed: string) => out.push({ id, label, status, detail, needed });

  const wc = has(g, 'VideoDecoder') && has(g, 'VideoEncoder');
  const wcPartial = has(g, 'VideoDecoder') || has(g, 'VideoEncoder');
  add('webcodecs', 'WebCodecs', wc ? 'yes' : wcPartial ? 'partial' : 'no', wc ? 'VideoDecoder + VideoEncoder present' : wcPartial ? 'only one of VideoDecoder / VideoEncoder present' : 'VideoDecoder / VideoEncoder missing', 'In-browser export, proxies (mediabunny), trimming');

  const gl = webgl2(g);
  add('webgl2', 'WebGL2', gl.ok ? 'yes' : 'no', gl.detail, 'Effects, LUTs and GL transitions');

  const o = await opfs(g);
  add('opfs', 'Origin private file system (OPFS)', o.ok ? 'yes' : 'no', o.detail, 'Large local caches (optional here: thumbnails use IndexedDB)');

  const wl = has(g, 'AudioWorkletNode') || (has(g, 'AudioContext') && !!g.AudioContext?.prototype && 'audioWorklet' in g.AudioContext.prototype);
  add('audioworklet', 'AudioWorklet', wl ? 'yes' : 'no', wl ? 'AudioWorklet available' : 'AudioWorklet missing', 'Low-latency audio processing (not required by the current preview)');

  const ac = has(g, 'AudioContext') || has(g, 'webkitAudioContext');
  const oac = has(g, 'OfflineAudioContext');
  add('webaudio', 'Web Audio (live + offline)', ac && oac ? 'yes' : ac || oac ? 'partial' : 'no', `AudioContext ${ac ? 'yes' : 'no'}, OfflineAudioContext ${oac ? 'yes' : 'no'}`, 'Volume, EQ, meters, EQ bake for export');

  const idb = has(g, 'indexedDB') && !!g.indexedDB;
  add('indexeddb', 'IndexedDB', idb ? 'yes' : 'no', idb ? 'available' : 'missing (thumbnail cache falls back to memory)', 'Thumbnail and scene cache');

  const worker = has(g, 'Worker');
  const offscreen = has(g, 'OffscreenCanvas');
  add('workers', 'Workers + OffscreenCanvas', worker && offscreen ? 'yes' : worker ? 'partial' : 'no', `Worker ${worker ? 'yes' : 'no'}, OffscreenCanvas ${offscreen ? 'yes' : 'no'}`, 'Background analysis');

  const sab = has(g, 'SharedArrayBuffer') && g.crossOriginIsolated === true;
  add('isolation', 'Cross-origin isolation (SharedArrayBuffer)', sab ? 'yes' : 'no', sab ? 'crossOriginIsolated' : 'not isolated (multi-threaded ffmpeg.wasm unavailable; the editor does not need it)', 'Only for multi-threaded ffmpeg.wasm');

  const gpu = !!g.navigator?.gpu;
  add('webgpu', 'WebGPU', gpu ? 'yes' : 'no', gpu ? 'navigator.gpu present' : 'navigator.gpu missing', 'Optional (faster local AI; not used by the editor)');

  const mc = await mediaCaps(g);
  add('mediacapabilities', 'Media Capabilities (decode)', mc.status, mc.detail, 'Choosing proxy vs original playback');

  const mem = g.navigator?.deviceMemory; const cores = g.navigator?.hardwareConcurrency;
  add('hardware', 'Device', mem && mem < 4 ? 'partial' : 'yes', `${cores ?? '?'} logical cores, ${mem ? `${mem} GB memory (rounded)` : 'memory not reported'}`, 'Informs adaptive preview quality');
  return out;
}

/** One-line summary for a badge: how many essentials (WebCodecs, WebGL2, Web Audio) are missing. */
export function summarizeCapabilities(caps: readonly Capability[]): { ok: boolean; missing: string[] } {
  const essential = ['webcodecs', 'webgl2', 'webaudio'];
  const missing = caps.filter((c) => essential.includes(c.id) && c.status !== 'yes').map((c) => c.label);
  return { ok: missing.length === 0, missing };
}
