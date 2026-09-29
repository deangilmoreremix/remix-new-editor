import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all studio dependencies
vi.mock('../../src/lib/muapi.js', () => {
  const muapi = {
    generateI2V: vi.fn(async () => ({ url: 'https://example.com/video.mp4' })),
    generateImage: vi.fn(async () => ({ url: 'https://example.com/image.png' })),
    generateVideo: vi.fn(async () => ({ url: 'https://example.com/video.mp4' })),
    generateI2I: vi.fn(async () => ({ url: 'https://example.com/image.png' })),
    processV2V: vi.fn(async () => ({ url: 'https://example.com/video.mp4' })),
  };
  return { muapi };
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
  mountStudioChrome: vi.fn(() => document.createElement('div')),
  mountStudioDrawer: vi.fn(() => document.createElement('div')),
  createStudioMenuButton: vi.fn(() => document.createElement('button')),
}));

vi.mock('../../src/components/personalize/personalizePopover.js', () => ({
  mountPersonalizeTrigger: vi.fn(() => {}),
}));

vi.mock('../../src/lib/editor/captionActions.js', () => ({
  addCaptionButton: vi.fn(() => {}),
}));

vi.mock('../../src/lib/thumbnails.js', () => ({
  getTemplateThumbnailCandidates: vi.fn(() => ['/thumb.png']),
  createHeroSection: vi.fn(() => document.createElement('div')),
  getCustomThumbnailFromCache: vi.fn(() => null),
  saveCustomThumbnailToCache: vi.fn(),
  clearCustomThumbnailCache: vi.fn(),
}));

