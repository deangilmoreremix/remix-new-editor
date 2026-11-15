import { describe, it, expect, vi } from 'vitest';
import { AudioModelManager, ManagerError, type ManagerDeps, type ModelRuntime } from '../../lib/local-ai/audio-manager';
import { AUDIO_MODELS, blockedReason, getAudioModel, type AudioModel } from '../../lib/local-ai/models-audio';
import { audioStats, chunkText, encodeWav } from '../../lib/local-ai/wav';
import { placeGeneratedAudio } from '../../lib/local-ai/place-audio';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
function mk(over: Partial<ManagerDeps> = {}, rt?: Partial<ModelRuntime>) {
  const cache = new Set<string>();
  const loads: string[] = [];
  const deps: ManagerDeps = {
    capability: () => ({ webgpu: false, wasm: true }),
    isCached: async (m) => cache.has(m.id),
    deleteCache: async (m) => { cache.delete(m.id); },
    quota: async () => ({ usage: 0, quota: 50e9 }),
    storage: mem(),
    load: async (m, device, io) => {
      loads.push(`${m.id}:${device}`);
      io.onProgress('half', 0.5);
      await new Promise<void>((res, rej) => { const t = setTimeout(res, 5); io.signal.addEventListener('abort', () => { clearTimeout(t); rej(new Error('AbortError')); }); });
      cache.add(m.id);
      return { generate: async (req) => ({ samples: new Float32Array(2400).fill(0.2), sampleRate: 24000 }), dispose: async () => undefined, ...rt };
    },
    ...over,
  };
  return { mgr: new AudioModelManager(deps), cache, loads, deps };
}
const speak = { kind: 'tts' as const, text: 'Hello.', voice: 'af_heart', speed: 1 };

