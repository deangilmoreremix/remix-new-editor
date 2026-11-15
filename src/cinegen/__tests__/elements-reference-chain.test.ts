// [remix] Elements consistency engine: the first generated panel (a data: URL) and uploaded references must reach the image server.
import { describe, it, expect, vi } from 'vitest';
import { generateImages, prepareReferences } from '../../lib/editor/ai/openaiImages.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('reference images reach the generator', () => {
  it('keeps https references and sends a data: panel result inline', async () => {
    const refs = await prepareReferences(['https://cdn.example/upload.jpg', PNG]);
    expect(refs).toEqual(['https://cdn.example/upload.jpg', PNG]);
  });

  it('puts hosted references first, drops non-image schemes and duplicates, caps at 8', async () => {
    const many = Array.from({ length: 12 }, (_, i) => `https://cdn.example/${i}.jpg`);
    const refs = await prepareReferences([PNG, 'javascript:alert(1)', 'http://insecure/x.jpg', PNG, ...many]);
    expect(refs.length).toBe(8);
    expect(refs.every((u) => u.startsWith('https://'))).toBe(true);
    expect(refs).not.toContain('javascript:alert(1)');
  });

  it('skips an oversized inline image instead of blowing the request size', async () => {
    const huge = 'data:image/png;base64,' + 'A'.repeat(5_000_000);
    expect(await prepareReferences([huge, PNG], { toInline: async (u: string) => u })).toEqual([PNG]);
  });

  it('generateImages sends the previous panel (data:) and the upload in referenceImageUrls', async () => {
    const bodies: Array<{ referenceImageUrls?: string[] }> = [];
    const fetchImpl = vi.fn(async (_u: string, init: { body: string }) => { bodies.push(JSON.parse(init.body)); return new Response(JSON.stringify({ ok: true, assets: [{ url: PNG }] }), { status: 200 }); });
    await generateImages('left profile', { refs: [PNG, 'https://cdn.example/upload.jpg'], fetchImpl: fetchImpl as unknown as typeof fetch, headers: { 'X-OpenAI-Key': 'k' } });
    expect(bodies[0].referenceImageUrls).toEqual(['https://cdn.example/upload.jpg', PNG]);
  });
});
