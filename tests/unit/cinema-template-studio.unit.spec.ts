import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock muapi before importing CinemaTemplateStudio
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
  getTemplateById: vi.fn(() => null),
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
      this.open = () => {};
      this.close = () => {};
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
  SHOT_TYPES: ['WIDE', 'MEDIUM', 'CLOSEUP'],
  CAMERA_MOVEMENTS: ['STATIC', 'PUSH_IN', 'PAN'],
  BRAND_VOICES: ['professional', 'casual'],
  TARGET_AUDIENCES: ['general', 'enterprise'],
  TemplateInputBuilder: vi.fn(),
  PromptAssemblyEngine: vi.fn(),
  SceneBuilder: vi.fn(() => ({
    addScene: vi.fn(),
    removeScene: vi.fn(),
    moveScene: vi.fn(),
    getScenes: vi.fn(() => []),
    clear: vi.fn(),
  })),
  RenderHandoff: vi.fn(),
  TemplateStorage: {
    isFavorite: vi.fn(() => false),
    getRecent: vi.fn(() => []),
  },
}));

vi.mock('../../src/lib/videoIntentStore.js', () => ({
  getVideoIntent: vi.fn(() => null),
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
    },
  },
}));

vi.mock('../../src/components/StoryboardStudio.js', () => ({
  StoryboardStudio: vi.fn(() => document.createElement('div')),
}));

import { CinemaTemplateStudio } from '../../src/components/CinemaTemplateStudio.js';

