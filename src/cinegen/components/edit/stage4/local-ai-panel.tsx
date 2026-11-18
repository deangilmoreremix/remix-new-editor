// [remix] Port I1: "Local AI" tab of the Media tools dock. Lists every local model with its purpose, size, licence (and how it was verified), source URL and
// state; downloads need an explicit "accept licence + download" action, show progress with cancel, can be deleted, and are blocked by a storage-quota check.
// Also shows what this browser can run (WebGPU / WASM / SIMD / threads / storage).
import { useEffect, useState, useSyncExternalStore } from 'react';
import { MODEL_CATALOG, LICENCE_STATUS_LABEL, isDownloadable, estimateBytes, type ModelEntry } from '@cinegen/lib/local-ai/catalog';
import { detectCapabilities, fmtBytes, type Capabilities } from '@cinegen/lib/local-ai/capabilities';
import { localAi } from '@cinegen/lib/local-ai/runtime';
import { S } from './ui';

const link = (href: string, text: string) => <a href={href} target="_blank" rel="noreferrer" style={{ color: '#8ab4ff' }}>{text}</a>;

export function LocalAiPanel() {
  const { manager, cache } = localAi();
  const states = useSyncExternalStore(manager.subscribe.bind(manager), manager.getSnapshot);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [used, setUsed] = useState(0);
  useEffect(() => { let live = true; void detectCapabilities().then((c) => live && setCaps(c)); return () => { live = false; }; }, [states]);
  useEffect(() => { let live = true; void cache.usageByRepo().then((u) => live && setUsed(Object.values(u).reduce((a, x) => a + x.bytes, 0))); return () => { live = false; }; }, [cache, states]);
  const backend = caps?.backends[0] ?? 'wasm';
  const download = (m: ModelEntry) => {
    setAsking(null); setErrs((e) => ({ ...e, [m.id]: '' }));
    manager.download(m.id, { acceptedLicence: true }).catch((e: Error) => { if (e.name !== 'AbortError') setErrs((x) => ({ ...x, [m.id]: e.message })); });
  };
  return (
    <div data-testid="local-ai-panel">
      <div style={S.h}>Local AI (runs in this browser, nothing is uploaded)</div>
      <div style={S.small}>Models are downloaded on demand from Hugging Face after you accept their licence, cached in this browser (IndexedDB) and never bundled with the app. Used: {fmtBytes(used)}.</div>
      {caps && (
        <div data-testid="local-ai-caps" style={{ ...S.small, marginTop: 6 }}>
          <div>WebGPU: <b>{caps.hasWebGpu ? 'yes' : 'no'}</b> · WebAssembly: <b>{caps.hasWasm ? 'yes' : 'no'}</b> · SIMD: <b>{caps.hasSimd ? 'yes' : 'no'}</b> · WASM threads: <b>{caps.wasmThreads ? 'yes' : 'no (needs COOP/COEP)'}</b> · IndexedDB: <b>{caps.hasIndexedDb ? 'yes' : 'no'}</b> · OPFS: <b>{caps.hasOpfs ? 'yes' : 'no'}</b></div>
          <div>Storage: {caps.storage?.quota ? `${fmtBytes(caps.storage.usage ?? 0)} used of ${fmtBytes(caps.storage.quota)}` : 'unknown'} · Backend: <b>{backend}</b></div>
          {caps.notes.map((n) => <div key={n}>• {n}</div>)}
        </div>
      )}
      {MODEL_CATALOG.map((m) => {
        const st = states.find((s) => s.id === m.id);
        const ok = isDownloadable(m);
        const size = ok ? fmtBytes(estimateBytes(m, backend)) : '';
        return (
          <div key={m.id} data-testid={`ai-model-${m.id}`} style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: 6, marginTop: 8, opacity: ok ? 1 : 0.7 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <b style={{ fontSize: 12 }}>{m.name}</b>
              <span style={S.small}>{m.kind === 'asr' ? 'speech to text' : m.kind === 'embedding' ? 'scene search' : 'scene captions'}{size ? ` · about ${size}` : ''}</span>
              <span style={{ flex: 1 }} />
              <span data-testid={`ai-status-${m.id}`} style={S.small}>{st?.status === 'installed' ? `installed (${fmtBytes(st.installedBytes ?? 0)})` : st?.status === 'downloading' ? `downloading ${Math.round((st.progress ?? 0) * 100)}%` : st?.status === 'queued' ? 'queued' : st?.status === 'unavailable' ? 'not offered' : 'not installed'}</span>
            </div>
            <div style={S.small}>{m.purpose}</div>
            <div style={S.small}>Licence: <b>{m.licence.name}</b> ({LICENCE_STATUS_LABEL[m.licence.status]}) · {link(m.licence.url, 'licence')} · source: {link(m.sourceUrl, m.repo)}</div>
            <div style={S.small}>How checked ({m.licence.checkedOn}): {m.licence.how}</div>
            {!ok && m.disabledReason && <div style={S.err}>{m.disabledReason}</div>}
            {(st?.status === 'downloading' || st?.status === 'queued') && (
              <div style={S.row}>
                <progress value={st.progress} max={1} style={{ flex: 1 }} aria-label="Download progress" />
                <button style={S.btn} data-testid={`ai-cancel-${m.id}`} aria-label="Cancel model download" onClick={() => manager.cancel(m.id)}>Cancel</button>
              </div>
            )}
            {ok && (st?.status === 'not-installed' || st?.status === 'error') && asking !== m.id && (
              <div style={S.row}><button style={S.btnOn} data-testid={`ai-download-${m.id}`} aria-label="Download model" onClick={() => setAsking(m.id)}>Download…</button></div>
            )}
            {asking === m.id && (
              <div data-testid={`ai-consent-${m.id}`} style={{ marginTop: 6, padding: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                <div style={S.small}>This downloads about <b>{size}</b> from {link(m.sourceUrl, m.sourceUrl)} and stores it in this browser. It is licensed <b>{m.licence.name}</b>: {link(m.licence.url, 'read the licence')}. {backend === 'wasm' && m.kind === 'asr' ? 'Without WebGPU the smaller CPU (WASM) build is downloaded.' : ''}</div>
                <div style={S.row}>
                  <button style={S.btnOn} data-testid={`ai-accept-${m.id}`} aria-label="Accept licence and download" onClick={() => download(m)}>Accept licence and download</button>
                  <button style={S.btn} aria-label="Cancel consent" onClick={() => setAsking(null)}>Not now</button>
                </div>
              </div>
            )}
            {st?.status === 'installed' && <div style={S.row}><button style={S.btn} data-testid={`ai-delete-${m.id}`} aria-label="Delete model" onClick={() => void manager.remove(m.id)}>Delete model</button></div>}
            {(errs[m.id] || st?.error) && <div style={S.err} data-testid={`ai-error-${m.id}`}>{errs[m.id] || st?.error}</div>}
          </div>
        );
      })}
      <div style={{ ...S.small, marginTop: 8 }}>Disabled models are listed so you can see why FreeCut's choices were not adopted; they are never downloaded.{caps ? ` Detected: ${caps.backends.join(' > ') || 'nothing'}.` : ''}</div>
    </div>
  );
}
