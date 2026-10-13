import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Entitlement gate regression tests (P4).
 *
 * Every paid surface listed in the entitlement audit gets a gate at its seam
 * (the single function that owns the paid MuAPI call). These tests assert:
 *   1. Blocked path  — requireEntitlement() resolves false: requireEntitlement
 *      IS called and NO muapi.* paid call happens.
 *   2. Paid path     — requireEntitlement() resolves true: the paid call runs.
 *
 * muapi.js and clerkEntitlements.js are mocked, following the pattern in
 * tests/unit/template-studio-generation.unit.spec.ts.
 */

// ---------------------------------------------------------------- muapi mock
vi.mock('../../src/lib/muapi.js', () => {
  const fns = {
    generateI2V: vi.fn(async (params) => ({ url: 'https://cdn.muapi.ai/results/i2v.mp4', model: params?.model })),
    generateI2I: vi.fn(async (params) => ({ url: 'https://cdn.muapi.ai/results/i2i.png', model: params?.model })),
    generateVideo: vi.fn(async (params) => ({ url: 'https://cdn.muapi.ai/results/video.mp4', model: params?.model })),
    generateImage: vi.fn(async (params) => ({ url: 'https://cdn.muapi.ai/results/image.png', model: params?.model })),
    processV2V: vi.fn(async (params) => ({ url: 'https://cdn.muapi.ai/results/v2v.mp4', model: params?.model })),
    generateMusic: vi.fn(async (params) => ({ url: 'https://cdn.muapi.ai/results/music.mp3', model: params?.model })),
    uploadFile: vi.fn(async () => 'https://cdn.muapi.ai/uploads/uploaded.mp4'),
    processVideoTool: vi.fn(async () => ({ url: 'https://cdn.muapi.ai/results/captioned.mp4' })),
  };
  return { muapi: fns, default: fns };
});

// --------------------------------------------------- clerkEntitlements mock
vi.mock('../../src/lib/clerkEntitlements.js', () => ({
  requireEntitlement: vi.fn(async () => false),
}));

// ------------------------------------------------------------- shared mocks
vi.mock('../../src/lib/apiKeyManager.js', () => ({
  apiKeyManager: {
    getMuapiKey: () => 'test-api-key',
    getOpenAIKey: () => 'test-openai-key',
    hasMuapiKey: () => true,
    hasOpenAIKey: () => true,
  },
}));

vi.mock('../../src/lib/router.js', () => ({ navigate: vi.fn(() => {}) }));

vi.mock('../../src/lib/studioChrome.js', () => ({
  mountStudioChrome: vi.fn(() => document.createElement('div')),
  mountStudioDrawer: vi.fn(() => ({ toggle: vi.fn() })),
  createStudioMenuButton: vi.fn(() => document.createElement('button')),
}));

vi.mock('../../src/components/personalize/personalizePopover.js', () => ({
  mountPersonalizeTrigger: vi.fn(() => ({
    getActiveProfile: () => null,
    reset: vi.fn(),
  })),
  replaceTokensInPrompt: vi.fn((t) => t),
}));

vi.mock('../../src/lib/editor/captionActions.js', () => ({ addCaptionButton: vi.fn(() => {}) }));

vi.mock('../../src/lib/thumbnails.js', () => ({
  getTemplateThumbnailCandidates: vi.fn(() => ['/thumb.png']),
  createHeroSection: vi.fn(() => document.createElement('div')),
  getToolThumbnail: vi.fn(() => '/thumb.png'),
  getCustomThumbnailFromCache: vi.fn(() => null),
  saveCustomThumbnailToCache: vi.fn(),
  clearCustomThumbnailCache: vi.fn(),
  createThumbnailImg: vi.fn(() => document.createElement('img')),
}));

