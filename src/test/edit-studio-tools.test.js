// @vitest-environment jsdom
// Edit Studio: gallery of 16 tools, each opening its own studio view.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/muapi.js', () => ({
  muapi: { generateI2I: vi.fn(async () => ({ url: 'https://cdn.muapi.ai/result.png' })) },
}));
vi.mock('../lib/generationHistory.js', () => ({ registerGeneration: vi.fn() }));
vi.mock('../lib/studioChrome.js', () => ({ mountStudioChrome: vi.fn() }));
vi.mock('../components/AuthModal.js', () => ({ AuthModal: vi.fn() }));
vi.mock('../components/personalize/personalizePopover.js', () => ({ replaceTokensInPrompt: (text) => text }));
vi.mock('../lib/attachmentToolbar.js', () => ({ createAttachmentToolbar: vi.fn(() => ({})) }));
vi.mock('../lib/loading.js', () => ({ showToast: vi.fn() }));
vi.mock('../lib/thumbnails.js', () => ({
  createEditorBanner: vi.fn(() => document.createElement('div')),
  demoteBannerHeading: vi.fn((el) => {
    const h = el.querySelector('h1');
    if (h) { const d = document.createElement('div'); d.textContent = h.textContent; h.replaceWith(d); }
    return el;
  }),
  getToolThumbnail: (id) => `/thumbnails/tools/${id}.webp`,
  createThumbnailImg: (src, alt) => Object.assign(document.createElement('img'), { src, alt }),
  createStudioHeader: (_id, title, subtitle) => {
    const el = document.createElement('div');
    el.innerHTML = '<h2></h2><p></p>';
    el.querySelector('h2').textContent = title;
    el.querySelector('p').textContent = subtitle;
    return el;
  },
}));
const pickers = [];
vi.mock('../components/UploadPicker.js', () => ({
  createUploadPicker: vi.fn((opts) => {
    const picker = {
      opts,
      trigger: document.createElement('button'),
      panel: document.createElement('div'),
      reset: vi.fn(),
      setMaxImages: vi.fn(),
    };
    pickers.push(picker);
    return picker;
  }),
}));
vi.mock('../lib/muapiStudioMedia.js', () => ({
  resolveMuapiMediaRef: vi.fn(async (ref) => ref.url),
  resolveMuapiMediaRefs: vi.fn(async (refs) => refs.map((ref) => ref.url)),
  ingestStudioUpload: vi.fn(),
}));

import { EditStudio, EDIT_TOOLS, getEditToolBySlug, validateEditInputs, getSchemaControls } from '../components/EditStudio.js';
import {
  AI_EDIT_MODEL_IDS, UPSCALE_MODEL_IDS, PRODUCT_MODEL_IDS, EFFECT_MODEL_IDS, ANGLE_MODEL_IDS,
  CHARACTER_MODEL_IDS, getModelSpec,
} from '../components/edit/editModels.js';
import { strokesToMaskPixels, MASK_SELECTED, MASK_KEPT } from '../components/edit/maskPainter.js';
import { muapi } from '../lib/muapi.js';

const REQUESTED = [
  'Remove Object', 'Remove Background', 'Extend Image', 'AI Edit', 'Reframe', 'Change Dress',
  'Enhance Skin', 'Colorize', 'Add Watermark', 'Upscale', 'Face Swap', 'Product Shot', 'Ghibli Style',
  'Photo Effects', 'Change Angle', 'Character & Reference',
];

