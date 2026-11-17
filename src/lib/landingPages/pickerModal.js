// src/lib/landingPages/pickerModal.js
//
// "Landing pages" picker for every studio and screen that has a finished video.
//   openLandingPagePicker({ video, onPick, onClose })
// 1) grid of the editable designs (search + category chips)  2) click one: the full page with the video in it and the
// visual editor  3) "Save as my page": a draft page is created from that design with the video attached (copied to
// permanent storage when it is a temporary link), then the link is handed to `onPick({ id, url, published, page })`.
import { supabase, primeSupabaseIdentity, getClerkUserId } from '../supabase.js';
import { uploadFileToSupabase } from '../uploadService.js';
import { listBrands } from '../brandStore.js';
import { showToast } from '../loading.js';
import { TEMPLATES, defaultConfig, sanitizePuck, getTemplate } from './templates.js';
import { sampleSections } from './sampleContent.js';
import { createPageFromVideo, MAX_VIDEO_BYTES } from './ingest.js';
import { updatePage, pageUrl, addContacts, personalUrl } from './client.js';
import { exportLinksCsv } from './csv.js';
import { loadCustomers } from './customerSources.js';
import { createCustomerPanel } from './customerPanel.js';
import { applyCustomerToPuck, brandForConfig, customerTokens, toContactFields, dedupeCustomers } from './customerProfile.js';
import { isPermanentUrl } from './sourceRegistry.js';
import { attachDesignPreview } from './designPreview.js';

const SAMPLE_TOKENS = { firstname: 'Ann', company: 'Acme' };
const INPUT = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50';
const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:border-primary/60 hover:text-primary transition-colors disabled:opacity-50';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-black hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50';

/** How long a design chosen by the caller waits for the customer list before the editor opens anyway. */
export const CUSTOMER_LOAD_LIMIT_MS = 5000;

export const CHIPS = Object.freeze([
  { id: 'all', label: 'All', match: () => true },
  { id: 'saas', label: 'SaaS & outreach', match: (id) => /^puck-(starter|leadiq|lead|reach|mono|poster|enterprise|neon|pb-(pro|agency|enterprise|analytics|creator))$/.test(id) },
  { id: 'local', label: 'Local business', match: (id) => /^puck-(local|persona|spark|pb-(eats|auto|health|shop)|pa-(bistro|motors|local|spa|fitness)|pd-restaurant)$/.test(id) },
  { id: 'real', label: 'Property & travel', match: (id) => /^puck-(pb-agent|pa-(estate|travel)|pc-realestate|realtor|dreamhome)$/.test(id) },
  { id: 'trades', label: 'Home services', match: (id) => /^puck-pc-(plumbing|pest|landscape|cleaning|moving|solar|roofing|hvac|detailing)$/.test(id) },
  { id: 'care', label: 'Health, beauty & kids', match: (id) => /^puck-pc-(vet|vision|preschool)$/.test(id) || /^puck-pd-(dental|chiro|medspa|salon)$/.test(id) },
  { id: 'more', label: 'Other', match: (id) => /^puck-(pa-(business|learn|creative)|results|pc-insurance)$/.test(id) },
]);

/** Pure: which designs show for a search text and category chip. */
export function filterTemplates(list, { q = '', chip = 'all' } = {}) {
  const m = CHIPS.find((c) => c.id === chip) || CHIPS[0];
  const s = String(q).trim().toLowerCase();
  return list.filter((t) => m.match(t.id) && (!s || `${t.name} ${t.description}`.toLowerCase().includes(s)));
}

