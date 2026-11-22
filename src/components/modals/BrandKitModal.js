// src/components/modals/BrandKitModal.js
// A modal that is only the Brand Kit: paste a business website, review what was found (logo, colors, copy,
// images), optionally scan its other pages for fonts / tone / offers, save it to Brand Studio, and start a
// video, Cinema, Storyboard or Video Agent project from it.
//
// It is NOT the personalization modal and shares no code or state with it. All logic lives in lib/brandKit.js.

import {
  BRAND_TARGETS, buildBrandKit, saveBrandKit, discoverBrand, scanAndSaveBrandKit, makeBrandProject, buildBrandBrief,
} from '../../lib/brandKit.js';

const FIELD = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50';
const BTN = 'whitespace-nowrap rounded-xl border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-50';
const BTN_PRIMARY = 'whitespace-nowrap shrink-0 rounded-xl border border-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary disabled:opacity-50';
const SELECT = 'rounded-xl border border-white/20 bg-transparent px-3 py-2 text-xs font-bold text-white';
const LABEL = 'text-[11px] font-bold uppercase tracking-wider text-muted';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const isHttp = (u) => { try { const p = new URL(u).protocol; return p === 'http:' || p === 'https:'; } catch { return false; } };

/**
 * Open the Brand Kit modal. `url` pre-fills the website field. Resolves nothing; close with Esc, the backdrop or ✕.
 * Returns a function that closes it.
 */
