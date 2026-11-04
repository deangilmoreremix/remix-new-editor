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

function renderField(field, options, idPrefix) {
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
      return `<div class="clip-editor__field addon-field">${label}<textarea id="${id}" rows="2" data-key="${field.key}" data-kind="text">${esc(value)}</textarea></div>`;
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
      return `<div class="clip-editor__field addon-field">${label}<input id="${id}" type="text" data-key="${field.key}" data-kind="text" value="${esc(value)}"/></div>`;
  }
}

/**
 * Render `fields` for `options` into `container`.
 * `onChange(nextOptions, { structural })` fires on every edit; structural
 * edits (toggles, selects, list add/remove) re-render the form so `showIf`
 * conditions and list rows stay in sync.
 */
export function renderAddonEditor(container, { fields, options, idPrefix = 'addon', onChange, fieldsFor }) {
  let current = JSON.parse(JSON.stringify(options || {}));
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
      .map((f) => renderField(f, current, idPrefix))
      .join('');
    container.innerHTML = tabBar + (body || '<p class="addon-field__empty">No settings — drag the clip on the timeline to set where it applies.</p>');
  };
  const emit = (structural) => {
    onChange?.(JSON.parse(JSON.stringify(current)), { structural });
    if (structural) draw();
  };
  const readList = (wrap) => getPath(current, wrap.dataset.key) || [];

  const handle = (e) => {
    const el = e.target;
    if (e.type === 'click' && el.dataset?.addonTab) {
      activeTab = el.dataset.addonTab;
      draw();
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
    emit(kind === 'toggle' || kind === 'select');
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