/** Pure: accept a loose {url, title|name, posterUrl|thumbnail_url, studio, file} or a normalized source; null when unusable. */
const isPicture = (input) => input.type === 'image' || input.kind === 'image' || /\.(png|jpe?g|webp|gif|avif)$/i.test(String(input.url || '').split(/[?#]/)[0]);

export function toPickerVideo(input) {
  if (!input || typeof input !== 'object') return null;
  const url = String(input.url || '');
  if (!/^(https:\/\/|blob:)/i.test(url) || url.length > 2048) return null;
  const poster = input.posterUrl || input.thumbnail_url || null;
  return {
    key: input.key || `picker:${url}`,
    url,
    posterUrl: typeof poster === 'string' && /^https:\/\//i.test(poster) && poster !== url ? poster : null,
    title: String(input.title || input.name || input.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 120) || (isPicture(input) ? 'My picture' : 'My video'),
    duration: Number.isFinite(Number(input.duration)) ? Number(input.duration) : null,
    source: input.source && typeof input.source === 'object' ? input.source : { kind: isPicture(input) ? 'image' : 'video', studio: String(input.studio || '').slice(0, 40) },
    permanent: isPermanentUrl(url),
    ...(input.file ? { file: input.file } : {}),
  };
}

// The picker is shown inside other screens (Timeline Studio loads its own Tailwind build where `bg-primary` etc. differ),
// so the pieces that must always look right carry inline styles as well as classes.
const CSS = {
  [BTN]: 'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:12px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer',
  [BTN_PRIMARY]: 'background:#d9ff00;border:1px solid #d9ff00;color:#000;border-radius:12px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer',
  [`${INPUT} max-w-sm`]: 'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:10px;padding:9px 12px;font-size:13px;min-width:220px',
  [INPUT]: 'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:10px;padding:9px 12px;font-size:13px;width:100%',
  card: 'background:#141414;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:12px;text-align:left;color:#fff;cursor:pointer',
  dialog: 'background:#0a0a0a;border:1px solid rgba(255,255,255,.12);border-radius:18px;color:#fff;overflow:hidden',
};

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (className && CSS[className]) n.style.cssText = CSS[className];
  if (text !== undefined) n.textContent = text;
  return n;
}

const upload = (file) => {
  const isVideo = String(file.type).startsWith('video/');
  return uploadFileToSupabase(file, { category: isVideo ? 'video' : 'image', maxSize: isVideo ? MAX_VIDEO_BYTES : undefined, userId: getClerkUserId() || undefined });
};
const brandDefaults = () => {
  try {
    const b = listBrands()?.[0];
    return b ? { accent: Array.isArray(b.primaryColors) ? b.primaryColors[0] : '', logoUrl: b.logoUrl || '' } : {};
  } catch { return {}; }
};

let openCount = 0;

export function openLandingPagePicker({ video = null, template = null, customers = [], preselect = 'active', onPick, onClose, deps = {} } = {}) {
  let src = toPickerVideo(video);
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  openCount += 1;

  const overlay = el('div', 'fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xl p-2 md:p-6');
  overlay.style.zIndex = '2000';
  overlay.dataset.landingPicker = '';
  const dialog = el('div', 'w-full max-w-7xl h-full max-h-[94vh] flex flex-col rounded-2xl border border-white/10 bg-panel-bg overflow-hidden text-white');
  dialog.style.cssText += CSS.dialog + ';width:100%;max-width:1280px;height:100%;max-height:94vh;display:flex;flex-direction:column';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Landing pages');
  dialog.tabIndex = -1;
  const head = el('div', 'flex flex-wrap items-center gap-3 px-4 md:px-6 py-3 border-b border-white/5');
  const body = el('div', 'flex-1 min-h-0 flex flex-col');
  const msg = el('div', 'px-4 md:px-6 pt-3 text-sm text-red-300 empty:hidden');
  dialog.append(head, msg, body);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  let view = 'grid';
  let busy = false;
  let editor = null;
  let data = null;
  let saved = null;
  let chosen = null;
  const state = { q: '', chip: 'all' };
  // `customers` = people the caller already has (e.g. the contacts imported in the Personalize hub), listed first.
  const baseLoad = deps.loadCustomers || loadCustomers;
  const cp = createCustomerPanel({
    preselect,
    loadCustomers: async () => {
      const r = await baseLoad();
      const given = (customers || []).filter(Boolean);
      return { customers: dedupeCustomers([...given, ...(r?.customers || [])]), activeId: r?.activeId };
    },
  });
  const selected = () => cp.selected();
  let previews = [];
  const clearPreviews = () => { previews.forEach((h) => h.destroy()); previews = []; };

  const destroyEditor = () => { try { editor?.destroy(); } catch { /* already gone */ } editor = null; };
  const close = () => {
    if (!overlay.isConnected) return;
    destroyEditor();
    clearPreviews();
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    document.body.style.overflow = openCount > 1 ? 'hidden' : prevOverflow;
    openCount -= 1;
    try { onClose?.(); } catch { /* caller bug must not leave the page locked */ }
  };
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea';
  function onKey(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (view === 'edit' && !busy) showGrid(); else close();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = [...dialog.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay && view !== 'edit') close(); });

  const setHead = (title, extras = []) => {
    head.replaceChildren();
    if (view === 'edit') {
      const b = el('button', BTN, '← All pages');
      b.type = 'button';
      b.disabled = busy;
      b.addEventListener('click', showGrid);
      head.appendChild(b);
    }
    head.appendChild(el('h2', 'text-sm font-black uppercase tracking-widest', title));
    head.appendChild(el('div', 'flex-1'));
    extras.forEach((x) => head.appendChild(x));
    const x = el('button', BTN, '✕');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', close);
    head.appendChild(x);
  };

  function showGrid() {
    destroyEditor();
    clearPreviews();
    view = 'grid';
    msg.textContent = '';
    setHead('Choose a landing page');
    const wrap = el('div', 'flex-1 min-h-0 overflow-y-auto p-4 md:p-6');
    const bar = el('div', 'flex flex-wrap items-center gap-2 mb-4');
    const search = el('input', `${INPUT} max-w-sm`);
    search.type = 'search';
    search.placeholder = 'Search designs';
    search.setAttribute('aria-label', 'Search designs');
    bar.appendChild(search);
    const chipBtns = new Map();
    CHIPS.forEach((c) => {
      const b = el('button', 'rounded-full border px-3 py-1 text-xs font-bold transition-colors', c.label);
      b.style.cssText = 'border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;color:#fff;cursor:pointer;background:transparent';
      b.type = 'button';
      b.addEventListener('click', () => { state.chip = c.id; paint(); });
      chipBtns.set(c.id, b);
      bar.appendChild(b);
    });
    const panel = cp.el; cp.fill();
    const hint = el('p', 'text-xs text-secondary mb-4', src ? 'Click a design to see the full page with your video in it, edit every word, then save.' : '');
    if (!src) {
      msg.textContent = 'No usable video or picture yet (it needs an https link). Paste one below to continue.';
      const row = el('div', 'flex flex-col sm:flex-row gap-2 mb-4');
      const link = el('input', INPUT);
      link.type = 'url';
      link.placeholder = 'https://…/video.mp4 or picture.png';
      link.setAttribute('aria-label', 'Video link');
      const use = el('button', BTN, 'Use link');
      use.type = 'button';
      use.addEventListener('click', () => {
        const v = toPickerVideo({ url: link.value.trim(), title: decodeURIComponent(link.value.split('?')[0].split('/').pop() || '').replace(/\.[^.]+$/, '') });
        if (!v || !/^https:\/\//i.test(v.url)) { msg.textContent = 'Paste a full https:// video or picture link.'; return; }
        src = v;
        showGrid();
      });
      row.append(link, use);
      wrap.append(row);
    }
    const grid = el('div', 'grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5');
    grid.dataset.designGrid = '';
    const all = TEMPLATES.filter((t) => t.puck);
    function paint() {
      chipBtns.forEach((b, id) => {
        const on = id === state.chip;
        b.setAttribute('aria-pressed', String(on));
        b.classList.toggle('border-primary', on);
        b.classList.toggle('text-primary', on);
        b.classList.toggle('border-white/15', !on);
        b.style.borderColor = on ? '#d9ff00' : 'rgba(255,255,255,.18)';
        b.style.color = on ? '#d9ff00' : '#fff';
      });
      clearPreviews();
      grid.replaceChildren();
      const list = filterTemplates(all, state);
      if (!list.length) grid.appendChild(el('p', 'col-span-full text-sm text-secondary', 'No designs match.'));
      list.forEach((t) => {
        const b = el('button', 'text-left rounded-xl border border-white/10 bg-card-bg p-3 hover:border-primary/60 transition-colors');
        b.style.cssText = CSS.card;
        b.type = 'button';
        b.dataset.template = t.id;
        const pic = el('div', '');
        pic.style.marginBottom = '8px';
        pic.setAttribute('aria-label', `Preview of ${t.name}`);
        previews.push(attachDesignPreview(pic, t.puckData, { deps }));
        const name = el('div', 'text-xs font-bold leading-tight', t.name);
        name.style.cssText = 'font-size:12px;font-weight:700';
        const desc = el('div', 'text-[11px] text-secondary mt-1 line-clamp-2', t.description);
        desc.style.cssText = 'font-size:11px;opacity:.65;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden';
        b.append(pic, name, desc);
        b.addEventListener('click', () => showEdit(t.id));
        grid.appendChild(b);
      });
    }
    search.addEventListener('input', () => { state.q = search.value; paint(); });
    paint();
    wrap.append(panel, bar, hint, grid);
    body.replaceChildren(wrap);
  }

  async function showEdit(templateId, { plain = false } = {}) {
    clearPreviews();
    chosen = getTemplate(templateId);
    const sel = selected();
    const one = sel.length === 1 ? sel[0] : null;
    const withBrand = !!one && cp.brand() && !plain;
    const withImage = !!one && cp.useImage() && !plain; // the picture option works even with the brand option off
    let applied = [];
    if (withBrand || withImage) {
      const cfg = defaultConfig(chosen.id, { title: src?.title || '', brand: withBrand ? brandForConfig(one) : brandDefaults() });
      const r = applyCustomerToPuck(cfg.puck, one, { useImage: cp.useImage(), brand: withBrand });
      data = r.data; applied = r.applied;
    } else {
      data = defaultConfig(chosen.id, { title: src?.title || '', brand: brandDefaults() }).puck;
    }
    const previewTokens = sel.length ? customerTokens(sel[0]) : SAMPLE_TOKENS;
    view = 'edit';
    msg.textContent = '';
    const saveBtn = el('button', BTN_PRIMARY, 'Save as my page');
    saveBtn.type = 'button';
    saveBtn.disabled = !src;
    setHead(chosen.name, [saveBtn]);
    const hint = el('p', 'px-4 md:px-6 pt-2 text-xs text-secondary', 'Click any text to edit it. Use the left panel to add, remove or reorder sections.');
    let noteEl = null;
    if (sel.length) {
      const note = el('div', 'px-4 md:px-6 pt-1 text-xs');
      note.dataset.personalizedNote = '';
      note.style.cssText = 'color:#d9ff00;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
      note.appendChild(el('span', '', (withBrand || withImage)
        ? `Personalized for ${one.label}${applied.length ? `: ${applied.join(', ')} filled in` : ''}. Previewing as ${sel[0].label}.`
        : sel.length === 1 ? `Plain design. Previewing as ${sel[0].label}.` : `${sel.length} personal links will be made when you save. Previewing as ${sel[0].label}.`));
      if (withBrand || withImage) {
        const undo = el('button', '', 'Use the plain design'); undo.type = 'button';
        undo.style.cssText = 'background:none;border:0;color:#fff;text-decoration:underline;cursor:pointer;font-size:12px';
        undo.addEventListener('click', () => showEdit(templateId, { plain: true }));
        note.appendChild(undo);
      }
      noteEl = note;
    }
    const host = el('div', 'flex-1 min-h-0 m-3 md:m-4 rounded-2xl border border-white/10 overflow-hidden bg-white');
    host.dataset.editorHost = '';
    body.replaceChildren(...[hint, noteEl, host].filter(Boolean));
    try {
      const mount = deps.mountPuckEditor || (await import('./puck/mount.jsx')).mountPuckEditor;
      if (view !== 'edit' || !overlay.isConnected) return;
      editor = mount(host, {
        page: { id: 'preview', title: src?.title || '', video_url: src?.url || '', poster_url: src?.posterUrl || null },
        data,
        tokens: previewTokens,
        onPublish: () => saveBtn.click(),
        onChange: (d) => { const n = sanitizePuck(d); if (n) data = n; },
      });
    } catch (err) {
      msg.textContent = err?.message || 'Could not load the editor';
    }
    saveBtn.addEventListener('click', async () => {
      if (!src || busy) return;
      busy = true; saveBtn.disabled = true; msg.textContent = '';
      saveBtn.textContent = 'Saving…';
      try {
        await primeSupabaseIdentity();
        const create = deps.createPageFromVideo || createPageFromVideo;
        const row = await create(supabase, src, { template: chosen.id, brand: withBrand ? brandForConfig(one) : brandDefaults(), deps: { upload }, onStep: (l) => { saveBtn.textContent = `${l}…`; } });
        const page = await (deps.updatePage || updatePage)(supabase, row.id, { config: { ...row.config, puck: sanitizePuck(data) || row.config?.puck } });
        saved = { id: row.id, url: pageUrl(row.id), published: !!page.published, page, contacts: [], contactError: '' };
        const contactRows = sel.map(toContactFields).filter(Boolean).map((fields) => ({ fields }));
        if (contactRows.length) {
          try { saved.contacts = await (deps.addContacts || addContacts)(supabase, row.id, contactRows); } catch (err) { saved.contactError = err?.message || 'Could not make the personal links'; }
        }
        busy = false;
        try { onPick?.(saved); } catch { /* caller bug */ }
        showDone();
      } catch (err) {
        busy = false; saveBtn.disabled = false; saveBtn.textContent = 'Save as my page';
        msg.textContent = err?.message || 'Could not save the page';
      }
    });
  }

  function showDone() {
    destroyEditor();
    view = 'done';
    msg.textContent = '';
    setHead('Page saved');
    const box = el('div', 'p-6 flex flex-col items-start gap-4 max-w-2xl');
    box.appendChild(el('div', 'rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200', `Saved to Video Pages with your video attached${saved.published ? ' and published.' : ' as a draft.'}`));
    box.appendChild(el('div', 'rounded-xl border border-white/10 bg-white/5 p-3 text-xs break-all', saved.url));
    const note = el('div', 'text-xs font-bold text-primary min-h-[1rem]');
    if (saved.contactError) box.appendChild(el('div', 'text-sm text-amber-300', `The page is saved, but the personal links were not made: ${saved.contactError}. Add them from Video Pages > Personal links.`));
    if (saved.contacts?.length) {
      const links = el('div', ''); links.dataset.personalLinks = '';
      links.style.cssText = 'width:100%;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:10px 12px;font-size:12px;display:grid;gap:4px';
      links.appendChild(el('div', '', `${saved.contacts.length} personal link${saved.contacts.length === 1 ? '' : 's'} (they work once the page is published)`));
      saved.contacts.slice(0, 4).forEach((c) => { const l = el('div', 'break-all text-secondary', `${[c.fields?.firstname, c.fields?.lastname].filter(Boolean).join(' ') || c.fields?.company || 'Contact'}: ${personalUrl(saved.id, c.id)}`); links.appendChild(l); });
      if (saved.contacts.length > 4) links.appendChild(el('div', 'text-secondary', `and ${saved.contacts.length - 4} more`));
      const csvBtn = el('button', BTN, 'Copy all links (CSV)'); csvBtn.type = 'button';
      csvBtn.addEventListener('click', async () => { try { await navigator.clipboard.writeText(exportLinksCsv(saved.contacts, saved.id, globalThis.location?.origin || '')); note.textContent = 'Links copied'; } catch { note.textContent = 'Copy failed'; } });
      links.appendChild(csvBtn);
      box.appendChild(links);
    }
    const row = el('div', 'flex flex-wrap gap-2');
    const copy = async () => { try { await navigator.clipboard.writeText(saved.url); note.textContent = 'Link copied'; } catch { note.textContent = 'Copy failed'; } };
    if (saved.published) {
      const b = el('button', BTN, 'Copy link'); b.type = 'button'; b.addEventListener('click', copy); row.appendChild(b);
    } else {
      const b = el('button', BTN_PRIMARY, 'Publish and copy link');
      b.type = 'button';
      b.addEventListener('click', async () => {
        const tpl = chosen || getTemplate(saved.page?.config?.template);
        const samples = sampleSections(saved.page?.config?.puck, tpl.puckData, tpl.sampleTypes || []);
        if (samples.length && !window.confirm(`${samples.length} section${samples.length === 1 ? ' still uses' : 's still use'} sample content (made-up names, numbers or quotes). Publish anyway?`)) return;
        b.disabled = true;
        try {
          const page = await (deps.updatePage || updatePage)(supabase, saved.id, { published: true });
          saved = { ...saved, published: !!page.published, page };
          try { onPick?.(saved); } catch { /* caller bug */ }
          await copy();
          showDone();
        } catch (err) { b.disabled = false; msg.textContent = err?.message || 'Could not publish'; }
      });
      row.appendChild(b);
    }
    const open = el('button', BTN, 'Open in Video Pages');
    open.type = 'button';
    open.addEventListener('click', async () => {
      close();
      try { const { navigate } = await import('../router.js'); navigate('video-pages'); } catch { showToast('Open Video Pages from the menu.', 'info', 3000); }
    });
    const done = el('button', BTN, 'Done');
    done.type = 'button';
    done.addEventListener('click', close);
    row.append(open, done);
    box.append(note, row);
    body.replaceChildren(box);
  }

  // A design chosen by the caller opens the editor right away, but only after the customers are loaded,
  // so the first draft already has the customer's brand and personalized picture.
  if (template && TEMPLATES.some((t) => t.puck && t.id === template)) {
    // Wait for the customers, but never more than a few seconds: a stalled request must not keep the editor closed.
    const loaded = Promise.resolve(cp.load()).catch(() => {});
    let timer;
    const limit = new Promise((resolve) => { timer = setTimeout(resolve, CUSTOMER_LOAD_LIMIT_MS); });
    Promise.race([loaded, limit]).then(() => { clearTimeout(timer); if (overlay.isConnected) showEdit(template); });
  } else {
    void cp.load();
    showGrid();
  }
  dialog.focus();
  return { close, element: overlay };
}
