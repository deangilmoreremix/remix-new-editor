// [remix] Live captions while the voice-over recorder is running (edit-tab.tsx shows this next to its "recording" chip).
// Web Speech API through src/lib/editor/speech/liveCaptions.js: on this device when the browser can do that; the browser's online service only after
// the user clicks for it (in Chrome that service receives the audio). It is a live preview: no word timing. Timed captions come from Whisper afterwards
// (the clip's "Generate captions").
import { useEffect, useRef, useState, type CSSProperties } from 'react';
// @ts-expect-error plain JS module
import { liveCaptionSupport, installOnDevice, createLiveCaptions } from '../../../lib/editor/speech/liveCaptions.js';

type Support = { supported: boolean; onDevice: 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unknown' };
type Session = { start: () => boolean; stop: () => { text: string } };
const KEY = 'remix.liveCaptions.browserService';
const read = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const write = (on: boolean) => { try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* storage blocked */ } };

const box: CSSProperties = { position: 'absolute', bottom: 74, left: '50%', transform: 'translateX(-50%)', zIndex: 30, maxWidth: 'min(760px, 86%)', padding: '10px 16px', borderRadius: 14, background: 'rgba(8,12,18,.92)', border: '1px solid var(--border-medium)', color: '#fff', fontSize: 14, textAlign: 'center' };
const btn: CSSProperties = { marginLeft: 10, padding: '3px 10px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 12 };

export function LiveCaptionStrip({ recording, lang = 'en-US' }: { recording: boolean; lang?: string }) {
  const [support, setSupport] = useState<Support | null>(null);
  const [mode, setMode] = useState<'on-device' | 'browser'>(() => (read() ? 'browser' : 'on-device'));
  const [off, setOff] = useState(false);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const session = useRef<Session | null>(null);

  // what this browser can do, each time a recording starts
  useEffect(() => {
    if (!recording) { setText(''); setNote(''); setOff(false); return undefined; }
    let alive = true;
    void liveCaptionSupport({ lang }).then((s: Support) => { if (alive) setSupport(s); });
    return () => { alive = false; };
  }, [recording, lang]);

  // the session itself: on this device when it can be, in the browser only when the user chose that
  const canRun = !!support?.supported && !off && (mode === 'browser' || support.onDevice === 'available');
  useEffect(() => {
    if (!recording || !canRun) return undefined;
    const s: Session = createLiveCaptions({ lang, mode, onUpdate: (u: { text: string }) => setText(u.text), onError: (e: { message: string }) => setNote(e.message) });
    session.current = s;
    s.start();
    return () => { s.stop(); session.current = null; };
  }, [recording, canRun, lang, mode]);

  if (!recording || off || !support) return null;

  const needsPack = support.supported && mode === 'on-device' && (support.onDevice === 'downloadable' || support.onDevice === 'downloading');
  const noLocal = support.supported && mode === 'on-device' && !needsPack && support.onDevice !== 'available';
  return (
    <div role="status" data-testid="live-captions" style={box}>
      {!support.supported && <span>Live captions need a browser with speech recognition (Chrome, Edge or Safari).</span>}
      {canRun && (
        <>
          <div data-testid="live-caption-text" style={{ minHeight: 20 }}>{text || <span style={{ opacity: 0.55 }}>Listening…</span>}</div>
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>{mode === 'browser' ? 'Browser speech service: your browser may send the audio to its provider.' : 'On this device: the audio stays here.'} A live preview; time the captions afterwards with Generate captions.</div>
        </>
      )}
      {needsPack && (
        <span>Live captions on this device need a small language pack.
          <button type="button" style={btn} disabled={busy} data-testid="live-caption-install" onClick={() => { setBusy(true); void installOnDevice({ lang }).then(async (ok: boolean) => { setBusy(false); if (ok) setSupport(await liveCaptionSupport({ lang })); else setNote('The language pack could not be downloaded.'); }); }}>{busy ? 'Downloading…' : 'Download it'}</button>
        </span>
      )}
      {noLocal && (
        <span>This browser cannot caption on this device.
          <button type="button" style={btn} data-testid="live-caption-browser" onClick={() => { write(true); setMode('browser'); }}>Use the browser's online service</button>
          <span style={{ display: 'block', fontSize: 11, opacity: 0.65, marginTop: 4 }}>In Chrome that service sends the audio to the browser's provider.</span>
        </span>
      )}
      {note && <div role="alert" style={{ fontSize: 12, color: '#fbbf24', marginTop: 4 }}>{note}</div>}
      <button type="button" style={{ ...btn, position: 'absolute', top: 6, right: 8, marginLeft: 0 }} data-testid="live-caption-off" onClick={() => { setOff(true); }}>Hide</button>
    </div>
  );
}