export function openBrandKitModal({ url = '' } = {}) {
  if (typeof document === 'undefined') return () => {};
  const opener = document.activeElement;

  const state = {
    url,
    input: null, // { research, assets } from discovery
    name: '', offer: '', cta: '',
    excluded: new Set(),
    status: 'idle', // idle | finding
    error: '',
    saved: null,
    scan: { status: 'idle', message: '' },
    target: 'video', duration: 15, aspect: '9:16',
  };

  const overlay = el('div', 'fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-3 md:p-6');
  overlay.setAttribute('data-testid', 'brand-kit-modal');
  const dialog = el('div', 'relative w-full max-w-3xl max-h-full overflow-y-auto custom-scrollbar rounded-2xl border border-white/10 bg-[#0d0d10] p-5 md:p-7 text-white');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Brand Kit');
  overlay.appendChild(dialog);

  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    try { opener?.focus?.(); } catch { /* ignore */ }
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

  const currentKit = () => {
    if (!state.input) return null;
    const assets = state.input.assets.filter((a) => !state.excluded.has(a.id));
    return buildBrandKit({
      research: state.input.research,
      client: { businessName: state.name, offer: state.offer, callToAction: state.cta, website: state.input.research.canonicalUrl },
      assets,
    });
  };

  async function find() {
    state.error = '';
    state.status = 'finding';
    render();
    try {
      state.input = await discoverBrand(state.url);
      state.excluded = new Set();
      state.saved = null;
      state.scan = { status: 'idle', message: '' };
      const probe = buildBrandKit({ research: state.input.research, client: {}, assets: state.input.assets });
      state.name = probe?.brandName || '';
      state.offer = ''; state.cta = '';
    } catch (e) {
      state.error = e?.message || 'Could not find that brand';
    }
    state.status = 'idle';
    render();
  }

  async function scan() {
    const kit = currentKit();
    if (!kit) return;
    state.scan = { status: 'scanning', message: '' };
    render();
    try {
      state.saved = await scanAndSaveBrandKit(kit);
      const n = (state.saved.scannedPages || []).length;
      state.scan = { status: 'done', message: `Read ${n} page${n === 1 ? '' : 's'}` };
    } catch (e) {
      state.scan = { status: 'error', message: e?.message || 'Could not scan that website' };
    }
    render();
  }

  function save() {
    const kit = currentKit();
    if (!kit) return;
    state.saved = saveBrandKit(kit);
    render();
  }

  function make() {
    const kit = currentKit();
    if (!kit) return;
    const brand = saveBrandKit(kit);
    state.saved = brand;
    makeBrandProject(brand, state.target, { duration: state.duration, aspectRatio: state.aspect });
    close();
  }

  function field(label, value, onInput, placeholder) {
    const wrap = el('label', 'flex flex-col gap-1 min-w-0');
    wrap.appendChild(el('span', LABEL, label));
    const input = el('input', FIELD);
    input.type = 'text';
    input.value = value;
    if (placeholder) input.placeholder = placeholder;
    input.addEventListener('input', () => onInput(input.value));
    wrap.appendChild(input);
    return wrap;
  }

  function select(label, options, value, onChange) {
    const s = el('select', SELECT);
    s.setAttribute('aria-label', label);
    options.forEach(([v, text]) => {
      const o = el('option', '', text);
      o.value = String(v);
      o.style.color = '#000';
      if (String(v) === String(value)) o.selected = true;
      s.appendChild(o);
    });
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }

  function render() {
    const keepScroll = dialog.scrollTop;
    dialog.replaceChildren();

    const head = el('div', 'flex items-start justify-between gap-3 mb-4');
    const titles = el('div');
    titles.appendChild(el('h2', 'text-xl font-black tracking-tight', 'Brand Kit'));
    titles.appendChild(el('p', 'text-xs text-secondary mt-1', 'Paste a business website to pull its logo, colors, copy and images — then make a video from it.'));
    head.appendChild(titles);
    const x = el('button', 'text-white/70 hover:text-white text-lg leading-none px-2', '✕');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', close);
    head.appendChild(x);
    dialog.appendChild(head);

    // 1. Find
    const form = el('form', 'flex flex-col sm:flex-row gap-2 mb-2');
    const input = el('input', FIELD);
    input.type = 'text';
    input.value = state.url;
    input.placeholder = 'https://yourbusiness.com';
    input.setAttribute('aria-label', 'Business website');
    input.addEventListener('input', () => { state.url = input.value; });
    const go = el('button', BTN_PRIMARY, state.status === 'finding' ? 'Finding…' : state.input ? 'Find again' : 'Find brand');
    go.type = 'submit';
    go.disabled = state.status === 'finding';
    form.append(input, go);
    form.addEventListener('submit', (e) => { e.preventDefault(); find(); });
    dialog.appendChild(form);
    if (state.error) {
      const err = el('p', 'text-xs text-red-300 mb-3', state.error);
      err.setAttribute('role', 'alert');
      dialog.appendChild(err);
    }

    const kit = currentKit();
    if (!kit) {
      dialog.appendChild(el('p', 'text-xs text-muted mt-4', 'We read only the public page. Nothing is generated or charged, and nothing is saved until you press Save.'));
      dialog.scrollTop = keepScroll;
      return;
    }
    const shown = state.saved || kit;

    // 2. What was found
    const found = el('div', 'mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-4');
    found.setAttribute('data-testid', 'brand-kit-found');
    const top = el('div', 'flex items-center gap-3 flex-wrap');
    if (isHttp(kit.logoUrl)) {
      const logo = el('img', 'h-12 max-w-[120px] object-contain rounded bg-white p-1');
      logo.src = kit.logoUrl; logo.alt = `${kit.brandName} logo`; logo.referrerPolicy = 'no-referrer';
      top.appendChild(logo);
    }
    const nameBox = el('div', 'min-w-0');
    nameBox.appendChild(el('div', 'text-base font-extrabold truncate', kit.brandName));
    nameBox.appendChild(el('div', 'text-xs text-secondary', [kit.industry, kit.url && new URL(kit.url).hostname.replace(/^www\./, '')].filter(Boolean).join(' · ')));
    top.appendChild(nameBox);
    const sw = el('div', 'flex gap-1.5 ml-auto');
    sw.setAttribute('aria-label', 'Brand colors');
    [...kit.primaryColors, ...kit.secondaryColors].forEach((c) => {
      const dot = el('span', 'inline-block w-5 h-5 rounded-full border border-white/25');
      dot.style.background = c; dot.title = c;
      sw.appendChild(dot);
    });
    top.appendChild(sw);
    found.appendChild(top);
    if (kit.valueProposition) found.appendChild(el('p', 'text-xs text-secondary leading-relaxed', kit.valueProposition.slice(0, 260)));

    const edit = el('div', 'grid grid-cols-1 sm:grid-cols-3 gap-3');
    edit.append(
      field('Business name', state.name, (v) => { state.name = v; }),
      field('Offer (optional)', state.offer, (v) => { state.offer = v; }, 'e.g. 20% off your first order'),
      field('Call to action (optional)', state.cta, (v) => { state.cta = v; }, 'e.g. Book today'),
    );
    found.appendChild(edit);

    // Images: click to keep or drop
    const imgs = state.input.assets.filter((a) => isHttp(a.previewUrl));
    if (imgs.length) {
      const block = el('div', 'flex flex-col gap-2');
      block.appendChild(el('div', LABEL, `Images (${imgs.length - state.excluded.size} of ${imgs.length} kept — click to drop or keep)`));
      const grid = el('div', 'grid grid-cols-3 sm:grid-cols-5 gap-2');
      imgs.forEach((a) => {
        const dropped = state.excluded.has(a.id);
        const b = el('button', `relative aspect-square overflow-hidden rounded-lg border ${dropped ? 'border-white/10 opacity-40' : 'border-primary/60'}`);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(!dropped));
        b.setAttribute('aria-label', `${a.category} image, ${dropped ? 'dropped' : 'kept'}`);
        const im = el('img', 'absolute inset-0 w-full h-full object-cover');
        im.src = a.previewUrl; im.alt = ''; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer';
        im.onerror = () => { b.style.display = 'none'; };
        b.appendChild(im);
        b.appendChild(el('span', 'absolute bottom-0 inset-x-0 bg-black/60 text-[9px] uppercase tracking-wide py-0.5 text-center', a.category));
        b.addEventListener('click', () => { state.excluded.has(a.id) ? state.excluded.delete(a.id) : state.excluded.add(a.id); render(); });
        grid.appendChild(b);
      });
      block.appendChild(grid);
      found.appendChild(block);
    }

    // Deep-scan results
    const lines = [
      shown.fonts?.length && ['Fonts', shown.fonts.slice(0, 3).join(', ')],
      shown.toneOfVoice?.length && ['Tone', `${shown.toneOfVoice.join(', ')} (inferred from the site's wording)`],
      shown.offerings?.length && ['Offers', shown.offerings.slice(0, 5).join(', ')],
      shown.testimonials?.length && ['Customer quote', `“${shown.testimonials[0].slice(0, 140)}”`],
    ].filter(Boolean);
    if (lines.length) {
      const prof = el('div', 'text-xs text-secondary leading-relaxed');
      prof.setAttribute('data-testid', 'brand-kit-profile');
      lines.forEach(([k, v]) => {
        const row = el('div');
        row.appendChild(el('strong', 'text-white', `${k}: `));
        row.appendChild(document.createTextNode(v));
        prof.appendChild(row);
      });
      found.appendChild(prof);
    }

    const scanRow = el('div', 'flex items-center gap-3 flex-wrap');
    const scanBtn = el('button', BTN, state.scan.status === 'scanning' ? 'Scanning pages…' : state.scan.status === 'done' ? '✓ Scanned — scan again' : 'Scan more pages');
    scanBtn.type = 'button';
    scanBtn.setAttribute('data-testid', 'brand-kit-scan');
    scanBtn.title = "Reads the site's About, Products/Services and Reviews pages for fonts, tone, offers and customer quotes";
    scanBtn.disabled = state.scan.status === 'scanning';
    scanBtn.addEventListener('click', scan);
    scanRow.appendChild(scanBtn);
    if (state.scan.message) {
      const m = el('span', `text-xs ${state.scan.status === 'error' ? 'text-red-300' : 'text-secondary'}`, state.scan.message);
      m.setAttribute('role', 'status');
      scanRow.appendChild(m);
    }
    found.appendChild(scanRow);
    dialog.appendChild(found);

    // 3. Save and make
    const act = el('div', 'mt-4 flex items-center gap-2 flex-wrap');
    const saveBtn = el('button', BTN, state.saved ? '✓ Saved to Brand Studio' : 'Save Brand Kit');
    saveBtn.type = 'button';
    saveBtn.setAttribute('data-testid', 'brand-kit-save');
    saveBtn.addEventListener('click', save);
    act.appendChild(saveBtn);
    act.appendChild(select('Make with', Object.entries(BRAND_TARGETS).map(([id, t]) => [id, t.label]), state.target, (v) => { state.target = v; render(); }));
    act.appendChild(select('Length', [[8, '8s'], [15, '15s'], [30, '30s']], state.duration, (v) => { state.duration = Number(v); render(); }));
    act.appendChild(select('Shape', [['9:16', 'Vertical 9:16'], ['16:9', 'Widescreen 16:9']], state.aspect, (v) => { state.aspect = v; }));
    const makeBtn = el('button', BTN_PRIMARY, state.target === 'video' ? `Make a ${state.duration}s ad →` : `Open in ${BRAND_TARGETS[state.target].label} →`);
    makeBtn.type = 'button';
    makeBtn.setAttribute('data-testid', 'brand-kit-make');
    const plan = buildBrandBrief(shown, state.target, { duration: state.duration, aspectRatio: state.aspect });
    if (plan) makeBtn.title = plan.prompt;
    makeBtn.addEventListener('click', make);
    act.appendChild(makeBtn);
    dialog.appendChild(act);
    if (state.target === 'video-agent') {
      dialog.appendChild(el('p', 'text-[11px] text-muted mt-2', 'Video Agent starts writing right away, using your own OpenAI key.'));
    }
    dialog.scrollTop = keepScroll;
  }

  render();
  document.body.appendChild(overlay);
  dialog.querySelector('input')?.focus();
  return close;
}

export default openBrandKitModal;
