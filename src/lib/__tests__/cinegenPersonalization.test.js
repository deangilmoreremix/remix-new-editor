/**
 * cinegenPersonalization.test.js
 *
 * Verifies the studio-bridge wiring inside src/lib/cinegen.js: the
 * personalization slice (persona reference images + CTA copy) must flow into
 * the existing MuAPI calls, and studio-supplied values must always win.
 * MuAPI and the personalization bridge are both mocked — no network, no keys.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const generateImage = vi.fn(async () => ({ url: 'https://muapi.test/img.png' }));
const generateVideo = vi.fn(async () => ({ url: 'https://muapi.test/vid.mp4' }));

vi.mock('../muapi.js', () => ({
  muapi: {
    generateImage: (params) => generateImage(params),
    generateVideo: (params) => generateVideo(params),
  },
}));

/** What the personalization bridge resolves; tests override per case. */
let resolved = {
  image_url: null,
  images_list: [],
  promptSuffix: '',
  clientProfile: null,
  assetIds: [],
  aspectRatio: null,
};

vi.mock('../../components/personalize/studioBridge.js', () => ({
  resolveForCineGen: () => resolved,
  hasPersonalizationData: () => Boolean(resolved.image_url || resolved.promptSuffix),
}));

const { cinegen } = await import('../cinegen.js');

beforeEach(() => {
  generateImage.mockClear();
  generateVideo.mockClear();
  resolved = {
    image_url: null,
    images_list: [],
    promptSuffix: '',
    clientProfile: null,
    assetIds: [],
    aspectRatio: null,
  };
});

describe('cinegen.generateElement personalization merge', () => {
  it('is a no-op when personalization has no data', async () => {
    const result = await cinegen.generateElement({ prompt: 'a noir detective' });
    expect(result.success).toBe(true);
    expect(generateImage).toHaveBeenCalledTimes(1);
    const params = generateImage.mock.calls[0][0];
    expect(params.prompt).toBe('a noir detective');
    expect(params.model).toBe('flux-dev');
    expect(params.image_url).toBeUndefined();
    expect('images_list' in params).toBe(false);
  });

  it('flows persona reference images and CTA copy into the MuAPI call', async () => {
    resolved = {
      image_url: 'https://personalization.test/logo.png',
      images_list: ['https://personalization.test/product.png'],
      promptSuffix: ' Include the call to action: "Call now".',
      clientProfile: { id: 'c1' },
      assetIds: ['l1', 'p1'],
      aspectRatio: null,
    };
    await cinegen.generateElement({ prompt: 'a rooftop at dusk' });
    const params = generateImage.mock.calls[0][0];
    expect(params.prompt).toBe('a rooftop at dusk Include the call to action: "Call now".');
    expect(params.image_url).toBe('https://personalization.test/logo.png');
    expect(params.images_list).toEqual(['https://personalization.test/product.png']);
  });

  it('never clobbers a studio-supplied image_url', async () => {
    resolved = { ...resolved, image_url: 'https://personalization.test/logo.png' };
    await cinegen.generateElement({ prompt: 'x', image_url: 'https://studio.test/own.png' });
    expect(generateImage.mock.calls[0][0].image_url).toBe('https://studio.test/own.png');
  });

  it('never clobbers studio-supplied images_list', async () => {
    resolved = { ...resolved, images_list: ['https://personalization.test/extra.png'] };
    await cinegen.generateElement({ prompt: 'x', images_list: ['https://studio.test/mine.png'] });
    expect(generateImage.mock.calls[0][0].images_list).toEqual(['https://studio.test/mine.png']);
  });

  it('does not double-append the CTA suffix', async () => {
    const suffix = ' Include the call to action: "Call now".';
    resolved = { ...resolved, promptSuffix: suffix };
    await cinegen.generateElement({ prompt: `base${suffix}` });
    expect(generateImage.mock.calls[0][0].prompt).toBe(`base${suffix}`);
  });
});

describe('cinegen.applyEditTool extend personalization merge', () => {
  it('flows personalization into the video call, studio values first', async () => {
    resolved = { ...resolved, image_url: 'https://personalization.test/logo.png', promptSuffix: ' Phone: 555-1234.' };
    const result = await cinegen.applyEditTool('extend', { prompt: 'hold the shot', extendDuration: 5 });
    expect(result.success).toBe(true);
    expect(generateVideo).toHaveBeenCalledTimes(1);
    const params = generateVideo.mock.calls[0][0];
    expect(params.prompt).toBe('hold the shot Phone: 555-1234.');
    expect(params.duration).toBe(5);
    expect(params.image_url).toBe('https://personalization.test/logo.png');
  });

  it('keeps the studio video reference when it supplies one', async () => {
    resolved = { ...resolved, image_url: 'https://personalization.test/logo.png' };
    await cinegen.applyEditTool('extend', { prompt: 'x', extendDuration: 3, image_url: 'https://studio.test/frame.png' });
    expect(generateVideo.mock.calls[0][0].image_url).toBe('https://studio.test/frame.png');
  });
});
