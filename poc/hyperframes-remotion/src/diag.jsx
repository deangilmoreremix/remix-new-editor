// Minimal diagnostics for what Remotion's web renderer paints. Dev-only.
import React from 'react';
import { AbsoluteFill } from 'remotion';
const row = (style, label, top) => (
  <div style={{ position: 'absolute', left: 40, top, width: 500, height: 60, background: 'rgba(63,185,80,.12)', color: '#fff', font: '20px sans-serif', lineHeight: '60px', paddingLeft: 20, boxSizing: 'border-box', ...style }}>{label}</div>
);
export const InsetShadow = () => (
  <AbsoluteFill style={{ background: '#0b0f17' }}>
    {row({ boxShadow: 'inset 3px 0 #3fb950' }, 'A: box-shadow inset 3px 0', 20)}
    {row({ backgroundImage: 'linear-gradient(to right, #3fb950 3px, transparent 3px)' }, 'B: gradient bar', 100)}
    {row({ borderLeft: '3px solid #3fb950' }, 'C: border-left', 180)}
    {row({ backgroundImage: 'linear-gradient(#3fb950,#3fb950)', backgroundSize: '3px 100%', backgroundRepeat: 'no-repeat', backgroundPosition: 'left top' }, 'H: sized solid bg', 260)}
    <style>{'.pe::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:#3fb950}'}</style>

    <div className="pe" style={{ position: 'absolute', left: 560, top: 20, width: 70, height: 60, background: 'rgba(63,185,80,.12)', color: '#fff', font: '18px sans-serif', lineHeight: '60px', paddingLeft: 12, boxSizing: 'border-box' }}>E:::</div>
    <div style={{ position: 'absolute', left: 560, top: 100, width: 70, height: 60, background: 'rgba(63,185,80,.12)', backgroundImage: 'linear-gradient(to right, #3fb950 4%, transparent 4%)', color: '#fff', font: '18px sans-serif', lineHeight: '60px', paddingLeft: 12, boxSizing: 'border-box' }}>G %</div>
  </AbsoluteFill>
);
export const Css3dAndGradients = () => (
  <AbsoluteFill style={{ background: '#0b0f17' }}>
    <div style={{ position: 'absolute', left: 20, top: 20, width: 280, height: 150, perspective: 400, perspectiveOrigin: '50% 50%' }}>
      <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }}>
        <div style={{ position: 'absolute', inset: 30, border: '3px solid #58a6ff', transform: 'translateZ(-300px)' }} />
        <div style={{ position: 'absolute', inset: 55, background: '#f5b335', transform: 'translateZ(0)' }} />
      </div>
    </div>
    <div style={{ position: 'absolute', left: 320, top: 20, width: 300, height: 150, border: '1px solid #345', background: 'radial-gradient(circle at 20% 30%, rgba(255,60,60,.9) 0%, rgba(255,60,60,0) 60%), radial-gradient(circle at 80% 70%, rgba(60,120,255,.9) 0%, rgba(60,120,255,0) 60%), #111' }} />
    <div style={{ position: 'absolute', left: 20, top: 200, width: 300, height: 140, border: '1px solid #345', background: 'radial-gradient(circle at 50% 50%, #f5b335 0%, #0b0f17 70%)' }} />
    <div style={{ position: 'absolute', left: 340, top: 200, width: 280, height: 140, border: '1px solid #345', background: 'rotate(0)', backgroundImage: 'linear-gradient(135deg, #ff4d6d, #3b82f6)' }} />
  </AbsoluteFill>
);
const box = (style, label, x, y) => (
  <div style={{ position: 'absolute', left: x, top: y, width: 200, height: 100, border: '1px solid #345', color: '#fff', font: '12px sans-serif', ...style }}>{label}</div>
);
export const GradSyntax = () => (
  <AbsoluteFill style={{ background: '#0b0f17' }}>
    {box({ background: 'radial-gradient(90% 62% at 82% 8%, rgba(94,66,166,.85) 0%, rgba(94,66,166,0) 60%)' }, 'P: pct size at pos, rgba->transparent', 10, 10)}
    {box({ background: 'radial-gradient(ellipse at 50% 50%, #f5b335 0%, #0b0f17 70%)' }, 'Q: ellipse at', 220, 10)}
    {box({ background: 'radial-gradient(circle at 20% 30%, rgba(255,60,60,.9) 0%, rgba(255,60,60,0) 60%)' }, 'R: circle at, rgba->0', 430, 10)}
    {box({ background: 'radial-gradient(140% 100% at 50% 55%, #17203c 0%, #0d1226 70%, #090d1c 100%)' }, 'S: pct size solid stops', 10, 130)}
    {box({ background: 'radial-gradient(circle at 50% 50%, rgba(255,60,60,.9) 0%, rgba(255,60,60,0) 60%)' }, 'T: circle center rgba->0', 220, 130)}
    {box({ background: 'radial-gradient(circle at 50% 50%, rgba(255,60,60,.9), transparent 60%)' }, 'U: ->transparent kw', 430, 130)}
    {box({ background: 'linear-gradient(90deg, rgba(60,120,255,.9), rgba(60,120,255,0))' }, 'V: linear rgba->0', 10, 250)}
    <video style={{ position: 'absolute', left: 220, top: 250, width: 200, height: 100, backgroundImage: 'linear-gradient(135deg,#ff4d6d,#3b82f6)', backgroundColor: '#222' }} />
    {box({ backgroundImage: 'linear-gradient(135deg,#ff4d6d,#3b82f6)' }, 'W: div twin of video box', 430, 250)}
  </AbsoluteFill>
);
export const DIAG = {
  'grad-syntax': { id: 'grad-syntax', component: GradSyntax, width: 640, height: 360, fps: 30, durationInFrames: 2 },
  'css3d-gradients': { id: 'css3d-gradients', component: Css3dAndGradients, width: 640, height: 360, fps: 30, durationInFrames: 2 }, 'inset-shadow': { id: 'inset-shadow', component: InsetShadow, width: 640, height: 360, fps: 30, durationInFrames: 2 } };
