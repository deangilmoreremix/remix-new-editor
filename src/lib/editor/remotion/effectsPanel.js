/**
 * Effects & Color panel for a clip (video/image clips, image/sticker
 * overlays). Edits clip.effects = [{ uid, id, params, enabled }].
 *
 *   Color       quick sliders over a single `color-correction` effect,
 *               a LUT (.cube) loader and Green screen (`color-key`)
 *   Effects     the full @remotion/effects stack: add (by category or
 *               search), enable/disable, reorder, remove, edit parameters
 */
import { renderAddonEditor } from '../addons/addonEditor.js';
import {
  EFFECT_CATEGORIES, listEffects, getEffectDef, effectFields, createEffect, defaultEffectParams,
} from './effects.js';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Quick color controls: [param, label, min, max, step]. */
export const COLOR_CONTROLS = [
  ['exposure', 'Exposure', -2, 2, 0.05],
  ['contrast', 'Contrast', 0, 2, 0.01],
  ['saturation', 'Saturation', 0, 2, 0.01],
  ['vibrance', 'Vibrance', -1, 1, 0.01],
  ['temperature', 'Temperature', -1, 1, 0.01],
  ['tint', 'Tint', -1, 1, 0.01],
  ['highlights', 'Highlights', -1, 1, 0.01],
  ['shadows', 'Shadows', -1, 1, 0.01],
];

const clone = (x) => JSON.parse(JSON.stringify(x || []));

