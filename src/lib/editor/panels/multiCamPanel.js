/**
 * Multi-Cam panel: choose single / picture-in-picture / split screen, which
 * video track is the main camera and which is the second, and the window
 * settings. Everything writes `state.multiCam` and calls `services.changed()`.
 */
import { normalizeMultiCam, multiCamActive, PIP_CORNERS } from '../multiCam.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isVideoTrack = (t) => String(t.type || '').toLowerCase() === 'video';

/**
 * @param {HTMLElement} container
 * @param {object} state   editor state ({ tracks, multiCam, selectedClipId })
 * @param {object} s       { changed(), toast(msg, kind), addVideoTrack() → track, moveSelectedTo(trackId) → boolean }
 */
export function renderMultiCamPanel(container, state, s = {}) {
  if (!container) return;
  const mc = normalizeMultiCam(state.multiCam);
  state.multiCam = mc;
  const videoTracks = (state.tracks || []).filter(isVideoTrack);
  const count = (t) => (t.items || t.clips || []).length;
  const opt = (t, sel) => `<option value="${esc(t.id)}"${t.id === sel ? ' selected' : ''}>${esc(t.name || t.id)} (${count(t)} clip${count(t) === 1 ? '' : 's'})</option>`;
  const ready = multiCamActive(mc, state.tracks);
  const mode = (id, icon, label) => `<button type="button" class="mc-mode${mc.mode === id ? ' is-on' : ''}" data-mc-mode="${id}" aria-pressed="${mc.mode === id}"><span>${icon}</span>${label}</button>`;
  container.innerHTML = `<div class="pz-ui mc">
    <p class="pz-hint">Show two cameras at once. The second camera needs its own video track: add one, then move a clip onto it.</p>
    <div class="mc-modes" role="group" aria-label="Layout">${mode('single', '🎬', 'One camera')}${mode('pip', '🖼️', 'Picture in picture')}${mode('split', '◧', 'Split screen')}</div>
    <div class="mc-tracks">
      <label class="pz-field"><span class="pz-label">Main camera</span><select data-mc="main">${videoTracks.length ? videoTracks.map((t) => opt(t, mc.mainTrackId || videoTracks[0].id)).join('') : '<option value="">No video track</option>'}</select></label>
      <label class="pz-field"><span class="pz-label">Second camera</span><select data-mc="second"><option value="">None</option>${videoTracks.filter((t) => t.id !== (mc.mainTrackId || videoTracks[0]?.id)).map((t) => opt(t, mc.secondTrackId)).join('')}</select></label>
      <div class="mc-actions"><button type="button" class="pz-btn pz-btn-primary" data-mc-act="add-track">＋ Add a camera track</button>
        <button type="button" class="pz-btn" data-mc-act="move"${mc.secondTrackId && state.selectedClipId != null ? '' : ' disabled'}>Move selected clip to second camera</button></div>
    </div>
    ${mc.mode === 'pip' ? `<div class="mc-opts"><label class="pz-field"><span class="pz-label">Corner</span><select data-mc="corner">${PIP_CORNERS.map(([id, l]) => `<option value="${id}"${id === mc.pip.corner ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="pz-field"><span class="pz-label">Size <output>${mc.pip.size}%</output></span><input type="range" min="15" max="60" step="1" value="${mc.pip.size}" data-mc="size"/></label></div>` : ''}
    ${mc.mode === 'split' ? `<div class="mc-opts"><label class="pz-field"><span class="pz-label">Direction</span><select data-mc="orientation"><option value="vertical"${mc.split.orientation === 'vertical' ? ' selected' : ''}>Side by side</option><option value="horizontal"${mc.split.orientation === 'horizontal' ? ' selected' : ''}>Top and bottom</option></select></label>
      <label class="pz-field"><span class="pz-label">Main camera share <output>${Math.round(mc.split.ratio * 100)}%</output></span><input type="range" min="20" max="80" step="5" value="${Math.round(mc.split.ratio * 100)}" data-mc="ratio"/></label></div>` : ''}
    ${mc.mode !== 'single' && !ready ? '<p class="pz-warning" role="status">Choose a second camera track to see this layout.</p>' : ''}
  </div>`;

  const set = (patch) => { state.multiCam = normalizeMultiCam({ ...state.multiCam, ...patch }); s.changed?.(); renderMultiCamPanel(container, state, s); };
  container.onclick = (e) => {
    const modeBtn = e.target.closest('[data-mc-mode]');
    if (modeBtn) { set({ mode: modeBtn.dataset.mcMode, mainTrackId: mc.mainTrackId || videoTracks[0]?.id || null }); return; }
    const act = e.target.closest('[data-mc-act]')?.dataset.mcAct;
    if (act === 'add-track') {
      const t = s.addVideoTrack?.();
      if (t) { set({ mainTrackId: mc.mainTrackId || videoTracks[0]?.id || null, secondTrackId: t.id }); s.toast?.('Camera track added. Select a clip and move it here.', 'success'); }
    } else if (act === 'move') {
      if (s.moveSelectedTo?.(mc.secondTrackId)) { s.changed?.(); s.toast?.('Moved to the second camera', 'success'); renderMultiCamPanel(container, state, s); }
      else s.toast?.('Select a video clip first.', 'info');
    }
  };
  container.onchange = (e) => {
    const k = e.target.dataset?.mc;
    if (!k) return;
    const v = e.target.value;
    if (k === 'main') set({ mainTrackId: v || null, secondTrackId: v === mc.secondTrackId ? null : mc.secondTrackId });
    else if (k === 'second') set({ secondTrackId: v || null });
    else if (k === 'corner') set({ pip: { ...mc.pip, corner: v } });
    else if (k === 'orientation') set({ split: { ...mc.split, orientation: v } });
  };
  container.oninput = (e) => {
    const k = e.target.dataset?.mc;
    if (k !== 'size' && k !== 'ratio') return;
    const out = e.target.closest('label')?.querySelector('output');
    if (k === 'size') { state.multiCam = normalizeMultiCam({ ...state.multiCam, pip: { ...mc.pip, size: Number(e.target.value) } }); if (out) out.textContent = `${state.multiCam.pip.size}%`; }
    else { state.multiCam = normalizeMultiCam({ ...state.multiCam, split: { ...mc.split, ratio: Number(e.target.value) / 100 } }); if (out) out.textContent = `${Math.round(state.multiCam.split.ratio * 100)}%`; }
    s.changed?.();
  };
}
