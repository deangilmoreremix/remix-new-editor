import { describe, it, expect, vi } from 'vitest';
import { generateImages, isModelUnavailable, dataUrlToBlob, storeAssets } from '../openaiImages.js';

const headers = { 'X-OpenAI-Key': 'sk-test0123456789abcdefghijkl' };
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('openaiImages (Images 2.6, user key)', () => {
  it('needs the user key', async () => {
    await expect(generateImages('a cat', { headers: {}, fetchImpl: vi.fn() })).rejects.toThrow(/own OpenAI key/);
  });

  it('defaults to Images 2.6 Flare and sends references', async () => {
    const fetchImpl = vi.fn(async () => reply(200, { ok: true, assets: [{ url: 'data:image/png;base64,aGk=' }] }));
    const r = await generateImages('hero, low angle', { headers, fetchImpl, refs: ['https://cdn/x.png', 'blob:local'] });
    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sent).toMatchObject({ model: 'gpt-image-2.6-flare', referenceImageUrls: ['https://cdn/x.png'] });
    expect(fetchImpl.mock.calls[0][1].headers['X-OpenAI-Key']).toBe(headers['X-OpenAI-Key']);
    expect(r.model).toBe('gpt-image-2.6-flare');
  });

  it('falls back to gpt-image-2 once if the key cannot use 2.6', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(reply(400, { ok: false, error: 'OpenAI Images API error (400): The model gpt-image-2.6-flare does not exist' }))
      .mockResolvedValueOnce(reply(200, { ok: true, assets: [{ url: 'data:image/png;base64,aGk=' }] }));
    const r = await generateImages('x', { headers, fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).model).toBe('gpt-image-2');
    expect(r).toMatchObject({ model: 'gpt-image-2', fellBack: true });
  });

  it('does not fall back on other errors', async () => {
    const fetchImpl = vi.fn(async () => reply(401, { ok: false, error: 'OpenAI rejected your API key.' }));
    await expect(generateImages('x', { headers, fetchImpl })).rejects.toThrow(/rejected/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(isModelUnavailable(429, 'model busy')).toBe(false);
  });

  it('stores data: images through the editor', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,aGk=');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(2);
    const editor = { storeBlob: vi.fn(async () => 'https://storage/x.png') };
    expect(await storeAssets(editor, [{ url: 'data:image/png;base64,aGk=' }], 'frame')).toEqual(['https://storage/x.png']);
    expect(editor.storeBlob.mock.calls[0][1]).toBe('frame-1.png');
  });
});
