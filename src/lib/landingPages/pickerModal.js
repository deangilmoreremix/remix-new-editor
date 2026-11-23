// src/lib/landingPages/pickerModal.js
//
// "Landing pages" picker for every studio and screen that has a finished video.
//   openLandingPagePicker({ video, onPick, onClose })
// 0) choose the video (upload, one you made, or a link) when none was given; "Change video" any time
// 1) grid of the editable designs (search + category chips)  2) click one: the full page with the video in it and the
// visual editor  3) "Save as my page": a draft page is created from that design with the video attached (copied to
// permanent storage when it is a temporary link), then the link is handed to `onPick({ id, url, published, page })`.
// `doneLabel` adds a button on the "Page saved" screen that just closes.
// Edit only (Video Outreach, where the page belongs to the video): `onEdit(data)` with `template` and `data` opens
// straight in the editor; "Save page" hands back the edited page and closes. Nothing is saved in Video Pages.
import { supabase, primeSupabaseIdentity, getClerkUserId } from '../supabase.js';
import { uploadFileToSupabase } from '../uploadService.js';
import { listBrands } from '../brandStore.js';
import { showToast } from '../loading.js';
import { TEMPLATES, defaultConfig, sanitizeEditorData, getTemplate } from './templates.js';
import { sampleSections } from './sampleContent.js';
import { createPageFromVideo, MAX_VIDEO_BYTES } from './ingest.js';
import { updatePage, pageUrl, addContacts, personalUrl } from './client.js';
import { createAiRewritePanel } from './aiRewritePanel.js';
import { normalizeItems, routeContent, listSlots, slotsFor, setSlot, persistTrayMedia, typeOfItem } from './contentTray.js';
import { useTrayItem } from './trayUse.js';
import { exportLinksCsv } from './csv.js';
import { loadCustomers } from './customerSources.js';
import { createCustomerPanel } from './customerPanel.js';
import { applyCustomerToEditor, brandForConfig, customerTokens, toContactFields, dedupeCustomers } from './customerProfile.js';
import { isPermanentUrl, loadVideoSources, fromFile } from './sourceRegistry.js';
import { attachDesignPreview } from './designPreview.js';

const SAMPLE_TOKENS = { firstname: 'Ann', company: 'Acme' };
const INPUT = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50';
const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:border-primary/60 hover:text-primary transition-colors disabled:opacity-50';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 border-l-2 border-l-primary px-4 py-2 text-sm font-bold text-white hover:bg-white/5 transition-colors disabled:opacity-50';

/** How long a design chosen by the caller waits for the customer list before the editor opens anyway. */
export const CUSTOMER_LOAD_LIMIT_MS = 5000;