vi.mock('../../src/lib/models.js', () => ({
  t2iModels: [{ id: 'flux', name: 'FLUX', inputs: { aspect_ratio: { default: '1:1' } } }],
  i2iModels: [{ id: 'flux-i2i', name: 'FLUX I2I', imageField: 'images_list', hasPrompt: true }],
  i2vModels: [{ id: 'kling-i2v', name: 'Kling I2V', inputs: { aspect_ratio: { default: '16:9' } } }],
  t2vModels: [{ id: 'kling-v2.6-pro-t2v', name: 'Kling V2.6 Pro T2V' }],
  v2vModels: [{ id: 'kling-v2v', name: 'Kling V2V', imageField: 'images_list', hasPrompt: true, videoField: 'video_url' }],
  getV2VModelById: vi.fn((id) => (id === 'kling-v2v' ? { id: 'kling-v2v' } : null)),
  getAspectRatiosForModel: vi.fn(() => ['1:1', '16:9']),
  getModelById: vi.fn(() => ({ id: 'flux', name: 'FLUX' })),
  getI2IModelById: vi.fn(() => null),
  getI2VModelById: vi.fn(() => null),
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

vi.mock('../../src/lib/generationHistory.js', () => ({ saveGeneration: vi.fn(() => {}) }));

vi.mock('../../src/lib/security.js', () => ({ sanitizeUrl: vi.fn((u) => u), escapeHtml: vi.fn((s) => s) }));

vi.mock('../../src/lib/socialPublishHelpers.js', () => ({ openSocialPublish: vi.fn(() => Promise.resolve()) }));

vi.mock('../../src/lib/promptGalleryIntegration.js', () => ({ openPromptGallery: vi.fn(() => Promise.resolve()) }));

vi.mock('../../src/lib/recipeIntegration.js', () => ({ openRecipeModal: vi.fn(() => Promise.resolve()) }));

vi.mock('../../src/lib/monetizationIntegration.js', () => ({ openMonetizationHub: vi.fn(() => Promise.resolve()) }));

vi.mock('../../src/lib/uiIntegration.js', () => ({
  fetchGTMTemplateContext: vi.fn(() => null),
  openGTMPromptModal: vi.fn(() => {}),
}));

vi.mock('../../src/lib/loading.js', () => ({
  showToast: vi.fn(),
  createLoadingOverlay: vi.fn(() => {
    const el = document.createElement('div');
    el.remove = vi.fn();
    return el;
  }),
}));

vi.mock('../../src/components/AuthModal.js', () => ({ AuthModal: vi.fn(() => {}) }));

vi.mock('../../src/components/InlineInstructions.js', () => ({
  createInlineInstructions: vi.fn(() => document.createElement('div')),
}));

vi.mock('../../src/components/UploadPicker.js', () => ({
  createUploadPicker: vi.fn(() => ({
    trigger: document.createElement('button'),
    panel: document.createElement('div'),
    open: vi.fn(),
    close: vi.fn(),
    reset: vi.fn(),
    setMaxImages: vi.fn(),
  })),
}));

vi.mock('../../src/lib/attachmentToolbar.js', () => ({
  createAttachmentToolbar: vi.fn(() => document.createElement('div')),
}));

vi.mock('../../src/lib/studioControls.js', () => ({
  createAdvancedControls: vi.fn(() => document.createElement('div')),
}));

vi.mock('../../src/lib/modelInputExtensions.js', () => ({ getExtendedModel: vi.fn((m) => m) }));

vi.mock('../../src/lib/studioHelpers.js', () => ({ createMediaRemoveButton: vi.fn(() => document.createElement('button')) }));

// TemplateStudio / CinemaTemplateStudio shared deps
vi.mock('../../src/lib/templates.js', () => ({
  getTemplateById: vi.fn((id) => {
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

vi.mock('../../src/lib/templateSpecs.js', () => ({
  getTemplateSpecs: vi.fn(() => ({})),
  hasEnhancedSpecs: vi.fn(() => false),
}));

vi.mock('../../src/lib/showcaseTemplateResolver.js', () => ({
  resolveTemplate: vi.fn(() => null),
  loadTemplatePrompt: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../src/lib/templateAdapter.js', () => ({ normalizeTemplate: vi.fn((t) => t) }));

vi.mock('../../src/lib/templateMatrix.js', () => ({ NICHE_ENRICHMENT: {}, FILM_FAMILIES: {} }));

vi.mock('../../src/lib/modelCatalog.js', () => ({ getEnrichedModels: vi.fn(async () => []) }));

vi.mock('../../src/lib/gtmContextStore.js', () => ({ getGtmContext: vi.fn(() => null) }));

vi.mock('../../src/lib/personalizerAdapters.js', () => ({ getTemplateStudioAsset: vi.fn(() => ({})) }));

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }),
  },
}));

vi.mock('../../src/components/modals/TemplateThumbnailModal.jsx', () => ({
  TemplateThumbnailModal: vi.fn(),
  mountThumbnailModal: vi.fn(() => ({})),
}));

// CinemaTemplateStudio deps (real constants kept so nicheTemplates.js etc.
// resolve; only the registry/engine pieces used at mount are stubbed)
vi.mock('../../src/lib/cinematicTemplates.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
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
      get: vi.fn(() => null),
    })),
    TemplateStorage: {
      isFavorite: vi.fn(() => false),
      getRecent: vi.fn(() => []),
      addToRecent: vi.fn(),
      addFavorite: vi.fn(),
      removeFavorite: vi.fn(),
      saveProject: vi.fn(),
    },
    SceneBuilder: class MockSceneBuilder {
      addScene() {}
      removeScene() {}
      moveScene() {}
      getScenes() { return []; }
      clear() {}
    },
    TemplateInputBuilder: class MockTemplateInputBuilder {
      getDefaults() { return { aspectRatio: '16:9' }; }
      validateInputs() { return []; }
      buildFormSchema() {
        return [{ name: 'prompt', type: 'textarea', label: 'Prompt', placeholder: 'Describe your video' }];
      }
    },
    RenderHandoff: vi.fn(),
  };
});

