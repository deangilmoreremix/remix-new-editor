import { describe, it, expect, vi, beforeEach } from 'vitest';

const registerGenerationBlob = vi.fn(async () => ({}));
vi.mock('../lib/generationHistory.js', () => ({ registerGenerationBlob }));

const { mountCaptionLibrarySave, resetCaptionLibrarySaveForTests } = await import('../lib/captionLibrarySave.js');

const announce = (card) => window.dispatchEvent(new CustomEvent('remix:video-created', { detail: { card } }));
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('captioned renders reach the Library', () => {
  beforeEach(() => {
    registerGenerationBlob.mockClear();
    resetCaptionLibrarySaveForTests();
    globalThis.fetch = vi.fn(async () => ({ blob: async () => new Blob(['v'], { type: 'video/mp4' }) }));
  });

  it('uploads a captioned blob render once', async () => {
    mountCaptionLibrarySave();
    mountCaptionLibrarySave(); // a second mount must not double-save
    announce({ studio: 'caption-studio', url: 'blob:http://x/1', title: 'clip (captioned)' });
    await flush();
    expect(registerGenerationBlob).toHaveBeenCalledTimes(1);
    expect(registerGenerationBlob.mock.calls[0][0]).toBe('caption-studio');
    expect(registerGenerationBlob.mock.calls[0][3]).toMatchObject({ prompt: 'clip (captioned)' });
  });

  it('ignores other studios and non-blob URLs', async () => {
    mountCaptionLibrarySave();
    announce({ studio: 'cinegen', url: 'blob:http://x/2' });
    announce({ studio: 'caption-studio', url: 'https://cdn/a.mp4' });
    await flush();
    expect(registerGenerationBlob).not.toHaveBeenCalled();
  });
});
