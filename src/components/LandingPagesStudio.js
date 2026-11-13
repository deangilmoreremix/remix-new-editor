// src/components/LandingPagesStudio.js
//
// Video Pages studio (route: #/video-pages). Turn any generated or uploaded
// video into a branded landing page (public at /p/<slug>) with a CTA, a lead
// form and analytics. Data layer: src/lib/landingPages/*; public page:
// src/pages/VideoPage.jsx.

import { mountStudioChrome } from '../lib/studioChrome.js';
import { showToast } from '../lib/loading.js';
import { supabase, primeSupabaseIdentity, getClerkUserId, isSupabaseConfigured } from '../lib/supabase.js';
import { uploadFileToSupabase } from '../lib/uploadService.js';
import { listBrands } from '../lib/brandStore.js';
import { TEMPLATES, getTemplate, sanitizeConfig, defaultConfig, applyTemplate, tokensUsed, isCalendarUrl, parseTranscript, formatTranscript, moveItem, PUBLIC_TOKEN_KEYS } from '../lib/landingPages/templates.js';
import { renderLandingPage } from '../lib/landingPages/render.js';
import { contactLabel } from '../lib/landingPages/csv.js';
import { wireframeSvg } from '../lib/landingPages/wireframes.js';
import { loadVideoSources, fromFile } from '../lib/landingPages/sourceRegistry.js';
import { createPageFromVideo, MAX_VIDEO_BYTES } from '../lib/landingPages/ingest.js';
import { takeQueuedVideo } from '../lib/landingPages/handoff.js';
import {
  listPages, updatePage, deletePage, pageUrl, embedCode, fetchPageStats, listContacts,
} from '../lib/landingPages/client.js';

