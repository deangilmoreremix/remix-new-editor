// [remix] Stage 4: scene browser. Detect scenes of a media-pool video (histogram cuts, cancellable), browse thumbnails, search name / tags / time,
// edit name and tags, step frames in a scene, and put a scene on the timeline. Scenes and thumbnails are cached in IndexedDB per media fingerprint.
import { indexedDbSceneVectorStore } from '@cinegen/lib/local-ai/scene-vector-store';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';
import { toFileUrl } from '@cinegen/lib/utils/file-url';
import { scanScenes, detectFps } from '@cinegen/lib/scenes/scan-video';
import { formatTime, searchScenes, stepFrame, type SceneInfo } from '@cinegen/lib/scenes/scenes';
import { addSceneToTimeline } from '@cinegen/lib/scenes/scene-timeline';
import { mediaFingerprint, sharedThumbCache } from '@cinegen/lib/perf/thumb-cache';
import { isAbort, jobs } from '@cinegen/lib/perf/jobs';
import { localAi } from '@cinegen/lib/local-ai/runtime';
import { SceneSearchIndex, CLIP_ID, CAPTION_ID, captionScene, mergeSearch, type RankedScene } from '@cinegen/lib/local-ai/scene-index';
import { S } from './ui';

interface Props { assets: Asset[]; timeline: Timeline; currentTime: number; commit: (t: Timeline) => void; seek: (t: number) => void }
const fp = (a: Asset) => mediaFingerprint({ name: a.name, size: a.fileSize, duration: a.duration });

