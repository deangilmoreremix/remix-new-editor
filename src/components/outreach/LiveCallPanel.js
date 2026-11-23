// src/components/outreach/LiveCallPanel.js
//
// The "Talk live" call window (both sides) and the incoming-call prompt in the studio, which uses the
// native Popover API where the browser has it. Logic lives in src/lib/outreach/liveCall.js.

const CSS = `
.svlive-win{position:fixed;right:16px;bottom:16px;z-index:2147483000;width:min(340px,calc(100vw - 32px));border-radius:16px;background:#0e1014;color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.12);font:14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden}
.svlive-stage{position:relative;aspect-ratio:16/10;background:#000}
.svlive-remote{width:100%;height:100%;object-fit:cover;display:block}
.svlive-local{position:absolute;right:8px;bottom:8px;width:30%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:#222}
.svlive-status{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:16px;font-weight:600}
.svlive-bar{display:flex;gap:8px;padding:10px;justify-content:center}
.svlive-btn{border:0;border-radius:999px;padding:8px 14px;font:inherit;font-weight:700;cursor:pointer;background:rgba(255,255,255,.12);color:#fff}
.svlive-btn[aria-pressed=true]{background:rgba(255,255,255,.3)}
.svlive-end{background:#e5484d}
.svlive-ok{background:#2fb344}
.svlive-ring{position:fixed;inset:auto 16px 16px auto;margin:0;z-index:2147483001;width:min(320px,calc(100vw - 32px));border-radius:16px;border:1px solid rgba(217,255,0,.45);background:#13160c;color:#fff;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.55);font:14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif}
.svlive-ring p{margin:0 0 12px}
.svlive-pulse{display:inline-block;width:9px;height:9px;border-radius:50%;background:#2fb344;margin-right:8px;animation:svlive-p 1.2s ease-in-out infinite}
@keyframes svlive-p{50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){.svlive-pulse{animation:none}}`;

function ensureCss(doc) {
  if (doc.getElementById('svlive-css')) return;
  const s = doc.createElement('style'); s.id = 'svlive-css'; s.textContent = CSS; doc.head.appendChild(s);
}
const make = (doc, tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

const STATUS = {
  ringing: (who) => `Calling ${who}…`,
  connecting: () => 'Connecting…',
  missed: (who) => `${who} couldn’t pick up right now. Book a time instead.`,
  declined: (who) => `${who} can’t talk right now. Book a time instead.`,
  failed: () => 'The call couldn’t connect (a network may be blocking it). Book a time instead.',
  ended: () => 'Call ended.',
};

/**
 * The call window. `who` is the other person's name. update(state) takes a liveCall state.
 * onHangup is called by the red button; onClose when a finished call's window is dismissed.
 */
export function createCallWindow({ doc = globalThis.document, who = '', onHangup = () => {}, onClose = () => {} } = {}) {
  ensureCss(doc);
  const win = make(doc, 'div', 'svlive-win');
  win.setAttribute('data-live-call-window', '');
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', `Live call with ${who || 'them'}`);
  const stage = make(doc, 'div', 'svlive-stage');
  const remote = make(doc, 'video', 'svlive-remote'); remote.autoplay = true; remote.playsInline = true;
  const local = make(doc, 'video', 'svlive-local'); local.autoplay = true; local.playsInline = true; local.muted = true;
  const status = make(doc, 'div', 'svlive-status');
  status.setAttribute('data-live-status', '');
  status.setAttribute('role', 'status');
  stage.append(remote, local, status);
  const bar = make(doc, 'div', 'svlive-bar');
  const mute = make(doc, 'button', 'svlive-btn', 'Mute'); mute.type = 'button'; mute.setAttribute('aria-pressed', 'false'); mute.setAttribute('data-live-mute', '');
  const cam = make(doc, 'button', 'svlive-btn', 'Camera off'); cam.type = 'button'; cam.setAttribute('aria-pressed', 'false'); cam.setAttribute('data-live-camera', '');
  const end = make(doc, 'button', 'svlive-btn svlive-end', 'Hang up'); end.type = 'button'; end.setAttribute('data-live-hangup', '');
  bar.append(mute, cam, end);
  win.append(stage, bar);
  doc.body.appendChild(win);

  let current = null;
  const tracks = (kind) => (current?.local?.getTracks?.() || []).filter((t) => t.kind === kind);
  mute.addEventListener('click', () => { const on = mute.getAttribute('aria-pressed') !== 'true'; tracks('audio').forEach((t) => { t.enabled = !on; }); mute.setAttribute('aria-pressed', String(on)); mute.textContent = on ? 'Unmute' : 'Mute'; });
  cam.addEventListener('click', () => { const off = cam.getAttribute('aria-pressed') !== 'true'; tracks('video').forEach((t) => { t.enabled = !off; }); cam.setAttribute('aria-pressed', String(off)); cam.textContent = off ? 'Camera on' : 'Camera off'; });
  const finished = (p) => ['missed', 'declined', 'failed', 'ended'].includes(p);
  end.addEventListener('click', () => { if (finished(current?.phase)) { onClose(); destroy(); } else onHangup(); });

  function update(state) {
    current = state;
    if (state.local && local.srcObject !== state.local) local.srcObject = state.local;
    if (state.remote && remote.srcObject !== state.remote) remote.srcObject = state.remote;
    local.hidden = !state.local;
    const text = state.phase === 'live' ? '' : (STATUS[state.phase] || (() => ''))(who || 'They');
    status.textContent = text;
    status.hidden = !text;
    const done = finished(state.phase);
    mute.hidden = cam.hidden = done;
    end.textContent = done ? 'Close' : 'Hang up';
    end.classList.toggle('svlive-end', !done);
  }
  function destroy() { try { local.srcObject = null; remote.srcObject = null; } catch { /* jsdom */ } win.remove(); }
  return { el: win, update, destroy };
}

/** "Mike Ross wants to talk live" with Accept / Decline (a native popover where supported). */
export function showIncomingCall({ doc = globalThis.document, name = 'A prospect', campaign = '', onAccept = () => {}, onDecline = () => {} } = {}) {
  ensureCss(doc);
  const box = make(doc, 'div', 'svlive-ring');
  box.setAttribute('data-live-incoming', '');
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-label', `${name} wants to talk live`);
  const p = make(doc, 'p');
  p.append(make(doc, 'span', 'svlive-pulse'), make(doc, 'strong', '', name), doc.createTextNode(` wants to talk live${campaign ? ` about “${campaign}”` : ''}.`));
  const bar = make(doc, 'div', 'svlive-bar');
  const yes = make(doc, 'button', 'svlive-btn svlive-ok', 'Accept'); yes.type = 'button'; yes.setAttribute('data-live-accept', '');
  const no = make(doc, 'button', 'svlive-btn', 'Decline'); no.type = 'button'; no.setAttribute('data-live-decline', '');
  bar.append(yes, no);
  box.append(p, bar);
  const native = typeof box.showPopover === 'function';
  if (native) box.popover = 'manual';
  doc.body.appendChild(box);
  if (native) { try { box.showPopover(); } catch { /* already shown */ } }
  const close = () => { if (native) { try { box.hidePopover(); } catch { /* hidden */ } } box.remove(); };
  yes.addEventListener('click', () => { close(); onAccept(); });
  no.addEventListener('click', () => { close(); onDecline(); });
  yes.focus?.();
  return { el: box, close };
}
