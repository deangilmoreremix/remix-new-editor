// Fix A preview harness (served by the vite dev server, driven by fixa-preview-smoke.cjs): mounts the REAL GlClipLayer over two real <video> elements
// with the REAL timeline (real operations, real activeGlTransition) and the same per-video style strings the playback engine writes
// (`scale(flipX, flipY) <clipPoseCss>`, object-fit, opacity). It does not run the PlaybackEngine itself.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GlClipLayer } from '@cinegen/components/edit/gl-clip-layer';
import { createDefaultTimeline, addClipToTrack, updateClipProperties } from '@cinegen/lib/editor/timeline-operations';
import { addGlTransition, activeGlTransition } from '@cinegen/lib/occ/transitions';
import { clipPoseCss } from '@cinegen/lib/editor/stage2/anim';
import type { Asset } from '@cinegen/types/project';

const asset = (id: string): Asset => ({ id, name: id, type: 'video', url: `/__fixa/${id}.webm`, duration: 6, createdAt: '2026-01-01' });
function build() {
  let tl = createDefaultTimeline('t');
  const v1 = tl.tracks.find((t) => t.name === 'V1')!.id;
  tl = addClipToTrack(tl, v1, asset('A'), 0); tl = addClipToTrack(tl, v1, asset('B'), 3);
  const [a, b] = tl.clips.filter((c) => c.trackId === v1);
  tl = { ...tl, duration: 6, clips: tl.clips.map((c) => (c.assetId === 'A' ? { ...c, duration: 6, trimEnd: 3 } : c.assetId === 'B' ? { ...c, duration: 6, trimStart: 1, trimEnd: 2 } : c)) };
  tl = updateClipProperties(tl, a.id, { anim: { keys: { x: [{ t: 0, v: 0, ease: 'linear' }, { t: 3, v: 30, ease: 'linear' }] } }, fx: [{ id: 'builtin:fx-exposure', props: { exposure: 1.5 } } as never] });
  tl = updateClipProperties(tl, b.id, { anim: { keys: { x: [{ t: 0, v: -30, ease: 'linear' }, { t: 3, v: 0, ease: 'linear' }] } } });
  tl = addGlTransition(tl, tl.clips.find((c) => c.id === a.id)!, tl.clips.find((c) => c.id === b.id)!, 'cross-dissolve', 1);
  return { tl, aId: a.id, bId: b.id };
}
const { tl, aId, bId } = build();

function Harness() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<{ t: number; legacy: boolean }>({ t: 0, legacy: false });
  (window as unknown as { __set: (s: { t: number; legacy: boolean }) => void }).__set = setState;
  const tr = activeGlTransition(tl, state.t);
  const shown = tr ? (state.legacy ? { ...tr, outClip: undefined, inClip: undefined, time: undefined } : tr) : null;
  const vid = (id: string, src: string) => <video key={id} data-clip-id={id} data-asset-id={id} src={src} muted playsInline preload="auto" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />;
  return (
    <div id="stage" style={{ position: 'relative', width: 1280, height: 720, background: '#000', overflow: 'hidden' }}>
      <div ref={setContainer} style={{ position: 'absolute', inset: 0 }}>{vid(aId, '/__fixa/A.webm')}{vid(bId, '/__fixa/B.webm')}</div>
      <GlClipLayer container={container} clip={tl.clips.find((c) => c.id === aId) ?? null} assetId="A" transition={shown} />
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);

// seek both videos to the source times of timeline time t, write the engine-style styles, then show the transition
(window as unknown as Record<string, unknown>).__show = async (t: number, legacy: boolean) => {
  const seek = (v: HTMLVideoElement, time: number) => new Promise<void>((res) => { if (Math.abs(v.currentTime - time) < 1e-3 && v.readyState >= 2) return res(); v.onseeked = () => res(); v.currentTime = time; });
  const A = tl.clips.find((c) => c.id === aId)!; const B = tl.clips.find((c) => c.id === bId)!;
  const va = document.querySelector(`video[data-clip-id="${aId}"]`) as HTMLVideoElement; const vb = document.querySelector(`video[data-clip-id="${bId}"]`) as HTMLVideoElement;
  await Promise.all([seek(va, A.trimStart + (t - A.startTime)), seek(vb, B.trimStart + (t - B.startTime))]);
  for (const [v, c] of [[va, A], [vb, B]] as const) { const pose = clipPoseCss(c, t - c.startTime); v.style.transform = `scale(1, 1)${pose.transform ? ` ${pose.transform}` : ''}`; v.style.clipPath = pose.clipPath ?? ''; v.style.objectFit = 'contain'; v.style.opacity = '1'; }
  (window as unknown as { __set: (s: { t: number; legacy: boolean }) => void }).__set({ t, legacy });
};
(window as unknown as Record<string, unknown>).__ready = true;
