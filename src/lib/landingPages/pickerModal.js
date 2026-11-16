// src/lib/landingPages/pickerModal.js
//
// "Landing pages" picker for every studio and screen that has a finished video.
//   openLandingPagePicker({ video, onPick, onClose })
// 0) choose the video (upload, one you made, or a link) when none was given; "Change video" any time
// 1) grid of the editable designs (search + category chips)  2) click one: the full page with the video in it and the
// visual editor  3) "Save as my page": a draft page is created from that design with the video attached (copied to
// permanent storage when it is a temporary link), then the link is handed to `onPick({ id, url, published, page })`.
// `doneLabel` adds a button on the "Page saved" screen that just closes (e.g. Video Outreach's "Use this page").
import { supabase, primeSupabaseIdentity, getClerkUserId } from '../supabase.js';
import { uploadFileToSupabase } from '../uploadService.js';
import { listBrands } from '../brandStore.js';
import { showToast } from '../loading.js';
import { TEMPLATES, defaultConfig, sanitizePuck, getTemplate } from './templates.js';
import { sampleSections } from './sampleContent.js';
import { createPageFromVideo, MAX_VIDEO_BYTES } from './ingest.js';
import { updatePage, pageUrl } from './client.js';
import { isPermanentUrl, loadVideoSources, fromFile } from './sourceRegistry.js';
import { attachDesignPreview } from './designPreview.js';

const SAMPLE_TOKENS = { firstname: 'Ann', company: 'Acme' };
const INPUT = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50';
const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:border-primary/60 hover:text-primary transition-colors disabled:opacity-50';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-black hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50';

export const CHIPS = Object.freeze([
  { id: 'all', label: 'All', match: () => true },
  { id: 'saas', label: 'SaaS & outreach', match: (id) => /^puck-(starter|leadiq|lead|reach|mono|poster|enterprise|neon|pb-(pro|agency|enterprise|analytics|creator))$/.test(id) },
  { id: 'local', label: 'Local business', match: (id) => /^puck-(local|persona|spark|pb-(eats|auto|health|shop)|pa-(bistro|motors|local|spa|fitness))$/.test(id) },
  { id: 'real', label: 'Property & travel', match: (id) => /^puck-(pb-agent|pa-(estate|travel)|realtor|dreamhome)$/.test(id) },
  { id: 'more', label: 'Other', match: (id) => /^puck-(pa-(business|learn|creative)|results)$/.test(id) },
]);

/** Pure: which designs show for a search text and category chip. */
export function filterTemplates(list, { q = '', chip = 'all' } = {}) {
  const m = CHIPS.find((c) => c.id === chip) || CHIPS[0];
  const s = String(q).trim().toLowerCase();
  return list.filter((t) => m.match(t.id) && (!s || `${t.name} ${t.description}`.toLowerCase().includes(s)));
}

