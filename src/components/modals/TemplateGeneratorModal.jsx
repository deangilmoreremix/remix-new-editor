import { BaseModal } from './BaseModal.jsx';
import { ALL_NICHE_TEMPLATES } from '../../lib/nicheTemplatesIndex.js';
import { generateScript, rewriteScript, shortenScript, expandScript, normalizeSceneLines } from '../../lib/editor/scriptAiService.js';
import { generateImage } from '../../lib/editor/aiImageService.js';
import { buildCompositionFromState, buildPreviewFromState } from '../../lib/editor/templateCompositionBuilder.js';
import { normalizeAsset } from '../../lib/editor/assetModel.js';
import { TransitionsLibrary } from '../../lib/editor/transitionsLibrary.js';
import { UPLOAD_LIMITS } from '../../lib/editor/uploadLimits.js';
import * as pexelsApi from '../../lib/pexelsApi.js';
import * as pixabayApi from '../../lib/pixabayApi.js';
import { uploadFileToSupabase } from '../../lib/uploadService.js';
import {
  STEPS, STEP_LABELS, MAX_VIDEOS, createWizardState, guardStep, nextStepIndex, nextDisabled, nextLabel, clipDuration,
  toggleVideo, toggleAnimation, toBuilderState, hasScript, sceneNames, MAX_ANIMATIONS,
} from './template-generator/rules.js';
import {
  PROVIDERS, MEDIA_FILTERS, STOCK_HOME, createStockClient, remoteItem, probeVideo, kindFromUrlOrType,
} from './template-generator/stock.js';
import { loadTemplateCatalog, searchTemplateClips, TEMPLATE_SOURCE } from './template-generator/videoTemplates.js';
import { snapshotTemplate, restoreTemplate, splitDurable } from './template-generator/templates.js';
import { createSyncedTemplateStore, SYNC_STATUS } from './template-generator/sync.js';
import { templateScript, placeholdersLeft, DETAIL_FIELDS } from '../../lib/nicheScripts/index.js';
import { createPreviewPlayer, renderPlayerHTML, playlistFromPreview, formatTime } from './template-generator/preview.js';
import '../../styles/template-generator.css';

/**
 * TemplateGeneratorModal — builds reusable templates (footage + script + transition + text) and
 * adds them to the timeline. Templates are saved to "My templates" and can be opened again,
 * edited and reused any number of times. Ported from the original wizard.
 *
 *   Start screen: Create a template, or open My templates
 *   1. Video    — "Find Free videos": Pixabay, Pexels, Upload, Remote URL (+ AI Generate)
 *   2. Script   — niche scripts, plus write / AI-write your own
 *   3. Overlay  — transitions between the videos (needs 2+), plus text elements
 *   4. Preview  — the assembled result, optional Voice + Personalization, Add to Timeline
 *
 * The rules (max 5 videos, overlay needs 2+ videos, warnings, skipping Overlay) live in
 * ./template-generator/rules.js and come straight from the original ModalContent.jsx.
 * Rendering is one function; listeners are delegated and attached once, so stepping
 * back and forth can never stack handlers or leave the header out of date.
 */

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cssUrl = (u) => (/^(https?:|blob:|data:image|\/)/i.test(String(u || ''))
  ? `url('${String(u).replace(/['"()\\<>\n\r]/g, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)}')`
  : 'none');
const ICON = (name) => `/static/svgImages/template-generator/${name}.svg`;
const STEP_ICONS = ['niche-templates-icon', 'niche-scripts-icon', 'overlays-icon', 'preview-icon'];