export function renderEffectsPanel(container, { effects = [], onChange, onError } = {}) {
  let stack = clone(effects);
  const ui = { open: null, adding: false, query: '', category: 'Color' };
  const editors = [];

  const commit = (redraw = true) => {
    onChange?.(clone(stack));
    if (redraw) draw();
  };
  const colorFx = () => stack.find((e) => e.id === 'color-correction');
  const keyFx = () => stack.find((e) => e.id === 'color-key');
  const lutFx = () => stack.find((e) => e.id === 'lut');

  const draw = () => {
    editors.splice(0).forEach((ed) => ed.destroy());
    const cc = colorFx();
    const ccp = { ...defaultEffectParams('color-correction'), ...(cc?.params || {}) };
    const key = keyFx();
    const lut = lutFx();
    const effectsList = stack.map((fx, i) => {
      const def = getEffectDef(fx.id);
      return `<li class="fx-item${fx.enabled === false ? ' is-off' : ''}" data-uid="${esc(fx.uid)}">
        <div class="fx-item__row">
          <label class="fx-item__toggle" title="Enable / disable"><input type="checkbox" data-fx-toggle="${esc(fx.uid)}" ${fx.enabled === false ? '' : 'checked'}/></label>
          <button type="button" class="fx-item__name" data-fx-open="${esc(fx.uid)}" aria-expanded="${ui.open === fx.uid}">${esc(def?.label || fx.id)}</button>
          <button type="button" class="mini-btn" data-fx-up="${esc(fx.uid)}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
          <button type="button" class="mini-btn" data-fx-down="${esc(fx.uid)}" ${i === stack.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
          <button type="button" class="mini-btn" data-fx-remove="${esc(fx.uid)}" aria-label="Remove ${esc(def?.label || fx.id)}">✕</button>
        </div>
        ${ui.open === fx.uid ? `<div class="fx-item__params" data-fx-params="${esc(fx.uid)}"></div>` : ''}
      </li>`;
    }).join('');

    const q = ui.query.trim().toLowerCase();
    const catalog = listEffects().filter((e) => (q ? (e.label.toLowerCase().includes(q) || e.id.includes(q)) : e.category === ui.category));
    container.innerHTML = `
      <div class="fx-panel">
        <h4 class="addon-panel__heading">Color</h4>
        <div class="fx-color">
          ${COLOR_CONTROLS.map(([k, label, min, max, step]) => `
            <label class="fx-color__row"><span>${label}</span>
              <input type="range" min="${min}" max="${max}" step="${step}" value="${esc(ccp[k] ?? 0)}" data-cc="${k}" aria-label="${label}"/>
              <output>${Number(ccp[k] ?? 0).toFixed(2)}</output></label>`).join('')}
          <div class="fx-color__actions">
            <button type="button" class="mini-btn" data-cc-reset ${cc ? '' : 'disabled'}>Reset color</button>
            <label class="mini-btn addon-upload-btn" title="Apply a 3D .cube look-up table">${lut ? 'Replace LUT' : 'Load LUT (.cube)'}<input type="file" accept=".cube,text/plain" data-lut-file hidden/></label>
            ${lut ? `<button type="button" class="mini-btn" data-lut-remove>Remove LUT${lut.params?.contentName ? ` (${esc(lut.params.contentName)})` : ''}</button>` : ''}
          </div>
          <label class="fx-color__row fx-color__key"><span>Green screen</span>
            <input type="checkbox" data-key-toggle ${key && key.enabled !== false ? 'checked' : ''}/>
            ${key ? `<input type="color" data-key-color value="${esc(key.params?.keyColor || '#00ff00')}" aria-label="Key color"/>
            <input type="range" min="0" max="1" step="0.01" value="${esc(key.params?.similarity ?? 0.18)}" data-key-sim aria-label="Similarity"/>` : ''}
          </label>
        </div>

        <h4 class="addon-panel__heading">Effects</h4>
        ${stack.length ? `<ul class="fx-list">${effectsList}</ul>` : '<p class="addon-field__hint">No effects yet.</p>'}
        <button type="button" class="mini-btn" data-fx-add-toggle style="width:100%">${ui.adding ? 'Close effects library' : '＋ Add effect'}</button>
        ${ui.adding ? `
          <div class="fx-library">
            <input type="search" class="fx-search" placeholder="Search ${listEffects().length} effects" value="${esc(ui.query)}" aria-label="Search effects"/>
            ${q ? '' : `<div class="addon-tabs fx-cats">${EFFECT_CATEGORIES.map((c) => `<button type="button" class="mini-btn addon-tab${c === ui.category ? ' active' : ''}" data-fx-cat="${c}">${c}</button>`).join('')}</div>`}
            <div class="fx-grid">${catalog.map((e) => `<button type="button" class="fx-chip" data-fx-add="${e.id}" title="${esc(e.category)}">${esc(e.label)}</button>`).join('') || '<p class="addon-field__hint">No match.</p>'}</div>
          </div>` : ''}
      </div>`;

    if (ui.open) {
      const fx = stack.find((e) => e.uid === ui.open);
      const host = container.querySelector(`[data-fx-params="${CSS && CSS.escape ? CSS.escape(ui.open) : ui.open}"]`);
      if (fx && host) {
        editors.push(renderAddonEditor(host, {
          fields: effectFields(fx.id),
          options: fx.params,
          idPrefix: `fx-${fx.uid}`,
          services: { onError },
          onChange: (next) => {
            fx.params = next;
            commit(false);
          },
        }));
      }
    }
  };

  const setColor = (k, v) => {
    let cc = colorFx();
    if (!cc) {
      cc = createEffect('color-correction');
      stack.unshift(cc);
    }
    cc.params = { ...cc.params, [k]: v };
    commit(false);
  };

  const onInput = (e) => {
    const el = e.target;
    if (el.dataset.cc) {
      el.nextElementSibling.textContent = Number(el.value).toFixed(2);
      setColor(el.dataset.cc, Number(el.value));
    } else if (el.dataset.keyColor !== undefined || el.dataset.keySim !== undefined) {
      const key = keyFx();
      if (!key) return;
      if (el.dataset.keyColor !== undefined) key.params = { ...key.params, keyColor: el.value };
      else key.params = { ...key.params, similarity: Number(el.value) };
      commit(false);
    } else if (el.classList.contains('fx-search')) {
      ui.query = el.value;
      const pos = el.selectionStart;
      draw();
      const again = container.querySelector('.fx-search');
      again?.focus();
      again?.setSelectionRange(pos, pos);
    }
  };

  const onChangeEvt = (e) => {
    const el = e.target;
    if (el.dataset.fxToggle) {
      const fx = stack.find((x) => x.uid === el.dataset.fxToggle);
      if (fx) { fx.enabled = el.checked; commit(); }
    } else if (el.dataset.keyToggle !== undefined) {
      let key = keyFx();
      if (el.checked) {
        if (!key) { key = createEffect('color-key'); stack.unshift(key); }
        key.enabled = true;
      } else if (key) {
        stack = stack.filter((x) => x !== key);
      }
      commit();
    } else if (el.dataset.lutFile !== undefined && el.files?.[0]) {
      const file = el.files[0];
      file.text().then((text) => {
        if (!/LUT_3D_SIZE\s+\d+/.test(text)) {
          onError?.(new Error('That file is not a 3D .cube LUT'));
          return;
        }
        let lut = lutFx();
        if (!lut) { lut = createEffect('lut'); stack.push(lut); }
        lut.params = { content: text, contentName: file.name };
        commit();
      });
    }
  };

  const onClick = (e) => {
    const btn = e.target.closest('button');
    if (!btn || !container.contains(btn)) return;
    const d = btn.dataset;
    const idx = (uid) => stack.findIndex((x) => x.uid === uid);
    if (d.fxAddToggle !== undefined) { ui.adding = !ui.adding; draw(); }
    else if (d.fxCat) { ui.category = d.fxCat; draw(); }
    else if (d.fxAdd) {
      const fx = createEffect(d.fxAdd);
      stack.push(fx);
      ui.open = fx.uid;
      ui.adding = false;
      commit();
    } else if (d.fxOpen) { ui.open = ui.open === d.fxOpen ? null : d.fxOpen; draw(); }
    else if (d.fxRemove) { stack.splice(idx(d.fxRemove), 1); commit(); }
    else if (d.fxUp) { const i = idx(d.fxUp); if (i > 0) { [stack[i - 1], stack[i]] = [stack[i], stack[i - 1]]; commit(); } }
    else if (d.fxDown) { const i = idx(d.fxDown); if (i >= 0 && i < stack.length - 1) { [stack[i + 1], stack[i]] = [stack[i], stack[i + 1]]; commit(); } }
    else if (d.ccReset !== undefined) { stack = stack.filter((x) => x.id !== 'color-correction'); commit(); }
    else if (d.lutRemove !== undefined) { stack = stack.filter((x) => x.id !== 'lut'); commit(); }
  };

  container.addEventListener('input', onInput);
  container.addEventListener('change', onChangeEvt);
  container.addEventListener('click', onClick);
  draw();
  return {
    destroy() {
      editors.splice(0).forEach((ed) => ed.destroy());
      container.removeEventListener('input', onInput);
      container.removeEventListener('change', onChangeEvt);
      container.removeEventListener('click', onClick);
    },
    get effects() { return clone(stack); },
  };
}
