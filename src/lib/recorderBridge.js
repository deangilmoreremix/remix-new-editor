// Glue between the embedded Screenity web recorder (public/recorder/) and the timeline editor.

// MediaRecorder/WebCodecs WebM files often have no duration header; read it from the media element.
export function probeBlobDuration(blob) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(blob);
    let finished = false;
    let seeked = false;
    const done = (d) => {
      if (finished) return;
      finished = true;
      v.removeAttribute('src');
      v.load();
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) && d > 0 ? d : null);
    };
    // Resolve as soon as a real duration is known; an Infinity duration (headerless WebM) needs a seek.
    const check = () => {
      if (finished) return;
      const d = v.duration;
      if (Number.isFinite(d) && d > 0) return done(d);
      if (d === Infinity && !seeked) { seeked = true; v.currentTime = 1e101; }
    };
    v.preload = 'auto';
    v.muted = true;
    ['loadedmetadata', 'durationchange', 'loadeddata', 'canplay', 'timeupdate'].forEach((ev) => v.addEventListener(ev, check));
    v.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    v.src = url;
  });
}

// Remux to MP4 so the clip has a real duration and seeks properly on the timeline.
// Returns { blob, duration } (duration in seconds, or null if unknown). Falls back to the
// original file if the browser/codec can't be remuxed.
export async function remuxForTimeline(blob) {
  if (blob.size > 1.5e9) return { blob, duration: null };
  try {
    const mb = await import('mediabunny');
    const input = new mb.Input({ source: new mb.BlobSource(blob), formats: mb.ALL_FORMATS });
    let duration = null;
    try { const d = await input.computeDuration(); duration = Number.isFinite(d) && d > 0 ? d : null; } catch (_) { /* fall through */ }
    const target = new mb.BufferTarget();
    const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target });
    const conversion = await mb.Conversion.init({ input, output });
    if (!conversion.isValid) return { blob, duration };
    await conversion.execute();
    return { blob: new Blob([target.buffer], { type: 'video/mp4' }), duration };
  } catch (e) {
    console.warn('Remux to MP4 failed, using the original recording:', e);
    return { blob, duration: null };
  }
}

const OVERLAY_ID = 'smartvid-recorder-overlay';
const DOCK_ID = 'smartvid-recorder-dock';
const DOCK_STYLE_ID = 'smartvid-recorder-dock-style';
const HEIGHT_KEY = 'smartvid.recorder.dockHeight';
const IFRAME_ALLOW = 'display-capture *; camera *; microphone *; autoplay *; clipboard-write *; fullscreen *';
const BAR_H = 34;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const savedHeight = () => { try { return Number(localStorage.getItem(HEIGHT_KEY)) || 0; } catch (_) { return 0; } };

function makeFrame() {
  const frame = document.createElement('iframe');
  frame.src = '/recorder/web.html';
  frame.title = 'Screen recorder';
  frame.allow = IFRAME_ALLOW;
  return frame;
}

// Opens the Screenity web recorder. mode 'dock' (default) pins it to a pane at the top of the
// page and shrinks the editor to the space below, so you can record and edit at the same time.
// mode 'overlay' covers the whole window. Narrow windows always use the overlay.
export function openScreenityRecorder({ mode = 'dock', onClose } = {}) {
  if (document.getElementById(OVERLAY_ID) || document.getElementById(DOCK_ID)) return null;
  if (mode === 'dock' && window.innerWidth < 900) mode = 'overlay';
  return mode === 'dock' ? openDock({ onClose }) : openOverlay({ onClose });
}

function openOverlay({ onClose }) {
  const wrap = document.createElement('div');
  wrap.id = OVERLAY_ID;
  wrap.dataset.mode = 'overlay';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(8,10,20,.4)';
  const frame = makeFrame();
  frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;color-scheme:normal';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close recorder';
  closeBtn.style.cssText = 'position:absolute;top:14px;left:14px;z-index:2;padding:8px 14px;border-radius:999px;border:0;background:#fff;color:#16203a;font:600 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.3)';
  let recording = false;
  const onMsg = (e) => {
    const d = e.data;
    if (e.origin === window.location.origin && d && d.source === 'smartvid-recorder' && d.type === 'recording-state') recording = !!d.recording;
  };
  window.addEventListener('message', onMsg);
  const close = () => {
    if (recording && !window.confirm('A recording is in progress. Close the recorder and lose it?')) return;
    window.removeEventListener('message', onMsg);
    wrap.remove();
    if (onClose) onClose();
  };
  closeBtn.onclick = close;
  wrap.append(frame, closeBtn);
  document.body.appendChild(wrap);
  return { close, frame, mode: 'overlay' };
}

