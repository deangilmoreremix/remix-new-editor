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
const PANEL_ID = 'smartvid-recorder-panel';
const PANEL_STYLE_ID = 'smartvid-recorder-panel-style';
const WIDTH_KEY = 'smartvid.recorder.panelWidth';
const IFRAME_ALLOW = 'display-capture *; camera *; microphone *; autoplay *; clipboard-write *; fullscreen *';
const HEADER_H = 40;
const TAB_W = 44;
const MIN_W = 400;
const DEFAULT_W = 440;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const savedWidth = () => { try { return Number(localStorage.getItem(WIDTH_KEY)) || 0; } catch (_) { return 0; } };

function makeFrame() {
  const frame = document.createElement('iframe');
  frame.src = '/recorder/web.html';
  frame.title = 'Screen recorder';
  frame.allow = IFRAME_ALLOW;
  return frame;
}

// Opens the Screenity web recorder. mode 'panel' (default) docks it as a full-height side panel
// on the right and narrows the editor to the space beside it; 'overlay' covers the whole window.
// Narrow windows always use the overlay.
export function openScreenityRecorder({ mode = 'panel', onClose } = {}) {
  if (document.getElementById(OVERLAY_ID) || document.getElementById(PANEL_ID)) return null;
  if ((mode === 'panel' || mode === 'dock') && window.innerWidth < 900) mode = 'overlay';
  return mode === 'overlay' ? openOverlay({ onClose }) : openPanel({ onClose });
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

function openPanel({ onClose }) {
  const state = { width: clamp(savedWidth() || DEFAULT_W, MIN_W, Math.round(window.innerWidth * 0.5)), editorOpen: false, collapsed: false, recording: false };

  const panel = document.createElement('aside');
  panel.id = PANEL_ID;
  panel.dataset.mode = 'panel';
  panel.setAttribute('aria-label', 'Screen recorder');
  panel.style.cssText = 'position:fixed;top:0;right:0;bottom:0;z-index:900;display:flex;flex-direction:column;background:#0a0e1a;color:#e8ecf6;'
    + 'border-left:1px solid #1f2740;box-shadow:-12px 0 32px rgba(0,0,0,.35);font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;transition:width .18s ease';

  const header = document.createElement('div');
  header.style.cssText = `height:${HEADER_H}px;flex:none;display:flex;align-items:center;gap:10px;padding:0 10px 0 14px;border-bottom:1px solid #1f2740`;
  const dot = document.createElement('span');
  dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,#22d3ee,#6366f1);flex:none';
  const title = document.createElement('span');
  title.textContent = 'Recorder';
  title.style.cssText = 'flex:1;font-size:13px;font-weight:600;letter-spacing:.01em';
  const mkBtn = (svg, tip) => {
    const b = document.createElement('button');
    b.innerHTML = svg; b.title = tip; b.setAttribute('aria-label', tip);
    b.style.cssText = 'width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:#9aa6c4;cursor:pointer;padding:0';
    b.onmouseenter = () => { b.style.background = '#1a2036'; b.style.color = '#fff'; };
    b.onmouseleave = () => { b.style.background = 'transparent'; b.style.color = '#9aa6c4'; };
    return b;
  };
  const ICON_COLLAPSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  const ICON_CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const collapseBtn = mkBtn(ICON_COLLAPSE, 'Collapse recorder');
  const closeBtn = mkBtn(ICON_CLOSE, 'Close recorder');
  header.append(dot, title, collapseBtn, closeBtn);

  // Collapsed state: a slim tab on the right edge that re-opens the panel.
  const tab = document.createElement('button');
  tab.title = 'Open recorder'; tab.setAttribute('aria-label', 'Open recorder');
  tab.style.cssText = 'display:none;flex:1;border:0;background:transparent;color:#e8ecf6;cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:10px;font:600 12px Inter,system-ui,sans-serif;writing-mode:vertical-rl;letter-spacing:.06em';
  tab.innerHTML = '<span style="width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,#22d3ee,#6366f1);display:inline-block"></span>RECORDER';

  const frame = makeFrame();
  frame.style.cssText = 'flex:1;min-height:0;width:100%;border:0;background:transparent;color-scheme:normal';

  const grip = document.createElement('div');
  grip.title = 'Drag to resize';
  grip.style.cssText = 'position:absolute;left:-4px;top:0;bottom:0;width:8px;cursor:ew-resize;z-index:2';

  panel.append(grip, header, frame, tab);

  const css = document.createElement('style');
  css.id = PANEL_STYLE_ID;
  document.head.appendChild(css);

  const panelWidth = () => (state.collapsed ? TAB_W : state.editorOpen ? Math.min(1240, window.innerWidth) : state.width);
  // The editor's root is a fixed 100vw box: narrow it by the panel width so the two sit side by side.
  const apply = (announce = true) => {
    const w = panelWidth();
    panel.style.width = `${w}px`;
    header.style.display = state.collapsed ? 'none' : 'flex';
    frame.style.display = state.collapsed ? 'none' : 'block';
    tab.style.display = state.collapsed ? 'flex' : 'none';
    grip.style.display = state.collapsed || state.editorOpen ? 'none' : 'block';
    const reserve = state.editorOpen ? 0 : w; // the post-recording editor floats over the page instead
    css.textContent = `.app-shell{width:calc(100vw - ${reserve}px) !important}`;
    if (announce) window.dispatchEvent(new Event('resize')); // let the timeline re-measure
  };

  const onMsg = (e) => {
    const d = e.data;
    if (e.origin !== window.location.origin || !d || d.source !== 'smartvid-recorder') return;
    if (d.type === 'recording-state') { state.recording = !!d.recording; if (state.recording) state.collapsed = false; apply(); }
    if (d.type === 'overlay') { state.editorOpen = !!d.open; if (d.open) state.collapsed = false; apply(); }
  };
  window.addEventListener('message', onMsg);

  // drag the left edge to resize
  let drag = null;
  grip.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, w: state.width }; grip.setPointerCapture(e.pointerId); frame.style.pointerEvents = 'none'; panel.style.transition = 'none'; });
  grip.addEventListener('pointermove', (e) => {
    if (!drag) return;
    state.width = clamp(drag.w - (e.clientX - drag.x), MIN_W, Math.round(window.innerWidth * 0.5));
    apply();
  });
  const endDrag = () => { if (!drag) return; drag = null; frame.style.pointerEvents = ''; panel.style.transition = 'width .18s ease'; try { localStorage.setItem(WIDTH_KEY, String(state.width)); } catch (_) {} };
  grip.addEventListener('pointerup', endDrag);
  grip.addEventListener('pointercancel', endDrag);

  collapseBtn.onclick = () => { state.collapsed = true; apply(); };
  tab.onclick = () => { state.collapsed = false; apply(); };
  const onWinResize = () => { state.width = clamp(state.width, MIN_W, Math.max(MIN_W, Math.round(window.innerWidth * 0.5))); apply(false); }; // false: don't re-fire our own resize
  window.addEventListener('resize', onWinResize);

  const close = () => {
    if (state.recording && !window.confirm('A recording is in progress. Close the recorder and lose it?')) return;
    window.removeEventListener('message', onMsg);
    window.removeEventListener('resize', onWinResize);
    panel.remove();
    css.remove();
    window.dispatchEvent(new Event('resize'));
    if (onClose) onClose();
  };
  closeBtn.onclick = close;

  document.body.appendChild(panel);
  apply();
  return { close, frame, mode: 'panel' };
}

// Called after a recording has been added to the timeline: closes the full-window overlay, but a
// docked recorder stays open so you can keep recording.
export function closeScreenityRecorder() {
  document.getElementById(OVERLAY_ID)?.remove();
}

export function isScreenityRecorderOpen() {
  return !!(document.getElementById(OVERLAY_ID) || document.getElementById(PANEL_ID));
}
