import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import { renderMediaOnWeb, renderStillOnWeb } from '@remotion/web-renderer';
import { COMPOSITIONS } from './compositions.jsx';

// Test hook used by the headless runner (poc/run-poc.mjs).
window.__poc = {
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
