/**
 * CINEMA TEMPLATE STUDIO
 * UI Component for the Cinematic Template System
 */

import { navigate } from '../lib/router.js';
import { mountStudioDrawer, createStudioMenuButton } from '../lib/studioChrome.js';
import { showToast } from '../lib/loading.js';
import { escapeHtml } from '../lib/security.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { openPromptGallery } from '../lib/promptGalleryIntegration.js';
import { openRecipeModal } from '../lib/recipeIntegration.js';
import { openMonetizationHub } from '../lib/monetizationIntegration.js';
import { openModelPicker } from '../lib/modelPickerIntegration.js';
import { 
  getTemplateRegistry,
  CINEMATIC_CATEGORIES,
  OUTPUT_STYLES,
  VISUAL_STYLES,
  SHOT_TYPES,
  CAMERA_MOVEMENTS,
  PACING_OPTIONS,
  CTA_TYPES,
  ENDING_TYPES,
  BRAND_VOICES,
  TARGET_AUDIENCES,
  SCENE_STRUCTURES,
  TemplateInputBuilder,
  PromptAssemblyEngine,
  SceneBuilder,
  ShotBuilder,
  StoryboardBuilder,
  RenderHandoff,
  TemplateStorage
} from '../lib/cinematicTemplates.js';