const PROVIDER_BLURB = {
  templates: 'Ready-made AI video clips: cinematic, commercial, social, action, animation, fashion, VFX.',
  pixabay: 'Free videos, photos, illustrations and vectors from Pixabay.',
  pexels: 'Free videos, photos and curated collections from Pexels.',
  upload: 'Use your own videos and images.',
  remote: 'Paste a link to a video or image.',
  ai: 'Generate an image with AI (uses your OpenAI key).',
  library: 'Videos and images already in this project.',
};
/** The real still shown on a tile: the provider's poster, or the image itself. Never a video URL (that can't be a CSS image). */
const stillOf = (it) => it.poster || (it.kind === 'image' ? (it.url || it.preview) : '');
/** No poster for a video (own media, uploads, links)? Show its real first frame. */
const firstFrame = (it) => (it.kind === 'video' && !stillOf(it) && (it.preview || it.url)
  ? `<video class="tg-poster" muted playsinline preload="metadata" tabindex="-1" aria-hidden="true" src="${esc(`${it.preview || it.url}#t=0.1`)}"></video>` : '');
const hueOf = (str) => { let h = 0; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
const TRANSITION_CATEGORY_LABELS = { fade: 'Fade', wipe: 'Wipe', push: 'Push', zoom: 'Zoom', iris: 'Iris', shape: 'Shape' };

export class TemplateGeneratorModal extends BaseModal {
  constructor(options = {}) {
    super({ title: 'Template Generator', size: 'full', showFooter: false, ...options });

    this.timelineApi = options.timelineApi || null;
    this.s = createWizardState();
    this.store = options.templateStore || createSyncedTemplateStore();
    // Extra media libraries supplied by the host editor (animations, motion graphics, end screens …). Each:
    //   { id, label, blurb, group?, filters: [[id, label]], search({ query, filter, page }) → { items, hasMore },
    //     resolve(ref) → overlay payload for the timeline, mountPreview?(host, item) → destroy }
    this.extra = new Map((options.extraSources || []).map((x) => [x.id, x]));
    // The project's own videos / images ("My media"); an array, or a function returning one.
    this.projectMedia = options.projectMedia || null;
    this.templateCatalog = options.templateCatalog || (() => loadTemplateCatalog());
    this.stock = options.stockSearch || createStockClient({ pexels: pexelsApi, pixabay: pixabayApi });

    this.ui = {
      safariAccepted: false,
      view: 'start',          // 'start' | 'library'
      libQuery: '',
      sync: SYNC_STATUS.LOCAL,
      confirmDeleteId: null,
      tplName: '',
      tplDesc: '',
      tplMode: 'new',        // 'new' | 'update'
      provider: options.defaultProvider || 'templates',
      filter: 'all',
      tplSub: 'all',
      tplShape: 'all',
      tplCatalog: null,
      query: '',
      results: [],
      collections: null,
      collectionId: null,
      collectionTitle: '',
      page: 1,
      hasMore: false,
      loading: false,
      error: null,
      uploads: [],
      uploadStatus: '',
      remoteUrl: '',
      remoteError: '',
      remoteItems: [],
      aiPrompt: '',
      aiLoading: false,
      aiError: '',
      aiResults: [],
      scriptQuery: '',
      scriptNiche: 'all',
      scriptBusy: '',
      scriptError: '',
      overlayTab: 'transitions',
      overlayQuery: '',
      overlayCategory: 'all',
      popup: null,       // { kind: 'video'|'script', id }
      openPanels: {},    // 'voice' | 'personalization'
      busy: false,
      toast: '',
    };

    const lib = new TransitionsLibrary();
    this.transitions = Object.entries(lib.transitions).map(([id, t]) => ({ id, name: t.name, category: t.category, icon: t.icon, description: t.description }));
    this.niches = [...new Set(ALL_NICHE_TEMPLATES.map((t) => t.niche).filter(Boolean))];
    this.itemsById = new Map();
    this._player = null;
    this._searchTimer = null;
    this._searchToken = 0;
    this._toastTimer = null;
  }

  // ----------------------------------------------------------------- shell

  open() {
    super.open();
    this.overlay?.classList.add('tg-overlay');
    this._startSync();
  }

  /** Pull this account's templates from other devices; repaint the library when something arrived. */
  _startSync() {
    if (!this.store.sync || this._unsub) return;
    this.ui.sync = this.store.status?.() || SYNC_STATUS.LOCAL;
    this._unsub = this.store.subscribe?.((status, info = {}) => {
      this.ui.sync = status;
      if (!this.overlay) return;
      this._updateSyncBadge();
      if (info.changed) this._refreshLibraryViews();
    });
    this.store.sync();
  }

  syncLabel() {
    return {
      [SYNC_STATUS.LOCAL]: 'This device only · sign in to sync',
      [SYNC_STATUS.SYNCING]: 'Syncing…',
      [SYNC_STATUS.SYNCED]: 'Synced across your devices',
      [SYNC_STATUS.ERROR]: 'Sync paused · saved on this device',
    }[this.ui.sync] || '';
  }

  renderSyncBadge() {
    const err = this.ui.sync === SYNC_STATUS.ERROR ? this.store.lastError?.()?.message : '';
    return `<span class="tg-pill tg-sync is-${this.ui.sync}" title="${esc(err || this.syncLabel())}"><i class="tg-sync__dot"></i>${esc(this.syncLabel())}</span>`;
  }

  _updateSyncBadge() {
    this.overlay?.querySelectorAll('.tg-sync').forEach((el) => { el.outerHTML = this.renderSyncBadge(); });
  }

  /** New data arrived from another device: refresh whatever template list is on screen (without losing typing). */
  _refreshLibraryViews() {
    if (this.s.started) return;
    if (this.ui.view === 'library') {
      this._setHTML('#tg-lib-grid', this.renderLibraryCards());
      const n = this.overlay?.querySelector('#tg-lib-count');
      if (n) n.textContent = String(this.store.list().length);
    } else this.paint();
  }

  destroy() {
    this._destroyPlayer();
    clearTimeout(this._searchTimer);
    clearTimeout(this._toastTimer);
    this._unsub?.();
    this._unsub = null;
    this._destroyLive();
    this._hoverStop();
    this._moreObserver?.disconnect?.();
    super.destroy();
  }

  renderBody() {
    return `<div class="tg-root">${this.s.started ? this.renderWizard() : (this.ui.view === 'library' ? this.renderLibrary() : this.renderStart())}</div>`;
  }

  renderFooter() { return ''; }

  /** Repaint the whole modal body (tabs, step, Next button). Listeners are delegated: nothing to rebind. */
  paint() {
    this._hoverStop();
    this._destroyPlayer();
    this.setBodyContent(this.renderBody());
    this._afterPaint();
  }

  _afterPaint() {
    if (this.s.started && this.s.step === STEPS.PREVIEW) this._mountPlayer();
    if (this.ui.toast) this._showToast(this.ui.toast, true);
  }

  // ----------------------------------------------------------- start screen

  renderStart() {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isSafari = ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium');
    if (isSafari && !this.ui.safariAccepted) {
      return `
        <div class="tg-start template-generator-modal">
          <div class="generator-offer__warning">
            <span class="generator-offer__warning-text">We recommend using <a class="generator-offer__warning-link" href="https://www.google.com/chrome/" target="_blank" rel="noopener">Google Chrome</a> for the best experience.</span>
            <p class="generator-offer__warning-small-text">Some effects and video previews may not work in Safari.</p>
          </div>
          <button type="button" class="generator-offer__btn generator-offer__yes" data-act="safari-accept">Accept</button>
        </div>`;
    }
    const count = this.store.list().length;
    return `
      <div class="tg-start template-generator-modal">
        <span class="tg-badge-icon tg-badge-icon--lg" aria-hidden="true">✦</span>
        <div class="generator-offer__text-box"><h2 class="generator-offer__text">Template Generator</h2></div>
        <p class="tg-start__sub">Build a template once — footage, script, transition and text — save it, and reuse it for every video.</p>
        <div class="generator-offer__btns">
          <button type="button" class="generator-offer__btn generator-offer__yes" data-act="start">Create a template</button>
          <button type="button" class="generator-offer__btn generator-offer__no" data-act="open-library">My templates${count ? ` · ${count}` : ''}</button>
        </div>
        ${this.renderSyncBadge()}
        <button type="button" class="tg-link" data-act="decline">Close</button>
      </div>`;
  }

  // ------------------------------------------------------- My templates

  libraryTemplates() {
    const q = this.ui.libQuery.trim().toLowerCase();
    return this.store.list().filter((t) => !q || `${t.name} ${t.description || ''} ${t.niche || ''}`.toLowerCase().includes(q));
  }

  renderLibraryCards() {
    const all = this.store.list();
    const list = this.libraryTemplates();
    if (!all.length) return '<div class="tg-empty">No templates yet. Create your first one — it will be saved here so you can reuse it any time.</div>';
    if (!list.length) return '<div class="tg-empty">No templates match your search.</div>';
    return list.map((t) => {
      const tr = this.transitions.find((x) => x.id === t.transition?.type);
      const confirming = this.ui.confirmDeleteId === t.id;
      return `
        <article class="tg-tpl">
          <div class="tg-tpl__thumb" style="background-image:${cssUrl(t.thumbnail)}">
            ${t.thumbnail ? '' : firstFrame({ kind: 'video', url: t.thumbnailVideo })}
            ${t.niche ? `<span class="tg-badge">${esc(t.niche)}</span>` : ''}
            <span class="tg-tpl__count">${t.clipCount || 0} clip${t.clipCount === 1 ? '' : 's'} · ${formatTime(t.duration || 0)}</span>
          </div>
          <div class="tg-tpl__body">
            <h4 class="tg-tpl__name" title="${esc(t.name)}">${esc(t.name)}</h4>
            ${t.description ? `<p class="tg-hint">${esc(t.description)}</p>` : ''}
            <p class="tg-meta">${tr ? `${esc(tr.name)} transition · ` : ''}${t.uses ? `used ${t.uses}×` : 'not used yet'} · ${esc(new Date(t.updatedAt).toLocaleDateString())}</p>
          </div>
          <div class="tg-tpl__actions">
            <button type="button" class="tg-btn tg-btn--primary tg-btn--sm" data-act="tpl-use" data-id="${esc(t.id)}">Use template</button>
            <button type="button" class="tg-btn tg-btn--sm" data-act="tpl-dup" data-id="${esc(t.id)}">Duplicate</button>
            <button type="button" class="tg-btn tg-btn--sm${confirming ? ' tg-btn--danger' : ''}" data-act="tpl-del" data-id="${esc(t.id)}">${confirming ? 'Confirm delete' : 'Delete'}</button>
          </div>
        </article>`;
    }).join('');
  }

  renderLibrary() {
    return `
      <div class="template-generator-modal content tg-wizard">
        <header class="tg-head">
          <span class="tg-badge-icon" aria-hidden="true">✦</span>
          <div class="tg-head__text">
            <h2 class="tg-head__title">My templates</h2>
            <p class="tg-head__sub">Saved templates you can open, tweak and add to any timeline.</p>
          </div>
          <button type="button" class="tg-iconbtn" data-act="close" aria-label="Close">✕</button>
        </header>
        <div class="generator-body"><div class="tg-step tg-lib">
          <div class="tg-lib__bar">
            <div class="library__search-box search-box tg-searchbox"><span aria-hidden="true">🔍</span>
              <input type="search" id="tg-lib-query" data-query="library" placeholder="Search templates…" value="${esc(this.ui.libQuery)}" aria-label="Search templates"></div>
          </div>
          <div class="generator-list"><div class="tg-lib__grid" id="tg-lib-grid">${this.renderLibraryCards()}</div></div>
        </div></div>
        <footer class="tg-foot">
          <button type="button" class="tg-btn tg-btn--ghost" data-act="library-back">← Back</button>
          <div class="tg-summary"><span class="tg-pill is-on"><i>Saved</i><b id="tg-lib-count">${this.store.list().length}</b></span>${this.renderSyncBadge()}</div>
          <button type="button" class="tg-btn tg-btn--primary" data-act="start">＋ New template</button>
        </footer>
        <div class="tg-toast" id="tg-toast" role="status" aria-live="polite" hidden></div>
        <div class="tg-popup-host" id="tg-popup"></div>
      </div>`;
  }

  // ------------------------------------------------------------ wizard shell

  renderWizard() {
    const { step } = this.s;
    const disabled = nextDisabled(this.s, step, this.ui.busy);
    const last = step === STEPS.PREVIEW;
    return `
      <div class="template-generator-modal content tg-wizard">
        <header class="tg-head">
          <span class="tg-badge-icon" aria-hidden="true">✦</span>
          <div class="tg-head__text">
            <h2 class="tg-head__title">Template Generator</h2>
            <p class="tg-head__sub">Build a reusable template — footage, script, transition and text — then save it and add it to any timeline.${this.s.templateName ? ` <span class="tg-pill is-on"><i>Template</i>${esc(this.s.templateName)}</span>` : ''}</p>
          </div>
          <button type="button" class="tg-iconbtn" data-act="close" aria-label="Close">✕</button>
        </header>
        <nav class="template-generator-header tg-rail" role="tablist" aria-label="Template steps">
          ${STEP_LABELS.map((label, i) => `
            <button type="button" role="tab" aria-selected="${i === step}" class="header-tabs__item tg-rail__step${i === step ? ' header-tabs__item--active is-active' : ''}${i < step ? ' is-done' : ''}" data-act="tab" data-step="${i}">
              <span class="tg-rail__node">${i < step ? '✓' : i + 1}</span><span class="tg-rail__label">${label}</span>
            </button>`).join('')}
        </nav>
        <div class="generator-body">
          <div class="tg-step" id="tg-step">${this.renderStep()}</div>
        </div>
        <footer class="tg-foot">
          <button type="button" class="tg-btn tg-btn--ghost" data-act="back" ${step === STEPS.VIDEO ? 'disabled' : ''}>← Back</button>
          <div class="tg-summary" id="tg-summary">${this.renderSummary()}</div>
          <span class="tg-stepcount" id="tg-stepcount">Step ${step + 1} of ${STEP_LABELS.length}</span>
          ${last ? `<button type="button" class="tg-btn" id="tg-save" data-act="save-open" ${nextDisabled(this.s, step, this.ui.busy) ? 'disabled' : ''}>💾 ${this.s.templateId ? 'Save changes' : 'Save as template'}</button>` : ''}
          <button type="button" class="btn-add next-button tg-btn tg-btn--primary${disabled ? ' disabled' : ''}" id="tg-next" data-act="next" ${disabled ? 'disabled' : ''}>${this.ui.busy ? 'Adding…' : nextLabel(step)}${last ? '' : ' →'}</button>
        </footer>
        <div class="tg-toast" id="tg-toast" role="status" aria-live="polite" hidden></div>
        <div class="tg-popup-host" id="tg-popup">${this.renderPopup()}</div>
      </div>`;
  }

  /** Footer chips: clips, running time, transition, script. */
  renderSummary() {
    const s = this.s;
    const n = s.selectedVideos.length;
    const secs = s.selectedVideos.reduce((t, v) => t + clipDuration(v), 0);
    const tr = this.transitions.find((t) => t.id === s.selectedTransition?.type);
    const chip = (k, v, on) => `<span class="tg-pill${on ? ' is-on' : ''}"><i>${k}</i>${esc(v)}</span>`;
    return [
      chip('Clips', `${n}/${MAX_VIDEOS}`, n > 0),
      chip('Length', formatTime(secs), n > 0),
      chip('Transition', tr ? tr.name : 'None', !!tr),
      ...(s.selectedAnimations.length ? [chip('Motion', String(s.selectedAnimations.length), true)] : []),
      chip('Script', s.selectedScript?.name || (hasScript(s) ? 'Custom' : '—'), hasScript(s)),
    ].join('');
  }

  renderStep() {
    switch (this.s.step) {
      case STEPS.SCRIPT: return this.renderScriptStep();
      case STEPS.OVERLAY: return this.renderOverlayStep();
      case STEPS.PREVIEW: return this.renderPreviewStep();
      default: return this.renderVideoStep();
    }
  }

  // ------------------------------------------------------------- Video step

  renderVideoStep() {
    const u = this.ui;
    return `
      <div class="tg-video">
        <aside class="library__block template__block tg-providers">
          <span>Find media</span>
          <div class="library__block-sidebar"><div class="library__btn-container">
            ${this.renderRail()}
          </div></div>
        </aside>
        <section class="tg-video-main">
          <div class="search">
            <h4 class="search-title">${esc(this.searchTitle())} <span class="tg-count" id="tg-count">${this.countText()}</span></h4>
            ${this.renderProviderControls()}
          </div>
          <div class="generator-list video-list"><div class="list-items" id="tg-list">${this.renderProviderList()}</div></div>
          <div id="tg-tray">${this.renderSelectedStrip()}</div>
          ${u.provider === 'templates' ? '<p class="tg-attribution">Third-party AI clips. The original author and post are shown on each clip and kept with it.</p>' : ''}
          ${STOCK_HOME[u.provider] ? `<p class="tg-attribution">Provided by <a href="${STOCK_HOME[u.provider]}" target="_blank" rel="noopener">${u.provider === 'pexels' ? 'Pexels' : 'Pixabay'}</a>. Credit is kept with each clip.</p>` : ''}
        </section>
      </div>`;
  }

  searchTitle() {
    const x = this.extra.get(this.ui.provider);
    return x ? `Choose ${x.label.toLowerCase()}` : 'Choose your videos';
  }

  countText() {
    return this.extra.has(this.ui.provider) ? `${this.s.selectedAnimations.length}/${MAX_ANIMATIONS}` : `${this.s.selectedVideos.length}/${MAX_VIDEOS}`;
  }

  /** Source list: stock + own media first, then (when the host editor offers them) animations and templates. */
  railProviders() {
    const base = PROVIDERS.filter(([id]) => id !== 'ai' && id !== 'upload' && id !== 'remote');
    const mine = this.projectMedia ? [['library', 'My media']] : [];
    const own = PROVIDERS.filter(([id]) => id === 'upload' || id === 'remote' || id === 'ai');
    const extras = [...this.extra.values()].map((x) => [x.id, x.label, x.group || 'Motion & templates', x.blurb]);
    return { first: [['templates', 'Video templates'], ...base, ...mine, ...own], extras };
  }

  renderRail() {
    const u = this.ui;
    const { first, extras } = this.railProviders();
    const btn = (id, name, blurb) => `
      <button type="button" class="library__btn-item${u.provider === id ? ' library__btn-active' : ''}" data-act="provider" data-id="${esc(id)}" title="${esc(blurb || PROVIDER_BLURB[id] || '')}"><p>${esc(name)}</p></button>`;
    let html = first.map(([id, name]) => btn(id, name)).join('');
    let group = null;
    for (const [id, name, grp, blurb] of extras) {
      if (grp !== group) { group = grp; html += `<span class="tg-rail-label">${esc(grp)}</span>`; }
      html += btn(id, name, blurb);
    }
    return html;
  }

  /** Items of the "My media" source, filtered by the type chips and the search box. */
  libraryItems() {
    const raw = typeof this.projectMedia === 'function' ? this.projectMedia() : (this.projectMedia || []);
    const q = this.ui.query.trim().toLowerCase();
    return raw.filter((m) => m && m.url).map((m) => {
      const kind = m.type === 'image' || m.kind === 'image' ? 'image' : 'video';
      return {
        id: `library-${m.id}`, kind, source: 'library', title: m.name || m.title || 'Media', url: m.url, preview: m.url,
        poster: m.thumbnail || (kind === 'image' ? m.url : ''), duration: Number(m.duration) || 0, width: m.width, height: m.height, user: '', pageURL: '',
      };
    }).filter((it) => (this.ui.filter === 'all' || (this.ui.filter === 'videos' ? it.kind === 'video' : it.kind === 'image')) && (!q || it.title.toLowerCase().includes(q)));
  }

  renderTemplateControls() {
    const u = this.ui;
    const cat = u.tplCatalog;
    const chip = (act, id, label, on) => `<button type="button" class="tg-chip${on ? ' is-active' : ''}" data-act="${act}" data-id="${esc(id)}">${esc(label)}</button>`;
    const cats = cat ? Object.keys(cat.categories).filter((c) => cat.counts[c]) : [];
    const subs = cat && u.filter !== 'all' ? (cat.categories[u.filter] || []) : [];
    return `
      <p class="tg-hint">${esc(PROVIDER_BLURB.templates)} Pick up to ${MAX_VIDEOS}; they play on hover.</p>
      <div class="tg-chips" role="group" aria-label="Category">${chip('filter', 'all', 'All', u.filter === 'all')}${cats.map((c) => chip('filter', c, c, u.filter === c)).join('')}</div>
      ${subs.length ? `<div class="tg-chips" role="group" aria-label="Subcategory">${chip('tpl-sub', 'all', `All ${u.filter}`, u.tplSub === 'all')}${subs.map((c) => chip('tpl-sub', c, c, u.tplSub === c)).join('')}</div>` : ''}
      <div class="tg-chips" role="group" aria-label="Shape">${[['all', 'Any shape'], ['landscape', 'Landscape'], ['portrait', 'Portrait']].map(([id, l]) => chip('tpl-shape', id, l, u.tplShape === id)).join('')}</div>
      <div class="library__search-box search-box tg-searchbox"><span aria-hidden="true">🔍</span>
        <input type="search" id="tg-query" data-query="stock" placeholder="Search video templates…" value="${esc(u.query)}" autocomplete="off" aria-label="Search video templates"></div>`;
  }

  renderProviderControls() {
    const u = this.ui;
    if (u.provider === 'templates') return this.renderTemplateControls();
    if (u.provider === 'pixabay' || u.provider === 'pexels') {
      const filters = MEDIA_FILTERS[u.provider];
      return `
        <div class="tg-chips" role="group" aria-label="Media type">
          ${filters.map(([id, label]) => `<button type="button" class="tg-chip${u.filter === id ? ' is-active' : ''}" data-act="filter" data-id="${id}">${label}</button>`).join('')}
        </div>
        ${u.filter === 'collections' ? '' : `
          <div class="library__search-box search-box tg-searchbox">
            <span aria-hidden="true">🔍</span>
            <input type="search" id="tg-query" data-query="stock" placeholder="${u.filter === 'videos' ? 'Search free videos…' : u.filter === 'all' ? 'Search free videos and images…' : 'Search free images…'}" value="${esc(u.query)}" autocomplete="off" aria-label="Search">
          </div>`}`;
    }
    if (u.provider === 'library') {
      return `
        <div class="tg-chips" role="group" aria-label="Media type">
          ${[['all', 'All'], ['videos', 'Videos'], ['photos', 'Photos']].map(([id, label]) => `<button type="button" class="tg-chip${u.filter === id ? ' is-active' : ''}" data-act="filter" data-id="${id}">${label}</button>`).join('')}
        </div>
        <div class="library__search-box search-box tg-searchbox"><span aria-hidden="true">🔍</span>
          <input type="search" id="tg-query" data-query="stock" placeholder="Search your media…" value="${esc(u.query)}" autocomplete="off" aria-label="Search your media"></div>`;
    }
    const x = this.extra.get(u.provider);
    if (x) {
      return `
        <p class="tg-hint">${esc(x.blurb || '')} They are added as overlays on top of your footage and don’t use the ${MAX_VIDEOS} clip slots (up to ${MAX_ANIMATIONS}).</p>
        ${x.filters?.length ? `<div class="tg-chips" role="group" aria-label="Category">
          ${x.filters.map(([id, label]) => `<button type="button" class="tg-chip${u.filter === id ? ' is-active' : ''}" data-act="filter" data-id="${esc(id)}">${esc(label)}</button>`).join('')}
        </div>` : ''}
        <div class="library__search-box search-box tg-searchbox"><span aria-hidden="true">🔍</span>
          <input type="search" id="tg-query" data-query="stock" placeholder="Search ${esc(x.label.toLowerCase())}…" value="${esc(u.query)}" autocomplete="off" aria-label="Search ${esc(x.label)}"></div>`;
    }
    if (u.provider === 'upload') {
      return `
        <div class="tg-dropzone" data-act="upload-click" role="button" tabindex="0">
          <b>⬆ Upload videos or images</b>
          <span>Click or drop files here · images up to ${Math.round(UPLOAD_LIMITS.image / 1048576)} MB, videos up to ${Math.round(UPLOAD_LIMITS.video / 1048576)} MB</span>
          <input type="file" id="tg-file" multiple accept="video/*,image/*" hidden>
        </div>
        ${u.uploadStatus ? `<p class="tg-status">${esc(u.uploadStatus)}</p>` : ''}`;
    }
    if (u.provider === 'remote') {
      return `
        <div class="library__search-box search-box tg-searchbox">
          <input type="url" id="tg-remote-url" placeholder="https://… link to a video or image" value="${esc(u.remoteUrl)}" aria-label="Link to a video or image">
          <button type="button" class="tg-chip is-active" data-act="remote-add">Add</button>
        </div>
        ${u.remoteError ? `<p class="tg-status tg-status--error">${esc(u.remoteError)}</p>` : ''}`;
    }
    return `
      <div class="library__search-box search-box tg-searchbox">
        <input type="text" id="tg-ai-prompt" data-bind="ui.aiPrompt" placeholder="Describe the image you want…" value="${esc(u.aiPrompt)}" aria-label="Image prompt">
        <button type="button" class="tg-chip is-active" data-act="ai-generate" ${u.aiLoading ? 'disabled' : ''}>${u.aiLoading ? 'Generating…' : '✨ Generate'}</button>
      </div>
      ${u.aiError ? `<p class="tg-status tg-status--error">${esc(u.aiError)}</p>` : ''}`;
  }

  /** Items shown for the active provider. */
  providerItems() {
    const u = this.ui;
    if (u.provider === 'library') return this.libraryItems();
    if (u.provider === 'upload') return u.uploads;
    if (u.provider === 'remote') return u.remoteItems;
    if (u.provider === 'ai') return u.aiResults;
    return u.results;
  }

  renderProviderList() {
    const u = this.ui;
    if ((u.provider === 'pexels') && u.filter === 'collections' && !u.collectionId) return this.renderCollections();
    const items = this.providerItems();
    const cards = items.map((it) => this.renderVideoCard(it)).join('');
    let tail = '';
    if (u.loading) tail = '<div class="tg-loading" aria-busy="true">Loading…</div>';
    else if (u.error) tail = `<div class="tg-empty tg-empty--error">${esc(u.error)}</div>`;
    else if (!items.length) tail = `<div class="tg-empty">${this.emptyText()}</div>`;
    else if (u.hasMore && (u.provider === 'templates' || u.provider === 'pixabay' || u.provider === 'pexels' || this.extra.has(u.provider))) tail = '<button type="button" class="tg-more" data-act="load-more">Load more</button>';
    const back = u.collectionId ? `<button type="button" class="tg-chip tg-back" data-act="collections-back">← ${esc(u.collectionTitle || 'Collections')}</button>` : '';
    return `${back}${cards}${tail}`;
  }

  emptyText() {
    const u = this.ui;
    if (u.provider === 'library') return 'No videos or images in this project yet. Upload some, or pick from Pexels and Pixabay.';
    if (u.provider === 'upload') return 'No uploads yet. Add your own videos or images above.';
    if (u.provider === 'remote') return 'Paste a link above to add a video or image.';
    if (u.provider === 'ai') return 'Describe an image above and generate it.';
    if (u.provider === 'templates' && !u.query && u.filter === 'all') return 'The video templates could not be shown right now.';
    return u.query || u.provider === 'templates' ? 'Nothing found. Try another search.' : 'Nothing to show yet.';
  }

  renderCollections() {
    const u = this.ui;
    if (u.loading) return '<div class="tg-loading" aria-busy="true">Loading…</div>';
    if (u.error) return `<div class="tg-empty tg-empty--error">${esc(u.error)}</div>`;
    if (!u.collections?.length) return '<div class="tg-empty">No collections found.</div>';
    return u.collections.map((c) => `
      <button type="button" class="niche-script tg-collection" data-act="collection" data-id="${esc(c.id)}" data-title="${esc(c.title)}">
        <span class="niche-script__title"><img class="niche-script__title-icon" src="${ICON('niche-script')}" alt=""><span>${esc(c.title)}</span></span>
        <span class="tg-meta">${esc(c.count ?? '')} items</span>
      </button>`).join('');
  }

  /** Animation / motion graphic / end screen card: a coloured tile (or its thumbnail) with a glyph. */
  renderAnimationCard(it) {
    const on = this.s.selectedAnimations.some((a) => a.id === it.id);
    const thumb = it.poster || it.thumb;
    return `
      <div class="video-tile tg-anim${on ? ' active' : ''}${it.ratio && it.ratio < 0.9 ? ' tg-anim--portrait' : ''}" role="button" tabindex="0" aria-pressed="${on}" data-act="pick-video" data-id="${esc(it.id)}"
           style="--tg-hue:${hueOf(it.category || it.id)};--tg-still:${thumb ? cssUrl(thumb) : 'none'}" title="${esc(it.description || it.title)}">
        <span class="tg-anim__glyph" aria-hidden="true">${esc(it.glyph || '✺')}</span>
        ${thumb ? `<img class="tg-thumb tg-anim__img" src="${esc(thumb)}" alt="" loading="lazy" decoding="async">` : ''}
        ${on ? '<span class="preview__select" aria-hidden="true">✓</span>' : ''}
        <span class="tg-badge">${esc(it.badge || 'ANIMATION')}${it.duration ? ` · ${formatTime(it.duration)}` : ''}</span>
        <div class="tg-card-title">${esc(it.title)}</div>
        <button type="button" class="video__item__button tg-card-preview" data-act="preview-video" data-id="${esc(it.id)}">Preview</button>
      </div>`;
  }

  renderVideoCard(it) {
    this.itemsById.set(it.id, it);
    if (it.kind === 'animation') return this.renderAnimationCard(it);
    const selected = this.s.selectedVideos.some((v) => v.id === it.id);
    const badge = it.kind === 'video' ? `VIDEO${it.duration ? ` · ${formatTime(it.duration)}` : ''}` : 'PHOTO';
    return `
      <div class="video-tile video__item video-element${selected ? ' active' : ''}" role="button" tabindex="0" aria-pressed="${selected}"
           data-act="pick-video" data-id="${esc(it.id)}" style="background-image:${cssUrl(stillOf(it))}" title="${esc(it.title)}">
        ${firstFrame(it)}
        ${selected ? `<span class="preview__select" aria-hidden="true">${this.s.selectedVideos.findIndex((v) => v.id === it.id) + 1}</span>` : ''}
        <span class="tg-badge">${esc(badge)}</span>
        ${it.status === 'uploading' ? '<span class="tg-uploading">Uploading…</span>' : ''}
        <div class="tg-card-title">${esc(it.title)}</div>
        <button type="button" class="video__item__button tg-card-preview" data-act="preview-video" data-id="${esc(it.id)}">Preview</button>
      </div>`;
  }

  renderSelectedStrip() {
    const sel = this.s.selectedVideos;
    const anim = this.s.selectedAnimations;
    const clips = sel.length ? `
      <div class="tg-selected" aria-label="Selected clips">
        ${sel.map((it, i) => `
          <span class="tg-selected__item"><b>${i + 1}</b> ${esc(it.title)}
            <button type="button" aria-label="Remove ${esc(it.title)}" data-act="remove-video" data-id="${esc(it.id)}">✕</button></span>`).join('')}
      </div>` : '<p class="tg-hint">Pick up to 5 clips. Add more later in the timeline.</p>';
    const motion = anim.length ? `
      <div class="tg-selected tg-selected--anim" aria-label="Selected animations">
        ${anim.map((a) => `
          <span class="tg-selected__item tg-selected__item--anim"><b>✺</b> ${esc(a.title)}
            <button type="button" aria-label="Remove ${esc(a.title)}" data-act="remove-animation" data-id="${esc(a.id)}">✕</button></span>`).join('')}
      </div>` : '';
    return clips + motion;
  }

  // ------------------------------------------------------------ Script step

  scriptCards() {
    const q = this.ui.scriptQuery.trim().toLowerCase();
    return ALL_NICHE_TEMPLATES.filter((t) => (this.ui.scriptNiche === 'all' || t.niche === this.ui.scriptNiche)
      && (!q || `${t.name} ${t.description} ${t.niche}`.toLowerCase().includes(q)));
  }

  renderScriptStep() {
    const u = this.ui;
    const sc = this.s.script;
    const sel = this.s.selectedScript;
    return `
      <div class="tg-script">
        <div class="tg-script-left">
          <div class="search">
            <h4 class="search-title">Choose your script</h4>
            <div class="library__search-box search-box tg-searchbox"><span aria-hidden="true">🔍</span>
              <input type="search" id="tg-script-query" data-query="script" placeholder="Search scripts…" value="${esc(u.scriptQuery)}" aria-label="Search scripts"></div>
            <div class="tg-chips">
              <button type="button" class="tg-chip${u.scriptNiche === 'all' ? ' is-active' : ''}" data-act="niche" data-id="all">All</button>
              ${this.niches.map((n) => `<button type="button" class="tg-chip${u.scriptNiche === n ? ' is-active' : ''}" data-act="niche" data-id="${esc(n)}">${esc(n)}</button>`).join('')}
            </div>
          </div>
          <div class="generator-list niche-scripts-list"><div class="list-items" id="tg-script-list">${this.renderScriptCards()}</div></div>
        </div>
        <aside class="tg-script-right">
          <h4>Your script ${sel ? `<span class="tg-meta">· ${esc(sel.name)}</span>` : ''}</h4>
          <p class="tg-hint">Pick a template on the left to start from its written script (one line per scene), or write your own. Each line becomes a caption on its scene.</p>
          <fieldset class="tg-details" aria-label="Your details">
            <legend>Your details <span class="tg-meta">fill the script in and guide the AI</span></legend>
            <div class="tg-form-row">
              ${DETAIL_FIELDS.map((f) => `<label>${f.label}<input type="text" data-bind="s.details.${f.key}" placeholder="${esc(f.placeholder)}" value="${esc(this.s.details[f.key])}" maxlength="120"></label>`).join('')}
            </div>
            <label class="tg-field">About your business (optional, helps the AI)
              <input type="text" data-bind="s.details.about" placeholder="e.g. Family-run Italian place, wood-fired pizza, cosy patio" value="${esc(this.s.details.about)}" maxlength="400"></label>
          </fieldset>
          <p class="tg-status tg-status--warn" id="tg-placeholders" ${placeholdersLeft(sc.text + ' ' + sc.cta).length ? '' : 'hidden'}>${this.placeholderHint()}</p>
          ${sel && templateScript(sel.id) && sc.text !== this.s.autoText ? `<button type="button" class="tg-chip is-active" data-act="use-template-script">Use “${esc(sel.name)}” written script</button>` : ''}
          <textarea id="tg-script-text" class="tg-textarea" rows="8" data-bind="s.script.text" placeholder="Write or paste your script here…">${esc(sc.text)}</textarea>
          <div class="tg-form-row">
            <label>Tone
              <select data-bind="s.script.tone">${['conversational', 'professional', 'energetic', 'warm', 'dramatic', 'tutorial', 'commercial'].map((t) => `<option value="${t}"${sc.tone === t ? ' selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></label>
            <label>Audience
              <select data-bind="s.script.audience">${['general', 'business', 'consumer', 'youth', 'professionals', 'creators'].map((a) => `<option value="${a}"${sc.audience === a ? ' selected' : ''}>${a[0].toUpperCase() + a.slice(1)}</option>`).join('')}</select></label>
          </div>
          <label class="tg-field">Call to action
            <input type="text" id="tg-script-cta" data-bind="s.script.cta" placeholder="e.g. Book your free consultation today" value="${esc(sc.cta)}"></label>
          <div class="tg-ai-tools">
            ${[['generate', '✨ Write with AI'], ['rewrite', '🔄 Rewrite'], ['shorten', '📝 Shorten'], ['expand', '📖 Expand']].map(([k, label]) => `<button type="button" class="tg-chip" data-act="ai-script" data-kind="${k}" ${u.scriptBusy ? 'disabled' : ''}>${u.scriptBusy === k ? '⏳ Working…' : label}</button>`).join('')}
          </div>
          ${u.scriptError ? `<p class="tg-status tg-status--error">${esc(u.scriptError)}</p>` : ''}
        </aside>
      </div>`;
  }

  renderScriptCards() {
    const cards = this.scriptCards();
    if (!cards.length) return '<div class="tg-empty">No scripts match.</div>';
    const activeId = this.s.selectedScript?.id;
    return cards.map((t) => `
      <div class="niche-script${t.id === activeId ? ' active' : ''}" role="button" tabindex="0" aria-pressed="${t.id === activeId}" data-act="script-pick" data-id="${esc(t.id)}" title="${esc(t.description)}">
        ${t.id === activeId ? '<span class="preview__select" aria-hidden="true">✓</span>' : ''}
        <div class="niche-script__title"><img class="niche-script__title-icon" src="${ICON('niche-script')}" alt=""><span>${esc(t.name)}</span></div>
        <span class="tg-meta">${esc(t.niche)}</span>
        <button type="button" class="niche-script__button" data-act="script-preview" data-id="${esc(t.id)}">Preview</button>
      </div>`).join('');
  }

  // ----------------------------------------------------------- Overlay step

  renderOverlayStep() {
    const u = this.ui;
    return `
      <div class="tg-overlays">
        <div class="search">
          <h4 class="search-title">Choose your overlay</h4>
          <div class="tg-chips" role="tablist">
            <button type="button" class="tg-chip${u.overlayTab === 'transitions' ? ' is-active' : ''}" data-act="overlay-tab" data-id="transitions">Transitions</button>
            <button type="button" class="tg-chip${u.overlayTab === 'elements' ? ' is-active' : ''}" data-act="overlay-tab" data-id="elements">Text elements</button>
          </div>
        </div>
        ${u.overlayTab === 'transitions' ? this.renderTransitions() : this.renderElements()}
      </div>`;
  }

  transitionCards() {
    const q = this.ui.overlayQuery.trim().toLowerCase();
    return this.transitions.filter((t) => (this.ui.overlayCategory === 'all' || t.category === this.ui.overlayCategory)
      && (!q || `${t.name} ${t.category}`.toLowerCase().includes(q)));
  }

  renderTransitions() {
    const u = this.ui;
    const cats = [...new Set(this.transitions.map((t) => t.category))];
    const cur = this.s.selectedTransition?.type;
    return `
      <p class="tg-hint">A transition plays between each pair of your ${this.s.selectedVideos.length} clips.</p>
      <div class="library__search-box search-box tg-searchbox"><span aria-hidden="true">🔍</span>
        <input type="search" id="tg-overlay-query" data-query="overlay" placeholder="Search transitions…" value="${esc(u.overlayQuery)}" aria-label="Search transitions"></div>
      <div class="tg-chips">
        <button type="button" class="tg-chip${u.overlayCategory === 'all' ? ' is-active' : ''}" data-act="transition-cat" data-id="all">All</button>
        ${cats.map((c) => `<button type="button" class="tg-chip${u.overlayCategory === c ? ' is-active' : ''}" data-act="transition-cat" data-id="${c}">${TRANSITION_CATEGORY_LABELS[c] || c}</button>`).join('')}
      </div>
      <div class="generator-list overlays"><div class="list-items" id="tg-overlay-list">
        <button type="button" class="overlays__item overlays__item-container tg-transition${!cur ? ' active' : ''}" data-act="transition-pick" data-id=""><span class="tg-tr-icon">⛔</span><b>None</b><span class="tg-meta">Plain cuts</span></button>
        ${this.transitionCards().map((t) => `
          <button type="button" class="overlays__item overlays__item-container tg-transition${cur === t.id ? ' active' : ''}" data-act="transition-pick" data-id="${esc(t.id)}" title="${esc(t.description || '')}" aria-pressed="${cur === t.id}">
            ${cur === t.id ? '<span class="preview__select" aria-hidden="true">✓</span>' : ''}
            <span class="tg-tr-icon">${esc(t.icon || '🎞️')}</span><b>${esc(t.name)}</b><span class="tg-meta">${esc(TRANSITION_CATEGORY_LABELS[t.category] || t.category)}</span>
          </button>`).join('')}
      </div></div>`;
  }

  renderElements() {
    const e = this.s.elements;
    return `
      <div class="tg-elements">
        <label class="tg-toggle"><input type="checkbox" data-bind="s.elements.captions" ${e.captions ? 'checked' : ''}><span>Show my script as captions, one line per clip</span></label>
        <label class="tg-field">Title (first 3 seconds)
          <input type="text" data-bind="s.elements.title" placeholder="e.g. Summer Sale" value="${esc(e.title)}"></label>
        <label class="tg-field">Lower third
          <input type="text" data-bind="s.elements.lowerThird" placeholder="e.g. Jane Doe · Owner" value="${esc(e.lowerThird)}"></label>
        <label class="tg-field">Call to action (last 4 seconds)
          <input type="text" data-bind="s.elements.cta" placeholder="${esc(this.s.script.cta || 'e.g. Book your free consultation')}" value="${esc(e.cta)}"></label>
        <p class="tg-hint">These become editable text clips on their own tracks. Logos, stickers, lead forms and interactive overlays are in the editor's Overlay tools.</p>
      </div>`;
  }

  // ----------------------------------------------------------- Preview step

  builderState() { return toBuilderState(this.s); }

  buildPreview() {
    try {
      const st = this.builderState();
      return { preview: buildPreviewFromState(st), error: null };
    } catch (err) {
      return { preview: null, error: err.message || 'Could not build the preview' };
    }
  }

  renderPreviewStep() {
    const s = this.s;
    const { preview, error } = this.buildPreview();
    const playlist = preview ? playlistFromPreview(preview) : [];
    this._playlist = playlist;
    const hasOverlayTab = s.selectedVideos.length >= 2;
    const voiceOpen = this.ui.openPanels.voice;
    const persOpen = this.ui.openPanels.personalization;
    const tr = this.transitions.find((t) => t.id === s.selectedTransition?.type);
    return `
      <div class="tg-preview">
        <div class="search">
          <h4 class="search-title">Preview</h4>
          <span class="library__search-box search-box preview-box">Complete your selection and add the files to the timeline</span>
        </div>
        <div class="generator-list preview-tab__content">
          <div class="preview-tab-settings">
            <div class="preview-tab__content-overlays video-list">
              <div class="elements-list list-items">
                ${s.selectedVideos.map((it) => `
                  <div class="video-tile video__item video-element" style="background-image:${cssUrl(stillOf(it))}" title="${esc(it.title)}">
                    ${firstFrame(it)}
                    <button type="button" class="preview__delete" aria-label="Remove ${esc(it.title)}" data-act="remove-video" data-id="${esc(it.id)}">−</button>
                    <div class="tg-card-title">${esc(it.title)}</div>
                  </div>`).join('')}
                ${s.selectedAnimations.map((a) => `
                  <div class="video-tile video__item video-element tg-anim" style="--tg-hue:${hueOf(a.category || a.id)};--tg-still:${a.thumb ? cssUrl(a.thumb) : 'none'}" title="${esc(a.title)}">
                    <button type="button" class="preview__delete" aria-label="Remove ${esc(a.title)}" data-act="remove-animation" data-id="${esc(a.id)}">−</button>
                    <span class="tg-anim__glyph" aria-hidden="true">✺</span>${a.thumb ? `<img class="tg-thumb tg-anim__img" src="${esc(a.thumb)}" alt="" loading="lazy">` : ''}
                    <span class="tg-badge">${esc(a.badge || 'ANIMATION')}</span>
                    <div class="tg-card-title">${esc(a.title)}</div>
                  </div>`).join('')}
                <div class="overlays__item-container overlays__item select${hasOverlayTab ? '' : ' disabled'}" role="button" tabindex="0" data-act="tab" data-step="${STEPS.OVERLAY}">
                  <div class="select-overlay-container"><span>${tr ? `${esc(tr.icon || '')} ${esc(tr.name)} transition` : (hasOverlayTab ? 'Please select overlay' : 'Please select more than one video and Select overlay')}</span></div>
                </div>
              </div>
            </div>
            <div class="preview-tab__content-scripts">
              <div class="niche-script" role="button" tabindex="0" data-act="tab" data-step="${STEPS.SCRIPT}">
                <div class="niche-script__title"><img class="niche-script__title-icon" src="${ICON('niche-script')}" alt=""><span>${esc(s.selectedScript?.name || 'Your script')}</span></div>
                <span class="tg-meta">${esc(sceneNames(s).length)} scenes</span>
              </div>
            </div>
          </div>
          <div class="preview-tab__content-watch">
            ${error ? `<div class="tg-player tg-player--empty">${esc(error)}</div>` : renderPlayerHTML(playlist)}
            ${preview ? this.renderLanes(preview) : ''}
          </div>
        </div>
        <div class="tg-extras">
          ${this.renderPanel('voice', '🎙️ Voice narration (optional)', voiceOpen, this.renderVoiceFields())}
          ${this.renderPanel('personalization', '👤 Personalization (optional)', persOpen, this.renderPersonalizationFields())}
        </div>
      </div>`;
  }

  /** Read-only track lanes, coloured like the timeline editor (video / text / fx). */
  renderLanes(preview) {
    const total = Math.max(preview.duration || 0, 1);
    const kind = (t, c) => (c.type === 'animation' || /transition|overlay|animation/i.test(t.name) ? 'fx' : (c.type === 'video' || c.type === 'image') ? 'video' : (c.type === 'audio' ? 'audio' : 'text'));
    const lanes = { video: [], text: [], fx: [], audio: [] };
    for (const t of preview.tracks || []) for (const c of t.clips || []) lanes[kind(t, c)].push(c);
    const label = { video: 'Video', text: 'Text', fx: 'Motion', audio: 'Audio' };
    // Clips that overlap in time (animations over each other) go on their own row so none is hidden.
    const stack = (cl) => {
      const ends = []; const placed = [];
      for (const c of [...cl].sort((x, y) => (x.startTime || 0) - (y.startTime || 0))) {
        const start = c.startTime || 0;
        let row = ends.findIndex((e) => e <= start + 0.001);
        if (row < 0) { row = ends.length; ends.push(0); }
        ends[row] = start + (c.duration || 1);
        placed.push({ c, row });
      }
      return { placed, rows: Math.max(ends.length, 1) };
    };
    const rows = Object.entries(lanes).filter(([, cl]) => cl.length).map(([k, cl]) => {
      const { placed, rows: n } = stack(cl);
      return `
      <div class="tg-lane"><span class="tg-lane__name"><i class="tg-dot tg-dot--${k}"></i>${label[k]}</span>
        <div class="tg-lane__track" style="height:${n * 28 - 2}px">${placed.map(({ c, row }) => `<span class="tg-clip tg-clip--${k}" style="left:${((c.startTime || 0) / total) * 100}%;width:${Math.max(((c.duration || 1) / total) * 100, 2)}%;top:${row * 28 + 2}px;height:22px" title="${esc(c.name)}">${esc(c.name)}</span>`).join('')}</div>
      </div>`;
    }).join('');
    const tr = (preview.transitions || []).length ? `<p class="tg-hint">${preview.transitions.length} transition${preview.transitions.length === 1 ? '' : 's'} between clips</p>` : '';
    return `<div class="tg-lanes" aria-label="Timeline preview"><div class="tg-lanes__head"><b>Timeline</b><span>${formatTime(total)}</span></div>${rows}${tr}</div>`;
  }

  renderPanel(id, title, open, inner) {
    return `<section class="tg-panel${open ? ' is-open' : ''}"><button type="button" class="tg-panel__head" data-act="panel-toggle" data-id="${id}" aria-expanded="${!!open}">${title}<span>${open ? '▾' : '▸'}</span></button>${open ? `<div class="tg-panel__body">${inner}</div>` : ''}</section>`;
  }

  renderVoiceFields() {
    const v = this.s.voice;
    return `
      <label class="tg-toggle"><input type="checkbox" data-bind="s.voice.enabled" ${v.enabled ? 'checked' : ''}><span>Add AI voice narration of my script</span></label>
      <div class="tg-form-row">
        <label>Voice <select data-bind="s.voice.voice">${['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map((x) => `<option value="${x}"${v.voice === x ? ' selected' : ''}>${x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select></label>
      </div>
      <label class="tg-field">Delivery instructions <input type="text" data-bind="s.voice.instructions" placeholder="e.g. Warm, upbeat, pause for emphasis" value="${esc(v.instructions)}"></label>`;
  }

  renderPersonalizationFields() {
    const p = this.s.personalization;
    return `
      <label class="tg-toggle"><input type="checkbox" data-bind="s.personalization.enabled" ${p.enabled ? 'checked' : ''}><span>Personalize this video for each viewer</span></label>
      <p class="tg-hint">Use tokens in your script: ${['{{first_name}}', '{{last_name}}', '{{company}}', '{{city}}', '{{offer}}'].map((t) => `<code>${t}</code>`).join(' ')}</p>`;
  }

  // ----------------------------------------------------------------- popups

  renderPopup() {
    const p = this.ui.popup;
    if (!p) return '';
    if (p.kind === 'save') {
      const lost = splitDurable(this.s.selectedVideos).dropped.length;
      return `
        <div class="tg-popup" role="dialog" aria-modal="true" aria-label="Save as template" data-act="popup-backdrop">
          <div class="tg-popup__card tg-save">
            <button type="button" class="tg-popup__close" data-act="popup-close" aria-label="Close">✕</button>
            <h4>${this.s.templateId ? 'Save template' : 'Save as template'}</h4>
            <p class="tg-hint">It will appear in “My templates” so you can reuse it. When you open it later you can swap footage and edit the script before adding it.</p>
            <label class="tg-field">Name <input type="text" id="tg-tpl-name" data-bind="ui.tplName" maxlength="80" placeholder="e.g. Weekend listing promo" value="${esc(this.ui.tplName)}"></label>
            <label class="tg-field">Description (optional) <input type="text" data-bind="ui.tplDesc" maxlength="240" placeholder="What is this template for?" value="${esc(this.ui.tplDesc)}"></label>
            ${this.s.templateId ? `<div class="tg-chips" role="group" aria-label="Save mode">
              <button type="button" class="tg-chip${this.ui.tplMode === 'update' ? ' is-active' : ''}" data-act="tpl-mode" data-id="update">Update “${esc(this.s.templateName)}”</button>
              <button type="button" class="tg-chip${this.ui.tplMode === 'new' ? ' is-active' : ''}" data-act="tpl-mode" data-id="new">Save as a new template</button></div>` : ''}
            ${lost ? `<p class="tg-status tg-status--error">${lost} clip${lost === 1 ? '' : 's'} (a local file or an upload still in progress) can’t be kept in a template and will be left out.</p>` : ''}
            <div class="tg-popup__actions">
              <button type="button" class="tg-btn" data-act="popup-close">Cancel</button>
              <button type="button" class="tg-btn" data-act="save-confirm">Save template</button>
              <button type="button" class="tg-btn tg-btn--primary" data-act="save-confirm-add">Save &amp; add to timeline</button>
            </div>
          </div>
        </div>`;
    }
    if (p.kind === 'animation') {
      const it = this.itemsById.get(p.id);
      if (!it) return '';
      const on = this.s.selectedAnimations.some((a) => a.id === it.id);
      return `
        <div class="tg-popup" role="dialog" aria-modal="true" aria-label="Preview ${esc(it.title)}" data-act="popup-backdrop">
          <div class="tg-popup__card">
            <button type="button" class="tg-popup__close" data-act="popup-close" aria-label="Close">✕</button>
            <h4>${esc(it.title)}</h4>
            <div class="tg-popup__live" id="tg-live" style="--tg-hue:${hueOf(it.category || it.id)}"><span class="tg-anim__glyph" aria-hidden="true">${esc(it.glyph || '✺')}</span></div>
            ${it.description ? `<p class="tg-hint">${esc(it.description)}</p>` : ''}
            <p class="tg-credit">${esc(it.badge || 'Animation')}${it.category ? ` · ${esc(it.category)}` : ''}${it.duration ? ` · ${formatTime(it.duration)}` : ''}. Added as an overlay you can edit on the timeline.</p>
            <div class="tg-popup__actions">
              <button type="button" class="tg-btn" data-act="popup-close">Close</button>
              <button type="button" class="tg-btn tg-btn--primary" data-act="popup-use" data-id="${esc(it.id)}">${on ? 'Remove from selection' : 'Use this'}</button>
            </div>
          </div>
        </div>`;
    }
    if (p.kind === 'video') {
      const it = this.itemsById.get(p.id);
      if (!it) return '';
      const selected = this.s.selectedVideos.some((v) => v.id === it.id);
      const credit = it.source === TEMPLATE_SOURCE ? (it.user || it.pageURL ? `Original by ${esc(it.user || 'the author')}${it.pageURL ? ` · <a href="${esc(it.pageURL)}" target="_blank" rel="noopener">original post</a>` : ''}` : '')
        : it.user ? `${it.kind === 'video' ? 'Video' : 'Photo'} by ${esc(it.user)}${it.source === 'pexels' || it.source === 'pixabay' ? ` on <a href="${esc(it.pageURL || STOCK_HOME[it.source])}" target="_blank" rel="noopener">${it.source === 'pexels' ? 'Pexels' : 'Pixabay'}</a>` : ''}` : '';
      return `
        <div class="tg-popup" role="dialog" aria-modal="true" aria-label="Preview ${esc(it.title)}" data-act="popup-backdrop">
          <div class="tg-popup__card">
            <button type="button" class="tg-popup__close" data-act="popup-close" aria-label="Close">✕</button>
            <h4>${esc(it.title)}</h4>
            ${it.kind === 'video' ? `<video class="tg-popup__media" src="${esc(it.preview || it.url)}" controls autoplay muted playsinline></video>` : `<img class="tg-popup__media" src="${esc(it.preview || it.url)}" alt="${esc(it.title)}">`}
            ${credit ? `<p class="tg-credit">${credit}</p>` : ''}
            <div class="tg-popup__actions">
              <button type="button" class="tg-chip" data-act="popup-close">Close</button>
              <button type="button" class="tg-chip is-active" data-act="popup-use" data-id="${esc(it.id)}">${selected ? 'Remove from selection' : 'Use this clip'}</button>
            </div>
          </div>
        </div>`;
    }
    const t = ALL_NICHE_TEMPLATES.find((x) => x.id === p.id);
    if (!t) return '';
    const d = t.duration || {};
    return `
      <div class="tg-popup" role="dialog" aria-modal="true" aria-label="Preview ${esc(t.name)}" data-act="popup-backdrop">
        <div class="tg-popup__card">
          <button type="button" class="tg-popup__close" data-act="popup-close" aria-label="Close">✕</button>
          <h4>${esc(t.name)}</h4>
          <p class="tg-meta">${esc(t.niche)} · ${esc((t.aspectRatios || []).join(' / '))}${d.default ? ` · about ${d.default}s` : ''}</p>
          <p>${esc(t.description)}</p>
          ${(() => {
            const ts = templateScript(t.id, this.s.details);
            return ts
              ? `<ol class="tg-scenes tg-scenes--script">${(t.sceneStructure || []).map((x, i) => `<li><b>${esc(x)}</b><span>${esc(ts.lines[i] || '')}</span></li>`).join('')}</ol><p class="tg-credit"><b>Call to action:</b> ${esc(ts.cta)}</p>`
              : `<ol class="tg-scenes">${(t.sceneStructure || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
          })()}
          <div class="tg-popup__actions">
            <button type="button" class="tg-chip" data-act="popup-close">Close</button>
            <button type="button" class="tg-chip is-active" data-act="popup-use-script" data-id="${esc(t.id)}">Use this script</button>
          </div>
        </div>
      </div>`;
  }

  setPopup(popup) {
    this._destroyLive();
    this.ui.popup = popup;
    const host = this.overlay?.querySelector('#tg-popup');
    if (host) host.innerHTML = this.renderPopup();
    if (popup?.kind === 'animation') this._mountLive(popup.id);
  }

  /** Live motion preview inside the popup, drawn by the host editor's own renderer (sandboxed there). */
  _mountLive(id) {
    const it = this.itemsById.get(id);
    const src = it && this.extra.get(it.source);
    const host = this.overlay?.querySelector('#tg-live');
    if (!src?.mountPreview || !host) return;
    try { this._liveDestroy = src.mountPreview(host, it); host.classList.add('is-live'); } catch { /* the glyph stays as the preview */ }
  }

  _destroyLive() { try { this._liveDestroy?.(); } catch { /* ignore */ } this._liveDestroy = null; }

  // ----------------------------------------------------------------- events

  setupEventListeners() {
    super.setupEventListeners();
    this._bindDelegates();
  }

  _bindDelegates() {
    const root = this.overlay;
    if (!root || root._tgBound) return; // bound once per overlay, never stacked
    root._tgBound = true;

    root.addEventListener('click', (e) => {
      const el = e.target.closest?.('[data-act]');
      if (!el || !root.contains(el)) return;
      // Clicks on the backdrop itself (not the card) close the popup.
      if (el.dataset.act === 'popup-backdrop' && e.target !== el) return;
      // A button inside a clickable card must not also trigger the card.
      e.stopPropagation();
      this._act(el.dataset.act, el, e);
    });

    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.ui.popup) { e.stopPropagation(); this.setPopup(null); return; }
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest?.('[role="button"][data-act]');
        if (card && e.target === card) { e.preventDefault(); this._act(card.dataset.act, card, e); return; }
      }
      if (e.key === 'Enter' && e.target.id === 'tg-remote-url') { e.preventDefault(); this._act('remote-add', e.target, e); }
      if (e.key === 'Enter' && e.target.id === 'tg-ai-prompt') { e.preventDefault(); this._act('ai-generate', e.target, e); }
    }, true);

    // A thumbnail that fails to load disappears and the tile's glyph shows instead (error doesn't bubble: capture it).
    root.addEventListener('error', (e) => { if (e.target?.classList?.contains('tg-thumb')) e.target.remove(); }, true);
    // Real previews on hover: stock/own videos play, animations run live in the editor's sandboxed renderer.
    root.addEventListener('mouseover', (e) => this._onHover(e));
    root.addEventListener('mouseout', (e) => this._onHoverOut(e));

    root.addEventListener('input', (e) => this._onInput(e));
    root.addEventListener('change', (e) => this._onChange(e));

    // Drag & drop files onto the Upload dropzone.
    root.addEventListener('dragover', (e) => { if (e.target.closest?.('.tg-dropzone')) e.preventDefault(); });
    root.addEventListener('drop', (e) => {
      if (!e.target.closest?.('.tg-dropzone') || !e.dataTransfer?.files?.length) return;
      e.preventDefault();
      this._addUploads(e.dataTransfer.files);
    });
  }

  _onHover(e) {
    const tile = e.target.closest?.('.video-tile[data-id]');
    if (!tile || tile === this._hoverTile || tile.closest('.tg-popup')) return;
    this._hoverStop();
    this._hoverTile = tile;
    const it = this.itemsById.get(tile.dataset.id);
    if (!it) return;
    if (it.kind === 'video') {
      const src = it.preview || it.url;
      if (!src) return;
      const v = document.createElement('video');
      v.className = 'tg-hovervid'; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto';
      v.src = src;
      tile.insertBefore(v, tile.firstChild);
      try { v.play?.()?.catch?.(() => {}); } catch { /* autoplay blocked: the poster stays */ }
      this._hoverEl = v;
    } else if (it.kind === 'animation') {
      this._hoverTimer = setTimeout(() => this._mountHoverLive(tile, it), 350);
    }
  }

  _onHoverOut(e) {
    const tile = e.target.closest?.('.video-tile[data-id]');
    if (tile && tile === this._hoverTile && !tile.contains(e.relatedTarget)) this._hoverStop();
  }

  _mountHoverLive(tile, it) {
    const src = this.extra.get(it.source);
    if (!src?.mountPreview || !tile.isConnected || this._hoverTile !== tile) return;
    const host = document.createElement('div');
    host.className = 'tg-anim__live';
    tile.appendChild(host);
    try { this._hoverDestroy = src.mountPreview(host, it); tile.classList.add('is-live'); } catch { host.remove(); }
  }

  _hoverStop() {
    clearTimeout(this._hoverTimer);
    this._hoverEl?.remove(); this._hoverEl = null;
    try { this._hoverDestroy?.(); } catch { /* ignore */ }
    this._hoverDestroy = null;
    this._hoverTile?.classList?.remove('is-live');
    this._hoverTile?.querySelector?.('.tg-anim__live')?.remove();
    this._hoverTile = null;
  }

  _onInput(e) {
    const t = e.target;
    if (t.dataset?.query) {
      const kind = t.dataset.query;
      if (kind === 'stock') {
        this.ui.query = t.value;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.runSearch(true), 350);
      } else if (kind === 'script') {
        this.ui.scriptQuery = t.value;
        this._setHTML('#tg-script-list', this.renderScriptCards());
      } else if (kind === 'library') {
        this.ui.libQuery = t.value;
        this._setHTML('#tg-lib-grid', this.renderLibraryCards());
      } else if (kind === 'overlay') {
        this.ui.overlayQuery = t.value;
        this._refreshTransitionList();
      }
      return;
    }
    if (t.dataset?.bind && t.type !== 'checkbox' && t.tagName !== 'SELECT') {
      this._bind(t);
      if (t.dataset.bind.startsWith('s.details.')) this._refillScript();
      else if (t.dataset.bind === 's.script.text' || t.dataset.bind === 's.script.cta') this._refillScript();
    }
  }

  _onChange(e) {
    const t = e.target;
    if (t.id === 'tg-file') { this._addUploads(t.files); t.value = ''; return; }
    if (t.dataset?.bind) this._bind(t);
  }

  /** data-bind="s.script.text" / "ui.aiPrompt" → write the value into state without repainting. */
  _bind(el) {
    const [root, ...path] = el.dataset.bind.split('.');
    let obj = root === 'ui' ? this.ui : this.s;
    for (let i = 0; i < path.length - 1; i += 1) obj = obj[path[i]];
    obj[path.at(-1)] = el.type === 'checkbox' ? el.checked : el.value;
    this._updateNext();
  }

  _act(act, el) {
    const id = el.dataset.id;
    switch (act) {
      case 'start': this.s.started = true; this.paint(); this.runSearch(true); break;
      case 'decline': this.onCancel(); this.close(); break;
      case 'open-library': this.ui.view = 'library'; this.ui.confirmDeleteId = null; this.paint(); break;
      case 'library-back': this.ui.view = 'start'; this.paint(); break;
      case 'tpl-use': this.useTemplate(id); break;
      case 'tpl-dup': this._dupTemplate(id); break;
      case 'tpl-del': this._deleteTemplate(id); break;
      case 'tpl-mode': this.ui.tplMode = id; this.setPopup(this.ui.popup); break;
      case 'save-open': this.openSave(); break;
      case 'save-confirm': this.saveTemplate(false); break;
      case 'save-confirm-add': this.saveTemplate(true); break;
      case 'safari-accept': this.ui.safariAccepted = true; this.paint(); break;
      case 'tab': this.goTo(Number(el.dataset.step)); break;
      case 'back': this.goBack(); break;
      case 'close': this.onCancel?.(); this.close(); break;
      case 'next': this.goNext(); break;
      case 'provider': this.setProvider(id); break;
      case 'tpl-sub': this.ui.tplSub = id; this.runSearch(true); this._refreshControls(); break;
      case 'tpl-shape': this.ui.tplShape = id; this.runSearch(true); this._refreshControls(); break;
      case 'filter': this.ui.filter = id; this.ui.tplSub = 'all'; this.ui.collectionId = null; this.runSearch(true); this._refreshControls(); break;
      case 'load-more': this.ui.page += 1; this.runSearch(false); break;
      case 'collection': this.ui.collectionId = id; this.ui.collectionTitle = el.dataset.title || ''; this.runSearch(true); break;
      case 'collections-back': this.ui.collectionId = null; this.runSearch(true); break;
      case 'pick-video': this.pickVideo(id); break;
      case 'preview-video': this.setPopup({ kind: this.itemsById.get(id)?.kind === 'animation' ? 'animation' : 'video', id }); break;
      case 'remove-video': this.removeVideo(id); break;
      case 'remove-animation': this.removeAnimation(id); break;
      case 'popup-close': case 'popup-backdrop': this.setPopup(null); break;
      case 'popup-use': this.pickVideo(id); this.setPopup(null); break;
      case 'popup-use-script': this.pickScript(id); this.setPopup(null); break;
      case 'upload-click': this.overlay.querySelector('#tg-file')?.click(); break;
      case 'remote-add': this.addRemote(); break;
      case 'ai-generate': this.runAiImage(); break;
      case 'niche': this.ui.scriptNiche = id; this.paint(); break;
      case 'script-pick': this.pickScript(id); break;
      case 'script-preview': this.setPopup({ kind: 'script', id }); break;
      case 'ai-script': this.runScriptAction(el.dataset.kind); break;
      case 'use-template-script': this._applyTemplateScript(true); this.paint(); break;
      case 'overlay-tab': this.ui.overlayTab = id; this.paint(); break;
      case 'transition-cat': this.ui.overlayCategory = id; this.paint(); break;
      case 'transition-pick': this.pickTransition(id); break;
      case 'panel-toggle': this.ui.openPanels[id] = !this.ui.openPanels[id]; this.paint(); break;
      default: break;
    }
  }

  // --------------------------------------------------------------- wizard

  goTo(target) {
    if (target === this.s.step) return;
    if (target > this.s.step || target === STEPS.PREVIEW) {
      const warn = guardStep(this.s, target);
      if (warn) { this.toast(warn); return; }
    }
    this.s.step = target;
    this.paint();
    if (target === STEPS.VIDEO && !this.ui.results.length && !this.ui.loading) this.runSearch(true);
  }

  goBack() {
    const { step } = this.s;
    if (step <= STEPS.VIDEO) return;
    // Mirror Next: Overlay is skipped when there are fewer than 2 clips.
    this.goTo(step === STEPS.PREVIEW && this.s.selectedVideos.length < 2 ? STEPS.SCRIPT : step - 1);
  }

  async goNext() {
    const { step } = this.s;
    if (this.ui.busy || nextDisabled(this.s, step)) return;
    if (step === STEPS.PREVIEW) { await this.addToTimeline(); return; }
    const target = nextStepIndex(this.s, step);
    const warn = guardStep(this.s, target);
    if (warn) { this.toast(warn); return; }
    this.s.step = target;
    this.paint();
  }

  pickVideo(id) {
    const it = this.itemsById.get(id);
    if (!it) return;
    if (it.status === 'uploading') { this.toast('That file is still uploading — one moment.'); return; }
    const res = it.kind === 'animation' ? toggleAnimation(this.s, it) : toggleVideo(this.s, it);
    if (!res.ok) { this.toast(res.message); return; }
    this._refreshSelection();
  }

  removeAnimation(id) {
    const i = this.s.selectedAnimations.findIndex((a) => a.id === id);
    if (i < 0) return;
    this.s.selectedAnimations.splice(i, 1);
    if (this.s.step === STEPS.VIDEO) this._refreshSelection(); else this.paint();
  }

  removeVideo(id) {
    const i = this.s.selectedVideos.findIndex((v) => v.id === id);
    if (i < 0) return;
    this.s.selectedVideos.splice(i, 1);
    if (this.s.step === STEPS.PREVIEW && this.s.selectedVideos.length < 2) this.s.selectedTransition = null;
    this.paint();
  }

  pickScript(id) {
    const t = ALL_NICHE_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    this.s.selectedScript = this.s.selectedScript?.id === id ? null : t;
    if (this.s.selectedScript) this._applyTemplateScript(false);
    this.paint();
  }

  /**
   * Put the template's written script (with the user's details filled in) into the editor. Only when the text is empty or is
   * still exactly what we filled in last time; `force` replaces whatever is there (the "Use written script" button).
   */
  _applyTemplateScript(force) {
    const t = this.s.selectedScript;
    const ts = t && templateScript(t.id, this.s.details);
    if (!ts) return false;
    const sc = this.s.script;
    const untouched = !sc.text.trim() || sc.text === this.s.autoText;
    if (!force && !untouched) return false;
    sc.text = ts.text; this.s.autoText = ts.text;
    if (force || !sc.cta.trim() || sc.cta === this.s.autoCta) sc.cta = ts.cta;
    this.s.autoCta = ts.cta;
    return true;
  }

  placeholderHint() {
    const left = placeholdersLeft(`${this.s.script.text} ${this.s.script.cta}`);
    return left.length ? `Fill in your details above to replace ${left.join(', ')}.` : '';
  }

  /** The details changed: re-fill an untouched written script in place (no repaint, so typing keeps its focus). */
  _refillScript() {
    if (this._applyTemplateScript(false)) {
      const ta = this.overlay?.querySelector('#tg-script-text'); if (ta) ta.value = this.s.script.text;
      const cta = this.overlay?.querySelector('#tg-script-cta'); if (cta) cta.value = this.s.script.cta;
    }
    const hint = this.overlay?.querySelector('#tg-placeholders');
    if (hint) { const msg = this.placeholderHint(); hint.textContent = msg; hint.hidden = !msg; }
  }

  pickTransition(id) {
    this.s.selectedTransition = id ? { type: id, duration: 1 } : null;
    this._refreshTransitionList();
    this._updateNext();
  }

  // --------------------------------------------------------- partial updates

  _setHTML(sel, html) { const el = this.overlay?.querySelector(sel); if (el) el.innerHTML = html; }

  _refreshTransitionList() { this.paint(); }

  _refreshControls() { this._setHTML('#tg-step', this.renderStep()); }

  paintList() {
    this._hoverStop();
    this._setHTML('#tg-list', this.renderProviderList());
    this._observeMore();
    const q = this.overlay?.querySelector('#tg-query');
    if (q && q !== document.activeElement) q.value = this.ui.query;
  }

  /** Selection changed on the Video step: update cards, counter, strip and Next without losing scroll/focus. */
  _refreshSelection() {
    const clips = this.s.selectedVideos.map((v) => v.id);
    const sel = new Set([...clips, ...this.s.selectedAnimations.map((a) => a.id)]);
    this.overlay?.querySelectorAll('.video-tile[data-id]').forEach((card) => {
      const on = sel.has(card.dataset.id);
      card.classList.toggle('active', on);
      card.setAttribute('aria-pressed', String(on));
      const mark = card.querySelector('.preview__select');
      const label = card.classList.contains('tg-anim') ? '✓' : String(clips.indexOf(card.dataset.id) + 1);
      if (on && !mark) card.insertAdjacentHTML('afterbegin', `<span class="preview__select" aria-hidden="true">${label}</span>`);
      else if (on && mark) mark.textContent = label;
      if (!on && mark) mark.remove();
    });
    const count = this.overlay?.querySelector('#tg-count');
    if (count) count.textContent = this.countText();
    this._setHTML('#tg-tray', this.renderSelectedStrip());
    this._updateNext();
  }

  /** Auto-load the next page when "Load more" scrolls into view. */
  _observeMore() {
    this._moreObserver?.disconnect?.();
    const btn = this.overlay?.querySelector('.tg-more');
    if (!btn || typeof IntersectionObserver === 'undefined') return;
    this._moreObserver = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !this.ui.loading) { this._moreObserver.disconnect(); btn.click(); }
    }, { root: this.overlay.querySelector('.generator-list.video-list'), rootMargin: '200px' });
    this._moreObserver.observe(btn);
  }

  _updateNext() {
    const btn = this.overlay?.querySelector('#tg-next');
    if (!btn) return;
    const disabled = nextDisabled(this.s, this.s.step, this.ui.busy);
    btn.disabled = disabled;
    btn.classList.toggle('disabled', disabled);
    btn.textContent = this.ui.busy ? 'Adding…' : `${nextLabel(this.s.step)}${this.s.step === STEPS.PREVIEW ? '' : ' →'}`;
    const sum = this.overlay?.querySelector('#tg-summary');
    if (sum) sum.innerHTML = this.renderSummary();
    const save = this.overlay?.querySelector('#tg-save');
    if (save) save.disabled = disabled;
  }

  toast(message) {
    this.ui.toast = message;
    this._showToast(message);
  }

  _showToast(message, keep = false) {
    const el = this.overlay?.querySelector('#tg-toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
    clearTimeout(this._toastTimer);
    if (!keep || message) this._toastTimer = setTimeout(() => { this.ui.toast = ''; el.hidden = true; }, 4500);
  }

  // ------------------------------------------------------------ providers

  setProvider(id) {
    if (this.ui.provider === id) return;
    this.ui.provider = id;
    this.ui.filter = 'all';
    this.ui.tplSub = 'all';
    this.ui.collectionId = null;
    this.ui.error = null;
    this.paint();
    if (id === 'templates' || id === 'pixabay' || id === 'pexels' || this.extra.has(id)) this.runSearch(true);
  }

  async runSearch(reset = true) {
    const u = this.ui;
    if (u.provider === 'library') { this.paintList(); return; }
    const x = this.extra.get(u.provider);
    if (u.provider !== 'templates' && u.provider !== 'pixabay' && u.provider !== 'pexels' && !x) return;
    if (reset) { u.page = 1; u.results = []; u.collections = null; }
    const token = ++this._searchToken;
    u.loading = true;
    u.error = null;
    this.paintList();
    let res;
    if (u.provider === 'templates') {
      try {
        const first = !u.tplCatalog;
        u.tplCatalog = await this.templateCatalog();
        if (first && token === this._searchToken) this._refreshControls();
        res = searchTemplateClips(u.tplCatalog, { query: u.query, category: u.filter, subcategory: u.tplSub, orientation: u.tplShape, page: u.page });
      } catch (err) { res = { items: [], hasMore: false, error: `${err?.message || 'The video templates could not be loaded'}. Check your connection and try again.` }; }
    } else if (x) {
      try { res = await x.search({ query: u.query.trim(), filter: u.filter, page: u.page }); } catch (err) { res = { items: [], hasMore: false, error: err?.message || `${x.label} could not be loaded` }; }
    } else res = await this.stock({ source: u.provider, filter: u.filter, query: u.query, page: u.page, collectionId: u.collectionId });
    if (token !== this._searchToken) return; // a newer search replaced this one
    u.loading = false;
    if (res.error) u.error = res.error;
    if (res.collections) u.collections = res.collections;
    const seen = new Set(u.results.map((i) => i.id));
    let added = 0;
    for (const it of res.items || []) if (!seen.has(it.id)) { u.results.push(it); this.itemsById.set(it.id, it); added += 1; }
    // A page of nothing new means the provider has run out: stop (also stops auto-load looping).
    u.hasMore = !!res.hasMore && (reset || added > 0);
    this.paintList();
  }

  // Upload ---------------------------------------------------------------

  async _addUploads(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const u = this.ui;
    for (const file of files) {
      const kind = kindFromUrlOrType(file.name, file.type);
      if (!kind) { u.uploadStatus = `"${file.name}" isn't a video or image.`; this.paint(); continue; }
      const limit = UPLOAD_LIMITS[kind];
      if (file.size > limit) { u.uploadStatus = `"${file.name}" is too large (max ${Math.round(limit / 1048576)} MB for ${kind}s).`; this.paint(); continue; }
      const local = URL.createObjectURL(file);
      const meta = kind === 'video' ? await probeVideo(local) : {};
      const item = {
        id: `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        kind, source: 'upload', title: file.name.replace(/\.[^.]+$/, ''), url: local, preview: local,
        poster: kind === 'image' ? local : '', duration: meta.duration || 0, width: meta.width, height: meta.height,
        user: '', pageURL: '', status: 'uploading',
      };
      u.uploads.unshift(item);
      this.itemsById.set(item.id, item);
      u.uploadStatus = `Uploading ${file.name}…`;
      this.paint();
      try {
        const userId = typeof window !== 'undefined' ? window.Clerk?.user?.id : undefined;
        const { url } = await uploadFileToSupabase(file, { category: kind, ...(userId ? { userId } : {}) });
        item.url = url;
        item.preview = url;
        if (kind === 'image') item.poster = url;
        item.status = 'ready';
        u.uploadStatus = `${file.name} uploaded.`;
      } catch (err) {
        u.uploads = u.uploads.filter((x) => x !== item);
        u.uploadStatus = `Couldn't upload ${file.name}${err?.message ? ` — ${err.message}` : ''}`;
      }
      this.paint();
    }
  }

  // Remote URL -------------------------------------------------------------

  async addRemote() {
    const input = this.overlay?.querySelector('#tg-remote-url');
    const value = input ? input.value : this.ui.remoteUrl;
    this.ui.remoteUrl = value;
    const res = await remoteItem(value);
    if (res.error) { this.ui.remoteError = res.error; this.paint(); return; }
    this.ui.remoteError = '';
    this.ui.remoteUrl = '';
    this.ui.remoteItems.unshift(res.item);
    this.itemsById.set(res.item.id, res.item);
    this.paint();
  }

  // AI image ---------------------------------------------------------------

  async runAiImage() {
    const u = this.ui;
    const input = this.overlay?.querySelector('#tg-ai-prompt');
    if (input) u.aiPrompt = input.value;
    if (!u.aiPrompt.trim()) { u.aiError = 'Describe the image first.'; this.paint(); return; }
    u.aiLoading = true;
    u.aiError = '';
    this.paint();
    try {
      const res = await generateImage({ prompt: u.aiPrompt.trim(), niche: this.s.selectedScript?.niche, aspectRatio: '16:9', n: 2 });
      if (!res.ok) throw new Error(res.error || 'Image generation failed');
      for (const a of res.assets || []) {
        const item = {
          id: a.id || `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'image', source: 'ai', title: (a.prompt || u.aiPrompt).slice(0, 48), url: a.url, preview: a.url, poster: a.url,
          duration: 0, width: a.width, height: a.height, user: '', pageURL: '',
        };
        u.aiResults.unshift(item);
        this.itemsById.set(item.id, item);
      }
    } catch (err) {
      u.aiError = err.message || 'Image generation failed';
    }
    u.aiLoading = false;
    this.paint();
  }

  // AI script --------------------------------------------------------------

  /** The scenes the AI writes for: the template's own, else one per picked clip (5 when none are picked yet). */
  aiScenes() {
    const sc = this.s.selectedScript;
    if (sc?.sceneStructure?.length) return sc.sceneStructure;
    const base = ['Opening hook', 'What we do', 'Why choose us', 'Proof or highlight', 'Closing line'];
    const n = this.s.selectedVideos.length || 5;
    return Array.from({ length: n }, (_, i) => base[i] || `Highlight ${i - 3}`);
  }

  aiDuration(sc, sceneCount) {
    const d = sc && (typeof sc.duration === 'string' ? (() => { try { return JSON.parse(sc.duration); } catch { return null; } })() : sc.duration);
    return Number(d?.default) || Math.round(sceneCount * 8);
  }

  async runScriptAction(kind) {
    const fns = { generate: generateScript, rewrite: rewriteScript, shorten: shortenScript, expand: expandScript };
    const fn = fns[kind];
    if (!fn) return;
    const text = this.overlay?.querySelector('#tg-script-text');
    if (text) this.s.script.text = text.value;
    this.ui.scriptBusy = kind;
    this.ui.scriptError = '';
    this.paint();
    try {
      const sc = this.s.selectedScript;
      const scenes = this.aiScenes();
      const result = await fn({
        niche: sc?.niche || null,
        existingScript: this.s.script.text,
        tone: this.s.script.tone,
        audience: this.s.script.audience,
        // the CTA is shown separately; the AI must not repeat it inside the lines, and must not be fed our [Your …] reminders
        cta: this.s.script.cta.includes('[Your') ? '' : this.s.script.cta,
        templateContext: sc ? { name: sc.name, description: sc.description } : undefined,
        personalizationEnabled: this.s.personalization.enabled,
        scenes,
        business: { ...this.s.details },
        duration: this.aiDuration(sc, scenes.length),
      });
      if (!result.ok) throw new Error(result.error || 'The script service failed');
      // one line per scene, so each line lands on its own clip as a caption
      this.s.script.text = normalizeSceneLines(result.text, scenes.length).join('\n');
      this.s.autoText = '';
    } catch (err) {
      this.ui.scriptError = err.message || 'The script service failed';
    }
    this.ui.scriptBusy = '';
    this.paint();
  }

  // ----------------------------------------------------------------- player

  _mountPlayer() {
    this._destroyPlayer();
    const pl = this._playlist || [];
    const captions = [];
    const st = this.s;
    const lines = toBuilderState(st).overlays.filter((o) => o.type === 'caption');
    lines.forEach((c, i) => captions.push({ index: i, text: c.text }));
    this._player = createPreviewPlayer(this.overlay, pl, { captions });
  }

  _destroyPlayer() {
    if (this._player) { this._player.destroy(); this._player = null; }
  }

  // -------------------------------------------------------------- timeline

  /** Pixabay photos can't be hotlinked, AI images may be base64, local blobs vanish: store them first. */
  async _ensureDurable(item) {
    const needs = item.mustCopy || /^data:|^blob:/i.test(item.url);
    if (!needs) return item;
    try {
      const blob = await (await fetch(item.url)).blob();
      const ext = (blob.type.split('/')[1] || 'png').split('+')[0];
      const file = new File([blob], `${item.id}.${ext}`, { type: blob.type || 'image/png' });
      const { url } = await uploadFileToSupabase(file, { category: item.kind === 'video' ? 'video' : 'image' });
      return { ...item, url, preview: url, poster: item.poster === item.url ? url : item.poster };
    } catch {
      // Keep the original link rather than blocking the template; the clip may stop loading later.
      return item;
    }
  }

  /** Ask each animation's source for the real overlay it adds to the timeline (done at add time, never stored). */
  async _resolveAnimations() {
    const payloads = {}; const failed = [];
    for (const a of this.s.selectedAnimations) {
      const src = this.extra.get(a.source);
      try { if (!src?.resolve) throw new Error('unavailable'); payloads[a.id] = await src.resolve(a); } catch { failed.push(a.title); }
    }
    if (failed.length) this.toast(`${failed.length} animation${failed.length === 1 ? '' : 's'} couldn’t be added (${failed.slice(0, 2).join(', ')}${failed.length > 2 ? '…' : ''}).`);
    return payloads;
  }

  // ---------------------------------------------------- saved templates

  /** Open a saved template in the wizard (on the Video step, so footage can be swapped). */
  useTemplate(id) {
    const rec = this.store.get(id);
    if (!rec) { this.toast('That template no longer exists.'); return; }
    this.s = restoreTemplate(rec, (sid) => ALL_NICHE_TEMPLATES.find((x) => x.id === sid) || null);
    for (const c of this.s.selectedVideos) this.itemsById.set(c.id, c);
    // Animations come from the editor that opened the generator; ones this editor doesn't offer are set aside.
    const unavailable = this.s.selectedAnimations.filter((a) => !this.extra.has(a.source));
    this.s.selectedAnimations = this.s.selectedAnimations.filter((a) => this.extra.has(a.source));
    this.ui.tplDesc = rec.description || '';
    this.ui.tplName = rec.name;
    this.ui.view = 'start';
    this.ui.results = [];
    this.paint();
    this.runSearch(true);
    this.toast(unavailable.length ? `Opened “${rec.name}”. ${unavailable.length} animation${unavailable.length === 1 ? '' : 's'} from it need the Timeline Studio editor and were left out.` : `Opened “${rec.name}”. Swap footage or edit anything, then add it to the timeline.`);
  }

  _dupTemplate(id) {
    try {
      const copy = this.store.duplicate(id);
      this.ui.confirmDeleteId = null;
      this.paint();
      this.toast(copy ? `Duplicated as “${copy.name}”.` : 'That template no longer exists.');
    } catch (err) { this.toast(err.message); }
  }

  _deleteTemplate(id) {
    if (this.ui.confirmDeleteId !== id) { this.ui.confirmDeleteId = id; this._setHTML('#tg-lib-grid', this.renderLibraryCards()); return; }
    this.ui.confirmDeleteId = null;
    this.store.remove(id);
    this.paint();
    this.toast('Template deleted.');
  }

  openSave() {
    if (nextDisabled(this.s, STEPS.PREVIEW, this.ui.busy)) { this.toast(guardStep(this.s, STEPS.PREVIEW) || 'Add at least one clip and a script first.'); return; }
    this.ui.tplName = this.s.templateName || this.s.selectedScript?.name || this.s.niche || '';
    if (!this.s.templateId) this.ui.tplDesc = '';
    this.ui.tplMode = this.s.templateId ? 'update' : 'new';
    this.setPopup({ kind: 'save' });
    setTimeout(() => this.overlay?.querySelector('#tg-tpl-name')?.focus(), 30);
  }

  /** Save the wizard as a reusable template (optionally add it to the timeline straight away). */
  async saveTemplate(andAdd = false) {
    if (this.ui.busy) return;
    this.ui.busy = true;
    this._updateNext();
    try {
      const durable = [];
      for (const it of this.s.selectedVideos) durable.push(await this._ensureDurable(it));
      const snap = snapshotTemplate({ ...this.s, selectedVideos: durable }, { name: this.ui.tplName, description: this.ui.tplDesc });
      const dropped = this.s.selectedVideos.length - snap.clipCount;
      const rec = this.store.save(snap, { id: this.ui.tplMode === 'update' ? this.s.templateId : null });
      this.s.templateId = rec.id;
      this.s.templateName = rec.name;
      this.ui.popup = null;
      this.ui.busy = false;
      this.toast(dropped ? `Saved “${rec.name}” — ${dropped} clip${dropped === 1 ? '' : 's'} that can’t be reused ${dropped === 1 ? 'was' : 'were'} left out.` : `Saved “${rec.name}” to My templates.`);
      if (andAdd) await this.addToTimeline(); else this.paint();
    } catch (err) {
      this.ui.busy = false;
      this._updateNext();
      this.toast(err.message || 'Could not save the template.');
    }
  }

  async addToTimeline() {
    this.ui.busy = true;
    this._updateNext();
    try {
      const durable = [];
      for (const it of this.s.selectedVideos) durable.push(await this._ensureDurable(it));
      const payloads = await this._resolveAnimations();
      const state = toBuilderState({ ...this.s, selectedVideos: durable }, payloads);
      const composition = buildCompositionFromState(state);
      composition.name = this.s.selectedScript?.name || composition.name;

      for (const track of composition.tracks) {
        for (const clip of track.clips) {
          if (clip.asset && !clip.assetId) clip.asset = normalizeAsset(clip.asset);
        }
      }

      const payload = {
        action: 'add-to-timeline',
        composition,
        sceneStructure: sceneNames(this.s),
        mediaByScene: state.mediaByScene,
        source: 'template-generator',
      };
      if (this.timelineApi) {
        const result = this.timelineApi.applyTemplate(composition);
        this.onConfirm({ ...payload, trackIds: result.trackIds, clipIds: result.clipIds, transitionIds: result.transitionIds, success: true });
      } else {
        this.onConfirm(payload);
      }
      if (this.s.templateId) this.store.touch(this.s.templateId);
      this.ui.busy = false;
      this.close();
    } catch (err) {
      console.error('[TemplateGeneratorModal] Failed to add to timeline:', err);
      this.ui.busy = false;
      this._updateNext();
      this.toast(err.message || 'Failed to add the template to the timeline. Please try again.');
      this.onError(err);
    }
  }

  // Compat: a few callers/tests read these.
  get data() { return this.s; }
  get step() { return this.s.step + 1; }
  get hasScriptSelected() { return hasScript(this.s); }
}

export default TemplateGeneratorModal;