function openDock({ onClose }) {
  const defaultH = clamp(Math.round(window.innerHeight * 0.62), 380, 680);
  const state = { base: clamp(savedHeight() || defaultH, 260, Math.round(window.innerHeight * 0.85)), recording: false, editorOpen: false, collapsed: false };

  const dock = document.createElement('div');
  dock.id = DOCK_ID;
  dock.dataset.mode = 'dock';
  dock.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:900;background:#0b1020;border-bottom:1px solid #232c47;box-shadow:0 6px 24px rgba(0,0,0,.35);display:flex;flex-direction:column';

  const bar = document.createElement('div');
  bar.style.cssText = `height:${BAR_H}px;flex:none;display:flex;align-items:center;gap:8px;padding:0 10px;font:600 12px system-ui,sans-serif;color:#e8ecf6;background:#131a2e;border-bottom:1px solid #232c47`;
  const title = document.createElement('span');
  title.textContent = 'Recorder';
  title.style.cssText = 'flex:1';
  const mkBtn = (label, tip) => {
    const b = document.createElement('button');
    b.textContent = label; b.title = tip; b.setAttribute('aria-label', tip);
    b.style.cssText = 'height:24px;min-width:26px;padding:0 8px;border-radius:6px;border:1px solid #2c3658;background:#0b1020;color:#e8ecf6;font:600 12px system-ui;cursor:pointer';
    return b;
  };
  const collapseBtn = mkBtn('▾', 'Collapse recorder');
  const closeBtn = mkBtn('✕', 'Close recorder');
  bar.append(title, collapseBtn, closeBtn);

  const frame = makeFrame();
  frame.style.cssText = 'position:absolute;left:0;top:0;border:0;background:#f4f4f6;color-scheme:normal;transform-origin:0 0';
  const view = document.createElement('div');
  view.style.cssText = 'flex:1;min-height:0;position:relative;overflow:hidden';
  view.appendChild(frame);

  const grip = document.createElement('div');
  grip.title = 'Drag to resize';
  grip.style.cssText = 'height:8px;flex:none;cursor:ns-resize;background:linear-gradient(#131a2e,#232c47)';

  dock.append(bar, view, grip);

  const css = document.createElement('style');
  css.id = DOCK_STYLE_ID;
  document.head.appendChild(css);

  // The editor's root is a fixed 100vw x 100vh box: push it down and shrink it by the dock height.
  const height = () => {
    if (state.collapsed) return BAR_H;
    if (state.editorOpen) return Math.round(window.innerHeight * 0.88);
    if (state.recording) return Math.min(state.base, 220);
    return state.base;
  };
  // Screenity's popup is ~650px tall. In a shorter pane the recorder is scaled down to fit
  // (never below MIN_SCALE) rather than cropping its buttons off.
  const NEEDS_H = 690, MIN_SCALE = 0.6;
  const apply = (announce = true) => {
    const h = height();
    const total = h + (state.collapsed ? 0 : 8);
    dock.style.height = `${total}px`;
    view.style.display = state.collapsed ? 'none' : 'block';
    grip.style.display = state.collapsed ? 'none' : 'block';
    collapseBtn.textContent = state.collapsed ? '▸' : '▾';
    collapseBtn.title = state.collapsed ? 'Expand recorder' : 'Collapse recorder';
    const paneH = Math.max(40, h - BAR_H);
    const k = state.editorOpen ? 1 : clamp(paneH / NEEDS_H, MIN_SCALE, 1);
    frame.style.width = `${100 / k}%`;
    frame.style.height = `${paneH / k}px`;
    frame.style.transform = k === 1 ? 'none' : `scale(${k})`;
    css.textContent = `.app-shell{height:calc(100vh - ${total}px) !important;margin-top:${total}px}`;
    if (announce) window.dispatchEvent(new Event('resize')); // let the timeline re-measure
  };

  const onMsg = (e) => {
    const d = e.data;
    if (e.origin !== window.location.origin || !d || d.source !== 'smartvid-recorder') return;
    if (d.type === 'recording-state') { state.recording = !!d.recording; if (state.recording) state.collapsed = false; apply(); }
    if (d.type === 'overlay') { state.editorOpen = !!d.open; if (d.open) state.collapsed = false; apply(); }
  };
  window.addEventListener('message', onMsg);

  // drag to resize
  let drag = null;
  grip.addEventListener('pointerdown', (e) => { drag = { y: e.clientY, h: state.base }; grip.setPointerCapture(e.pointerId); frame.style.pointerEvents = 'none'; });
  grip.addEventListener('pointermove', (e) => {
    if (!drag) return;
    state.base = clamp(drag.h + (e.clientY - drag.y), 260, Math.round(window.innerHeight * 0.85));
    apply();
  });
  const endDrag = () => { if (!drag) return; drag = null; frame.style.pointerEvents = ''; try { localStorage.setItem(HEIGHT_KEY, String(state.base)); } catch (_) {} };
  grip.addEventListener('pointerup', endDrag);
  grip.addEventListener('pointercancel', endDrag);

  collapseBtn.onclick = () => { state.collapsed = !state.collapsed; apply(); };
  const onWinResize = () => { if (!state.collapsed) apply(false); }; // announce=false: don't re-fire our own resize
  window.addEventListener('resize', onWinResize);

  const close = () => {
    if (state.recording && !window.confirm('A recording is in progress. Close the recorder and lose it?')) return;
    window.removeEventListener('message', onMsg);
    window.removeEventListener('resize', onWinResize);
    dock.remove();
    css.remove();
    window.dispatchEvent(new Event('resize'));
    if (onClose) onClose();
  };
  closeBtn.onclick = close;

  document.body.appendChild(dock);
  apply();
  return { close, frame, mode: 'dock' };
}

// Called after a recording has been added to the timeline: closes the full-window overlay, but a
// docked recorder stays open so you can keep recording.
export function closeScreenityRecorder() {
  document.getElementById(OVERLAY_ID)?.remove();
}

export function isScreenityRecorderOpen() {
  return !!(document.getElementById(OVERLAY_ID) || document.getElementById(DOCK_ID));
}