/** Pure: accept a loose {url, title|name, posterUrl|thumbnail_url, studio, file} or a normalized source; null when unusable. */
export function toPickerVideo(input) {
  if (!input || typeof input !== 'object') return null;
  const url = String(input.url || '');
  if (!/^(https:\/\/|blob:)/i.test(url) || url.length > 2048) return null;
  const poster = input.posterUrl || input.thumbnail_url || null;
  return {
    key: input.key || `picker:${url}`,
    url,
    posterUrl: typeof poster === 'string' && /^https:\/\//i.test(poster) && poster !== url ? poster : null,
    title: String(input.title || input.name || input.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'My video',
    duration: Number.isFinite(Number(input.duration)) ? Number(input.duration) : null,
    source: input.source && typeof input.source === 'object' ? input.source : { kind: 'video', studio: String(input.studio || '').slice(0, 40) },
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

export function openLandingPagePicker({ video = null, template = null, onPick, onClose, doneLabel = '', deps = {} } = {}) {
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
  let back = null; // where the video chooser returns to: () => showGrid() or the editor
  let sources = null;
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
      if (view === 'edit' && !busy) showGrid();
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
    if (view === 'edit' || (view === 'video' && src && back)) {
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
    const hint = el('p', 'text-xs text-secondary mb-4', 'Click a design to see the full page with your video in it, edit every word, then save.');
    wrap.append(videoBar(() => showGrid()));
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
    wrap.append(bar, hint, grid);
    body.replaceChildren(wrap);
  }

  // The video going on the page, with "Change video".
  function videoBar(returnTo) {
    const bar = el('div', 'flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5 mb-4');
    bar.style.cssText += ';display:flex;flex-wrap:wrap;align-items:center;gap:12px;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px;margin-bottom:16px;background:rgba(255,255,255,.04)';
    bar.dataset.pickerVideo = '';
    const pic = el('div', 'shrink-0 overflow-hidden rounded-lg bg-black');
    pic.style.cssText = 'width:96px;aspect-ratio:16/9;border-radius:8px;overflow:hidden;background:#000;flex-shrink:0';
    if (src?.posterUrl) { const i = el('img'); i.src = src.posterUrl; i.alt = ''; i.style.cssText = 'width:100%;height:100%;object-fit:cover'; pic.appendChild(i); }
    else if (src?.url) { const v = el('video'); v.muted = true; v.preload = 'metadata'; v.src = `${src.url}#t=0.5`; v.style.cssText = 'width:100%;height:100%;object-fit:cover'; pic.appendChild(v); }
    const words = el('div', 'min-w-0 flex-1');
    words.style.cssText = 'min-width:0;flex:1';
    words.append(el('div', 'text-[11px] text-secondary', 'Video on the page'), el('div', 'text-sm font-bold truncate', src?.title || 'No video yet'));
    const b = el('button', BTN, src ? 'Change video' : 'Choose a video');
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
    const take = (v) => { if (!v) return; src = v; (back || showGrid)(); };
    const wrap = el('div', 'flex-1 min-h-0 overflow-y-auto p-4 md:p-6 flex flex-col gap-4');
    wrap.style.cssText = 'flex:1;min-height:0;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px';
    wrap.dataset.videoChooser = '';

    const drop = el('label', 'flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/20 p-6 text-center cursor-pointer hover:border-primary/60 transition-colors');
    drop.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;border:1px dashed rgba(255,255,255,.25);border-radius:16px;padding:22px;text-align:center;cursor:pointer';
    drop.append(el('span', 'text-sm font-bold', 'Upload a video'), el('span', 'text-xs text-secondary', `Drop a video here or click to choose (up to ${MAX_VIDEO_BYTES / 1048576}MB)`));
    const file = el('input', 'sr-only');
    file.type = 'file';
    file.accept = 'video/*';
    file.setAttribute('aria-label', 'Upload a video');
    file.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0';
    drop.appendChild(file);
    const takeFile = (f) => {
      if (!f) return;
      if (f.size > MAX_VIDEO_BYTES) { msg.textContent = `This video is ${Math.round(f.size / 1048576)}MB; the limit is ${MAX_VIDEO_BYTES / 1048576}MB.`; return; }
      const v = fromFile(f, URL.createObjectURL(f));
      if (!v) { msg.textContent = 'That is not a video file.'; return; }
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

  async function showEdit(templateId, { keep = false } = {}) {
    destroyEditor();
    clearPreviews();
    if (!src) { back = () => showEdit(templateId); showVideos(); return; }
    const same = keep && chosen?.id === templateId && data;
    chosen = getTemplate(templateId);
    if (!same) data = defaultConfig(chosen.id, { title: src?.title || '', brand: brandDefaults() }).puck;
    view = 'edit';
    msg.textContent = '';
    const saveBtn = el('button', BTN_PRIMARY, 'Save as my page');
    saveBtn.type = 'button';
    saveBtn.disabled = !src;
    const change = el('button', BTN, 'Change video');
    change.type = 'button';
    change.addEventListener('click', () => { if (busy) return; back = () => showEdit(chosen.id, { keep: true }); showVideos(); });
    setHead(chosen.name, [change, saveBtn]);
    const hint = el('p', 'px-4 md:px-6 pt-2 text-xs text-secondary', 'Click any text to edit it. Use the left panel to add, remove or reorder sections.');
    const host = el('div', 'flex-1 min-h-0 m-3 md:m-4 rounded-2xl border border-white/10 overflow-hidden bg-white');
    host.dataset.editorHost = '';
    body.replaceChildren(hint, host);
    try {
      const mount = deps.mountPuckEditor || (await import('./puck/mount.jsx')).mountPuckEditor;
      if (view !== 'edit' || !overlay.isConnected) return;
      editor = mount(host, {
        page: { id: 'preview', title: src?.title || '', video_url: src?.url || '', poster_url: src?.posterUrl || null },
        data,
        tokens: SAMPLE_TOKENS,
        onPublish: () => saveBtn.click(),
        onChange: (d) => { const n = sanitizePuck(d); if (n) data = n; },
      });
    } catch (err) {
      msg.textContent = err?.message || 'Could not load the editor';
    }
    saveBtn.addEventListener('click', async () => {
      if (!src || busy) return;
      busy = true; saveBtn.disabled = true; change.disabled = true; msg.textContent = '';
      saveBtn.textContent = 'Saving…';
      try {
        await primeSupabaseIdentity();
        const create = deps.createPageFromVideo || createPageFromVideo;
        const row = await create(supabase, src, { template: chosen.id, brand: brandDefaults(), deps: { upload }, onStep: (l) => { saveBtn.textContent = `${l}…`; } });
        const page = await (deps.updatePage || updatePage)(supabase, row.id, { config: { ...row.config, puck: sanitizePuck(data) || row.config?.puck } });
        saved = { id: row.id, url: pageUrl(row.id), published: !!page.published, page };
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
    const done = el('button', doneLabel ? BTN_PRIMARY : BTN, doneLabel || 'Done');
    done.type = 'button';
    done.addEventListener('click', close);
    row.append(open, done);
    box.append(note, row);
    body.replaceChildren(box);
  }

  if (template && TEMPLATES.some((t) => t.puck && t.id === template)) showEdit(template);
  else if (!src) { back = () => showGrid(); showVideos(); }
  else showGrid();
  dialog.focus();
  return { close, element: overlay };
}