export function CinemaTemplateStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-black overflow-hidden';

  // All-studios side menu (drawer)
  const studioDrawer = mountStudioDrawer(document.body, { currentRoute: 'cinema' });

  // State
  let registry = getTemplateRegistry();
  let currentTemplate = null;
  let currentMode = 'quick'; // 'quick' or 'advanced'
  let currentInputs = {};
  let sceneBuilder = null;
  let storyboardBuilder = null;
  let view = 'browse'; // 'browse', 'create', 'storyboard', 'preview'

  // Initialize
  render();

  function render() {
    container.innerHTML = '';

    switch (view) {
      case 'browse':
        renderBrowseView();
        break;
      case 'create':
        renderCreateView();
        break;
      case 'storyboard':
        renderStoryboardView();
        break;
      case 'preview':
        renderPreviewView();
        break;
    }

    // Add an "all studios" menu button next to every back button in this view
    container.querySelectorAll('[id="back-btn"]').forEach((backBtn) => {
      if (backBtn.previousElementSibling && backBtn.previousElementSibling.dataset.studioMenu) return;
      const menuBtn = createStudioMenuButton(studioDrawer.toggle);
      menuBtn.dataset.studioMenu = '1';
      backBtn.parentElement.insertBefore(menuBtn, backBtn);
    });
  }
  }

  function renderBrowseView() {
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-4 border-b border-white/10 bg-black/50';
    header.innerHTML = `
      <div class="flex items-center gap-4">
        <button id="back-btn" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
            <span class="text-xl">🎬</span>
          </div>
          <div>
            <h1 class="text-xl font-black text-white">CINEMATIC TEMPLATES</h1>
            <p class="text-xs text-secondary">${registry.getAll().length} Templates</p>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button id="favorites-btn" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-secondary text-sm rounded-lg transition-colors flex items-center gap-2">
          <span>❤️</span> Favorites
        </button>
        <button id="recent-btn" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-secondary text-sm rounded-lg transition-colors flex items-center gap-2">
          <span>🕐</span> Recent
        </button>
        <button id="custom-btn" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-secondary text-sm rounded-lg transition-colors flex items-center gap-2">
          <span>✨</span> My Templates
        </button>
      </div>
    `;
    container.appendChild(header);

    const templatesGrid = document.createElement('div');
    templatesGrid.className = 'flex-1 overflow-auto p-6';
    templatesGrid.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${registry.getAll().map(template => `
          <div class="template-card bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-primary/50 hover:bg-white/[0.07] transition-all cursor-pointer group" data-template-id="${template.id}">
            <div class="flex items-start justify-between mb-3">
              <div class="text-4xl">${template.icon}</div>
              <button class="favorite-btn text-white/20 hover:text-red-400 transition-colors p-1" data-template-id="${template.id}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            </div>
            <h3 class="text-white font-bold mb-1 group-hover:text-primary transition-colors">${escapeHtml(template.name)}</h3>
            <p class="text-secondary text-sm mb-3 line-clamp-2">${escapeHtml(template.description || '')}</p>
            <div class="flex items-center gap-2">
              <span class="px-2 py-1 bg-white/5 rounded-md text-xs text-white/60">${template.category}</span>
              <span class="px-2 py-1 bg-white/5 rounded-md text-xs text-white/60">${template.duration?.default || 30}s</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(templatesGrid);

    templatesGrid.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.favorite-btn')) return;
        const templateId = card.dataset.templateId;
        const template = registry.getById(templateId);
        if (template) {
          selectTemplate(template);
        }
      });
    });

    templatesGrid.querySelectorAll('.favorite-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const templateId = btn.dataset.templateId;
        TemplateStorage.addFavorite(templateId);
        showToast('Added to favorites!', 'success');
      });
    });
  }

  function selectTemplate(template) {
    currentTemplate = template;
    currentInputs = new TemplateInputBuilder(template, currentMode).getDefaults();
    sceneBuilder = new SceneBuilder(template);
    storyboardBuilder = new StoryboardBuilder(template);
    view = 'create';
    render();
  }

  // ================================
  // CREATE VIEW
  // ================================
  function renderCreateView() {
    if (!currentTemplate) return;

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-4 border-b border-white/10 bg-black/50';
    header.innerHTML = `
      <div class="flex items-center gap-4">
        <button id="back-btn" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-xl">
            ${currentTemplate.icon}
          </div>
          <div>
            <h1 class="text-xl font-black text-white">${escapeHtml(currentTemplate.name)}</h1>
            <p class="text-xs text-secondary">Create your ${currentTemplate.category.toLowerCase()} video</p>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex bg-white/5 rounded-lg p-1">
          <button id="quick-mode-btn" class="px-4 py-1.5 ${currentMode === 'quick' ? 'bg-primary text-black' : 'text-white/70'} text-xs font-bold rounded-md transition-colors">
            Quick Mode
          </button>
          <button id="advanced-mode-btn" class="px-4 py-1.5 ${currentMode === 'advanced' ? 'bg-primary text-black' : 'text-white/70'} text-xs font-bold rounded-md transition-colors">
            Advanced
          </button>
        </div>
        <button id="save-btn" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-secondary text-sm rounded-lg transition-colors flex items-center gap-2">
          <span>💾</span> Save
        </button>
      </div>
    `;
    container.appendChild(header);

    // Main content
    const content = document.createElement('div');
    content.className = 'flex-1 flex overflow-hidden';

    // Left: Form inputs
    const formPanel = document.createElement('div');
    formPanel.className = 'flex-1 overflow-auto p-6';
    formPanel.innerHTML = `
      <div class="max-w-2xl mx-auto">
        <div class="mb-6">
          <h2 class="text-lg font-bold text-white mb-2">Basic Information</h2>
          <p class="text-sm text-secondary">Enter the key details for your video</p>
        </div>
        
        <div id="inputs-form" class="space-y-4">
          <!-- Inputs will be rendered here -->
        </div>

        ${currentTemplate.includeBrandContext ? `
          <div class="mt-8 pt-8 border-t border-white/10">
            <h2 class="text-lg font-bold text-white mb-2">Brand Context</h2>
            <p class="text-sm text-secondary">Add your brand details for consistent messaging</p>
            <div id="brand-form" class="space-y-4 mt-4">
              <!-- Brand inputs -->
            </div>
          </div>
        ` : ''}

        ${currentTemplate.sceneBuilder ? `
          <div class="mt-8 pt-8 border-t border-white/10">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-lg font-bold text-white">Scene Builder</h2>
                <p class="text-sm text-secondary">Structure your video into scenes</p>
              </div>
              <button id="open-storyboard-btn" class="px-4 py-2 bg-primary text-black text-xs font-bold rounded-lg hover:scale-105 transition-transform">
                🎨 Storyboard
              </button>
            </div>
            <div id="scenes-list" class="space-y-3">
              <!-- Scenes will be rendered here -->
            </div>
          </div>
        ` : ''}
      </div>
    `;
    content.appendChild(formPanel);

    // Right: Preview panel
    const previewPanel = document.createElement('div');
    previewPanel.className = 'w-96 border-l border-white/10 p-6 overflow-auto';
    previewPanel.innerHTML = `
      <div class="sticky top-0">
        <h3 class="text-sm font-bold text-white uppercase tracking-wider mb-4">Preview</h3>
        
        <div class="bg-white/5 rounded-2xl p-4 mb-4">
          <div class="aspect-video bg-black rounded-xl mb-3 flex items-center justify-center">
            <div class="text-center">
              <div class="text-4xl mb-2">${currentTemplate.icon}</div>
              <div class="text-xs text-secondary">Preview</div>
            </div>
          </div>
          <div class="space-y-2 text-xs">
            <div class="flex justify-between">
              <span class="text-white/50">Template</span>
              <span class="text-white">${escapeHtml(currentTemplate.name)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-white/50">Duration</span>
              <span class="text-white">${currentInputs.duration || currentTemplate.duration?.default || 30}s</span>
            </div>
            <div class="flex justify-between">
              <span class="text-white/50">Aspect Ratio</span>
              <span class="text-white">${currentInputs.aspectRatio || '16:9'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-white/50">Style</span>
              <span class="text-white">${currentInputs.visualStyle || 'Cinematic'}</span>
            </div>
          </div>
        </div>

        <div class="mb-4">
          <h4 class="text-xs font-bold text-white uppercase tracking-wider mb-2">Generated Prompt</h4>
          <div id="prompt-preview" class="bg-black/50 rounded-xl p-3 text-xs text-white/70 max-h-48 overflow-auto">
            <!-- Prompt will be rendered here -->
          </div>
        </div>

        ${currentTemplate.includeCTA ? `
          <div class="mb-4">
            <h4 class="text-xs font-bold text-white uppercase tracking-wider mb-2">Call to Action</h4>
            <div id="cta-preview" class="bg-white/5 rounded-xl p-3 text-xs text-white/70">
              ${currentInputs.ctaType ? CTA_TYPES[currentInputs.ctaType.toUpperCase().replace(/ /g, '_')]?.name : 'Not selected'}
            </div>
          </div>
        ` : ''}

        <button id="generate-btn" class="w-full py-3 bg-primary text-black font-black text-sm rounded-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
          <span>✨</span> Generate Video
        </button>
        <div id="personalize-trigger" class="mt-3"></div>
      </div>
    `;
    content.appendChild(previewPanel);

    container.appendChild(content);

    // Render form inputs
    renderFormInputs();
    updatePromptPreview();

    // Event listeners
    container.querySelector('#back-btn').onclick = () => {
      view = 'browse';
      render();
    };

    container.querySelector('#quick-mode-btn').onclick = () => {
      currentMode = 'quick';
      currentInputs = new TemplateInputBuilder(currentTemplate, currentMode).getDefaults();
      render();
    };

    container.querySelector('#advanced-mode-btn').onclick = () => {
      currentMode = 'advanced';
      currentInputs = new TemplateInputBuilder(currentTemplate, currentMode).getDefaults();
      render();
    };

    container.querySelector('#save-btn').onclick = () => {
      TemplateStorage.saveProject({
        templateId: currentTemplate.id,
        templateName: currentTemplate.name,
        inputs: currentInputs,
        mode: currentMode
      });
      showToast('Project saved!', 'success');
    };

    container.querySelector('#generate-btn').onclick = () => {
      generateVideo();
    };

    // Personalize trigger into the dedicated div below the generate button
    const personalizeEl = container.querySelector('#personalize-trigger');
    if (personalizeEl) {
      personalizeEl.innerHTML = '';
      mountPersonalizeTrigger({ controlsContainer: personalizeEl, appId: 'cinema-template' });
    }

    if (currentTemplate.sceneBuilder && container.querySelector('#open-storyboard-btn')) {
      container.querySelector('#open-storyboard-btn').onclick = () => {
        view = 'storyboard';
        render();
      };
    }
  }

  function renderFormInputs() {
    const formBuilder = new TemplateInputBuilder(currentTemplate, currentMode);
    const schema = formBuilder.buildFormSchema();
    const formContainer = container.querySelector('#inputs-form');
    if (!formContainer) return;

    formContainer.innerHTML = '';

    schema.forEach(input => {
      const field = createFormField(input);
      formContainer.appendChild(field);
    });

    // Brand context inputs
    if (currentTemplate.includeBrandContext) {
      const brandContainer = container.querySelector('#brand-form');
      if (brandContainer) {
        brandContainer.innerHTML = '';

        const brandFields = [
          { name: 'brandName', type: 'text', label: 'Brand Name', placeholder: 'Your brand name' },
          { name: 'brandVoice', type: 'select', label: 'Brand Voice', options: Object.values(BRAND_VOICES).map(v => v.id) },
          { name: 'targetAudience', type: 'select', label: 'Target Audience', options: Object.values(TARGET_AUDIENCES).map(a => a.id) }
        ];

        brandFields.forEach(input => {
          const field = createFormField(input);
          brandContainer.appendChild(field);
        });
      }
    }
  }

  function createFormField(input) {
    const field = document.createElement('div');
    field.className = 'space-y-1.5';

    const label = document.createElement('label');
    label.className = 'block text-xs font-bold text-white uppercase tracking-wider';
    label.textContent = input.label;
    if (input.required) {
      label.innerHTML += ' <span class="text-primary">*</span>';
    }
    field.appendChild(label);

    switch (input.type) {
      case 'text':
      case 'number':
        const textInput = document.createElement('input');
        textInput.type = input.type;
        textInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-muted focus:outline-none focus:border-primary/50';
        textInput.placeholder = input.placeholder || '';
        textInput.value = currentInputs[input.name] || '';
        textInput.min = input.min;
        textInput.max = input.max;
        textInput.oninput = () => {
          currentInputs[input.name] = textInput.value;
          updatePromptPreview();
        };
        field.appendChild(textInput);
        break;

      case 'textarea':
        const textarea = document.createElement('textarea');
        textarea.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-muted focus:outline-none focus:border-primary/50 resize-none';
        textarea.placeholder = input.placeholder || '';
        textarea.rows = 3;
        textarea.value = currentInputs[input.name] || '';
        textarea.oninput = () => {
          currentInputs[input.name] = textarea.value;
          updatePromptPreview();
        };
        field.appendChild(textarea);
        break;

      case 'select':
        const select = document.createElement('select');
        select.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary/50';
        
        if (input.options && input.options.length > 0) {
          input.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = typeof opt === 'string' ? opt : opt.id || opt;
            option.textContent = typeof opt === 'string' ? opt : opt.name || opt;
            if (currentInputs[input.name] === option.value) {
              option.selected = true;
            }
            select.appendChild(option);
          });
        }

        select.onchange = () => {
          currentInputs[input.name] = select.value;
          updatePromptPreview();
        };
        field.appendChild(select);
        break;

      case 'checkbox':
        const checkbox = document.createElement('label');
        checkbox.className = 'flex items-center gap-3 cursor-pointer';
        
        const checkInput = document.createElement('input');
        checkInput.type = 'checkbox';
        checkInput.checked = currentInputs[input.name] || false;
        checkInput.className = 'w-5 h-5 rounded bg-white/5 border border-white/10 text-primary focus:ring-primary';
        checkInput.onchange = () => {
          currentInputs[input.name] = checkInput.checked;
          updatePromptPreview();
        };
        
        const checkSpan = document.createElement('span');
        checkSpan.className = 'text-sm text-white';
        checkSpan.textContent = input.checkboxLabel || '';
        
        checkbox.appendChild(checkInput);
        checkbox.appendChild(checkSpan);
        field.appendChild(checkbox);
        break;
    }

    // GTM Boost affordance for the primary user prompt field.
    // Mirrors ImageStudio / VideoStudio: shared `.gtm-boost-btn shrink-0` design,
    // themed via the `cinema-template-studio` app theme. Placed next to the main
    // prompt input (the primary describe/prompt field, not other per-input fields).
    const isPrimaryPromptField =
      input.name === 'prompt' &&
      (input.type === 'textarea' || input.type === 'text');
    if (isPrimaryPromptField) {
      // The editable element for this field is the last child appended above.
      const promptEl = field.querySelector('textarea, input');

      const gtmBtn = document.createElement('button');
      gtmBtn.type = 'button';
      gtmBtn.textContent = '🎯 GTM Boost';
      gtmBtn.title = 'Enhance your prompt with GTM conversion frameworks';
      gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
      gtmBtn.className = 'gtm-boost-btn shrink-0';
      gtmBtn.addEventListener('click', () => {
        import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
          openGTMPromptModal('cinema-template-studio', (prompt) => {
            const ta = promptEl || field.querySelector('textarea, input');
            if (ta) {
              ta.value = prompt;
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              ta.focus();
            }
          });
        }).catch((err) => console.error('[CinemaTemplateStudio] GTM Boost failed:', err));
      });
      field.appendChild(gtmBtn);
    }

    return field;
  }

  function updatePromptPreview() {
    const preview = container.querySelector('#prompt-preview');
    if (!preview) return;

    try {
      const engine = new PromptAssemblyEngine(
        currentTemplate,
        currentInputs,
        {},
        { mode: currentMode }
      );
      preview.textContent = engine.assemble();
    } catch (e) {
      preview.textContent = 'Enter details to generate prompt...';
    }

    // Update CTA preview
    const ctaPreview = container.querySelector('#cta-preview');
    if (ctaPreview && currentTemplate.includeCTA) {
      const ctaType = currentInputs.ctaType;
      if (ctaType && CTA_TYPES[ctaType.toUpperCase().replace(/ /g, '_')]) {
        ctaPreview.textContent = CTA_TYPES[ctaType.toUpperCase().replace(/ /g, '_')].name;
      } else {
        ctaPreview.textContent = 'Not selected - CTA will not appear';
      }
    }
  }

  function generateVideo() {
    // Validate inputs
    const formBuilder = new TemplateInputBuilder(currentTemplate, currentMode);
    const errors = formBuilder.validateInputs(currentInputs);
    
    if (errors.length > 0) {
      showToast(`Please fill in required fields: ${errors.map(e => e.field).join(', ')}`, 'error');
      return;
    }

    // Add to recent
    TemplateStorage.addToRecent(currentTemplate.id, currentInputs);

    // Generate render handoff
    const handoff = new RenderHandoff(
      currentTemplate,
      currentInputs,
      sceneBuilder?.getScenes() || [],
      { mode: currentMode }
    );

    // Store handoff for render engine
    try {
      sessionStorage.setItem('cinematic_render_handoff', handoff.toJSON());
    } catch (error) {
      console.warn('[CinemaTemplateStudio] Failed to store render handoff in sessionStorage:', error);
    }

    // Navigate to render/preview
    view = 'preview';
    render();
  }

  // ================================
  // STORYBOARD VIEW
  // ================================
  function renderStoryboardView() {
    if (!currentTemplate || !storyboardBuilder) return;

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-4 border-b border-white/10 bg-black/50';
    header.innerHTML = `
      <div class="flex items-center gap-4">
        <button id="back-btn" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-xl">
            🎨
          </div>
          <div>
            <h1 class="text-xl font-black text-white">Storyboard</h1>
            <p class="text-xs text-secondary">${currentTemplate.name}</p>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button id="auto-generate-btn" class="px-4 py-2 bg-primary text-black text-xs font-bold rounded-lg hover:scale-105 transition-transform">
          ✨ Auto-Generate
        </button>
        <button id="export-btn" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-secondary text-sm rounded-lg transition-colors">
          📤 Export
        </button>
      </div>
    `;
    container.appendChild(header);

    // Storyboard canvas
    const canvas = document.createElement('div');
    canvas.className = 'flex-1 overflow-auto p-6';
    canvas.innerHTML = `
      <div id="storyboard-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <!-- Storyboards will be rendered here -->
      </div>
    `;
    container.appendChild(canvas);

    // Empty state
    const emptyState = container.querySelector('#storyboard-grid');
    if (storyboardBuilder.getBoards().length === 0) {
      emptyState.innerHTML = `
        <div class="col-span-full text-center py-16">
          <div class="text-6xl mb-4">🎨</div>
          <h3 class="text-xl font-bold text-white mb-2">Start Your Storyboard</h3>
          <p class="text-secondary mb-6">Add shots to create your visual story sequence</p>
          <button id="auto-generate-empty-btn" class="px-6 py-3 bg-primary text-black font-bold rounded-xl hover:scale-105 transition-transform">
            ✨ Auto-Generate from Template
          </button>
        </div>
      `;
    } else {
      renderStoryboardPanels();
    }

    // Event listeners
    container.querySelector('#back-btn').onclick = () => {
      view = 'create';
      render();
    };

    container.querySelector('#export-btn')?.addEventListener('click', () => {
      const text = storyboardBuilder.exportAsText();
      navigator.clipboard.writeText(text);
      showToast('Storyboard copied to clipboard!', 'success');
    });

    const autoGenBtn = container.querySelector('#auto-generate-btn') || container.querySelector('#auto-generate-empty-btn');
    autoGenBtn?.addEventListener('click', () => {
      autoGenerateStoryboard();
    });

    // Prompt Gallery button
    const promptGalleryBtn = document.createElement('button');
    promptGalleryBtn.type = 'button';
    promptGalleryBtn.textContent = '📚 Prompts';
    promptGalleryBtn.title = 'Browse prompt gallery';
    promptGalleryBtn.setAttribute('aria-label', 'Open prompt gallery');
    promptGalleryBtn.className = 'gtm-boost-btn shrink-0';
    promptGalleryBtn.addEventListener('click', () => {
      openPromptGallery({
        appTheme: 'cinema-template-studio',
        onSelect: (prompt) => {
          // Default: try to find a textarea in the studio
          const ta = document.querySelector('textarea') || document.querySelector('[data-prompt]');
          if (ta) {
            ta.value = prompt;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.focus();
          }
        }
      }).catch((err) => console.error('[PromptGallery] open failed:', err));
    });

    // Recipe Engine button
    const recipeBtn = document.createElement('button');
    recipeBtn.type = 'button';
    recipeBtn.textContent = '📋 Recipes';
    recipeBtn.title = 'Browse AI recipes';
    recipeBtn.setAttribute('aria-label', 'Open recipe engine');
    recipeBtn.className = 'gtm-boost-btn shrink-0';
    recipeBtn.addEventListener('click', () => {
      openRecipeModal({
        onRunRecipe: (url) => {
        }
      }).catch((err) => console.error('[Recipe] open failed:', err));
    });

    // Monetization Hub button
    const monetizationBtn = document.createElement('button');
    monetizationBtn.type = 'button';
    monetizationBtn.textContent = "💼 Smart Video AI Monetize";
    monetizationBtn.title = "Open Smart Video AI Monetization Hub";
    monetizationBtn.setAttribute('aria-label', 'Open Smart Video AI Monetization Hub');
    monetizationBtn.className = 'gtm-boost-btn shrink-0';
    monetizationBtn.addEventListener('click', () => {
      openMonetizationHub().catch((err) => console.error('[Monetization] open failed:', err));
    });
    container.appendChild(recipeBtn);
    container.appendChild(monetizationBtn);

    // Model Picker button
    const modelPickerBtn = document.createElement('button');
    modelPickerBtn.type = 'button';
    modelPickerBtn.textContent = '🤖 AI Pick';
    modelPickerBtn.title = 'Compare and pick models';
    modelPickerBtn.setAttribute('aria-label', 'Open model picker');
    modelPickerBtn.className = 'gtm-boost-btn shrink-0';
    modelPickerBtn.addEventListener('click', () => {
      openModelPicker({
        onSelect: (model) => {
          if (model?.id) {
            showToast('Model selected: ' + model.id, 'success');
          }
        }
      }).catch((err) => console.error('[ModelPicker] open failed:', err));
    });
    container.appendChild(modelPickerBtn);
  }

  function autoGenerateStoryboard() {
    if (!sceneBuilder || !storyboardBuilder) return;

    // Build scenes first if not already built
    if (sceneBuilder.getScenes().length === 0) {
      const engine = new PromptAssemblyEngine(currentTemplate, currentInputs, {}, { mode: currentMode });
      const sceneData = engine.assembleScenePrompts();
      sceneData.forEach(scene => {
        sceneBuilder.addScene({
          sceneNumber: scene.sceneNumber,
          beat: `Scene ${scene.sceneNumber}`,
          duration: scene.duration,
          shots: scene.shots
        });
      });
    }

    // Generate storyboard from scenes
    storyboardBuilder.generateFromScenes(sceneBuilder.getScenes());
    renderStoryboardPanels();
    showToast('Storyboard generated!', 'success');
  }

  function renderStoryboardPanels() {
    const grid = container.querySelector('#storyboard-grid');
    if (!grid || !storyboardBuilder) return;

    grid.innerHTML = '';
    const boards = storyboardBuilder.getBoards();

    boards.forEach((board, index) => {
      const panel = document.createElement('div');
      panel.className = 'bg-white/5 border border-white/10 rounded-xl overflow-hidden';

      // Panel header
      const header = document.createElement('div');
      header.className = 'bg-white/5 px-3 py-2 flex items-center justify-between';
      header.innerHTML = `
        <span class="text-xs font-bold text-white">Board ${board.order}</span>
        <button class="delete-board-btn text-white/30 hover:text-red-400 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      `;
      panel.appendChild(header);

      // Preview area
      const preview = document.createElement('div');
      preview.className = 'aspect-video bg-black/50 flex items-center justify-center';
      preview.innerHTML = `
        <div class="text-center">
          <div class="text-2xl mb-1">${board.shotType ? SHOT_TYPES[board.shotType.toUpperCase().replace(/ /g, '_')]?.name?.charAt(0) || '📷' : '📷'}</div>
          <div class="text-[10px] text-white/40">${board.shotType ? SHOT_TYPES[board.shotType.toUpperCase().replace(/ /g, '_')]?.name : 'Select shot'}</div>
        </div>
      `;
      panel.appendChild(preview);

      // Shot info
      const info = document.createElement('div');
      info.className = 'p-3 space-y-2';
      info.innerHTML = `
        <div class="text-[10px] text-secondary">Scene ${board.sceneNumber} - Shot ${board.shotNumber}</div>
        <div class="text-xs text-white truncate">${board.description || 'No description'}</div>
        <div class="flex gap-1 flex-wrap">
          <span class="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/60">${board.cameraMovement ? (CAMERA_MOVEMENTS[board.cameraMovement.toUpperCase().replace(/ /g, '_')]?.name || 'Static') : 'Static'}</span>
        </div>
      `;
      panel.appendChild(info);

      // Edit on click
      panel.onclick = (e) => {
        if (e.target.closest('.delete-board-btn')) {
          storyboardBuilder.removeBoard(board.id);
          renderStoryboardPanels();
          return;
        }
        openBoardEditor(board);
      };

      grid.appendChild(panel);
    });
  }

  function openBoardEditor(board) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4';
    
    const modal = document.createElement('div');
    modal.className = 'w-full max-w-lg bg-[#1a1a1a] border border-white/10 rounded-2xl p-6';
    
    modal.innerHTML = `
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-bold text-white">Edit Board ${board.order}</h3>
        <button id="close-modal-btn" class="text-white/50 hover:text-white transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-white uppercase mb-1.5">Shot Type</label>
            <select id="edit-shot-type" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
              ${Object.entries(SHOT_TYPES).map(([key, val]) => 
                `<option value="${key}" ${board.shotType === key ? 'selected' : ''}>${val.name}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-white uppercase mb-1.5">Camera Movement</label>
            <select id="edit-camera-movement" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
              ${Object.entries(CAMERA_MOVEMENTS).map(([key, val]) => 
                `<option value="${key}" ${board.cameraMovement === key ? 'selected' : ''}>${val.name}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        
        <div>
          <label class="block text-xs font-bold text-white uppercase mb-1.5">Description</label>
          <textarea id="edit-description" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none" rows="2">${escapeHtml(board.description || '')}</textarea>
        </div>

        <div>
          <label class="block text-xs font-bold text-white uppercase mb-1.5">Visual Notes</label>
          <textarea id="edit-visual-notes" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none" rows="2">${escapeHtml(board.visualNotes || '')}</textarea>
        </div>
      </div>
      
      <div class="mt-6 flex gap-3">
        <button id="save-board-btn" class="flex-1 py-2.5 bg-primary text-black font-bold text-sm rounded-xl hover:scale-[1.02] transition-transform">
          Save Changes
        </button>
        <button id="cancel-board-btn" class="px-6 py-2.5 bg-white/5 text-white font-bold text-sm rounded-xl hover:bg-white/10 transition-colors">
          Cancel
        </button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Event listeners
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    };

    modal.querySelector('#close-modal-btn').onclick = () => overlay.remove();
    modal.querySelector('#cancel-board-btn').onclick = () => overlay.remove();

    modal.querySelector('#save-board-btn').onclick = () => {
      storyboardBuilder.updateBoard(board.id, {
        shotType: modal.querySelector('#edit-shot-type').value,
        cameraMovement: modal.querySelector('#edit-camera-movement').value,
        description: modal.querySelector('#edit-description').value,
        visualNotes: modal.querySelector('#edit-visual-notes').value
      });
      overlay.remove();
      renderStoryboardPanels();
      showToast('Board updated!', 'success');
    };
  }

  // ================================
  // PREVIEW VIEW
  // ================================
  function renderPreviewView() {
    let handoffJson;
    try {
      handoffJson = sessionStorage.getItem('cinematic_render_handoff');
    } catch (error) {
      console.warn('[CinemaTemplateStudio] Failed to read render handoff from sessionStorage:', error);
      handoffJson = null;
    }

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-4 border-b border-white/10 bg-black/50';
    header.innerHTML = `
      <div class="flex items-center gap-4">
        <button id="back-btn" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-xl">
            ✨
          </div>
          <div>
            <h1 class="text-xl font-bold text-white">Ready to Generate</h1>
            <p class="text-xs text-secondary">Review your settings and start generation</p>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button id="edit-btn" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-secondary text-sm rounded-lg transition-colors">
          ✏️ Edit
        </button>
        <button id="start-btn" class="px-6 py-2 bg-primary text-black font-bold text-sm rounded-xl hover:scale-105 transition-transform flex items-center gap-2">
          <span>🎬</span> Start Generation
        </button>
      </div>
    `;
    container.appendChild(header);

    // Content
    const content = document.createElement('div');
    content.className = 'flex-1 overflow-auto p-6';
    
    if (handoffJson) {
      let handoff;
      try {
        handoff = JSON.parse(handoffJson);
      } catch (error) {
        console.warn('[CinemaTemplateStudio] Failed to parse render handoff JSON:', error);
        handoff = null;
      }

      if (handoff) {
        content.innerHTML = `
        <div class="max-w-4xl mx-auto">
          <!-- Metadata -->
          <div class="bg-white/5 rounded-2xl p-6 mb-6">
            <h2 class="text-lg font-bold text-white mb-4">Project Summary</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div class="text-xs text-white/50 uppercase mb-1">Template</div>
                <div class="text-white font-bold">${escapeHtml(handoff.template?.name || 'N/A')}</div>
              </div>
              <div>
                <div class="text-xs text-white/50 uppercase mb-1">Duration</div>
                <div class="text-white font-bold">${handoff.template?.duration?.target || 0}s</div>
              </div>
              <div>
                <div class="text-xs text-white/50 uppercase mb-1">Aspect Ratio</div>
                <div class="text-white font-bold">${handoff.template?.aspectRatio || '16:9'}</div>
              </div>
              <div>
                <div class="text-xs text-white/50 uppercase mb-1">Output Style</div>
                <div class="text-white font-bold">${escapeHtml(handoff.template?.outputStyle || 'Cinematic')}</div>
              </div>
            </div>
          </div>
          
          <!-- Prompts -->
          <div class="bg-white/5 rounded-2xl p-6 mb-6">
            <h2 class="text-lg font-bold text-white mb-4">Generated Prompts</h2>
            <div class="space-y-4">
              ${(handoff.prompts || []).map((p, i) => `
                <div class="bg-black/30 rounded-xl p-4">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-primary uppercase">${p.sceneNumber ? `Scene ${p.sceneNumber}` : 'Main Prompt'}</span>
                    ${p.duration ? `<span class="text-xs text-white/50">${p.duration}s</span>` : ''}
                  </div>
                  <p class="text-sm text-white/80 leading-relaxed">${escapeHtml(p.prompt)}</p>
                </div>
              `).join('')}
            </div>
          </div>
          
          <!-- Scenes -->
          ${handoff.scenes ? `
            <div class="bg-white/5 rounded-2xl p-6 mb-6">
              <h2 class="text-lg font-bold text-white mb-4">Scene Breakdown</h2>
              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                ${handoff.scenes.map(s => `
                  <div class="bg-black/30 rounded-xl p-3">
                    <div class="text-xs font-bold text-primary mb-1">Scene ${s.number}</div>
                    <div class="text-sm text-white truncate mb-1">${escapeHtml(s.name)}</div>
                    <div class="text-xs text-white/50">${s.shots?.length || 0} shots • ${s.duration?.toFixed(0) || 0}s</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <!-- Technical Specs -->
          <div class="bg-white/5 rounded-2xl p-6">
            <h2 class="text-lg font-bold text-white mb-4">Technical Specifications</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div class="text-xs text-white/50 uppercase mb-1">Resolution</div>
                <div class="text-white">${handoff.technicalSpecs?.resolution || '4K'}</div>
              </div>
              <div>
                <div class="text-xs text-white/50 uppercase mb-1">Format</div>
                <div class="text-white">${handoff.output?.format || 'MP4'}</div>
              </div>
              <div>
                <div class="text-xs text-white/50 uppercase mb-1">Codec</div>
                <div class="text-white">${handoff.output?.codec || 'H.264'}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      content.innerHTML = `
        <div class="max-w-2xl mx-auto text-center py-16">
          <div class="text-6xl mb-4">📋</div>
          <h3 class="text-xl font-bold text-white mb-2">No Project Data</h3>
          <p class="text-secondary mb-6">Go back and create a new project</p>
          <button id="back-to-create-btn" class="px-6 py-3 bg-primary text-black font-bold rounded-xl hover:scale-105 transition-transform">
            Create New Project
          </button>
        </div>
      `;
    }
    
    container.appendChild(content);

    // Event listeners
    container.querySelector('#back-btn').onclick = () => {
      view = 'browse';
      render();
    };

    container.querySelector('#edit-btn')?.addEventListener('click', () => {
      view = 'create';
      render();
    });

    container.querySelector('#start-btn')?.addEventListener('click', () => {
      showToast('Starting generation process...', 'success');
      // Here you would integrate with the actual video generation engine
      // For now, we just show a toast
    });

    container.querySelector('#back-to-create-btn')?.addEventListener('click', () => {
      view = 'browse';
      render();
    });
  }

  return container;
}
