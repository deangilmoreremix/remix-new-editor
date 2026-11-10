import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import { renderMediaOnWeb, renderStillOnWeb } from '@remotion/web-renderer';
import { COMPOSITIONS } from './compositions.jsx';
import { BlockClip } from './BlockClip.jsx';

const blockComp = (name, width, height, seconds, fps = 30) => ({
  id: 'blk-' + name, component: () => <BlockClip name={name} width={width} height={height} />,
  width, height, fps, durationInFrames: Math.max(2, Math.round(seconds * fps)),
});
const b64 = async (blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s); };
// 24x14 grayscale thumbnail + mean/std, used to detect blank / static output without saving every PNG.
async function statsOf(canvas) {
  const w = 24, h = 14, c = new OffscreenCanvas(w, h), g = c.getContext('2d');
  g.drawImage(canvas, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, v = [];
  for (let i = 0; i < d.length; i += 4) v.push(Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]));
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const std = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  return { v, mean: +mean.toFixed(1), std: +std.toFixed(1) };
}

// Test hook used by the headless runner (poc/run-poc.mjs).
window.__poc = {
  async block(name, { width, height, duration, times, scale = 0.5, fps = 30 }) {
    window.__hfErrors = [];
    const comp = blockComp(name, width, height, duration, fps);
    const frames = [];
    for (const t of times) {
      const frame = Math.min(comp.durationInFrames - 1, Math.round(t * fps));
      try {
        const r = await renderStillOnWeb({ composition: comp, inputProps: {}, frame, scale, delayRenderTimeoutInMilliseconds: 60000 });
        const canvas = await r.canvas();
        frames.push({ t, frame, ...(await statsOf(canvas)), png: await b64(await r.blob({ format: 'png' })) });
      } catch (e) { frames.push({ t, frame, error: String(e).slice(0, 300) }); }
    }
    return { frames, errors: [...new Set(window.__hfErrors)].slice(0, 6) };
  },
  async blockVideo(name, { width, height, duration, fps = 30 }) {
    window.__hfErrors = [];
    const comp = blockComp(name, width, height, duration, fps);
    const t0 = performance.now();
    const res = await renderMediaOnWeb({ composition: comp, inputProps: {}, container: 'mp4', hardwareAcceleration: 'prefer-software', logLevel: 'error', delayRenderTimeoutInMilliseconds: 60000 });
    const blob = await res.getBlob();
    return { ms: Math.round(performance.now() - t0), bytes: blob.size, b64: await b64(blob), errors: [...new Set(window.__hfErrors)].slice(0, 6) };
  },
  async render(name, opts = {}) {
    const c = COMPOSITIONS[name];
    const t0 = performance.now();
    const res = await renderMediaOnWeb({
      composition: c, inputProps: c.defaultProps ?? {}, container: opts.container ?? 'mp4',
      videoCodec: opts.videoCodec ?? null, hardwareAcceleration: 'prefer-software', logLevel: 'warn',
    });
    const blob = await res.getBlob();
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { ms: Math.round(performance.now() - t0), bytes: buf.length, type: blob.type, b64: btoa(bin) };
  },
  async still(name, frame) {
    const c = COMPOSITIONS[name];
    const r = await renderStillOnWeb({ composition: c, inputProps: c.defaultProps ?? {}, frame });
    const buf = new Uint8Array(await (await r.blob({ format: 'png' })).arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(bin);
  },
};

function App() {
  const [name, setName] = useState('lower-third');
  const c = COMPOSITIONS[name];
  return (
    <div style={{ padding: 16 }}>
      <h3>HyperFrames x Remotion web renderer — PoC</h3>
      {Object.keys(COMPOSITIONS).map((k) => <button key={k} onClick={() => setName(k)}>{k}</button>)}
      <div id="preview"><Player key={name} component={c.component} inputProps={c.defaultProps ?? {}} durationInFrames={c.durationInFrames}
        fps={c.fps} compositionWidth={c.width} compositionHeight={c.height} controls acknowledgeRemotionLicense style={{ width: 640, height: 360 }} /></div>
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
