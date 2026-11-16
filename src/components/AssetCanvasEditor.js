// src/components/AssetCanvasEditor.js
// In-browser canvas editor for campaign assets (port of Open-Pomelli's asset/[id]/edit/canvas.tsx).
// Headline / body / CTA blocks on a 3×3 position grid, with size / color / background / font / alignment
// per block; swap the AI image, regenerate a clean (text-free) background, or upload your own.
// Vanilla DOM + mountStudioChrome, like the other studios.

import { navigate } from '../lib/brandNavigation.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { getBrand, getAsset, getCampaign, saveAsset, resolveBrandId, rememberBrandId } from '../lib/brandStore.js';
import { createSafeImage } from '../lib/security.js';
import { showToast } from '../lib/loading.js';
import { POSITIONS, SIZES, ALIGNS, defaultLayout } from '../lib/layout.js';
import { PLATFORMS } from '../lib/platforms.js';
import { regenerateImage } from '../lib/campaignGenerator.js';
import { muapi } from '../lib/muapi.js';

const SIZE_PX = {
  small: 'clamp(10px, 1.4cqw, 18px)',
  medium: 'clamp(14px, 2.2cqw, 26px)',
  large: 'clamp(20px, 3.4cqw, 44px)',
  huge: 'clamp(28px, 5.5cqw, 80px)',
};

const POS_STYLE = {
  'top-left': ['flex-start', 'flex-start'],
  'top-center': ['flex-start', 'center'],
  'top-right': ['flex-start', 'flex-end'],
  'middle-left': ['center', 'flex-start'],
  'middle-center': ['center', 'center'],
  'middle-right': ['center', 'flex-end'],
  'bottom-left': ['flex-end', 'flex-start'],
  'bottom-center': ['flex-end', 'center'],
  'bottom-right': ['flex-end', 'flex-end'],
};

const BLOCKS = [
  { key: 'headline', label: 'Headline' },
  { key: 'body', label: 'Body' },
  { key: 'cta', label: 'CTA' },
];

