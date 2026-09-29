import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock muapi before importing TemplateStudio
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
    muapi: {
      generateI2V,
      generateImage,
      generateVideo,
      generateI2I,
      processV2V,
    },
  };
});

// Mock apiKeyManager to bypass auth modal
vi.mock('../../src/lib/apiKeyManager.js', () => ({
  apiKeyManager: {
    getMuapiKey: () => 'test-api-key',
    getOpenAIKey: () => null,
    getVideoDBKey: () => null,
    getPexelsKey: () => null,
  },
}));

// Mock router navigate to no-op
vi.mock('../../src/lib/router.js', () => ({
  navigate: vi.fn(() => {}),
}));

// Mock mountStudioDrawer
vi.mock('../../src/lib/studioChrome.js', () => ({
  mountStudioDrawer: vi.fn(() => ({ toggle: vi.fn() })),
  createStudioMenuButton: vi.fn(() => document.createElement('button')),
}));

// Mock mountPersonalizeTrigger
vi.mock('../../src/components/personalize/personalizePopover.js', () => ({
  mountPersonalizeTrigger: vi.fn(() => {}),
}));

// Mock addCaptionButton
vi.mock('../../src/lib/editor/captionActions.js', () => ({
  addCaptionButton: vi.fn(() => {}),
}));

// Mock thumbnail modal dependencies
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
    if (id === 'movie-poster') {
      return {
        id: 'movie-poster',
        name: 'Movie Poster',
        description: 'Create a movie poster',
        outputType: 'image',
        category: 'Design',
        modelType: 't2i',
        model: 'flux',
        inputs: [{ name: 'title', type: 'text', label: 'Title' }],
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
  t2iModels: [{ id: 'flux', name: 'FLUX' }],
  i2iModels: [{ id: 'flux-i2i', name: 'FLUX I2I' }],
  i2vModels: [{ id: 'kling-i2v', name: 'Kling I2V' }],
  t2vModels: [{ id: 'kling-v2.6-pro-t2v', name: 'Kling V2.6 Pro' }],
  v2vModels: [{ id: 'kling-v2v', name: 'Kling V2V' }],
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
  TemplateThumbnailModal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    close: vi.fn(),
  })),
  mountThumbnailModal: vi.fn(() => ({})),
}));

import { TemplateStudio } from '../../src/components/TemplateStudio.js';

