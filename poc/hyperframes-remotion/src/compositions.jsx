import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Video } from '@remotion/media';
import { HyperFramesClip } from './HyperFramesClip.jsx';

const W = 1280, H = 720, FPS = 30;

// ---- Test 1: GSAP lower third, written in HyperFrames contract form --------
const lowerThirdHtml = `
<div data-composition-id="lower-third" data-width="${W}" data-height="${H}" data-start="0" data-duration="4"
     style="position:absolute;inset:0;overflow:hidden;font-family:Inter,Arial,sans-serif">
  <div id="panel" class="clip" data-start="0" data-duration="4" data-track-index="1"
       style="position:absolute;left:60px;bottom:90px;width:560px;height:110px;background:#e11d48;transform-origin:left center"></div>
  <div id="name" class="clip" data-start="0" data-duration="4" data-track-index="2"
       style="position:absolute;left:90px;bottom:142px;color:#fff;font-size:40px;font-weight:800">Maria's Bakery</div>
  <div id="sub" class="clip" data-start="0" data-duration="4" data-track-index="3"
       style="position:absolute;left:90px;bottom:106px;color:#ffe4e6;font-size:22px">Fresh bread every morning</div>
</div>`;
const lowerThirdScript = `
const tl = gsap.timeline({ paused: true });
tl.fromTo('#panel', { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'power3.out' }, 0.2)
  .fromTo('#name', { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.6)
  .fromTo('#sub',  { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.8)
  .to('#panel, #name, #sub', { opacity: 0, duration: 0.4 }, 3.5);
(window.__timelines = window.__timelines || {})['lower-third'] = tl;`;

export const LowerThird = () => (
  <AbsoluteFill style={{ background: 'linear-gradient(135deg,#1e3a8a,#0f172a)' }}>
    <HyperFramesClip html={lowerThirdHtml} script={lowerThirdScript} compositionId="lower-third" />
  </AbsoluteFill>
);

// ---- Test 2: real footage + transparent animated overlay -------------------
const offerHtml = `
<div data-composition-id="offer" data-width="${W}" data-height="${H}" data-start="0" data-duration="4"
     style="position:absolute;inset:0;overflow:hidden;font-family:Inter,Arial,sans-serif">
  <div id="badge" class="clip" data-start="0" data-duration="4" data-track-index="1"
       style="position:absolute;right:70px;top:60px;width:230px;height:230px;border-radius:50%;background:#facc15;color:#111;
              display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900">
    <div style="font-size:70px;line-height:1">20%</div><div style="font-size:28px">OFF TODAY</div></div>
  <div id="bar" class="clip" data-start="0" data-duration="4" data-track-index="2"
       style="position:absolute;left:0;bottom:0;width:100%;height:70px;background:rgba(0,0,0,.65);color:#fff;font-size:28px;
              display:flex;align-items:center;padding-left:40px;box-sizing:border-box">Show this video in-store to redeem</div>
</div>`;
const offerScript = `
const tl = gsap.timeline({ paused: true });
tl.fromTo('#badge', { scale: 0, rotation: -120 }, { scale: 1, rotation: 0, duration: 0.8, ease: 'back.out(1.7)' }, 0.3)
  .fromTo('#bar', { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: 'power2.out' }, 1.0)
  .to('#badge', { rotation: 8, yoyo: true, repeat: 3, duration: 0.25, ease: 'sine.inOut' }, 1.4);
(window.__timelines = window.__timelines || {})['offer'] = tl;`;

export const FootageOverlay = ({ videoSrc }) => (
  <AbsoluteFill style={{ background: '#000' }}>
    <Video src={videoSrc} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    <HyperFramesClip html={offerHtml} script={offerScript} compositionId="offer" />
  </AbsoluteFill>
);

// ---- Test 3: WebGL shader driven by the timeline (catalog-style effect) ----
const shaderHtml = `
<div data-composition-id="shader" data-width="${W}" data-height="${H}" data-start="0" data-duration="4"
     style="position:absolute;inset:0;overflow:hidden">
  <canvas id="gl" width="${W}" height="${H}" style="width:100%;height:100%"></canvas>
</div>`;
const shaderScript = `
const canvas = document.getElementById('gl') || document.querySelector('#gl');
const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const fs = 'precision mediump float;uniform float t;uniform vec2 r;void main(){vec2 uv=gl_FragCoord.xy/r;'+
  'float d=distance(uv,vec2(.5));float w=sin(d*30.-t*8.)*.5+.5;float m=smoothstep(t*.4,t*.4+.05,d);'+
  'gl_FragColor=vec4(mix(vec3(w,.2,.9-w*.5),vec3(.05,.05,.15),m),1.);}';
const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
const prog = gl.createProgram();
gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
gl.linkProgram(prog); gl.useProgram(prog);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const tU = gl.getUniformLocation(prog, 't'); gl.uniform2f(gl.getUniformLocation(prog, 'r'), canvas.width, canvas.height);
const state = { t: 0 };
const draw = () => { gl.uniform1f(tU, state.t); gl.viewport(0,0,canvas.width,canvas.height); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
const tl = gsap.timeline({ paused: true, onUpdate: draw });
tl.to(state, { t: 4, duration: 4, ease: 'none' }, 0);
draw();
(window.__timelines = window.__timelines || {})['shader'] = tl;`;

export const ShaderTransition = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    <HyperFramesClip html={shaderHtml} script={shaderScript} compositionId="shader" />
  </AbsoluteFill>
);

const base = { width: W, height: H, fps: FPS, durationInFrames: 4 * FPS };
export const COMPOSITIONS = {
  'lower-third': { id: 'lower-third', component: LowerThird, ...base },
  'footage-overlay': { id: 'footage-overlay', component: FootageOverlay, defaultProps: { videoSrc: '/footage.mp4' }, ...base },
  'shader': { id: 'shader', component: ShaderTransition, ...base },
};