describe('CinemaTemplateStudio feature tests', () => {
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

  function mount() {
    const element = CinemaTemplateStudio();
    container.innerHTML = '';
    container.appendChild(element);
    return element;
  }

  it('renders browse view with template count', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const header = container.querySelector('h1');
    expect(header).not.toBeNull();
    expect(header.textContent).toBe('CINEMATIC TEMPLATES');
  });

  it('renders filter buttons (favorites, recent, custom)', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const favBtn = container.querySelector('#favorites-btn');
    const recentBtn = container.querySelector('#recent-btn');
    const customBtn = container.querySelector('#custom-btn');

    expect(favBtn).not.toBeNull();
    expect(recentBtn).not.toBeNull();
    expect(customBtn).not.toBeNull();
  });

  it('renders template cards in browse view', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const cards = container.querySelectorAll('.group');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('switches to favorites filter', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const favBtn = container.querySelector('#favorites-btn');
    favBtn.click();
    await new Promise(r => setTimeout(r, 50));

    const newFavBtn = container.querySelector('#favorites-btn');
    expect(newFavBtn.classList.contains('bg-primary')).toBe(true);
  });

  it('switches to recent filter', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const recentBtn = container.querySelector('#recent-btn');
    recentBtn.click();
    await new Promise(r => setTimeout(r, 50));

    const newRecentBtn = container.querySelector('#recent-btn');
    expect(newRecentBtn.classList.contains('bg-primary')).toBe(true);
  });

  it('switches to custom filter', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const customBtn = container.querySelector('#custom-btn');
    customBtn.click();
    await new Promise(r => setTimeout(r, 50));

    const newCustomBtn = container.querySelector('#custom-btn');
    expect(newCustomBtn.classList.contains('bg-primary')).toBe(true);
  });

  it('renders back button', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const backBtn = container.querySelector('#back-btn');
    expect(backBtn).not.toBeNull();
  });

  it('renders empty state when no templates match filter', async () => {
    // Mock registry to return empty array for favorites
    const { getTemplateRegistry } = await import('../../src/lib/cinematicTemplates.js');
    vi.mocked(getTemplateRegistry).mockReturnValueOnce({
      getAll: vi.fn(() => []),
      get: vi.fn(() => null),
    });

    mount();
    await new Promise(r => setTimeout(r, 50));

    const favBtn = container.querySelector('#favorites-btn');
    favBtn.click();
    await new Promise(r => setTimeout(r, 50));

    const emptyEl = container.querySelector('.text-center.py-16');
    expect(emptyEl).not.toBeNull();
  });

  it('renders template thumbnail with fallback icon', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
  });

  it('renders favorite button on template cards', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const favBtn = container.querySelector('.favorite-btn');
    expect(favBtn).not.toBeNull();
  });

  it('renders thumbnail button on template cards', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const thumbBtn = container.querySelector('[title="Set custom thumbnail"]');
    expect(thumbBtn).not.toBeNull();
  });

  it('opens thumbnail modal when thumbnail button is clicked', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const thumbBtn = container.querySelector('[title="Set custom thumbnail"]');
    thumbBtn.click();
    await new Promise(r => setTimeout(r, 50));

    // The modal should be opened (mountThumbnailModal called)
    const { mountThumbnailModal } = await import('../../src/components/modals/TemplateThumbnailModal.jsx');
    expect(mountThumbnailModal).toHaveBeenCalled();
  });

  it('shows "Show All" button when filter is active and results are empty', async () => {
    const { getTemplateRegistry } = await import('../../src/lib/cinematicTemplates.js');
    vi.mocked(getTemplateRegistry).mockReturnValueOnce({
      getAll: vi.fn(() => []),
      get: vi.fn(() => null),
    });

    mount();
    await new Promise(r => setTimeout(r, 50));

    const favBtn = container.querySelector('#favorites-btn');
    favBtn.click();
    await new Promise(r => setTimeout(r, 50));

    const showAllBtn = container.querySelector('.show-all-empty-btn');
    expect(showAllBtn).not.toBeNull();
  });

  it('clears filter when "Show All" is clicked', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const favBtn = container.querySelector('#favorites-btn');
    favBtn.click();
    await new Promise(r => setTimeout(r, 50));

    const showAllBtn = container.querySelector('.show-all-empty-btn');
    if (showAllBtn) {
      showAllBtn.click();
      await new Promise(r => setTimeout(r, 50));

      const filterHeader = container.querySelector('.mb-4');
      expect(filterHeader).toBeNull();
    }
  });

  it('renders template card with title', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const titleEl = container.querySelector('h3');
    expect(titleEl).not.toBeNull();
    expect(titleEl.textContent).toBe('Cinema Test Template');
  });

  it('renders template count in header', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const countEl = container.querySelector('.text-xs.text-secondary');
    expect(countEl).not.toBeNull();
    expect(countEl.textContent).toContain('Templates');
  });

  it('renders studio logo in header', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const logo = container.querySelector('.w-10.h-10');
    expect(logo).not.toBeNull();
  });

  it('renders "My Templates" label for custom filter', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const customBtn = container.querySelector('#custom-btn');
    expect(customBtn.textContent).toContain('My Templates');
  });

  it('renders "Recent" label for recent filter', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const recentBtn = container.querySelector('#recent-btn');
    expect(recentBtn.textContent).toContain('Recent');
  });

  it('renders "Favorites" label for favorites filter', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const favBtn = container.querySelector('#favorites-btn');
    expect(favBtn.textContent).toContain('Favorites');
  });

  it('applies active filter styling', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const favBtn = container.querySelector('#favorites-btn');
    favBtn.click();
    await new Promise(r => setTimeout(r, 50));

    const newFavBtn = container.querySelector('#favorites-btn');
    expect(newFavBtn.classList.contains('bg-primary')).toBe(true);
    expect(newFavBtn.classList.contains('text-black')).toBe(true);
  });

  it('renders grid layout for template cards', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const grid = container.querySelector('.grid');
    expect(grid).not.toBeNull();
  });

  it('adds studio menu button next to back button', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const backBtn = container.querySelector('#back-btn');
    expect(backBtn).not.toBeNull();
    // The menu button should be inserted before the back button
    const menuBtn = backBtn.previousElementSibling;
    expect(menuBtn).not.toBeNull();
  });

  it('renders template card with hover effect', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const card = container.querySelector('.group');
    expect(card).not.toBeNull();
    expect(card.classList.contains('hover:bg-white/10')).toBe(true);
  });

  it('renders template card with border', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const card = container.querySelector('.group');
    expect(card.classList.contains('border')).toBe(true);
    expect(card.classList.contains('border-white/10')).toBe(true);
  });

  it('renders template card with rounded corners', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const card = container.querySelector('.group');
    expect(card.classList.contains('rounded-xl')).toBe(true);
  });

  it('renders template card with cursor pointer', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const card = container.querySelector('.group');
    expect(card.classList.contains('cursor-pointer')).toBe(true);
  });

  it('renders template card actions area', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const actions = container.querySelector('.flex.items-center.justify-between');
    expect(actions).not.toBeNull();
  });

  it('renders template card thumbnail with aspect ratio', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const thumb = container.querySelector('.aspect-video');
    expect(thumb).not.toBeNull();
  });

  it('renders template card title with bold styling', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const title = container.querySelector('h3');
    expect(title.classList.contains('font-bold')).toBe(true);
  });

  it('renders filter header with clear button when filter is active', async () => {
    mount();
    await new Promise(r => setTimeout(r, 50));

    const favBtn = container.querySelector('#favorites-btn');
    favBtn.click();
    await new Promise(r => setTimeout(r, 50));

    const clearBtn = container.querySelector('[class*="Show All"]');
    // The filter header should have a clear button
    const filterHeader = container.querySelector('.mb-4');
    expect(filterHeader).not.toBeNull();
  });
});
