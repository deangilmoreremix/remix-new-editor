// Prompt -> clip. Typing grammar from type-and-filter (references/shots/interaction/type-and-filter.md, demo
// demos/interaction/type-and-filter/TypeAndFilter.tsx): camera close on the input (zoom 2.0), 3f/char typing, solid caret then
// blink, ~11f breath after typing, pull-out to full frame (bezier(0.33,0,0.15,1) camera ease from the demo).
// The page is the REAL Video Studio capture (textures/live/video-blank-full.png vs video-typed-full.png revealed char by char
// using canvas-measured glyph widths). The clip shown afterwards is a built-in sample asset of the app, tagged "Sample";
// it is NOT a live generation result.
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import layout from '../live-layout.json';
import { bezier, E, seg } from '../lib/motion';
import { T } from '../lib/tokens';
import { CAPTIONS, PROMPT_TEXT, SHOTS } from '../timeline';

const M = layout['video-typed'].measure as { x0: number; y: number; h: number; w: number; offsets: number[] };
const TYPE_START = 16; // local frame of first character
const PER_CHAR = 3;
export const TYPE_END = TYPE_START + PROMPT_TEXT.length * PER_CHAR;

const CAM_EASE = bezier(0.33, 0, 0.15, 1);
const KEYS = [
  { f: 0, cx: 1330, cy: 402, z: 2.0 },
  { f: 111, cx: 1330, cy: 402, z: 2.0 },
  { f: 135, cx: 960, cy: 540, z: 1.0 },
];
const cam = (f: number) => {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (f >= a.f && f <= b.f) {
      const t = CAM_EASE((f - a.f) / (b.f - a.f));
      return { cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, z: a.z + (b.z - a.z) * t };
    }
  }
  return f < KEYS[0].f ? KEYS[0] : { cx: KEYS[KEYS.length - 1].cx, cy: KEYS[KEYS.length - 1].cy, z: KEYS[KEYS.length - 1].z };
};

export const PromptShot: React.FC = () => {
  const frame = useCurrentFrame();
  const c = cam(frame);
  const typed = frame < TYPE_START ? 0 : Math.min(PROMPT_TEXT.length, Math.floor((frame - TYPE_START) / PER_CHAR) + 1);
  const revealX = typed === 0 ? M.x0 : M.x0 + M.offsets[typed - 1] + 1;
  const caretOn = frame >= TYPE_START - 2 && frame <= 128 && (frame <= TYPE_END || Math.floor((frame - TYPE_END) / 8) % 2 === 0);
  const caretX = typed === 0 ? M.x0 : M.x0 + M.offsets[typed - 1] + 2;

  // page dims once the pull-out is under way so the clip card owns the frame (also keeps the example-gallery strip unreadable)
  const dim = seg(frame, 112, 132, E.outQuad) * 0.97;
  const camTransform = `translate(${960 - c.cx * c.z}px, ${540 - c.cy * c.z}px) scale(${c.z})`;

  const rise = seg(frame, 150, 186, bezier(0.2, 1.1, 0.3, 1));
  const cardOut = 1 - seg(frame, 150, 168, E.outQuad);
  const capIn = CAPTIONS[0];
  const capLocal = [capIn.from - SHOTS.prompt.from, capIn.to - SHOTS.prompt.from];
  const capO = interpolate(frame, [capLocal[0], capLocal[0] + 10, capLocal[1] - 10, capLocal[1]], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const push = 1 + 0.035 * seg(frame, 186, 295, E.inOutQuad);

  return (
    <AbsoluteFill style={{ backgroundColor: T.bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', transform: camTransform }}>
        <Img src={staticFile('textures/live/video-blank-full.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }} />
        {/* typed state, revealed up to the measured glyph edge, so the real rendered text appears character by character */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, clipPath: `polygon(${M.x0 - 6}px ${M.y - 4}px, ${revealX}px ${M.y - 4}px, ${revealX}px ${M.y + M.h + 4}px, ${M.x0 - 6}px ${M.y + M.h + 4}px)` }}>
          <Img src={staticFile('textures/live/video-typed-full.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }} />
        </div>
        {/* the example-gallery strip below the prompt bar is covered permanently (its thumbnails carry third-party text) */}
        <div style={{ position: 'absolute', left: 0, top: 860, width: 1920, height: 220, background: `linear-gradient(180deg, rgba(5,5,5,0) 0%, ${T.bg} 35%)` }} />
        {caretOn && <div style={{ position: 'absolute', left: caretX, top: M.y + 8, width: 2, height: 26, background: '#fff' }} />}
      </div>
      <AbsoluteFill style={{ background: T.bg, opacity: dim }} />
      <div style={{ position: 'absolute', top: 96, left: 0, right: 0, textAlign: 'center', fontFamily: T.font, fontSize: 72, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', opacity: capO }}>
        {capIn.text}
      </div>
      <div
        style={{
          position: 'absolute', left: 320, top: 232, width: 1280, height: 720, borderRadius: T.r['2xl'], overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 45px 80px -20px rgba(0,0,0,0.9)',
          opacity: 1 - cardOut, transform: `translateY(${(1 - rise) * 120}px) scale(${push})`, background: T.card,
        }}
      >
        <Sequence from={150}><OffthreadVideo src={staticFile('sample-tower.mp4')} muted playbackRate={0.85} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></Sequence>
        <div style={{ position: 'absolute', left: 20, top: 20, padding: '10px 22px', borderRadius: 999, background: 'rgba(5,5,5,0.85)', border: `2px solid ${T.accent}`, color: T.accent, fontFamily: T.font, fontWeight: 700, fontSize: 36, letterSpacing: '0.06em' }}>
          EXAMPLE FROM THE GALLERY
        </div>
      </div>
    </AbsoluteFill>
  );
};