export const CHIPS = Object.freeze([
  { id: 'all', label: 'All', match: () => true },
  { id: 'saas', label: 'SaaS & outreach', match: (id) => /^editable-(starter|leadiq|lead|reach|mono|poster|enterprise|neon|pb-(pro|agency|enterprise|analytics|creator))$/.test(id) },
  { id: 'local', label: 'Local business', match: (id) => /^editable-(local|persona|spark|pb-(eats|auto|health|shop)|pa-(bistro|motors|local|spa|fitness)|pc-gym|pc-(grooming|drone)-short|pd-(grooming|drone|bees)-long|pd-restaurant)$/.test(id) },
  { id: 'real', label: 'Property & travel', match: (id) => /^editable-(pb-agent|pa-(estate|travel)|pc-realestate|realtor|dreamhome)$/.test(id) },
  { id: 'trades', label: 'Home services', match: (id) => /^editable-pc-(plumbing|pest|landscape|cleaning|moving|solar|roofing|hvac|detailing|(septic|radon|crawl|tub|pool)-(long|short))$|^editable-pd-(grease-long|backflow-long|septic-pumping|crawl-worker|crawl-neon)$|^editable-pc-(crawl-beforeafter|septic-elite)$/.test(id) },
  { id: 'care', label: 'Health, beauty & kids', match: (id) => /^editable-pc-(vet|vision|preschool)$/.test(id) || /^editable-pd-(dental|chiro|medspa|salon)$/.test(id) },
  { id: 'more', label: 'Other', match: (id) => /^editable-(pa-(business|learn|creative)|results|pc-insurance)$/.test(id) },
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
  // Never filled, like the studios' prompt bar: outlined; the main action has a lime left edge (like Generate).
  [BTN]: 'background:transparent;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.8);border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer',
  [BTN_PRIMARY]: 'background:transparent;border:1px solid rgba(255,255,255,.14);border-left:2px solid var(--lp-accent, #d9ff00);color:#fff;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer',
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

const MAX_IMAGE_MB = 15;
let openCount = 0;

/** `zIndex`: where the picker stacks (default 2000); a caller that is itself a full-screen window (the Template Generator, 9999) passes a higher one. */
export function openLandingPagePicker({ video = null, items = [], template = null, data: startData = null, onEdit = null, saveLabel = 'Save page', customers = [], preselect = 'active', onPick, onClose, doneLabel = '', zIndex = 2000, deps = {} } = {}) {
  // Everything the studio sent: the requested item fills the viewer; the rest wait in the tray (a video goes to the video
  // viewer, a picture shows as a still; any item can also be placed in any picture or video slot of the page).
  const routed = routeContent(normalizeItems([video, ...(Array.isArray(items) ? items : [])], toPickerVideo), { prefer: toPickerVideo(video)?.url });
  let src = routed.main || toPickerVideo(video);      // a local file (blob:) is not https, so it is not in the tray but still the main item
  let tray = routed.all.length ? routed.all : (src ? [src] : []);
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  openCount += 1;

  const overlay = el('div', 'fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xl p-2 md:p-6');
  overlay.style.zIndex = String(zIndex);
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
  let data = startData && typeof startData === 'object' ? JSON.parse(JSON.stringify(startData)) : null;
  let saved = null;
  let chosen = null;
  const state = { q: '', chip: 'all' };
  let back = null; // where the video chooser returns to: () => showGrid() or the editor
  let sources = null;
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
  // Edit only (Video Outreach): the page is personal per prospect already, so no customer is picked here.
  const selected = () => (onEdit ? [] : cp.selected());
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
      if (view === 'edit' && !busy && !onEdit) showGrid();
      else if (view === 'video' && src && back) back();
      else close();
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
    if ((view === 'edit' && !onEdit) || (view === 'video' && src && back)) {
      const b = el('button', BTN, view === 'edit' ? '← All pages' : '← Back');
      b.type = 'button';
      b.disabled = busy;
      b.addEventListener('click', view === 'edit' ? showGrid : back);
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
    const hint = el('p', 'text-xs text-secondary mb-4', 'Click a design to see the full page with your video in it, edit every word, then save.');
    wrap.append(videoBar(() => showGrid()));
    const grid = el('div', 'grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5');
    grid.dataset.designGrid = '';
    const all = TEMPLATES.filter((t) => t.editable);
    function paint() {
      chipBtns.forEach((b, id) => {
        const on = id === state.chip;
        b.setAttribute('aria-pressed', String(on));
        b.classList.toggle('border-primary', on);
        b.classList.toggle('text-primary', on);
        b.classList.toggle('border-white/15', !on);
        // The chosen chip has a light lime tint, like Personalize in the prompt bar.
        b.style.borderColor = on ? 'rgba(217,255,0,.35)' : 'rgba(255,255,255,.1)';
        b.style.background = on ? 'rgba(217,255,0,.08)' : 'transparent';
        b.style.color = on ? '#fff' : 'rgba(255,255,255,.7)';
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
        previews.push(attachDesignPreview(pic, t.editorData, { deps }));
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

  // The video going on the page, with "Change video".
  function videoBar(returnTo) {
    const bar = el('div', 'flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5 mb-4');
    bar.style.cssText += ';display:flex;flex-wrap:wrap;align-items:center;gap:12px;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px;margin-bottom:16px;background:rgba(255,255,255,.04)';
    bar.dataset.pickerVideo = '';
    const pic = el('div', 'shrink-0 overflow-hidden rounded-lg bg-black');
    pic.style.cssText = 'width:96px;aspect-ratio:16/9;border-radius:8px;overflow:hidden;background:#000;flex-shrink:0';
    const isStill = !!src && (src.source?.kind === 'image' || isPicture({ url: src.url }));
    if (isStill && !src.posterUrl) { const i = el('img'); i.src = src.url; i.alt = ''; i.style.cssText = 'width:100%;height:100%;object-fit:cover'; pic.appendChild(i); }
    else if (src?.posterUrl) { const i = el('img'); i.src = src.posterUrl; i.alt = ''; i.style.cssText = 'width:100%;height:100%;object-fit:cover'; pic.appendChild(i); }
    else if (src?.url) { const v = el('video'); v.muted = true; v.preload = 'metadata'; v.src = `${src.url}#t=0.5`; v.style.cssText = 'width:100%;height:100%;object-fit:cover'; pic.appendChild(v); }
    const words = el('div', 'min-w-0 flex-1');
    words.style.cssText = 'min-width:0;flex:1';
    words.append(el('div', 'text-[11px] text-secondary', isStill ? 'Picture on the page' : 'Video on the page'), el('div', 'text-sm font-bold truncate', src?.title || 'No video yet'));
    const b = el('button', BTN, src ? (isStill ? 'Change picture' : 'Change video') : 'Choose a video');
    b.type = 'button';
    b.addEventListener('click', () => { back = returnTo; showVideos(); });
    bar.append(pic, words, b);
    return bar;
  }

  // Choose the video: upload a file, pick one you already made, or paste a link.
  function showVideos() {
    destroyEditor();
    clearPreviews();
    view = 'video';
    msg.textContent = src ? '' : 'Choose a video first: upload one, pick one you made, or paste a link.';
    setHead('Choose a video');
    const take = (v) => { if (!v) return; src = v; tray = normalizeItems([v, ...tray]); if (!tray.length) tray = [v]; (back || showGrid)(); };
    const wrap = el('div', 'flex-1 min-h-0 overflow-y-auto p-4 md:p-6 flex flex-col gap-4');
    wrap.style.cssText = 'flex:1;min-height:0;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px';
    wrap.dataset.videoChooser = '';

    const drop = el('label', 'flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/20 p-6 text-center cursor-pointer hover:border-primary/60 transition-colors');
    drop.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;border:1px dashed rgba(255,255,255,.25);border-radius:16px;padding:22px;text-align:center;cursor:pointer';
    drop.append(el('span', 'text-sm font-bold', 'Upload a video or picture'), el('span', 'text-xs text-secondary', `Drop a file here or click to choose (video up to ${MAX_VIDEO_BYTES / 1048576}MB, picture up to ${MAX_IMAGE_MB}MB)`));
    const file = el('input', 'sr-only');
    file.type = 'file';
    file.accept = 'video/*,image/*';
    file.setAttribute('aria-label', 'Upload a video or picture');
    file.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0';
    drop.appendChild(file);
    const takeFile = (f) => {
      if (!f) return;
      const pic = String(f.type).startsWith('image/');
      const limit = pic ? MAX_IMAGE_MB * 1048576 : MAX_VIDEO_BYTES;
      if (f.size > limit) { msg.textContent = `This ${pic ? 'picture' : 'video'} is ${Math.round(f.size / 1048576)}MB; the limit is ${limit / 1048576}MB.`; return; }
      const v = fromFile(f, URL.createObjectURL(f));
      if (!v) { msg.textContent = 'That is not a video or picture file.'; return; }
      take(toPickerVideo({ ...v, file: f }));
    };
    file.addEventListener('change', () => takeFile(file.files?.[0]));
    drop.addEventListener('dragover', (e) => e.preventDefault());
    drop.addEventListener('drop', (e) => { e.preventDefault(); takeFile(e.dataTransfer?.files?.[0]); });

    const row = el('div', 'flex flex-col sm:flex-row gap-2');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
    const link = el('input', INPUT);
    link.type = 'url';
    link.placeholder = 'Or paste a video link (https://…/video.mp4)';
    link.setAttribute('aria-label', 'Video link');
    link.style.flex = '1';
    const use = el('button', BTN, 'Use link');
    use.type = 'button';
    use.addEventListener('click', () => {
      const v = toPickerVideo({ url: link.value.trim(), title: decodeURIComponent(link.value.split('?')[0].split('/').pop() || '').replace(/\.[^.]+$/, ''), source: { kind: 'link' } });
      if (!v || !/^https:\/\//i.test(v.url)) { msg.textContent = 'Paste a full https:// video link.'; return; }
      take(v);
    });
    row.append(link, use);

    const libHead = el('h3', 'text-xs font-black uppercase tracking-widest', 'Or pick a video you already made');
    const lib = el('div', 'grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4');
    lib.style.cssText = 'display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(170px,1fr))';
    lib.dataset.videoLibrary = '';
    const note = (t) => { const n = el('p', 'text-sm text-secondary', t); n.style.gridColumn = '1 / -1'; n.style.opacity = '.7'; return n; };
    lib.appendChild(note('Loading your videos…'));
    (sources ? Promise.resolve(sources) : Promise.resolve().then(() => (deps.loadVideoSources || loadVideoSources)())).then((list) => {
      sources = Array.isArray(list) ? list : [];
      if (view !== 'video') return;
      lib.replaceChildren();
      if (!sources.length) lib.appendChild(note('No videos found yet. Upload one above, or make one in any studio.'));
      sources.slice(0, 60).forEach((v) => {
        const t = el('button', 'text-left rounded-xl border border-white/10 bg-card-bg overflow-hidden hover:border-primary/60 transition-colors');
        t.style.cssText = CSS.card + ';padding:0;overflow:hidden';
        t.type = 'button';
        t.dataset.videoSource = v.key;
        const media = el('div', 'aspect-video bg-black');
        media.style.cssText = 'aspect-ratio:16/9;background:#000';
        if (v.posterUrl) { const i = el('img'); i.src = v.posterUrl; i.alt = ''; i.loading = 'lazy'; i.style.cssText = 'width:100%;height:100%;object-fit:cover'; media.appendChild(i); }
        else { const m = el('video'); m.muted = true; m.preload = 'metadata'; m.src = `${v.url}#t=0.5`; m.style.cssText = 'width:100%;height:100%;object-fit:cover'; media.appendChild(m); }
        const cap = el('div', 'p-2');
        cap.style.padding = '8px';
        cap.append(el('div', 'text-xs font-bold truncate', v.title), el('div', 'text-[11px] text-secondary truncate', [v.source?.studio || v.source?.kind, v.permanent ? '' : 'will be copied'].filter(Boolean).join(' · ')));
        t.append(media, cap);
        t.addEventListener('click', () => take(toPickerVideo(v)));
        lib.appendChild(t);
      });
    }).catch(() => { if (view === 'video') lib.replaceChildren(note('Could not load your videos. Upload one or paste a link.')); });

    wrap.append(drop, row, libHead, lib);
    body.replaceChildren(wrap);
  }

  async function showEdit(templateId, { keep = false, plain = false } = {}) {
    destroyEditor();
    clearPreviews();
    if (!src && !onEdit) { back = () => showEdit(templateId); showVideos(); return; }
    const same = (keep && chosen?.id === templateId && data) || (!chosen && data);
    chosen = getTemplate(templateId);
    const sel = selected();
    const one = sel.length === 1 ? sel[0] : null;
    const withBrand = !!one && cp.brand() && !plain;
    const withImage = !!one && cp.useImage() && !plain; // the picture option works even with the brand option off
    let applied = [];
    if (same) { /* keep the edits */ }
    else if (withBrand || withImage) {
      const cfg = defaultConfig(chosen.id, { title: src?.title || '', brand: withBrand ? brandForConfig(one) : brandDefaults() });
      const r = applyCustomerToEditor(cfg.editor, one, { useImage: cp.useImage(), brand: withBrand });
      data = r.data; applied = r.applied;
    } else {
      data = defaultConfig(chosen.id, { title: src?.title || '', brand: brandDefaults() }).editor;
    }
    const previewTokens = sel.length ? customerTokens(sel[0]) : SAMPLE_TOKENS;
    view = 'edit';
    msg.textContent = '';
    const saveBtn = el('button', BTN_PRIMARY, onEdit ? saveLabel : 'Save as my page');
    saveBtn.type = 'button';
    saveBtn.disabled = !src && !onEdit;
    const change = el('button', BTN, 'Change video');
    change.type = 'button';
    change.addEventListener('click', () => { if (busy) return; back = () => showEdit(chosen.id, { keep: true }); showVideos(); });
    setHead(chosen.name, onEdit ? [saveBtn] : [change, saveBtn]);
    const hint = el('p', 'px-4 md:px-6 pt-2 text-xs text-secondary', 'Click any text to edit it. Use the left panel to add, remove or reorder sections.');
    let noteEl = null;
    if (sel.length) {
      const note = el('div', 'px-4 md:px-6 pt-1 text-xs');
      note.dataset.personalizedNote = '';
      note.style.cssText = 'color:var(--lp-accent, #d9ff00);display:flex;gap:10px;align-items:center;flex-wrap:wrap';
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
    const host = el('div', 'flex-1 min-h-0 m-3 md:m-4 rounded-2xl border border-white/10 overflow-hidden rx-editor');
    host.dataset.editorHost = '';
    // Write the whole page with AI from a few words about the business (the words only; you review every change).
    const aiPanel = createAiRewritePanel({
      getData: () => data,
      setData: (d) => { data = d; startEditor(); },
      context: `${src?.title || ''} (${chosen?.name || ''})`,
      pageId: 'preview',
    });
    aiPanel.style.margin = '0 16px';
    // The content tray: what the studio sent. Each item can become the main video / picture, or go into any picture or
    // video slot on the page (it is saved to the account first if its link is temporary).
    const trayHost = el('div');
    trayHost.dataset.contentTrayHost = '';
    body.replaceChildren(...[hint, noteEl, onEdit ? null : trayHost, aiPanel, host].filter(Boolean));
    async function refreshTray() {
      trayHost.replaceChildren();
      if (onEdit || !tray.length || view !== 'edit') return;
      let slots = [];
      try { slots = listSlots(data, (await import('./editor/config.jsx')).editorConfig.components); } catch { /* no slot list: only "Make main" */ }
      if (view !== 'edit') return;
      // el() takes (tag, className, text): inline styles go through this helper
      const box = (tag, css, text, cls = '') => {
        const n = el(tag, cls, text);
        css.split(';').forEach((d) => { const i = d.indexOf(':'); if (i > 0) n.style.setProperty(d.slice(0, i).trim(), d.slice(i + 1).trim()); });
        return n;
      };
      const strip = box('div', 'margin:8px 16px 0;padding:8px 10px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.04);display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap');
      strip.dataset.contentTray = '';
      strip.appendChild(box('div', 'margin-top:2px;min-width:84px;font-size:12px;font-weight:800;color:var(--lp-accent, #d9ff00)', 'From your studio'));
      tray.forEach((item) => {
        const kind = typeOfItem(item);
        const card = box('div', 'display:grid;gap:4px;width:150px');
        card.dataset.trayCard = '';
        const thumb = box('div', 'width:150px;height:84px;border-radius:8px;overflow:hidden;background:#000;position:relative');
        if (kind === 'video' && !item.posterUrl) { const v = el('video'); v.muted = true; v.preload = 'metadata'; v.src = `${item.url}#t=0.5`; v.style.cssText = 'width:100%;height:100%;object-fit:cover'; thumb.appendChild(v); }
        else { const i = el('img'); i.src = item.posterUrl || item.url; i.alt = ''; i.loading = 'lazy'; i.style.cssText = 'width:100%;height:100%;object-fit:cover'; thumb.appendChild(i); }
        const badge = box('span', 'position:absolute;left:6px;top:6px;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:800;background:rgba(0,0,0,.7);color:#fff', item.url === src?.url ? `Main ${kind === 'video' ? 'video' : 'picture'}` : (kind === 'video' ? 'Video' : 'Picture'));
        thumb.appendChild(badge);
        const sel = box('select', 'width:100%;font-size:12px;padding:6px 8px', undefined, INPUT);
        sel.dataset.trayMenu = '';
        sel.setAttribute('aria-label', `Use ${item.title || 'this item'}`);
        const own = slotsFor(slots, kind);
        const add = (v, label) => { const o = el('option', '', label); o.value = v; sel.appendChild(o); };
        add('', 'Use in…');
        if (item.url !== src?.url) add('__main', kind === 'video' ? 'Make main video (viewer)' : 'Make main picture (viewer still)');
        own.forEach((sl, i) => add(String(i), sl.label.length > 60 ? `${sl.label.slice(0, 57)}…` : sl.label));
        sel.addEventListener('change', async () => {
          const v = sel.value;
          sel.value = '';
          if (!v || busy) return;
          sel.disabled = true; msg.style.color = ''; msg.textContent = 'Saving to your account…';
          try {
            if (v === '__main') {
              src = item;
              tray = [item, ...tray.filter((t) => t !== item)];
            } else {
              const url = await useTrayItem(item, { upload });
              data = setSlot(data, own[Number(v)].path, url);
            }
            msg.textContent = '';
            await startEditor();
          } catch (err) {
            msg.textContent = err?.message || 'Could not place that.';
            sel.disabled = false;
          }
        });
        card.append(thumb, box('div', 'overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11px;opacity:.75', item.title || ''), sel);
        strip.appendChild(card);
      });
      trayHost.appendChild(strip);
    }
    async function startEditor() {
      try {
        const mount = deps.mountPageEditor || (await import('./editor/mount.jsx')).mountPageEditor;
        if (view !== 'edit' || !overlay.isConnected) return;
        destroyEditor();
        editor = mount(host, {
          page: { id: 'preview', title: src?.title || '', video_url: src?.url || '', poster_url: src?.posterUrl || null },
          data,
          tokens: previewTokens,
          onPublish: () => saveBtn.click(),
          onChange: (d) => { const n = sanitizeEditorData(d); if (n) data = n; },
          getTray: () => tray,
        });
        void refreshTray();     // in the background: the editor and Save must not wait for the slot list
      } catch (err) {
        msg.textContent = err?.message || 'Could not load the editor';
      }
    }
    await startEditor();
    saveBtn.addEventListener('click', async () => {
      if (onEdit) {
        if (busy) return;
        const page = sanitizeEditorData(data) || data;
        close();
        try { onEdit(page); } catch { /* caller bug */ }
        return;
      }
      if (!src || busy) return;
      busy = true; saveBtn.disabled = true; change.disabled = true; msg.textContent = '';
      saveBtn.textContent = 'Saving…';
      try {
        await primeSupabaseIdentity();
        const create = deps.createPageFromVideo || createPageFromVideo;
        const row = await create(supabase, src, { template: chosen.id, brand: withBrand ? brandForConfig(one) : brandDefaults(), deps: { upload }, onStep: (l) => { saveBtn.textContent = `${l}…`; } });
        // Placed studio items still have temporary provider links: store them and swap the links before the page is saved.
        saveBtn.textContent = 'Saving pictures…';
        const persisted = await persistTrayMedia(sanitizeEditorData(data) || row.config?.editor, { tray, upload });
        const page = await (deps.updatePage || updatePage)(supabase, row.id, { config: { ...row.config, editor: persisted.data } });
        saved = { id: row.id, url: pageUrl(row.id), published: !!page.published, page, contacts: [], contactError: '', mediaWarning: persisted.failed.length ? `${persisted.failed.map((f) => f.title).join(', ')} could not be saved to your account, so ${persisted.failed.length === 1 ? 'it was' : 'they were'} left out of the page.` : '' };
        const contactRows = sel.map(toContactFields).filter(Boolean).map((fields) => ({ fields }));
        if (contactRows.length) {
          try { saved.contacts = await (deps.addContacts || addContacts)(supabase, row.id, contactRows); } catch (err) { saved.contactError = err?.message || 'Could not make the personal links'; }
        }
        busy = false;
        try { onPick?.(saved); } catch { /* caller bug */ }
        showDone();
      } catch (err) {
        busy = false; saveBtn.disabled = false; change.disabled = false; saveBtn.textContent = 'Save as my page';
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
    if (saved.mediaWarning) box.appendChild(el('div', 'text-sm text-amber-300', saved.mediaWarning));
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
        const samples = sampleSections(saved.page?.config?.editor, tpl.editorData, tpl.sampleTypes || []);
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
    const done = el('button', doneLabel ? BTN_PRIMARY : BTN, doneLabel || 'Done');
    done.type = 'button';
    done.addEventListener('click', close);
    row.append(open, done);
    box.append(note, row);
    body.replaceChildren(box);
  }

  // A design chosen by the caller opens the editor right away, but only after the customers are loaded,
  // so the first draft already has the customer's brand and personalized picture.
  if (template && TEMPLATES.some((t) => t.editable && t.id === template)) {
    // Wait for the customers, but never more than a few seconds: a stalled request must not keep the editor closed.
    // (Editing an existing page needs no customer lookup first.)
    const loaded = onEdit ? Promise.resolve() : Promise.resolve(cp.load()).catch(() => {});
    let timer;
    const limit = new Promise((resolve) => { timer = setTimeout(resolve, CUSTOMER_LOAD_LIMIT_MS); });
    Promise.race([loaded, limit]).then(() => { clearTimeout(timer); if (overlay.isConnected) showEdit(template); });
  } else {
    if (!onEdit) void cp.load();
    if (!src) { back = () => showGrid(); showVideos(); } else showGrid();
  }
  dialog.focus();
  return { close, element: overlay };
}
