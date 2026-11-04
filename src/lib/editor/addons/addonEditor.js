/**
 * Schema-driven settings form for addons.
 *
 * Replaces upstream's per-plugin React settings components
 * (components/settings/*) with one renderer driven by a descriptor's
 * `fields` array. Supported field types:
 *   number, text, textarea, url, color, toggle, select, fieldList
 * Keys may be dot paths ('style.buttonColor').
 */

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let target = obj;
  for (const k of keys) {
    if (target[k] == null || typeof target[k] !== 'object') target[k] = {};
    target = target[k];
  }
  target[last] = value;
  return obj;
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function slugify(label, existing) {
  const base = String(label || 'field').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field';
  let id = base;
  let n = 2;
  while (existing.has(id)) id = `${base}_${n++}`;
  return id;
}

const ANIM_PHASES = [['in', 'In'], ['idle', 'Idle'], ['out', 'Out']];
const POSITION_PRESETS = [
  ['left', '⇤', 'Align left'], ['center', '↔', 'Center horizontally'], ['right', '⇥', 'Align right'],
  ['top', '⤒', 'Align top'], ['middle', '↕', 'Center vertically'], ['bottom', '⤓', 'Align bottom'],
];
const STICKER_TABS = [['emoticons', 'Emoticons'], ['shapes', 'Shapes'], ['animated', 'Animated']];

