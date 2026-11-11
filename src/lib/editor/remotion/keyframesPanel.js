/**
 * Keyframes editor for a clip: pick a property (position, scale, rotation,
 * opacity, volume or any numeric effect parameter), set a value and an
 * easing, and add a keyframe at the playhead. Existing keyframes can be
 * retimed, changed, eased differently, jumped to and removed.
 */
import {
  KEYFRAME_PROPERTIES, EASINGS, canonicalProperty, propertyDef, valueAt, setKeyframe, removeKeyframe, updateKeyframe,
} from './keyframes.js';
import { getEffectDef, effectParams } from './effects.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n) => String(Math.round(Number(n) * 1000) / 1000);

/** Animatable properties for a clip, including its effects' numeric params. */
export function keyframeTargets(clip = {}) {
  const isMedia = clip.type === 'video';
  const out = KEYFRAME_PROPERTIES.filter((p) => !p.media || isMedia).map((p) => ({ ...p }));
  (clip.effects || []).forEach((fx) => {
    const def = getEffectDef(fx.id);
    if (!def) return;
    effectParams(fx.id).filter((p) => p.type === 'number').forEach((p) => {
      out.push({ key: `fx:${fx.uid}:${p.key}`, label: `${def.label} › ${p.label}`, min: p.min, max: p.max, step: p.step, default: fx.params?.[p.key] ?? p.default });
    });
  });
  return out;
}

/**
 * @param {HTMLElement} container
 * @param {object} opts { clip, getTime() → seconds from clip start, duration (s), onChange(keyframes), onSeek(t) }
 */