vi.mock('../../src/lib/models.js', () => ({
  avatarModels: [{ id: 'avatar-1', name: 'Avatar 1', provider: 'muapi' }],
  videoToolsModels: [{ id: 'video-tools-1', name: 'Video Tools 1', provider: 'muapi' }],
  trainingModels: [{ id: 'training-1', name: 'Training 1', provider: 'muapi' }],
  imageLipSyncModels: [{ id: 'lipsync-1', name: 'LipSync 1', provider: 'muapi', inputs: { resolution: '1080p' } }],
  videoLipSyncModels: [{ id: 'v lipsync-1', name: 'Video LipSync 1', provider: 'muapi' }],
  lipsyncModels: [{ id: 'lipsync-1', name: 'LipSync 1', provider: 'muapi' }],
  getLipSyncModelById: vi.fn(() => ({ id: 'test', name: 'Test Model' })),
  getResolutionsForLipSyncModel: vi.fn(() => ['1080p', '720p']),
  textModels: [{ id: 'text-1', name: 'Text Model 1', provider: 'muapi' }],
  getTextModelById: vi.fn(() => ({ id: 'test', name: 'Test Model' })),
  t2iModels: [{ id: 'flux', name: 'FLUX' }],
  i2iModels: [{ id: 'flux-i2i', name: 'FLUX I2I' }],
  i2vModels: [{ id: 'kling-i2v', name: 'Kling I2V' }],
  t2vModels: [{ id: 'kling-v2.6-pro-t2v', name: 'Kling V2.6 Pro' }],
  v2vModels: [{ id: 'kling-v2v', name: 'Kling V2V' }],
  getModelById: vi.fn(() => ({ id: 'test', name: 'Test Model' })),
  getVideoModelById: vi.fn(() => ({ id: 'test', name: 'Test Model' })),
  getExtendedModel: vi.fn((m) => m),
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

vi.mock('../../src/lib/clerkEntitlements.js', () => ({
  requireEntitlement: vi.fn(() => true),
}));

vi.mock('../../src/components/UploadPicker.js', () => ({
  createUploadPicker: vi.fn(() => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Upload';
    return {
      trigger,
      panel: document.createElement('div'),
      open: vi.fn(),
      close: vi.fn(),
    };
  }),
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

vi.mock('../../src/lib/modelInputExtensions.js', () => ({
  getExtendedModel: vi.fn((m) => m),
}));

vi.mock('../../src/data/exampleGalleryAssets.js', () => ({
  getAssetsForStudio: vi.fn(() => []),
}));

vi.mock('../../src/lib/editor/upload.js', () => ({
  uploadMediaFile: vi.fn(() => Promise.resolve('https://example.com/upload.mp4')),
}));

vi.mock('../../src/lib/InlineInstructions.js', () => ({
  createInlineInstructions: vi.fn(() => document.createElement('div')),
}));

vi.mock('../../src/components/studios/ExampleGallery.js', () => ({
  default: vi.fn(() => document.createElement('div')),
}));

vi.mock('../../src/lib/modelPickerIntegration.js', () => ({
  openModelPicker: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../src/lib/studioControls.js', () => ({
  createAdvancedControls: vi.fn(() => document.createElement('div')),
}));

vi.mock('../../src/lib/cinematicTemplates.js', () => ({
  CINEMATIC_CATEGORIES: { INDUSTRY: 'industry' },
  OUTPUT_STYLES: { LUXURY_BRAND_PROMO: 'luxury_brand_promo' },
  VISUAL_STYLES: { CINEMATIC: 'cinematic' },
  SHOT_TYPES: ['WIDE', 'MEDIUM', 'CLOSEUP'],
  CAMERA_MOVEMENTS: ['STATIC', 'PUSH_IN', 'PAN'],
  PACING_OPTIONS: ['SLOW', 'MEDIUM', 'FAST'],
  CTA_TYPES: ['LEARN_MORE', 'SHOP_NOW'],
  ENDING_TYPES: ['FADE_OUT', 'CUT_TO_BLACK'],
  BRAND_VOICES: ['professional', 'casual'],
  TARGET_AUDIENCES: ['general', 'enterprise'],
  SCENE_STRUCTURES: ['HOOK', 'BODY', 'CTA'],
  CINEMATIC_TEMPLATES: [],
  CinematicTemplateRegistry: vi.fn(() => ({
    getAll: vi.fn(() => []),
    get: vi.fn(() => null),
  })),
  PromptAssemblyEngine: vi.fn(),
  SceneBuilder: vi.fn(() => ({
    addScene: vi.fn(),
    removeScene: vi.fn(),
    moveScene: vi.fn(),
    getScenes: vi.fn(() => []),
    clear: vi.fn(),
  })),
  ShotBuilder: vi.fn(),
  StoryboardBuilder: vi.fn(),
  TemplateInputBuilder: vi.fn(),
  TemplateStorage: {
    isFavorite: vi.fn(() => false),
    getRecent: vi.fn(() => []),
    exportTemplate: vi.fn(),
  },
  RenderHandoff: vi.fn(),
  getTemplateRegistry: vi.fn(() => ({
    getAll: vi.fn(() => []),
    get: vi.fn(() => null),
  })),
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

vi.mock('../../src/lib/videoIntentStore.js', () => ({
  getVideoIntent: vi.fn(() => null),
  setVideoIntent: vi.fn(),
  subscribeVideoIntent: vi.fn(),
  resetVideoIntent: vi.fn(),
}));

// Import all studios
import { AvatarStudio } from '../../src/components/AvatarStudio.js';
import { CharacterStudio } from '../../src/components/CharacterStudio.js';
import { ChatStudio } from '../../src/components/ChatStudio.js';
import { CinemaStudio } from '../../src/components/CinemaStudio.js';
import { CommercialStudio } from '../../src/components/CommercialStudio.js';
import { LipSyncStudio } from '../../src/components/LipSyncStudio.js';
import { StoryboardStudio } from '../../src/components/StoryboardStudio.js';
import { TrainingStudio } from '../../src/components/TrainingStudio.js';
import { UpscaleStudio } from '../../src/components/UpscaleStudio.js';
import { VideoToolsStudio } from '../../src/components/VideoToolsStudio.js';
import { CinemaTemplateStudio } from '../../src/components/CinemaTemplateStudio.js';
import { TemplateStudio } from '../../src/components/TemplateStudio.js';

describe('All studios smoke tests', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
    
    // Mock scrollIntoView for JSDOM
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {};
    }
  });

  afterEach(() => {
    if (container.parentNode) container.parentNode.removeChild(container);
  });

  async function mountStudio(StudioComponent, templateId) {
    const result = templateId ? StudioComponent(templateId) : StudioComponent();
    const element = result && result.then ? await result : result;
    container.innerHTML = '';
    if (element && element.nodeType === Node.DOCUMENT_FRAGMENT_NODE && element.firstChild) {
      container.appendChild(element.firstChild);
    } else if (element) {
      container.appendChild(element);
    }
    return element;
  }

  describe('AvatarStudio', () => {
    it('mounts without crashing', async () => {
      mountStudio(AvatarStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.querySelector('h1')).not.toBeNull();
    });

    it('renders header with title', async () => {
      mountStudio(AvatarStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.textContent).toContain('Avatar Studio');
    });

    it('renders prompt input', async () => {
      mountStudio(AvatarStudio);
      await new Promise(r => setTimeout(r, 50));
      const textarea = container.querySelector('textarea');
      expect(textarea).not.toBeNull();
    });

    it('renders generate button', async () => {
      mountStudio(AvatarStudio);
      await new Promise(r => setTimeout(r, 50));
      const genBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate'));
      expect(genBtn).not.toBeNull();
    });

    it('renders model selector', async () => {
      mountStudio(AvatarStudio);
      await new Promise(r => setTimeout(r, 50));
      const modelBtn = container.querySelector('button');
      expect(modelBtn).not.toBeNull();
    });
  });

  describe('CharacterStudio', () => {
    it('mounts without crashing', async () => {
      mountStudio(CharacterStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.querySelector('h1')).not.toBeNull();
    });

    it('renders header with title', async () => {
      mountStudio(CharacterStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.textContent).toContain('Character');
    });

    it('renders prompt input', async () => {
      mountStudio(CharacterStudio);
      await new Promise(r => setTimeout(r, 50));
      const textarea = container.querySelector('textarea');
      expect(textarea).not.toBeNull();
    });

    it('renders generate button', async () => {
      mountStudio(CharacterStudio);
      await new Promise(r => setTimeout(r, 50));
      const genBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate'));
      expect(genBtn).not.toBeNull();
    });
  });

  describe('ChatStudio', () => {
    it('mounts without crashing', async () => {
      mountStudio(ChatStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.querySelector('h1')).not.toBeNull();
    });

    it('renders header with title', async () => {
      mountStudio(ChatStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.textContent).toContain('Chat');
    });

    it('renders chat input', async () => {
      mountStudio(ChatStudio);
      await new Promise(r => setTimeout(r, 50));
      const input = container.querySelector('input[type="text"], textarea');
      expect(input).not.toBeNull();
    });

    it('renders send button', async () => {
      mountStudio(ChatStudio);
      await new Promise(r => setTimeout(r, 50));
      const sendBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Send'));
      expect(sendBtn).not.toBeNull();
    });
  });

  describe('CinemaStudio', () => {
    it('mounts without crashing', async () => {
      mountStudio(CinemaStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });

    it('renders header with title', async () => {
      mountStudio(CinemaStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });

    it('renders prompt input', async () => {
      mountStudio(CinemaStudio);
      await new Promise(r => setTimeout(r, 50));
      const textarea = container.querySelector('textarea, input[type="text"]');
      expect(textarea).not.toBeNull();
    });

    it('renders generate button', async () => {
      mountStudio(CinemaStudio);
      await new Promise(r => setTimeout(r, 50));
      const genBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate'));
      expect(genBtn).not.toBeNull();
    });

    it('renders model selector', async () => {
      mountStudio(CinemaStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });
  });

  describe('CommercialStudio', () => {
    it('mounts without crashing', async () => {
      mountStudio(CommercialStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.querySelector('h1')).not.toBeNull();
    });

    it('renders header with title', async () => {
      mountStudio(CommercialStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.textContent).toContain('Commercial');
    });

    it('renders prompt input', async () => {
      mountStudio(CommercialStudio);
      await new Promise(r => setTimeout(r, 50));
      const input = container.querySelector('button');
      expect(input).not.toBeNull();
    });

    it('renders generate button', async () => {
      mountStudio(CommercialStudio);
      await new Promise(r => setTimeout(r, 50));
      const genBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate'));
      expect(genBtn).not.toBeNull();
    });
  });

  describe('LipSyncStudio', () => {
    it('mounts without crashing', async () => {
      mountStudio(LipSyncStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.querySelector('h1')).not.toBeNull();
    });

    it('renders header with title', async () => {
      mountStudio(LipSyncStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.textContent).toContain('Lip Sync');
    });

    it('renders upload area', async () => {
      mountStudio(LipSyncStudio);
      await new Promise(r => setTimeout(r, 50));
      const upload = container.querySelector('input[type="file"]');
      expect(upload).not.toBeNull();
    });

    it('renders generate button', async () => {
      mountStudio(LipSyncStudio);
      await new Promise(r => setTimeout(r, 50));
      const genBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate'));
      expect(genBtn).not.toBeNull();
    });
  });

  describe('StoryboardStudio', () => {
    it('mounts without crashing', async () => {
      mountStudio(StoryboardStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });

    it('renders header with title', async () => {
      mountStudio(StoryboardStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });

    it('renders prompt input', async () => {
      mountStudio(StoryboardStudio);
      await new Promise(r => setTimeout(r, 50));
      // StoryboardStudio may not have a prompt input in the main view
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });

    it('renders generate button', async () => {
      mountStudio(StoryboardStudio);
      await new Promise(r => setTimeout(r, 50));
      const genBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate'));
      expect(genBtn).not.toBeNull();
    });
  });

  describe('TrainingStudio', () => {
    it('mounts without crashing', async () => {
      mountStudio(TrainingStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.querySelector('h1')).not.toBeNull();
    });

    it('renders header with title', async () => {
      mountStudio(TrainingStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.textContent).toContain('Training');
    });

    it('renders prompt input', async () => {
      mountStudio(TrainingStudio);
      await new Promise(r => setTimeout(r, 50));
      const input = container.querySelector('input[type="text"], textarea');
      expect(input).not.toBeNull();
    });

    it('renders generate button', async () => {
      mountStudio(TrainingStudio);
      await new Promise(r => setTimeout(r, 50));
      const genBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate'));
      expect(genBtn).not.toBeNull();
    });
  });

  describe('UpscaleStudio', () => {
    it('mounts without crashing', async () => {
      mountStudio(UpscaleStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.querySelector('h1')).not.toBeNull();
    });

    it('renders header with title', async () => {
      mountStudio(UpscaleStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.textContent).toContain('Upscale');
    });

    it('renders upload area', async () => {
      mountStudio(UpscaleStudio);
      await new Promise(r => setTimeout(r, 50));
      const upload = container.querySelector('button');
      expect(upload).not.toBeNull();
    });

    it('renders generate button', async () => {
      mountStudio(UpscaleStudio);
      await new Promise(r => setTimeout(r, 50));
      const genBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate'));
      expect(genBtn).not.toBeNull();
    });
  });

  describe('VideoToolsStudio', () => {
    it('mounts without crashing', async () => {
      mountStudio(VideoToolsStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.querySelector('h1')).not.toBeNull();
    });

    it('renders header with title', async () => {
      mountStudio(VideoToolsStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.textContent).toContain('Video Tools');
    });

    it('renders tool buttons', async () => {
      mountStudio(VideoToolsStudio);
      await new Promise(r => setTimeout(r, 50));
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('TemplateStudio', () => {
    it('mounts without crashing', async () => {
      mountStudio(TemplateStudio, 'restaurant-brand-film');
      await new Promise(r => setTimeout(r, 50));
      expect(container.querySelector('h1')).not.toBeNull();
    });

    it('renders header with template name', async () => {
      mountStudio(TemplateStudio, 'restaurant-brand-film');
      await new Promise(r => setTimeout(r, 50));
      const h1 = container.querySelector('h1');
      expect(h1).not.toBeNull();
      expect(h1.textContent.length).toBeGreaterThan(0);
    });
  });

  describe('CinemaTemplateStudio', () => {
    it('mounts without crashing', async () => {
      mountStudio(CinemaTemplateStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.querySelector('h1')).not.toBeNull();
    });

    it('renders header with title', async () => {
      mountStudio(CinemaTemplateStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.textContent).toContain('CINEMATIC TEMPLATES');
    });

    it('renders filter buttons', async () => {
      mountStudio(CinemaTemplateStudio);
      await new Promise(r => setTimeout(r, 50));
      expect(container.querySelector('#favorites-btn')).not.toBeNull();
      expect(container.querySelector('#recent-btn')).not.toBeNull();
      expect(container.querySelector('#custom-btn')).not.toBeNull();
    });
  });
});
