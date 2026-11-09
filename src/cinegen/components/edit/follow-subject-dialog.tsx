// [remix] Follow-subject dialog hosting OpenChatCut's own tracker: their region picker (TrackingRegionPicker),
// analyzeMotion and motion-tracking.css. Result → zoom that follows the subject (see lib/occ/follow-zoom.ts).
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Clip } from '@cinegen/types/timeline';
import { clipEffectiveDuration } from '@cinegen/types/timeline';
import type { ZoomEffect } from '../../../openchatcut/editor/types';
import { analyzeMotion } from '../../../openchatcut/tracking/analyzeMotion';
import { TrackingRegionPicker } from '../../../openchatcut/tracking/TrackingRegionPicker';
import { TrackingError, type TrackingProgress, type TrackingRegion, type TrackingResult } from '../../../openchatcut/tracking/types';
import { followZoomFromTrack, ZOOM_BASIS_FPS } from '@cinegen/lib/occ/follow-zoom';
import '../../../openchatcut/tracking/motion-tracking.css';

const ERRORS: Record<string, string> = {
  'load-failed': 'Could not read this video.', 'seek-failed': 'Timed out reading video frames.',
  'flat-target': 'The box has too little texture — pick a target with clearer edges and detail.', 'invalid-region': 'The box is too small — draw it again.',
};

export function FollowSubjectDialog({ clip, src, width, height, onApply, onClose }: { clip: Clip; src: string; width?: number; height?: number; onApply: (zoom: ZoomEffect) => void; onClose: () => void }) {
  const [region, setRegion] = useState<TrackingRegion>({ x: 0.35, y: 0.3, width: 0.3, height: 0.4 });
  const [mag, setMag] = useState(2);
  const [minConfidence, setMinConfidence] = useState(0.68);
  const [progress, setProgress] = useState<TrackingProgress | null>(null);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const item = { id: clip.id, name: clip.name, src, srcInFrame: Math.round(clip.trimStart * ZOOM_BASIS_FPS), playbackRate: clip.speed || 1, width, height, durationInFrames: Math.round(clipEffectiveDuration(clip) * ZOOM_BASIS_FPS) };
  const percent = progress ? Math.round((progress.processedFrames * 100) / Math.max(1, progress.totalFrames)) : 0;

  const run = async () => {
    const c = new AbortController(); abort.current = c;
    setRunning(true); setResult(null); setError(''); setProgress({ processedFrames: 0, totalFrames: 1, confidence: null });
    try {
      setResult(await analyzeMotion({ src, fps: ZOOM_BASIS_FPS, srcInFrame: item.srcInFrame, durationInFrames: item.durationInFrames, playbackRate: item.playbackRate, region, minConfidence, signal: c.signal, onProgress: setProgress }));
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof TrackingError ? ERRORS[e.code] : e instanceof Error ? e.message : String(e));
    } finally { setRunning(false); }
  };
  const close = () => { abort.current?.abort(); onClose(); };

  return createPortal(
    <div className="cc-tracking-overlay" role="dialog" aria-modal="true" aria-label="Follow subject" onClick={running ? undefined : close}>
      <section className="cc-tracking-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="cc-tracking-header"><div><h2>Follow subject <em>OpenChatCut motion tracking</em></h2><p>{clip.name} · analysed on this device, nothing is uploaded</p></div><button type="button" onClick={close} aria-label="Close">×</button></header>
        <div className="cc-tracking-body">
          <main>
            <TrackingRegionPicker item={item} fps={ZOOM_BASIS_FPS} region={region} points={result?.points ?? []} disabled={running} onChange={(r) => { setRegion(r); setResult(null); }} />
            <p>Drag a box around a subject with clear detail at the start of the clip. The track shows on the picture after analysis.</p>
          </main>
          <aside>
            <label><span>Zoom amount</span><strong>{mag.toFixed(1)}×</strong><input type="range" min={1.2} max={6} step={0.1} value={mag} disabled={running} onChange={(e) => setMag(Number(e.target.value))} /></label>
            <label><span>Minimum confidence</span><strong>{minConfidence.toFixed(2)}</strong><input type="range" min={0.5} max={0.9} step={0.01} value={minConfidence} disabled={running} onChange={(e) => { setMinConfidence(Number(e.target.value)); setResult(null); }} /></label>
            <div className="cc-tracking-progress"><div><span>{running ? 'Tracking…' : result ? 'Tracking done' : 'Waiting for a box'}</span><strong>{percent}%</strong></div><i><b style={{ transform: `scaleX(${percent / 100})` }} /></i></div>
            {result && <div className={`cc-tracking-result${result.stoppedBecauseLost ? ' warning' : ''}`}><strong>{result.points.length} tracked points</strong><span>average confidence {result.averageConfidence.toFixed(2)}</span>{result.stoppedBecauseLost && <small>The subject was lost for a while; tracking stopped early.</small>}</div>}
            {error && <p className="cc-tracking-error">{error}</p>}
          </aside>
        </div>
        <footer><span /><div>
          {running ? <button type="button" onClick={() => abort.current?.abort()}>Cancel</button> : <button type="button" onClick={() => void run()}>{result ? 'Analyse again' : 'Start tracking'}</button>}
          <button type="button" className="primary" disabled={!result || result.points.length < 2} onClick={() => { onApply(followZoomFromTrack(result!.points, mag)); onClose(); }}>Apply follow zoom</button>
        </div></footer>
      </section>
    </div>, document.body);
}
