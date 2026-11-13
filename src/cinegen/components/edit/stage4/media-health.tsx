// [remix] Stage 4: media health tab: browser capabilities, offline media + relink, proxies (generate / cancel), adaptive preview quality,
// running jobs with cancel, thumbnail cache.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Asset } from '@cinegen/types/project';
import type { PlaybackProxyMode } from '@cinegen/lib/editor/playback-engine';
import { toFileUrl } from '@cinegen/lib/utils/file-url';
import { detectCapabilities, summarizeCapabilities, type Capability } from '@cinegen/lib/perf/capabilities';
import { matchRelinks, probeSource } from '@cinegen/lib/perf/relink';
import { PreviewQualityMonitor } from '@cinegen/lib/perf/adaptive-quality';
import { jobs } from '@cinegen/lib/perf/jobs';
import { sharedThumbCache } from '@cinegen/lib/perf/thumb-cache';
import { S } from './ui';

interface Props {
  assets: Asset[]; isPlaying: boolean; proxyMode: PlaybackProxyMode; setProxyMode: (m: PlaybackProxyMode) => void;
  updateAsset: (a: Partial<Asset> & { id: string }) => void; projectId?: string;
}
const dot = (s: Capability['status']) => (s === 'yes' ? '#7ed321' : s === 'partial' ? '#f59e0b' : '#ef4444');

