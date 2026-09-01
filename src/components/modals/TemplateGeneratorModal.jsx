import { BaseModal } from './BaseModal.jsx';
import { ALL_NICHE_TEMPLATES } from '../../lib/nicheTemplatesIndex.js';
import { generateScript, rewriteScript, shortenScript, expandScript, applyCta, changeTone, changeAudience } from '../../lib/editor/scriptAiService.js';
import { searchPixabay, normalizePixabayImage, normalizePixabayVideo, suggestPixabayQueries } from '../../lib/editor/pixabayService.js';
import { generateImage, aspectRatioToSize, normalizeGeneratedImage, buildScenePromptContext } from '../../lib/editor/aiImageService.js';

/**
 * TemplateGeneratorModal — Full multi-step workflow
 *
 * Replaces the legacy Yes/No shell with a complete 9-step template generation pipeline:
 *   1. Niche selection
 *   2. Script (select legacy / AI generate / rewrite / shorten / expand / tone / CTA)
 *   3. Template (with filters: industry, goal, platform, aspect ratio, duration, style)
 *   4. Media (scene-level: per-scene My Media / Pixabay / AI Generate tabs)
 *   5. Overlays (text, logo, CTA, lower third, captions, stickers, lead form, interactive)
 *   6. Voice (TTS provider abstraction, presets, personalization tokens)
 *   7. Personalization (contact preview, token resolution)
 *   8. Preview (full composition)
 *   9. Add to Timeline (creates editable tracks/clips — never flattens)
 *
 * Uses TimelineFeatureApi for all timeline mutations so undo/redo and history work.
 */
