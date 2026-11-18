/**
 * Clip editor section "Edit": the CineGen editing controls for one clip —
 * speed, flip, a source monitor with In/Out points, audio sync and proxy
 * playback. The page performs the edits through `ops` (one undo step each).
 */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

/**
 * @param {HTMLElement} container
 * @param {object} opts {
 *   clip, durationSec (on the timeline), proxyOn (bool),
 *   ops: { setSpeed(rate), toggleFlip('h'|'v'), setInOut(inSec, outSec), syncAudio() → Promise<string>,
 *          setProxy(on, onProgress) → Promise, addMarker() }
 * }
 */
export function renderEditPanel(container, { clip, durationSec = 0, proxyOn = false, ops = {} } = {}) {
  const isVideo = clip?.type === 'video';
  const isAudio = clip?.type === 'audio';
  const isVisual = isVideo || clip?.type === 'image' || clip?.type === 'overlay-image';
  const rate = Number(clip?.playbackRate ?? clip?.speed ?? 1) || 1;
  const inSec = Number(clip?.trimIn ?? clip?.sourceStart ?? 0) || 0;
  const ui = { in: inSec, out: inSec + durationSec * rate, msg: '', busy: false, proxyOn };

  const draw = () => {
    container.innerHTML = `
      <div class="bg-panel edit-tools-panel">
        <h4 class="addon-panel__heading">Edit</h4>
        ${ui.msg ? `<p class="addon-field__hint" role="status">${esc(ui.msg)}</p>` : ''}
        ${isVideo || isAudio ? `
          <label class="cap-row"><span>Speed</span><select data-ed-speed aria-label="Playback speed">
            ${SPEEDS.map((s) => `<option value="${s}" ${Math.abs(s - rate) < 1e-3 ? 'selected' : ''}>${s}×</option>`).join('')}
            ${SPEEDS.some((s) => Math.abs(s - rate) < 1e-3) ? '' : `<option value="${rate}" selected>${rate}×</option>`}
          </select></label>
          <p class="addon-field__hint">The clip resizes so it still shows the same footage.</p>` : ''}
        ${isVisual ? `
          <div class="cap-row"><span>Flip</span>
            <span style="display:flex;gap:6px">
              <button type="button" class="mini-btn ${clip.flipH ? 'active' : ''}" data-ed="flip-h" aria-pressed="${!!clip.flipH}">↔ Horizontal</button>
              <button type="button" class="mini-btn ${clip.flipV ? 'active' : ''}" data-ed="flip-v" aria-pressed="${!!clip.flipV}">↕ Vertical</button>
            </span></div>` : ''}
        ${(isVideo || isAudio) && clip.src ? `
          <details class="ai-local-group"><summary>Source monitor (In / Out)</summary>
            ${isVideo ? '<video data-ed-src muted playsinline controls preload="metadata" style="width:100%;max-height:180px;background:#000"></video>'
              : '<audio data-ed-src controls preload="metadata" style="width:100%"></audio>'}
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px">
              <button type="button" class="mini-btn" data-ed="mark-in">Set In (I)</button>
              <button type="button" class="mini-btn" data-ed="mark-out">Set Out (O)</button>
              <span class="addon-field__hint" data-ed-range>In ${fmt(ui.in)} · Out ${fmt(ui.out)} · ${(ui.out - ui.in).toFixed(2)}s</span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
              <button type="button" class="mini-btn" data-ed="step-back" aria-label="Back one frame" title="Back one frame (,)">◀ Frame</button>
              <button type="button" class="mini-btn" data-ed="step-fwd" aria-label="Forward one frame" title="Forward one frame (.)">Frame ▶</button>
              <button type="button" class="mini-btn" data-ed="goto-in">Go to In</button>
              <button type="button" class="mini-btn" data-ed="goto-out">Go to Out</button>
            </div>
            <button type="button" class="mini-btn cap-primary" data-ed="apply-inout">Use this range</button>
          </details>` : ''}
        ${isAudio ? `<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="mini-btn" data-ed="sync" ${ui.busy ? 'disabled' : ''}>Sync to the video (match sound)</button>
          <button type="button" class="mini-btn" data-ed="sync-all" ${ui.busy ? 'disabled' : ''}>Sync every audio clip</button></div>` : ''}
        ${(isVideo || isAudio) && clip.src ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          <button type="button" class="mini-btn" data-ed="humanize" ${ui.busy ? 'disabled' : ''} title="Move the clip's start and end into the nearest silence so cuts never land mid-word">Humanize cut</button>
          <button type="button" class="mini-btn ${clip.linkId ? 'active' : ''}" data-ed="link" aria-pressed="${!!clip.linkId}" title="Linked clips move and trim together">${clip.linkId ? '🔗 Unlink' : '🔗 Link audio & video'}</button></div>` : ''}
        ${isVideo ? `
          <label style="display:flex;gap:6px;align-items:center;font-size:12px;margin-top:6px">
            <input type="checkbox" data-ed-proxy ${ui.proxyOn ? 'checked' : ''} ${ui.busy ? 'disabled' : ''}/>
            Proxy playback (low-res copies for smoother preview; export always uses the originals)
          </label>` : ''}
        <button type="button" class="mini-btn" data-ed="marker" style="margin-top:6px">Add marker at playhead (Shift+M)</button>
      </div>`;
    const media = container.querySelector('[data-ed-src]');
    if (media) {
      media.src = clip.src;
      media.addEventListener('loadedmetadata', () => { try { media.currentTime = ui.in; } catch { /* ignore */ } }, { once: true });
    }
  };

  const range = () => {
    const el = container.querySelector('[data-ed-range]');
    if (el) el.textContent = `In ${fmt(ui.in)} · Out ${fmt(ui.out)} · ${(ui.out - ui.in).toFixed(2)}s`;
  };
  const media = () => container.querySelector('[data-ed-src]');
  const say = (m) => { ui.msg = m; draw(); };

  const handlers = {
    'flip-h': () => { ops.toggleFlip?.('h'); draw(); },
    'flip-v': () => { ops.toggleFlip?.('v'); draw(); },
    'mark-in': () => { ui.in = media()?.currentTime ?? ui.in; if (ui.out <= ui.in) ui.out = ui.in + 1; range(); },
    'mark-out': () => { ui.out = media()?.currentTime ?? ui.out; if (ui.out <= ui.in) ui.in = Math.max(0, ui.out - 1); range(); },
    'apply-inout': () => { ops.setInOut?.(ui.in, ui.out); say(`Clip now shows ${fmt(ui.in)}–${fmt(ui.out)}`); },
    'step-back': () => { const m = media(); if (m) m.currentTime = Math.max(0, m.currentTime - 1 / 30); },
    'step-fwd': () => { const m = media(); if (m) m.currentTime += 1 / 30; },
    'goto-in': () => { const m = media(); if (m) m.currentTime = ui.in; },
    'goto-out': () => { const m = media(); if (m) m.currentTime = ui.out; },
    link: () => { if (ops.toggleLink?.() !== false) draw(); },
    humanize: async () => {
      ui.busy = true; say('Listening for silences…');
      try { await ops.humanize?.(); say('Done'); } catch (err) { say(err?.message || 'Humanize failed'); } finally { ui.busy = false; draw(); }
    },
    'sync-all': async () => {
      ui.busy = true; say('Listening to every audio clip…');
      try { say(await ops.syncAll?.() || 'Synced'); } catch (err) { say(err?.message || 'Sync failed'); } finally { ui.busy = false; draw(); }
    },
    sync: async () => {
      ui.busy = true; say('Listening to both clips…');
      try { say(await ops.syncAudio?.() || 'Synced'); } catch (err) { say(err?.message || 'Sync failed'); } finally { ui.busy = false; draw(); }
    },
    marker: () => ops.addMarker?.(),
  };

  const onClick = (e) => {
    const b = e.target.closest('[data-ed]');
    if (b && container.contains(b)) handlers[b.dataset.ed]?.();
  };
  const onChange = async (e) => {
    if (e.target.dataset.edSpeed !== undefined) { ops.setSpeed?.(Number(e.target.value)); return; }
    if (e.target.dataset.edProxy !== undefined) {
      const on = e.target.checked;
      ui.busy = true;
      say(on ? 'Making proxies…' : 'Proxy playback off');
      try {
        await ops.setProxy?.(on, (p) => { const st = container.querySelector('[role=status]'); if (st) st.textContent = `Making proxies… ${Math.round(p * 100)}%`; });
        ui.proxyOn = on;
        say(on ? 'Proxy playback on' : 'Proxy playback off');
      } catch (err) {
        ui.proxyOn = false;
        say(err?.message || 'Proxy failed');
      } finally { ui.busy = false; draw(); }
    }
  };
  const onKey = (e) => {
    if (!media() || !container.contains(document.activeElement)) return;
    if (e.key === 'i' || e.key === 'I') { e.preventDefault(); e.stopPropagation(); handlers['mark-in'](); }
    else if (e.key === 'o' || e.key === 'O') { e.preventDefault(); e.stopPropagation(); handlers['mark-out'](); }
  };

  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
  container.addEventListener('keydown', onKey);
  draw();
  return {
    destroy() {
      container.removeEventListener('click', onClick);
      container.removeEventListener('change', onChange);
      container.removeEventListener('keydown', onKey);
      media()?.removeAttribute('src');
    },
  };
}