function mount() {
  pickers.length = 0;
  const el = EditStudio();
  document.body.innerHTML = '';
  document.body.appendChild(el);
  return el;
}
const isHidden = (el) => el.classList.contains('hidden');
const view = (el, name) => el.querySelector(`[data-edit-view="${name}"]`);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Edit Studio gallery', () => {
  beforeEach(() => window.history.replaceState(null, '', '/#/edit'));

  test('has the 13 requested tools plus 3 model-based ones, each with a unique link name', () => {
    expect(EDIT_TOOLS.map((tool) => tool.name)).toEqual(REQUESTED);
    expect(new Set(EDIT_TOOLS.map((tool) => tool.slug)).size).toBe(16);
  });

  test('shows only the 16 tool cards — no Browse All Models section', () => {
    const el = mount();
    expect(el.querySelectorAll('[data-edit-tool]').length).toBe(16);
    expect(el.textContent).not.toContain('Browse All Models');
    expect(isHidden(view(el, 'gallery'))).toBe(false);
    expect(isHidden(view(el, 'studio'))).toBe(true);
  });

  test('clicking a card opens that tool studio with its own URL, and back returns', () => {
    const el = mount();
    el.querySelector('[data-edit-tool="face-swap"]').click();
    expect(new URLSearchParams(window.location.search).get('tool')).toBe('face-swap');
    expect(window.location.hash).toBe('#/edit');
    expect(isHidden(view(el, 'gallery'))).toBe(true);
    expect(el.querySelector('h1').textContent).toBe('Face Swap');
    expect(el.textContent).toContain('New face photo');

    [...el.querySelectorAll('button')].find((b) => b.textContent === '← All tools').click();
    expect(window.location.search).toBe('');
    expect(isHidden(view(el, 'gallery'))).toBe(false);
  });

  test('a ?tool= link opens that tool directly', () => {
    window.history.replaceState(null, '', '/?tool=ai-edit#/edit');
    const el = mount();
    expect(isHidden(view(el, 'studio'))).toBe(false);
    expect(el.querySelector('h1').textContent).toBe('AI Edit');
    expect(el.querySelector('[aria-label="Edit prompt"]').closest('.hidden')).toBeNull();
  });

  test('each tool shows the inputs it needs', () => {
    const el = mount();
    const open = (slug) => el.querySelector(`[data-edit-tool="${slug}"]`).click();
    const promptVisible = () => !el.querySelector('[aria-label="Edit prompt"]').closest('.hidden');
    const maskVisible = () => !isHidden(el.querySelector('[data-mask-painter]').parentElement);

    open('remove-background');
    expect(promptVisible()).toBe(false);
    open('product-shot');
    expect(promptVisible()).toBe(true);
    expect(el.textContent).toContain('Scene description');
    open('change-dress');
    expect(el.textContent).toContain('Outfit image');
    open('add-watermark');
    expect(el.querySelector('[data-control-key="position"]')).not.toBeNull();
    expect(el.querySelector('[data-control-key="opacity"]')).not.toBeNull();
    open('remove-object');
    expect(maskVisible()).toBe(true);
  });
});

describe('Edit Studio running a tool', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?tool=face-swap#/edit');
    localStorage.setItem('muapi_key', 'test-key');
    muapi.generateI2I.mockClear();
  });

  test('asks for the missing inputs before calling the API', () => {
    const el = mount();
    [...el.querySelectorAll('button')].find((b) => b.textContent === 'Apply Edit').click();
    expect(el.querySelector('[role="alert"]').textContent).toMatch(/source image/i);
    expect(muapi.generateI2I).not.toHaveBeenCalled();
  });

  test('sends the source and face images, then shows a before/after preview', async () => {
    const el = mount();
    // Pickers are created in order: source, extra references, second image.
    const [sourcePicker, , facePicker] = pickers;
    sourcePicker.opts.onSelect({ url: 'https://x/source.png', assetId: 'a1' });
    facePicker.opts.onSelect({ url: 'https://x/face.png', assetId: 'a2' });
    [...el.querySelectorAll('button')].find((b) => b.textContent === 'Apply Edit').click();
    await flush(); await flush(); await flush();

    expect(muapi.generateI2I).toHaveBeenCalledWith(expect.objectContaining({
      model: 'ai-image-face-swap',
      image_url: 'https://x/source.png',
      swap_url: 'https://x/face.png',
      target_index: 0,
    }));
    expect(el.querySelector('img[alt="After"]').getAttribute('src')).toBe('https://cdn.muapi.ai/result.png');
    expect(el.querySelector('img[alt="Before"]').getAttribute('src')).toBe('https://x/source.png');
    expect(el.querySelector('[aria-label="Before/after slider"]')).not.toBeNull();
    expect([...el.querySelectorAll('a')].find((a) => a.textContent === 'Download').getAttribute('href'))
      .toBe('https://cdn.muapi.ai/result.png');
  });
});

