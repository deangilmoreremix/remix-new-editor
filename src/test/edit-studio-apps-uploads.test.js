// @vitest-environment jsdom
// Edit Studio: the muapi Studio apps shown next to the 16 built-in tools.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/muapi.js', () => ({
  muapi: {
    generateI2I: vi.fn(async () => ({ url: 'https://cdn.muapi.ai/result.png' })),
    generateI2V: vi.fn(async () => ({ url: 'https://cdn.muapi.ai/result.mp4' })),
    processV2V: vi.fn(async () => ({ url: 'https://cdn.muapi.ai/swapped.mp4' })),
    calculateDynamicCost: vi.fn(async () => ({ cost: 0.07 })),
  },
}));
vi.mock('../lib/generationHistory.js', () => ({ registerGeneration: vi.fn() }));
vi.mock('../lib/studioChrome.js', () => ({ mountStudioChrome: vi.fn() }));
vi.mock('../components/AuthModal.js', () => ({ AuthModal: vi.fn() }));
vi.mock('../components/personalize/personalizePopover.js', () => ({ replaceTokensInPrompt: (text) => text }));
vi.mock('../lib/attachmentToolbar.js', () => ({ createAttachmentToolbar: vi.fn(() => ({})) }));
vi.mock('../lib/loading.js', () => ({ showToast: vi.fn() }));
vi.mock('../lib/thumbnails.js', () => ({
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
    const picker = { opts, trigger: document.createElement('button'), panel: document.createElement('div'), reset: vi.fn(), setMaxImages: vi.fn() };
    pickers.push(picker);
    return picker;
  }),
}));
vi.mock('../lib/muapiStudioMedia.js', () => ({
  resolveMuapiMediaRef: vi.fn(async (ref) => ref.url),
  resolveMuapiMediaRefs: vi.fn(async (refs) => refs.map((ref) => ref.url)),
  ingestStudioUpload: vi.fn(),
}));

import { EditStudio } from '../components/EditStudio.js';
import { EDIT_APPS } from '../lib/muapiEditApps.js';
import { muapi } from '../lib/muapi.js';
import { registerGeneration } from '../lib/generationHistory.js';

// ── All 72 muapi apps, driven through the Edit Studio UI ────────────────────────────────────────
// Only the file pickers and the muapi client are faked (their own tests cover the real upload
// pipeline and the request bodies). For every app this checks: the right pickers are shown for its
// inputs, the Generate button refuses until the required uploads are in, and the uploaded image /
// video / end frame reaches the right call under the right parameter name.
const SOURCE = 0;
const SECONDARY = 2;
const SECONDARY_VIDEO = 3;
const VIDEO_SOURCE = 4;
const PHOTO = 'https://x/photo.png';
const SECOND = 'https://x/second.png';
const CLIP = 'https://x/clip.mp4';

function mount(slug) {
  pickers.length = 0;
  window.history.replaceState(null, '', `/?tool=${slug}#/edit`);
  const el = EditStudio();
  document.body.innerHTML = '';
  document.body.appendChild(el);
  return el;
}
const button = (el, re) => [...el.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));
const applyBtn = (el) => button(el, /^(Apply Edit|Generate)/);
const hidden = (n) => n.classList.contains('hidden');
const route = { i2i: () => muapi.generateI2I, i2v: () => muapi.generateI2V, v2v: () => muapi.processV2V };

beforeEach(() => {
  localStorage.setItem('muapi_key', 'test-key');
  for (const fn of [muapi.generateI2I, muapi.generateI2V, muapi.processV2V, muapi.calculateDynamicCost, registerGeneration]) fn.mockClear();
});

describe('every muapi app takes its image or video upload and generates', () => {
  test('all 72 apps are covered', () => expect(EDIT_APPS.length).toBe(72));

  for (const tool of EDIT_APPS) {
    test(`${tool.name} (${tool.route})`, async () => {
      const el = mount(tool.slug);
      const primaryIsVideo = tool.primary.type === 'video';
      const second = tool.secondary;

      // The pickers match the app's inputs.
      expect(hidden(pickers[SOURCE].trigger), 'image source picker').toBe(primaryIsVideo);
      expect(hidden(pickers[VIDEO_SOURCE].trigger), 'video source picker').toBe(!primaryIsVideo);
      // The second-input pickers swap by kind; with no second input their whole panel is hidden.
      const secondIsVideo = second?.type === 'video';
      expect(hidden(pickers[SECONDARY].trigger), 'second image picker').toBe(secondIsVideo);
      expect(hidden(pickers[SECONDARY_VIDEO].trigger), 'second video picker').toBe(!secondIsVideo);
      if (second) expect(el.textContent, 'second input is labelled').toContain(second.label);

      // Nothing uploaded yet: asked for the file, and nothing is sent.
      const call = route[tool.route]();
      applyBtn(el).click();
      expect(el.querySelector('[role="alert"]').textContent).toMatch(/^Upload .+/i);
      expect(call).not.toHaveBeenCalled();

      // The primary file, through the right picker.
      const primaryUrl = primaryIsVideo ? CLIP : PHOTO;
      pickers[primaryIsVideo ? VIDEO_SOURCE : SOURCE].opts.onSelect({ url: primaryUrl, assetId: null });

      // A required second file blocks the run until it is in.
      const secondPicker = second ? pickers[second.type === 'video' ? SECONDARY_VIDEO : SECONDARY] : null;
      const secondUrl = second ? (second.type === 'video' ? CLIP : SECOND) : null;
      if (second && !second.optional) {
        applyBtn(el).click();
        expect(el.querySelector('[role="alert"]').textContent).toMatch(/^Upload .+/i);
        expect(call).not.toHaveBeenCalled();
        secondPicker.opts.onSelect({ url: secondUrl, assetId: null });
      }

      applyBtn(el).click();
      await vi.waitFor(() => expect(call).toHaveBeenCalledTimes(1));
      const params = call.mock.calls[0][0];
      expect(params.model).toBe(tool.model);
      expect(params[tool.primary.param], `${tool.primary.param} carries the upload`).toBe(primaryUrl);
      if (second && !second.optional) expect(params[second.param], `${second.param} carries the second upload`).toBe(secondUrl);
      if (second?.optional) expect(params[second.param], 'optional end frame is not sent unless given').toBeUndefined();

      // The result is shown as the right kind of media and recorded.
      await vi.waitFor(() => expect(registerGeneration).toHaveBeenCalled());
      expect(registerGeneration.mock.calls[0][1]).toBe(tool.outputKind);
      if (tool.outputKind === 'video') await vi.waitFor(() => expect(hidden(el.querySelector('[data-edit-video-box]'))).toBe(false));
      else expect(el.querySelector('a[download]')).toBeTruthy();

      // Optional end frame: sent when given.
      if (second?.optional) {
        secondPicker.opts.onSelect({ url: secondUrl, assetId: null });
        await vi.waitFor(() => expect(applyBtn(el).disabled).toBe(false));
        applyBtn(el).click();
        await vi.waitFor(() => expect(call).toHaveBeenCalledTimes(2));
        expect(call.mock.calls[1][0][second.param], 'end frame is sent when given').toBe(secondUrl);
      }
    });
  }
});