function renderField(field, options, idPrefix, ui = {}, services = {}) {
  const value = getPath(options, field.key);
  const id = `${idPrefix}-${field.key.replace(/\./g, '-')}`;
  const label = `<label for="${id}">${esc(field.label)}</label>`;
  switch (field.type) {
    case 'toggle':
      return `<div class="clip-editor__field addon-field addon-field--toggle"><label><input id="${id}" type="checkbox" data-key="${field.key}" data-kind="toggle" ${value ? 'checked' : ''}/> ${esc(field.label)}</label></div>`;
    case 'range':
      return `<div class="clip-editor__field addon-field">${label}<div class="addon-field__range"><input id="${id}" type="range" data-key="${field.key}" data-kind="number" value="${esc(value ?? 0)}" min="${field.min ?? 0}" max="${field.max ?? 100}" step="${field.step ?? 1}"/><output>${esc(value ?? 0)}</output></div></div>`;
    case 'number':
      return `<div class="clip-editor__field addon-field">${label}<input id="${id}" type="number" data-key="${field.key}" data-kind="number" value="${esc(value ?? 0)}"${field.min != null ? ` min="${field.min}"` : ''}${field.max != null ? ` max="${field.max}"` : ''}${field.step != null ? ` step="${field.step}"` : ''}/></div>`;
    case 'textarea':
      return `<div class="clip-editor__field addon-field">${label}<textarea id="${id}" rows="${field.rows || 2}" data-key="${field.key}" data-kind="text"${field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : ''}>${esc(value)}</textarea></div>`;
    case 'font':
      return `<div class="clip-editor__field addon-field">${label}<select id="${id}" data-key="${field.key}" data-kind="select" class="addon-font-select">${(field.options || [])
        .map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
    case 'tokens': {
      // Text with personalization tokens; the select inserts {{token}} at
      // the cursor (upstream's Personalize button).
      const tokens = field.tokenFilter === 'image'
        ? [['image', 'Image'], ['d image "https://"', 'Image with fallback URL']]
        : (services.tokens || []);
      return `<div class="clip-editor__field addon-field addon-field--tokens">${label}
        <textarea id="${id}" rows="${field.rows || 3}" data-key="${field.key}" data-kind="text"${field.maxLength ? ` maxlength="${field.maxLength}"` : ''}>${esc(value)}</textarea>
        ${tokens.length ? `<select class="addon-token-insert" data-token-for="${id}" aria-label="Insert personalization token"><option value="">+ Personalize: insert token…</option>${tokens.map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join('')}</select>` : ''}
      </div>`;
    }
    case 'image': {
      const media = (services.mediaImages?.() || []).slice(0, 24);
      return `<div class="clip-editor__field addon-field addon-field--image">${label}
        ${value ? `<div class="addon-image-preview" style="background-image:url(${esc(JSON.stringify(String(value)))})"></div>` : ''}
        <input id="${id}" type="url" placeholder="https://… image URL" data-key="${field.key}" data-kind="text" value="${esc(value)}"/>
        <div class="addon-image-actions">
          <label class="mini-btn addon-upload-btn">Upload<input type="file" accept="image/*" data-image-upload="${field.key}" hidden /></label>
        </div>
        ${media.length ? `<div class="addon-image-library" role="list" aria-label="Media library images">${media.map((m) => `<button type="button" role="listitem" class="addon-image-thumb" data-image-pick="${esc(m.src)}" data-pick-key="${field.key}" title="${esc(m.name || '')}" style="background-image:url(${esc(JSON.stringify(String(m.src)))})"></button>`).join('')}</div>` : ''}
      </div>`;
    }
    case 'animation': {
      const a = value || {};
      return `<div class="clip-editor__field addon-field addon-field--animation"><label>${esc(field.label)}</label>
        ${ANIM_PHASES.map(([phase, phaseLabel]) => `<label class="addon-anim-row">${phaseLabel}
          <select data-key="${field.key}.${phase}" data-kind="select-null">
            <option value="">None</option>
            ${((field.animations || {})[phase] || []).map(([v, l]) => `<option value="${esc(v)}" ${a[phase] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          </select></label>`).join('')}
      </div>`;
    }
    case 'position':
      return `<div class="clip-editor__field addon-field addon-field--position"><label>${esc(field.label)}</label>
        <div class="addon-position-grid">${POSITION_PRESETS.map(([v, icon, title]) => `<button type="button" class="mini-btn" data-position-key="${field.key}" data-position-value="${v}" title="${title}" aria-label="${title}">${icon}</button>`).join('')}</div>
      </div>`;
    case 'stickerPicker': {
      const tab = ui.stickerTab || 'emoticons';
      const lib = services.stickers || {};
      const grid = tab === 'animated'
        ? `<div class="addon-sticker-animated">
            <p class="addon-field__hint">Paste a Lottie animation URL (.json) or upload a .json file.</p>
            <input type="url" class="addon-lottie-url" placeholder="https://…/animation.json" value="${options.kind === 'lottie' ? esc(value) : ''}"/>
            <div class="addon-image-actions">
              <button type="button" class="mini-btn" data-lottie-use="${field.key}">Use animation</button>
              <label class="mini-btn addon-upload-btn">Upload .json<input type="file" accept="application/json,.json" data-lottie-upload="${field.key}" hidden /></label>
            </div>
          </div>`
        : `<div class="addon-sticker-grid" role="list">${(lib[tab] || []).map((st) => `<button type="button" role="listitem" class="addon-sticker${st.src === value ? ' is-on' : ''}" data-sticker-src="${esc(st.src)}" data-sticker-name="${esc(st.name)}" data-pick-key="${field.key}" title="${esc(st.name)}"><img src="${esc(st.src)}" alt="${esc(st.name)}" loading="lazy"/></button>`).join('')}</div>`;
      return `<div class="clip-editor__field addon-field addon-field--stickers"><label>${esc(field.label)}</label>
        <div class="addon-tabs addon-sticker-tabs">${STICKER_TABS.map(([v, l]) => `<button type="button" class="mini-btn addon-tab${v === tab ? ' active' : ''}" data-sticker-tab="${v}">${l}</button>`).join('')}</div>
        ${grid}
      </div>`;
    }
    case 'color':
      return `<div class="clip-editor__field addon-field">${label}<input id="${id}" type="color" data-key="${field.key}" data-kind="text" value="${esc(value || '#000000')}"/></div>`;
    case 'url':
      return `<div class="clip-editor__field addon-field">${label}<input id="${id}" type="url" placeholder="https://" data-key="${field.key}" data-kind="text" value="${esc(value)}"/></div>`;
    case 'select':
      return `<div class="clip-editor__field addon-field">${label}<select id="${id}" data-key="${field.key}" data-kind="select">${(field.options || [])
        .map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
    case 'fieldList': {
      const list = Array.isArray(value) ? value : [];
      const rows = list.map((f, i) => `
        <div class="addon-fieldlist__row" data-index="${i}">
          <input type="text" class="addon-fieldlist__label" value="${esc(f.label)}" aria-label="Field label" />
          <select class="addon-fieldlist__type" aria-label="Field type">${(field.fieldTypes || [])
            .map(([v, l]) => `<option value="${v}" ${v === f.type ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <label class="addon-fieldlist__req" title="Required"><input type="checkbox" class="addon-fieldlist__required" ${f.required ? 'checked' : ''}/> req</label>
          <button type="button" class="mini-btn addon-fieldlist__up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
          <button type="button" class="mini-btn addon-fieldlist__remove" ${list.length <= (field.min ?? 1) ? 'disabled' : ''} aria-label="Remove field">✕</button>
        </div>`).join('');
      return `<div class="clip-editor__field addon-field addon-fieldlist" data-key="${field.key}" data-kind="fieldList">
        <label>${esc(field.label)}</label>${rows}
        <button type="button" class="mini-btn addon-fieldlist__add" ${list.length >= (field.max ?? 5) ? 'disabled' : ''}>+ Add field</button>
      </div>`;
    }
    default:
      return `<div class="clip-editor__field addon-field">${label}<input id="${id}" type="text" data-key="${field.key}" data-kind="text" value="${esc(value)}"${field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : ''}/></div>`;
  }
}

/**
 * Render `fields` for `options` into `container`.
 * `onChange(nextOptions, { structural })` fires on every edit; structural
 * edits (toggles, selects, list add/remove) re-render the form so `showIf`
 * conditions and list rows stay in sync.
 */
export function renderAddonEditor(container, {
  fields, options, idPrefix = 'addon', onChange, fieldsFor, onFieldChange, services = {},
}) {
  let current = JSON.parse(JSON.stringify(options || {}));
  const ui = {};
  let activeTab = null;
  let drawnFields = [];
  const draw = () => {
    const all = ((fieldsFor ? fieldsFor(current) : fields) || []).filter((f) => !f.showIf || f.showIf(current));
    drawnFields = all;
    // Upstream settings panels are tabbed (Basic / Styles / Fields /
    // Integrations); fields carry a `tab` and the tab bar is drawn when
    // there is more than one.
    const tabs = Array.from(new Set(all.map((f) => f.tab || 'Basic')));
    if (!tabs.includes(activeTab)) activeTab = tabs[0] || null;
    const tabBar = tabs.length > 1
      ? `<div class="clip-editor__tabs addon-tabs" role="tablist">${tabs.map((t) => `<button type="button" role="tab" class="mini-btn addon-tab${t === activeTab ? ' active' : ''}" data-addon-tab="${esc(t)}" aria-selected="${t === activeTab}">${esc(t)}</button>`).join('')}</div>`
      : '';
    const body = all
      .filter((f) => (f.tab || 'Basic') === activeTab)
      .map((f) => renderField(f, current, idPrefix, ui, services))
      .join('');
    container.innerHTML = tabBar + (body || '<p class="addon-field__empty">No settings — drag the clip on the timeline to set where it applies.</p>');
  };
  // Descriptor hook (e.g. Personalized Image shape → width, Smart Text
  // position presets → geometry) runs after each edit.
  const applyHook = (key) => {
    if (onFieldChange) current = onFieldChange(key, current) || current;
  };
  const emit = (structural, key) => {
    if (key) applyHook(key);
    onChange?.(JSON.parse(JSON.stringify(current)), { structural });
    if (structural) draw();
  };
  const setAndEmit = (key, value, structural = true) => {
    setPath(current, key, value);
    emit(structural, key);
  };
  const readList = (wrap) => getPath(current, wrap.dataset.key) || [];

  const handle = (e) => {
    const el = e.target;
    if (e.type === 'click' && el.dataset?.addonTab) {
      activeTab = el.dataset.addonTab;
      draw();
      return;
    }
    // ---- richer field types
    if (e.type === 'click') {
      const btn = el.closest('button');
      if (btn?.dataset.stickerTab) {
        ui.stickerTab = btn.dataset.stickerTab;
        draw();
        return;
      }
      if (btn?.dataset.positionValue) {
        setAndEmit(btn.dataset.positionKey, btn.dataset.positionValue);
        return;
      }
      if (btn?.dataset.imagePick) {
        setAndEmit(btn.dataset.pickKey, btn.dataset.imagePick);
        return;
      }
      if (btn?.dataset.stickerSrc) {
        setPath(current, 'kind', 'image');
        setPath(current, 'name', btn.dataset.stickerName || '');
        setAndEmit(btn.dataset.pickKey, btn.dataset.stickerSrc);
        return;
      }
      if (btn?.dataset.lottieUse) {
        const url = container.querySelector('.addon-lottie-url')?.value.trim();
        if (!url) return;
        setPath(current, 'kind', 'lottie');
        setPath(current, 'name', url.split('/').pop().replace(/\.json.*$/i, ''));
        setAndEmit(btn.dataset.lottieUse, url);
        return;
      }
    }
    if (e.type === 'change' && el.classList?.contains('addon-token-insert')) {
      const ta = el.closest('.addon-field--tokens')?.querySelector('textarea');
      if (ta && el.value) {
        const token = `{{${el.value}}}`;
        const start = ta.selectionStart ?? ta.value.length;
        const end = ta.selectionEnd ?? ta.value.length;
        ta.value = ta.value.slice(0, start) + token + ta.value.slice(end);
        setPath(current, ta.dataset.key, ta.value);
        emit(false, ta.dataset.key);
      }
      el.value = '';
      return;
    }
    if (e.type === 'change' && (el.dataset?.imageUpload || el.dataset?.lottieUpload)) {
      const file = el.files?.[0];
      if (!file) return;
      const key = el.dataset.imageUpload || el.dataset.lottieUpload;
      const isLottie = !!el.dataset.lottieUpload;
      const upload = services.uploadFile || (async (f) => URL.createObjectURL(f));
      Promise.resolve(upload(file, { kind: isLottie ? 'lottie' : 'image' }))
        .then((url) => {
          if (!url) return;
          if (isLottie) {
            setPath(current, 'kind', 'lottie');
            setPath(current, 'name', file.name.replace(/\.json$/i, ''));
          }
          setAndEmit(key, url);
        })
        .catch((err) => services.onError?.(err));
      return;
    }
    if (e.type === 'change' && el.dataset?.kind === 'select-null') {
      setAndEmit(el.dataset.key, el.value || null);
      return;
    }
    if (el.type === 'range' && el.nextElementSibling?.tagName === 'OUTPUT') {
      el.nextElementSibling.textContent = el.value;
    }
    const listWrap = el.closest('.addon-fieldlist');
    if (listWrap) {
      const list = readList(listWrap).map((f) => ({ ...f }));
      const row = el.closest('.addon-fieldlist__row');
      const i = row ? Number(row.dataset.index) : -1;
      if (e.type === 'click') {
        if (el.classList.contains('addon-fieldlist__add')) {
          const ids = new Set(list.map((f) => String(f.id)));
          const field = drawnFields.find((f) => f.key === listWrap.dataset.key);
          const type = field?.fieldTypes?.[0]?.[0] || 'text';
          list.push({ id: slugify('field', ids), type, label: 'New field', token: 'NEW FIELD' });
        } else if (el.classList.contains('addon-fieldlist__remove')) {
          list.splice(i, 1);
        } else if (el.classList.contains('addon-fieldlist__up') && i > 0) {
          [list[i - 1], list[i]] = [list[i], list[i - 1]];
        } else return;
        setPath(current, listWrap.dataset.key, list);
        emit(true);
        return;
      }
      if (i < 0) return;
      if (el.classList.contains('addon-fieldlist__label')) {
        list[i].label = el.value;
        // Upstream token = label upper-cased; it is the submitted field name.
        list[i].token = String(el.value || '').trim().toUpperCase() || 'FIELD';
      } else if (el.classList.contains('addon-fieldlist__type')) {
        list[i].type = el.value;
      } else if (el.classList.contains('addon-fieldlist__required')) {
        list[i].required = el.checked;
      } else return;
      setPath(current, listWrap.dataset.key, list);
      emit(false);
      return;
    }
    const key = el.dataset?.key;
    if (!key || e.type === 'click') return;
    const kind = el.dataset.kind;
    if (kind === 'toggle') setPath(current, key, el.checked);
    else if (kind === 'number') {
      const n = Number(el.value);
      setPath(current, key, Number.isFinite(n) ? n : 0);
    } else setPath(current, key, el.value);
    emit(kind === 'toggle' || kind === 'select', key);
  };

  container.addEventListener('input', handle);
  container.addEventListener('change', handle);
  container.addEventListener('click', handle);
  draw();
  return {
    destroy() {
      container.removeEventListener('input', handle);
      container.removeEventListener('change', handle);
      container.removeEventListener('click', handle);
    },
    setOptions(next) {
      current = JSON.parse(JSON.stringify(next || {}));
      draw();
    },
  };
}
