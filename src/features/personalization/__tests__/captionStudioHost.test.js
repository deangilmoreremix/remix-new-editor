import { describe, it, expect, vi } from 'vitest';

const open = vi.fn();
vi.mock('../../../lib/captionStudio/modal.js', () => ({ openCaptionStudio: (o) => open(o) }));

describe('personalization → Caption Studio hand-off (remix host)', () => {
  it('opens the one studio with the words, the bundled fonts and a clear apply button', async () => {
    const { openCaptionStudioForPersonalization } = await import('../captionStudioHost.js');
    const onApply = vi.fn();
    await openCaptionStudioForPersonalization({ videoUrl: 'blob:v', words: [{ text: 'Call', startMs: 0, endMs: 300 }, { text: 'us', startMs: 320, endMs: 500 }], style: { preset: 'capite-hormozi' }, fonts: ['Anton'], onApply });
    const o = open.mock.calls[0][0];
    expect(o).toMatchObject({ videoUrl: 'blob:v', fonts: ['Anton'], style: { preset: 'capite-hormozi' }, applyLabel: 'Use these captions in the video' });
    expect(o.captions.map((c) => c.text)).toEqual(['Call', ' us']);
    // what the studio returns becomes pages + a plain style for the editor
    o.onApply({ captions: [{ text: 'Call', startMs: 0, endMs: 300 }, { text: ' us', startMs: 320, endMs: 500 }], captionStyle: { preset: 'capite-hormozi', fontFamily: 'Anton', combineMs: 900, secret: 'x' } });
    const payload = onApply.mock.calls[0][0];
    expect(payload.pages[0].tokens.map((t) => t.text.trim())).toEqual(['Call', 'us']);
    expect(payload.style).toMatchObject({ fontFamily: 'Anton', animation: 'highlight' });
    expect(payload.style.secret).toBeUndefined();
  });

  it('reports a failure to open instead of throwing', async () => {
    open.mockImplementationOnce(() => { throw new Error('no window'); });
    const { openCaptionStudioForPersonalization } = await import('../captionStudioHost.js');
    const onError = vi.fn();
    await openCaptionStudioForPersonalization({ videoUrl: 'blob:v', onError });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'no window' }));
  });
});