describe('model registry', () => {
  it('every model has the merge shape and MusicGen (CC-BY-NC) is disabled by default; none unverified are enabled', () => {
    for (const m of AUDIO_MODELS) { expect(m).toMatchObject({ id: expect.any(String), name: expect.any(String), purpose: expect.stringMatching(/tts|music/), sizeMB: expect.any(Number), sourceUrl: expect.stringMatching(/^https:\/\/huggingface\.co\//), loader: expect.any(Object) }); expect(m.licence.how.length).toBeGreaterThan(20); }
    const mg = getAudioModel('musicgen-small')!;
    expect(mg.licence).toMatchObject({ id: 'cc-by-nc-4.0', commercialUse: false, verified: true }); expect(mg.enabledByDefault).toBe(false);
    expect(AUDIO_MODELS.filter((m) => m.enabledByDefault && (!m.licence.verified || !m.licence.commercialUse))).toEqual([]);
  });
  it('blockedReason: unverified is always blocked; non-commercial needs the acknowledgement', () => {
    const base = getAudioModel('kokoro-82m-q8')!;
    expect(blockedReason(base, false)).toBeNull();
    const unv: AudioModel = { ...base, licence: { ...base.licence, verified: false } };
    expect(blockedReason(unv, true)).toMatch(/unverified/i);
    const nc = getAudioModel('musicgen-small')!;
    expect(blockedReason(nc, false)).toMatch(/non-commercial/i); expect(blockedReason(nc, true)).toBeNull();
  });
});

describe('consent / blocking', () => {
  it('never downloads without consent', async () => {
    const { mgr, loads } = mk();
    await expect(mgr.install('kokoro-82m-q8')).rejects.toMatchObject({ code: 'consent-required' });
    expect(loads).toEqual([]);
    await expect(mgr.generate('kokoro-82m-q8', speak).promise).rejects.toMatchObject({ code: 'consent-required' });
    expect(loads).toEqual([]);
  });
  it('MusicGen cannot be consented without the non-commercial acknowledgement, and then installs', async () => {
    const { mgr, loads } = mk();
    expect(() => mgr.grantConsent('musicgen-small')).toThrow(ManagerError);
    await expect(mgr.install('musicgen-small')).rejects.toMatchObject({ code: 'blocked' });
    mgr.grantConsent('musicgen-small', { nonCommercialAck: true });
    await mgr.install('musicgen-small'); expect(loads).toEqual(['musicgen-small:wasm']);
  });
  it('consent persists in storage across managers and can be revoked', () => {
    const storage = mem();
    const a = mk({ storage }).mgr; a.grantConsent('kokoro-82m-q8');
    const b = mk({ storage }).mgr; expect(b.getState('kokoro-82m-q8').consent).toBe(true);
    b.revokeConsent('kokoro-82m-q8'); expect(mk({ storage }).mgr.getState('kokoro-82m-q8').consent).toBe(false);
  });
  it('an unverified licence blocks even with consent', async () => {
    const reg = AUDIO_MODELS as AudioModel[]; const m = reg.find((x) => x.id === 'kokoro-82m-q8')!; const orig = m.licence;
    try { m.licence = { ...orig, verified: false }; const { mgr } = mk(); expect(() => mgr.grantConsent(m.id)).toThrow(/unverified/i); }
    finally { m.licence = orig; }
  });
});

describe('capability and quota', () => {
  it('refuses without WebGPU and WASM; picks WebGPU when present else WASM', async () => {
    const a = mk({ capability: () => ({ webgpu: false, wasm: false }) }); a.mgr.grantConsent('kokoro-82m-q8');
    await expect(a.mgr.install('kokoro-82m-q8')).rejects.toMatchObject({ code: 'unsupported' });
    const b = mk({ capability: () => ({ webgpu: true, wasm: true }) }); b.mgr.grantConsent('kokoro-82m-q8'); await b.mgr.install('kokoro-82m-q8');
    expect(b.loads).toEqual(['kokoro-82m-q8:webgpu']);
  });
  it('retries on WASM when the WebGPU load fails, but not when cancelled', async () => {
    const devices: string[] = [];
    const { mgr } = mk({ capability: async () => ({ webgpu: true, wasm: true }), load: async (_m, d) => { devices.push(d); if (d === 'webgpu') throw new Error('no GPU adapter'); return { generate: async () => ({ samples: new Float32Array(4).fill(1), sampleRate: 1 }), dispose: async () => undefined }; } });
    mgr.grantConsent('kokoro-82m-q8'); await mgr.install('kokoro-82m-q8');
    expect(devices).toEqual(['webgpu', 'wasm']); expect(mgr.getState('kokoro-82m-q8')).toMatchObject({ status: 'ready', device: 'wasm' });
  });
  it('refuses when free storage is below size x headroom, before downloading; a cached model skips the check', async () => {
    const { mgr, loads, cache } = mk({ quota: async () => ({ usage: 900e6, quota: 1000e6 }) });
    mgr.grantConsent('kokoro-82m-fp32');
    await expect(mgr.install('kokoro-82m-fp32')).rejects.toMatchObject({ code: 'insufficient-storage' });
    expect(loads).toEqual([]); expect(mgr.getState('kokoro-82m-fp32').status).toBe('error');
    cache.add('kokoro-82m-fp32'); await mgr.refresh(); await mgr.install('kokoro-82m-fp32'); expect(loads).toHaveLength(1);
  });
});

describe('progress, cancel, delete', () => {
  it('reports progress and ends ready/cached', async () => {
    const { mgr } = mk(); mgr.grantConsent('kokoro-82m-q8'); const seen: number[] = []; mgr.subscribe(() => seen.push(mgr.getState('kokoro-82m-q8').progress));
    await mgr.install('kokoro-82m-q8');
    expect(seen).toContain(0.5); expect(mgr.getState('kokoro-82m-q8')).toMatchObject({ status: 'ready', cached: true, progress: 1 });
  });
  it('cancel aborts the download, removes partial cache, returns to absent', async () => {
    const del = vi.fn(async () => undefined);
    const { mgr } = mk({ deleteCache: del, load: async (_m, _d, io) => { await new Promise((_, rej) => io.signal.addEventListener('abort', () => rej(new Error('aborted')))); throw new Error('unreachable'); } });
    mgr.grantConsent('kokoro-82m-q8'); const p = mgr.install('kokoro-82m-q8'); await new Promise((r) => setTimeout(r, 5));
    expect(mgr.getState('kokoro-82m-q8').status).toBe('downloading'); expect(mgr.cancelInstall('kokoro-82m-q8')).toBe(true);
    await expect(p).rejects.toMatchObject({ code: 'cancelled' });
    expect(del).toHaveBeenCalled(); expect(mgr.getState('kokoro-82m-q8')).toMatchObject({ status: 'absent', cached: false });
  });
  it('a failed load surfaces the message and is retryable', async () => {
    let n = 0; const { mgr } = mk({ load: async () => { if (n++ === 0) throw new Error('network down'); return { generate: async () => ({ samples: new Float32Array(10), sampleRate: 1 }), dispose: async () => undefined }; } });
    mgr.grantConsent('kokoro-82m-q8');
    await expect(mgr.install('kokoro-82m-q8')).rejects.toMatchObject({ code: 'failed', message: 'network down' });
    expect(mgr.getState('kokoro-82m-q8').error).toBe('network down');
    await mgr.install('kokoro-82m-q8'); expect(mgr.getState('kokoro-82m-q8').status).toBe('ready');
  });
  it('remove disposes the runtime and deletes the cache', async () => {
    const dispose = vi.fn(async () => undefined); const { mgr, cache } = mk({}, { dispose });
    mgr.grantConsent('kokoro-82m-q8'); await mgr.install('kokoro-82m-q8'); expect(cache.has('kokoro-82m-q8')).toBe(true);
    await mgr.remove('kokoro-82m-q8'); expect(dispose).toHaveBeenCalled(); expect(cache.size).toBe(0); expect(mgr.getState('kokoro-82m-q8')).toMatchObject({ status: 'absent', cached: false });
  });
  it('install is idempotent while running (one load)', async () => {
    const { mgr, loads } = mk(); mgr.grantConsent('kokoro-82m-q8'); await Promise.all([mgr.install('kokoro-82m-q8'), mgr.install('kokoro-82m-q8')]); expect(loads).toHaveLength(1);
  });
});

describe('generation queue', () => {
  it('runs jobs one at a time in order and installs on first use when consented', async () => {
    let active = 0, maxActive = 0; const order: string[] = [];
    const { mgr } = mk({}, { generate: async (req) => { active++; maxActive = Math.max(maxActive, active); order.push((req as { text: string }).text); await new Promise((r) => setTimeout(r, 5)); active--; return { samples: new Float32Array(240).fill(0.3), sampleRate: 24000 }; } });
    mgr.grantConsent('kokoro-82m-q8');
    const jobs = ['a', 'b', 'c'].map((t) => mgr.generate('kokoro-82m-q8', { ...speak, text: t }).promise);
    const out = await Promise.all(jobs);
    expect(order).toEqual(['a', 'b', 'c']); expect(maxActive).toBe(1); expect(out[0].sampleRate).toBe(24000);
  });
  it('a queued job can be cancelled without running; a running job is aborted via its signal', async () => {
    const ran: string[] = []; let sawAbort = false;
    const { mgr } = mk({}, { generate: async (req, io) => { ran.push((req as { text: string }).text); await new Promise<void>((res) => { io.signal.addEventListener('abort', () => { sawAbort = true; res(); }); setTimeout(res, 200); }); return { samples: new Float32Array(10).fill(1), sampleRate: 1 }; } });
    mgr.grantConsent('kokoro-82m-q8');
    const first = mgr.generate('kokoro-82m-q8', { ...speak, text: 'first' }); const second = mgr.generate('kokoro-82m-q8', { ...speak, text: 'second' });
    await new Promise((r) => setTimeout(r, 30));
    second.cancel(); await expect(second.promise).rejects.toMatchObject({ code: 'cancelled' });
    first.cancel(); await expect(first.promise).rejects.toMatchObject({ code: 'cancelled' });
    expect(ran).toEqual(['first']); expect(sawAbort).toBe(true);
    const third = await mgr.generate('kokoro-82m-q8', { ...speak, text: 'third' }).promise; expect(third.samples.length).toBe(10);
  });
  it('rejects music on a TTS model', async () => {
    const { mgr } = mk(); mgr.grantConsent('kokoro-82m-q8');
    await expect(mgr.generate('kokoro-82m-q8', { kind: 'music', prompt: 'x', seconds: 5 }).promise).rejects.toThrow(/cannot make music/);
    await expect(mgr.generate('nope', speak).promise).rejects.toMatchObject({ code: 'unknown-model' });
  });
});

describe('audio helpers and timeline placement', () => {
  it('encodes a valid 16-bit mono WAV with the right duration', async () => {
    const b = encodeWav(new Float32Array(24000).fill(0.5), 24000); const d = new DataView(await new Promise<ArrayBuffer>((res) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.readAsArrayBuffer(b); }));
    expect(b.size).toBe(44 + 48000); expect(String.fromCharCode(d.getUint8(0), d.getUint8(1), d.getUint8(2), d.getUint8(3))).toBe('RIFF');
    expect(d.getUint32(24, true)).toBe(24000); expect(d.getUint16(34, true)).toBe(16); expect(d.getInt16(44, true)).toBeGreaterThan(16000);
    expect(audioStats(new Float32Array([0, -0.5, 0.25])).peak).toBe(0.5);
  });
  it('chunks long text on sentence boundaries', () => {
    const c = chunkText('One two. Three four! Five? ' + 'x'.repeat(700)); expect(c[0]).toBe('One two. Three four! Five?'); expect(c.every((s) => s.length <= 280)).toBe(true); expect(chunkText('   ')).toEqual([]);
  });
  const tl = { id: 't', name: 'T', tracks: [], clips: [], duration: 0, transitions: [], markers: [] } as never;
  it('puts the audio through importBlob as an audio asset + clip at the playhead on a new audio track', async () => {
    const imp = vi.fn(async () => ({ assetId: 'asset-1', filePath: 'blob:abc' }));
    const r = await placeGeneratedAudio({ timeline: tl, audio: { samples: new Float32Array(48000).fill(0.3), sampleRate: 24000 }, name: 'Hello there', at: 3, importBlob: imp, provenance: { model: 'kokoro-82m-q8', modelName: 'K', licence: 'apache-2.0', prompt: 'Hello there', kind: 'tts', voice: 'af_heart' } });
    expect(imp.mock.calls[0][0].blob.type).toBe('audio/wav'); expect(imp.mock.calls[0][0].name).toBe('Hello there.wav');
    expect(r.asset).toMatchObject({ id: 'asset-1', type: 'audio', url: 'blob:abc', fileRef: 'blob:abc', duration: 2 });
    expect(r.asset.metadata).toMatchObject({ source: 'local-ai', licence: 'apache-2.0' });
    const tr = r.timeline.tracks.find((t) => t.kind === 'audio')!; const c = r.timeline.clips[0];
    expect(c).toMatchObject({ assetId: 'asset-1', trackId: tr.id, startTime: 3, duration: 2 }); expect(r.timeline.duration).toBeGreaterThanOrEqual(5);
  });
  it('refuses silent output and never imports it', async () => {
    const imp = vi.fn();
    await expect(placeGeneratedAudio({ timeline: tl, audio: { samples: new Float32Array(100), sampleRate: 24000 }, name: 'x', at: 0, importBlob: imp as never, provenance: { model: 'm', modelName: 'm', licence: 'l', prompt: 'p', kind: 'tts' } })).rejects.toThrow(/silence/);
    expect(imp).not.toHaveBeenCalled();
  });
});
