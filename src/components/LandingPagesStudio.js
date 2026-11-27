// src/components/LandingPagesStudio.js
//
// Video Pages studio (route: #/video-pages). Turn any generated or uploaded
// video into a branded landing page (public at /p/<slug>) with a CTA, a lead
// form and analytics. Data layer: src/lib/landingPages/*; public page:
// src/pages/VideoPage.jsx.

import { mountStudioChrome } from '../lib/studioChrome.js';
import { createEditorBanner, demoteBannerHeading } from '../lib/thumbnails.js';
import { showToast } from '../lib/loading.js';
import { supabase, primeSupabaseIdentity, getClerkUserId, isSupabaseConfigured } from '../lib/supabase.js';
import { listBrands } from '../lib/brandStore.js';
import { TEMPLATES, getTemplate, sanitizeConfig, defaultConfig, applyTemplate, sanitizeEditorData, tokensUsed, isCalendarUrl, parseTranscript, formatTranscript, moveItem, PUBLIC_TOKEN_KEYS } from '../lib/landingPages/templates.js';
import { renderLandingPage } from '../lib/landingPages/render.js';
import { AFTER_SUBMIT_OPTIONS } from '../lib/landingPages/afterSubmit.js';
import { contactLabel } from '../lib/landingPages/csv.js';
import { sampleSections } from '../lib/landingPages/sampleContent.js';
import { ownPages } from '../lib/outreach/landingPage.js';
import { createAiRewritePanel } from '../lib/landingPages/aiRewritePanel.js';
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

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} copied`, 'success', 2000);
  } catch {
    showToast('Copy failed. Select the text and copy it manually.', 'warning', 4000);
  }
}

/** My saved pages (list, edit, publish, share, analytics). It lives in a modal (components/modals/MyVideoPagesModal.js), not on a page of its own. */
export function LandingPagesStudio({ embedded = false } = {}) {
  const container = el('div', `w-full h-full flex flex-col overflow-hidden text-white ${embedded ? 'bg-panel-bg' : 'bg-app-bg'}`);
  if (!embedded) mountStudioChrome(container, { title: 'My Video Pages', currentRoute: 'library' });
  const scroll = el('div', 'flex-1 overflow-y-auto');
  const inner = el('div', 'max-w-6xl mx-auto w-full px-4 md:px-8 py-8 flex flex-col gap-6');
  scroll.appendChild(inner);
  container.appendChild(scroll);

  const state = { pages: [], sources: null };

  const signedIn = () => !!getClerkUserId();
  // No separate sign-in here: wait for the SmartVid account (Clerk) to load, then carry on automatically.
  // One-shot, with a bounded retry if Clerk is unavailable; removed when the page closes (container.cleanup).
  let cancelWait = null;
  let closed = false;
  const waitForAccount = async () => {
    if (cancelWait || closed) return;
    try {
      const { whenClerkUser } = await import('../lib/clerkInit.js');
      // Closed (or already waiting) while the import was pending: register nothing.
      if (cancelWait || closed) return;
      cancelWait = whenClerkUser(() => { if (inner.isConnected) showList(); });
    } catch { /* Clerk unavailable: stay on the connecting message */ }
  };
  const prevCleanup = container.cleanup;
  container.cleanup = () => { closed = true; if (cancelWait) cancelWait(); if (typeof prevCleanup === 'function') prevCleanup(); };
  const guard = () => {
    if (!isSupabaseConfigured()) { inner.replaceChildren(el('p', 'text-sm text-secondary', 'Video pages need the Supabase connection, which is not configured here.')); return false; }
    if (!signedIn()) {
      inner.replaceChildren(el('p', 'text-sm text-secondary', 'Connecting your SmartVid account…'));
      waitForAccount();
      return false;
    }
    return true;
  };

  // ------------------------------------------------------------------ list
  async function showList() {
    if (!guard()) return;
    inner.replaceChildren(el('p', 'text-sm text-secondary', 'Loading your pages…'));
    try {
      // A Video Outreach campaign's page belongs to that video (edited in Video Outreach), so it is not listed here.
      state.pages = ownPages(await listPages(await ownerClient()));
    } catch (err) {
      inner.replaceChildren(el('p', 'text-sm text-red-300', err.message || 'Could not load your pages.'));
      return;
    }
    const head = el('div', 'flex flex-wrap items-center justify-between gap-3');
    const titleWrap = el('div');
    titleWrap.append(
      el('div', 'text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary mb-1', 'My Video Pages'),
      el('h1', 'text-2xl md:text-3xl font-black', 'Landing pages for your videos'),
      el('p', 'text-sm text-secondary mt-1 max-w-xl', 'Turn any generated or uploaded video or picture into a branded page with a call to action, a lead form and view analytics. Free for everything you create.'),
    );
    const newBtn = el('button', BTN_PRIMARY, '+ New page');
    newBtn.type = 'button';
    // Pages are made from a video: the shared picker lets you upload one, pick one you made, or paste a link.
    newBtn.addEventListener('click', async () => {
      const { openLandingPagePicker } = await import('../lib/landingPages/pickerModal.js');
      openLandingPagePicker({ zIndex: 2200 });   // above this window
    });
    head.append(titleWrap, newBtn);

    const grid = el('div', 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3');
    if (!state.pages.length) {
      grid.appendChild(el('div', 'col-span-full rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-secondary', 'No pages yet. Open any video in your Library (or finish a generation) and choose Create landing page.'));
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

  // ---------------------------------------------------------------- editor
  function showEditor(page) {
    let current = { ...page, config: sanitizeConfig(page.config) };
    let dirty = false;
    let tab = 'design';
    let editorHandle = null; // the visual editor, when this page uses it

    const top = el('div', 'flex flex-wrap items-center gap-3');
    const back = el('button', BTN, '← All pages');
    back.type = 'button';
    back.addEventListener('click', () => {
      if (dirty && !window.confirm('Discard unsaved changes?')) return;
      editorHandle?.destroy();
      editorHandle = null;
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
    let mediaPatch = {}; // a changed video / picture / poster, saved with the next Save
    const save = async (patch = {}) => {
      saveBtn.disabled = publishBtn.disabled = true;
      try {
        const sent = mediaPatch;
        const saved = await updatePage(await ownerClient(), current.id, { title: titleInput.value, config: current.config, ...sent, ...patch });
        // clear only what was sent: a video or picture picked while this was saving stays pending (and the page stays unsaved)
        mediaPatch = Object.fromEntries(Object.entries(mediaPatch).filter(([k, v]) => sent[k] !== v));
        const newer = Object.keys(mediaPatch).length > 0;
        current = { ...current, ...saved, config: sanitizeConfig(saved.config) };
        dirty = newer;
        dirtyTag.textContent = newer ? 'Unsaved changes' : 'Saved';
        publishBtn.textContent = current.published ? 'Unpublish' : 'Publish';
        drawShare();
      } catch (err) {
        showToast(err.message || 'Could not save', 'error', 4000);
      } finally {
        saveBtn.disabled = publishBtn.disabled = false;
      }
    };
    saveBtn.addEventListener('click', () => save());
    publishBtn.addEventListener('click', () => {
      if (!current.published && current.config.editor) {
        const tpl = getTemplate(current.config.template);
        const left = sampleSections(current.config.editor, tpl.editorData, tpl.sampleTypes || []);
        if (left.length && !window.confirm(`These sections still contain the sample content from the design (made-up names, numbers or quotes):\n\n${left.map((x) => `• ${x.title || x.type}`).join('\n')}\n\nReplace them with your own before sharing. Publish anyway?`)) return;
      }
      save({ published: !current.published });
    });
    titleInput.addEventListener('input', markDirty);

    // ---- design tab
    // AI rewrite: words only. Sections, layout, links, images and form fields are never sent or changed.
    // AI writing for the whole page: shared with the picker (src/lib/landingPages/aiRewritePanel.js).
    const aiRewritePanel = (getData, setData) => createAiRewritePanel({ getData, setData, context: `${titleInput.value || ''} (${current.config.template || ''})`, pageId: current.id });

    function editorDesignTab() {
      const box = el('div', 'flex flex-col gap-3');
      const bar = el('div', 'flex flex-wrap items-center gap-3 text-xs text-secondary');
      const tplSel = el('select', INPUT);
      TEMPLATES.filter((t) => t.editable).forEach((t) => { const o = el('option', '', t.name); o.value = t.id; tplSel.appendChild(o); });
      tplSel.value = current.config.template;
      tplSel.addEventListener('change', () => {
        current.config = applyTemplate(current.config, tplSel.value, { title: titleInput.value, brand: brandDefaults() });
        markDirty();
        draw();
      });
      const sampleNote = el('span', 'text-amber-300 font-bold', '');
      const updateSample = () => {
        const tpl = getTemplate(current.config.template);
        const n = sampleSections(current.config.editor, tpl.editorData, tpl.sampleTypes || []).length;
        sampleNote.textContent = n ? `${n} section${n === 1 ? '' : 's'} still use sample content (made-up names, numbers, quotes). Replace before sharing.` : '';
      };
      updateSample();
      bar.append(el('span', 'font-bold', 'Design'), tplSel, el('span', '', 'Click any text on the page to edit it. Use the left panel to add, remove and reorder sections. Save when you are done.'), sampleNote);
      const host = el('div', 'rounded-2xl border border-white/10 overflow-hidden rx-editor');
      host.style.height = '78vh';
      // Preview as: the sample, nobody (shows the {{token|fallback}} text), or any real contact of this page
      // (their own name, logo, colour, picture and video, exactly what their personal link shows).
      let editorTokens = SAMPLE_TOKENS;
      const asSel = el('select', INPUT);
      asSel.setAttribute('aria-label', 'Preview as contact');
      asSel.dataset.previewAs = '';
      const asTokens = new Map();
      const asOpt = (v, l) => { const o = el('option', '', l); o.value = v; asSel.appendChild(o); };
      asOpt('sample', 'Preview as: Ann at Acme (sample)');
      asOpt('none', 'Preview as: nobody (shows fallbacks)');
      asSel.addEventListener('change', () => {
        editorTokens = asSel.value === 'sample' ? SAMPLE_TOKENS : asSel.value === 'none' ? {} : (asTokens.get(asSel.value) || {});
        if (mountPageEditorFn) mountEditor(current.config.editor);
      });
      ownerClient().then((c) => listContacts(c, current.id)).then((rows) => {
        rows.slice(0, 200).forEach((r) => {
          const tk = {};
          PUBLIC_TOKEN_KEYS.forEach((k) => { if (r.fields?.[k]) tk[k] = String(r.fields[k]); });
          asTokens.set(r.id, tk);
          asOpt(r.id, `Preview as: ${contactLabel(r)}`);
        });
      }).catch(() => { /* no contacts yet, or not signed in: the sample still works */ });
      bar.append(asSel);
      // The page's own video or picture and its poster (what the viewer shows before it plays): change them without starting over.
      const media = el('details', 'rounded-xl border border-white/10 bg-white/5 text-xs text-secondary');
      media.dataset.pageMedia = '';
      const mediaBody = el('div', 'flex flex-col gap-2 p-3');
      const vIn = el('input', INPUT); vIn.type = 'url'; vIn.value = current.video_url || ''; vIn.setAttribute('aria-label', 'Page video or picture link'); vIn.placeholder = 'https://… video (.mp4) or picture';
      const pIn = el('input', INPUT); pIn.type = 'url'; pIn.value = current.poster_url || ''; pIn.setAttribute('aria-label', 'Poster picture link'); pIn.placeholder = 'https://… picture shown before the video plays (optional)';
      const useLatest = el('button', BTN, 'Use my latest creation');
      useLatest.type = 'button';
      const applyMedia = () => {
        const v = vIn.value.trim(); const p = pIn.value.trim();
        if (v && !/^https:\/\/\S+$/i.test(v)) { showToast('Paste a full https:// link.', 'warning', 3000); return; }
        mediaPatch = { ...(v ? { videoUrl: v } : {}), posterUrl: p };
        current = { ...current, ...(v ? { video_url: v } : {}), poster_url: p || null };
        markDirty();
        if (mountPageEditorFn) mountEditor(current.config.editor);
      };
      vIn.addEventListener('change', applyMedia);
      pIn.addEventListener('change', applyMedia);
      useLatest.addEventListener('click', async () => {
        try {
          const { loadGenerationHistory } = await import('../lib/generationHistory.js');
          const { pickLatest } = await import('./VideoPagesButton.js');
          const l = pickLatest(await loadGenerationHistory());
          if (!l) { showToast('Nothing in your library yet.', 'info', 3000); return; }
          vIn.value = l.url; applyMedia();
        } catch { showToast('Could not load your library.', 'warning', 3000); }
      });
      mediaBody.append(vIn, pIn, useLatest);
      media.append(el('summary', 'cursor-pointer select-none px-3 py-2 font-bold text-primary', 'Page video or picture'), mediaBody);
      box.append(bar, media, host);
      const danger = el('button', 'self-start text-xs text-red-300 hover:underline mt-4', 'Delete this page');
      danger.type = 'button';
      danger.addEventListener('click', async () => {
        if (!window.confirm('Delete this page and its analytics? The link will stop working.')) return;
        try { await deletePage(await ownerClient(), current.id); showToast('Page deleted', 'success', 2000); showList(); } catch (err) { showToast(err.message, 'error', 4000); }
      });
      box.appendChild(danger);
      let last = JSON.stringify(current.config.editor);
      let mountPageEditorFn = null;
      // Your recent pictures and videos, offered first in every picture and video field ("From your studio").
      let studioTray = [];
      import('./studio/landingPageAction.js').then(async ({ recentItems }) => {
        const { normalizeItems } = await import('../lib/landingPages/contentTray.js');
        const { toPickerVideo } = await import('../lib/landingPages/pickerModal.js');
        studioTray = normalizeItems(await recentItems({ n: 8 }), toPickerVideo);
      }).catch(() => {});
      const mountEditor = (data) => {
        editorHandle?.destroy();
        editorHandle = mountPageEditorFn(host, {
          page: current,
          data,
          tokens: editorTokens,
          getTray: () => studioTray,
          onPublish: () => saveBtn.click(), // the editor's own Publish button = our Save
          onChange: (d) => {
            const next = sanitizeEditorData(d);
            if (!next) return;
            const json = JSON.stringify(next);
            if (json === last) return;
            last = json;
            current.config = { ...current.config, editor: next };
            markDirty();
            updateSample();
          },
        });
      };
      // Apply new page data (AI rewrite accepted / undone): remount the editor on it.
      const setEditorData = (data) => {
        const next = sanitizeEditorData(data);
        if (!next) return;
        last = JSON.stringify(next);
        current.config = { ...current.config, editor: next };
        markDirty();
        updateSample();
        mountEditor(next);
      };
      box.insertBefore(aiRewritePanel(() => current.config.editor, setEditorData), host);
      import('../lib/landingPages/editor/mount.jsx').then(({ mountPageEditor }) => {
        mountPageEditorFn = mountPageEditor;
        mountEditor(current.config.editor);
      }).catch((err) => showToast(err.message || 'Could not load the editor', 'error', 4000));
      return box;
    }

    function designTab() {
      if (current.config.editor) return editorDesignTab();
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
      [['Editable landing pages', TEMPLATES.filter((t) => t.editable)], ['Page structures', TEMPLATES.filter((t) => t.compose && !t.site)], ['Layouts', TEMPLATES.filter((t) => !t.intro && !t.pitch && !t.compose && !t.editable)], ['Personal intro', TEMPLATES.filter((t) => t.intro)], ['Pitch page', TEMPLATES.filter((t) => t.pitch)], ['Older fixed-layout website pages', TEMPLATES.filter((t) => t.site)]].forEach(([label, list]) => {
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


      // ---- website-page content: nav, hero, proof strip, cards and sign-up band (only for the "Website pages" designs)
      const ITEM_COLS = ['title', 'text', 'value', 'tag', 'by', 'icon'];
      const itemsToText = (items) => items.map((it) => ITEM_COLS.map((k) => it[k] || '').join(' | ').replace(/( \| )+$/, '')).join('\n');
      const textToItems = (txt) => txt.split('\n').map((line) => {
        const parts = line.split('|').map((x) => x.trim());
        const o = {};
        ITEM_COLS.forEach((k, i) => { o[k] = parts[i] || ''; });
        return o;
      }).filter((o) => o.title || o.value);
      const lines = (label, get, apply, { rows = 3, placeholder = '' } = {}) => {
        const a = el('textarea', INPUT);
        a.rows = rows;
        a.placeholder = placeholder;
        a.value = get();
        a.addEventListener('input', () => set((c) => apply(c, a.value)));
        return field(label, a);
      };
      const siteEditor = () => {
        const S = () => current.config.site;
        const navLinks = lines('Menu links (one per line: Label | https://link, link optional)', () => S().nav.links.map((l) => (l.url ? `${l.label} | ${l.url}` : l.label)).join('\n'),
          (c, v) => { c.site.nav.links = v.split('\n').map((l) => { const [label, url] = l.split('|').map((x) => x.trim()); return { label: label || '', url: url || '' }; }).filter((l) => l.label); }, { placeholder: 'Product\nPricing | https://example.com/pricing' });
        const nav = [
          navLinks,
          text('login', 'Log-in link text (empty = none)', { path: ['site', 'nav'] }),
          text('loginUrl', 'Log-in link address (https)', { path: ['site', 'nav'] }),
          text('cta', 'Top-right button text (scrolls to the form)', { path: ['site', 'nav'] }),
        ];
        const hero = [
          text('eyebrow', 'Small label above the headline', { path: ['site', 'hero'] }),
          lines('Tick-list under the headline (one per line)', () => S().hero.bullets.join('\n'), (c, v) => { c.site.hero.bullets = v.split('\n').map((x) => x.trim()).filter(Boolean); }),
          text('chip', 'Label on the video (e.g. Hi {{firstname|there}}!)', { path: ['site', 'hero'] }),
          text('photo', 'Placeholder image before the video plays (https link, or empty to remove)', { path: ['site', 'hero'] }),
          select('Where the action buttons go', [['form', 'Under the form'], ['copy', 'Under the headline'], ['none', 'Nowhere']], () => S().hero.actions, (c, v) => { c.site.hero.actions = v; }),
          select('Arrangement', [['copy-video-form', 'Headline, video, form'], ['video-copy-form', 'Video, headline, form']], () => S().hero.variant, (c, v) => { c.site.hero.variant = v; }),
        ];
        const stripBox = el('div', 'flex flex-col gap-2');
        const stripHint = { benefits: 'Title | short text | icon', logos: 'Company name (one per line)', stats: 'Title | | big number' };
        const drawStrip = () => {
          stripBox.replaceChildren(
            select('Strip style', [['benefits', 'Icons with text'], ['logos', 'Company names'], ['stats', 'Big numbers']], () => S().strip.kind, (c, v) => { c.site.strip.kind = v; }),
            text('title', 'Strip heading (optional)', { path: ['site', 'strip'] }),
            lines(`Strip items (one per line: ${stripHint[S().strip.kind]})`, () => itemsToText(S().strip.items), (c, v) => { c.site.strip.items = textToItems(v); }, { rows: 5 }),
          );
          stripBox.querySelector('select').addEventListener('change', drawStrip);
        };
        drawStrip();
        const TYPES = [['heading', 'Heading'], ['playbook', 'Download / sign-up card'], ['table', 'Table (e.g. leads)'], ['stats', 'Big numbers'], ['checklist', 'Checklist'], ['quotes', 'Testimonials'], ['steps', 'Steps'], ['features', 'Feature list'], ['faq', 'Questions & answers'], ['kpi', 'Single big number']];
        const cardsBox = el('div', 'flex flex-col gap-3');
        const drawCards = () => {
          cardsBox.replaceChildren();
          S().cards.forEach((card, i) => {
            const row = el('div', 'flex flex-col gap-2 rounded-lg border border-white/10 p-2');
            const mk = (label, aria, fn, disabled) => { const b = el('button', BTN, label); b.type = 'button'; b.setAttribute('aria-label', aria); b.disabled = !!disabled; b.addEventListener('click', fn); return b; };
            const typeSel = el('select', INPUT);
            TYPES.forEach(([v, l]) => { const o = el('option', '', l); o.value = v; typeSel.appendChild(o); });
            typeSel.value = card.type;
            const widthSel = el('select', INPUT);
            for (let w = 2; w <= 12; w += 1) { const o = el('option', '', `${w} / 12 wide`); o.value = String(w); widthSel.appendChild(o); }
            widthSel.value = String(card.w);
            const count = S().cards.length;
            const edit = (patch) => { set((c) => { if (c.site.cards[i]) Object.assign(c.site.cards[i], patch); }); if (S().cards.length !== count) drawCards(); };
            typeSel.addEventListener('change', () => edit({ type: typeSel.value }));
            widthSel.addEventListener('change', () => edit({ w: Number(widthSel.value) }));
            const txt = (label, key, area) => {
              const inp = el(area ? 'textarea' : 'input', INPUT);
              if (area) inp.rows = 2;
              inp.value = card[key] || '';
              inp.setAttribute('aria-label', label);
              inp.placeholder = label;
              inp.addEventListener('input', () => edit({ [key]: inp.value }));
              return inp;
            };
            const listIn = (label, key, rows = 4) => {
              const inp = el('textarea', INPUT);
              inp.rows = rows;
              inp.placeholder = label;
              inp.setAttribute('aria-label', label);
              inp.value = key === 'items' ? itemsToText(card.items) : (card[key] || []).join(key === 'cols' ? ', ' : '\n');
              inp.addEventListener('input', () => edit({ [key]: key === 'items' ? textToItems(inp.value) : inp.value.split(key === 'cols' ? ',' : '\n').map((x) => x.trim()).filter(Boolean) }));
              return inp;
            };
            const last = S().cards.length - 1;
            const bar = el('div', 'flex flex-wrap gap-2');
            bar.append(
              mk('↑', 'Move card up', () => { set((c) => { c.site.cards = moveItem(c.site.cards, i, i - 1); }); drawCards(); }, i === 0),
              mk('↓', 'Move card down', () => { set((c) => { c.site.cards = moveItem(c.site.cards, i, i + 1); }); drawCards(); }, i === last),
              mk('Remove card', 'Remove card', () => { set((c) => { c.site.cards.splice(i, 1); }); drawCards(); }),
            );
            row.append(
              el('div', 'grid grid-cols-2 gap-2'), txt('Card title', 'title'), txt('Text', 'text', true), txt('Small label (e.g. FREE RESOURCE)', 'eyebrow'),
              txt('Button text', 'button'), txt('Email box hint text', 'placeholder'), txt('Big number (single big number card)', 'value'),
              listIn('Column headings, comma separated (table)', 'cols', 1), listIn('Window title and subtitle, one per line (table)', 'chrome', 2), listIn('Sidebar labels, one per line (table)', 'side', 3),
              listIn('Rows: Title | text | number | tag | person | icon (one per line)', 'items', 5), bar,
            );
            row.firstChild.append(typeSel, widthSel);
            cardsBox.appendChild(row);
          });
          if (S().cards.length < 10) {
            const add = el('button', BTN, '+ Add a card');
            add.type = 'button';
            add.addEventListener('click', () => { set((c) => { c.site.cards.push({ type: 'heading', w: 4, title: 'New card', text: 'Write something here.' }); }); drawCards(); });
            cardsBox.appendChild(add);
          }
        };
        drawCards();
        const band = [
          text('title', 'Sign-up band headline', { path: ['site', 'band'] }),
          text('text', 'Sign-up band text', { path: ['site', 'band'] }),
          text('tagline', 'Tagline next to your logo (optional)', { path: ['site', 'band'] }),
          text('placeholder', 'Email box hint text', { path: ['site', 'band'] }),
          text('button', 'Sign-up button text', { path: ['site', 'band'] }),
          text('social', 'Label above social icons (optional)', { path: ['site', 'band'] }),
        ];
        const note = el('p', 'text-xs text-secondary', 'Names, numbers and quotes in these cards are sample content from the design. Replace them with your own before you send the page. Email boxes on the page record a lead through your lead form settings.');
        return [
          note,
          group('Menu bar', true, ...nav),
          group('Top section (headline area & video)', true, ...hero),
          group('Strip under the top section', false, stripBox),
          group('Cards (add, remove, reorder)', false, cardsBox),
          group('Sign-up band at the bottom', false, ...band),
        ];
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
        ...(getTemplate(current.config.template).site ? siteEditor() : []),
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
          select('After the form is sent', AFTER_SUBMIT_OPTIONS, () => current.config.form.afterSubmitAction || 'message', (c, v) => { c.form.afterSubmitAction = v; }),
          text('afterSubmitUrl', 'Button / redirect link (https, mailto: or tel:)', { path: ['form'] }),
          text('afterSubmitButtonText', 'Button text (for "Show a button")', { path: ['form'] }),
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
      editorHandle?.destroy();
      editorHandle = null;
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

  showList();
  return container;
}
