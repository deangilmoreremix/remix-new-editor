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
const STICKER_TABS = [['emoticons', 'Emoticons'], ['shapes', 'Shapes'], ['animatedEmoji', 'Animated emoji'], ['animated', 'Your file']];

/** Stock photo search (Pixabay / Pexels) inside an image field. */
function renderImageStock(field, ui, services) {
  const sources = services.stockSources || [['pixabay', 'Pixabay']];
  const source = ui.imgSource || sources[0][0];
  const query = ui.imgQuery || '';
  const res = (ui.imgResults || {})[`${source}:${query}`];
  const label = (sources.find(([id]) => id === source) || [source, source])[1];
  let grid = '';
  if (query) {
    if (!res || res.loading) grid = '<p class="addon-field__hint">Loading…</p>';
    else if (res.error) grid = `<p class="addon-field__hint addon-field__hint--error">${esc(res.error)}</p>`;
    else if (!res.items.length) grid = '<p class="addon-field__hint">No images found.</p>';
    else grid = `<div class="addon-image-library" role="list">${res.items.map((it, i) => `<button type="button" role="listitem" class="addon-image-thumb" data-stock-image="${i}" data-pick-key="${field.key}" title="${esc(it.name)}${it.user ? ` by ${esc(it.user)}` : ''}" style="background-image:url(${esc(JSON.stringify(String(it.thumbnail || '')))})"></button>`).join('')}</div>`;
  }
  return `<div class="addon-image-stock">
    <div class="addon-tabs">${sources.map(([id, l]) => `<button type="button" class="mini-btn addon-tab${id === source ? ' active' : ''}" data-img-source="${id}">${esc(l)}</button>`).join('')}</div>
    <div class="addon-video-search"><input type="search" class="addon-img-query" placeholder="Search ${esc(label)} images" value="${esc(query)}"/><button type="button" class="mini-btn" data-img-search="1">Search</button></div>
    ${grid}
    ${query ? `<p class="addon-field__hint addon-source-label">Images from <a href="${source === 'pexels' ? 'https://www.pexels.com' : 'https://pixabay.com'}" target="_blank" rel="noopener noreferrer">${esc(label)}</a></p>` : ''}
  </div>`;
}

// Personalized Image source: one button per image token, showing what the
// selected contact's image is ("Logo", "Presenter photo", …). The textarea
// stays for anything custom ({{d logoUrl "https://…"}}).
function renderImageTokenField(field, value, id, label, services) {
  const tokens = services.imageTokens() || [];
  const current = String(value || '').trim();
  const contact = services.contactLabel?.() || '';
  const buttons = tokens.map((t) => {
    const token = `{{${t.key}}}`;
    const on = current === token;
    const thumb = t.preview
      ? `<span class="pz-thumb pz-thumb-sm" style="background-image:url(${esc(JSON.stringify(String(t.preview)))})"></span>`
      : '<span class="pz-thumb pz-thumb-sm is-empty" aria-hidden="true">—</span>';
    return `<button type="button" class="pz-token${on ? ' is-active' : ''}${t.preview ? '' : ' is-empty'}" data-image-pick="${esc(token)}" data-pick-key="${field.key}" aria-pressed="${on}" title="${esc(t.preview ? `${t.label} for ${contact || 'the selected contact'}` : `${contact || 'The selected contact'} has no ${t.label.toLowerCase()} yet — the fallback image shows instead`)}">${thumb}<span>${esc(t.label)}</span></button>`;
  }).join('');
  return `<div class="clip-editor__field addon-field addon-field--tokens addon-field--image-tokens pz-ui">
    <span class="pz-label">${esc(field.label)}</span>
    <div class="pz-token-grid" role="group" aria-label="Contact image">${buttons}</div>
    ${renderContactImageBox(current, services)}
    <p class="pz-hint">${contact ? `Previewing <strong>${esc(contact)}</strong>. ` : 'No contact selected. '}Each contact sees their own image. Add or edit images in the Personalize window's image finder.</p>
    <textarea id="${id}" class="pz-token-code" rows="1" data-key="${field.key}" data-kind="text" aria-label="${esc(field.label)} (token)">${esc(value)}</textarea>
  </div>`;
}

