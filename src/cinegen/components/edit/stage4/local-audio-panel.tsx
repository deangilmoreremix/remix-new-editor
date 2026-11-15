// [remix] Port I2: "Local AI audio" section of the Media tools Audio tab. Generates narration (Kokoro TTS) and music (MusicGen, gated)
// entirely in the browser. Minimal stand-alone consent / progress UI: the model registry (lib/local-ai/models-audio.ts) can later be
// merged into the Local AI model manager. Nothing is downloaded until the user ticks the consent box and presses Download.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Timeline } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import { AUDIO_MODELS, blockedReason, type AudioModel } from '@cinegen/lib/local-ai/models-audio';
import { getAudioModelManager } from '@cinegen/lib/local-ai/audio-runtime';
import { ManagerError } from '@cinegen/lib/local-ai/audio-manager';
import { placeGeneratedAudio } from '@cinegen/lib/local-ai/place-audio';
import { S } from './ui';

export const KOKORO_VOICES: [string, string][] = [['af_heart', 'Heart (US, F)'], ['af_bella', 'Bella (US, F)'], ['af_nicole', 'Nicole (US, F)'], ['af_sarah', 'Sarah (US, F)'], ['af_sky', 'Sky (US, F)'], ['am_michael', 'Michael (US, M)'], ['am_fenrir', 'Fenrir (US, M)'], ['am_puck', 'Puck (US, M)'], ['bf_emma', 'Emma (UK, F)'], ['bf_isabella', 'Isabella (UK, F)'], ['bm_george', 'George (UK, M)'], ['bm_lewis', 'Lewis (UK, M)']];

interface Props { timeline: Timeline; currentTime: number; addAsset: (a: Asset) => void; commit: (t: Timeline) => void }

function ModelCard({ m }: { m: AudioModel }) {
  const mgr = getAudioModelManager();
  const st = useSyncExternalStore((cb) => mgr.subscribe(cb), () => JSON.stringify(mgr.getState(m.id)));
  const s = useMemo(() => JSON.parse(st) as ReturnType<typeof mgr.getState>, [st]);
  const [agree, setAgree] = useState(s.consent);
  const [nc, setNc] = useState(s.optedIn);
  const [err, setErr] = useState('');
  const why = blockedReason(m, nc);
  const busy = s.status === 'downloading';
  const run = async () => {
    setErr('');
    try { mgr.grantConsent(m.id, { nonCommercialAck: nc }); await mgr.install(m.id); } catch (e) { if (!(e instanceof ManagerError && e.code === 'cancelled')) setErr((e as Error).message); }
  };
  return (
    <div data-testid={`lai-model-${m.id}`} style={{ border: '1px solid rgba(255,255,255,0.14)', borderRadius: 6, padding: 6, marginTop: 6 }}>
      <div style={{ fontWeight: 600 }}>{m.name} <span style={{ fontWeight: 400, opacity: 0.7 }}>· {m.sizeMB} MB · {s.status === 'ready' ? 'installed' : s.cached ? 'downloaded' : 'not downloaded'}</span></div>
      <div style={S.small}>
        Licence: <b data-testid={`lai-licence-${m.id}`}>{m.licence.id}</b> ({m.licence.verified ? 'verified' : 'UNVERIFIED'}; {m.licence.commercialUse ? 'commercial use allowed' : 'NON-COMMERCIAL only'}) · <a href={m.licence.url} target="_blank" rel="noreferrer" style={{ color: '#9cc9ff' }}>licence</a> · <a href={m.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#9cc9ff' }}>model card</a>
      </div>
      <details><summary style={S.small}>How the licence was checked</summary><div style={S.small}>{m.licence.how}{m.licence.note ? ` ${m.licence.note}` : ''}</div></details>
      <div style={S.small}>{m.description}</div>
      {!s.cached && s.status !== 'ready' && (
        <>
          {!m.licence.commercialUse && <label style={{ ...S.small, display: 'block', marginTop: 4 }}><input data-testid={`lai-nc-${m.id}`} type="checkbox" checked={nc} onChange={(e) => setNc(e.target.checked)} disabled={busy} /> I will use this model and its output for non-commercial purposes only.</label>}
          <label style={{ ...S.small, display: 'block', marginTop: 4 }}><input data-testid={`lai-consent-${m.id}`} type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} disabled={busy} /> Download {m.sizeMB} MB from huggingface.co to this browser&apos;s storage (kept until you delete it).</label>
        </>
      )}
      <div style={S.row}>
        {!busy && s.status !== 'ready' && <button data-testid={`lai-download-${m.id}`} style={S.btn} disabled={!agree || !!why} title={why ?? ''} onClick={() => void run()}>{s.cached ? 'Load' : `Download ${m.sizeMB} MB`}</button>}
        {busy && <button data-testid={`lai-cancel-${m.id}`} style={S.btn} onClick={() => mgr.cancelInstall(m.id)}>Cancel</button>}
        {(s.cached || s.status === 'ready') && !busy && <button data-testid={`lai-delete-${m.id}`} style={S.btn} onClick={() => void mgr.remove(m.id)}>Delete downloaded files</button>}
        {s.device && s.status === 'ready' && <span style={S.small}>running on {s.device === 'webgpu' ? 'WebGPU' : 'WASM (CPU)'}</span>}
      </div>
      {busy && <div data-testid={`lai-progress-${m.id}`} data-value={s.progress.toFixed(2)}><div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 4 }}><div style={{ width: `${Math.round(s.progress * 100)}%`, height: '100%', background: '#7ed321', borderRadius: 3 }} /></div><div style={S.small}>{s.message}</div></div>}
      {(why && !s.cached) && <div style={S.small}>{why}</div>}
      {(err || s.error) && <div style={S.err}>{err || s.error}</div>}
    </div>
  );
}