vi.mock('../../src/lib/videoIntentStore.js', () => ({
  getVideoIntent: vi.fn(() => ({
    videoType: 'commercial',
    duration: 30,
    aspectRatio: '16:9',
    tone: 'professional',
    audience: 'general',
    keyMessage: '',
    callToAction: '',
  })),
  setVideoIntent: vi.fn(),
  subscribeVideoIntent: vi.fn(),
  resetVideoIntent: vi.fn(),
}));

vi.mock('../../src/lib/sceneSelector.js', () => ({ selectScenes: vi.fn(() => []) }));

vi.mock('../../src/lib/cinematicTheme.js', () => ({ CINEMATIC_THEME: { text: { title: 'text-xl font-bold' } } }));

// StoryboardStudio deps
vi.mock('../../src/lib/openaiService.js', () => ({
  openaiService: { generateImageResponses: vi.fn(async () => ({ images: [] })) },
}));

vi.mock('../../src/lib/storyboardEngine.js', () => ({
  generateStoryboardFromIntent: vi.fn(async () => ({ frames: [] })),
  generateFrameImage: vi.fn(async () => 'https://cdn.muapi.ai/results/frame.png'),
}));

vi.mock('../../src/lib/editor/persistence.js', () => ({
  createAutosave: vi.fn(() => ({ schedule: vi.fn() })),
  saveProject: vi.fn(() => Promise.resolve()),
  loadProject: vi.fn(() => Promise.resolve(null)),
  saveProjectToStorage: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../src/lib/gtmThumbnailBridge.js', () => ({ subscribeToGtmThumbnails: vi.fn(() => () => {}) }));

vi.mock('../../src/data/academyStudioAdapters.js', () => ({ getAcademyCreateTarget: vi.fn(() => null) }));

vi.mock('../../src/stores/base/Store.js', () => ({
  default: class Store {
    constructor(init) { Object.assign(this, init || {}); }
  },
}));

// PhotoStudioPage / AnimatePage deps
vi.mock('../../src/lib/brandStore.js', () => ({
  listBrands: vi.fn(() => []),
  savePhotoshoot: vi.fn(() => {}),
  saveAnimation: vi.fn(() => {}),
  listAnimations: vi.fn(() => []),
}));

// TimelineEditorPage deps (heavy editor module graph; only the seams used at
// mount time are stubbed so the page can mount in jsdom)
vi.mock('../../src/lib/editor/dragDrop.js', () => ({ setupEnhancedTooltips: vi.fn(() => ({})) }));

vi.mock('../../src/lib/photoStudio.js', () => ({
  PHOTO_CATEGORIES: [{ id: 'apparel', label: 'Apparel' }],
  PHOTO_STYLES: [{ id: 'studio', label: 'Studio' }],
}));

vi.mock('../../src/lib/brandApi.js', () => ({ apiCall: vi.fn(async () => ({ imageUrl: 'https://cdn/free.png' })) }));

vi.mock('../../src/lib/animate.js', () => ({ DEFAULT_PROMPTS: ['a calm prompt'] }));

// ------------------------------------------------------------------ imports
import { TemplateStudio } from '../../src/components/TemplateStudio.js';
import { EditStudio } from '../../src/components/EditStudio.js';
import { PhotoStudioPage } from '../../src/components/PhotoStudioPage.js';
import { AnimatePage } from '../../src/components/AnimatePage.js';
import { CinemaTemplateStudio } from '../../src/components/CinemaTemplateStudio.js';
import { openAICaptionsModal } from '../../src/components/modals/AICaptionsModal.jsx';
import { StoryboardStudio } from '../../src/components/StoryboardStudio.js';

const { requireEntitlement } = await import('../../src/lib/clerkEntitlements.js');
const { muapi } = await import('../../src/lib/muapi.js');
const { createUploadPicker } = await import('../../src/components/UploadPicker.js');
const { generateFrameImage: engineGenerateFrameImage } = await import('../../src/lib/storyboardEngine.js');
const { apiCall } = await import('../../src/lib/brandApi.js');

const BLOCKED = false;
const PAID = true;

describe('Entitlement gates on paid surfaces', () => {
  let container;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
    // Paid surfaces read the MuAPI key from localStorage before running.
    localStorage.setItem('muapi_key', 'test-api-key');
  });

  afterEach(() => {
    if (container.parentNode) container.parentNode.removeChild(container);
    document.body.innerHTML = '';
  });

  function mount(element) {
    container.innerHTML = '';
    container.appendChild(element);
    return element;
  }

  function findButton(root, text) {
    return Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
  }

  /**
   * Deterministic replacement for fixed sleeps: poll until `predicate()` passes
   * (or throw after `timeoutMs`). Fixed setTimeout waits made these security
   * tests race the (heavy) studio module graph under CPU contention — a flaky
   * negative-path gate test is worse than a slow one, because a timeout can
   * hide a real regression. Polling completes in ~10ms on an idle machine and
   * stays correct when the machine is loaded.
   */
  async function waitFor(predicate, { timeoutMs = 15_000, intervalMs = 10 } = {}) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      let ready = false;
      try {
        ready = Boolean(await predicate());
      } catch {
        ready = false; // predicate not applicable yet (element/mock not present)
      }
      if (ready) return true;
      if (Date.now() > deadline) throw new Error('waitFor: condition not met within timeout');
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  // ---------------------------------------------------------------------------
  // TemplateStudio — gate on runGeneration() (the seam that owns muapi.* calls)
  // ---------------------------------------------------------------------------
  describe('TemplateStudio', () => {
    it('blocks the paid generate when entitlement is missing', async () => {
      vi.mocked(requireEntitlement).mockResolvedValue(BLOCKED);
      mount(TemplateStudio('restaurant-brand-film'));
      await waitFor(() => container.querySelector('textarea, input[type="text"]'));

      const promptInput = container.querySelector('textarea, input[type="text"]');
      promptInput.value = 'cinematic restaurant scene';
      promptInput.dispatchEvent(new Event('input', { bubbles: true }));

      findButton(container, 'Generate').click();
      await waitFor(() => vi.mocked(requireEntitlement).mock.calls.length > 0);

      expect(requireEntitlement).toHaveBeenCalled();
      expect(muapi.generateVideo).not.toHaveBeenCalled();
      expect(muapi.generateImage).not.toHaveBeenCalled();
      expect(muapi.generateI2V).not.toHaveBeenCalled();
      expect(muapi.generateI2I).not.toHaveBeenCalled();
      expect(muapi.processV2V).not.toHaveBeenCalled();
    }, 20_000);

    it('runs the paid generate when entitled', async () => {
      vi.mocked(requireEntitlement).mockResolvedValue(PAID);
      mount(TemplateStudio('restaurant-brand-film'));
      await waitFor(() => container.querySelector('textarea, input[type="text"]'));

      const promptInput = container.querySelector('textarea, input[type="text"]');
      promptInput.value = 'cinematic restaurant scene';
      promptInput.dispatchEvent(new Event('input', { bubbles: true }));

      findButton(container, 'Generate').click();
      await waitFor(() => vi.mocked(requireEntitlement).mock.calls.length > 0);
      await waitFor(() => vi.mocked(muapi.generateVideo).mock.calls.length > 0);

      expect(requireEntitlement).toHaveBeenCalled();
      expect(muapi.generateVideo).toHaveBeenCalled();
    }, 20_000);
  });

  // ---------------------------------------------------------------------------
  // EditStudio — gate on the editBtn click handler entry
  // ---------------------------------------------------------------------------
  describe('EditStudio', () => {
    async function selectToolAndUpload() {
      mount(EditStudio());
      await new Promise((r) => setTimeout(r, 20));
      const toolCards = container.querySelectorAll('.grid > div');
      // "AI Edit" (seedream-5.0-edit) is the 4th tool card and takes a prompt.
      toolCards[3].click();
      await new Promise((r) => setTimeout(r, 20));
      const pickerOpts = vi.mocked(createUploadPicker).mock.calls[0][0];
      pickerOpts.onSelect({ url: 'https://cdn/source.png' });
      const promptField = container.querySelector('input[aria-label="Edit prompt"]');
      promptField.value = 'remove the background';
      return findButton(container, 'Apply Edit');
    }

    it('blocks the paid edit when entitlement is missing', async () => {
      vi.mocked(requireEntitlement).mockResolvedValue(BLOCKED);
      const applyBtn = await selectToolAndUpload();
      applyBtn.click();
      await new Promise((r) => setTimeout(r, 80));

      expect(requireEntitlement).toHaveBeenCalled();
      expect(muapi.generateImage).not.toHaveBeenCalled();
      expect(muapi.generateI2I).not.toHaveBeenCalled();
    });

    it('runs the paid edit when entitled', async () => {
      vi.mocked(requireEntitlement).mockResolvedValue(PAID);
      const applyBtn = await selectToolAndUpload();
      applyBtn.click();
      await new Promise((r) => setTimeout(r, 80));

      expect(requireEntitlement).toHaveBeenCalled();
      expect(muapi.generateI2I).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // PhotoStudioPage — gate on the generate handler entry
  // ---------------------------------------------------------------------------
  describe('PhotoStudioPage', () => {
    async function setupProductPhoto() {
      mount(PhotoStudioPage());
      await new Promise((r) => setTimeout(r, 20));

      const pickerOpts = vi.mocked(createUploadPicker).mock.calls[0][0];
      pickerOpts.onSelect({ url: 'https://cdn/product.png' });

      // Toggle "Direct MuAPI" mode and choose a model.
      findButton(container, 'Brand API').click();
      await new Promise((r) => setTimeout(r, 20));
      const modelSelect = Array.from(container.querySelectorAll('select')).find((s) =>
        Array.from(s.options).some((o) => o.value === 'flux-i2i')
      );
      modelSelect.value = 'flux-i2i';
      modelSelect.dispatchEvent(new Event('change', { bubbles: true }));

      // Pick one category + one style.
      const catBtn = findButton(container, 'Apparel');
      catBtn.click();
      const styleBtn = findButton(container, 'Studio');
      styleBtn.click();

      return findButton(container, 'Generate Product Photos');
    }

    it('blocks the paid generate when entitlement is missing', async () => {
      vi.mocked(requireEntitlement).mockResolvedValue(BLOCKED);
      const genBtn = await setupProductPhoto();
      genBtn.click();
      await new Promise((r) => setTimeout(r, 120));

      expect(requireEntitlement).toHaveBeenCalled();
      expect(muapi.generateI2I).not.toHaveBeenCalled();
      expect(apiCall).not.toHaveBeenCalled();
    });

    it('runs the paid generate when entitled', async () => {
      vi.mocked(requireEntitlement).mockResolvedValue(PAID);
      const genBtn = await setupProductPhoto();
      genBtn.click();
      await new Promise((r) => setTimeout(r, 150));

      expect(requireEntitlement).toHaveBeenCalled();
      expect(muapi.generateI2I).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // AnimatePage — gate on the animate handler entry
  // ---------------------------------------------------------------------------
  describe('AnimatePage', () => {
    async function setupAnimate() {
      mount(AnimatePage());
      await new Promise((r) => setTimeout(r, 20));

      // Switch to the Upload source tab so the upload picker renders.
      findButton(container, 'Upload').click();
      await new Promise((r) => setTimeout(r, 20));
      const pickerOpts = vi.mocked(createUploadPicker).mock.calls[0][0];
      pickerOpts.onSelect({ url: 'https://cdn/source.png' });

      // Toggle "Direct MuAPI" mode and choose a model.
      findButton(container, 'Brand API').click();
      await new Promise((r) => setTimeout(r, 20));
      const modelSelect = Array.from(container.querySelectorAll('select')).find((s) =>
        Array.from(s.options).some((o) => o.value === 'kling-i2v')
      );
      modelSelect.value = 'kling-i2v';
      modelSelect.dispatchEvent(new Event('change', { bubbles: true }));

      return findButton(container, 'Animate');
    }

    it('blocks the paid animate when entitlement is missing', async () => {
      vi.mocked(requireEntitlement).mockResolvedValue(BLOCKED);
      const genBtn = await setupAnimate();
      genBtn.click();
      await new Promise((r) => setTimeout(r, 120));

      expect(requireEntitlement).toHaveBeenCalled();
      expect(muapi.generateI2V).not.toHaveBeenCalled();
      expect(apiCall).not.toHaveBeenCalled();
    });

    it('runs the paid animate when entitled', async () => {
      vi.mocked(requireEntitlement).mockResolvedValue(PAID);
      const genBtn = await setupAnimate();
      genBtn.click();
      await new Promise((r) => setTimeout(r, 150));

      expect(requireEntitlement).toHaveBeenCalled();
      expect(muapi.generateI2V).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // CinemaTemplateStudio — gate on runGeneration()
  // ---------------------------------------------------------------------------
  describe('CinemaTemplateStudio', () => {
    async function openCreateViewAndSelect() {
      mount(CinemaTemplateStudio());
      await new Promise((r) => setTimeout(r, 50));
      const card = container.querySelector('.group');
      card.click();
      await new Promise((r) => setTimeout(r, 50));
      return container.querySelector('#generate-btn');
    }

    it('blocks the paid generate when entitlement is missing', async () => {
      vi.mocked(requireEntitlement).mockResolvedValue(BLOCKED);
      const genBtn = await openCreateViewAndSelect();
      genBtn.click();
      await new Promise((r) => setTimeout(r, 120));

      expect(requireEntitlement).toHaveBeenCalled();
      expect(muapi.generateVideo).not.toHaveBeenCalled();
      expect(muapi.generateImage).not.toHaveBeenCalled();
      expect(muapi.generateI2V).not.toHaveBeenCalled();
      expect(muapi.processV2V).not.toHaveBeenCalled();
    });

    it('runs the paid generate when entitled', async () => {
      vi.mocked(requireEntitlement).mockResolvedValue(PAID);
      const genBtn = await openCreateViewAndSelect();
      genBtn.click();
      await new Promise((r) => setTimeout(r, 150));

      expect(requireEntitlement).toHaveBeenCalled();
      expect(muapi.generateVideo).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // AICaptionsModal — gate on generate() (covers every studio's captions entry)
  // ---------------------------------------------------------------------------
  describe('AICaptionsModal', () => {
    function openModalWithUrl() {
      const modal = openAICaptionsModal({ videoUrl: 'https://cdn/source.mp4', onComplete: () => {}, onError: () => {} });
      return { modal, generateBtn: document.querySelector('[data-action="generate"]') };
    }

    it('blocks the paid caption generation when entitlement is missing', async () => {
      vi.mocked(requireEntitlement).mockResolvedValue(BLOCKED);
      const { generateBtn } = openModalWithUrl();
      generateBtn.click();
      await new Promise((r) => setTimeout(r, 80));

      expect(requireEntitlement).toHaveBeenCalled();
      expect(muapi.uploadFile).not.toHaveBeenCalled();
      expect(muapi.processVideoTool).not.toHaveBeenCalled();
    });

    it('runs the paid caption generation when entitled', async () => {
      vi.mocked(requireEntitlement).mockResolvedValue(PAID);
      const { generateBtn } = openModalWithUrl();
      generateBtn.click();
      await new Promise((r) => setTimeout(r, 120));

      expect(requireEntitlement).toHaveBeenCalled();
      expect(muapi.processVideoTool).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // StoryboardStudio — gate on the "Generate All Frames" loop handler
  // ---------------------------------------------------------------------------
  describe('StoryboardStudio', () => {
    async function setupStoryboard() {
      // StoryboardStudio is async — it awaits its storyboard engine before
      // rendering the frame cards.
      mount(await StoryboardStudio());
      await new Promise((r) => setTimeout(r, 80));
      // Give every frame a prompt so the Generate All loop has work to do.
      const promptInputs = container.querySelectorAll('textarea[aria-label="Frame description"]');
      promptInputs.forEach((ta) => {
        ta.value = 'a hero shot of a product';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      });
      return findButton(container, 'Generate All Frames');
    }

    it('blocks the paid batch when entitlement is missing', async () => {
      vi.mocked(requireEntitlement).mockResolvedValue(BLOCKED);
      const genAllBtn = await setupStoryboard();
      genAllBtn.click();
      await new Promise((r) => setTimeout(r, 120));

      expect(requireEntitlement).toHaveBeenCalled();
      expect(engineGenerateFrameImage).not.toHaveBeenCalled();
      expect(muapi.generateImage).not.toHaveBeenCalled();
      expect(muapi.generateI2V).not.toHaveBeenCalled();
    });

    it('runs the paid batch when entitled', async () => {
      vi.mocked(requireEntitlement).mockResolvedValue(PAID);
      const genAllBtn = await setupStoryboard();
      genAllBtn.click();
      await new Promise((r) => setTimeout(r, 200));

      expect(requireEntitlement).toHaveBeenCalled();
      expect(engineGenerateFrameImage).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // TimelineEditorPage — gate on the CineGen music-generation trigger.
  //
  // This one cannot be tested through the DOM: `#cinegenMusicBtn` is never
  // rendered by the page's templates (the CineGen button wiring at
  // bindEvents() is currently dead code), and the page's static module graph
  // cannot even be imported in jsdom because sibling modules under
  // src/lib/editor/ have unresolved relative imports that are being repaired
  // by other agents. Assert the gate at the source seam instead: the paid
  // call (muapi.generateMusic) must sit behind requireEntitlement() inside
  // the music click handler.
  // ---------------------------------------------------------------------------
  describe('TimelineEditorPage music generation', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/TimelineEditorPage.jsx'),
      'utf8'
    );

    it('gates the music-generation handler before the paid generateMusic call', () => {
      const handlerIdx = source.indexOf("musicBtn.addEventListener('click', async () => {");
      expect(handlerIdx).toBeGreaterThan(-1);

      const gateIdx = source.indexOf('if (!(await requireEntitlement())) return;', handlerIdx);
      const paidIdx = source.indexOf('muapi.generateMusic(', handlerIdx);
      expect(paidIdx).toBeGreaterThan(-1);

      // The gate must exist and must come before the paid call.
      expect(gateIdx).toBeGreaterThan(-1);
      expect(gateIdx).toBeLessThan(paidIdx);
    });

    it('still imports requireEntitlement for the timeline page', () => {
      expect(source).toContain("import { requireEntitlement } from '../lib/clerkEntitlements.js'");
    });
  });
});
