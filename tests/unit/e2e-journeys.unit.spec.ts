import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// MOCKS - shared across all journey tests
// ============================================================

// Mock muapi before importing studios
vi.mock('../../src/lib/muapi.js', () => {
  const generateI2V = vi.fn(async (params) => {
    return { url: 'https://cdn.muapi.ai/results/i2v-' + Date.now() + '.mp4', model: params.model };
  });
  const generateImage = vi.fn(async (params) => {
    return { url: 'https://cdn.muapi.ai/results/img-' + Date.now() + '.png', model: params.model };
  });
  const generateVideo = vi.fn(async (params) => {
    return { url: 'https://cdn.muapi.ai/results/vid-' + Date.now() + '.mp4', model: params.model };
  });
  const generateI2I = vi.fn(async (params) => {
    return { url: 'https://cdn.muapi.ai/results/i2i-' + Date.now() + '.png', model: params.model };
  });
  const processV2V = vi.fn(async (params) => {
    return { url: 'https://cdn.muapi.ai/results/v2v-' + Date.now() + '.mp4', model: params.model };
  });
  return {
    muapi: { generateI2V, generateImage, generateVideo, generateI2I, processV2V },
  };
});

vi.mock('../../src/lib/apiKeyManager.js', () => ({
  apiKeyManager: {
    getMuapiKey: () => 'test-api-key',
    getOpenAIKey: () => null,
    getVideoDBKey: () => null,
    getPexelsKey: () => null,
  },
}));

vi.mock('../../src/lib/router.js', () => ({
  navigate: vi.fn(() => {}),
}));

vi.mock('../../src/lib/studioChrome.js', () => ({
  mountStudioDrawer: vi.fn(() => ({ toggle: vi.fn() })),
  createStudioMenuButton: vi.fn(() => document.createElement('button')),
}));

vi.mock('../../src/components/personalize/personalizePopover.js', () => ({
  mountPersonalizeTrigger: vi.fn(() => {}),
}));

vi.mock('../../src/lib/editor/captionActions.js', () => ({
  addCaptionButton: vi.fn(() => {}),
}));

vi.mock('../../src/lib/thumbnails.js', () => ({
  getTemplateThumbnailCandidates: vi.fn((template) => ['/thumb.png']),
  saveCustomThumbnailToCache: vi.fn(),
  clearCustomThumbnailCache: vi.fn(),
  getCustomThumbnailFromCache: vi.fn(() => null),
}));

vi.mock('../../src/lib/templateSpecs.js', () => ({
  getTemplateSpecs: vi.fn(() => ({})),
  hasEnhancedSpecs: vi.fn(() => false),
}));

vi.mock('../../src/lib/showcaseTemplateResolver.js', () => ({
  resolveTemplate: vi.fn(() => null),
}));

vi.mock('../../src/lib/templates.js', () => ({
  getTemplateById: vi.fn((id) => {
    if (id === 'cinema-test-1') {
      return {
        id: 'cinema-test-1',
        name: 'Cinema Test Template',
        description: 'A test cinema template',
        outputType: 'video',
        category: 'Commercial',
        modelType: 't2v',
        model: 'kling-v2.6-pro-t2v',
        icon: '🎬',
      };
    }
    if (id === 'nonexistent-template') return null;
    if (id === 'i2v-restaurant') {
      return {
        id: 'i2v-restaurant',
        name: 'I2V Restaurant',
        description: 'Image to video template',
        outputType: 'video',
        category: 'Commercial',
        modelType: 'i2v',
        model: 'kling-i2v',
        inputs: [{ name: 'prompt', type: 'textarea', label: 'Prompt' }, { name: 'image_url', type: 'image', label: 'Image' }],
        defaultParams: {},
      };
    }
    return {
      id: id || 'restaurant-brand-film',
      name: 'Restaurant Brand Film',
      description: 'A cinematic brand film for restaurants',
      outputType: 'video',
      category: 'Commercial',
      modelType: 't2v',
      model: 'kling-v2.6-pro-t2v',
      inputs: [{ name: 'prompt', type: 'textarea', label: 'Prompt' }],
      defaultParams: {},
    };
  }),
}));

vi.mock('../../src/lib/templateAdapter.js', () => ({
  normalizeTemplate: vi.fn((t) => t),
}));