export function LocalAudioPanel({ timeline, currentTime, addAsset, commit }: Props) {
  const mgr = getAudioModelManager();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'tts' | 'music'>('tts');
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('af_heart');
  const [speed, setSpeed] = useState(1);
  const [prompt, setPrompt] = useState('');
  const [secs, setSecs] = useState(8);
  const models = AUDIO_MODELS.filter((m) => m.purpose === kind);
  const [modelId, setModelId] = useState(models[0].id);
  useEffect(() => { setModelId(AUDIO_MODELS.find((m) => m.purpose === kind)!.id); }, [kind]);
  const [msg, setMsg] = useState(''); const [fail, setFail] = useState(''); const [working, setWorking] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  useEffect(() => { if (open) void mgr.refresh(); }, [open, mgr]);
  const cap = typeof navigator !== 'undefined' && 'gpu' in navigator ? 'WebGPU available' : 'No WebGPU: models run on the slower WASM (CPU) fallback';
  const model = AUDIO_MODELS.find((m) => m.id === modelId)!;
  const ready = useSyncExternalStore((cb) => mgr.subscribe(cb), () => { const s = mgr.getState(modelId); return s.consent && (s.status === 'ready' || s.cached); });
  const input = kind === 'tts' ? text.trim() : prompt.trim();

  const generate = async () => {
    setFail(''); setMsg(''); setWorking(true);
    const job = mgr.generate(modelId, kind === 'tts' ? { kind: 'tts', text, voice, speed } : { kind: 'music', prompt, seconds: secs }, (m) => setMsg(m));
    cancelRef.current = job.cancel;
    try {
      const audio = await job.promise;
      const placed = await placeGeneratedAudio({
        timeline, audio, at: currentTime, name: kind === 'tts' ? text.trim().slice(0, 40) : `Music ${prompt.trim().slice(0, 36)}`,
        provenance: { model: model.id, modelName: model.name, licence: model.licence.id, prompt: input, kind, ...(kind === 'tts' ? { voice } : {}) },
        importBlob: (a) => (window as unknown as { electronAPI: { media: { importBlob: (a: unknown) => Promise<{ assetId: string; filePath: string }> } } }).electronAPI.media.importBlob(a),
      });
      addAsset(placed.asset); commit(placed.timeline);
      setMsg(`Added “${placed.asset.name}” (${placed.seconds.toFixed(1)} s) to the timeline at ${currentTime.toFixed(1)} s.`);
    } catch (e) { setFail(e instanceof ManagerError && e.code === 'cancelled' ? 'Cancelled.' : (e as Error).message); } finally { setWorking(false); cancelRef.current = null; }
  };

  return (
    <div data-testid="local-audio-panel">
      <div style={S.h}>Local AI audio <button data-testid="lai-toggle" style={S.btn} onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Show'}</button></div>
      <div style={S.small}>Narration and music made on this computer. Models are downloaded only after you agree; nothing is sent to a server except the one-time model download. {cap}.</div>
      {open && (
        <>
          <div style={S.row}>
            {(['tts', 'music'] as const).map((k) => <button key={k} data-testid={`lai-kind-${k}`} style={kind === k ? S.btnOn : S.btn} onClick={() => setKind(k)}>{k === 'tts' ? 'Narration (text to speech)' : 'Music'}</button>)}
          </div>
          <div style={S.row}>
            <select data-testid="lai-model" aria-label="Model" style={S.input} value={modelId} onChange={(e) => setModelId(e.target.value)}>{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </div>
          <ModelCard m={model} />
          {kind === 'tts' ? (
            <>
              <textarea data-testid="lai-text" aria-label="Narration text" rows={3} placeholder="Type the narration…" value={text} onChange={(e) => setText(e.target.value)} style={{ ...S.input, width: '100%', marginTop: 6, boxSizing: 'border-box' }} />
              <div style={S.row}>
                <select data-testid="lai-voice" aria-label="Voice" style={S.input} value={voice} onChange={(e) => setVoice(e.target.value)}>{KOKORO_VOICES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
                <label style={S.small}>Speed <input type="number" min={0.5} max={1.5} step={0.1} value={speed} onChange={(e) => setSpeed(Number(e.target.value) || 1)} style={{ ...S.input, width: 48 }} aria-label="Speech speed" /></label>
              </div>
            </>
          ) : (
            <>
              <input data-testid="lai-prompt" aria-label="Music prompt" placeholder="e.g. calm lo-fi piano with soft drums" value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ ...S.input, width: '100%', marginTop: 6, boxSizing: 'border-box' }} />
              <div style={S.row}><label style={S.small}>Length <input type="number" min={model.durationSeconds?.min} max={model.durationSeconds?.max} value={secs} onChange={(e) => setSecs(Number(e.target.value) || 8)} style={{ ...S.input, width: 48 }} aria-label="Music length seconds" /> s ({model.durationSeconds?.min}–{model.durationSeconds?.max})</label></div>
            </>
          )}
          <div style={S.row}>
            {!working && <button data-testid="lai-generate" style={S.btnOn} disabled={!ready || !input} onClick={() => void generate()} title={ready ? '' : 'Download the model first'}>Generate and add at playhead</button>}
            {working && <button data-testid="lai-stop" style={S.btn} onClick={() => cancelRef.current?.()}>Cancel</button>}
          </div>
          {msg && <div data-testid="lai-msg" style={S.small}>{msg}</div>}
          {fail && <div data-testid="lai-error" style={S.err}>{fail}</div>}
        </>
      )}
    </div>
  );
}
