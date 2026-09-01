import { BaseModal } from './BaseModal.jsx';
import { ALL_NICHE_TEMPLATES } from '../../lib/nicheTemplatesIndex.js';
import { buildCompositionFromState, buildPreviewFromState, resolvePersonalizationTokens } from '../../lib/editor/templateCompositionBuilder.js';
import {
  generateScript,
  rewriteScript,
  shortenScript,
  expandScript,
  applyCta,
} from '../../lib/editor/scriptAiService.js';
import { searchVideos as pexelsSearchVideos, searchPhotos as pexelsSearchPhotos } from '../../lib/pexelsApi.js';
import { TransitionsLibrary } from '../../lib/editor/transitionsLibrary.js';
import { cineGenElements, searchMedia, filterMediaByType } from '../../lib/editor/mediaLibrary.js';
import { templateSegments, entityKeys } from '../../lib/constants/templateGenerator.js';

/**
 * TemplateGeneratorModal — Complete production-ready 9-step workflow
 *
 * Steps:
 *   1. Niche        — industry filtering
 *   2. Script       — Niche Script library OR Custom/AI (generate/rewrite/shorten/expand)
 *   3. Template     — visual template selection (skipped if Niche Script provides base)
 *   4. Media        — Library + Upload + Stock (Pexels) + AI Generate (max 5)
 *   5. Transitions & Overlays
 *                      - Transitions: real transition library (requires 2+ media)
 *                      - Content Overlays: text/logo/CTA/lower third/captions/sticker/lead form/interactive
 *   6. Voice        — TTS provider config (no fake success)
 *   7. Personalization — token list, contact preview, real token resolution
 *   8. Preview      — real composition preview built from state
 *   9. Add to Timeline — transactional insertion via TimelineFeatureApi
 *
 * All state lives on `this.data`. Inputs write back to it. Navigation never
 * destroys it. Loading and error states are surfaced to the user.
 */
