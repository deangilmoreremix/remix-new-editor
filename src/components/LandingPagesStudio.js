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
import { TEMPLATES, getTemplate, sanitizeConfig, defaultConfig, applyTemplate, tokensUsed } from '../lib/landingPages/templates.js';
import { renderLandingPage } from '../lib/landingPages/render.js';
import { loadVideoSources, fromFile } from '../lib/landingPages/sourceRegistry.js';
import { createPageFromVideo, MAX_VIDEO_BYTES } from '../lib/landingPages/ingest.js';
import { takeQueuedVideo } from '../lib/landingPages/handoff.js';
import {
  listPages, updatePage, deletePage, pageUrl, embedCode, fetchPageStats,
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
    [['Layouts', TEMPLATES.filter((t) => !t.intro)], ['Personal intro designs (co-branded, greets the viewer by name)', TEMPLATES.filter((t) => t.intro)]].forEach(([label, list]) => {
      const grp = el('div', 'flex flex-col gap-2');
      grp.appendChild(el('div', 'text-xs font-bold text-secondary', label));
      const row = el('div', 'grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4');
      list.forEach((t) => {
        const b = el('button', 'text-left rounded-xl border border-white/10 bg-panel-bg overflow-hidden hover:border-primary/60 transition-colors');
        b.type = 'button';
        b.title = t.description;
        const sw = el('div', 'h-12 flex items-end gap-1 p-2');
        sw.style.background = t.theme.bg;
        [t.theme.accent, t.theme.highlight, t.theme.text].forEach((c) => {
          const d = el('span', 'h-3 w-3 rounded-full border border-white/30');
          d.style.background = c;
          sw.appendChild(d);
        });
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
      let sample = true;
      const redraw = () => {
        view?.destroy();
        view = renderLandingPage({ page: { ...current, title: titleInput.value }, tokens: sample ? SAMPLE_TOKENS : {}, preview: true });
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
      [['Layouts', TEMPLATES.filter((t) => !t.intro)], ['Personal intro designs', TEMPLATES.filter((t) => t.intro)]].forEach(([label, list]) => {
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

      const sampleToggle = el('input');
      sampleToggle.type = 'checkbox';
      sampleToggle.checked = true;
      sampleToggle.addEventListener('change', () => { sample = sampleToggle.checked; redraw(); });
      const sampleLabel = el('label', 'flex items-center gap-2 text-xs text-secondary');
      sampleLabel.append(sampleToggle, document.createTextNode('Preview as “Ann at Acme”'));

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
        group('Header & branding', getTemplate(current.config.template).intro,
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
            ['Watched to end', s.completes], ['CTA clicks', s.ctaClicks], ['Leads', s.leads],
          ];
          const grid = el('div', 'grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6');
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