describe('Edit Studio helpers', () => {
  test('validation names what is missing', () => {
    const swap = getEditToolBySlug('face-swap');
    expect(validateEditInputs(swap, { sourceUrl: 'u' })).toMatch(/new face photo/i);
    expect(validateEditInputs(swap, { sourceUrl: 'u', secondaryUrl: 'f' })).toBeNull();
    const eraser = getEditToolBySlug('remove-object');
    expect(validateEditInputs(eraser, { sourceUrl: 'u' })).toMatch(/paint/i);
    expect(validateEditInputs(eraser, { sourceUrl: 'u', hasPaintedMask: true })).toBeNull();
    expect(validateEditInputs(getEditToolBySlug('ai-edit'), { sourceUrl: 'u', prompt: ' ' })).toMatch(/describe/i);
  });

  test('schema controls never duplicate hand-written ones or image fields', () => {
    for (const tool of EDIT_TOOLS) {
      const keys = [...(tool.controls || []), ...getSchemaControls(tool)].map((c) => c.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.some((key) => /_url$|^images_list$/.test(key))).toBe(false);
    }
  });

  test('painted strokes become white on an opaque black mask', () => {
    const rgba = new Uint8ClampedArray([34, 211, 238, 200, 0, 0, 0, 0]);
    expect([...strokesToMaskPixels(rgba)]).toEqual([
      MASK_SELECTED, MASK_SELECTED, MASK_SELECTED, 255,
      MASK_KEPT, MASK_KEPT, MASK_KEPT, 255,
    ]);
  });
});

const clickApply = (el) => [...el.querySelectorAll('button')].find((b) => b.textContent === 'Apply Edit').click();
const chooseModel = (el, id) => {
  const select = el.querySelector('#edit-model-select');
  select.value = id;
  select.dispatchEvent(new Event('change'));
};
const lastCall = () => muapi.generateI2I.mock.calls.at(-1)[0];

