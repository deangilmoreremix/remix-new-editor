/**
 * Keyframe lanes (CineGen): one lane per animated property under the clip,
 * with draggable diamonds. Edits the same `clip.keyframes` data the
 * Keyframes panel edits, so both always agree.
 *
 *   drag a diamond  → move it in time
 *   click a lane    → add a keyframe there (value follows the current curve)
 *   double-click    → remove it (or Delete when focused)
 *   "+ Animate"     → start animating another property at the playhead
 */
import { KEYFRAME_PROPERTIES, propertyDef, valueAt, setKeyframe, removeKeyframe } from './remotion/keyframes.js';
import { moveKeyframeTime } from './editTools.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const labelFor = (key) => propertyDef(key)?.label || key.replace(/^fx:[^:]+:/, 'Effect: ');
const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100);

/**
 * @param {HTMLElement} container
 * @param {object} opts { clip, duration (s), getTime() → s from clip start, onSeek(t), onChange(keyframes) }
 */
export function renderKeyframeLanes(container, { clip, duration, getTime, onSeek, onChange } = {}) {
  const dur = Math.max(0.1, Number(duration) || 1);
  const props = () => Object.keys(clip.keyframes || {}).filter((k) => Array.isArray(clip.keyframes[k]) && clip.keyframes[k].length);

  const draw = () => {
    const keys = props();
    const addable = KEYFRAME_PROPERTIES.filter((p) => !keys.includes(p.key) && (!p.media || clip.type === 'video' || clip.type === 'audio'));
    container.innerHTML = `
      <div class="bg-panel kf-lanes">
        <h4 class="addon-panel__heading">Keyframe lanes</h4>
        ${keys.length ? '' : '<p class="addon-field__hint">No animation yet. Pick a property to start.</p>'}
        ${keys.map((k) => `
          <div class="kf-lane-row" data-prop="${esc(k)}" style="display:flex;align-items:center;gap:6px;margin:3px 0">
            <span style="width:92px;font-size:11px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(labelFor(k))}">${esc(labelFor(k))}</span>
            <div class="kf-lane" data-lane="${esc(k)}" style="position:relative;flex:1;height:22px;background:rgba(255,255,255,.06);border-radius:4px;cursor:copy" aria-label="${esc(labelFor(k))} lane">
              ${clip.keyframes[k].map((kf, i) => `<button type="button" class="kf-dia" data-prop="${esc(k)}" data-i="${i}" title="${fmt(kf.t)}s · ${fmt(kf.v)}" aria-label="${esc(labelFor(k))} keyframe at ${fmt(kf.t)} seconds" style="position:absolute;top:3px;left:calc(${(kf.t / dur) * 100}% - 8px);width:16px;height:16px;padding:0;border:0;background:var(--accent,#d9ff00);transform:rotate(45deg) scale(.72);border-radius:2px;cursor:ew-resize"></button>`).join('')}
              <span class="kf-head" style="position:absolute;top:0;bottom:0;width:1px;background:#f87171;pointer-events:none;left:${Math.min(100, Math.max(0, ((getTime?.() ?? 0) / dur) * 100))}%"></span>
            </div>
          </div>`).join('')}
        <select data-kf-add aria-label="Animate another property"><option value="">+ Animate…</option>${addable.map((p) => `<option value="${p.key}">${esc(p.label)}</option>`).join('')}</select>
      </div>`;
  };

  const commit = (kf) => {
    clip.keyframes = kf;
    onChange?.(kf);
    draw();
  };

  const timeFromEvent = (lane, e) => {
    const r = lane.getBoundingClientRect();
    return Math.max(0, Math.min(dur, ((e.clientX - r.left) / (r.width || 1)) * dur));
  };

  let drag = null;
  const onDown = (e) => {
    const dia = e.target.closest('.kf-dia');
    if (!dia || !container.contains(dia)) return;
    e.preventDefault();
    dia.setPointerCapture?.(e.pointerId);
    drag = { prop: dia.dataset.prop, i: Number(dia.dataset.i), lane: dia.closest('.kf-lane'), el: dia, moved: false };
    onSeek?.(clip.keyframes[drag.prop][drag.i].t);
  };
  const onMove = (e) => {
    if (!drag) return;
    drag.moved = true;
    const t = timeFromEvent(drag.lane, e);
    drag.t = t;
    drag.el.style.left = `calc(${(t / dur) * 100}% - 8px)`;
  };
  const onUp = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.moved && d.t != null) commit(moveKeyframeTime(clip.keyframes, d.prop, d.i, d.t, dur));
  };
  const onClick = (e) => {
    if (e.target.closest('.kf-dia')) return; // handled by drag / dblclick
    const lane = e.target.closest('.kf-lane');
    if (!lane || !container.contains(lane)) return;
    const prop = lane.dataset.lane;
    const t = Math.round(timeFromEvent(lane, e) * 100) / 100;
    const def = propertyDef(prop);
    const v = valueAt(clip.keyframes[prop], t, def?.default ?? 0);
    commit(setKeyframe(clip.keyframes, prop, t, v));
  };
  const onDbl = (e) => {
    const dia = e.target.closest('.kf-dia');
    if (!dia) return;
    commit(removeKeyframe(clip.keyframes, dia.dataset.prop, Number(dia.dataset.i)));
  };
  const onKey = (e) => {
    const dia = e.target.closest?.('.kf-dia');
    if (dia && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      e.stopPropagation();
      commit(removeKeyframe(clip.keyframes, dia.dataset.prop, Number(dia.dataset.i)));
    }
  };
  const onChangeEvt = (e) => {
    if (e.target.dataset.kfAdd === undefined || !e.target.value) return;
    const key = e.target.value;
    const t = Math.max(0, Math.min(dur, Number(getTime?.() ?? 0)));
    commit(setKeyframe(clip.keyframes || {}, key, Math.round(t * 100) / 100, valueAt(clip.keyframes?.[key], t, propertyDef(key)?.default ?? 0)));
  };

  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerup', onUp);
  container.addEventListener('pointercancel', onUp);
  container.addEventListener('click', onClick);
  container.addEventListener('dblclick', onDbl);
  container.addEventListener('keydown', onKey);
  container.addEventListener('change', onChangeEvt);
  draw();
  return {
    refresh: draw,
    destroy() {
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onUp);
      container.removeEventListener('click', onClick);
      container.removeEventListener('dblclick', onDbl);
      container.removeEventListener('keydown', onKey);
      container.removeEventListener('change', onChangeEvt);
    },
  };
}