// The selected contact's image behind the chosen token: click it to set the
// crop focus (per contact), and make it Video Ready with one click.
function renderContactImageBox(current, services) {
  const info = services.contactImage?.(current);
  if (!info?.url) return '';
  const fx = Number.isFinite(info.focus?.x) ? info.focus.x : 50;
  const fy = Number.isFinite(info.focus?.y) ? info.focus.y : 50;
  const ready = info.videoReady
    ? '<span class="pz-chip">✓ Video Ready</span>'
    : `<button type="button" class="pz-btn pz-btn-primary" data-make-video-ready="1"${info.busy ? ' disabled' : ''}>${info.busy ? 'Preparing…' : '✨ Make Video Ready'}</button>`;
  return `<div class="pz-card pz-contact-image">
    <button type="button" class="pz-thumb pz-thumb-lg" data-focus-pick="1" title="Click where the image should stay in view when it's cropped" aria-label="Set crop focus" style="background-image:url(${esc(JSON.stringify(String(info.url)))})">
      <span class="pz-focus-dot" style="left:${fx}%;top:${fy}%"></span>
    </button>
    <div class="pz-contact-image__meta">
      <span class="pz-label" style="margin:0">${esc(info.contact || 'This contact')} · ${esc(info.label || 'image')}</span>
      <span class="pz-hint" style="margin:0">Click the image to set what stays in view when it's cropped.</span>
      ${ready}
    </div>
  </div>`;
}