const SYSTEM_FONTS = [
  { value: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif', label: 'System Sans' },
  { value: "ui-serif, Georgia, Cambria, 'Times New Roman', serif", label: 'System Serif' },
  { value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace', label: 'System Mono' },
  { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: 'Georgia, serif', label: 'Georgia' },
];

export function fontOptions(brandFonts = []) {
  const brand = brandFonts
    .filter((f) => f && !/^-/.test(f) && !/^system-ui$/i.test(f))
    .map((f) => ({ value: `${f}, system-ui, sans-serif`, label: `${f} (brand)` }));
  return [...brand, ...SYSTEM_FONTS];
}

const HEX = /^#[0-9a-f]{6}$/i;

function notFound(container, title, text) {
  const empty = document.createElement('div');
  empty.className = 'flex flex-col items-center justify-center h-full text-center px-4';
  empty.innerHTML = `
    <h2 class="text-xl font-bold text-white mb-2"></h2>
    <p class="text-secondary text-sm mb-4"></p>
    <button class="btn-primary-modern" data-nav="brand">Back to Brand Studio</button>
  `;
  empty.querySelector('h2').textContent = title;
  empty.querySelector('p').textContent = text;
  empty.querySelector('button[data-nav]').onclick = () => navigate('brand');
  container.appendChild(empty);
  return container;
}

export function AssetCanvasEditor(params = {}) {
  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-y-auto bg-app-bg custom-scrollbar';
  mountStudioChrome(container, { currentRoute: 'asset-edit', title: 'Asset Editor' });

  // `id` here is the ASSET id; the brand comes from the asset's campaign, ?brandId=, or the last-used brand.
  const assetId = params.id || new URLSearchParams(window.location.search).get('id');
  const asset = getAsset(assetId);
  if (!asset) return notFound(container, 'Asset not found', 'Open an asset from a campaign to edit it.');

  const campaign = getCampaign(asset.campaignId);
  const brand = getBrand(campaign?.brandId || resolveBrandId(params));
  if (!brand) return notFound(container, 'Brand not found', 'Select a brand first to edit assets.');
  rememberBrandId(brand.id);

  const platformId = asset.variants?.platformId || asset.platform;
  const platform = PLATFORMS.find((p) => p.id === platformId) || null;
  const aspect = platform?.aspect || '1:1';
  const palette = [...(brand.primaryColors || []), ...(brand.secondaryColors || [])].filter((c) => HEX.test(c));
  const fonts = fontOptions(brand.fonts || []);

  // ---- State ----
  const state = {
    layout: asset.layout || defaultLayout(asset.headline || '', asset.body || '', asset.cta || '', fonts[0].value),
    imageUrl: asset.imageUrl || null,
    active: 'headline',
    busy: null, // 'regen' | 'regenClean' | 'upload' | null
    saving: false,
    status: 'Edit, then save.',
    statusKind: 'idle',
  };
  const block = () => state.layout[state.active];
  const update = (kind, patch) => {
    state.layout = { ...state.layout, [kind]: { ...state.layout[kind], ...patch } };
    state.status = 'Unsaved changes';
    state.statusKind = 'idle';
  };

  // ---- Layout ----
  const root = document.createElement('div');
  root.className = 'w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-6 px-4 md:px-6 py-6';

  const main = document.createElement('div');
  const topBar = document.createElement('div');
  topBar.className = 'mb-4 flex flex-wrap items-center justify-between gap-3';
  main.appendChild(topBar);

  const canvasHost = document.createElement('div');
  main.appendChild(canvasHost);

  const side = document.createElement('aside');
  side.className = 'flex flex-col gap-4';

  root.appendChild(main);
  root.appendChild(side);
  container.appendChild(root);

  const btnCls = 'btn-secondary-modern text-xs px-3 py-1.5 disabled:opacity-50';
  const section = (title) => {
    const el = document.createElement('div');
    el.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl p-3 flex flex-col gap-2';
    const t = document.createElement('p');
    t.className = 'text-[10px] font-bold text-secondary uppercase tracking-wider';
    t.textContent = title;
    el.appendChild(t);
    return el;
  };
  const choiceGrid = (cols, items, current, onPick, labelOf = (x) => x) => {
    const grid = document.createElement('div');
    grid.className = `grid gap-1 ${cols}`;
    items.forEach((item) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.choice = item;
      b.className = `rounded-lg border px-2 py-1.5 text-[10px] font-bold ${current === item ? 'border-primary bg-white/10 text-white' : 'border-white/10 bg-white/5 text-secondary hover:bg-white/10'}`;
      b.textContent = labelOf(item);
      b.onclick = () => onPick(item);
      grid.appendChild(b);
    });
    return grid;
  };

  // ---- Canvas ----
  function renderCanvas() {
    canvasHost.innerHTML = '';
    const [w, h] = aspect.split(':').map(Number);
    const stage = document.createElement('div');
    stage.id = 'asset-canvas';
    stage.className = 'relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#111]';
    stage.style.aspectRatio = w && h ? `${w} / ${h}` : '1 / 1';
    stage.style.containerType = 'inline-size';
    // Tall formats (9:16) must not outgrow the viewport.
    stage.style.maxHeight = '75vh';
    stage.style.margin = '0 auto';

    if (state.imageUrl) {
      const img = createSafeImage(state.imageUrl, 'Background', 'absolute inset-0 w-full h-full object-cover');
      stage.appendChild(img);
    }

    const grid = document.createElement('div');
    grid.className = 'absolute inset-0 grid grid-cols-3 grid-rows-3 gap-2';
    grid.style.padding = '5%';
    POSITIONS.forEach((pos) => {
      const cell = document.createElement('div');
      const [alignItems, justifyContent] = POS_STYLE[pos];
      cell.style.cssText = `display:flex;flex-direction:column;gap:6px;align-items:${justifyContent};justify-content:${alignItems};min-width:0;`;
      BLOCKS.filter(({ key }) => state.layout[key].position === pos && state.layout[key].text).forEach(({ key }) => {
        cell.appendChild(blockView(key));
      });
      grid.appendChild(cell);
    });
    stage.appendChild(grid);
    canvasHost.appendChild(stage);
  }

  function blockView(kind) {
    const b = state.layout[kind];
    const isCta = kind === 'cta';
    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.block = kind;
    el.textContent = b.text;
    el.style.cssText = [
      `font-size:${SIZE_PX[b.size] || SIZE_PX.medium}`,
      `color:${b.color}`,
      `font-family:${b.fontFamily}`,
      `text-align:${b.align}`,
      `background:${b.bg || 'transparent'}`,
      `padding:${isCta ? '0.5em 1em' : b.bg ? '0.25em 0.5em' : '0'}`,
      `border-radius:${isCta ? '9999px' : b.bg ? '0.25em' : '0'}`,
      `outline:${state.active === kind ? '2px dashed rgba(255,255,255,0.6)' : 'none'}`,
      'outline-offset:4px',
      'line-height:1.15',
      `font-weight:${kind === 'headline' ? 700 : isCta ? 600 : 400}`,
      'max-width:90%',
      'cursor:pointer',
    ].join(';');
    el.onclick = () => {
      state.active = kind;
      renderAll();
    };
    return el;
  }

  // ---- Top bar ----
  function renderTopBar() {
    topBar.innerHTML = '';
    const back = document.createElement('button');
    back.className = btnCls;
    back.textContent = '← Back to campaign';
    back.onclick = () => (campaign ? navigate('campaign-page', { campaignId: campaign.id }) : navigate('brand-dna', { id: brand.id }));
    topBar.appendChild(back);

    const actions = document.createElement('div');
    actions.className = 'flex flex-wrap items-center gap-2';

    const regen = (noText) => {
      const b = document.createElement('button');
      b.className = btnCls;
      b.dataset.action = noText ? 'clean-background' : 'swap-image';
      b.disabled = state.busy !== null;
      b.title = noText ? 'Generate a clean background with no baked-in text' : 'Generate a new image for this asset';
      const key = noText ? 'regenClean' : 'regen';
      b.textContent = state.busy === key ? 'Regenerating…' : noText ? 'Clean background' : 'Swap image';
      b.onclick = () => regenerate(noText);
      return b;
    };
    actions.appendChild(regen(false));
    actions.appendChild(regen(true));

    const upload = document.createElement('button');
    upload.className = btnCls;
    upload.dataset.action = 'upload-image';
    upload.disabled = state.busy !== null;
    upload.textContent = state.busy === 'upload' ? 'Uploading…' : 'Upload image';
    upload.onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => input.files?.[0] && uploadImage(input.files[0]);
      input.click();
    };
    actions.appendChild(upload);

    if (state.imageUrl) {
      const animate = document.createElement('button');
      animate.className = btnCls;
      animate.dataset.action = 'animate';
      animate.textContent = 'Animate →';
      animate.onclick = () => {
        try {
          sessionStorage.setItem('storyboard_animate_frame', JSON.stringify({ imageUrl: state.imageUrl, sourceType: 'asset', sourceId: asset.id }));
        } catch { /* storage unavailable */ }
        navigate('animate');
      };
      actions.appendChild(animate);
    }

    const status = document.createElement('span');
    status.id = 'canvas-status';
    actions.appendChild(status);
    const save = document.createElement('button');
    save.className = 'btn-primary-modern px-4 py-1.5 text-sm';
    save.dataset.action = 'save';
    save.disabled = state.saving;
    save.textContent = state.saving ? 'Saving…' : 'Save';
    save.onclick = saveAssetEdits;
    actions.appendChild(save);
    topBar.appendChild(actions);
    renderStatus();
  }

  // ---- Side panel ----
  function colorRow(value, onChange, swatches, allowEmpty) {
    const wrap = document.createElement('div');
    wrap.className = 'flex flex-col gap-2';
    const row = document.createElement('div');
    row.className = 'flex flex-wrap gap-1.5';
    swatches.forEach((c) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.title = c || 'none';
      const active = (value || '').toLowerCase() === c.toLowerCase();
      sw.className = `h-6 w-6 rounded border ${active ? 'ring-2 ring-white ring-offset-1 ring-offset-black' : 'border-white/20'}`;
      sw.style.background = c || 'linear-gradient(45deg, transparent 46%, #ef4444 46%, #ef4444 54%, transparent 54%)';
      sw.onclick = () => onChange(c);
      row.appendChild(sw);
    });
    wrap.appendChild(row);

    const inputs = document.createElement('div');
    inputs.className = 'flex gap-2';
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = HEX.test(value || '') ? value : '#000000';
    picker.className = 'h-8 w-12 cursor-pointer rounded border border-white/10 bg-transparent p-1';
    picker.oninput = () => onChange(picker.value.toLowerCase());
    const text = document.createElement('input');
    text.value = value || '';
    text.placeholder = allowEmpty ? '(none)' : '#3366ff';
    text.className = 'flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-white outline-none';
    text.onchange = () => onChange(text.value.trim());
    inputs.appendChild(picker);
    inputs.appendChild(text);
    wrap.appendChild(inputs);
    return wrap;
  }

  function renderSide() {
    side.innerHTML = '';
    const b = block();

    const tabs = document.createElement('div');
    tabs.className = 'flex gap-1 rounded-lg border border-white/10 bg-[#111]/90 p-1';
    BLOCKS.forEach(({ key, label }) => {
      const t = document.createElement('button');
      t.type = 'button';
      t.dataset.tab = key;
      t.className = `flex-1 rounded px-3 py-1.5 text-xs font-bold ${state.active === key ? 'bg-white/10 text-white' : 'text-secondary hover:text-white'}`;
      t.textContent = label;
      t.onclick = () => {
        state.active = key;
        renderAll();
      };
      tabs.appendChild(t);
    });
    side.appendChild(tabs);

    const text = section('Text');
    const ta = document.createElement('textarea');
    ta.rows = 2;
    ta.value = b.text;
    ta.className = 'w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none';
    // Live-update the canvas without rebuilding the textarea (which would drop focus).
    ta.oninput = () => {
      update(state.active, { text: ta.value });
      renderCanvas();
      renderStatus();
    };
    text.appendChild(ta);
    side.appendChild(text);

    const pos = section('Position');
    pos.appendChild(choiceGrid('grid-cols-3', POSITIONS, b.position, (p) => { update(state.active, { position: p }); renderAll(); }, (p) => p.replace('-', ' ')));
    side.appendChild(pos);

    const size = section('Size');
    size.appendChild(choiceGrid('grid-cols-4', SIZES, b.size, (s) => { update(state.active, { size: s }); renderAll(); }));
    side.appendChild(size);

    const align = section('Align');
    align.appendChild(choiceGrid('grid-cols-3', ALIGNS, b.align, (a) => { update(state.active, { align: a }); renderAll(); }));
    side.appendChild(align);

    const color = section('Color');
    color.appendChild(colorRow(b.color, (c) => { update(state.active, { color: c }); renderAll(); }, ['#ffffff', '#000000', ...palette], false));
    side.appendChild(color);

    const bg = section('Background');
    bg.appendChild(colorRow(b.bg || '', (c) => { update(state.active, { bg: c || null }); renderAll(); }, ['', '#ffffff', '#000000', ...palette], true));
    side.appendChild(bg);

    const font = section('Font');
    const select = document.createElement('select');
    select.className = 'w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none';
    const options = fonts.some((f) => f.value === b.fontFamily) ? fonts : [{ value: b.fontFamily, label: b.fontFamily.split(',')[0] }, ...fonts];
    options.forEach((f) => {
      const o = document.createElement('option');
      o.value = f.value;
      o.textContent = f.label;
      o.style.fontFamily = f.value;
      o.selected = f.value === b.fontFamily;
      select.appendChild(o);
    });
    select.onchange = () => { update(state.active, { fontFamily: select.value }); renderAll(); };
    font.appendChild(select);
    side.appendChild(font);

    renderStatus();
  }

  function renderStatus() {
    const el = root.querySelector('#canvas-status');
    if (!el) return;
    el.textContent = state.status;
    el.className = `text-xs ${state.statusKind === 'error' ? 'text-red-400' : state.statusKind === 'ok' ? 'text-emerald-400' : 'text-secondary'}`;
  }

  function renderAll() {
    renderTopBar();
    renderCanvas();
    renderSide();
  }

  // ---- Actions ----
  function saveAssetEdits() {
    state.saving = true;
    try {
      saveAsset({
        ...asset,
        headline: state.layout.headline.text,
        body: state.layout.body.text,
        cta: state.layout.cta.text,
        imageUrl: state.imageUrl || '',
        layout: state.layout,
      });
      state.status = 'Saved';
      state.statusKind = 'ok';
      showToast('Asset saved', 'success');
    } catch (e) {
      state.status = String(e?.message || e);
      state.statusKind = 'error';
    } finally {
      state.saving = false;
      renderTopBar();
    }
  }

  async function regenerate(noText) {
    const concept = Array.isArray(campaign?.concepts) ? campaign.concepts[asset.variants?.conceptIndex ?? 0] : null;
    if (!concept || !platform) {
      state.status = 'This asset has no campaign concept to regenerate from';
      state.statusKind = 'error';
      renderStatus();
      return;
    }
    state.busy = noText ? 'regenClean' : 'regen';
    renderTopBar();
    try {
      const url = await regenerateImage(brand, concept, platform.id, state.layout.headline.text || concept.hook || '', { noText });
      if (!url) throw new Error('Image generation returned no url');
      state.imageUrl = url;
      state.status = 'New image ready — save to keep it';
      state.statusKind = 'idle';
    } catch (e) {
      state.status = String(e?.message || e);
      state.statusKind = 'error';
    } finally {
      state.busy = null;
      renderAll();
    }
  }

  async function uploadImage(file) {
    state.busy = 'upload';
    renderTopBar();
    try {
      // A hosted URL survives reloads and can be animated; fall back to a local copy if hosting fails.
      state.imageUrl = await muapi.uploadBrandAsset(file, file.name || `upload-${Date.now()}.png`, file.type || 'image/png');
      state.status = 'Image uploaded — save to keep it';
      state.statusKind = 'idle';
    } catch (e) {
      state.imageUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      }).catch(() => state.imageUrl);
      state.status = `Upload failed (${String(e?.message || e)}); using a local copy`;
      state.statusKind = 'error';
    } finally {
      state.busy = null;
      renderAll();
    }
  }

  renderAll();
  return container;
}