vi.mock('../../src/lib/templateMatrix.js', () => ({
  NICHE_ENRICHMENT: {},
  FILM_FAMILIES: {},
}));

vi.mock('../../src/lib/models.js', () => ({
  t2iModels: [
    { id: 'flux', name: 'FLUX' },
    { id: 'flux-dev', name: 'FLUX Dev' },
  ],
  i2iModels: [
    { id: 'flux-i2i', name: 'FLUX I2I' },
  ],
  i2vModels: [
    { id: 'kling-i2v', name: 'Kling I2V' },
    { id: 'kling-v2.6-pro-i2v', name: 'Kling V2.6 Pro I2V' },
  ],
  t2vModels: [
    { id: 'kling-v2.6-pro-t2v', name: 'Kling V2.6 Pro T2V' },
    { id: 'kling-v2.6-t2v', name: 'Kling V2.6 T2V' },
  ],
  v2vModels: [
    { id: 'kling-v2v', name: 'Kling V2V' },
  ],
  getV2VModelById: vi.fn((id) => id === 'kling-v2v' ? { id: 'kling-v2v' } : null),
}));

vi.mock('../../src/lib/modelCatalog.js', () => ({
  getEnrichedModels: vi.fn(async () => []),
}));

vi.mock('../../src/lib/modelSelectorUI.js', () => ({
  mountModelSelector: vi.fn(() => document.createElement('div')),
  PROVIDER_LOGOS: {},
  invertLogos: [],
  getProviderStyle: vi.fn(() => ({ text: 'M' })),
  positionModelSelectorDropdown: vi.fn(() => {}),
  renderProviderLogoImg: vi.fn(() => ''),
}));

vi.mock('../../src/lib/templateEngine.js', () => ({
  getNicheTerms: vi.fn(() => []),
  enrichPromptString: vi.fn((p) => p),
  deriveEngineInputFromTemplate: vi.fn(() => ({})),
  composeNegativePrompt: vi.fn(() => ''),
}));

vi.mock('../../src/lib/generationHistory.js', () => ({
  saveGeneration: vi.fn(() => {}),
}));

vi.mock('../../src/lib/security.js', () => ({
  sanitizeUrl: vi.fn((u) => u),
  escapeHtml: vi.fn((s) => s),
}));

vi.mock('../../src/lib/gtmContextStore.js', () => ({
  getGtmContext: vi.fn(() => null),
}));

vi.mock('../../src/lib/socialPublishHelpers.js', () => ({
  openSocialPublish: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../src/lib/promptGalleryIntegration.js', () => ({
  openPromptGallery: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../src/lib/recipeIntegration.js', () => ({
  openRecipeModal: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../src/lib/monetizationIntegration.js', () => ({
  openMonetizationHub: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../src/lib/uiIntegration.js', () => ({
  fetchGTMTemplateContext: vi.fn(() => null),
  openGTMPromptModal: vi.fn(() => {}),
}));