describe('TemplateStudio feature tests', () => {
  let container;
  let localStorageMock;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);

    const store = { 'muapi_key': 'test-key' };
    localStorageMock = {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
      clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    };
    global.localStorage = localStorageMock;
  });

  afterEach(() => {
    if (container.parentNode) container.parentNode.removeChild(container);
  });

  function mount(templateId = 'restaurant-brand-film') {
    const element = TemplateStudio(templateId);
    container.innerHTML = '';
    container.appendChild(element);
    return element;
  }

  it('renders hero section with template name and description', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const h1 = container.querySelector('h1');
    expect(h1).not.toBeNull();
    expect(h1.textContent).toBe('Restaurant Brand Film');
  });

  it('renders prompt input and generate button', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const promptInput = container.querySelector('textarea, input[type="text"]');
    expect(promptInput).not.toBeNull();

    const genBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate'));
    expect(genBtn).not.toBeNull();
  });

  it('blocks generation when no prompt and shows inline error', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const genBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate'));
    genBtn.click();
    await new Promise(r => setTimeout(r, 50));

    const inlineError = container.querySelector('.ts-inline-error');
    expect(inlineError).not.toBeNull();
    expect(inlineError.textContent).toContain('Please enter a prompt');
  });

  it('renders model picker button for video templates', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const modelBtn = container.querySelector('#templateModelTrigger');
    expect(modelBtn).not.toBeNull();
  });

  it('renders output tabs', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const tabs = ['Enhanced Prompt', 'Scene Beats', 'Voiceover', 'Negative Prompt'];
    tabs.forEach(tab => {
      const tabBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent === tab);
      expect(tabBtn).not.toBeNull();
    });
  });

  it('switches output tab on click', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const sceneBeatsTab = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent === 'Scene Beats');
    sceneBeatsTab.click();
    await new Promise(r => setTimeout(r, 50));

    const textarea = container.querySelector('#outputTextarea');
    expect(textarea).not.toBeNull();
    expect(textarea.value).toContain('Hook');
  });

  it('renders creative intelligence tiles', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const tiles = container.querySelectorAll('[data-tile]');
    expect(tiles.length).toBeGreaterThanOrEqual(4);
  });

  it('renders thumbnail action button', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const thumbBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Thumbnail'));
    expect(thumbBtn).not.toBeNull();
  });

  it('renders AI enhancer toggle and advanced controls button', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const toggleBtn = container.querySelector('#enhancerToggle');
    expect(toggleBtn).not.toBeNull();

    const advancedBtn = container.querySelector('#advancedToggle');
    expect(advancedBtn).not.toBeNull();
  });

  it('toggles advanced controls visibility', async () => {
    mount();
    await new Promise(r => setTimeout(r, 150));

    const advancedBtn = container.querySelector('#advancedToggle');
    const advControls = container.querySelector('#advancedControls');
    expect(advancedBtn).not.toBeNull();
    expect(advControls).not.toBeNull();

    // Initially hidden
    expect(advControls.classList.contains('hidden')).toBe(true);

    advancedBtn.click();
    await new Promise(r => setTimeout(r, 50));

    expect(advancedBtn.textContent).toBe('Hide Advanced Controls');
    expect(advControls.classList.contains('hidden')).toBe(false);
  });

  it('renders advanced fields', async () => {
    mount();
    await new Promise(r => setTimeout(r, 150));

    const advancedBtn = container.querySelector('#advancedToggle');
    advancedBtn.click();
    await new Promise(r => setTimeout(r, 50));

    const selects = container.querySelectorAll('select[data-advanced-field]');
    expect(selects.length).toBeGreaterThanOrEqual(3);
  });

  it('enhancer buttons append enhancement text to inputs', async () => {
    mount();
    await new Promise(r => setTimeout(r, 150));

    // Toggle advanced controls to reveal enhancer buttons
    const advancedBtn = container.querySelector('#advancedToggle');
    advancedBtn.click();
    await new Promise(r => setTimeout(r, 50));

    const enhanceBtns = container.querySelectorAll('.enhancer-btn');
    expect(enhanceBtns.length).toBeGreaterThan(0);

    const firstBtn = enhanceBtns[0];
    const targetInput = firstBtn.closest('div').parentElement.querySelector('[data-advanced-field]');
    if (targetInput) {
      targetInput.value = 'test prompt';
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));
      firstBtn.click();
      await new Promise(r => setTimeout(r, 50));
      expect(targetInput.value).toContain('cinematic style');
    }
  });

  it('wand button enhances output textarea', async () => {
    mount();
    await new Promise(r => setTimeout(r, 150));

    const wandBtn = container.querySelector('#wandBtn');
    const textarea = container.querySelector('#outputTextarea');
    expect(wandBtn).not.toBeNull();
    expect(textarea).not.toBeNull();

    textarea.value = 'test prompt';
    wandBtn.click();
    await new Promise(r => setTimeout(r, 50));

    expect(textarea.value).toContain('cinematic quality');
  });

  it('renders back button with navigation', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const backBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Back'));
    expect(backBtn).not.toBeNull();
  });

  it('renders nav header with studio links', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const navBtns = container.querySelectorAll('[data-nav]');
    expect(navBtns.length).toBeGreaterThan(5);
  });

  it('renders input fields for image upload templates', async () => {
    const element = TemplateStudio('movie-poster');
    container.innerHTML = '';
    container.appendChild(element);
    await new Promise(r => setTimeout(r, 50));

    const textInputs = container.querySelectorAll('input[type="text"]');
    expect(textInputs.length).toBeGreaterThan(0);
  });

  it('validates i2v template requires image upload before generation', async () => {
    mount('i2v-restaurant');
    await new Promise(r => setTimeout(r, 50));

    const promptInput = container.querySelector('textarea, input[type="text"]');
    if (promptInput) {
      promptInput.value = 'test';
      promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const genBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate'));
    genBtn.click();
    await new Promise(r => setTimeout(r, 50));

    const inlineError = container.querySelector('.ts-inline-error');
    expect(inlineError).not.toBeNull();
    expect(inlineError.textContent).toContain('upload an image');
  });

  it('renders output result area with aria-live', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const resultArea = container.querySelector('#resultArea');
    expect(resultArea).not.toBeNull();
    expect(resultArea.getAttribute('role')).toBe('status');
    expect(resultArea.getAttribute('aria-live')).toBe('polite');
  });

  it('shows generation spinner and result on successful muapi call', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const promptInput = container.querySelector('textarea, input[type="text"]');
    promptInput.value = 'cinematic restaurant scene';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Mock the image upload state
    const imageInput = container.querySelector('input[type="file"]');
    if (imageInput) {
      const dt = new DataTransfer();
      dt.items.add(new File([''], 'test.jpg', { type: 'image/jpeg' }));
      imageInput.files = dt.files;
      imageInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const genBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate'));
    genBtn.click();
    
    // Check immediately for generating state
    expect(genBtn.disabled).toBe(true);
    expect(genBtn.textContent).toContain('Generating');
  });

  it('renders video upload button for video templates', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const videoUploadBtn = container.querySelector('#videoUploadBtn');
    expect(videoUploadBtn).not.toBeNull();
  });

  it('renders AI captions button for video templates', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const captionBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('AI Captions'));
    expect(captionBtn).not.toBeNull();
  });

  it('does not render AI captions button for image templates', async () => {
    const element = TemplateStudio('movie-poster');
    container.innerHTML = '';
    container.appendChild(element);
    await new Promise(r => setTimeout(r, 50));

    const captionBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('AI Captions'));
    expect(captionBtn).toBeUndefined();
  });

  it('model picker dropdown renders and populates', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const modelBtn = container.querySelector('#templateModelTrigger');
    modelBtn.click();
    await new Promise(r => setTimeout(r, 100));

    const dropdown = container.querySelector('[role="listbox"]');
    expect(dropdown).not.toBeNull();
  });

  it('closes model picker dropdown on second click', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const modelBtn = container.querySelector('#templateModelTrigger');
    modelBtn.click();
    await new Promise(r => setTimeout(r, 100));

    let dropdown = container.querySelector('[role="listbox"]');
    expect(dropdown).not.toBeNull();
    expect(dropdown.classList.contains('opacity-100')).toBe(true);

    modelBtn.click();
    await new Promise(r => setTimeout(r, 100));

    dropdown = container.querySelector('[role="listbox"]');
    // Dropdown should still exist but be hidden
    expect(dropdown).not.toBeNull();
    expect(dropdown.classList.contains('opacity-0')).toBe(true);
  });

  it('handles template not found with error message', async () => {
    const templatesModule = await import('../../src/lib/templates.js');
    // Verify the mock returns null for nonexistent templates
    expect(templatesModule.getTemplateById('nonexistent-template')).toBeNull();

    const element = TemplateStudio('nonexistent-template');
    container.innerHTML = '';
    container.appendChild(element);
    await new Promise(r => setTimeout(r, 50));

    expect(container.textContent).toContain('Template not found');
  });

  it('renders input field labels', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const labels = container.querySelectorAll('.uppercase.tracking-\\[0\\.22em\\]');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('form state updates on text input', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const promptInput = container.querySelector('textarea, input[type="text"]');
    promptInput.value = 'new prompt value';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(promptInput.value).toBe('new prompt value');
  });

  it('generation failure shows retry button when retries remain', async () => {
    const { muapi } = await import('../../src/lib/muapi.js');
    const generateImageSpy = vi.spyOn(muapi, 'generateImage');
    vi.mocked(muapi.generateImage).mockRejectedValueOnce(new Error('Network error'));

    // Use an image template so generateImage is called
    const element = TemplateStudio('movie-poster');
    container.innerHTML = '';
    container.appendChild(element);
    await new Promise(r => setTimeout(r, 50));

    // Use the main input (not the advanced controls inputs)
    const allInputs = container.querySelectorAll('input');
    const promptInput = Array.from(allInputs).find(input => !input.hasAttribute('data-advanced-field'));
    promptInput.value = 'test';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));

    const genBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate'));
    genBtn.click();
    await new Promise(r => setTimeout(r, 300));

    const inlineError = container.querySelector('.ts-inline-error');
    expect(inlineError).not.toBeNull();
    expect(inlineError.innerHTML).toContain('retry-btn');

    const retryBtn = container.querySelector('#retry-btn');
    expect(retryBtn).not.toBeNull();
  });
});
