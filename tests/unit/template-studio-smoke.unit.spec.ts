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
      id: 'restaurant-brand-film',
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
  TemplateThumbnailModal: class MockTemplateThumbnailModal {
    constructor() {
      this.open = () => {};
      this.close = () => {};
    }
  },
  mountThumbnailModal: vi.fn(() => ({})),
}));

import { TemplateStudio } from '../../src/components/TemplateStudio.js';

describe('TemplateStudio smoke tests with feature assertions', () => {
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

  it('mounts without ReferenceError or TypeError', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));
    // If we get here without throwing, the mount succeeded
    expect(container.querySelector('h1')).not.toBeNull();
  });

  it('renders complete hero section', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const h1 = container.querySelector('h1');
    const desc = container.querySelector('p');
    const thumb = container.querySelector('img');
    const thumbBtn = container.querySelector('button');

    expect(h1).not.toBeNull();
    expect(desc).not.toBeNull();
    expect(thumb).not.toBeNull();
    expect(thumbBtn).not.toBeNull();
  });

  it('renders complete form section with inputs and generate button', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const promptInput = container.querySelector('textarea, input[type="text"]');
    const genBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate'));
    const modelBtn = container.querySelector('#templateModelTrigger');

    expect(promptInput).not.toBeNull();
    expect(genBtn).not.toBeNull();
    expect(modelBtn).not.toBeNull();
  });

  it('renders complete output section with tabs and textarea', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const tabs = container.querySelectorAll('#outputTabs button');
    const textarea = container.querySelector('#outputTextarea');
    const wandBtn = container.querySelector('#wandBtn');

    expect(tabs.length).toBe(4);
    expect(textarea).not.toBeNull();
    expect(wandBtn).not.toBeNull();
  });

  it('renders creative intelligence tiles', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const tiles = container.querySelectorAll('[data-tile]');
    expect(tiles.length).toBeGreaterThanOrEqual(4);
  });

  it('renders AI enhancer section', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const enhancer = container.querySelector('#enhancerToggle');
    const advancedBtn = container.querySelector('#advancedToggle');

    expect(enhancer).not.toBeNull();
    expect(advancedBtn).not.toBeNull();
  });

  it('renders model selector for video templates', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const modelWrapper = container.querySelector('#model-loading-status');
    expect(modelWrapper).not.toBeNull();
  });

  it('renders video upload button for video templates', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const videoBtn = container.querySelector('#videoUploadBtn');
    expect(videoBtn).not.toBeNull();
  });

  it('renders AI captions button for video templates', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const captionBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('AI Captions'));
    expect(captionBtn).not.toBeNull();
  });

  it('renders result area for output display', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const resultArea = container.querySelector('#resultArea');
    expect(resultArea).not.toBeNull();
    expect(resultArea.getAttribute('role')).toBe('status');
  });

  it('renders navigation header with studio links', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const navLinks = container.querySelectorAll('[data-nav]');
    expect(navLinks.length).toBeGreaterThan(5);
  });

  it('renders back button with navigation', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const backBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Back'));
    expect(backBtn).not.toBeNull();
  });

  it('renders studio menu button', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const menuSlot = container.querySelector('#studio-menu-slot');
    expect(menuSlot).not.toBeNull();
    const menuBtn = menuSlot.querySelector('button');
    expect(menuBtn).not.toBeNull();
  });

  it('renders output pills with template metadata', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const pills = container.querySelectorAll('.rounded-full');
    expect(pills.length).toBeGreaterThanOrEqual(3);
  });

  it('renders thumbnail action button', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const thumbBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Thumbnail'));
    expect(thumbBtn).not.toBeNull();
  });

  it('does not render AI captions for image templates', async () => {
    const element = TemplateStudio('movie-poster');
    container.innerHTML = '';
    container.appendChild(element);
    await new Promise(r => setTimeout(r, 50));

    const captionBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('AI Captions'));
    expect(captionBtn).toBeUndefined();
  });

  it('handles template not found gracefully', async () => {
    const element = TemplateStudio('nonexistent-template');
    container.innerHTML = '';
    container.appendChild(element);
    await new Promise(r => setTimeout(r, 50));

    const templatesModule = await import('../../src/lib/templates.js');
    expect(templatesModule.getTemplateById('nonexistent-template')).toBeNull();
    expect(container.textContent).toContain('Template not found');
  });
});