async function durationOf(file: File): Promise<number | undefined> {
  if (!/^(video|audio)\//.test(file.type)) return undefined;
  const url = URL.createObjectURL(file);
  try {
    const el = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video');
    el.preload = 'metadata';
    return await new Promise<number | undefined>((res) => { el.onloadedmetadata = () => res(el.duration); el.onerror = () => res(undefined); el.src = url; setTimeout(() => res(undefined), 4000); });
  } finally { URL.revokeObjectURL(url); }
}

export function MediaHealth({ assets, isPlaying, proxyMode, setProxyMode, updateAsset }: Props) {
  const [caps, setCaps] = useState<Capability[] | null>(null);
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');
  const [adaptive, setAdaptive] = useState(false);
  const [cache, setCache] = useState('');
  const running = useSyncExternalStore((f) => jobs.subscribe(f), () => jobs.list());
  const mon = useRef(new PreviewQualityMonitor());
  const modeRef = useRef(proxyMode); modeRef.current = proxyMode;

  useEffect(() => { void detectCapabilities().then(setCaps); }, []);
  useEffect(() => { void sharedThumbCache().stats().then((s) => setCache(`${s.count} cached thumbnails (${Math.round(s.bytes / 1024)} KB, ${s.backend})`)); }, [running.length, msg]);

  // adaptive preview quality: while playing, watch frame pacing and switch the preview to proxies when it stutters
  useEffect(() => {
    if (!adaptive || !isPlaying) return;
    let raf = 0; let last = 0;
    const tick = (now: number) => {
      if (last) mon.current.record(now - last);
      last = now;
      const advice = mon.current.advise(modeRef.current === 'on');
      if (advice === 'use-proxy') { setProxyMode('on'); setMsg('Preview was dropping frames: switched to proxy playback.'); }
      else if (advice === 'back-to-original') { setProxyMode('off'); setMsg('Preview is smooth again: back to original media.'); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [adaptive, isPlaying, setProxyMode]);

  const check = async () => {
    const ac = new AbortController(); const next: Record<string, boolean> = {};
    for (const a of assets) next[a.id] = await probeSource(toFileUrl(a.fileRef || a.url || ''), ac.signal);
    setStatus(next);
    setMsg(`${Object.values(next).filter((v) => !v).length} of ${assets.length} sources are missing.`);
  };

  const relink = async (only?: Asset) => {
    const missing = assets.filter((a) => (only ? a.id === only.id : status[a.id] === false));
    if (!missing.length) { setMsg('Nothing to relink: run "Check media" first.'); return; }
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.accept = 'video/*,audio/*,image/*';
    const files: File[] = await new Promise((res) => { input.onchange = () => res([...(input.files ?? [])]); input.addEventListener('cancel', () => res([]), { once: true }); input.click(); });
    if (!files.length) return;
    const cands = await Promise.all(files.map(async (f) => ({ name: f.name, size: f.size, lastModified: f.lastModified, type: f.type, duration: await durationOf(f) })));
    const matches = matchRelinks(missing.map((a) => ({ id: a.id, name: a.name, size: a.fileSize, duration: a.duration, originalPath: a.originalPath, type: a.type })), cands);
    for (const m of matches) {
      const url = URL.createObjectURL(files[m.fileIndex]);
      updateAsset({ id: m.assetId, fileRef: url, url, status: 'online' });
      setStatus((s) => ({ ...s, [m.assetId]: true }));
    }
    setMsg(matches.length ? `Relinked ${matches.length} of ${missing.length}: ${matches.map((m) => `${assets.find((a) => a.id === m.assetId)?.name} (${m.reasons.join(', ')})`).join('; ')}` : 'No picked file matched the missing media by name, size or duration.');
  };

  const makeProxy = (a: Asset) => {
    const input = a.fileRef || a.url;
    if (!input) return;
    void window.electronAPI.media.queueProcessing({ assetId: a.id, projectId: '', inputPath: input, needsProxy: true, includeThumbnail: false, includeWaveform: false, includeFilmstrip: false });
  };
  const sum = caps ? summarizeCapabilities(caps) : null;
  return (
    <div data-testid="media-health">
      <div style={S.h}>Browser capabilities {sum && <span style={{ fontWeight: 400, color: sum.ok ? '#7ed321' : '#f59e0b' }}>{sum.ok ? 'all essentials available' : `missing: ${sum.missing.join(', ')}`}</span>}</div>
      <div data-testid="capabilities">
        {!caps && <div style={S.small}>Checking…</div>}
        {caps?.map((c) => (
          <div key={c.id} data-testid={`cap-${c.id}`} data-status={c.status} style={{ display: 'flex', gap: 6, marginTop: 3, fontSize: 11 }} title={`Needed for: ${c.needed}`}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: dot(c.status), marginTop: 3, flex: 'none' }} />
            <span style={{ width: 150, flex: 'none' }}>{c.label}</span><span style={{ opacity: 0.7 }}>{c.detail}</span>
          </div>
        ))}
      </div>

      <div style={S.h}>Preview quality</div>
      <div style={S.row}>
        <label style={{ fontSize: 11 }}><input type="checkbox" data-testid="adaptive-quality" checked={adaptive} onChange={(e) => setAdaptive(e.target.checked)} /> Adaptive: use proxies when playback drops frames</label>
        <span style={S.small}>mode: {proxyMode === 'off' ? 'original' : proxyMode === 'on' ? 'proxy' : 'auto'}</span>
      </div>

      <div style={S.h}>Media and proxies</div>
      <div style={S.row}>
        <button data-testid="check-media" style={S.btn} onClick={check}>Check media</button>
        <button data-testid="relink-missing" style={S.btn} onClick={() => relink()}>Relink missing…</button>
      </div>
      {assets.filter((a) => a.type !== 'image').map((a) => {
        const st = status[a.id]; const proxying = running.find((j) => j.key === `proxy:${a.id}`);
        return (
          <div key={a.id} data-testid="media-row" style={{ ...S.row, marginTop: 4, fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: st === undefined ? '#777' : st ? '#7ed321' : '#ef4444', flex: 'none' }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
            {st === false && <button style={S.btn} onClick={() => relink(a)}>Relink…</button>}
            {a.type === 'video' && !proxying && <button style={S.btn} disabled={!!a.proxyRef} onClick={() => makeProxy(a)}>{a.proxyRef ? 'Has proxy' : 'Make proxy'}</button>}
            {proxying && <button style={S.btn} onClick={() => void window.electronAPI.media.cancelProcessing?.({ assetId: a.id })}>Cancel proxy {Math.round(proxying.progress * 100)}%</button>}
          </div>
        );
      })}

      <div style={S.h}>Running jobs</div>
      {running.length === 0 && <div style={S.small}>None.</div>}
      {running.map((j) => (
        <div key={j.key} data-testid="job-row" style={{ ...S.row, marginTop: 3, fontSize: 11 }}>
          <span style={{ flex: 1 }}>{j.label}</span><span>{Math.round(j.progress * 100)}%</span><button style={S.btn} onClick={() => jobs.cancel(j.key)}>Cancel</button>
        </div>
      ))}
      <div style={S.h}>Thumbnail cache</div>
      <div style={S.row}><span style={S.small}>{cache}</span><button style={S.btn} onClick={() => { void sharedThumbCache().clear().then(() => setMsg('Thumbnail cache cleared.')); }}>Clear</button></div>
      {msg && <div data-testid="health-msg" style={{ ...S.small, marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