export function renderKeyframesPanel(container, opts) {
  let keyframes = JSON.parse(JSON.stringify(opts.clip?.keyframes || {}));
  const targets = () => keyframeTargets(opts.clip);
  const ui = { prop: 'x', easing: 'ease-in-out', value: null };

  const emit = () => {
    opts.onChange?.(JSON.parse(JSON.stringify(keyframes)));
    draw();
  };

  const current = (key) => {
    const def = targets().find((p) => p.key === key) || propertyDef(key);
    return valueAt(keyframes[key], opts.getTime?.() || 0, def?.default ?? 0);
  };

  const draw = () => {
    const list = targets();
    if (!list.some((p) => p.key === ui.prop)) ui.prop = list[0]?.key || 'x';
    const def = list.find((p) => p.key === ui.prop) || list[0];
    const value = ui.value ?? current(ui.prop);
    const t = Math.max(0, opts.getTime?.() || 0);
    const animated = Object.entries(keyframes).filter(([, l]) => Array.isArray(l) && l.length);
    const label = (key) => (list.find((p) => p.key === key) || propertyDef(key) || { label: key }).label;
    container.innerHTML = `
      <div class="kf-panel">
        <h4 class="addon-panel__heading">Keyframes</h4>
        <label class="cap-row"><span>Property</span><select data-kf-prop>${list.map((p) => `<option value="${esc(p.key)}" ${p.key === ui.prop ? 'selected' : ''}>${esc(p.label)}${keyframes[p.key]?.length ? ' ◆' : ''}</option>`).join('')}</select></label>
        <label class="cap-row"><span>Value</span>
          <span class="kf-value"><input type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${esc(value)}" data-kf-range aria-label="Value"/>
          <input type="number" min="${def.min}" max="${def.max}" step="${def.step}" value="${esc(fmt(value))}" data-kf-num aria-label="Value"/></span></label>
        <label class="cap-row"><span>Easing</span><select data-kf-easing>${EASINGS.map(([v, l]) => `<option value="${v}" ${v === ui.easing ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <button type="button" class="mini-btn cap-primary" data-kf-add>◆ Add keyframe at ${fmt(t)}s</button>
        ${animated.length ? animated.map(([key, kfs]) => `
          <div class="kf-group">
            <div class="kf-group__head"><strong>${esc(label(key))}</strong><button type="button" class="mini-btn" data-kf-clear="${esc(key)}">Clear</button></div>
            <ol class="kf-list">${kfs.map((k, i) => `
              <li class="kf-item">
                <button type="button" class="mini-btn" data-kf-seek="${esc(key)}|${i}" aria-label="Go to keyframe">◆</button>
                <input type="number" step="0.05" min="0" value="${esc(fmt(k.t))}" data-kf-t="${esc(key)}|${i}" aria-label="Time (s)"/>
                <input type="number" step="any" value="${esc(fmt(k.v))}" data-kf-v="${esc(key)}|${i}" aria-label="Value"/>
                <select data-kf-e="${esc(key)}|${i}" aria-label="Easing">${EASINGS.map(([v, l]) => `<option value="${v}" ${v === (k.easing || 'linear') ? 'selected' : ''}>${l}</option>`).join('')}</select>
                <button type="button" class="mini-btn" data-kf-del="${esc(key)}|${i}" aria-label="Delete keyframe">✕</button>
              </li>`).join('')}</ol>
          </div>`).join('') : '<p class="addon-field__hint">No keyframes. Move the playhead, set a value and add a keyframe; add a second one elsewhere to animate between them.</p>'}
      </div>`;
  };

  const ref = (s) => { const [k, i] = String(s).split('|'); return [k, Number(i)]; };

  const onInput = (e) => {
    const el = e.target;
    if (el.dataset.kfRange !== undefined || el.dataset.kfNum !== undefined) {
      ui.value = Number(el.value);
      const other = container.querySelector(el.dataset.kfRange !== undefined ? '[data-kf-num]' : '[data-kf-range]');
      if (other) other.value = el.value;
    }
  };
  const onChangeEvt = (e) => {
    const el = e.target;
    if (el.dataset.kfProp !== undefined) { ui.prop = el.value; ui.value = null; draw(); }
    else if (el.dataset.kfEasing !== undefined) ui.easing = el.value;
    else if (el.dataset.kfT) { const [k, i] = ref(el.dataset.kfT); keyframes = updateKeyframe(keyframes, k, i, { t: Math.max(0, Number(el.value) || 0) }); emit(); }
    else if (el.dataset.kfV) { const [k, i] = ref(el.dataset.kfV); keyframes = updateKeyframe(keyframes, k, i, { v: Number(el.value) || 0 }); emit(); }
    else if (el.dataset.kfE) { const [k, i] = ref(el.dataset.kfE); keyframes = updateKeyframe(keyframes, k, i, { easing: el.value }); emit(); }
  };
  const onClick = (e) => {
    const b = e.target.closest('button');
    if (!b || !container.contains(b)) return;
    const d = b.dataset;
    if (d.kfAdd !== undefined) {
      const t = Math.max(0, Math.min(opts.duration ?? Infinity, opts.getTime?.() || 0));
      keyframes = setKeyframe(keyframes, ui.prop, t, ui.value ?? current(ui.prop), ui.easing);
      ui.value = null;
      emit();
    } else if (d.kfDel) { const [k, i] = ref(d.kfDel); keyframes = removeKeyframe(keyframes, k, i); emit(); }
    else if (d.kfClear) { delete keyframes[canonicalProperty(d.kfClear)]; emit(); }
    else if (d.kfSeek) { const [k, i] = ref(d.kfSeek); const kf = keyframes[k]?.[i]; if (kf) opts.onSeek?.(kf.t); }
  };

  container.addEventListener('input', onInput);
  container.addEventListener('change', onChangeEvt);
  container.addEventListener('click', onClick);
  draw();
  return {
    refresh() { if (!container.contains(document.activeElement)) { ui.value = null; draw(); } },
    destroy() {
      container.removeEventListener('input', onInput);
      container.removeEventListener('change', onChangeEvt);
      container.removeEventListener('click', onClick);
    },
    get keyframes() { return JSON.parse(JSON.stringify(keyframes)); },
  };
}