const INPUT = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50';
const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:border-primary/60 hover:text-primary transition-colors disabled:opacity-50';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-black hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50';
const SAMPLE_TOKENS = { firstname: 'Ann', company: 'Acme' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function brandDefaults() {
  try {
    const b = listBrands()?.[0];
    return b ? { accent: Array.isArray(b.primaryColors) ? b.primaryColors[0] : '', logoUrl: b.logoUrl || '' } : {};
  } catch {
    return {};
  }
}

async function ownerClient() {
  await primeSupabaseIdentity();
  return supabase;
}

/** Upload helper handed to the ingest layer (videos up to the bucket's 100MB). */
const upload = (file) => {
  const isVideo = String(file.type).startsWith('video/');
  return uploadFileToSupabase(file, {
    category: isVideo ? 'video' : 'image',
    maxSize: isVideo ? MAX_VIDEO_BYTES : undefined,
    userId: getClerkUserId() || undefined,
  });
};

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} copied`, 'success', 2000);
  } catch {
    showToast('Copy failed. Select the text and copy it manually.', 'warning', 4000);
  }
}

export function LandingPagesStudio() {
  const container = el('div', 'w-full h-full flex flex-col overflow-hidden bg-app-bg text-white');
  mountStudioChrome(container, { title: 'Video Pages', currentRoute: 'video-pages' });
  const scroll = el('div', 'flex-1 overflow-y-auto');
  const inner = el('div', 'max-w-6xl mx-auto w-full px-4 md:px-8 py-8 flex flex-col gap-6');
  scroll.appendChild(inner);
  container.appendChild(scroll);

  const state = { pages: [], sources: null };

  const signedIn = () => !!getClerkUserId();
  const guard = () => {
    if (!isSupabaseConfigured()) { inner.replaceChildren(el('p', 'text-sm text-secondary', 'Video pages need the Supabase connection, which is not configured here.')); return false; }
    if (!signedIn()) { inner.replaceChildren(el('p', 'text-sm text-secondary', 'Sign in to create and manage video landing pages.')); return false; }
    return true;
  };

  // ------------------------------------------------------------------ list
  async function showList() {
    if (!guard()) return;
    inner.replaceChildren(el('p', 'text-sm text-secondary', 'Loading your pages…'));
    try {
      state.pages = await listPages(await ownerClient());
    } catch (err) {
      inner.replaceChildren(el('p', 'text-sm text-red-300', err.message || 'Could not load your pages.'));
      return;
    }
    const head = el('div', 'flex flex-wrap items-center justify-between gap-3');
    const titleWrap = el('div');
    titleWrap.append(
      el('div', 'text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary mb-1', 'Video Pages'),
      el('h1', 'text-2xl md:text-3xl font-black', 'Landing pages for your videos'),
      el('p', 'text-sm text-secondary mt-1 max-w-xl', 'Turn any generated or uploaded video into a branded page with a call to action, a lead form and view analytics.'),
    );
    const newBtn = el('button', BTN_PRIMARY, '+ New page');
    newBtn.type = 'button';
    newBtn.addEventListener('click', () => showNew());
    head.append(titleWrap, newBtn);

    const grid = el('div', 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3');
    if (!state.pages.length) {
      grid.appendChild(el('div', 'col-span-full rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-secondary', 'No pages yet. Pick a video you made, or upload an MP4, to create your first page.'));
    }
    state.pages.forEach((p) => grid.appendChild(pageCard(p)));
    inner.replaceChildren(head, grid);
  }

  function pageCard(p) {
    const card = el('div', 'rounded-2xl border border-white/10 bg-panel-bg overflow-hidden flex flex-col');
    const thumb = el('div', 'aspect-video bg-black');
    if (p.poster_url) {
      const img = el('img', 'w-full h-full object-cover');
      img.src = p.poster_url;
      img.alt = '';
      thumb.appendChild(img);
    }
    const body = el('div', 'p-4 flex flex-col gap-2 flex-1');
    body.appendChild(el('div', 'text-sm font-bold truncate', p.title));
    const meta = el('div', 'flex items-center gap-2 text-xs text-secondary');
    const badge = el('span', `rounded-full border px-2 py-0.5 font-bold ${p.published ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/10 text-muted'}`, p.published ? 'Live' : 'Draft');
    meta.append(badge, el('span', '', `${p.view_count || 0} views`));
    const actions = el('div', 'flex flex-wrap gap-2 mt-auto pt-2');
    const edit = el('button', BTN, 'Edit');
    edit.type = 'button';
    edit.addEventListener('click', () => showEditor(p));
    actions.appendChild(edit);
    if (p.published) {
      const link = el('button', BTN, 'Copy link');
      link.type = 'button';
      link.addEventListener('click', () => copy(pageUrl(p.id), 'Link'));
      actions.appendChild(link);
    }
    body.append(meta, actions);
    card.append(thumb, body);
    return card;
  }

  // ------------------------------------------------------------------- new
  async function showNew(preselected = null) {
    if (!guard()) return;
    const sel = { video: preselected && preselected.url ? preselected : null, template: 'clean' };
    const back = el('button', BTN, '← Back');
    back.type = 'button';
    back.addEventListener('click', showList);

    const title = el('h1', 'text-2xl font-black', 'New video page');
    const status = el('p', 'text-sm text-secondary min-h-[1.25rem]', sel.video ? `Selected: ${sel.video.title}` : 'Choose a video, then a template.');

    // Upload / drop
    const drop = el('label', 'flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/20 p-6 text-center cursor-pointer hover:border-primary/60 transition-colors');
    drop.append(el('span', 'text-sm font-bold', 'Upload an MP4'), el('span', 'text-xs text-secondary', `Drop a video here or click to choose (up to ${MAX_VIDEO_BYTES / 1048576}MB)`));
    const file = el('input', 'sr-only');
    file.type = 'file';
    file.accept = 'video/*';
    drop.appendChild(file);
    const takeFile = (f) => {
      const src = fromFile(f, URL.createObjectURL(f));
      if (!src) { showToast('That is not a video file.', 'warning', 3000); return; }
      sel.video = src;
      status.textContent = `Selected: ${src.title}`;
      markSelected();
    };
    file.addEventListener('change', () => file.files?.[0] && takeFile(file.files[0]));
    drop.addEventListener('dragover', (e) => e.preventDefault());
    drop.addEventListener('drop', (e) => { e.preventDefault(); e.dataTransfer?.files?.[0] && takeFile(e.dataTransfer.files[0]); });

    // Any hosted video link (e.g. an OpenMontage render served by its proxy, or an MP4 on a CDN)
    const linkRow = el('div', 'flex flex-col sm:flex-row gap-2');
    const linkInput = el('input', INPUT);
    linkInput.type = 'url';
    linkInput.placeholder = 'Or paste a video link (https://…/video.mp4)';
    linkInput.setAttribute('aria-label', 'Video link');
    const linkBtn = el('button', BTN, 'Use link');
    linkBtn.type = 'button';
    linkBtn.addEventListener('click', () => {
      const url = linkInput.value.trim();
      if (!/^https:\/\/\S+$/i.test(url)) { showToast('Paste a full https:// video link.', 'warning', 3000); return; }
      const name = decodeURIComponent(url.split('?')[0].split('/').pop() || '').replace(/\.[^.]+$/, '') || 'Linked video';
      sel.video = { key: `link:${url}`, url, posterUrl: null, title: name.slice(0, 80), duration: null, source: { kind: 'link' }, createdAt: null, permanent: false };
      status.textContent = `Selected: ${sel.video.title}`;
      markSelected();
    });
    linkRow.append(linkInput, linkBtn);

    // Existing videos from every studio
    const libHead = el('h2', 'text-sm font-extrabold uppercase tracking-wide', 'Or pick a video you already made');
    const grid = el('div', 'grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4');
    grid.appendChild(el('p', 'col-span-full text-sm text-secondary', 'Loading your videos…'));
    const tiles = new Map();
    const markSelected = () => tiles.forEach((tile, key) => {
      tile.classList.toggle('ring-2', sel.video?.key === key);
      tile.classList.toggle('ring-primary', sel.video?.key === key);
    });
    (state.sources ? Promise.resolve(state.sources) : loadVideoSources()).then((list) => {
      state.sources = list;
      grid.replaceChildren();
      if (!list.length) grid.appendChild(el('p', 'col-span-full text-sm text-secondary', 'No videos found yet. Generate one in any studio, or upload an MP4 above.'));
      list.slice(0, 60).forEach((v) => {
        const tile = el('button', 'text-left rounded-xl border border-white/10 bg-panel-bg overflow-hidden hover:border-primary/60 transition-colors');
        tile.type = 'button';
        const media = el('div', 'aspect-video bg-black');
        if (v.posterUrl) {
          const img = el('img', 'w-full h-full object-cover');
          img.src = v.posterUrl; img.alt = ''; img.loading = 'lazy';
          media.appendChild(img);
        } else {
          const vid = el('video', 'w-full h-full object-cover');
          vid.muted = true; vid.preload = 'metadata'; vid.src = `${v.url}#t=0.5`;
          media.appendChild(vid);
        }
        const cap = el('div', 'p-2');
        cap.append(el('div', 'text-xs font-bold truncate', v.title), el('div', 'text-[11px] text-secondary truncate', [v.source.studio || v.source.kind, v.permanent ? '' : 'will be copied'].filter(Boolean).join(' · ')));
        tile.append(media, cap);
        tile.addEventListener('click', () => { sel.video = v; status.textContent = `Selected: ${v.title}`; markSelected(); });
        tiles.set(v.key, tile);
        grid.appendChild(tile);
      });
    });

    // Template
    const tplHead = el('h2', 'text-sm font-extrabold uppercase tracking-wide', 'Template');
    const tplRow = el('div', 'flex flex-col gap-4');
    const cards = new Map();
    const paintCards = () => cards.forEach((c, id) => {
      const on = id === sel.template;
      c.classList.toggle('border-primary', on);
      c.classList.toggle('ring-2', on);
      c.classList.toggle('ring-primary', on);
      c.setAttribute('aria-pressed', String(on));
    });
    // Swatch cards, grouped: simple layouts first, then the co-branded personal-intro designs.
    [['Website pages (full site look: nav, hero, form, proof, cards)', TEMPLATES.filter((t) => t.site)], ['Page structures (different arrangements)', TEMPLATES.filter((t) => t.compose && !t.site)], ['Layouts', TEMPLATES.filter((t) => !t.intro && !t.pitch && !t.compose)], ['Personal intro (co-branded, greets the viewer by name)', TEMPLATES.filter((t) => t.intro)], ['Pitch page (buttons, calendar, transcript)', TEMPLATES.filter((t) => t.pitch)]].forEach(([label, list]) => {
      const grp = el('div', 'flex flex-col gap-2');
      grp.appendChild(el('div', 'text-xs font-bold text-secondary', label));
      const row = el('div', 'grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4');
      list.forEach((t) => {
        const b = el('button', 'text-left rounded-xl border border-white/10 bg-panel-bg overflow-hidden hover:border-primary/60 transition-colors');
        b.type = 'button';
        b.title = t.description;
        // The thumbnail is the page's SHAPE (a wireframe) tinted with its colours, so layouts are told apart by structure.
        const sw = el('div', 'h-20 p-2 flex items-center justify-center');
        sw.style.background = t.theme.bg;
        sw.style.color = t.theme.accent;
        sw.innerHTML = wireframeSvg(t.layout);
        const cap = el('div', 'p-2');
        cap.append(el('div', 'text-xs font-bold truncate', t.name), el('div', 'text-[11px] text-secondary line-clamp-2', t.description));
        b.append(sw, cap);
        b.addEventListener('click', () => { sel.template = t.id; paintCards(); });
        cards.set(t.id, b);
        row.appendChild(b);
      });
      grp.appendChild(row);
      tplRow.appendChild(grp);
    });
    paintCards();

    const create = el('button', BTN_PRIMARY, 'Create page');
    create.type = 'button';
    create.addEventListener('click', async () => {
      if (!sel.video) { showToast('Choose a video first.', 'warning', 3000); return; }
      create.disabled = true;
      try {
        const page = await createPageFromVideo(await ownerClient(), sel.video, {
          template: sel.template,
          brand: brandDefaults(),
          deps: { upload },
          onStep: (label) => { status.textContent = `${label}…`; },
        });
        showToast('Page created', 'success', 2000);
        showEditor(page);
      } catch (err) {
        status.textContent = err.message || 'Could not create the page.';
        create.disabled = false;
      }
    });

    inner.replaceChildren(el('div', 'flex items-center gap-3'), title, status, drop, linkRow, libHead, grid, tplHead, tplRow, create);
    inner.firstChild.appendChild(back);
  }

  // ---------------------------------------------------------------- editor
  function showEditor(page) {
    let current = { ...page, config: sanitizeConfig(page.config) };
    let dirty = false;
    let tab = 'design';

    const top = el('div', 'flex flex-wrap items-center gap-3');
    const back = el('button', BTN, '← All pages');
    back.type = 'button';
    back.addEventListener('click', () => {
      if (dirty && !window.confirm('Discard unsaved changes?')) return;
      showList();
    });
    const titleInput = el('input', `${INPUT} flex-1 min-w-[12rem] max-w-md font-bold`);
    titleInput.value = current.title;
    titleInput.setAttribute('aria-label', 'Page title');
    const dirtyTag = el('span', 'text-xs text-secondary', '');
    const saveBtn = el('button', BTN, 'Save');
    const publishBtn = el('button', BTN_PRIMARY, current.published ? 'Unpublish' : 'Publish');
    [saveBtn, publishBtn].forEach((b) => { b.type = 'button'; });
    top.append(back, titleInput, dirtyTag, saveBtn, publishBtn);

    const tabs = el('div', 'flex gap-1 border-b border-white/10');
    const body = el('div', '');
    const tabBtns = {};
    const TAB_LABELS = { design: 'Design', contacts: 'Contacts', analytics: 'Analytics' };
    Object.keys(TAB_LABELS).forEach((id) => {
      const b = el('button', 'px-4 py-2 text-sm font-bold border-b-2 -mb-px', TAB_LABELS[id]);
      b.type = 'button';
      b.addEventListener('click', () => { tab = id; draw(); });
      tabBtns[id] = b;
      tabs.appendChild(b);
    });

    const shareRow = el('div', 'flex flex-wrap items-center gap-2 text-xs text-secondary');
    const drawShare = () => {
      shareRow.replaceChildren();
      if (!current.published) { shareRow.textContent = 'Draft: only you can see it. Publish to get a shareable link.'; return; }
      const url = pageUrl(current.id);
      const a = el('a', 'text-primary hover:underline break-all', url);
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      const copyBtn = el('button', BTN, 'Copy link');
      const embedBtn = el('button', BTN, 'Copy embed');
      [copyBtn, embedBtn].forEach((b) => { b.type = 'button'; });
      copyBtn.addEventListener('click', () => copy(url, 'Link'));
      embedBtn.addEventListener('click', () => copy(embedCode(current.id), 'Embed code'));
      shareRow.append(a, copyBtn, embedBtn);
    };

    const markDirty = () => { dirty = true; dirtyTag.textContent = 'Unsaved changes'; };
    const save = async (patch = {}) => {
      saveBtn.disabled = publishBtn.disabled = true;
      try {
        const saved = await updatePage(await ownerClient(), current.id, { title: titleInput.value, config: current.config, ...patch });
        current = { ...current, ...saved, config: sanitizeConfig(saved.config) };
        dirty = false;
        dirtyTag.textContent = 'Saved';
        publishBtn.textContent = current.published ? 'Unpublish' : 'Publish';
        drawShare();
      } catch (err) {
        showToast(err.message || 'Could not save', 'error', 4000);
      } finally {
        saveBtn.disabled = publishBtn.disabled = false;
      }
    };
    saveBtn.addEventListener('click', () => save());
    publishBtn.addEventListener('click', () => save({ published: !current.published }));
    titleInput.addEventListener('input', markDirty);

    // ---- design tab
    function designTab() {
      const wrap = el('div', 'grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]');
      const form = el('div', 'flex flex-col gap-4');
      const previewBox = el('div', 'rounded-2xl border border-white/10 overflow-hidden bg-black max-h-[80vh] overflow-y-auto');
      let view = null;
      let previewTokens = SAMPLE_TOKENS;
      const redraw = () => {
        view?.destroy();
        view = renderLandingPage({ page: { ...current, title: titleInput.value }, tokens: previewTokens, preview: true });
        previewBox.replaceChildren(view.root);
      };
      const set = (fn) => { fn(current.config); current.config = sanitizeConfig(current.config); markDirty(); redraw(); };

      const field = (label, input) => {
        const w = el('label', 'flex flex-col gap-1 text-xs font-bold text-secondary');
        w.append(el('span', '', label), input);
        return w;
      };
      const text = (key, label, { area = false, path = [] } = {}) => {
        const i = el(area ? 'textarea' : 'input', INPUT);
        if (area) i.rows = 2;
        const target = () => path.reduce((o, k) => o[k], current.config);
        i.value = target()[key] ?? '';
        i.addEventListener('input', () => set((c) => { path.reduce((o, k) => o[k], c)[key] = i.value; }));
        return field(label, i);
      };

      const tplSel = el('select', INPUT);
      [['Website pages', TEMPLATES.filter((t) => t.site)], ['Page structures', TEMPLATES.filter((t) => t.compose && !t.site)], ['Layouts', TEMPLATES.filter((t) => !t.intro && !t.pitch && !t.compose)], ['Personal intro', TEMPLATES.filter((t) => t.intro)], ['Pitch page', TEMPLATES.filter((t) => t.pitch)]].forEach(([label, list]) => {
        const og = el('optgroup');
        og.label = label;
        list.forEach((t) => { const o = el('option', '', t.name); o.value = t.id; og.appendChild(o); });
        tplSel.appendChild(og);
      });
      tplSel.value = current.config.template;
      tplSel.addEventListener('change', () => {
        // Switching template restyles but keeps the copy the user wrote; empty blocks get the new template's defaults.
        current.config = applyTemplate(current.config, tplSel.value, { title: titleInput.value, brand: brandDefaults() });
        markDirty();
        draw(); // every control reflects the new config
      });

      const select = (label, options, get, apply) => {
        const s = el('select', INPUT);
        options.forEach(([v, l]) => { const o = el('option', '', l); o.value = v; s.appendChild(o); });
        s.value = get();
        s.addEventListener('change', () => set((c) => apply(c, s.value)));
        return field(label, s);
      };
      const color = (label, get, apply) => {
        const i = el('input', 'h-9 w-full rounded-lg border border-white/10 bg-transparent');
        i.type = 'color';
        i.value = get();
        i.addEventListener('input', () => set((c) => apply(c, i.value)));
        return field(label, i);
      };
      // One text area edits a list: paragraphs split on blank lines.
      const paragraphs = (label, get, apply) => {
        const a = el('textarea', INPUT);
        a.rows = 5;
        a.value = get().join('\n\n');
        a.addEventListener('input', () => set((c) => apply(c, a.value.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean))));
        return field(label, a);
      };
      // One logo per line: "Name" or "Name | https://image-link".
      const logoLines = (label, get, apply) => {
        const a = el('textarea', INPUT);
        a.rows = 3;
        a.placeholder = 'Acme\nGlobex | https://example.com/globex.png';
        a.value = get().map((l) => (l.imageUrl ? `${l.name} | ${l.imageUrl}` : l.name)).join('\n');
        a.addEventListener('input', () => set((c) => apply(c, a.value.split('\n').map((line) => {
          const [name, imageUrl] = line.split('|').map((x) => x.trim());
          return { name: name || '', imageUrl: imageUrl || '' };
        }).filter((l) => l.name || l.imageUrl))));
        return field(label, a);
      };
      const ctaEditor = () => {
        const wrap = el('div', 'flex flex-col gap-2');
        const KINDS = [['link', 'Link to a URL'], ['calendar', 'Open a calendar'], ['phone', 'Call a phone number'], ['sms', 'Send a text'], ['download', 'Download a file'], ['form', 'Scroll to the lead form']];
        const HINT = { link: 'https://…', calendar: 'https://calendly.com/you/intro', phone: '+1 555 123 4567', sms: '+1 555 123 4567', download: 'https://…/one-pager.pdf', form: '(no link needed: scrolls to the form)' };
        const draw = () => {
          wrap.replaceChildren();
          const count = current.config.ctas.length;
          current.config.ctas.forEach((b, i) => {
            const row = el('div', 'grid grid-cols-2 gap-2 rounded-lg border border-white/10 p-2');
            const kind = el('select', INPUT);
            KINDS.forEach(([v, l]) => { const o = el('option', '', l); o.value = v; kind.appendChild(o); });
            kind.value = b.kind;
            const styleSel = el('select', INPUT);
            [['primary', 'Primary button'], ['secondary', 'Secondary button'], ['text', 'Text link']].forEach(([v, l]) => { const o = el('option', '', l); o.value = v; styleSel.appendChild(o); });
            styleSel.value = b.style;
            const label = el('input', INPUT);
            label.value = b.label;
            label.placeholder = 'Button text';
            label.setAttribute('aria-label', 'Button text');
            const value = el('input', INPUT);
            value.value = b.value;
            value.placeholder = HINT[b.kind];
            value.setAttribute('aria-label', 'Button target');
            const rm = el('button', `${BTN} col-span-2 text-red-300`, 'Remove button');
            rm.type = 'button';
            const edit = (patch) => { set((c) => { c.ctas[i] = { ...c.ctas[i], ...patch }; }); if (current.config.ctas.length !== count) draw(); };
            kind.addEventListener('change', () => { edit({ kind: kind.value }); value.placeholder = HINT[kind.value]; });
            styleSel.addEventListener('change', () => edit({ style: styleSel.value }));
            label.addEventListener('input', () => edit({ label: label.value }));
            value.addEventListener('input', () => edit({ value: value.value }));
            rm.addEventListener('click', () => { set((c) => { c.ctas.splice(i, 1); }); draw(); });
            row.append(kind, styleSel, label, value, rm);
            wrap.appendChild(row);
          });
          if (current.config.ctas.length < 5) {
            const add = el('button', BTN, '+ Add a button');
            add.type = 'button';
            add.addEventListener('click', () => { set((c) => { c.ctas.push({ label: 'New button', kind: 'link', value: '', style: 'secondary' }); }); draw(); });
            wrap.appendChild(add);
          }
        };
        draw();
        const box = el('div', 'flex flex-col gap-2');
        box.append(el('p', 'text-xs text-secondary', 'A button shows on the page once it has text and a valid target (a link, number or calendar). Calendar buttons scroll to the embedded calendar when one is set.'), wrap);
        return box;
      };
      const check = (label, get, apply) => {
        const i = el('input');
        i.type = 'checkbox';
        i.checked = get();
        i.addEventListener('change', () => set((c) => apply(c, i.checked)));
        const l = el('label', 'flex items-center gap-2 text-sm font-bold');
        l.append(i, document.createTextNode(label));
        return l;
      };
      const sectionsEditor = () => {
        const wrap = el('div', 'flex flex-col gap-2');
        const draw = () => {
          wrap.replaceChildren();
          current.config.sections.forEach((sec, i) => {
            const row = el('div', 'flex flex-col gap-2 rounded-lg border border-white/10 p-2');
            const head = el('input', INPUT);
            head.value = sec.heading;
            head.placeholder = 'Section heading';
            head.setAttribute('aria-label', 'Section heading');
            const body = el('textarea', INPUT);
            body.rows = 3;
            body.value = sec.body;
            body.placeholder = 'Section text (tokens like {{company}} work here)';
            body.setAttribute('aria-label', 'Section text');
            const bar = el('div', 'flex gap-2');
            const mk = (label, aria, fn, disabled) => { const b = el('button', BTN, label); b.type = 'button'; b.setAttribute('aria-label', aria); b.disabled = !!disabled; b.addEventListener('click', fn); return b; };
            const last = current.config.sections.length - 1;
            bar.append(
              mk('↑', 'Move section up', () => { set((c) => { c.sections = moveItem(c.sections, i, i - 1); }); draw(); }, i === 0),
              mk('↓', 'Move section down', () => { set((c) => { c.sections = moveItem(c.sections, i, i + 1); }); draw(); }, i === last),
              mk('Remove', 'Remove section', () => { set((c) => { c.sections.splice(i, 1); }); draw(); }),
            );
            // Typing doesn't rebuild the rows (that would steal focus). A section with no heading and no text is dropped by
            // sanitizing, so when the count changes the rows are redrawn to stay in step with the data.
            const count = current.config.sections.length;
            const edit = (patch) => { set((c) => { if (c.sections[i]) Object.assign(c.sections[i], patch); }); if (current.config.sections.length !== count) draw(); };
            head.addEventListener('input', () => edit({ heading: head.value }));
            body.addEventListener('input', () => edit({ body: body.value }));
            row.append(head, body, bar);
            wrap.appendChild(row);
          });
          if (current.config.sections.length < 6) {
            const add = el('button', BTN, '+ Add a section');
            add.type = 'button';
            add.addEventListener('click', () => { set((c) => { c.sections.push({ heading: 'New section', body: 'Write something here.' }); }); draw(); });
            wrap.appendChild(add);
          }
        };
        draw();
        return wrap;
      };
      const calendarEditor = () => {
        const url = el('input', INPUT);
        url.value = current.config.calendar.url;
        url.placeholder = 'https://calendly.com/you/intro';
        const warn = el('p', 'text-xs text-amber-300 min-h-[1rem]');
        const hint = () => { warn.textContent = url.value.trim() && !isCalendarUrl(url.value) ? 'Not embedded: only https links from Calendly, Cal.com, HubSpot Meetings, TidyCal, YouCanBookMe, SavvyCal, Google, Zcal, Chili Piper, Acuity and Outlook are allowed.' : ''; };
        url.addEventListener('input', () => { set((c) => { c.calendar.url = url.value; }); hint(); });
        hint();
        return [field('Calendar link to embed under the video', url), warn, text('title', 'Calendar heading', { path: ['calendar'] })];
      };
      const transcriptEditor = () => {
        const a = el('textarea', INPUT);
        a.rows = 6;
        a.placeholder = '0:00 Hi Maya, thanks for taking a look.\n0:12 Here is the idea in one minute.';
        a.value = formatTranscript(current.config.transcript.items);
        a.addEventListener('input', () => set((c) => { c.transcript.items = parseTranscript(a.value); }));
        return [check('Show a transcript panel', () => current.config.transcript.enabled, (c, v) => { c.transcript.enabled = v; }), field('Transcript (one line per moment: m:ss text)', a)];
      };
      const countdownEditor = () => {
        const when = el('input', INPUT);
        when.type = 'datetime-local';
        const iso = current.config.countdown.endsAt;
        if (iso) { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); when.value = d.toISOString().slice(0, 16); }
        when.addEventListener('input', () => set((c) => { const ms = Date.parse(when.value); c.countdown.endsAt = Number.isFinite(ms) ? new Date(ms).toISOString() : ''; if (!Number.isFinite(ms)) c.countdown.enabled = false; }));
        return [check('Show a countdown', () => current.config.countdown.enabled, (c, v) => { c.countdown.enabled = v; }), field('Ends at', when), text('label', 'Countdown text (default: Offer ends in)', { path: ['countdown'] })];
      };
      const group = (title, open, ...children) => {
        const d = el('details', 'rounded-xl border border-white/10 p-3');
        d.open = open;
        d.appendChild(el('summary', 'cursor-pointer text-xs font-extrabold uppercase tracking-wide text-primary', title));
        const inner = el('div', 'flex flex-col gap-3 mt-3');
        inner.append(...children);
        d.appendChild(inner);
        return d;
      };

      const accent = el('input', 'h-9 w-full rounded-lg border border-white/10 bg-transparent');
      accent.type = 'color';
      accent.value = current.config.theme.accent;
      accent.addEventListener('input', () => set((c) => { c.theme.accent = accent.value; }));

      const formToggle = el('input');
      formToggle.type = 'checkbox';
      formToggle.checked = current.config.form.enabled;
      const fieldChecks = [['name', 'Name', 'text'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['message', 'Message', 'textarea']].map(([key, label, type]) => {
        const c = el('input');
        c.type = 'checkbox';
        c.checked = current.config.form.fields.some((f) => f.key === key);
        c.addEventListener('change', () => set((cfg) => {
          cfg.form.fields = cfg.form.fields.filter((f) => f.key !== key);
          if (c.checked) cfg.form.fields.push({ key, label, type, required: key === 'email' });
          cfg.form.enabled = cfg.form.fields.length > 0 && formToggle.checked;
        }));
        const l = el('label', 'flex items-center gap-1 text-xs');
        l.append(c, document.createTextNode(label));
        return l;
      });
      formToggle.addEventListener('change', () => set((c) => { c.form.enabled = formToggle.checked && c.form.fields.length > 0; }));
      const formToggleLabel = el('label', 'flex items-center gap-2 text-sm font-bold');
      formToggleLabel.append(formToggle, document.createTextNode('Show a lead form'));

      // Preview as: a sample, nobody (shows the {{token|fallback}} text), or any real contact of this page.
      const previewSel = el('select', INPUT);
      previewSel.setAttribute('aria-label', 'Preview as contact');
      const contactTokens = new Map();
      const addOpt = (v, l) => { const o = el('option', '', l); o.value = v; previewSel.appendChild(o); };
      addOpt('sample', 'Sample: Ann at Acme');
      addOpt('none', 'No contact (shows fallbacks)');
      previewSel.addEventListener('change', () => {
        previewTokens = previewSel.value === 'sample' ? SAMPLE_TOKENS : previewSel.value === 'none' ? {} : (contactTokens.get(previewSel.value) || {});
        redraw();
      });
      ownerClient().then((c) => listContacts(c, current.id)).then((rows) => {
        rows.slice(0, 200).forEach((r) => {
          // Only the public token keys: exactly what a viewer of that contact's link would see (never the email).
          const tk = {};
          PUBLIC_TOKEN_KEYS.forEach((k) => { if (r.fields?.[k]) tk[k] = String(r.fields[k]); });
          contactTokens.set(r.id, tk);
          addOpt(r.id, contactLabel(r));
        });
      }).catch(() => { /* no contacts yet, or not signed in: the sample still works */ });
      const sampleLabel = field('Preview as', previewSel);

      const hint = el('p', 'text-xs text-secondary');
      const updateHint = () => {
        const used = tokensUsed(current.config);
        hint.textContent = used.length ? `Personalization tokens in use: ${used.map((t) => `{{${t}}}`).join(', ')}` : 'Tip: use {{firstname|there}} in the headline to greet each viewer by name.';
      };

      form.append(
        field('Template', tplSel),
        text('headline', 'Headline'),
        text('subhead', 'Subheadline', { area: true }),
        hint,
        field('Accent color (buttons)', accent),
        color('Highlight color (company name in headline)', () => current.config.theme.highlight, (c, v) => { c.theme.highlight = v; }),
        group('Action buttons & Like', getTemplate(current.config.template).pitch,
          ctaEditor(),
          check('Show a Like button', () => current.config.likes.enabled, (c, v) => { c.likes.enabled = v; }),
        ),
        group('Extra sections (add, remove, reorder)', false, sectionsEditor()),
        group('Calendar, transcript & countdown', getTemplate(current.config.template).pitch,
          ...calendarEditor(),
          ...transcriptEditor(),
          ...countdownEditor(),
        ),
        group('Header & branding', getTemplate(current.config.template).intro || getTemplate(current.config.template).pitch,
          text('logoUrl', 'Your logo image URL (https)', { path: ['theme'] }),
          text('name', 'Your brand name', { path: ['brand'] }),
          text('tagline', 'Header tagline', { path: ['brand'] }),
          text('badge', 'Pill above the headline'),
        ),
        group('Call to action', true,
          select('Button does', [['play', 'Play the video'], ['link', 'Open a link']], () => (current.config.cta.type === 'play' ? 'play' : 'link'), (c, v) => { c.cta.type = v; }),
          text('label', 'Button text', { path: ['cta'] }),
          text('url', 'Button link (https, mailto: or tel:)', { path: ['cta'] }),
        ),
        group('Video caption', getTemplate(current.config.template).intro,
          text('title', 'Caption title', { path: ['overlay'] }),
          text('subtitle', 'Caption line (use {{duration}} for the length)', { path: ['overlay'] }),
        ),
        group('Story & sender', getTemplate(current.config.template).intro,
          text('heading', 'Story heading', { path: ['story'] }),
          paragraphs('Story paragraphs (blank line between)', () => current.config.story.body, (c, v) => { c.story.body = v; }),
          text('name', 'Sender name', { path: ['sender'] }),
          text('title', 'Sender role', { path: ['sender'] }),
          text('avatarUrl', 'Sender photo URL (https)', { path: ['sender'] }),
        ),
        group('Lead form', true,
          formToggleLabel,
          (() => { const r = el('div', 'flex flex-wrap gap-3'); r.append(...fieldChecks); return r; })(),
          text('title', 'Form title', { path: ['form'] }),
          text('subtitle', 'Form subtitle', { path: ['form'] }),
          text('privacy', 'Line under the button', { path: ['form'] }),
          text('successMessage', 'Thank-you message', { path: ['form'] }),
        ),
        group('Social proof & footer', false,
          text('quote', 'Testimonial quote (only add one you have permission to use)', { path: ['testimonial'], area: true }),
          text('by', 'Testimonial attribution', { path: ['testimonial'] }),
          logoLines('Customer logos (one per line)', () => current.config.logos, (c, v) => { c.logos = v; }),
          text('text', 'Footer text', { path: ['footer'] }),
          text('optOutUrl', 'Opt-out link (mailto: or https). Leave empty to show none', { path: ['footer'] }),
        ),
        group('Privacy notice', false,
          text('notice', 'Notice shown under the page (optional)', { path: ['consent'], area: true }),
        ),
        sampleLabel,
      );
      form.addEventListener('input', updateHint);
      updateHint();
      redraw();
      wrap.append(form, previewBox);

      const danger = el('button', 'self-start text-xs text-red-300 hover:underline mt-4', 'Delete this page');
      danger.type = 'button';
      danger.addEventListener('click', async () => {
        if (!window.confirm('Delete this page and its analytics? The link will stop working.')) return;
        try { await deletePage(await ownerClient(), current.id); showToast('Page deleted', 'success', 2000); showList(); } catch (err) { showToast(err.message, 'error', 4000); }
      });
      const box = el('div', 'flex flex-col');
      box.append(wrap, danger);
      return box;
    }

    // ---- analytics tab
    function analyticsTab() {
      const box = el('div', 'flex flex-col gap-4');
      box.appendChild(el('p', 'text-sm text-secondary', 'Loading…'));
      (async () => {
        try {
          const s = await fetchPageStats(await ownerClient(), current.id);
          const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '0%');
          const cards = [
            ['Views', s.views], ['Plays', s.plays], ['Play rate', pct(s.plays, s.views)],
            ['Watched to end', s.completes], ['CTA clicks', s.ctaClicks], ['Likes', s.likes], ['Leads', s.leads],
          ];
          const grid = el('div', 'grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7');
          cards.forEach(([k, v]) => {
            const c = el('div', 'rounded-xl border border-white/10 bg-panel-bg p-4');
            c.append(el('div', 'text-[11px] uppercase tracking-wide text-secondary', k), el('div', 'text-2xl font-black', String(v)));
            grid.appendChild(c);
          });
          box.replaceChildren(grid);
          if (!current.published) box.appendChild(el('p', 'text-xs text-secondary', 'Publish the page to start collecting views.'));
        } catch (err) {
          box.replaceChildren(el('p', 'text-sm text-red-300', err.message || 'Could not load analytics.'));
        }
      })();
      return box;
    }

    function draw() {
      Object.entries(tabBtns).forEach(([id, b]) => {
        const on = id === tab;
        b.className = `px-4 py-2 text-sm font-bold border-b-2 -mb-px ${on ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-white'}`;
      });
      if (tab === 'design') body.replaceChildren(designTab());
      else if (tab === 'analytics') body.replaceChildren(analyticsTab());
      else body.replaceChildren(contactsTab());
    }

    function contactsTab() {
      const holder = el('div');
      holder.appendChild(el('p', 'text-sm text-secondary', 'Loading…'));
      import('./landingPages/contactsPanel.js').then(({ contactsPanel }) => {
        holder.replaceChildren(contactsPanel({
          page: current,
          getClient: ownerClient,
          toast: (msg, type = 'info') => showToast(msg, type, 3500),
          copy,
        }));
      });
      return holder;
    }

    drawShare();
    draw();
    inner.replaceChildren(top, shareRow, tabs, body);
  }

  // Arrived from "Create landing page" elsewhere in the app: start with that video selected.
  const queued = takeQueuedVideo();
  if (queued) showNew(queued);
  else showList();
  return container;
}