export function ScenesPanel({ assets, timeline, currentTime, commit }: Props) {
  const videos = useMemo(() => assets.filter((a) => a.type === 'video'), [assets]);
  const [assetId, setAssetId] = useState(videos[0]?.id ?? '');
  const asset = videos.find((a) => a.id === assetId) ?? null;
  const [scenes, setScenes] = useState<SceneInfo[]>([]);
  const [query, setQuery] = useState('');
  const [threshold, setThreshold] = useState(0.25);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState('');
  const [sel, setSel] = useState<SceneInfo | null>(null);
  const [frameT, setFrameT] = useState(0);
  const [realFps, setRealFps] = useState<number | null>(null);
  const vref = useRef<HTMLVideoElement>(null);
  // [remix] Port I1: semantic (CLIP) search + optional captions, both from locally downloaded models (Media tools > Local AI)
  const ai = useMemo(() => localAi(), []);
  const index = useMemo(() => new SceneSearchIndex(ai.manager, ai.client, indexedDbSceneVectorStore()), [ai]);
  const aiStates = useSyncExternalStore(ai.manager.subscribe.bind(ai.manager), ai.manager.getSnapshot);
  const clipReady = aiStates.find((x) => x.id === CLIP_ID)?.status === 'installed';
  const capReady = aiStates.find((x) => x.id === CAPTION_ID)?.status === 'installed';
  const [semantic, setSemantic] = useState<RankedScene[] | null>(null);
  const [aiBusy, setAiBusy] = useState<'index' | 'caption' | null>(null);
  const aiAbort = useRef<AbortController | null>(null);
  const src = asset ? toFileUrl(asset.fileRef || asset.url) : '';
  const key = asset ? `scenes:${fp(asset)}` : '';

  useEffect(() => { if (!assetId && videos[0]) setAssetId(videos[0].id); }, [videos, assetId]);
  useEffect(() => {
    setScenes([]); setSel(null); setMsg('');
    if (!key) return;
    let live = true;
    void sharedThumbCache().get(key).then((v) => { if (live && v) { try { setScenes(JSON.parse(v) as SceneInfo[]); setMsg('Loaded from the thumbnail cache.'); } catch { /* ignore a corrupt entry */ } } });
    return () => { live = false; };
  }, [key]);
  useEffect(() => { setRealFps(null); if (src) void detectFps(src).then(setRealFps); }, [src]);
  useEffect(() => { if (sel && vref.current) vref.current.currentTime = frameT; }, [frameT, sel]);

  const persist = (next: SceneInfo[]) => { setScenes(next); if (key) void sharedThumbCache().put(key, JSON.stringify(next)); };
  const detect = async () => {
    if (!asset) return;
    setBusy(true); setMsg(''); setProgress(0);
    try {
      const found = await jobs.run(`scenes:${asset.id}`, `Scenes: ${asset.name}`, (signal, p) => scanScenes(asset.id, src, { signal, threshold, assetName: asset.name, onProgress: (f) => { setProgress(f); p(f); } }));
      persist(found); setMsg(`${found.length} scene${found.length === 1 ? '' : 's'} found.`);
    } catch (e) { setMsg(isAbort(e) ? 'Cancelled.' : `Scene detection failed: ${e instanceof Error ? e.message : String(e)}`); } finally { setBusy(false); }
  };
  const isStructured = /(^|\s)(tag:|[<>]\d|\d+[:.]\d)/.test(query);
  useEffect(() => {
    setSemantic(null);
    const q = query.trim();
    if (!clipReady || !q || isStructured || index.size === 0) return;
    const ac = new AbortController();
    const t = setTimeout(() => { index.search(scenes, q, ac.signal).then(setSemantic).catch(() => undefined); }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [query, clipReady, scenes, index, isStructured, aiBusy]);
  const shown = semantic ? mergeSearch(scenes, query, semantic) : searchScenes(scenes, query);
  const runIndex = async () => {
    const ac = new AbortController(); aiAbort.current = ac; setAiBusy('index'); setMsg('Indexing scene thumbnails for visual search…');
    try { const n = await index.index(scenes, { signal: ac.signal, onProgress: (d, t) => setMsg(`Indexing scenes ${d}/${t}…`) }); setMsg(`Visual search ready (${n} new, ${index.size} total).`); }
    catch (e) { setMsg(isAbort(e) ? 'Indexing cancelled.' : `Indexing failed: ${e instanceof Error ? e.message : String(e)}`); } finally { setAiBusy(null); }
  };
  const runCaption = async () => {
    const ac = new AbortController(); aiAbort.current = ac; setAiBusy('caption');
    let next = scenes;
    try {
      for (let i = 0; i < scenes.length; i++) {
        if (scenes[i].caption || !scenes[i].thumb) continue;
        setMsg(`Captioning scene ${i + 1}/${scenes.length}…`);
        const caption = await captionScene(ai.manager, ai.client, scenes[i], ac.signal);
        next = next.map((s) => (s.id === scenes[i].id ? { ...s, caption } : s)); persist(next);
      }
      setMsg('Scene captions written (searchable).');
    } catch (e) { setMsg(isAbort(e) ? 'Captioning cancelled.' : `Captioning failed: ${e instanceof Error ? e.message : String(e)}`); } finally { setAiBusy(null); }
  };
  const fps = realFps ?? (asset?.fps && asset.fps > 0 ? asset.fps : 30);
  const update = (id: string, patch: Partial<SceneInfo>) => persist(scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const addToTimeline = (s: SceneInfo) => {
    if (!asset) return;
    const track = timeline.tracks.find((t) => t.kind === 'video' && !t.locked);
    if (!track) { setMsg('No unlocked video track to add to.'); return; }
    commit(addSceneToTimeline(timeline, track.id, asset, s, currentTime));
    setMsg(`Added “${s.name}” at ${formatTime(currentTime)}.`);
  };

  return (
    <div data-testid="scenes-panel">
      <div style={S.row}>
        <select aria-label="Video to scan" data-testid="scene-asset" style={{ ...S.input, flex: 1 }} value={assetId} onChange={(e) => setAssetId(e.target.value)}>
          {videos.length === 0 && <option value="">No videos in the media pool</option>}
          {videos.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <label style={{ fontSize: 10.5 }} title="Lower finds more cuts">sensitivity <input type="range" min={0.1} max={0.6} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} style={{ width: 60 }} /></label>
        {!busy && <button data-testid="scene-detect" style={S.btnOn} disabled={!asset} onClick={detect}>Detect scenes</button>}
        {busy && <button data-testid="scene-cancel" style={S.btn} onClick={() => jobs.cancel(`scenes:${assetId}`)}>Cancel ({Math.round(progress * 100)}%)</button>}
      </div>
      <div style={S.row}><input data-testid="scene-search" aria-label="Search scenes" placeholder="Search name, tag:word, time 0:12, >3 (seconds), or describe the picture" value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...S.input, flex: 1 }} /></div>
      {scenes.length > 0 && (
        <div style={S.row}>
          {clipReady ? <button data-testid="scene-index" style={S.btn} disabled={!!aiBusy} aria-label="Index scenes for visual search" onClick={runIndex}>{index.size >= scenes.filter((x) => x.thumb).length && index.size > 0 ? 'Re-index visual search' : 'Index for visual search'}</button>
            : <span data-testid="scene-ai-hint" style={S.small}>Visual search and captions are optional: download a model in Media tools &gt; Local AI.</span>}
          {capReady && <button data-testid="scene-caption" style={S.btn} disabled={!!aiBusy} aria-label="Caption scenes with local AI" onClick={runCaption}>Caption scenes</button>}
          {aiBusy && <button style={S.btn} aria-label="Cancel local AI task" onClick={() => aiAbort.current?.abort()}>Cancel</button>}
        </div>
      )}
      {msg && <div data-testid="scene-msg" style={S.small}>{msg}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6, marginTop: 8 }}>
        {shown.map((s) => (
          <div key={s.id} data-testid="scene-card" style={{ border: `1px solid ${sel?.id === s.id ? '#7ed321' : 'rgba(255,255,255,0.15)'}`, borderRadius: 4, padding: 4 }}>
            <div role="button" tabIndex={0} aria-label={`Inspect ${s.name}`} onClick={() => { setSel(s); setFrameT(s.startSec); }} onKeyDown={(e) => { if (e.key === 'Enter') { setSel(s); setFrameT(s.startSec); } }} style={{ cursor: 'pointer' }}>
              {s.thumb ? <img src={s.thumb} alt="" style={{ width: '100%', display: 'block', borderRadius: 2 }} /> : <div style={{ height: 52, background: 'rgba(255,255,255,0.06)' }} />}
              <div style={{ fontSize: 10, marginTop: 2 }}>{formatTime(s.startSec)} to {formatTime(s.endSec)}</div>
            </div>
            {s.caption && <div data-testid="scene-caption-text" style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>{s.caption}</div>}
            {semantic && <div style={{ fontSize: 9.5, opacity: 0.6 }}>{(semantic.find((r) => r.scene.id === s.id)?.score ?? 0) > 0 ? `match ${(semantic.find((r) => r.scene.id === s.id)!.score * 100).toFixed(0)}%` : ''}</div>}
            <input aria-label="Scene name" value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} style={{ ...S.input, width: '100%', marginTop: 2, boxSizing: 'border-box' }} />
            <input aria-label="Scene tags" placeholder="tags, comma separated" value={s.tags.join(', ')} onChange={(e) => update(s.id, { tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} style={{ ...S.input, width: '100%', marginTop: 2, boxSizing: 'border-box' }} />
            <button style={{ ...S.btn, marginTop: 3, width: '100%' }} onClick={() => addToTimeline(s)}>Add to timeline</button>
          </div>
        ))}
      </div>
      {scenes.length > 0 && shown.length === 0 && <div style={S.small}>No scene matches.</div>}
      {sel && asset && (
        <div data-testid="frame-inspector" style={{ marginTop: 8 }}>
          <div style={S.h}>Frame inspector: {sel.name}</div>
          <video ref={vref} src={src} muted preload="auto" style={{ width: '100%', maxHeight: 180, background: '#000' }} />
          <div style={S.row}>
            <button style={S.btn} aria-label="Previous frame" onClick={() => setFrameT((t) => Math.max(sel.startSec, stepFrame(t, -1, fps, asset.duration ?? sel.endSec)))}>◀ frame</button>
            <span data-testid="frame-time" style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{formatTime(frameT)} · frame {Math.round(frameT * fps)}</span>
            <button style={S.btn} aria-label="Next frame" onClick={() => setFrameT((t) => Math.min(sel.endSec - 1 / fps, stepFrame(t, 1, fps, asset.duration ?? sel.endSec)))}>frame ▶</button>
            <input type="range" min={sel.startSec} max={sel.endSec} step={1 / fps} value={frameT} onChange={(e) => setFrameT(Number(e.target.value))} style={{ flex: 1 }} aria-label="Scrub scene" />
          </div>
        </div>
      )}
    </div>
  );
}
