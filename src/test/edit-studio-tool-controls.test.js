// @vitest-environment jsdom
// The 16 built-in Edit Studio tools: every setting the model's live API accepts is shown, except the few listed below.
import { describe, test, expect, vi } from 'vitest';

vi.mock('../lib/muapi.js', () => ({ muapi: {} }));
vi.mock('../lib/generationHistory.js', () => ({ registerGeneration: vi.fn() }));
vi.mock('../lib/studioChrome.js', () => ({ mountStudioChrome: vi.fn() }));
vi.mock('../components/AuthModal.js', () => ({ AuthModal: vi.fn() }));
vi.mock('../components/personalize/personalizePopover.js', () => ({ replaceTokensInPrompt: (t) => t }));
vi.mock('../lib/attachmentToolbar.js', () => ({ createAttachmentToolbar: vi.fn(() => ({})) }));
vi.mock('../lib/loading.js', () => ({ showToast: vi.fn() }));
vi.mock('../lib/thumbnails.js', () => ({ getToolThumbnail: () => '', createThumbnailImg: () => document.createElement('img'), createStudioHeader: () => document.createElement('div') }));
vi.mock('../components/UploadPicker.js', () => ({ createUploadPicker: vi.fn(() => ({ trigger: document.createElement('button'), panel: document.createElement('div'), reset() {}, setMaxImages() {} })) }));
vi.mock('../lib/muapiStudioMedia.js', () => ({}));

import { EDIT_TOOLS, getSchemaControls } from '../components/EditStudio.js';
import live from '../lib/muapi/liveModels.json';

const liveByName = new Map(live.models.map((m) => [m.name, m]));
const MEDIA_OR_PROMPT = /(_url|_urls|images?_list|prompt|scene_description|^image$)/;

// Live settings we leave out on purpose.
//  - num_images: the studio shows one result, so extra images would be paid for and never seen.
//  - Change Angle: its bundled schema uses the angle LoRA's own settings (rotate, move, angle, lens);
//    the generic live schema lists different ones, which needs a check against the real endpoint.
const KNOWN_GAPS = {
  'flux-kontext-pro-i2i': ['num_images'],
  'flux-kontext-max-i2i': ['num_images'],
  'qwen-image-edit-plus-lora': ['aspect_ratio', 'loras', 'output_format'],
};

describe('built-in Edit Studio tools show every setting their model accepts', () => {
  for (const tool of EDIT_TOOLS) {
    for (const id of tool.models?.length ? tool.models : [tool.id]) {
      const schema = liveByName.get(id) || liveByName.get(id.replace(/^bytedance-/, ''));
      if (!schema) continue; // not in the live snapshot: nothing to compare with
      test(`${tool.slug} / ${id}`, () => {
        const own = id === tool.id ? (tool.controls || []) : [];
        const shown = new Set([...own, ...getSchemaControls(tool, id)].map((c) => c.key));
        const missing = schema.fields.map((f) => f.name)
          .filter((n) => !MEDIA_OR_PROMPT.test(n) && !shown.has(n) && !(KNOWN_GAPS[id] || []).includes(n));
        expect(missing).toEqual([]);
      });
    }
  }
});
