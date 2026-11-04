/**
 * AI animation preview frame (code-preview.html), inside a sandboxed,
 * opaque-origin iframe placed over the editor's preview. It renders only
 * the timeline's animation clips (`remotion-code` layers) on a transparent
 * Player that follows the editor's playhead.
 *
 * Protocol (postMessage, parent ⇄ this frame):
 *   ← { type: 'preview-ready' }
 *   → { type: 'model', model }      model with only code layers
 *   → { type: 'frame', frame }      seek to this frame
 *   ← { type: 'code-error', layerId, message }
 */
import '../export-runner/sandboxShims.js';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import { TimelineComposition, registerGoogleFonts } from '../lib/editor/remotion/TimelineComposition.jsx';
import { onCodeError } from '../lib/editor/remotion/codeLayer.jsx';

const parentWin = window.parent;
const post = (msg) => parentWin.postMessage(msg, '*');

function App() {
  const [model, setModel] = useState(null);
  const player = useRef(null);
  const lastFrame = useRef(0);
  useEffect(() => {
    const onMsg = (e) => {
      if (e.source !== parentWin) return;
      const msg = e.data || {};
      if (msg.type === 'model' && msg.model) {
        Promise.race([registerGoogleFonts(msg.model.fonts || []), new Promise((r) => setTimeout(r, 8000))])
          .then(() => setModel({ ...msg.model, background: 'transparent' }));
      } else if (msg.type === 'frame') {
        lastFrame.current = Math.max(0, Math.round(Number(msg.frame) || 0));
        player.current?.seekTo(lastFrame.current);
      }
    };
    window.addEventListener('message', onMsg);
    const off = onCodeError((layerId, message) => post({ type: 'code-error', layerId, message }));
    post({ type: 'preview-ready' });
    return () => { window.removeEventListener('message', onMsg); off(); };
  }, []);
  useEffect(() => { player.current?.seekTo(lastFrame.current); }, [model]);
  if (!model) return null;
  return (
    <Player
      ref={player}
      component={TimelineComposition}
      inputProps={{ model }}
      durationInFrames={Math.max(1, model.durationInFrames)}
      fps={model.fps}
      compositionWidth={model.width}
      compositionHeight={model.height}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      controls={false}
      clickToPlay={false}
      acknowledgeRemotionLicense
    />
  );
}

createRoot(document.getElementById('runner')).render(<App />);
