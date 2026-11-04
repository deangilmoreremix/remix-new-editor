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

// Mock showToast to suppress UI side effects during tests
vi.mock('../../src/lib/loading.js', () => ({
  showToast: vi.fn(() => {}),
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
  createStudioHeader: vi.fn((_id, title = '', subtitle = '') => {
    const el = document.createElement('div');
    el.innerHTML = `<h1></h1><p></p>`;
    el.querySelector('h1').textContent = title;
    el.querySelector('p').textContent = subtitle;
    return el;
  }),
  getTemplateThumbnailCandidates: vi.fn((template) => ['/thumb.png']),
  saveCustomThumbnailToCache: vi.fn(),
  clearCustomThumbnailCache: vi.fn(),
  getCustomThumbnailFromCache: vi.fn(() => null),
}));

vi.mock('../../src/lib/showcaseTemplateResolver.js', () => ({
  resolveTemplate: vi.fn(() => null),
}));

vi.mock('../../src/lib/modelCatalog.js', () => ({
  getEnrichedModels: vi.fn(async () => []),
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

vi.mock('../../src/components/modals/TemplateThumbnailModal.jsx', () => ({
  TemplateThumbnailModal: class MockTemplateThumbnailModal {
    constructor() {
      this.open = () => {};
      this.close = () => {};
    }
  },
  mountThumbnailModal: vi.fn(() => ({})),
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


// The real upload picker needs a browser file dialog; capture its options so
// the test can attach media through the same onSelect contract.
const pickers = vi.hoisted(() => ({ list: [] as any[] }));
vi.mock('../../src/components/UploadPicker.js', () => ({
  createUploadPicker: vi.fn((opts) => {
    const trigger = document.createElement('button');
    pickers.list.push({ opts, trigger });
    return { trigger, panel: document.createElement('div'), reset: vi.fn(), uploadFile: vi.fn() };
  }),
}));

import { CinemaTemplateStudio } from '../../src/components/CinemaTemplateStudio.js';
import { CINEMATIC_TEMPLATES } from '../../src/lib/cinematicTemplates.js';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

describe('Cinema Template Studio: every input reaches the generation prompt', () => {
  let container;
  beforeEach(() => {
    pickers.list.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('template fields, Advanced Controls and Creative Intelligence cards are all in the prompt', async () => {
    const { muapi } = await import('../../src/lib/muapi.js');
    const el = CinemaTemplateStudio();
    container.appendChild(el);
    await wait(50);

    // Open a real cinematic template.
    const target = CINEMATIC_TEMPLATES.find(t => t.outputType === 'video');
    const card = Array.from(container.querySelectorAll('.group.rounded-xl.p-4.cursor-pointer'))
      .find(c => (c.textContent || '').includes(target.name)) || container.querySelector('.group.rounded-xl.p-4.cursor-pointer');
    card.click();
    await wait(120);

    // Fill every visible text field of the template itself.
    const values = [];
    container.querySelectorAll('input[type="text"]:not([data-advanced-field]), textarea:not([data-advanced-field]):not([data-tile]):not(#outputTextarea)')
      .forEach((f, i) => {
        const v = `tpl-field-${i}-value`;
        f.value = v;
        f.dispatchEvent(new Event('input', { bubbles: true }));
        f.dispatchEvent(new Event('change', { bubbles: true }));
        values.push(v);
      });

    expect(values.length).toBeGreaterThan(0);

    // Advanced Controls.
    const adv = {
      businessType: 'boutique gym', audience: 'busy professionals', subject: 'coach mid-workout',
      setting: 'neon-lit warehouse gym', cta: 'Join today', extraInstructions: 'end on logo',
    };
    for (const [k, v] of Object.entries(adv)) {
      const f = container.querySelector(`[data-advanced-field="${k}"]`);
      expect(f, k).not.toBeNull();
      f.value = v;
      f.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const format = container.querySelector('[data-advanced-field="templateType"]');
    format.value = 'dramatic-trailer';
    format.dispatchEvent(new Event('change', { bubbles: true }));

    // Creative Intelligence card edit.
    const cine = container.querySelector('[data-tile="cinematic"]');
    cine.value = 'Handheld close-ups, whip pans between beats';
    cine.dispatchEvent(new Event('input', { bubbles: true }));

    // Attach the required start frame through the picker.
    const frame = pickers.list.find(p => p.opts.frameMode);
    expect(frame).toBeDefined();
    frame.opts.onSelect({ startUrl: 'https://cdn.test/start.png', endUrl: null, urls: ['https://cdn.test/start.png'] });

    container.querySelector('#generate-btn').click();
    await wait(150);

    const call = muapi.generateI2V.mock.calls.at(-1) || muapi.generateVideo.mock.calls.at(-1);
    expect(call, 'a video generation call').toBeDefined();
    const params = call[0];
    const prompt = params.prompt;
    values.forEach(v => expect(prompt).toContain(v));
    Object.values(adv).forEach(v => expect(prompt).toContain(v));
    expect(prompt).toContain('dramatic trailer');
    expect(prompt).toContain('Handheld close-ups, whip pans between beats');
    expect(params.image_url).toBe('https://cdn.test/start.png');
    expect(params.model).toBe('kling-v2.6-pro-i2v');
    el.remove();
  });

  it('has the Video Studio input tools and they reach the request', async () => {
    const { muapi } = await import('../../src/lib/muapi.js');
    const el = CinemaTemplateStudio();
    container.appendChild(el);
    await wait(50);
    container.querySelector('.group.rounded-xl.p-4.cursor-pointer').click();
    await wait(150);

    // Same tools as the Video Studio prompt bar.
    expect(container.querySelector('[data-tool="ai-pick"]')).toBeNull();
    expect(container.querySelector('[data-tool="advanced"]')).not.toBeNull();
    expect(container.querySelector('[data-tool="motion-style"]')).not.toBeNull();
    expect(container.querySelector('.template-video-settings')).not.toBeNull();
    expect(container.querySelector('.template-media-field[data-media-kind="video"]')).not.toBeNull();
    expect(container.querySelector('.studio-attachment-toolbar')).not.toBeNull();

    // Motion & Style → prompt.
    container.querySelector('[data-style="Anime"]').click();
    const frame = pickers.list.filter(p => p.opts.frameMode).at(-1);
    frame.opts.onSelect({ startUrl: 'https://cdn.test/s.png', endUrl: 'https://cdn.test/e.png', urls: [] });
    container.querySelector('#generate-btn').click();
    await wait(150);
    const params = muapi.generateI2V.mock.calls.at(-1)[0];
    expect(params.prompt).toContain('anime style');
    expect(params.image_url).toBe('https://cdn.test/s.png');
    expect(params.last_image_url).toBe('https://cdn.test/e.png');
    expect(params.signal).toBeDefined();
    expect(typeof params.onRequestId).toBe('function');

    // After-generation tools (Video Studio): scrubber, Regenerate, history.
    await wait(100);
    expect(container.querySelector('.template-frame-scrubber')).not.toBeNull();
    expect(container.querySelector('[data-result-history] [data-history-url]')).not.toBeNull();
    const calls = muapi.generateI2V.mock.calls.length;
    container.querySelector('[data-action="regenerate"]').click();
    await wait(150);
    expect(muapi.generateI2V.mock.calls.length).toBe(calls + 1);
    // Regenerate keeps the model chosen in the video model dropdown.
    expect(muapi.generateI2V.mock.calls.at(-1)[0].model).toBe(params.model);
    el.remove();
  });

  it('Regenerate re-runs the result selected in history, not the newest run', async () => {
    const { muapi } = await import('../../src/lib/muapi.js');
    const el = CinemaTemplateStudio();
    container.appendChild(el);
    await wait(50);
    container.querySelector('.group.rounded-xl.p-4.cursor-pointer').click();
    await wait(150);

    const attachFrame = () => {
      const frame = pickers.list.filter(p => p.opts.frameMode).at(-1);
      frame.opts.onSelect({ startUrl: 'https://cdn.test/s.png', endUrl: null, urls: ['https://cdn.test/s.png'] });
    };

    // Run 1: Anime style.
    container.querySelector('[data-style="Anime"]').click();
    attachFrame();
    container.querySelector('#generate-btn').click();
    await wait(200);
    const first = muapi.generateI2V.mock.calls.at(-1)[0];
    const firstUrl = container.querySelector('[data-result-history] [data-history-url]').getAttribute('data-history-url');

    // Run 2: back to the form, a different style.
    container.querySelector('#back-btn').click();
    await wait(100);
    container.querySelector('[data-style="Anime"]').click();
    const other = Array.from(container.querySelectorAll('[data-style]')).find(b => b.getAttribute('data-style') !== 'Anime');
    other.click();
    attachFrame();
    container.querySelector('#generate-btn').click();
    await wait(200);
    const second = muapi.generateI2V.mock.calls.at(-1)[0];
    expect(second.prompt).not.toBe(first.prompt);

    // Select run 1 in the history strip, then Regenerate.
    container.querySelector(`[data-result-history] [data-history-url="${firstUrl}"]`).click();
    await wait(100);
    const before = muapi.generateI2V.mock.calls.length;
    container.querySelector('[data-action="regenerate"]').click();
    await wait(200);
    expect(muapi.generateI2V.mock.calls.length).toBe(before + 1);
    const regen = muapi.generateI2V.mock.calls.at(-1)[0];
    expect(regen.prompt).toBe(first.prompt);
    expect(regen.model).toBe(first.model);
    expect(regen.image_url).toBe(first.image_url);
    // Per-run fields are not carried over from the stored run.
    expect(regen.signal).not.toBe(first.signal);
    expect(typeof regen.onRequestId).toBe('function');
    el.remove();
  });
});
