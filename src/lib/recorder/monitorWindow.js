// src/lib/recorder/monitorWindow.js
//
// The floating recording monitor (requirement 9): a small always-on-top window (Document Picture-in-Picture, Chromium
// browsers) with the recording time, the microphone level, and Pause and Stop, so you can run a screen recording from
// another window. Only one such window can exist per tab, so it replaces the floating script window while it is open.
// This file draws into a document it is given and reports button presses; it never starts or stops anything itself.

export const monitorSupported = (win = globalThis.window) => !!win && typeof win.documentPictureInPicture?.requestWindow === 'function';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Fill `doc` with the monitor and return its controller.
 * @param {Document} doc
 * @param {{ onStop:()=>void, onPause:()=>void, onResume:()=>void }} handlers
 * @returns {{ update:(s:{ seconds:number, level:number, clipped?:boolean, paused?:boolean })=>void, root:HTMLElement }}
 */
export function mountMonitor(doc, { onStop, onPause, onResume }) {
  const root = doc.createElement('div');
  root.setAttribute('data-recording-monitor', '');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Recording controls');
  root.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:12px;font-family:Inter,Arial,sans-serif;color:#fff;background:#0b0c10;height:100%;box-sizing:border-box;';
  const top = doc.createElement('div'); top.style.cssText = 'display:flex;align-items:center;gap:10px;';
  const dot = doc.createElement('span'); dot.setAttribute('aria-hidden', 'true'); dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:#ef4444;';
  const time = doc.createElement('span'); time.setAttribute('data-monitor-time', ''); time.style.cssText = 'font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;'; time.textContent = '0:00';
  const state = doc.createElement('span'); state.setAttribute('data-monitor-state', ''); state.setAttribute('role', 'status'); state.style.cssText = 'font-size:12px;opacity:.7;'; state.textContent = 'Recording';
  top.append(dot, time, state);
  const meter = doc.createElement('div'); meter.setAttribute('role', 'img'); meter.setAttribute('aria-label', 'Microphone level'); meter.style.cssText = 'height:8px;border-radius:4px;background:rgba(255,255,255,.15);overflow:hidden;';
  const bar = doc.createElement('div'); bar.setAttribute('data-monitor-level', ''); bar.style.cssText = 'height:100%;width:0;background:#2fb344;';
  meter.appendChild(bar);
  const hint = doc.createElement('div'); hint.setAttribute('data-monitor-hint', ''); hint.style.cssText = 'font-size:11px;color:#f87171;min-height:14px;';
  const row = doc.createElement('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:auto;';
  const btn = (label, attr, bg) => { const b = doc.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute(attr, ''); b.style.cssText = `flex:1;padding:10px;border:0;border-radius:8px;font-weight:700;color:#fff;background:${bg};cursor:pointer;`; return b; };
  const pause = btn('Pause', 'data-monitor-pause', '#334155');
  const stop = btn('Stop', 'data-monitor-stop', '#dc2626');
  pause.addEventListener('click', () => (pause.dataset.paused === '1' ? onResume?.() : onPause?.()));
  stop.addEventListener('click', () => onStop?.());
  row.append(pause, stop);
  root.append(top, meter, hint, row);
  doc.body.replaceChildren(root);
  doc.body.style.margin = '0';
  return {
    root,
    update({ seconds = 0, level = 0, clipped = false, paused = false } = {}) {
      time.textContent = fmt(Math.max(0, Number(seconds) || 0));
      const l = Math.max(0, Math.min(1, Number(level) || 0));
      bar.style.width = `${Math.round(l * 100)}%`;
      bar.style.background = clipped ? '#ef4444' : l > 0.85 ? '#f5a524' : '#2fb344';
      hint.textContent = clipped ? 'Too loud: move back a little' : '';
      state.textContent = paused ? 'Paused' : 'Recording';
      dot.style.opacity = paused ? '0.3' : '1';
      pause.textContent = paused ? 'Resume' : 'Pause';
      pause.dataset.paused = paused ? '1' : '0';
    },
  };
}

/** Open the window (needs a click) and mount the monitor in it. Resolves { win, monitor }, or null when the browser refuses. */
export async function openMonitorWindow(handlers, { win = globalThis.window, width = 300, height = 170 } = {}) {
  if (!monitorSupported(win)) return null;
  try {
    const w = await win.documentPictureInPicture.requestWindow({ width, height });
    w.document.title = 'Recording';
    return { win: w, monitor: mountMonitor(w.document, handlers) };
  } catch { return null; }
}
