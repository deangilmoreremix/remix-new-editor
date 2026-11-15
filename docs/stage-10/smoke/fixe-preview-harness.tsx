// Fix E preview harness (served by the vite dev server, driven by fixe-preview-smoke.cjs): the REAL GlClipLayer / GlGroupLayer over real <video> elements
// styled the way the playback engine styles them (transform, opacity, mix-blend-mode, z-index), with the REAL timeline operations, activeGlTransition and
// flattenCompounds. It does not run the PlaybackEngine itself. Media: solid-colour webm A, B, L served at /__fixe/.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GlClipLayer } from '@cinegen/components/edit/gl-clip-layer';
import { GlGroupLayer } from '@cinegen/components/edit/gl-group-layer';
import { createDefaultTimeline, addClipToTrack, updateClipProperties, interpolateProperty } from '@cinegen/lib/editor/timeline-operations';
import { addGlTransition, activeGlTransition } from '@cinegen/lib/occ/transitions';
import { createCompound, flattenCompounds } from '@cinegen/lib/editor/stage1';
import { clipPoseCss } from '@cinegen/lib/editor/stage2/anim';
import type { Asset } from '@cinegen/types/project';
import type { Timeline, Clip } from '@cinegen/types/timeline';

const asset = (id: string): Asset => ({ id, name: id, type: 'video', url: `/__fixe/${id}.webm`, duration: 8, createdAt: '2026-01-01' });
const T = (tl: Timeline, n: string) => tl.tracks.find((t) => t.name === n)!.id;

function win() {
  let tl = createDefaultTimeline('t');
  tl = addClipToTrack(tl, T(tl, 'V1'), asset('L'), 0); tl = addClipToTrack(tl, T(tl, 'V2'), asset('A'), 0); tl = addClipToTrack(tl, T(tl, 'V2'), asset('B'), 3);
  tl = { ...tl, duration: 6, clips: tl.clips.map((c) => (c.assetId === 'L' ? { ...c, duration: 6, trimEnd: 0 } : { ...c, duration: 8, trimStart: 2, trimEnd: 3 })) };
  const [a, b] = tl.clips.filter((c) => c.trackId === T(tl, 'V2'));
  for (const c of [a, b]) tl = updateClipProperties(tl, c.id, { opacity: 0.6, blendMode: 'screen' } as never);
  tl = addGlTransition(tl, tl.clips.find((c) => c.id === a.id)!, tl.clips.find((c) => c.id === b.id)!, 'cross-dissolve', 1);
  return tl;
}
function grp() {
  let tl = createDefaultTimeline('t');
  tl = addClipToTrack(tl, T(tl, 'V1'), asset('A'), 0); tl = addClipToTrack(tl, T(tl, 'V2'), asset('B'), 2);
  tl = { ...tl, clips: tl.clips.map((c) => ({ ...c, duration: 4, trimStart: 0, trimEnd: 0 })), duration: 6 };
  const r = createCompound(tl, tl.clips.filter((c) => [T(tl, 'V1'), T(tl, 'V2')].includes(c.trackId)).map((c) => c.id));
  return updateClipProperties(r.timeline, r.compoundId as string, { opacity: 0.5 } as never);
}
const mode = new URLSearchParams(location.search).get('mode') === 'grp' ? 'grp' : 'win';
const tl = mode === 'grp' ? grp() : win();
const play = flattenCompounds(tl);
const order = (c: Clip) => tl.tracks.findIndex((t) => t.id === c.trackId); // the engine gives V1 the lowest z-index, later tracks sit on top
const pics = play.clips.filter((c) => play.tracks.find((t) => t.id === c.trackId)?.kind === 'video');

function Harness() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [t, setT] = useState(0);
  (window as unknown as { __set: (v: number) => void }).__set = setT;
  const tr = mode === 'win' ? activeGlTransition(tl, t) : null;
  const vid = (c: Clip) => <video key={c.id} data-clip-id={c.id} data-asset-id={c.assetId} src={`/__fixe/${c.assetId}.webm`} muted playsInline preload="auto" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0 }} />;
  return (
    <div id="stage" style={{ position: 'relative', width: 1280, height: 720, background: '#000', overflow: 'hidden' }}>
      <div ref={setContainer} style={{ position: 'absolute', inset: 0 }}>{pics.map(vid)}</div>
      <GlClipLayer container={container} clip={null} assetId={null} transition={tr} />
      {mode === 'grp' && <GlGroupLayer container={container} groups={play.groups} clips={play.clips} currentTime={t} />}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);

// seek every picture clip to its source time, write the engine-style styles (visible clips only), then move the playhead
(window as unknown as Record<string, unknown>).__show = async (t: number) => {
  const seek = (v: HTMLVideoElement, time: number) => new Promise<void>((res) => { if (Math.abs(v.currentTime - time) < 1e-3 && v.readyState >= 2) return res(); v.onseeked = () => res(); v.currentTime = Math.max(0, time); });
  const zs = [...pics].sort((x, y) => order(x) - order(y)); // lowest track first (z-index 1), as PlaybackEngine.syncVideo
  for (const c of pics) {
    const v = document.querySelector(`video[data-clip-id="${c.id}"]`) as HTMLVideoElement;
    const dur = (c.duration - c.trimStart - c.trimEnd) / (c.speed || 1);
    const active = t >= c.startTime && t < c.startTime + dur;
    if (active) await seek(v, c.trimStart + (t - c.startTime) * (c.speed || 1));
    const pose = clipPoseCss(c, t - c.startTime);
    v.style.transform = `scale(1, 1)${pose.transform ? ` ${pose.transform}` : ''}`; v.style.clipPath = pose.clipPath ?? ''; v.style.objectFit = 'contain';
    v.style.opacity = active ? String(interpolateProperty(c, 'opacity', t - c.startTime)) : '0';
    v.style.mixBlendMode = c.blendMode && c.blendMode !== 'normal' ? c.blendMode : '';
    v.style.zIndex = String(zs.indexOf(c) + 1);
  }
  (window as unknown as { __set: (v: number) => void }).__set(t);
};
(window as unknown as Record<string, unknown>).__ready = true;