describe('Edit Studio models inside the studios', () => {
  beforeEach(() => {
    localStorage.setItem('muapi_key', 'test-key');
    muapi.generateI2I.mockClear();
  });

  test('every model the studios offer exists in the model list', () => {
    for (const ids of [AI_EDIT_MODEL_IDS, UPSCALE_MODEL_IDS, PRODUCT_MODEL_IDS, EFFECT_MODEL_IDS, ANGLE_MODEL_IDS, CHARACTER_MODEL_IDS]) {
      for (const id of ids) expect(getModelSpec(id), id).not.toBeNull();
    }
    expect(AI_EDIT_MODEL_IDS.length).toBe(30);
    for (const tool of EDIT_TOOLS.filter((t) => t.models)) expect(tool.models).toContain(tool.id);
  });

  test('AI Edit offers every general editor in a Model dropdown', () => {
    window.history.replaceState(null, '', '/?tool=ai-edit#/edit');
    const el = mount();
    const options = [...el.querySelectorAll('#edit-model-select option')].map((o) => o.value);
    expect(options).toEqual(expect.arrayContaining(['seedream-5.0-edit', 'nano-banana-2-edit', 'gpt-image-1.5-edit', 'flux-kontext-max-i2i', 'midjourney-v7-image-to-image']));
    expect(options.length).toBe(30);
    expect(isHidden(el.querySelector('#edit-model-select').closest('div'))).toBe(false);
  });

  test('tools with a single model show no Model dropdown', () => {
    window.history.replaceState(null, '', '/?tool=face-swap#/edit');
    const el = mount();
    expect(isHidden(el.querySelector('#edit-model-select').closest('div'))).toBe(true);
  });

  test('switching model swaps the settings and the image limit', () => {
    window.history.replaceState(null, '', '/?tool=ai-edit#/edit');
    const el = mount();
    expect(el.querySelector('[data-control-key="stylization"]')).toBeNull();
    chooseModel(el, 'midjourney-v7-image-to-image');
    expect(el.querySelector('[data-control-key="stylization"]')).not.toBeNull();
    expect(el.querySelector('[data-control-key="weirdness"]')).not.toBeNull();

    const extrasPicker = pickers[1];
    chooseModel(el, 'nano-banana-2-edit');
    expect(extrasPicker.setMaxImages).toHaveBeenLastCalledWith(13);
    expect(el.textContent).toContain('More reference images (up to 13)');
    expect(el.querySelector('[data-control-key="google_search"]')).not.toBeNull();
    chooseModel(el, 'nano-banana-edit');
    expect(el.textContent).toContain('More reference images (up to 9)');
  });

  test('a multi-image model gets the source plus the extra references as images_list', async () => {
    window.history.replaceState(null, '', '/?tool=ai-edit#/edit');
    const el = mount();
    chooseModel(el, 'nano-banana-2-edit');
    pickers[0].opts.onSelect({ url: 'https://x/a.png', assetId: null });
    pickers[1].opts.onSelect({ assets: [{ url: 'https://x/b.png', assetId: null }, { url: 'https://x/c.png', assetId: null }] });
    el.querySelector('[aria-label="Edit prompt"]').value = 'merge these';
    clickApply(el);
    await vi.waitFor(() => expect(muapi.generateI2I).toHaveBeenCalled());
    expect(lastCall()).toMatchObject({
      model: 'nano-banana-2-edit',
      images_list: ['https://x/a.png', 'https://x/b.png', 'https://x/c.png'],
      prompt: 'merge these',
    });
    expect(lastCall().image_url).toBeUndefined();
  });

  test('a single-image model sends only the source as image_url, even with extras picked earlier', async () => {
    window.history.replaceState(null, '', '/?tool=ai-edit#/edit');
    const el = mount();
    pickers[0].opts.onSelect({ url: 'https://x/a.png', assetId: null });
    chooseModel(el, 'nano-banana-2-edit');
    pickers[1].opts.onSelect({ assets: [{ url: 'https://x/b.png', assetId: null }] });
    chooseModel(el, 'gpt4o-edit');
    el.querySelector('[aria-label="Edit prompt"]').value = 'make it blue';
    clickApply(el);
    await vi.waitFor(() => expect(muapi.generateI2I).toHaveBeenCalled());
    expect(lastCall()).toMatchObject({ model: 'gpt4o-edit', image_url: 'https://x/a.png', prompt: 'make it blue' });
    expect(lastCall().images_list).toBeUndefined();
  });

  test('Grok 2 sends its images as reference_images', async () => {
    window.history.replaceState(null, '', '/?tool=ai-edit#/edit');
    const el = mount();
    chooseModel(el, 'grok-imagine-image-2');
    pickers[0].opts.onSelect({ url: 'https://x/a.png', assetId: null });
    el.querySelector('[aria-label="Edit prompt"]').value = 'cartoon';
    clickApply(el);
    await vi.waitFor(() => expect(muapi.generateI2I).toHaveBeenCalled());
    expect(lastCall().reference_images).toEqual(['https://x/a.png']);
    expect(lastCall().image_url).toBeUndefined();
  });

  test('Upscale: Topaz sends its factor as a number; SeedVR2 sends a resolution', async () => {
    window.history.replaceState(null, '', '/?tool=upscale#/edit');
    const el = mount();
    pickers[0].opts.onSelect({ url: 'https://x/a.png', assetId: null });
    chooseModel(el, 'topaz-image-upscale');
    el.querySelector('[data-control-key="upscale_factor"]').value = '4';
    clickApply(el);
    await vi.waitFor(() => expect(muapi.generateI2I).toHaveBeenCalledTimes(1));
    expect(lastCall()).toMatchObject({ model: 'topaz-image-upscale', image_url: 'https://x/a.png', upscale_factor: 4 });

    chooseModel(el, 'seedvr2-image-upscale');
    clickApply(el);
    await vi.waitFor(() => expect(muapi.generateI2I).toHaveBeenCalledTimes(2));
    expect(lastCall()).toMatchObject({ model: 'seedvr2-image-upscale', resolution: '4k' });
  });

  test('Product Shot: AI Product Photography sends prompt, the default sends scene_description', async () => {
    window.history.replaceState(null, '', '/?tool=product-shot#/edit');
    const el = mount();
    pickers[0].opts.onSelect({ url: 'https://x/p.png', assetId: null });
    const prompt = el.querySelector('[aria-label="Edit prompt"]');
    prompt.value = 'on marble';
    clickApply(el);
    await vi.waitFor(() => expect(muapi.generateI2I).toHaveBeenCalledTimes(1));
    expect(lastCall()).toMatchObject({ model: 'ai-product-shot', scene_description: 'on marble' });
    expect(lastCall().prompt).toBeUndefined();

    chooseModel(el, 'ai-product-photography');
    prompt.value = 'luxury studio';
    clickApply(el);
    await vi.waitFor(() => expect(muapi.generateI2I).toHaveBeenCalledTimes(2));
    expect(lastCall()).toMatchObject({ model: 'ai-product-photography', prompt: 'luxury studio' });
    expect(lastCall().scene_description).toBeUndefined();
  });

  test('Photo Effects shows a preset grid and sends the chosen preset as name', async () => {
    window.history.replaceState(null, '', '/?tool=photo-effects#/edit');
    const el = mount();
    expect(el.querySelectorAll('[data-preset]').length).toBe(18);
    chooseModel(el, 'nano-banana-effects');
    expect(el.querySelectorAll('[data-preset]').length).toBe(17);
    el.querySelector('[data-preset="3D Figurine"]').click();
    pickers[0].opts.onSelect({ url: 'https://x/a.png', assetId: null });
    clickApply(el);
    await vi.waitFor(() => expect(muapi.generateI2I).toHaveBeenCalled());
    expect(lastCall()).toMatchObject({ model: 'nano-banana-effects', name: '3D Figurine', image_url: 'https://x/a.png' });
  });

  test('Change Angle sends the slider values', async () => {
    window.history.replaceState(null, '', '/?tool=change-angle#/edit');
    const el = mount();
    expect(el.querySelector('[aria-label="Edit prompt"]').closest('.hidden')).not.toBeNull();
    const rotate = el.querySelector('[data-control-key="rotate_right_left"]');
    expect(rotate.type).toBe('range');
    rotate.value = '-30';
    el.querySelector('[data-control-key="move_forward"]').value = '2';
    pickers[0].opts.onSelect({ url: 'https://x/a.png', assetId: null });
    clickApply(el);
    await vi.waitFor(() => expect(muapi.generateI2I).toHaveBeenCalled());
    expect(lastCall()).toMatchObject({
      model: 'qwen-image-edit-plus-lora',
      images_list: ['https://x/a.png'],
      rotate_right_left: -30,
      move_forward: 2,
    });
  });

  test('Character & Reference needs a prompt and offers its five models', () => {
    window.history.replaceState(null, '', '/?tool=character-reference#/edit');
    const el = mount();
    expect([...el.querySelectorAll('#edit-model-select option')].length).toBe(5);
    expect(el.textContent).toContain('Reference image');
    pickers[0].opts.onSelect({ url: 'https://x/a.png', assetId: null });
    clickApply(el);
    expect(el.querySelector('[role="alert"]').textContent).toMatch(/scene/i);
    expect(muapi.generateI2I).not.toHaveBeenCalled();
  });

  test('Flux 3 strength is a 0 to 1 slider and native_audio is hidden', () => {
    window.history.replaceState(null, '', '/?tool=ai-edit#/edit');
    const el = mount();
    chooseModel(el, 'flux-3-i2i');
    const strength = el.querySelector('[data-control-key="strength"]');
    expect(strength.type).toBe('range');
    expect([strength.min, strength.max]).toEqual(['0', '1']);
    expect(el.querySelector('[data-control-key="native_audio"]')).toBeNull();
  });
});