// The selected contact's images from the image finder, as one-click picks
// for any image field (fixed image, fallback image).
function renderFinderImages(field, services) {
  const images = (services.finderImages?.() || []).slice(0, 24);
  if (!images.length) return '';
  const contact = services.contactLabel?.() || '';
  return `<div class="pz-ui" style="margin-top:10px">
    <span class="pz-label">From the image finder${contact ? ` · ${esc(contact)}` : ''}</span>
    <div class="pz-thumbs" role="list" aria-label="Image finder images">${images.map((m, i) => `<button type="button" role="listitem" class="pz-thumb" data-finder-pick="${i}" data-pick-key="${field.key}" title="${esc(m.name || '')}${m.saved ? '' : ' (from the website, saved to the contact when picked)'}" style="background-image:url(${esc(JSON.stringify(String(m.src)))})">${m.saved ? (m.videoReady ? '<span class="pz-badge">Ready</span>' : '') : '<span class="pz-badge">Web</span>'}</button>`).join('')}</div>
  </div>`;
}

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
    case 'uv': {
      // A point in 0–1 frame coordinates (effect centres/origins).
      const [x = 0.5, y = 0.5] = Array.isArray(value) ? value : [];
      return `<div class="clip-editor__field addon-field addon-field--uv"><label>${esc(field.label)}</label>
        <div class="addon-uv"><label>X <input type="number" min="0" max="1" step="0.01" data-key="${field.key}.0" data-kind="number" value="${esc(x)}"/></label>
        <label>Y <input type="number" min="0" max="1" step="0.01" data-key="${field.key}.1" data-kind="number" value="${esc(y)}"/></label></div></div>`;
    }
    case 'points': {
      const text = (Array.isArray(value) ? value : []).map(([x, y]) => `${x}, ${y}`).join('; ');
      return `<div class="clip-editor__field addon-field">${label}<input id="${id}" type="text" data-key="${field.key}" data-kind="points" value="${esc(text)}" placeholder="0, 0; 0.5, 0.6; 1, 1" title="Input, output pairs from 0 to 1"/></div>`;
    }
    case 'cube': {
      const loadedName = options[`${field.key}Name`];
      return `<div class="clip-editor__field addon-field addon-field--cube"><label>${esc(field.label)}</label>
        <div class="addon-image-actions"><label class="mini-btn addon-upload-btn">Load .cube file<input type="file" accept=".cube,text/plain" data-cube-upload="${field.key}" hidden /></label>
        <span class="addon-field__hint">${loadedName ? esc(loadedName) : 'Identity (no change)'}</span></div></div>`;
    }
    case 'font':
      return `<div class="clip-editor__field addon-field">${label}<select id="${id}" data-key="${field.key}" data-kind="select" class="addon-font-select">${(field.options || [])
        .map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
    case 'tokens': {
      // Text with personalization tokens; the select inserts {{token}} at
      // the cursor (upstream's Personalize button).
      if (field.tokenFilter === 'image' && typeof services.imageTokens === 'function') {
        return renderImageTokenField(field, value, id, label, services);
      }
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
        ${renderFinderImages(field, services)}
        ${media.length ? `<div class="addon-image-library" role="list" aria-label="Media library images">${media.map((m) => `<button type="button" role="listitem" class="addon-image-thumb" data-image-pick="${esc(m.src)}" data-pick-key="${field.key}" title="${esc(m.name || '')}" style="background-image:url(${esc(JSON.stringify(String(m.src)))})"></button>`).join('')}</div>` : ''}
        ${typeof services.searchStock === 'function' ? renderImageStock(field, ui, services) : ''}
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
    case 'videoPicker': {
      // Overlay transition videos from Pixabay / Pexels. Results load
      // asynchronously through services.searchTransitions and are kept in
      // ui.vp so redraws don't refetch.
      const sources = services.stockSources || [['pixabay', 'Pixabay']];
      const source = ui.vpSource || sources[0][0];
      const cats = field.categories || [];
      const tab = ui.vpTab || cats[0]?.[0] || 'search';
      const query = tab === 'search' ? (ui.vpQuery || '') : (cats.find(([id]) => id === tab)?.[2] || '');
      const key = `${source}:${query}`;
      const result = (ui.vp || {})[key];
      const sourceLabel = (sources.find(([id]) => id === source) || [source, source])[1];
      const sourceHome = source === 'pexels' ? 'https://www.pexels.com' : 'https://pixabay.com';
      const current = options.src
        ? `<div class="addon-video-current"><video src="${esc(options.preview || options.src)}" muted loop autoplay playsinline></video><span>${esc(options.name || 'Selected')}</span></div>`
        : '';
      let grid;
      if (!query) grid = '<p class="addon-field__hint">Type a search, e.g. "light leak", "film burn", "glitch".</p>';
      else if (!result || result.loading) grid = '<p class="addon-field__hint">Loading…</p>';
      else if (result.error) grid = `<p class="addon-field__hint addon-field__hint--error">${esc(result.error)}</p>`;
      else if (!result.items.length) grid = '<p class="addon-field__hint">No videos found.</p>';
      else {
        grid = `<div class="addon-video-grid" role="list">${result.items.map((it, i) => `<button type="button" role="listitem" class="addon-video-thumb${it.src === value ? ' is-on' : ''}" data-video-pick="${i}" data-video-key="${esc(key)}" data-pick-key="${field.key}" title="${esc(it.name)}${it.user ? ` by ${esc(it.user)}` : ''}" style="background-image:url(${esc(JSON.stringify(String(it.thumbnail || '')))})"><span class="addon-video-dur">${Math.round(it.duration)}s</span></button>`).join('')}</div>`;
      }
      return `<div class="clip-editor__field addon-field addon-field--video">${label}
        ${current}
        ${sources.length > 1 ? `<div class="addon-tabs addon-video-sources">${sources.map(([id, l]) => `<button type="button" class="mini-btn addon-tab${id === source ? ' active' : ''}" data-vp-source="${id}">${esc(l)}</button>`).join('')}</div>` : ''}
        <div class="addon-tabs addon-video-tabs">${cats.map(([id, l]) => `<button type="button" class="mini-btn addon-tab${id === tab ? ' active' : ''}" data-vp-tab="${id}">${esc(l)}</button>`).join('')}<button type="button" class="mini-btn addon-tab${tab === 'search' ? ' active' : ''}" data-vp-tab="search">Search</button></div>
        ${tab === 'search' ? `<div class="addon-video-search"><input type="search" class="addon-vp-query" placeholder="Search ${esc(sourceLabel)} videos" value="${esc(ui.vpQuery || '')}"/><button type="button" class="mini-btn" data-vp-search="1">Search</button></div>` : ''}
        ${grid}
        <p class="addon-field__hint addon-source-label">Videos from <a href="${sourceHome}" target="_blank" rel="noopener noreferrer">${esc(sourceLabel)}</a></p>
      </div>`;
    }
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
        : tab === 'animatedEmoji'
          // Animated Lottie emoji: the button shows the emoji glyph (loading
          // dozens of animations just to draw a grid would be heavy).
          ? `<div class="addon-sticker-grid addon-sticker-grid--emoji" role="list">${(services.animatedEmoji || []).map((st) => `<button type="button" role="listitem" class="addon-sticker addon-sticker--emoji${st.src === value ? ' is-on' : ''}" data-sticker-src="${esc(st.src)}" data-sticker-name="${esc(st.name)}" data-sticker-kind="lottie" data-pick-key="${field.key}" title="${esc(st.name)} (animated)" aria-label="${esc(st.name)} (animated)">${esc(st.emoji)}</button>`).join('')}</div>`
          : `<div class="addon-sticker-grid" role="list">${(lib[tab] || []).map((st) => `<button type="button" role="listitem" class="addon-sticker${st.src === value ? ' is-on' : ''}" data-sticker-src="${esc(st.src)}" data-sticker-name="${esc(st.name)}" data-pick-key="${field.key}" title="${esc(st.name)}"><img src="${esc(st.src)}" alt="${esc(st.name)}" loading="lazy"/></button>`).join('')}</div>`;
      return `<div class="clip-editor__field addon-field addon-field--stickers"><label>${esc(field.label)}</label>
        <div class="addon-tabs addon-sticker-tabs">${STICKER_TABS.map(([v, l]) => `<button type="button" class="mini-btn addon-tab${v === tab ? ' active' : ''}" data-sticker-tab="${v}">${l}</button>`).join('')}</div>
        ${grid}
      </div>`;
    }
    case 'designPicker': {
      // A grid of design thumbnails (field.designs, field.thumb(design, options) → markup).
      const tiles = (field.designs || []).map((d) => `<button type="button" class="addon-design${d.id === value ? ' active' : ''}" data-design-pick="${esc(d.id)}" data-pick-key="${esc(field.key)}" aria-pressed="${d.id === value}" title="${esc(d.label)}">${field.thumb ? field.thumb(d, options) : ''}<span>${esc(d.label)}</span></button>`).join('');
      return `<div class="clip-editor__field addon-field addon-field--designs"><label>${esc(field.label)}</label><div class="addon-designs" role="group" aria-label="${esc(field.label)}">${tiles}</div></div>`;
    }
    case 'themePicker': {
      // One-click colour schemes: each theme sets several keys at once.
      const tiles = (field.themes || []).map((t) => `<button type="button" class="addon-theme" data-theme-pick="${esc(t.id)}" data-theme-key="${esc(field.key)}" title="${esc(t.label)}"><span class="addon-theme__swatch" style="background:${esc(t.hintBackground)};border-color:${esc(t.hintBorderColor)}"><i style="background:${esc(t.pointerColor)}"></i></span><span>${esc(t.label)}</span></button>`).join('');
      return `<div class="clip-editor__field addon-field addon-field--themes"><label>${esc(field.label)}</label><div class="addon-themes" role="group" aria-label="${esc(field.label)}">${tiles}</div></div>`;
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
    loadVideos();
    loadImages();
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

  // Kick off any video-picker search the current draw needs.
  const loadVideos = () => {
    const field = drawnFields.find((f) => f.type === 'videoPicker');
    if (!field || typeof services.searchStock !== 'function') return;
    const sources = services.stockSources || [['pixabay', 'Pixabay']];
    const source = ui.vpSource || sources[0][0];
    const cats = field.categories || [];
    const tab = ui.vpTab || cats[0]?.[0] || 'search';
    const query = tab === 'search' ? (ui.vpQuery || '') : (cats.find(([id]) => id === tab)?.[2] || '');
    if (!query) return;
    const key = `${source}:${query}`;
    ui.vp = ui.vp || {};
    if (ui.vp[key]) return;
    ui.vp[key] = { loading: true, items: [] };
    Promise.resolve(services.searchStock('videos', source, query))
      .then((res) => { ui.vp[key] = { items: res?.items || [], error: res?.ok === false ? (res.error || 'Search failed') : null }; })
      .catch((err) => { ui.vp[key] = { items: [], error: err?.message || 'Search failed' }; })
      .then(() => draw());
  };

  const loadImages = () => {
    if (!ui.imgQuery || typeof services.searchStock !== 'function') return;
    if (!drawnFields.some((f) => f.type === 'image')) return;
    const sources = services.stockSources || [['pixabay', 'Pixabay']];
    const source = ui.imgSource || sources[0][0];
    const key = `${source}:${ui.imgQuery}`;
    ui.imgResults = ui.imgResults || {};
    if (ui.imgResults[key]) return;
    ui.imgResults[key] = { loading: true, items: [] };
    Promise.resolve(services.searchStock('images', source, ui.imgQuery))
      .then((r) => { ui.imgResults[key] = { items: r?.items || [], error: r?.ok === false ? (r.error || 'Search failed') : null }; })
      .catch((err) => { ui.imgResults[key] = { items: [], error: err?.message || 'Search failed' }; })
      .then(() => draw());
  };

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
      if (btn?.dataset.imgSource) {
        ui.imgSource = btn.dataset.imgSource;
        draw();
        return;
      }
      if (btn?.dataset.imgSearch) {
        ui.imgQuery = container.querySelector('.addon-img-query')?.value.trim() || '';
        draw();
        return;
      }
      if (btn?.dataset.stockImage != null) {
        const sources = services.stockSources || [['pixabay', 'Pixabay']];
        const item = ui.imgResults?.[`${ui.imgSource || sources[0][0]}:${ui.imgQuery}`]?.items?.[Number(btn.dataset.stockImage)];
        if (!item) return;
        const key = btn.dataset.pickKey;
        btn.classList.add('is-busy');
        // Pixabay images must be copied before use (no permanent hotlinks).
        Promise.resolve(services.importStockImage ? services.importStockImage(item) : item.src)
          .then((url) => { if (url) setAndEmit(key, url); })
          .catch((err) => services.onError?.(err))
          .finally(() => btn.classList.remove('is-busy'));
        return;
      }
      if (btn?.dataset.vpSource) {
        ui.vpSource = btn.dataset.vpSource;
        draw();
        return;
      }
      if (btn?.dataset.vpTab) {
        ui.vpTab = btn.dataset.vpTab;
        draw();
        return;
      }
      if (btn?.dataset.vpSearch) {
        ui.vpQuery = container.querySelector('.addon-vp-query')?.value.trim() || '';
        draw();
        return;
      }
      if (btn?.dataset.videoPick != null && btn?.dataset.videoKey) {
        const item = ui.vp?.[btn.dataset.videoKey]?.items?.[Number(btn.dataset.videoPick)];
        if (!item) return;
        Object.assign(current, {
          preview: item.preview,
          thumbnail: item.thumbnail,
          name: item.name,
          pixabayId: item.id,
          pageURL: item.pageURL,
          source: item.source || 'pixabay',
          durationSec: Math.min(8, Math.max(1, Math.round(item.duration || 3))),
        });
        setAndEmit(btn.dataset.pickKey, item.src);
        return;
      }
      if (btn?.dataset.stickerTab) {
        ui.stickerTab = btn.dataset.stickerTab;
        draw();
        return;
      }
      if (btn?.dataset.positionValue) {
        setAndEmit(btn.dataset.positionKey, btn.dataset.positionValue);
        return;
      }
      if (btn?.dataset.designPick) {
        setAndEmit(btn.dataset.pickKey, btn.dataset.designPick);
        return;
      }
      if (btn?.dataset.themePick) {
        const field = drawnFields.find((f) => f.key === btn.dataset.themeKey);
        const theme = (field?.themes || []).find((t) => t.id === btn.dataset.themePick);
        if (theme) {
          const { id: _id, label: _label, ...values } = theme;
          Object.entries(values).forEach(([k, v]) => setPath(current, k, v));
          emit(true);
        }
        return;
      }
      if (btn?.dataset.imagePick) {
        setAndEmit(btn.dataset.pickKey, btn.dataset.imagePick);
        return;
      }
      if (btn?.dataset.focusPick && typeof services.setImageFocus === 'function') {
        const r = btn.getBoundingClientRect();
        const x = Math.round(((e.clientX - r.left) / Math.max(1, r.width)) * 100);
        const y = Math.round(((e.clientY - r.top) / Math.max(1, r.height)) * 100);
        services.setImageFocus(String(getPath(current, 'src') || ''), x, y);
        draw();
        return;
      }
      if (btn?.dataset.makeVideoReady && typeof services.makeVideoReady === 'function') {
        Promise.resolve(services.makeVideoReady(String(getPath(current, 'src') || ''), () => draw()))
          .catch((err) => services.onError?.(err))
          .finally(() => draw());
        draw();
        return;
      }
      if (btn?.dataset.finderPick != null && typeof services.useFinderImage === 'function') {
        const key = btn.dataset.pickKey;
        btn.classList.add('is-busy');
        // Website images are saved to the contact first (durable URL).
        Promise.resolve(services.useFinderImage(Number(btn.dataset.finderPick)))
          .then((url) => { if (url) setAndEmit(key, url); })
          .catch((err) => services.onError?.(err))
          .finally(() => btn.classList.remove('is-busy'));
        return;
      }
      if (btn?.dataset.stickerSrc) {
        setPath(current, 'kind', btn.dataset.stickerKind === 'lottie' ? 'lottie' : 'image');
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
    if (e.type === 'change' && el.classList?.contains('addon-img-query')) {
      ui.imgQuery = el.value.trim();
      draw();
      return;
    }
    if (e.type === 'change' && el.classList?.contains('addon-vp-query')) {
      ui.vpQuery = el.value.trim();
      draw();
      return;
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
    if (e.type === 'change' && el.dataset?.kind === 'points') {
      const pts = String(el.value || '').split(/[;\n]/).map((pair) => pair.split(',').map((n) => Number(n.trim())))
        .filter((pp) => pp.length === 2 && pp.every((n) => Number.isFinite(n)))
        .map(([x, y]) => [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))])
        .sort((a, b) => a[0] - b[0]);
      setAndEmit(el.dataset.key, pts.length >= 2 ? pts : [[0, 0], [1, 1]]);
      return;
    }
    if (e.type === 'change' && el.dataset?.cubeUpload) {
      const file = el.files?.[0];
      if (!file) return;
      const key = el.dataset.cubeUpload;
      file.text().then((text) => {
        if (!/LUT_3D_SIZE\s+\d+/.test(text)) {
          services.onError?.(new Error('That file is not a 3D .cube LUT'));
          return;
        }
        setPath(current, `${key}Name`, file.name);
        setAndEmit(key, text);
      });
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
    if (kind === 'points') return; // committed on change (above)
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