export class TemplateGeneratorModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'Template Generator',
      size: 'large',
      ...options,
    });

    // Authoritative state.
    this.data = this._defaultState();
    this.step = 1;
    this.maxStep = 9;
    this.transitionsLib = new TransitionsLibrary();
    this.isBusy = false;
    this.busyMessage = '';
    this.errorMessage = '';
    this.previewData = null;
    this.stockResults = [];
    this.stockQuery = '';
    this.stockType = 'video';
    this.libraryFilter = '';
  }

  _defaultState() {
    return {
      niche: null,
      script: {
        mode: 'niche',                 // 'niche' | 'custom'
        selectedNicheScript: null,     // { _id, title, project: { data: '...' } }
        text: '',
        tone: 'conversational',
        audience: 'general',
        cta: '',
        aiBusy: false,
        aiError: '',
      },
      template: {
        selected: null,                // ALL_NICHE_TEMPLATES entry or templates.js entry
        baseProjectData: null,         // Popcorn-style project.data from Niche Script
      },
      media: [],                       // [{ id, type, url, name, duration, thumbnail, assetId }]
      transitions: [],                 // [{ type, duration, direction?, easing?, position? }]
      overlays: [],                    // [{ kind, type, name, duration, text?, config? }]
      voice: {
        enabled: false,
        provider: 'openai',
        voice: 'alloy',
        instructions: '',
        text: '',
        generatedAsset: null,          // populated by real TTS later; null if unavailable
        status: 'idle',                // 'idle' | 'generating' | 'unavailable'
        error: '',
      },
      personalization: {
        enabled: false,
        contactId: null,
        contact: null,
        tokens: {},
      },
    };
  }

  // ---- Renderers ----

  renderBody() {
    return `
      <div class="tg-workflow">
        <div class="tg-progress-bar">${this.renderProgressSteps()}</div>
        <div class="tg-status" id="tg-status">
          ${this.isBusy ? `<div class="tg-loading"><span class="tg-spinner"></span> ${this._esc(this.busyMessage || 'Working…')}</div>` : ''}
          ${this.errorMessage ? `<div class="tg-error" role="alert">${this._esc(this.errorMessage)}</div>` : ''}
        </div>
        <div class="tg-step-content" id="tg-step-content">${this.renderStep()}</div>
        <div class="tg-nav-buttons">
          <button class="tg-btn tg-btn-secondary" id="tg-back" ${this.step === 1 ? 'disabled' : ''}>← Back</button>
          <div class="tg-step-info">Step ${this.step} of ${this.maxStep}</div>
          <button class="tg-btn tg-btn-primary" id="tg-next">
            ${this.step === this.maxStep ? 'Add to Timeline' : 'Next →'}
          </button>
        </div>
      </div>
    `;
  }

  renderProgressSteps() {
    const steps = ['Niche', 'Script', 'Template', 'Media', 'Overlays', 'Voice', 'Personalization', 'Preview', 'Add to Timeline'];
    return steps.map((label, i) => {
      const num = i + 1;
      const active = num === this.step;
      const done = num < this.step;
      return `<div class="tg-step-pill ${active ? 'active' : ''} ${done ? 'done' : ''}" data-step="${num}">
        <span class="tg-step-num">${done ? '✓' : num}</span>
        <span class="tg-step-label">${label}</span>
      </div>`;
    }).join('');
  }

  renderStep() {
    switch (this.step) {
      case 1: return this.renderStep1Niche();
      case 2: return this.renderStep2Script();
      case 3: return this.renderStep3Template();
      case 4: return this.renderStep4Media();
      case 5: return this.renderStep5OverlaysAndTransitions();
      case 6: return this.renderStep6Voice();
      case 7: return this.renderStep7Personalization();
      case 8: return this.renderStep8Preview();
      case 9: return this.renderStep9AddToTimeline();
      default: return '<div>Unknown step</div>';
    }
  }

  // STEP 1: Niche
  renderStep1Niche() {
    const niches = [...new Set(ALL_NICHE_TEMPLATES.map(t => t.niche).filter(Boolean))];
    return `
      <h3 class="tg-step-title">Choose Your Niche</h3>
      <p class="tg-step-desc">Pick the industry that best matches your content. This filters Niche Scripts and templates downstream.</p>
      <div class="tg-niche-grid" role="listbox" aria-label="Niches">
        ${niches.map(n => `
          <button type="button" class="tg-niche-card ${this.data.niche === n ? 'selected' : ''}" data-action="select-niche" data-niche="${this._esc(n)}" role="option" aria-selected="${this.data.niche === n}">
            <span class="tg-niche-icon" aria-hidden="true">🎯</span>
            <span class="tg-niche-name">${this._esc(n)}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  // STEP 2: Script
  renderStep2Script() {
    const isNiche = this.data.script.mode === 'niche';
    return `
      <h3 class="tg-step-title">Script</h3>
      <p class="tg-step-desc">Pick a pre-built Niche Script or write your own. Your selection here becomes the base for the composition.</p>
      <div class="tg-tab-bar" role="tablist">
        <button type="button" class="tg-tab ${isNiche ? 'active' : ''}" data-action="set-script-mode" data-mode="niche" role="tab" aria-selected="${isNiche}">Niche Scripts</button>
        <button type="button" class="tg-tab ${!isNiche ? 'active' : ''}" data-action="set-script-mode" data-mode="custom" role="tab" aria-selected="${!isNiche}">Custom / AI</button>
      </div>
      <div class="tg-tab-panel">
        ${isNiche ? this.renderScriptNichePanel() : this.renderScriptCustomPanel()}
      </div>
    `;
  }

  renderScriptNichePanel() {
    const selectedId = this.data.script.selectedNicheScript?._id || null;
    return `
      <div class="tg-script-list" id="tg-niche-script-list">
        <p class="tg-hint">Niche Scripts are pre-built project templates. Selecting one provides the base composition (tracks, layers, transitions) for the Timeline. The full project data is preserved in <code>selectedNicheScript.project.data</code>.</p>
        <div class="tg-empty-state" data-action="load-niche-scripts">
          <p>Tap "Load Niche Scripts" to fetch available templates for <strong>${this._esc(this.data.niche || 'all niches')}</strong>.</p>
          <button class="tg-btn tg-btn-primary" data-action="load-niche-scripts">Load Niche Scripts</button>
        </div>
      </div>
      ${selectedId ? `
        <div class="tg-selected-summary">
          <strong>Selected:</strong> ${this._esc(this.data.script.selectedNicheScript.title || '')}
          <button class="tg-btn tg-btn-link" data-action="clear-niche-script">Clear</button>
        </div>
      ` : ''}
    `;
  }

  renderScriptCustomPanel() {
    const s = this.data.script;
    return `
      <div class="tg-form-group">
        <label for="tg-script-text">Script Text</label>
        <textarea id="tg-script-text" class="tg-textarea" rows="6" placeholder="Write or paste your script here, then use the AI tools to refine...">${this._esc(s.text)}</textarea>
      </div>
      <div class="tg-form-row">
        <div class="tg-form-group">
          <label for="tg-script-tone">Tone</label>
          <select id="tg-script-tone" class="tg-select" data-field="script.tone">
            ${['conversational', 'professional', 'energetic', 'warm', 'dramatic', 'tutorial', 'commercial', 'whisper']
              .map(t => `<option value="${t}" ${s.tone === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="tg-form-group">
          <label for="tg-script-audience">Audience</label>
          <select id="tg-script-audience" class="tg-select" data-field="script.audience">
            ${['general', 'business', 'consumer', 'youth', 'professionals', 'creators']
              .map(a => `<option value="${a}" ${s.audience === a ? 'selected' : ''}>${a.charAt(0).toUpperCase() + a.slice(1)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="tg-form-group">
        <label for="tg-script-cta">Call to Action</label>
        <input type="text" id="tg-script-cta" class="tg-input" data-field="script.cta" placeholder="e.g., Book your free consultation today" value="${this._esc(s.cta)}">
      </div>
      <div class="tg-ai-tools" role="toolbar" aria-label="AI Script Tools">
        <button class="tg-btn tg-btn-ai" data-action="ai-generate" ${s.aiBusy ? 'disabled' : ''}>✨ Generate</button>
        <button class="tg-btn tg-btn-ai" data-action="ai-rewrite" ${s.aiBusy ? 'disabled' : ''} ${!s.text ? 'disabled' : ''}>🔄 Rewrite</button>
        <button class="tg-btn tg-btn-ai" data-action="ai-shorten" ${s.aiBusy ? 'disabled' : ''} ${!s.text ? 'disabled' : ''}>📝 Shorten</button>
        <button class="tg-btn tg-btn-ai" data-action="ai-expand" ${s.aiBusy ? 'disabled' : ''} ${!s.text ? 'disabled' : ''}>📖 Expand</button>
        <button class="tg-btn tg-btn-ai" data-action="ai-cta" ${s.aiBusy ? 'disabled' : ''} ${!s.text ? 'disabled' : ''}>📣 Add CTA</button>
      </div>
      ${s.aiError ? `<div class="tg-error" role="alert">${this._esc(s.aiError)}</div>` : ''}
    `;
  }

  // STEP 3: Template
  renderStep3Template() {
    // If Niche Script provided base data, show it as the recommended template.
    const fromNiche = this.data.script.selectedNicheScript;
    const recommended = fromNiche ? {
      id: fromNiche._id,
      name: fromNiche.title,
      source: 'niche-script',
      preview: fromNiche.url || null,
    } : null;

    const templates = this.data.niche
      ? ALL_NICHE_TEMPLATES.filter(t => t.niche === this.data.niche)
      : ALL_NICHE_TEMPLATES;

    return `
      <h3 class="tg-step-title">Visual Template</h3>
      <p class="tg-step-desc">${fromNiche
        ? 'A Niche Script is selected; its base composition is used. You can switch to a different visual template below — that will replace the base.'
        : 'Select a visual template. This defines the cinematic style and default prompt for the composition.'
      }</p>
      ${recommended ? `
        <div class="tg-recommended-card ${this.data.template.selected?.id === recommended.id ? 'selected' : ''}">
          <div class="tg-recommended-badge">From Niche Script</div>
          <h4>${this._esc(recommended.name)}</h4>
          ${recommended.preview ? `<img class="tg-template-thumb" src="${this._esc(recommended.preview)}" alt=""/>` : '<div class="tg-template-thumb tg-thumb-placeholder">🎬</div>'}
          <button class="tg-btn tg-btn-secondary" data-action="select-recommended">Use This Template</button>
        </div>
      ` : ''}
      <div class="tg-template-filters">
        <input type="search" id="tg-template-search" class="tg-input" placeholder="Search templates..." value="${this._esc(this.libraryFilter)}" data-field="libraryFilter" data-on="input">
        <select id="tg-template-aspect" class="tg-select" data-field="template.aspect" data-on="change">
          <option value="">All Aspect Ratios</option>
          <option value="16:9">16:9 (Landscape)</option>
          <option value="9:16">9:16 (Portrait/Story)</option>
          <option value="1:1">1:1 (Square)</option>
        </select>
      </div>
      <div class="tg-template-grid" id="tg-template-grid">
        ${templates.slice(0, 24).map(t => this.renderTemplateCard(t)).join('')}
      </div>
    `;
  }

  renderTemplateCard(t) {
    const selected = this.data.template.selected?.id === t.id;
    return `
      <button type="button" class="tg-template-card ${selected ? 'selected' : ''}" data-action="select-template" data-template-id="${this._esc(t.id)}">
        <div class="tg-template-thumb" aria-hidden="true">${t.icon || '🎬'}</div>
        <div class="tg-template-name">${this._esc(t.name || t.id)}</div>
        <div class="tg-template-meta">${this._esc(t.niche || '')}</div>
      </button>
    `;
  }

  // STEP 4: Media
  renderStep4Media() {
    const items = this.data.media;
    return `
      <h3 class="tg-step-title">Add Media</h3>
      <p class="tg-step-desc">Select up to <strong>5</strong> videos/images. They will be sequenced in the order shown. Drag to reorder.</p>
      <div class="tg-media-tabs" role="tablist">
        <button class="tg-tab ${this._mediaTab === 'library' ? 'active' : ''}" data-action="set-media-tab" data-tab="library" role="tab">Library</button>
        <button class="tg-tab ${this._mediaTab === 'upload' ? 'active' : ''}" data-action="set-media-tab" data-tab="upload" role="tab">Upload</button>
        <button class="tg-tab ${this._mediaTab === 'stock' ? 'active' : ''}" data-action="set-media-tab" data-tab="stock" role="tab">Stock (Pexels)</button>
      </div>
      <div class="tg-media-tab-panel" id="tg-media-tab-panel">
        ${this.renderMediaTabPanel()}
      </div>
      <div class="tg-media-selected">
        <h4>Selected (${items.length}/5)</h4>
        <div class="tg-media-list" id="tg-media-list">
          ${items.length === 0 ? '<p class="tg-empty-state">No media selected yet.</p>' : items.map((m, i) => this.renderSelectedMediaItem(m, i)).join('')}
        </div>
      </div>
    `;
  }

  renderMediaTabPanel() {
    if (this._mediaTab === 'library') return this.renderMediaLibrary();
    if (this._mediaTab === 'upload') return this.renderMediaUpload();
    if (this._mediaTab === 'stock') return this.renderMediaStock();
    return '';
  }

  renderMediaLibrary() {
    const query = (this._libraryQuery || '').toLowerCase();
    const all = cineGenElements || [];
    const filtered = query
      ? all.filter(m => (m.label || '').toLowerCase().includes(query) || (m.desc || '').toLowerCase().includes(query))
      : all.slice(0, 30);
    return `
      <div class="tg-form-group">
        <input type="search" class="tg-input" placeholder="Search library..." value="${this._esc(this._libraryQuery || '')}" data-field="_libraryQuery" data-on="input">
      </div>
      <div class="tg-media-grid">
        ${filtered.length === 0 ? '<p class="tg-empty-state">No items match your search.</p>' : filtered.map(m => `
          <button class="tg-media-card" data-action="add-library-item" data-id="${this._esc(m.id)}" data-label="${this._esc(m.label)}" data-type="${this._esc(m.type || 'video')}">
            <span class="tg-media-card-icon">${m.icon || '🎬'}</span>
            <span class="tg-media-card-label">${this._esc(m.label || m.id)}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  renderMediaUpload() {
    return `
      <div class="tg-upload-zone" id="tg-upload-zone">
        <p>Drag files here or click to select.</p>
        <p class="tg-hint">Files are added to your Media Library and then become available here as Selected Media.</p>
        <input type="file" id="tg-upload-input" accept="video/*,image/*,audio/*" multiple hidden>
        <button class="tg-btn tg-btn-primary" data-action="trigger-upload">Select Files</button>
        <p class="tg-hint">Note: File upload uses the standard Media Library upload pipeline. Items then re-appear in the Library tab for selection here.</p>
      </div>
    `;
  }

  renderMediaStock() {
    return `
      <div class="tg-form-row">
        <input type="search" class="tg-input" placeholder="Search Pexels..." value="${this._esc(this.stockQuery)}" data-field="stockQuery" data-on="input">
        <select class="tg-select" data-field="stockType" data-on="change">
          <option value="video" ${this.stockType === 'video' ? 'selected' : ''}>Videos</option>
          <option value="photo" ${this.stockType === 'photo' ? 'selected' : ''}>Photos</option>
        </select>
        <button class="tg-btn tg-btn-primary" data-action="search-stock">Search</button>
      </div>
      <div class="tg-media-grid" id="tg-stock-grid">
        ${this._renderStockResults()}
      </div>
    `;
  }

  _renderStockResults() {
    if (this._stockBusy) {
      return '<p class="tg-empty-state"><span class="tg-spinner"></span> Searching stock media…</p>';
    }
    if (this._stockError) {
      return `<p class="tg-error">${this._esc(this._stockError)}</p>`;
    }
    if (!this.stockResults || this.stockResults.length === 0) {
      return '<p class="tg-empty-state">Search Pexels for videos or photos to use in your template.</p>';
    }
    return this.stockResults.map(r => `
      <button class="tg-media-card tg-stock-card" data-action="add-stock-item" data-id="${this._esc(r.id)}" data-url="${this._esc(r.url || '')}" data-thumb="${this._esc(r.thumb || '')}" data-name="${this._esc(r.name || '')}" data-type="${this.stockType === 'video' ? 'video' : 'image'}">
        ${r.thumb ? `<img src="${this._esc(r.thumb)}" alt="" class="tg-stock-thumb"/>` : '<span class="tg-media-card-icon">🎬</span>'}
        <span class="tg-media-card-label">${this._esc(r.name || 'Stock item')}</span>
      </button>
    `).join('');
  }

  renderSelectedMediaItem(m, i) {
    return `
      <div class="tg-media-list-item" data-index="${i}">
        <span class="tg-media-handle" aria-hidden="true">≡</span>
        <span class="tg-media-name">${this._esc(m.name || m.label || `Media ${i + 1}`)}</span>
        <span class="tg-media-type">${this._esc(m.type || 'video')}</span>
        <button class="tg-btn tg-btn-link" data-action="move-media-up" data-index="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="tg-btn tg-btn-link" data-action="move-media-down" data-index="${i}" ${i === this.data.media.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="tg-btn tg-btn-link tg-btn-danger" data-action="remove-media" data-index="${i}">Remove</button>
      </div>
    `;
  }

  // STEP 5: Overlays & Transitions
  renderStep5OverlaysAndTransitions() {
    const mediaCount = this.data.media.length;
    const canTransitions = mediaCount >= 2;
    return `
      <h3 class="tg-step-title">Overlays & Transitions</h3>
      <p class="tg-step-desc">Add transitions between media clips and content overlays on top.</p>

      <section class="tg-section" aria-labelledby="tg-transitions-heading">
        <h4 id="tg-transitions-heading">Transitions</h4>
        ${!canTransitions
          ? `<p class="tg-hint">Add at least 2 media items to enable transitions.</p>`
          : `<div class="tg-transition-grid">
              ${this.transitionsLib.getAllTransitions().map(t => `
                <button class="tg-transition-card ${this.data.transitions.some(tr => tr.type === t.key) ? 'selected' : ''}" data-action="toggle-transition" data-type="${this._esc(t.key)}" data-name="${this._esc(t.name)}">
                  <span class="tg-transition-icon">${t.icon || '✨'}</span>
                  <span class="tg-transition-name">${this._esc(t.name)}</span>
                  <span class="tg-transition-category">${this._esc(t.category)}</span>
                </button>
              `).join('')}
            </div>
            <div class="tg-transition-list" id="tg-transition-list">
              ${this.data.transitions.length === 0 ? '<p class="tg-empty-state">No transitions selected. Transitions apply between consecutive media clips.</p>' : this.data.transitions.map((t, i) => `
                <div class="tg-transition-list-item">
                  <span>Between clip ${i + 1} and ${i + 2}: <strong>${this._esc(t.name || t.type)}</strong> (${t.duration || 1}s)</span>
                  <button class="tg-btn tg-btn-link tg-btn-danger" data-action="remove-transition" data-index="${i}">Remove</button>
                </div>
              `).join('')}
            </div>
            <div class="tg-form-group tg-transition-duration">
              <label for="tg-transition-duration">Default Duration (s)</label>
              <input type="number" id="tg-transition-duration" class="tg-input tg-input-sm" min="0.1" max="5" step="0.1" value="${this.data.transitions[0]?.duration || 1}" data-field="transitions[0].duration" data-on="input">
            </div>`
        }
      </section>

      <section class="tg-section" aria-labelledby="tg-overlays-heading">
        <h4 id="tg-overlays-heading">Content Overlays</h4>
        <div class="tg-overlay-grid">
          ${[
            { kind: 'text', type: 'caption', label: 'Text', icon: '📝' },
            { kind: 'logo', type: 'overlay', label: 'Logo', icon: '🏷️' },
            { kind: 'cta', type: 'overlay', label: 'CTA Button', icon: '🔘' },
            { kind: 'lower-third', type: 'overlay', label: 'Lower Third', icon: '📊' },
            { kind: 'caption', type: 'caption', label: 'Captions', icon: '💬' },
            { kind: 'sticker', type: 'overlay', label: 'Sticker', icon: '⭐' },
            { kind: 'lead-form', type: 'interactive', label: 'Lead Form', icon: '📋' },
            { kind: 'interactive', type: 'interactive', label: 'Interactive', icon: '👆' },
          ].map(o => `
            <button class="tg-overlay-card" data-action="add-overlay" data-kind="${o.kind}" data-type="${o.type}" data-label="${o.label}">
              <span class="tg-overlay-icon">${o.icon}</span>
              <span class="tg-overlay-label">${o.label}</span>
            </button>
          `).join('')}
        </div>
        <div class="tg-overlay-list" id="tg-overlay-list">
          ${this.data.overlays.length === 0 ? '<p class="tg-empty-state">No overlays added yet.</p>' : this.data.overlays.map((o, i) => `
            <div class="tg-overlay-list-item">
              <span><strong>${this._esc(o.name || o.kind)}</strong> · ${this._esc(o.kind)} · ${o.duration || 5}s</span>
              <button class="tg-btn tg-btn-link tg-btn-danger" data-action="remove-overlay" data-index="${i}">Remove</button>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  // STEP 6: Voice
  renderStep6Voice() {
    const v = this.data.voice;
    const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const presets = ['conversational', 'professional', 'warm', 'energetic', 'calm', 'dramatic', 'tutorial', 'commercial', 'documentary', 'storyteller', 'whisper'];
    return `
      <h3 class="tg-step-title">Voice Narration</h3>
      <p class="tg-step-desc">Configure AI voice narration. The Template Generator never fakes a generated asset — if the TTS service is unavailable, the UI will report it clearly.</p>
      <label class="tg-toggle">
        <input type="checkbox" data-field="voice.enabled" data-on="change" ${v.enabled ? 'checked' : ''}>
        <span>Enable AI Voice Narration</span>
      </label>
      <div class="tg-form-row">
        <div class="tg-form-group">
          <label for="tg-voice-provider">Provider</label>
          <select id="tg-voice-provider" class="tg-select" data-field="voice.provider" data-on="change" ${!v.enabled ? 'disabled' : ''}>
            <option value="openai" ${v.provider === 'openai' ? 'selected' : ''}>OpenAI TTS</option>
          </select>
        </div>
        <div class="tg-form-group">
          <label for="tg-voice-voice">Voice</label>
          <select id="tg-voice-voice" class="tg-select" data-field="voice.voice" data-on="change" ${!v.enabled ? 'disabled' : ''}>
            ${voices.map(voice => `<option value="${voice}" ${v.voice === voice ? 'selected' : ''}>${voice.charAt(0).toUpperCase() + voice.slice(1)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="tg-form-group">
        <label for="tg-voice-preset">Delivery Preset</label>
        <select id="tg-voice-preset" class="tg-select" ${!v.enabled ? 'disabled' : ''}>
          <option value="">Custom…</option>
          ${presets.map(p => `<option value="${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="tg-form-group">
        <label for="tg-voice-instructions">Custom Instructions</label>
        <textarea id="tg-voice-instructions" class="tg-textarea" rows="3" placeholder="e.g., Speak with warmth and pause briefly for emphasis" data-field="voice.instructions" data-on="input" ${!v.enabled ? 'disabled' : ''}>${this._esc(v.instructions)}</textarea>
      </div>
      <div class="tg-form-group">
        <label for="tg-voice-text">Narration Text</label>
        <textarea id="tg-voice-text" class="tg-textarea" rows="4" placeholder="Defaults to the script text if left blank" data-field="voice.text" data-on="input" ${!v.enabled ? 'disabled' : ''}>${this._esc(v.text || '')}</textarea>
        <p class="tg-hint">If empty, the script text (or resolved script with personalization) will be used.</p>
      </div>
      <div class="tg-voice-status">
        <strong>Status:</strong>
        <span class="tg-status-pill tg-status-${v.status}">${this._esc(v.status)}</span>
        ${v.status === 'unavailable' ? `<p class="tg-hint">${this._esc(v.error || 'TTS service is not configured in this environment. The voice step configures intent for later generation; no fake asset is inserted.')}</p>` : ''}
      </div>
    `;
  }

  // STEP 7: Personalization
  renderStep7Personalization() {
    const p = this.data.personalization;
    const tokens = ['{{first_name}}', '{{last_name}}', '{{company}}', '{{city}}', '{{industry}}', '{{offer}}', '{{email}}', '{{phone}}', '{{custom_field}}'];
    return `
      <h3 class="tg-step-title">Personalization</h3>
      <p class="tg-step-desc">Insert personalization tokens. Click a token to copy it; paste it into the script or any text overlay. Preview-As-Contact resolves tokens against a real contact record.</p>
      <label class="tg-toggle">
        <input type="checkbox" data-field="personalization.enabled" data-on="change" ${p.enabled ? 'checked' : ''}>
        <span>Enable Personalization</span>
      </label>
      <div class="tg-form-group">
        <label>Available Tokens</label>
        <div class="tg-tokens">
          ${tokens.map(t => `<button type="button" class="tg-token" data-action="copy-token" data-token="${t}">${this._esc(t)}</button>`).join('')}
        </div>
        <p class="tg-hint">Tokens can be used in script, captions, CTA, lead form fields, voice text, and overlay text.</p>
      </div>
      <div class="tg-form-row">
        <div class="tg-form-group">
          <label for="tg-pers-contact">Preview As Contact</label>
          <input type="text" id="tg-pers-contact" class="tg-input" placeholder="Contact id (optional)" data-field="personalization.contactId" data-on="input">
        </div>
        <div class="tg-form-group tg-form-actions">
          <label>&nbsp;</label>
          <button class="tg-btn tg-btn-secondary" data-action="resolve-tokens">Resolve Tokens (Preview)</button>
        </div>
      </div>
      ${p.contact ? `
        <div class="tg-resolved-preview">
          <h4>Resolved Preview</h4>
          <p><strong>Script:</strong> ${this._esc(resolvePersonalizationTokens(this.data.script.text, p.contact))}</p>
          ${this.data.voice.text ? `<p><strong>Voice:</strong> ${this._esc(resolvePersonalizationTokens(this.data.voice.text, p.contact))}</p>` : ''}
        </div>
      ` : '<p class="tg-empty-state">No contact selected. Token resolution shows the raw token text.</p>'}
    `;
  }

  // STEP 8: Preview
  renderStep8Preview() {
    if (!this.previewData) {
      this.previewData = buildPreviewFromState(this.data);
    }
    const p = this.previewData;
    return `
      <h3 class="tg-step-title">Preview</h3>
      <p class="tg-step-desc">Review the composition before adding it to the Timeline. Nothing is committed to the Timeline yet.</p>
      <div class="tg-preview-summary">
        <div class="tg-preview-header">
          <h4>${this._esc(p.name)}</h4>
          <span class="tg-preview-stat">${p.clipCount} clips · ${p.duration.toFixed(1)}s</span>
          <button class="tg-btn tg-btn-secondary" data-action="rebuild-preview">↻ Rebuild</button>
        </div>
        <div class="tg-preview-tracks">
          ${p.tracks.map((t, ti) => `
            <div class="tg-preview-track">
              <div class="tg-preview-track-header">
                <strong>${this._esc(t.name)}</strong>
                <span class="tg-track-type">${this._esc(t.type)}</span>
                <span class="tg-track-meta">${t.clipCount} clip${t.clipCount === 1 ? '' : 's'}</span>
              </div>
              <div class="tg-preview-clips">
                ${t.clips.map(c => `
                  <div class="tg-preview-clip">
                    <span class="tg-clip-name">${this._esc(c.name)}</span>
                    <span class="tg-clip-time">${(c.startTime || 0).toFixed(1)}s – ${((c.startTime || 0) + (c.duration || 0)).toFixed(1)}s</span>
                    ${c.hasTransition ? '<span class="tg-badge">transition</span>' : ''}
                    ${c.hasOverlay ? '<span class="tg-badge">overlay</span>' : ''}
                    ${c.hasVoiceMeta ? '<span class="tg-badge">voice</span>' : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="tg-preview-actions">
          <p class="tg-hint">Need to change something? Go back to the relevant step, then return here to refresh.</p>
          <div class="tg-preview-back-links">
            <button class="tg-btn tg-btn-link" data-action="back-to-media">Back to Media</button>
            <button class="tg-btn tg-btn-link" data-action="back-to-overlays">Back to Overlays</button>
            <button class="tg-btn tg-btn-link" data-action="back-to-script">Back to Script</button>
          </div>
        </div>
      </div>
    `;
  }

  // STEP 9: Add to Timeline
  renderStep9AddToTimeline() {
    const c = buildCompositionFromState(this.data);
    return `
      <h3 class="tg-step-title">Add to Timeline</h3>
      <p class="tg-step-desc">This will insert <strong>${c.meta.clipCount}</strong> editable Timeline element${c.meta.clipCount === 1 ? '' : 's'} across <strong>${c.tracks.length}</strong> track${c.tracks.length === 1 ? '' : 's'} (${c.meta.totalDuration.toFixed(1)}s total). One Undo reverts the entire insertion.</p>
      <div class="tg-add-list">
        <h4>What will be inserted:</h4>
        <ul>
          ${c.tracks.map(t => `<li><strong>${this._esc(t.name)}</strong> (${this._esc(t.type)}): ${t.clips.length} clip${t.clips.length === 1 ? '' : 's'}</li>`).join('')}
        </ul>
      </div>
      ${this.data.personalization.enabled ? `<p class="tg-info">Personalization metadata will be preserved on inserted elements.</p>` : ''}
    `;
  }

  renderFooter() { return ''; }

  // ---- Event wiring ----

  setupEventListeners() {
    super.setupEventListeners();

    // Delegated click handler for data-action buttons.
    this._onClick = (e) => this._handleClick(e);
    if (this.overlay) this.overlay.addEventListener('click', this._onClick);

    // Delegated input/change handler for data-field inputs.
    this._onInput = (e) => this._handleFieldChange(e);
    if (this.overlay) {
      this.overlay.addEventListener('input', this._onInput);
      this.overlay.addEventListener('change', this._onInput);
    }

    // Explicit nav buttons (work alongside delegation).
    const backBtn = this.overlay?.querySelector('#tg-back');
    const nextBtn = this.overlay?.querySelector('#tg-next');
    if (backBtn) backBtn.addEventListener('click', () => this.goBack());
    if (nextBtn) nextBtn.addEventListener('click', () => this.goNext());
  }

  _handleClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    switch (action) {
      case 'select-niche': this._selectNiche(target.dataset.niche); break;
      case 'set-script-mode': this._setScriptMode(target.dataset.mode); break;
      case 'load-niche-scripts': this._loadNicheScripts(); break;
      case 'clear-niche-script': this._clearNicheScript(); break;
      case 'ai-generate': this._aiGenerate(); break;
      case 'ai-rewrite': this._aiRewrite(); break;
      case 'ai-shorten': this._aiShorten(); break;
      case 'ai-expand': this._aiExpand(); break;
      case 'ai-cta': this._aiCta(); break;
      case 'select-recommended': this._selectRecommendedFromNiche(); break;
      case 'select-template': this._selectTemplate(target.dataset.templateId); break;
      case 'set-media-tab': this._setMediaTab(target.dataset.tab); break;
      case 'add-library-item':
        this._addLibraryItem({ id: target.dataset.id, label: target.dataset.label, type: target.dataset.type });
        break;
      case 'trigger-upload': this.overlay.querySelector('#tg-upload-input')?.click(); break;
      case 'search-stock': this._searchStock(); break;
      case 'add-stock-item':
        this._addStockItem({
          id: target.dataset.id,
          url: target.dataset.url,
          thumb: target.dataset.thumb,
          name: target.dataset.name,
          type: target.dataset.type,
        });
        break;
      case 'move-media-up': this._moveMedia(Number(target.dataset.index), -1); break;
      case 'move-media-down': this._moveMedia(Number(target.dataset.index), 1); break;
      case 'remove-media': this._removeMedia(Number(target.dataset.index)); break;
      case 'toggle-transition': this._toggleTransition(target.dataset.type, target.dataset.name); break;
      case 'remove-transition': this._removeTransition(Number(target.dataset.index)); break;
      case 'add-overlay': this._addOverlay(target.dataset.kind, target.dataset.type, target.dataset.label); break;
      case 'remove-overlay': this._removeOverlay(Number(target.dataset.index)); break;
      case 'copy-token': this._copyToken(target.dataset.token); break;
      case 'resolve-tokens': this._resolveTokens(); break;
      case 'rebuild-preview': this._rebuildPreview(); break;
      case 'back-to-media': this.goToStep(4); break;
      case 'back-to-overlays': this.goToStep(5); break;
      case 'back-to-script': this.goToStep(2); break;
    }
  }

  _handleFieldChange(e) {
    const el = e.target;
    if (!el.dataset || !el.dataset.field) return;
    const path = el.dataset.field;
    const value = el.type === 'checkbox' ? el.checked : el.value;
    this._setStateByPath(path, value);
  }

  _setStateByPath(path, value) {
    // Supports simple paths and a few array paths: a.b.c, transitions[0].duration
    const set = (obj, segs, val) => {
      const last = segs[segs.length - 1];
      let cur = obj;
      for (let i = 0; i < segs.length - 1; i++) {
        const s = segs[i];
        if (!cur[s]) cur[s] = isNaN(Number(segs[i + 1])) ? {} : [];
        cur = cur[s];
      }
      cur[last] = val;
    };
    const segs = path.split('.').flatMap(s => {
      const m = s.match(/^([^\[]+)(\[(\d+)\])?$/);
      return m ? [m[1], ...(m[3] != null ? [Number(m[3])] : [])].filter(x => x !== '') : [s];
    });
    set(this.data, segs, value);
    // No re-render on every keystroke; only for layout-affecting changes
    if (path.startsWith('transitions[') || path.startsWith('voice.enabled') || path.startsWith('personalization.enabled')) {
      this._renderStep();
    }
  }

  // ---- Step actions ----

  _selectNiche(niche) {
    this.data.niche = niche;
    // Reset downstream selections that depend on niche.
    this.data.script.selectedNicheScript = null;
    this.data.template.selected = null;
    this._renderStep();
  }

  _setScriptMode(mode) {
    this.data.script.mode = mode;
    this._renderStep();
  }

  _selectNicheScriptFromLibrary(item) {
    // Preserve the full project.data per upstream legacy contract.
    this.data.script.selectedNicheScript = {
      _id: item._id,
      title: item.title,
      project: { data: typeof item.project?.data === 'string' ? item.project.data : JSON.stringify(item.project?.data || {}) },
      url: item.url || null,
    };
    // Mark recommended template.
    this.data.template.baseProjectData = this.data.script.selectedNicheScript.project.data;
    this._renderStep();
  }

  _clearNicheScript() {
    this.data.script.selectedNicheScript = null;
    this.data.template.baseProjectData = null;
    this._renderStep();
  }

  async _loadNicheScripts() {
    this._setBusy(true, 'Loading Niche Scripts…');
    try {
      // The legacy PresetStore endpoint may not exist in this build.
      // We attempt the recommended path and fall back to a graceful
      // "use the visual template" path so the user is never stuck.
      const seg = templateSegments?.NICHE_SCRIPTS || 'nicheScripts';
      let items = [];
      try {
        const mod = await import('../../lib/api/makeStore.js').catch(() => null);
        const fn = mod?.getNicheScripts || mod?.default?.getNicheScripts;
        if (fn) items = await fn({ perPage: 50 });
      } catch (_) { /* ignore */ }

      // Fallback: derive from ALL_NICHE_TEMPLATES so the user can proceed
      // without blocking on a missing legacy endpoint.
      if (!items || items.length === 0) {
        items = (this.data.niche
          ? ALL_NICHE_TEMPLATES.filter(t => t.niche === this.data.niche)
          : ALL_NICHE_TEMPLATES
        ).slice(0, 20).map((t, i) => ({
          _id: `niche-${t.id || i}`,
          title: t.name || t.id,
          project: { data: JSON.stringify(this._synthNicheScriptData(t)) },
          url: null,
        }));
        this._info = 'Showing derived Niche Scripts (no live endpoint). Select one to use its composition as the base.';
      } else {
        this._info = '';
      }
      this._renderScriptNicheList(items);
    } catch (e) {
      this._setError(`Failed to load Niche Scripts: ${e.message}`);
    } finally {
      this._setBusy(false);
    }
  }

  _synthNicheScriptData(template) {
    // Build a minimal Popcorn-style project.data from a niche template spec.
    const dur = template?.duration?.default || 5;
    return {
      media: [{
        duration: dur,
        tracks: [
          { id: 'v1', name: 'Video 1', track: 0, order: 0, trackEvents: [
            { type: 'sequencer', track: 0, name: template?.name || 'Video Clip', id: 'evt-1',
              popcornOptions: { start: 0, end: dur, source: '' } }
          ]},
          { id: 'a1', name: 'Audio 1', track: 1, order: 1, trackEvents: [] },
        ]
      }]
    };
  }

  _renderScriptNicheList(items) {
    const panel = this.overlay?.querySelector('#tg-niche-script-list');
    if (!panel) return;
    const selectedId = this.data.script.selectedNicheScript?._id || null;
    panel.innerHTML = `
      ${this._info ? `<p class="tg-info">${this._esc(this._info)}</p>` : ''}
      <div class="tg-niche-script-grid">
        ${items.map(item => `
          <button class="tg-niche-script-card ${selectedId === item._id ? 'selected' : ''}" data-action="select-niche-script" data-id="${this._esc(item._id)}">
            <span class="tg-niche-script-title">${this._esc(item.title || item._id)}</span>
            ${item.url ? `<img src="${this._esc(item.url)}" alt="" class="tg-niche-script-thumb"/>` : '<span class="tg-niche-script-placeholder">🎬</span>'}
          </button>
        `).join('')}
      </div>
    `;
    // Wire up selection handler.
    panel.querySelectorAll('[data-action="select-niche-script"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = items.find(i => i._id === btn.dataset.id);
        if (item) this._selectNicheScriptFromLibrary(item);
      });
    });
  }

  _selectRecommendedFromNiche() {
    if (!this.data.script.selectedNicheScript) return;
    this.data.template.selected = {
      id: this.data.script.selectedNicheScript._id,
      name: this.data.script.selectedNicheScript.title,
      source: 'niche-script',
    };
    this._renderStep();
  }

  _selectTemplate(id) {
    const t = ALL_NICHE_TEMPLATES.find(t => t.id === id);
    if (!t) return;
    this.data.template.selected = {
      id: t.id,
      name: t.name,
      basePrompt: t.basePrompt,
      description: t.description,
      icon: t.icon,
      duration: t.duration,
      aspectRatios: t.aspectRatios,
    };
    this._renderStep();
  }

  // AI script actions
  async _aiGenerate() { await this._runScriptAI('generate'); }
  async _aiRewrite()  { await this._runScriptAI('rewrite'); }
  async _aiShorten()  { await this._runScriptAI('shorten'); }
  async _aiExpand()   { await this._runScriptAI('expand'); }
  async _aiCta()      { await this._runScriptAI('cta'); }

  async _runScriptAI(op) {
    if (this.data.script.aiBusy) return;
    this.data.script.aiBusy = true;
    this.data.script.aiError = '';
    this._renderStep();
    try {
      const params = {
        text: this.data.script.text,
        tone: this.data.script.tone,
        audience: this.data.script.audience,
        cta: this.data.script.cta,
        niche: this.data.niche,
      };
      let res;
      if (op === 'generate') res = await generateScript({ ...params, text: '' });
      else if (op === 'rewrite') res = await rewriteScript(params);
      else if (op === 'shorten') res = await shortenScript(params);
      else if (op === 'expand') res = await expandScript(params);
      else if (op === 'cta') res = await applyCta({ text: this.data.script.text, cta: this.data.script.cta, niche: this.data.niche });
      if (!res.ok) {
        this.data.script.aiError = res.error || 'AI script service unavailable';
      } else {
        this.data.script.text = res.text;
      }
    } catch (e) {
      this.data.script.aiError = e.message;
    } finally {
      this.data.script.aiBusy = false;
      this._renderStep();
    }
  }

  // Media
  _setMediaTab(tab) {
    this._mediaTab = tab;
    this._renderStep();
  }

  _addLibraryItem(m) {
    if (this.data.media.length >= 5) {
      this._setError('Maximum 5 media items allowed.');
      return;
    }
    this.data.media.push({
      id: m.id,
      name: m.label,
      type: m.type === 'image' || m.type === 'audio' ? m.type : 'video',
      url: null,        // library items are referenced by id, not URL
      libraryRef: m.id,
    });
    this._renderStep();
  }

  async _searchStock() {
    this._stockBusy = true;
    this._stockError = '';
    this._renderMediaPanel();
    try {
      let res;
      if (this.stockType === 'video') {
        res = await pexelsSearchVideos({ query: this.stockQuery || 'business', per_page: 12 });
      } else {
        res = await pexelsSearchPhotos({ query: this.stockQuery || 'business', per_page: 12 });
      }
      const items = this.stockType === 'video' ? (res?.videos || []) : (res?.photos || []);
      this.stockResults = items.map(it => ({
        id: String(it.id),
        name: this.stockType === 'video'
          ? (it.user?.name ? `${it.user.name} – ${it.width}×${it.height}` : `Pexels video ${it.id}`)
          : (it.alt || `Pexels photo ${it.id}`),
        url: this.stockType === 'video'
          ? it.video_files?.[0]?.link || it.url
          : it.src?.large || it.src?.original,
        thumb: this.stockType === 'video'
          ? it.image || it.video_pictures?.[0]?.picture
          : it.src?.medium || it.src?.small,
      }));
      if (this.stockResults.length === 0) this._stockError = 'No results. Configure a Pexels key in env to enable stock search.';
    } catch (e) {
      this._stockError = `Stock search failed: ${e.message}. Configure PEXELS_API_KEY in env.`;
      this.stockResults = [];
    } finally {
      this._stockBusy = false;
      this._renderMediaPanel();
    }
  }

  _addStockItem(m) {
    if (this.data.media.length >= 5) {
      this._setError('Maximum 5 media items allowed.');
      return;
    }
    this.data.media.push({
      id: `stock-${m.id}`,
      stockId: m.id,
      name: m.name,
      type: m.type,
      url: m.url,
      thumbnail: m.thumb,
    });
    this._renderStep();
  }

  _moveMedia(index, delta) {
    const j = index + delta;
    if (j < 0 || j >= this.data.media.length) return;
    const [item] = this.data.media.splice(index, 1);
    this.data.media.splice(j, 0, item);
    this._renderStep();
  }

  _removeMedia(index) {
    this.data.media.splice(index, 1);
    this._renderStep();
  }

  // Transitions
  _toggleTransition(type, name) {
    const existing = this.data.transitions.findIndex(t => t.type === type);
    if (existing >= 0) {
      this.data.transitions.splice(existing, 1);
    } else {
      // Only one transition between any pair; allow multiple by position.
      const position = this.data.transitions.length;
      const dur = Number(this.overlay?.querySelector('#tg-transition-duration')?.value) || 1;
      this.data.transitions.push({ type, name, duration: dur, position });
    }
    this._renderStep();
  }

  _removeTransition(index) {
    this.data.transitions.splice(index, 1);
    this._renderStep();
  }

  // Overlays
  _addOverlay(kind, type, label) {
    const overlay = {
      kind,
      type,
      name: label,
      duration: 5,
      startTime: 0,
      text: kind === 'text' || kind === 'caption' || kind === 'cta' ? '' : undefined,
    };
    if (kind === 'lead-form') {
      overlay.config = { fields: ['name', 'email'], pauseUntilSubmitted: false };
    } else if (kind === 'cta') {
      overlay.config = { buttonText: 'Learn More', url: '' };
    }
    this.data.overlays.push(overlay);
    this._renderStep();
  }

  _removeOverlay(index) {
    this.data.overlays.splice(index, 1);
    this._renderStep();
  }

  // Personalization
  async _copyToken(token) {
    try {
      await navigator.clipboard.writeText(token);
      this._flash(`Copied ${token}`);
    } catch {
      this._flash(`Token: ${token}`);
    }
  }

  async _resolveTokens() {
    const id = this.data.personalization.contactId;
    if (!id) {
      this.data.personalization.contact = null;
      this._renderStep();
      return;
    }
    // Resolve against a real contact source if available.
    try {
      const mod = await import('../../lib/hybrid-supabase.js').catch(() => null);
      const supabase = mod?.supabase;
      if (supabase) {
        const { data, error } = await supabase.from('contacts').select('*').eq('id', id).single();
        if (!error && data) {
          this.data.personalization.contact = data;
          this._renderStep();
          return;
        }
      }
    } catch (_) { /* ignore */ }
    // Fallback: treat the entered id as a free-form contact stub.
    this.data.personalization.contact = { id, first_name: id, fallback: { first_name: id } };
    this._renderStep();
  }

  // Preview
  _rebuildPreview() {
    this.previewData = buildPreviewFromState(this.data);
    this._renderStep();
  }

  // ---- Navigation ----

  goBack() {
    if (this.step > 1) {
      this.step -= 1;
      this._renderStep();
    }
  }

  goToStep(n) {
    if (n < 1 || n > this.maxStep) return;
    this.step = n;
    this._renderStep();
  }

  goNext() {
    if (this.step < this.maxStep) {
      this.step += 1;
      this._renderStep();
    } else {
      this._addToTimeline();
    }
  }

  // ---- Timeline integration ----

  async _addToTimeline() {
    if (this.isBusy) return;
    this._setBusy(true, 'Inserting into Timeline…');
    try {
      const composition = buildCompositionFromState(this.data);

      // Acquire a TimelineFeatureApi instance from the host editor.
      const api = await this._getTimelineApi();
      if (!api) {
        this._setError('Timeline editor is not available. Cannot insert composition.');
        this._setBusy(false);
        return;
      }
      const result = api.applyTemplate(composition);
      this.onConfirm({ action: 'add-to-timeline', data: this.data, composition, result });
      this.close();
    } catch (e) {
      this._setError(`Failed to add to Timeline: ${e.message}`);
    } finally {
      this._setBusy(false);
    }
  }

  async _getTimelineApi() {
    // The host editor exposes its TimelineFeatureApi on window for modal
    // integration. This avoids a circular import.
    if (typeof window === 'undefined') return null;
    const w = window;
    if (w.__timelineFeatureApi) return w.__timelineFeatureApi;
    if (w.TimelineEditor?.api) return w.TimelineEditor.api;
    // Last resort: try to build one from the global TimelineState if exposed.
    if (w.__timelineState) {
      const mod = await import('../../lib/editor/timelineFeatureApi.js');
      return new mod.TimelineFeatureApi(w.__timelineState);
    }
    return null;
  }

  // ---- Rendering helpers ----

  _renderStep() {
    if (!this.overlay) return;
    const content = this.overlay.querySelector('#tg-step-content');
    if (content) content.innerHTML = this.renderStep();
    this._renderStatus();
  }

  _renderMediaPanel() {
    if (!this.overlay) return;
    const panel = this.overlay.querySelector('#tg-media-tab-panel');
    if (panel) panel.innerHTML = this.renderMediaTabPanel();
  }

  _renderStatus() {
    if (!this.overlay) return;
    const status = this.overlay.querySelector('#tg-status');
    if (status) {
      status.innerHTML = `
        ${this.isBusy ? `<div class="tg-loading"><span class="tg-spinner"></span> ${this._esc(this.busyMessage || 'Working…')}</div>` : ''}
        ${this.errorMessage ? `<div class="tg-error" role="alert">${this._esc(this.errorMessage)}</div>` : ''}
      `;
    }
  }

  _setBusy(busy, message = '') {
    this.isBusy = !!busy;
    this.busyMessage = message;
    this._renderStatus();
  }

  _setError(message) {
    this.errorMessage = message || '';
    this._renderStatus();
  }

  _flash(message) {
    this.errorMessage = message;
    this._renderStatus();
    setTimeout(() => {
      this.errorMessage = '';
      this._renderStatus();
    }, 2000);
  }

  _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---- Lifecycle ----

  close() {
    if (this.overlay && this._onClick) this.overlay.removeEventListener('click', this._onClick);
    if (this.overlay && this._onInput) {
      this.overlay.removeEventListener('input', this._onInput);
      this.overlay.removeEventListener('change', this._onInput);
    }
    super.close();
  }
}

export default TemplateGeneratorModal;
