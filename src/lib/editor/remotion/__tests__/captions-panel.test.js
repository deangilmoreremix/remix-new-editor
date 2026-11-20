import { describe, it, expect, vi } from 'vitest';
import { captionsFromFile } from '../captions.js';
import { renderCaptionsPanel } from '../captionsPanel.js';

const SRT = `1
00:00:00,500 --> 00:00:02,000
Hello there

2
00:00:02,500 --> 00:00:04,000
General Kenobi
`;

describe('captions clip inspector section', () => {
  it('summarises the captions clip and opens the one Caption Studio window', () => {
    const box = document.createElement('div');
    const onOpenStudio = vi.fn();
    const p = renderCaptionsPanel(box, { captions: captionsFromFile(SRT, 'a.srt'), style: { preset: 'tiktok' }, onOpenStudio });
    expect(box.querySelector('[data-cap-summary]').textContent).toMatch(/2 words · \d+ lines · Word highlight look/);
    // No second caption editor, transcriber or style picker is built here any more.
    expect(box.querySelector('[data-cap-transcribe], [data-cap-preset], [data-cap-text]')).toBeNull();
    box.querySelector('[data-cap-studio]').click();
    expect(onOpenStudio).toHaveBeenCalledTimes(1);
    p.destroy();
    expect(box.innerHTML).toBe('');
  });

  it('says so when there are no captions yet', () => {
    const box = document.createElement('div');
    renderCaptionsPanel(box, { captions: [], onOpenStudio: () => {} });
    expect(box.querySelector('[data-cap-summary]').textContent).toBe('No captions yet.');
  });
});

describe('one Whisper engine', () => {
  it('the old import path re-exports the Caption Studio core', async () => {
    const legacy = await import('../transcribe.js');
    const core = await import('../../../captionStudio/transcribeClient.js');
    expect(legacy.transcribeInBrowser).toBe(core.transcribeInBrowser);
    expect(legacy.WHISPER_MODELS).toBe(core.WHISPER_MODELS);
    expect(legacy.decodeAudio).toBe(core.decodeAudio);
    expect(legacy.WHISPER_MODELS.map((m) => m[0])).toContain('onnx-community/whisper-small_timestamped');
  });
});