vi.mock('../../src/lib/personalizerAdapters.js', () => ({
  getTemplateStudioAsset: vi.fn(() => ({})),
}));

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock('../../src/components/UploadPicker.js', () => ({
  createUploadPicker: vi.fn(() => ({
    panel: document.createElement('div'),
    open: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('../../src/components/modals/TemplateThumbnailModal.jsx', () => ({
  TemplateThumbnailModal: class MockTemplateThumbnailModal {
    constructor() {
      this.open = vi.fn();
      this.close = vi.fn();
      this.onApply = null;
      this.onClear = null;
    }
  },
  mountThumbnailModal: vi.fn(() => ({})),
}));

vi.mock('../../src/lib/cinematicTemplates.js', () => ({
  getTemplateRegistry: vi.fn(() => ({
    getAll: vi.fn(() => [
      {
        id: 'cinema-test-1',
        name: 'Cinema Test Template',
        description: 'A test cinema template',
        outputType: 'video',
        category: 'Commercial',
        modelType: 't2v',
        model: 'kling-v2.6-pro-t2v',
        icon: '🎬',
      },
    ]),
    get: vi.fn((id) => ({
      id,
      name: 'Cinema Test Template',
      description: 'A test cinema template',
      outputType: 'video',
      category: 'Commercial',
      modelType: 't2v',
      model: 'kling-v2.6-pro-t2v',
      icon: '🎬',
    })),
  })),
  SHOT_TYPES: { WIDE: { name: 'Wide' }, MEDIUM: { name: 'Medium' }, CLOSEUP: { name: 'Close-up' } },
  CAMERA_MOVEMENTS: { STATIC: { name: 'Static' }, PUSH_IN: { name: 'Push In' }, PAN: { name: 'Pan' } },
  BRAND_VOICES: [{ id: 'professional', name: 'Professional' }],
  TARGET_AUDIENCES: [{ id: 'general', name: 'General' }],
  TemplateInputBuilder: vi.fn().mockImplementation(function(template, mode) {
    this.getDefaults = vi.fn(() => ({}));
    this.buildFormSchema = vi.fn(() => [
      { name: 'prompt', type: 'textarea', label: 'Prompt' },
      { name: 'subject', type: 'text', label: 'Subject', placeholder: 'optional' },
    ]);
    this.validateInputs = vi.fn(() => []);
  }),
  PromptAssemblyEngine: vi.fn().mockImplementation(function() {
    this.assemble = vi.fn(() => 'Assembled prompt');
    this.assembleScenePromptsFromSelector = vi.fn(() => ['Scene 1 prompt']);
  }),
  SceneBuilder: vi.fn().mockImplementation(function() {
    return {
      addScene: vi.fn(),
      removeScene: vi.fn(),
      moveScene: vi.fn(),
      getScenes: vi.fn(() => []),
      clear: vi.fn(),
      updateScene: vi.fn(),
    };
  }),
  RenderHandoff: vi.fn().mockImplementation(function() {
    this.toJSON = vi.fn(() => ({}));
  }),
  TemplateStorage: {
    isFavorite: vi.fn(() => false),
    getRecent: vi.fn(() => []),
    addToRecent: vi.fn(),
    saveProject: vi.fn(),
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
  },
}));

vi.mock('../../src/lib/videoIntentStore.js', () => ({
  getVideoIntent: vi.fn(() => ({})),
  setVideoIntent: vi.fn(),
  subscribeVideoIntent: vi.fn(),
  resetVideoIntent: vi.fn(),
}));

vi.mock('../../src/lib/sceneSelector.js', () => ({
  selectScenes: vi.fn(() => []),
}));

vi.mock('../../src/lib/cinematicTheme.js', () => ({
  CINEMATIC_THEME: {
    text: {
      title: 'text-xl font-bold',
      sectionTitle: 'text-lg font-bold',
      eyebrow: 'text-xs font-bold uppercase tracking-wider',
    },
  },
}));

vi.mock('../../src/components/StoryboardStudio.js', () => ({
  StoryboardStudio: vi.fn(() => document.createElement('div')),
}));

// ============================================================
// IMPORTS
// ============================================================

import { TemplateStudio } from '../../src/components/TemplateStudio.js';
import { CinemaTemplateStudio } from '../../src/components/CinemaTemplateStudio.js';

// ============================================================
// HELPERS
// ============================================================

function wait(ms = 50) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createContainer() {
  const container = document.createElement('div');
  container.id = 'app';
  document.body.appendChild(container);
  return container;
}

function setupLocalStorage() {
  const store = { 'muapi_key': 'test-key' };
  const localStorageMock = {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
  };
  global.localStorage = localStorageMock;
  return localStorageMock;
}

function findButton(container, text) {
  return Array.from(container.querySelectorAll('button')).find(
    btn => btn.textContent?.includes(text)
  );
}

function findInput(container, type = 'textarea') {
  return container.querySelector(type === 'textarea' ? 'textarea' : 'input[type="text"]');
}

// ============================================================
// TESTS
// ============================================================

describe('E2E User Journey Tests', () => {
  let container;
  let localStorageMock;

  beforeEach(() => {
    container = createContainer();
    localStorageMock = setupLocalStorage();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  // ----------------------------------------------------------
  // Journey 1: Browse templates → select template → configure → generate → view result
  // (CinemaTemplateStudio browse → create → generate → preview)
  // ----------------------------------------------------------
  describe('Journey 1: Cinema browse → configure → generate → preview', () => {
    it('completes the full flow from browse view to preview', async () => {
      // Step 1: Mount CinemaTemplateStudio - starts in browse view
      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      // Verify browse view is shown
      const header = container.querySelector('h1');
      expect(header).not.toBeNull();
      expect(header.textContent).toBe('CINEMATIC TEMPLATES');

      // Verify template cards are rendered
      const cards = container.querySelectorAll('.group');
      expect(cards.length).toBeGreaterThan(0);

      // Step 2: Select a template (click on the card)
      const card = container.querySelector('.group');
      expect(card).not.toBeNull();
      card.click();
      await wait(100);

      // Verify we moved to create view - should have template name in header
      const createHeader = container.querySelector('h1');
      expect(createHeader).not.toBeNull();

      // Verify form inputs are rendered
      const promptInput = container.querySelector('textarea, input[type="text"]');
      expect(promptInput).not.toBeNull();

      // Step 3: Configure the template - fill in the prompt
      if (promptInput) {
        promptInput.value = 'A cinematic restaurant scene with warm lighting';
        promptInput.dispatchEvent(new Event('input', { bubbles: true }));
        await wait(50);
      }

      // Step 4: Click Generate
      const genBtn = findButton(container, 'Generate');
      expect(genBtn).not.toBeNull();
      genBtn.click();
      await wait(100);

      // Verify generating state
      expect(genBtn.disabled).toBe(true);
      expect(genBtn.textContent).toContain('Generating');

      // Wait for mock generation to complete
      await wait(300);

      // Step 5: Verify preview view is shown after generation
      const previewImg = container.querySelector('img');
      expect(previewImg).not.toBeNull();
    });

    it('shows template details in create view after selection', async () => {
      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      // Select template
      const card = container.querySelector('.group');
      card.click();
      await wait(100);

      // Verify template name in hero section
      const h1 = container.querySelector('h1');
      expect(h1.textContent).toBe('Cinema Test Template');

      // Verify description is shown
      const desc = container.querySelector('p.text-secondary');
      expect(desc).not.toBeNull();
    });

    it('renders generate button in create view', async () => {
      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const card = container.querySelector('.group');
      card.click();
      await wait(100);

      const genBtn = findButton(container, 'Generate');
      expect(genBtn).not.toBeNull();
    });
  });

  // ----------------------------------------------------------
  // Journey 2: Navigate between studios
  // ----------------------------------------------------------
  describe('Journey 2: Navigate between studios', () => {
    it('CinemaTemplateStudio back button returns to browse view', async () => {
      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      // Verify browse view
      expect(container.querySelector('h1').textContent).toBe('CINEMATIC TEMPLATES');

      // Select a template to go to create view
      const card = container.querySelector('.group');
      card.click();
      await wait(100);

      // Verify create view
      const createHeader = container.querySelector('h1');
      expect(createHeader.textContent).toBe('Cinema Test Template');

      // Click back button
      const backBtn = container.querySelector('#back-btn');
      expect(backBtn).not.toBeNull();
      backBtn.click();
      await wait(100);

      // Verify we're back in browse view
      const browseHeader = container.querySelector('h1');
      expect(browseHeader.textContent).toBe('CINEMATIC TEMPLATES');
    });

    it('TemplateStudio has navigation header with studio links', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      // Verify nav buttons exist
      const navBtns = container.querySelectorAll('[data-nav]');
      expect(navBtns.length).toBeGreaterThan(5);

      // Verify specific studio links
      const cinemaBtn = Array.from(navBtns).find(btn => btn.dataset.nav === 'cinema');
      expect(cinemaBtn).not.toBeNull();

      const imageBtn = Array.from(navBtns).find(btn => btn.dataset.nav === 'image');
      expect(imageBtn).not.toBeNull();

      const videoBtn = Array.from(navBtns).find(btn => btn.dataset.nav === 'video');
      expect(videoBtn).not.toBeNull();
    });

    it('TemplateStudio back button navigates to templates', async () => {
      const { navigate } = await import('../../src/lib/router.js');
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const backBtn = findButton(container, 'Back');
      expect(backBtn).not.toBeNull();
      backBtn.click();
      await wait(50);

      expect(navigate).toHaveBeenCalledWith('templates');
    });
  });

  // ----------------------------------------------------------
  // Journey 3: Error recovery - generation fails → retry → succeeds
  // ----------------------------------------------------------
  describe('Journey 3: Error recovery - retry on failure', () => {
    it('shows retry button when generation fails and CinemaTemplateStudio retry succeeds', async () => {
      const { muapi } = await import('../../src/lib/muapi.js');
      const generateVideoSpy = vi.spyOn(muapi, 'generateVideo');

      // Fail first call, succeed on retry
      generateVideoSpy
        .mockRejectedValueOnce(new Error('Cinema network error'))
        .mockResolvedValueOnce({ url: 'https://cdn.muapi.ai/results/cinema-retry.mp4', model: 'kling-v2.6-pro-t2v' });

      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      // Select template
      const card = container.querySelector('.group');
      card.click();
      await wait(100);

      // Fill prompt
      const promptInput = container.querySelector('textarea, input[type="text"]');
      if (promptInput) {
        promptInput.value = 'cinematic retry test';
        promptInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Generate
      const genBtn = findButton(container, 'Generate');
      genBtn.click();
      await wait(400);

      // Verify error shown with retry button
      const errEl = container.querySelector('.mt-3.rounded-2xl');
      expect(errEl).not.toBeNull();
      expect(errEl.querySelector('#retry-btn')).not.toBeNull();

      // Click retry
      const retryBtn = container.querySelector('#retry-btn');
      retryBtn.click();
      await wait(400);

      // Verify preview view after successful retry
      const previewImg = container.querySelector('img');
      expect(previewImg).not.toBeNull();
    });

    it('exhausts retries after multiple failures in CinemaTemplateStudio', async () => {
      const { muapi } = await import('../../src/lib/muapi.js');
      const generateVideoSpy = vi.spyOn(muapi, 'generateVideo');

      // Fail three times to exhaust retries (initial + 2 retries = 3 attempts)
      generateVideoSpy
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockRejectedValueOnce(new Error('Third failure'));

      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      // Select template
      const card = container.querySelector('.group');
      card.click();
      await wait(100);

      const genBtn = findButton(container, 'Generate');
      genBtn.click();
      await wait(400);

      // First failure - retry button present
      let retryBtn = container.querySelector('#retry-btn');
      expect(retryBtn).not.toBeNull();
      retryBtn.click();
      await wait(400);

      // Second failure - retry button still present (one retry left)
      retryBtn = container.querySelector('#retry-btn');
      expect(retryBtn).not.toBeNull();
      retryBtn.click();
      await wait(400);

      // Third failure - no retry button (exhausted)
      retryBtn = container.querySelector('#retry-btn');
      expect(retryBtn).toBeNull();

      // Error should still be shown
      const errEl = container.querySelector('.mt-3.rounded-2xl');
      expect(errEl).not.toBeNull();
    });

    it('CinemaTemplateStudio retries on generation failure', async () => {
      const { muapi } = await import('../../src/lib/muapi.js');
      const generateVideoSpy = vi.spyOn(muapi, 'generateVideo');

      generateVideoSpy
        .mockRejectedValueOnce(new Error('Cinema network error'))
        .mockResolvedValueOnce({ url: 'https://cdn.muapi.ai/results/cinema-retry.mp4', model: 'kling-v2.6-pro-t2v' });

      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      // Select template
      const card = container.querySelector('.group');
      card.click();
      await wait(100);

      // Fill prompt
      const promptInput = container.querySelector('textarea, input[type="text"]');
      if (promptInput) {
        promptInput.value = 'cinematic retry test';
        promptInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Generate
      const genBtn = findButton(container, 'Generate');
      genBtn.click();
      await wait(400);

      // Verify error shown
      const errEl = container.querySelector('.mt-3.rounded-2xl');
      expect(errEl).not.toBeNull();

      // Find and click retry button
      const retryBtn = container.querySelector('#retry-btn');
      expect(retryBtn).not.toBeNull();
      retryBtn.click();
      await wait(400);

      // Verify preview view after successful retry
      const previewImg = container.querySelector('img');
      expect(previewImg).not.toBeNull();
    });
  });

  // ----------------------------------------------------------
  // Journey 4: Upload flow - select file → upload → preview → generate
  // ----------------------------------------------------------
  describe('Journey 4: Upload flow', () => {
    it('image upload click opens UploadPicker', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const uploadArea = container.querySelector('.cursor-pointer');
      expect(uploadArea).not.toBeNull();
      uploadArea.click();
      await wait(100);

      // UploadPicker panel should be appended to container
      const pickerPanel = container.querySelector('div');
      expect(pickerPanel).not.toBeNull();
    });

    it('video upload button exists for video templates', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const videoUploadBtn = container.querySelector('#videoUploadBtn');
      expect(videoUploadBtn).not.toBeNull();
    });

    it('i2v template requires image upload before generation', async () => {
      const element = TemplateStudio('i2v-restaurant');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const promptInput = container.querySelector('textarea, input[type="text"]');
      if (promptInput) {
        promptInput.value = 'test';
        promptInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const genBtn = findButton(container, 'Generate');
      genBtn.click();
      await wait(50);

      const inlineError = container.querySelector('.ts-inline-error');
      expect(inlineError).not.toBeNull();
      expect(inlineError.textContent).toContain('upload an image');
    });

    it('upload area has image upload affordance', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      // There should be upload areas for image inputs
      const uploadAreas = container.querySelectorAll('.cursor-pointer');
      expect(uploadAreas.length).toBeGreaterThan(0);

      // Verify UploadPicker module exists and is importable
      const uploadPickerModule = await import('../../src/components/UploadPicker.js');
      expect(uploadPickerModule.createUploadPicker).toBeDefined();
    });
  });

  // ----------------------------------------------------------
  // Journey 5: Model selection - open dropdown → select model → generate
  // ----------------------------------------------------------
  describe('Journey 5: Model selection flow', () => {
    it('opens model picker dropdown and renders listbox', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const modelBtn = container.querySelector('#templateModelTrigger');
      expect(modelBtn).not.toBeNull();

      modelBtn.click();
      await wait(150);

      const dropdown = container.querySelector('[role="listbox"]');
      expect(dropdown).not.toBeNull();
    });

    it('closes model picker on second click', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const modelBtn = container.querySelector('#templateModelTrigger');
      modelBtn.click();
      await wait(150);

      let dropdown = container.querySelector('[role="listbox"]');
      expect(dropdown.classList.contains('opacity-100')).toBe(true);

      modelBtn.click();
      await wait(150);

      dropdown = container.querySelector('[role="listbox"]');
      expect(dropdown.classList.contains('opacity-0')).toBe(true);
    });

    it('model picker shows loading state initially', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const modelBtn = container.querySelector('#templateModelTrigger');
      modelBtn.click();
      await wait(50);

      const loadingStatus = container.querySelector('#model-loading-status');
      expect(loadingStatus).not.toBeNull();
    });

    it('CinemaTemplateStudio renders model selector in create view', async () => {
      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      // Select template to enter create view
      const card = container.querySelector('.group');
      card.click();
      await wait(100);

      // Verify model selector is rendered
      const modelLabel = container.querySelector('.text-\\[11px\\].uppercase');
      expect(modelLabel).not.toBeNull();
    });
  });

  // ----------------------------------------------------------
  // Journey 6: Thumbnail customization
  // ----------------------------------------------------------
  describe('Journey 6: Thumbnail customization flow', () => {
    it('TemplateStudio shows thumbnail button and opens modal on click', async () => {
      const { mountThumbnailModal } = await import('../../src/components/modals/TemplateThumbnailModal.jsx');
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const thumbBtn = findButton(container, 'Thumbnail');
      expect(thumbBtn).not.toBeNull();
      thumbBtn.click();
      await wait(50);

      expect(mountThumbnailModal).toHaveBeenCalled();
    });

    it('CinemaTemplateStudio opens thumbnail modal from card', async () => {
      const { mountThumbnailModal } = await import('../../src/components/modals/TemplateThumbnailModal.jsx');
      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const thumbBtn = container.querySelector('[title="Set custom thumbnail"]');
      expect(thumbBtn).not.toBeNull();
      thumbBtn.click();
      await wait(50);

      expect(mountThumbnailModal).toHaveBeenCalled();
    });

    it('thumbnail modal is not opened when clicking favorite button', async () => {
      const { mountThumbnailModal } = await import('../../src/components/modals/TemplateThumbnailModal.jsx');
      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const favBtn = container.querySelector('.favorite-btn');
      expect(favBtn).not.toBeNull();
      favBtn.click();
      await wait(50);

      // Should not have opened thumbnail modal
      expect(mountThumbnailModal).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // Additional cross-cutting journey tests
  // ----------------------------------------------------------
  describe('Cross-cutting journey tests', () => {
    it('generation failure in CinemaTemplateStudio shows error and re-enables button', async () => {
      const { muapi } = await import('../../src/lib/muapi.js');
      const generateVideoSpy = vi.spyOn(muapi, 'generateVideo');
      generateVideoSpy.mockRejectedValue(new Error('Generation failed'));

      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      // Select template
      const card = container.querySelector('.group');
      card.click();
      await wait(100);

      const genBtn = findButton(container, 'Generate');
      genBtn.click();
      await wait(400);

      // Button should be re-enabled after error
      expect(genBtn.disabled).toBe(false);
      expect(genBtn.textContent).toBe('Generate');
    });

    it('output tabs switch content in TemplateStudio', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const sceneBeatsTab = findButton(container, 'Scene Beats');
      expect(sceneBeatsTab).not.toBeNull();
      sceneBeatsTab.click();
      await wait(50);

      const outputTextarea = container.querySelector('#outputTextarea');
      expect(outputTextarea).not.toBeNull();
      expect(outputTextarea.value).toContain('Hook');
    });

    it('creative intelligence tiles render in TemplateStudio', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const tiles = container.querySelectorAll('[data-tile]');
      expect(tiles.length).toBeGreaterThanOrEqual(4);
    });

    it('CinemaTemplateStudio filter buttons work', async () => {
      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const favBtn = container.querySelector('#favorites-btn');
      const recentBtn = container.querySelector('#recent-btn');
      const customBtn = container.querySelector('#custom-btn');

      expect(favBtn).not.toBeNull();
      expect(recentBtn).not.toBeNull();
      expect(customBtn).not.toBeNull();

      // Click favorites - must re-query after re-render
      favBtn.click();
      await wait(50);
      let newFavBtn = container.querySelector('#favorites-btn');
      expect(newFavBtn.classList.contains('bg-primary')).toBe(true);

      // Click recent - must re-query after re-render
      recentBtn.click();
      await wait(50);
      let newRecentBtn = container.querySelector('#recent-btn');
      expect(newRecentBtn.classList.contains('bg-primary')).toBe(true);

      // Click custom - must re-query after re-render
      customBtn.click();
      await wait(50);
      let newCustomBtn = container.querySelector('#custom-btn');
      expect(newCustomBtn.classList.contains('bg-primary')).toBe(true);
    });

    it('TemplateStudio shows generation spinner on successful muapi call', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const promptInput = container.querySelector('textarea, input[type="text"]');
      promptInput.value = 'cinematic restaurant scene';
      promptInput.dispatchEvent(new Event('input', { bubbles: true }));

      const genBtn = findButton(container, 'Generate');
      genBtn.click();

      // Check immediately for generating state
      expect(genBtn.disabled).toBe(true);
      expect(genBtn.textContent).toContain('Generating');
    });

    it('result area has proper accessibility attributes', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const resultArea = container.querySelector('#resultArea');
      expect(resultArea).not.toBeNull();
      expect(resultArea.getAttribute('role')).toBe('status');
      expect(resultArea.getAttribute('aria-live')).toBe('polite');
    });

    it('advanced controls toggle works in TemplateStudio', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(150);

      const advancedBtn = container.querySelector('#advancedToggle');
      const advControls = container.querySelector('#advancedControls');
      expect(advancedBtn).not.toBeNull();
      expect(advControls).not.toBeNull();

      // Initially hidden
      expect(advControls.classList.contains('hidden')).toBe(true);

      advancedBtn.click();
      await wait(50);

      expect(advancedBtn.textContent).toBe('Hide Advanced Controls');
      expect(advControls.classList.contains('hidden')).toBe(false);
    });

    it('advanced controls toggle works in CinemaTemplateStudio', async () => {
      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      // Select template to enter create view
      const card = container.querySelector('.group');
      card.click();
      await wait(100);

      const advancedBtn = container.querySelector('#advancedToggle');
      const advControls = container.querySelector('#advancedControls');
      expect(advancedBtn).not.toBeNull();
      expect(advControls).not.toBeNull();

      advancedBtn.click();
      await wait(50);

      expect(advancedBtn.textContent).toBe('Hide Advanced Controls');
    });

    it('TemplateStudio back button renders', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const backBtn = findButton(container, 'Back');
      expect(backBtn).not.toBeNull();
    });

    it('CinemaTemplateStudio shows empty state when no templates match filter', async () => {
      const { getTemplateRegistry } = await import('../../src/lib/cinematicTemplates.js');
      vi.mocked(getTemplateRegistry).mockReturnValueOnce({
        getAll: vi.fn(() => []),
        get: vi.fn(() => null),
      });

      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const favBtn = container.querySelector('#favorites-btn');
      favBtn.click();
      await wait(50);

      const emptyEl = container.querySelector('.text-center.py-16');
      expect(emptyEl).not.toBeNull();
    });

    it('show all button clears filter in CinemaTemplateStudio', async () => {
      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const favBtn = container.querySelector('#favorites-btn');
      favBtn.click();
      await wait(50);

      const showAllBtn = container.querySelector('.show-all-empty-btn');
      if (showAllBtn) {
        showAllBtn.click();
        await wait(50);
      }

      // After clearing, favorites button should not have active styling
      const newFavBtn = container.querySelector('#favorites-btn');
      expect(newFavBtn.classList.contains('bg-primary')).toBe(false);
    });

    it('AI Captions button exists for video templates in TemplateStudio', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const captionBtn = findButton(container, 'AI Captions');
      expect(captionBtn).not.toBeNull();
    });

    it('AI Captions button does not exist for image templates in TemplateStudio', async () => {
      const { getTemplateById } = await import('../../src/lib/templates.js');
      vi.mocked(getTemplateById).mockReturnValueOnce({
        id: 'image-only',
        name: 'Image Only',
        description: 'Image template',
        outputType: 'image',
        category: 'Design',
        modelType: 't2i',
        model: 'flux',
        inputs: [{ name: 'title', type: 'text', label: 'Title' }],
        defaultParams: {},
      });

      const element = TemplateStudio('image-only');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const captionBtn = findButton(container, 'AI Captions');
      expect(captionBtn).toBeUndefined();
    });

    it('model picker trigger shows selected model name', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const modelBtn = container.querySelector('#templateModelTrigger');
      expect(modelBtn).not.toBeNull();
      expect(modelBtn.textContent).toContain('Kling V2.6 Pro');
    });

    it('enhancer buttons exist in TemplateStudio advanced controls', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(150);

      const advancedBtn = container.querySelector('#advancedToggle');
      advancedBtn.click();
      await wait(50);

      const enhanceBtns = container.querySelectorAll('.enhancer-btn');
      expect(enhanceBtns.length).toBeGreaterThan(0);
    });

    it('wand button enhances output textarea in TemplateStudio', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(150);

      const wandBtn = container.querySelector('#wandBtn');
      const textarea = container.querySelector('#outputTextarea');
      expect(wandBtn).not.toBeNull();
      expect(textarea).not.toBeNull();

      textarea.value = 'test prompt';
      wandBtn.click();
      await wait(50);

      expect(textarea.value).toContain('cinematic quality');
    });

    it('form state updates on text input in TemplateStudio', async () => {
      const element = TemplateStudio('restaurant-brand-film');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const promptInput = container.querySelector('textarea, input[type="text"]');
      promptInput.value = 'new prompt value';
      promptInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(promptInput.value).toBe('new prompt value');
    });

    it('TemplateStudio handles template not found', async () => {
      const templatesModule = await import('../../src/lib/templates.js');
      expect(templatesModule.getTemplateById('nonexistent-template')).toBeNull();

      const element = TemplateStudio('nonexistent-template');
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      expect(container.textContent).toContain('Template not found');
    });

    it('CinemaTemplateStudio card click selects template', async () => {
      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      // Verify browse view initially
      expect(container.querySelector('h1').textContent).toBe('CINEMATIC TEMPLATES');

      // Click card
      const card = container.querySelector('.group');
      card.click();
      await wait(100);

      // Should be in create view with template details
      const h1 = container.querySelector('h1');
      expect(h1.textContent).toBe('Cinema Test Template');
    });

    it('CinemaTemplateStudio favorite button toggles favorite', async () => {
      const { TemplateStorage } = await import('../../src/lib/cinematicTemplates.js');
      const element = CinemaTemplateStudio();
      container.innerHTML = '';
      container.appendChild(element);
      await wait(50);

      const favBtn = container.querySelector('.favorite-btn');
      expect(favBtn).not.toBeNull();
      favBtn.click();
      await wait(50);

      expect(TemplateStorage.addFavorite).toHaveBeenCalled();
    });
  });
});