export class TemplateGeneratorModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'Template Generator',
      size: 'large',
      ...options
    });

    this.step = 1;
    this.maxStep = 9;
    this.data = {
      niche: null,
      script: { text: '', tone: 'conversational', audience: 'general', cta: '' },
      template: null,
      selectedTemplate: null,
      media: [],
      mediaByScene: [],       // [{ sceneName: string, sceneIndex: number, media: Asset[], mediaType: 'image'|'video' }]
      overlays: [],
      voice: { enabled: false, provider: 'openai', voice: 'alloy', text: '', instructions: '' },
      personalization: { enabled: false, contactId: null, tokens: {} }
    };

    // Transient UI state for media step
    this._mediaUiState = {
      activeSceneIndex: 0,
      activeTab: 'library',
      pixabayResults: [],
      pixabayQuery: '',
      pixabayLoading: false,
      generatedResults: [],
      generateLoading: false,
      generatePrompt: '',
    };
  }

  renderBody() {
    return `
      <div class="template-gen-workflow">
        <div class="tg-progress-bar">
          ${this.renderProgressSteps()}
        </div>
        <div class="tg-step-content" id="tg-step-content">
          ${this.renderStep()}
        </div>
        <div class="tg-nav-buttons">
          <button class="tg-btn tg-btn-secondary" id="tg-back" ${this.step === 1 ? 'disabled' : ''}>
            ← Back
          </button>
          <div class="tg-step-info">Step ${this.step} of ${this.maxStep}</div>
          <button class="tg-btn tg-btn-primary" id="tg-next" ${this.step === this.maxStep ? 'id="tg-finish"' : ''}>
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
      case 5: return this.renderStep5Overlays();
      case 6: return this.renderStep6Voice();
      case 7: return this.renderStep7Personalization();
      case 8: return this.renderStep8Preview();
      case 9: return this.renderStep9AddToTimeline();
      default: return '<div>Unknown step</div>';
    }
  }

  // Step 1: Niche selection
  renderStep1Niche() {
    const niches = [...new Set(ALL_NICHE_TEMPLATES.map(t => t.niche).filter(Boolean))];
    return `
      <h3>Choose Your Niche</h3>
      <p class="tg-step-desc">Select the industry that best matches your content.</p>
      <div class="tg-niche-grid">
        ${niches.map(n => `
          <button class="tg-niche-card ${this.data.niche === n ? 'selected' : ''}" data-niche="${n}">
            <span class="tg-niche-icon">🎯</span>
            <span class="tg-niche-name">${n}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  // Step 2: Script
  renderStep2Script() {
    return `
      <h3>Write or Generate Your Script</h3>
      <p class="tg-step-desc">Use a legacy script, write your own, or let AI help.</p>
      <div class="tg-script-tools">
        <div class="tg-form-group">
          <label>Script Text</label>
          <textarea id="tg-script-text" class="tg-textarea" rows="6" placeholder="Enter your script here, or use AI tools below...">${this.data.script.text}</textarea>
        </div>
        <div class="tg-form-row">
          <div class="tg-form-group">
            <label>Tone</label>
            <select id="tg-script-tone" class="tg-select">
              ${['conversational', 'professional', 'energetic', 'warm', 'dramatic', 'tutorial', 'commercial']
                .map(t => `<option value="${t}" ${this.data.script.tone === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div class="tg-form-group">
            <label>Audience</label>
            <select id="tg-script-audience" class="tg-select">
              ${['general', 'business', 'consumer', 'youth', 'professionals', 'creators']
                .map(a => `<option value="${a}" ${this.data.script.audience === a ? 'selected' : ''}>${a.charAt(0).toUpperCase() + a.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="tg-form-group">
          <label>Call to Action</label>
          <input type="text" id="tg-script-cta" class="tg-input" placeholder="e.g., Book your free consultation today" value="${this.data.script.cta}">
        </div>
        <div class="tg-ai-tools">
          <button class="tg-btn tg-btn-ai" id="tg-ai-generate">✨ AI Generate</button>
          <button class="tg-btn tg-btn-ai" id="tg-ai-rewrite">🔄 Rewrite</button>
          <button class="tg-btn tg-btn-ai" id="tg-ai-shorten">📝 Shorten</button>
          <button class="tg-btn tg-btn-ai" id="tg-ai-expand">📖 Expand</button>
        </div>
      </div>
    `;
  }

  // Step 3: Template selection with filters
  renderStep3Template() {
    const templates = this.data.niche
      ? ALL_NICHE_TEMPLATES.filter(t => t.niche === this.data.niche)
      : ALL_NICHE_TEMPLATES;
    return `
      <h3>Choose a Template</h3>
      <p class="tg-step-desc">Select a template that fits your content style.</p>
      <div class="tg-template-filters">
        <input type="text" id="tg-template-search" class="tg-input" placeholder="Search templates...">
        <select id="tg-template-aspect" class="tg-select">
          <option value="">All Aspect Ratios</option>
          <option value="16:9">16:9 (Landscape)</option>
          <option value="9:16">9:16 (Portrait/Story)</option>
          <option value="1:1">1:1 (Square)</option>
        </select>
        <select id="tg-template-duration" class="tg-select">
          <option value="">All Durations</option>
          <option value="short">Under 30s</option>
          <option value="medium">30s-60s</option>
          <option value="long">60s+</option>
        </select>
      </div>
      <div class="tg-template-grid" id="tg-template-grid">
        ${templates.slice(0, 12).map(t => `
          <button class="tg-template-card ${this.data.template?.id === t.id ? 'selected' : ''}" data-template-id="${t.id}">
            <div class="tg-template-thumb">${t.thumbnail || '🎬'}</div>
            <div class="tg-template-name">${t.name || t.id}</div>
            <div class="tg-template-meta">${t.niche || ''}</div>
          </button>
        `).join('')}
      </div>
    `;
  }

  /**
   * Get the full template object from ALL_NICHE_TEMPLATES by ID.
   */
  getFullTemplate() {
    if (!this.data.template?.id) return null;
    return ALL_NICHE_TEMPLATES.find(t => t.id === this.data.template.id) || null;
  }

  /**
   * Get the scene structure for the selected template.
   * Falls back to a default 5-scene structure if the template has no sceneStructure.
   */
  getSceneStructure() {
    const tpl = this.getFullTemplate();
    if (tpl?.sceneStructure && Array.isArray(tpl.sceneStructure) && tpl.sceneStructure.length > 0) {
      return tpl.sceneStructure;
    }
    // Default fallback scenes
    return ['Opening', 'Main content', 'Transition', 'Highlight', 'Closing CTA'];
  }

  /**
   * Ensure mediaByScene is initialized for the current template's scenes.
   */
  ensureSceneMediaState() {
    const scenes = this.getSceneStructure();
    if (!this.data.mediaByScene || this.data.mediaByScene.length !== scenes.length) {
      this.data.mediaByScene = scenes.map((sceneName, i) => ({
        sceneName,
        sceneIndex: i,
        media: null,
        mediaType: 'video',
        status: 'empty', // 'empty' | 'loading' | 'ready' | 'error'
      }));
    }
    return this.data.mediaByScene;
  }

  // Step 4: Media (scene-level)
  renderStep4Media() {
    const scenes = this.getSceneStructure();
    this.ensureSceneMediaState();

    return `
      <h3>Assign Media Per Scene</h3>
      <p class="tg-step-desc">Each scene in your template needs its own media. Switch between scenes to assign media individually.</p>
      ${this.renderSceneTabs(scenes)}
      ${this.renderSceneMediaPanel(scenes)}
    `;
  }

  /**
   * Render scene navigation tabs.
   */
  renderSceneTabs(scenes) {
    const activeIdx = this._mediaUiState.activeSceneIndex;
    return `
      <div class="tg-scene-tabs">
        ${scenes.map((scene, i) => {
          const isActive = i === activeIdx;
          const slot = this.data.mediaByScene[i] || {};
          const hasMedia = slot.status === 'ready';
          const statusDot = hasMedia ? 'tg-dot-ready' : 'tg-dot-empty';
          return `
            <button class="tg-scene-tab ${isActive ? 'active' : ''}" data-scene-index="${i}">
              <span class="tg-scene-tab-name">Scene ${i + 1}: ${scene}</span>
              <span class="tg-scene-status-dot ${statusDot}"></span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Render the full media panel for the active scene.
   */
  renderSceneMediaPanel(scenes) {
    const activeIdx = this._mediaUiState.activeSceneIndex;
    const scene = scenes[activeIdx] || `Scene ${activeIdx + 1}`;
    const slot = this.data.mediaByScene[activeIdx] || {};
    const activeTab = this._mediaUiState.activeTab;
    const isEditing = this._mediaUiState.editingSceneIndex !== null;

    // If editing, show the edit panel instead of normal tabs
    if (isEditing && this._mediaUiState.editingSceneIndex === activeIdx) {
      return `
        <div class="tg-scene-media-panel">
          <div class="tg-scene-header">
            <h4>Scene ${activeIdx + 1}: <span class="tg-scene-name">${scene}</span></h4>
            <span class="tg-scene-media-status editing">✏️ Editing image</span>
          </div>
          ${this.renderEditImagePanel(scene, activeIdx)}
        </div>
      `;
    }

    return `
      <div class="tg-scene-media-panel">
        <div class="tg-scene-header">
          <h4>Scene ${activeIdx + 1}: <span class="tg-scene-name">${scene}</span></h4>
          <span class="tg-scene-media-status ${slot.status || 'empty'}">
            ${slot.status === 'ready' ? '✓ Media assigned' : slot.status === 'loading' ? '⏳ Loading...' : '○ No media assigned'}
          </span>
        </div>

        ${slot.status === 'ready' && slot.media ? this.renderMediaPreview(slot, scene, activeIdx) : ''}

        <div class="tg-media-tabs">
          <button class="tg-media-tab ${activeTab === 'library' ? 'active' : ''}" data-media-tab="library">📁 My Media</button>
          <button class="tg-media-tab ${activeTab === 'stock' ? 'active' : ''}" data-media-tab="stock">🖼️ Stock (Pixabay)</button>
          <button class="tg-media-tab ${activeTab === 'generate' ? 'active' : ''}" data-media-tab="generate">✨ AI Generate</button>
        </div>

        <div class="tg-media-tab-content" id="tg-media-tab-content">
          ${this.renderMediaTabPanel(activeTab, scene, activeIdx)}
        </div>
      </div>
    `;
  }

  /**
   * Render the currently selected media tab panel.
   */
  renderMediaTabPanel(activeTab, scene, sceneIndex) {
    switch (activeTab) {
      case 'library':
        return this.renderMediaLibraryPanel(scene, sceneIndex);
      case 'stock':
        return this.renderStockMediaPanel(scene, sceneIndex);
      case 'generate':
        return this.renderGenerateMediaPanel(scene, sceneIndex);
      default:
        return '<p class="tg-empty-state">Select a media source.</p>';
    }
  }

  /**
   * My Media library panel — lists existing media assets.
   */
  renderMediaLibraryPanel(scene, sceneIndex) {
    const hasMedia = this.data.media.length > 0;
    if (!hasMedia) {
      return `
        <div class="tg-media-tab-panel">
          <p class="tg-empty-state">No media in your library yet. Try the Stock or AI Generate tabs to add media.</p>
        </div>
      `;
    }
    return `
      <div class="tg-media-tab-panel">
        <div class="tg-media-grid" id="tg-media-library-grid">
          ${this.data.media.map((m, i) => `
            <button class="tg-media-card" data-media-index="${i}" data-scene-index="${sceneIndex}">
              <img class="tg-stock-thumb" src="${m.thumbnail || m.url}" alt="${m.name || 'Media'}">
              <span class="tg-media-card-label">${m.name || `Media ${i + 1}`}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Stock media panel — Pixabay search with per-scene query suggestions.
   */
  renderStockMediaPanel(scene, sceneIndex) {
    const loading = this._mediaUiState.pixabayLoading;
    const results = this._mediaUiState.pixabayResults;
    const suggestions = suggestPixabayQueries({ niche: this.data.niche, script: this.data.script.text });

    return `
      <div class="tg-media-tab-panel">
        <div class="tg-stock-search-bar">
          <input type="text" id="tg-pixabay-query" class="tg-input" placeholder="Search stock media..." value="${this._mediaUiState.pixabayQuery || ''}">
          <button class="tg-btn tg-btn-ai" id="tg-pixabay-search-btn" ${loading ? 'disabled' : ''}>
            ${loading ? '⏳' : '🔍'} Search
          </button>
        </div>
        ${suggestions.length > 0 ? `
          <div class="tg-suggestions">
            ${suggestions.map(q => `<button class="tg-suggestion-chip" data-suggestion="${q}">${q}</button>`).join('')}
          </div>
        ` : ''}
        ${loading ? `
          <div class="tg-loading-indicator">
            <div class="tg-spinner"></div>
            <span>Searching Pixabay...</span>
          </div>
        ` : results.length > 0 ? `
          <div class="tg-media-grid" id="tg-stock-results-grid">
            ${results.map(r => {
              const norm = r.type === 'video' ? normalizePixabayVideo(r) : normalizePixabayImage(r);
              return `
                <button class="tg-media-card" data-stock-id="${r.id}" data-scene-index="${sceneIndex}" data-stock-type="${r.type || 'image'}">
                  <img class="tg-stock-thumb" src="${norm.thumbnail}" alt="${norm.name}">
                  <span class="tg-media-card-label">${norm.name}</span>
                </button>
              `;
            }).join('')}
          </div>
        ` : `<p class="tg-empty-state">Search for stock media for this scene.</p>`}
      </div>
    `;
  }

  /**
   * AI Generate panel — GPT-Image-2 with context-aware prompts.
   */
  renderGenerateMediaPanel(scene, sceneIndex) {
    const loading = this._mediaUiState.generateLoading;
    const results = this._mediaUiState.generatedResults;
    const ctx = buildScenePromptContext({
      niche: this.data.niche,
      scene,
      aspectRatio: '16:9',
    });
    const suggestedPrompt = `Scene: ${scene}. ${ctx}`;

    return `
      <div class="tg-media-tab-panel">
        <div class="tg-form-group">
          <label>Scene Prompt</label>
          <textarea id="tg-generate-prompt" class="tg-textarea" rows="4" placeholder="Describe the scene visually...">${this._mediaUiState.generatePrompt || suggestedPrompt}</textarea>
        </div>
        <div class="tg-form-row">
          <div class="tg-form-group">
            <label>Media Type</label>
            <select id="tg-generate-type" class="tg-select">
              <option value="image">Image</option>
              <option value="video">Video (stock replacement)</option>
            </select>
          </div>
          <div class="tg-form-group">
            <label>Quality</label>
            <select id="tg-generate-quality" class="tg-select">
              <option value="auto">Auto</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
        <button class="tg-btn tg-btn-ai" id="tg-generate-btn" ${loading ? 'disabled' : ''}>
          ${loading ? '⏳ Generating...' : '✨ Generate Image'}
        </button>
        ${loading ? `
          <div class="tg-loading-indicator">
            <div class="tg-spinner"></div>
            <span>Generating with GPT-Image-2...</span>
          </div>
        ` : results.length > 0 ? `
          <div class="tg-media-grid" id="tg-generated-results-grid">
            ${results.map((r, i) => this.renderGeneratedImageCard(r, i, scene, sceneIndex)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render a generated image result card with "Edit with AI" support.
   */
  renderGeneratedImageCard(result, index, scene, sceneIndex) {
    const asset = normalizeGeneratedImage(result);
    const thumb = asset.thumbnail || asset.url;
    return `
      <div class="tg-generated-card" data-result-index="${index}" data-scene-index="${sceneIndex}">
        <img class="tg-stock-thumb" src="${thumb}" alt="Generated result ${index + 1}">
        <div class="tg-generated-card-actions">
          <button class="tg-btn tg-btn-sm tg-btn-secondary" data-select-generated="${index}" data-scene-index="${sceneIndex}">
            ✓ Use This
          </button>
          <button class="tg-btn tg-btn-sm tg-btn-ai" data-edit-image="${index}" data-scene-index="${sceneIndex}">
            ⚙️ Edit
          </button>
        </div>
        ${result.revisedPrompt ? `<div class="tg-revised-prompt">Refined: ${result.revisedPrompt.slice(0, 80)}...</div>` : ''}
      </div>
    `;
  }

  /**
   * Render the media preview for a scene that has media assigned,
   * including the "Edit with AI" button.
   */
  renderMediaPreview(slot, scene, sceneIndex) {
    const m = slot.media;
    const thumb = m.thumbnail || m.url;
    return `
      <div class="tg-scene-media-preview">
        <img class="tg-preview-thumb" src="${thumb}" alt="${m.name || scene}">
        <div class="tg-preview-info">
          <span class="tg-preview-name">${m.name || scene}</span>
          <span class="tg-preview-source">${m.provider || m.source || 'unknown'}</span>
        </div>
        <div class="tg-preview-actions">
          <button class="tg-btn tg-btn-sm tg-btn-secondary" data-clear-scene="${sceneIndex}">✕ Change</button>
          ${m.source === 'openai' ? `
            <button class="tg-btn tg-btn-sm tg-btn-ai" data-edit-assigned="${sceneIndex}">⚙️ Edit</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Step 5: Overlays
  renderStep5Overlays() {
    const overlayTypes = [
      { id: 'text', label: 'Text', icon: '📝' },
      { id: 'logo', label: 'Logo', icon: '🏷️' },
      { id: 'cta', label: 'CTA Button', icon: '🔘' },
      { id: 'lower-third', label: 'Lower Third', icon: '📊' },
      { id: 'caption', label: 'Captions', icon: '💬' },
      { id: 'sticker', label: 'Sticker', icon: '⭐' },
      { id: 'lead-form', label: 'Lead Form', icon: '📋' },
      { id: 'interactive', label: 'Interactive', icon: '👆' }
    ];
    return `
      <h3>Add Overlays</h3>
      <p class="tg-step-desc">Enhance your video with text, branding, and interactive elements.</p>
      <div class="tg-overlay-grid">
        ${overlayTypes.map(o => `
          <button class="tg-overlay-card" data-overlay-type="${o.id}">
            <span class="tg-overlay-icon">${o.icon}</span>
            <span class="tg-overlay-label">${o.label}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  // Step 6: Voice (TTS)
  renderStep6Voice() {
    return `
      <h3>Add Voice Narration</h3>
      <p class="tg-step-desc">Generate AI voice narration for your script.</p>
      <div class="tg-voice-config">
        <label class="tg-toggle">
          <input type="checkbox" id="tg-voice-enabled" ${this.data.voice.enabled ? 'checked' : ''}>
          <span>Enable AI Voice Narration</span>
        </label>
        <div class="tg-form-row">
          <div class="tg-form-group">
            <label>Provider</label>
            <select id="tg-voice-provider" class="tg-select">
              <option value="openai" ${this.data.voice.provider === 'openai' ? 'selected' : ''}>OpenAI TTS</option>
            </select>
          </div>
          <div class="tg-form-group">
            <label>Voice</label>
            <select id="tg-voice-voice" class="tg-select">
              ${['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']
                .map(v => `<option value="${v}" ${this.data.voice.voice === v ? 'selected' : ''}>${v.charAt(0).toUpperCase() + v.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="tg-form-group">
          <label>Delivery Instructions</label>
          <select id="tg-voice-preset" class="tg-select">
            <option value="">Custom...</option>
            <option value="conversational">Conversational</option>
            <option value="professional">Professional</option>
            <option value="warm">Warm</option>
            <option value="energetic">Energetic</option>
            <option value="calm">Calm</option>
            <option value="dramatic">Dramatic</option>
            <option value="whisper">Whisper</option>
          </select>
        </div>
        <div class="tg-form-group">
          <label>Custom Instructions</label>
          <textarea id="tg-voice-instructions" class="tg-textarea" rows="3" placeholder="e.g., Speak with enthusiasm and pause for emphasis">${this.data.voice.instructions}</textarea>
        </div>
      </div>
    `;
  }

  // Step 7: Personalization
  renderStep7Personalization() {
    return `
      <h3>Personalization</h3>
      <p class="tg-step-desc">Add personalization tokens to make this video unique for each viewer.</p>
      <div class="tg-personalization-config">
        <label class="tg-toggle">
          <input type="checkbox" id="tg-pers-enabled" ${this.data.personalization.enabled ? 'checked' : ''}>
          <span>Enable Personalization</span>
        </label>
        <div class="tg-token-list">
          <p class="tg-section-label">Available Tokens:</p>
          <div class="tg-tokens">
            ${['{{first_name}}', '{{last_name}}', '{{company}}', '{{city}}', '{{industry}}', '{{offer}}', '{{email}}', '{{phone}}']
              .map(t => `<code class="tg-token">${t}</code>`).join('')}
          </div>
          <p class="tg-hint">Click a token to copy it to clipboard.</p>
        </div>
        <button class="tg-btn tg-btn-secondary" id="tg-preview-as-contact">👤 Preview As Contact</button>
      </div>
    `;
  }

  // Step 8: Preview
  renderStep8Preview() {
    const totalMedia = this.data.mediaByScene.filter(s => s.status === 'ready').length;
    const totalScenes = this.getSceneStructure().length;
    return `
      <h3>Preview Your Composition</h3>
      <p class="tg-step-desc">Review everything before adding to your timeline.</p>
      <div class="tg-preview-summary">
        <div class="tg-summary-section">
          <h4>📋 Configuration</h4>
          <ul>
            <li><strong>Niche:</strong> ${this.data.niche || 'Not selected'}</li>
            <li><strong>Template:</strong> ${this.data.selectedTemplate?.name || 'Not selected'}</li>
            <li><strong>Script:</strong> ${this.data.script.text ? this.data.script.text.substring(0, 100) + '...' : 'None'}</li>
            <li><strong>Media per scene:</strong> ${totalMedia} / ${totalScenes} scenes assigned</li>
            <li><strong>Overlays:</strong> ${this.data.overlays.length}</li>
            <li><strong>Voice:</strong> ${this.data.voice.enabled ? this.data.voice.voice : 'Disabled'}</li>
            <li><strong>Personalization:</strong> ${this.data.personalization.enabled ? 'Enabled' : 'Disabled'}</li>
          </ul>
        </div>
        <div class="tg-scene-breakdown">
          <h4>📽️ Scene Media Breakdown</h4>
          ${this.renderSceneBreakdown()}
        </div>
        <div class="tg-preview-area" id="tg-preview-area">
          <p class="tg-empty-state">Full composition preview will appear here.</p>
        </div>
      </div>
    `;
  }

  /**
   * Render a scene-by-scene breakdown for the preview step.
   */
  renderSceneBreakdown() {
    const scenes = this.getSceneStructure();
    return `
      <table class="tg-scene-table">
        <thead>
          <tr>
            <th>Scene</th>
            <th>Name</th>
            <th>Media Status</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          ${scenes.map((scene, i) => {
            const slot = this.data.mediaByScene[i] || {};
            const media = slot.media;
            return `
              <tr>
                <td>${i + 1}</td>
                <td>${scene}</td>
                <td class="tg-scene-status-cell ${slot.status || 'empty'}">
                  ${slot.status === 'ready' ? '✓ Assigned' : slot.status === 'loading' ? '⏳ Loading' : '○ Empty'}
                </td>
                <td>${media ? (media.provider || media.source || '—') : '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // Step 9: Add to Timeline
  renderStep9AddToTimeline() {
    const totalMedia = this.data.mediaByScene.filter(s => s.status === 'ready').length;
    const totalScenes = this.getSceneStructure().length;
    return `
      <h3>Add to Timeline</h3>
      <p class="tg-step-desc">Your template will be added as editable Timeline elements.</p>
      <div class="tg-add-summary">
        <p>The following will be created on your timeline:</p>
        <ul>
          <li>📹 ${totalMedia} video/image clip(s) from ${totalScenes} scenes</li>
          <li>📝 ${this.data.overlays.filter(o => o.type === 'text').length || 0} text overlay(s)</li>
          <li>🎙️ ${this.data.voice.enabled ? '1 voice narration' : 'No voice'}</li>
          <li>🎨 ${this.data.overlays.length} overlay(s)</li>
        </ul>
        <p class="tg-hint">All elements remain editable after insertion. One Undo will revert the complete template insertion.</p>
      </div>
    `;
  }

  renderFooter() {
    return '';
  }

  setupEventListeners() {
    super.setupEventListeners();

    const backBtn = this.overlay.querySelector('#tg-back');
    const nextBtn = this.overlay.querySelector('#tg-next');

    if (backBtn) {
      backBtn.addEventListener('click', () => this.goBack());
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.goNext());
    }

    this.setupStepListeners();
  }

  setupStepListeners() {
    switch (this.step) {
      case 1:
        this.overlay.querySelectorAll('.tg-niche-card').forEach(card => {
          card.addEventListener('click', () => {
            this.data.niche = card.dataset.niche;
            this.refresh();
          });
        });
        break;
      case 2:
        this.setupStep2ScriptListeners();
        break;
      case 3:
        this.overlay.querySelectorAll('.tg-template-card').forEach(card => {
          card.addEventListener('click', () => {
            const tplId = card.dataset.templateId;
            const fullTpl = ALL_NICHE_TEMPLATES.find(t => t.id === tplId);
            this.data.template = { id: tplId };
            this.data.selectedTemplate = fullTpl || null;
            this.refresh();
          });
        });
        break;
      case 4:
        this.setupStep4MediaListeners();
        break;
    }
  }

  /**
   * Step 2: Script AI tool listeners.
   */
  setupStep2ScriptListeners() {
    const genBtn = this.overlay.querySelector('#tg-ai-generate');
    const rewriteBtn = this.overlay.querySelector('#tg-ai-rewrite');
    const shortenBtn = this.overlay.querySelector('#tg-ai-shorten');
    const expandBtn = this.overlay.querySelector('#tg-ai-expand');

    const scriptInput = this.overlay.querySelector('#tg-script-text');
    const getScriptText = () => scriptInput ? scriptInput.value : this.data.script.text;
    const setScriptText = (val) => {
      this.data.script.text = val;
      if (scriptInput) scriptInput.value = val;
    };

    const runScriptAction = async (actionFn, loadingLabel, btn) => {
      const originalText = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.innerHTML = `⏳ ${loadingLabel}`; }
      try {
        const text = getScriptText();
        const result = await actionFn({
          niche: this.data.niche,
          existingScript: text,
          tone: this.data.script.tone,
          audience: this.data.script.audience,
          cta: this.data.script.cta,
          templateContext: this.data.selectedTemplate,
          personalizationEnabled: this.data.personalization.enabled,
        });
        if (result.ok) {
          setScriptText(result.text);
        } else {
          console.error('[TemplateGeneratorModal] Script action failed:', result.error);
        }
      } catch (e) {
        console.error('[TemplateGeneratorModal] Script action error:', e);
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
      }
    };

    if (genBtn) {
      genBtn.addEventListener('click', () => {
        runScriptAction(generateScript, 'Generating...', genBtn);
      });
    }
    if (rewriteBtn) {
      rewriteBtn.addEventListener('click', () => {
        runScriptAction(rewriteScript, 'Rewriting...', rewriteBtn);
      });
    }
    if (shortenBtn) {
      shortenBtn.addEventListener('click', () => {
        runScriptAction(shortenScript, 'Shortening...', shortenBtn);
      });
    }
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        runScriptAction(expandScript, 'Expanding...', expandBtn);
      });
    }

    // Sync script data on blur
    if (scriptInput) {
      scriptInput.addEventListener('blur', () => {
        this.data.script.text = scriptInput.value;
      });
    }
    const toneSelect = this.overlay.querySelector('#tg-script-tone');
    if (toneSelect) {
      toneSelect.addEventListener('change', () => {
        this.data.script.tone = toneSelect.value;
      });
    }
    const audienceSelect = this.overlay.querySelector('#tg-script-audience');
    if (audienceSelect) {
      audienceSelect.addEventListener('change', () => {
        this.data.script.audience = audienceSelect.value;
      });
    }
    const ctaInput = this.overlay.querySelector('#tg-script-cta');
    if (ctaInput) {
      ctaInput.addEventListener('blur', () => {
        this.data.script.cta = ctaInput.value;
      });
    }
  }

  /**
   * Step 4: Scene-level media listeners.
   * Handles scene tab switching, source tab switching,
   * stock search, AI generation, media selection, and image editing.
   */
  setupStep4MediaListeners() {
    // Scene tab switching
    this.overlay.querySelectorAll('.tg-scene-tab[data-scene-index]').forEach(tab => {
      tab.addEventListener('click', () => {
        this._mediaUiState.activeSceneIndex = parseInt(tab.dataset.sceneIndex, 10);
        this.refresh();
      });
    });

    // Media source tab switching
    this.overlay.querySelectorAll('.tg-media-tab[data-media-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        this._mediaUiState.activeTab = tab.dataset.mediaTab;
        this.refresh();
      });
    });

    // Pixabay search
    const searchBtn = this.overlay.querySelector('#tg-pixabay-search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => this._runPixabaySearch());
    }

    // Pixabay search on Enter in query input
    const queryInput = this.overlay.querySelector('#tg-pixabay-query');
    if (queryInput) {
      queryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this._runPixabaySearch();
        }
      });
    }

    // Suggestion chips
    this.overlay.querySelectorAll('.tg-suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this._mediaUiState.pixabayQuery = chip.dataset.suggestion;
        this._runPixabaySearch();
      });
    });

    // AI Generate button
    const generateBtn = this.overlay.querySelector('#tg-generate-btn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => this._runImageGeneration());
    }

    // Select generated image
    this.overlay.querySelectorAll('[data-select-generated]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.selectGenerated, 10);
        const sceneIndex = parseInt(btn.dataset.sceneIndex, 10);
        const result = this._mediaUiState.generatedResults[idx];
        if (result) {
          const asset = normalizeGeneratedImage(result);
          this._assignMediaToScene(sceneIndex, asset);
          this.refresh();
        }
      });
    });

    // Select stock image/video
    this.overlay.querySelectorAll('.tg-media-card[data-stock-id]').forEach(card => {
      card.addEventListener('click', () => {
        const stockId = card.dataset.stockId;
        const sceneIndex = parseInt(card.dataset.sceneIndex, 10);
        const stockType = card.dataset.stockType || 'image';

        // Find the original hit — we need to re-search since we didn't store hits
        // but we normalized at render time. We'll need to store the raw hits.
        // For now, re-extract from the DOM data attribute approach:
        const hits = this._mediaUiState.pixabayResults;
        const hit = hits.find(h => String(h.id) === stockId);
        if (hit) {
          const asset = stockType === 'video' ? normalizePixabayVideo(hit) : normalizePixabayImage(hit);
          this._assignMediaToScene(sceneIndex, asset);
          this.refresh();
        }
      });
    });

    // Select from My Media library
    this.overlay.querySelectorAll('.tg-media-card[data-media-index]').forEach(card => {
      card.addEventListener('click', () => {
        const mediaIdx = parseInt(card.dataset.mediaIndex, 10);
        const sceneIndex = parseInt(card.dataset.sceneIndex, 10);
        const media = this.data.media[mediaIdx];
        if (media) {
          this._assignMediaToScene(sceneIndex, media);
          this.refresh();
        }
      });
    });

    // Clear/change scene media
    this.overlay.querySelectorAll('[data-clear-scene]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sceneIndex = parseInt(btn.dataset.clearScene, 10);
        this.data.mediaByScene[sceneIndex].media = null;
        this.data.mediaByScene[sceneIndex].status = 'empty';
        this.refresh();
      });
    });

    // Edit assigned openai image
    this.overlay.querySelectorAll('[data-edit-assigned]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sceneIndex = parseInt(btn.dataset.editAssigned, 10);
        this._openEditImagePanel(sceneIndex);
      });
    });

    // Edit generated image
    this.overlay.querySelectorAll('[data-edit-image]').forEach(btn => {
      btn.addEventListener('click', () => {
        const resultIdx = parseInt(btn.dataset.editImage, 10);
        const sceneIndex = parseInt(btn.dataset.sceneIndex, 10);
        this._openEditImagePanel(sceneIndex, null, resultIdx);
      });
    });

    // Edit image form submission
    const editFormBtn = this.overlay.querySelector('#tg-edit-image-btn');
    if (editFormBtn) {
      editFormBtn.addEventListener('click', () => this._runImageEdit());
    }

    // Edit image cancel
    const editCancelBtn = this.overlay.querySelector('#tg-edit-image-cancel');
    if (editCancelBtn) {
      editCancelBtn.addEventListener('click', () => {
        this._mediaUiState.editingSceneIndex = null;
        this._mediaUiState.editingResultIndex = null;
        this._mediaUiState.editReferenceUrl = null;
        this._mediaUiState.editInstruction = '';
        this._mediaUiState.activeTab = 'generate';
        this.refresh();
      });
    }
  }

  /**
   * Assign a media asset to a scene slot.
   */
  _assignMediaToScene(sceneIndex, media) {
    this.ensureSceneMediaState();
    this.data.mediaByScene[sceneIndex] = {
      sceneName: this.data.mediaByScene[sceneIndex].sceneName,
      sceneIndex,
      media,
      mediaType: media.type || 'image',
      status: 'ready',
    };
    // Also keep flat media list in sync for backward compat
    if (!this.data.media.find(m => m.id === media.id)) {
      this.data.media.push(media);
    }
  }

  /**
   * Run a Pixabay search for the current scene.
   */
  async _runPixabaySearch() {
    const queryInput = this.overlay.querySelector('#tg-pixabay-query');
    const query = queryInput ? queryInput.value : this._mediaUiState.pixabayQuery;
    this._mediaUiState.pixabayQuery = query;

    if (!query || !query.trim()) return;

    this._mediaUiState.pixabayLoading = true;
    this._mediaUiState.pixabayResults = [];
    this.refresh();

    try {
      // Search for both images and videos
      const [imgRes, vidRes] = await Promise.all([
        searchPixabay({ type: 'images', query, perPage: 9 }),
        searchPixabay({ type: 'videos', query, perPage: 6 }),
      ]);

      const imgHits = imgRes.ok ? imgRes.hits.map(h => ({ ...h, type: 'image' })) : [];
      const vidHits = vidRes.ok ? vidRes.hits.map(h => ({ ...h, type: 'video' })) : [];
      this._mediaUiState.pixabayResults = [...imgHits, ...vidHits];
    } catch (e) {
      console.error('[TemplateGeneratorModal] Pixabay search error:', e);
    } finally {
      this._mediaUiState.pixabayLoading = false;
      this.refresh();
    }
  }

  /**
   * Run AI image generation for the current scene.
   */
  async _runImageGeneration() {
    const promptInput = this.overlay.querySelector('#tg-generate-prompt');
    const prompt = promptInput ? promptInput.value : '';
    this._mediaUiState.generatePrompt = prompt;

    if (!prompt || !prompt.trim()) return;

    const scenes = this.getSceneStructure();
    const scene = scenes[this._mediaUiState.activeSceneIndex] || `Scene ${this._mediaUiState.activeSceneIndex + 1}`;

    this._mediaUiState.generateLoading = true;
    this.refresh();

    try {
      const result = await generateImage({
        prompt: prompt.trim(),
        niche: this.data.niche,
        scene,
        aspectRatio: '16:9',
        quality: 'auto',
        n: 1,
      });

      if (result.ok) {
        this._mediaUiState.generatedResults = result.assets || [];
      } else {
        console.error('[TemplateGeneratorModal] Image generation failed:', result.error);
      }
    } catch (e) {
      console.error('[TemplateGeneratorModal] Image generation error:', e);
    } finally {
      this._mediaUiState.generateLoading = false;
      this.refresh();
    }
  }

  /**
   * Open the "Edit with AI" panel for a scene's assigned media or a generated result.
   */
  _openEditImagePanel(sceneIndex, assignedMedia = null, resultIndex = null) {
    this._mediaUiState.editingSceneIndex = sceneIndex;
    this._mediaUiState.editingResultIndex = resultIndex;
    this._mediaUiState.editReferenceUrl = assignedMedia ? (assignedMedia.url || assignedMedia.thumbnail) : null;
    this._mediaUiState.editInstruction = '';
    this.refresh();

    // After render, focus the instruction input
    setTimeout(() => {
      const input = this.overlay.querySelector('#tg-edit-instruction');
      if (input) input.focus();
    }, 50);
  }

  /**
   * Render the edit-image panel (inline, replaces the generate panel content).
   */
  renderEditImagePanel(scene, sceneIndex) {
    const scenes = this.getSceneStructure();
    const currentScene = scenes[sceneIndex] || scene;
    const editingMedia = this._mediaUiState.editingResultIndex !== null
      ? this._mediaUiState.generatedResults[this._mediaUiState.editingResultIndex]
      : this.data.mediaByScene[sceneIndex]?.media || null;

    const referenceUrl = this._mediaUiState.editReferenceUrl || (editingMedia ? (editingMedia.url || editingMedia.thumbnail) : '');

    return `
      <div class="tg-media-tab-panel">
        <div class="tg-edit-image-panel">
          <div class="tg-edit-header">
            <h5>Edit Image with AI</h5>
            <span class="tg-edit-scene-name">${currentScene}</span>
          </div>

          ${referenceUrl ? `
            <div class="tg-edit-reference-preview">
              <img class="tg-preview-thumb" src="${referenceUrl}" alt="Reference image">
            </div>
          ` : ''}

          <div class="tg-form-group">
            <label>Edit Instruction</label>
            <textarea id="tg-edit-instruction" class="tg-textarea" rows="3" placeholder="e.g., change the background to sunset, add more flowers, brighter colors...">${this._mediaUiState.editInstruction || ''}</textarea>
          </div>

          <div class="tg-form-group">
            <label>Scene Prompt (for context)</label>
            <textarea id="tg-edit-prompt" class="tg-textarea" rows="2" placeholder="Describe the full scene...">Scene: ${currentScene}. ${buildScenePromptContext({
              niche: this.data.niche,
              scene: currentScene,
              aspectRatio: '16:9',
            })}</textarea>
          </div>

          <div class="tg-edit-actions">
            <button class="tg-btn tg-btn-secondary" id="tg-edit-image-cancel">← Back to Generate</button>
            <button class="tg-btn tg-btn-ai" id="tg-edit-image-btn" ${this._mediaUiState.generateLoading ? 'disabled' : ''}>
              ${this._mediaUiState.generateLoading ? '⏳ Editing...' : '✨ Apply Edit'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Run the image edit workflow using the backend's referenceImageUrl + editInstruction.
   */
  async _runImageEdit() {
    const instructionInput = this.overlay.querySelector('#tg-edit-instruction');
    const promptInput = this.overlay.querySelector('#tg-edit-prompt');

    const editInstruction = instructionInput ? instructionInput.value : '';
    const prompt = promptInput ? promptInput.value : '';

    if (!editInstruction || !editInstruction.trim()) return;

    const scenes = this.getSceneStructure();
    const scene = scenes[this._mediaUiState.editingSceneIndex] || `Scene ${this._mediaUiState.editingSceneIndex + 1}`;

    this._mediaUiState.generateLoading = true;
    this.refresh();

    try {
      // Use the reference image URL + edit instruction to generate an edited version
      const referenceUrl = this._mediaUiState.editReferenceUrl;
      const result = await generateImage({
        prompt: `${prompt} | EDIT: ${editInstruction.trim()}`,
        niche: this.data.niche,
        scene,
        aspectRatio: '16:9',
        quality: 'auto',
        referenceImageUrl: referenceUrl,
        editInstruction: editInstruction.trim(),
        n: 1,
      });

      if (result.ok) {
        // Merge new results with existing ones
        this._mediaUiState.generatedResults = [...result.assets, ...this._mediaUiState.generatedResults];
      } else {
        console.error('[TemplateGeneratorModal] Image edit failed:', result.error);
      }
    } catch (e) {
      console.error('[TemplateGeneratorModal] Image edit error:', e);
    } finally {
      this._mediaUiState.generateLoading = false;
      // Reset edit state but go back to generate panel
      this._mediaUiState.editingSceneIndex = null;
      this._mediaUiState.editingResultIndex = null;
      this._mediaUiState.editReferenceUrl = null;
      this._mediaUiState.editInstruction = '';
      this._mediaUiState.activeTab = 'generate';
      this.refresh();
    }
  }

  goBack() {
    if (this.step > 1) {
      this.step--;
      this.refresh();
    }
  }

  goNext() {
    // Validate scene media before proceeding
    if (this.step === 4) {
      this.ensureSceneMediaState();
      const assignedScenes = this.data.mediaByScene.filter(s => s.status === 'ready').length;
      const emptyScenes = this.getSceneStructure().length - assignedScenes;
      if (emptyScenes > 0) {
        // Allow proceeding with warning — not all scenes need media
        // but log it for visibility
        console.warn(`[TemplateGeneratorModal] ${emptyScenes} scene(s) have no media assigned`);
      }
    }
    if (this.step < this.maxStep) {
      this.step++;
      this.refresh();
    } else {
      this.addToTimeline();
    }
  }

  refresh() {
    if (this.overlay) {
      const content = this.overlay.querySelector('#tg-step-content');
      if (content) {
        content.innerHTML = this.renderStep();
        this.setupStepListeners();
        this.setupEventListeners();
      }
    }
  }

  async addToTimeline() {
    try {
      // Use TimelineFeatureApi for proper integration with history/undo
      // The actual mutation will be handled by the caller via onConfirm
      this.onConfirm({
        action: 'add-to-timeline',
        data: this.data,
        meta: {
          sceneStructure: this.getSceneStructure(),
          mediaByScene: this.data.mediaByScene,
        },
        source: 'template-generator'
      });
      this.close();
    } catch (err) {
      console.error('[TemplateGeneratorModal] Failed to add to timeline:', err);
      this.onCancel({ action: 'error', error: err.message });
    }
  }
}

export default TemplateGeneratorModal;
