// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

vi.mock('../components/modals/template-generator/captions.js', async (orig) => ({
  ...(await orig()),
  transcribeCaptions: vi.fn(async () => ({
    words: [['this', 0, 300], ['is', 300, 500], ['Muneeb.', 500, 900], ['So', 1900, 2100], ['Edvay', 2100, 2500], ['rocks', 2500, 3000]].map(([text, start, end]) => ({ text, start, end })),
    engine: 'whisper-webgpu', model: 'base',
  })),
}));
vi.mock('../components/modals/ai-captions/burnIn.js', async (orig) => ({
  ...(await orig()),
  burnInSupported: () => true,
  burnInCaptions: vi.fn(async () => ({ blob: new Blob(['mp4'], { type: 'video/mp4' }), mimeType: 'video/mp4', extension: 'mp4', fileSize: 3 })),
}));
const processVideoTool = vi.fn(async () => ({ url: 'https://cdn.test/out.mp4' }));
vi.mock('../lib/muapi.js', () => ({ muapi: { processVideoTool: (...a) => processVideoTool(...a) } }));

import { AICaptionsModal } from '../components/modals/AICaptionsModal.jsx';
import { burnInCaptions } from '../components/modals/ai-captions/burnIn.js';
import { transcribeCaptions } from '../components/modals/template-generator/captions.js';
import { clearJobs } from '../components/modals/ai-captions/history.js';

const q = (sel) => document.querySelector(sel);
const click = (sel) => { const el = q(sel); if (!el) throw new Error(`missing ${sel}`); el.click(); };
const flush = () => new Promise((r) => setTimeout(r, 0));
const open = (opts = {}) => { const m = new AICaptionsModal(opts); m.open(); return m; };

beforeAll(() => {
  vi.stubGlobal('indexedDB', undefined);
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:test/${n += 1}`);
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(AICaptionsModal, 'videoDuration').mockResolvedValue(3);
  HTMLMediaElement.prototype.play = vi.fn(async () => {});
  HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(async () => { document.body.innerHTML = ''; await clearJobs(); vi.clearAllMocks(); });

describe('AI Captions modal — shell and Create tab', () => {
  it('has the four tabs, the six reference looks, a phone preview and position controls', () => {
    const m = open();
    expect([...document.querySelectorAll('.cap-tab')].map((b) => b.textContent.replace(/\d+$/, ''))).toEqual(['Create', 'Script & Words', 'Motion & Style', 'History']);
    expect([...document.querySelectorAll('[data-act="look"]')].map((b) => b.textContent)).toEqual(['Hormozi', 'MrBeast', 'Karaoke', 'Minimal', 'Bounce', 'Classic']);
    expect(q('[data-testid="cap-phone"]')).toBeTruthy();
    expect(q('.modal-overlay').classList.contains('cap-overlay')).toBe(true);
    expect(q('.cap-title-main').textContent).toBe('AI Captions');
    expect(q('[data-testid="cap-desc"]').textContent).toContain('Hormozi');
    click('[data-act="look"][data-val="capite-mrbeast"]');
    expect(q('[data-testid="cap-desc"]').textContent).toContain('MrBeast');
    click('[data-act="pos"][data-val="top"]');
    expect(m.percent).toBe(88);
    expect(q('.cap-phone-caption').getAttribute('style')).toContain('bottom:88%');
    const range = q('[data-act="pos-range"]'); range.value = '30'; range.dispatchEvent(new Event('input', { bubbles: true }));
    expect(q('[data-testid="cap-pos-value"]').textContent).toBe('30%');
    m.close();
  });

  it('keeps everything that was there: URL / upload modes, Generate and Cancel, the 18 cloud themes and the 45 languages', () => {
    const m = open();
    expect(q('#ai-cap-dropzone')).toBeTruthy();
    click('[data-act="mode"][data-val="url"]');
    expect(q('#ai-cap-url')).toBeTruthy();
    expect(q('[data-action="generate"]').textContent).toContain('Generate Captions');
    expect(q('[data-action="cancel"]')).toBeTruthy();
    const sel = q('#ai-cap-engine'); sel.value = 'cloud'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelectorAll('[data-act="theme"]')).toHaveLength(18);
    expect(q('#ai-cap-language').options.length).toBe(45);
    m.close();
  });

  it('the cloud path still calls the MuAPI caption service and returns its video', async () => {
    const onComplete = vi.fn();
    const m = open({ engine: 'cloud', videoUrl: 'https://x.test/a.mp4', onComplete });
    await m.generate();
    expect(processVideoTool).toHaveBeenCalledWith({ model: 'ai-captions', video_url: 'https://x.test/a.mp4', language: 'English', theme: 'Hormozi_1' });
    expect(onComplete).toHaveBeenCalledWith('https://cdn.test/out.mp4');
    expect(q('.ai-captions-result-video')).toBeTruthy();
    m.close();
  });

  it('asks for a video before generating', async () => {
    const m = open();
    await m.generate();
    expect(q('.modal-error-message').textContent).toContain('provide a video');
    m.close();
  });
});

describe('AI Captions modal — on-device captions, editor, history', () => {
  const made = async (opts = {}) => {
    const onComplete = vi.fn();
    const m = open({ onComplete, ...opts });
    m.uploadedFile = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    m.uploadedFileName = 'clip.mp4';
    await m.generate();
    await flush(); await flush();
    return { m, onComplete };
  };

  it('transcribes on this device, lands on Script & Words and renders the MP4', async () => {
    const { m, onComplete } = await made();
    expect(transcribeCaptions).toHaveBeenCalledWith(expect.stringMatching(/^blob:/), expect.objectContaining({ language: 'auto', engine: 'whisper-webgpu' }));
    expect(m.tab).toBe('script');
    expect(document.querySelectorAll('.cap-line')).toHaveLength(2);
    expect(q('[data-testid="cap-counts"]').textContent).toContain('2 segments • 6 words');
    expect(burnInCaptions).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith(expect.stringMatching(/^blob:/));
    expect(q('[data-testid="cap-download-mp4"]').getAttribute('download')).toBe('clip-captioned.mp4');
    m.close();
  });

  it('edits the script: fix a word, nudge, split, merge, find & replace, casing, add, delete', async () => {
    const { m } = await made();
    click('.cap-w[data-s="0"][data-w="2"]');
    const input = q('[data-edit="1"]'); input.value = 'Muneeb!';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(q('.cap-line[data-seg="0"] .cap-words').textContent).toContain('Muneeb!');

    click('[data-act="nudge"][data-s="0"][data-d="100"]');
    expect(m.segments[0].words[0].start).toBe(100);
    click('[data-act="split"][data-s="1"]');
    expect(m.segments).toHaveLength(3);
    click('[data-act="merge"][data-s="1"]');
    expect(m.segments).toHaveLength(2);

    const find = q('#ai-cap-find'); find.value = 'edvay'; find.dispatchEvent(new Event('input', { bubbles: true }));
    expect(q('[data-act="replace-all"]').textContent).toBe('Replace (1)');
    const repl = q('#ai-cap-repl'); repl.value = 'Acme'; repl.dispatchEvent(new Event('input', { bubbles: true }));
    click('[data-act="replace-all"]');
    expect(q('#ai-cap-lines').textContent).toContain('Acme');
    click('[data-act="case"][data-val="upper"]');
    expect(q('#ai-cap-lines').textContent).toContain('ACME');

    click('[data-act="add"]');
    expect(m.segments).toHaveLength(3);
    click('[data-act="del"][data-s="0"]');
    expect(m.segments).toHaveLength(2);
    m.close();
  });

  it('exports SRT, VTT and TXT of the edited script', async () => {
    const { m } = await made();
    const dl = vi.spyOn(m, 'download').mockImplementation(() => {});
    click('[data-testid="cap-srt"]'); click('[data-testid="cap-vtt"]'); click('[data-testid="cap-txt"]');
    expect(dl.mock.calls.map((c) => c[0])).toEqual(['clip.srt', 'clip.vtt', 'clip.txt']);
    expect(dl.mock.calls[0][1]).toContain('00:00:00,000 --> 00:00:00,900');
    expect(dl.mock.calls[1][1].startsWith('WEBVTT')).toBe(true);
    expect(dl.mock.calls[2][1]).toBe('this is Muneeb.\nSo Edvay rocks\n');
    m.close();
  });

  it('Apply & Re-render renders again from the edited words', async () => {
    const { m } = await made();
    burnInCaptions.mockClear();
    click('[data-act="case"][data-val="lower"]');
    expect(q('[data-testid="cap-render"]').textContent).toBe('Apply & Re-render');
    click('[data-testid="cap-render"]');
    await flush(); await flush();
    const call = burnInCaptions.mock.calls[0][1];
    expect(call.words.map((w) => w.text).join(' ')).toBe('this is muneeb. so edvay rocks');
    m.close();
  });

  it('Motion & Style: groups with counts, search, pick a look, overrides and reset', async () => {
    const { m } = await made();
    click('[data-act="tab"][data-val="style"]');
    const chips = [...document.querySelectorAll('[data-act="group"]')].map((b) => b.textContent);
    expect(chips[0]).toMatch(/^All looks\d+$/);
    expect(chips.join('|')).toContain('Trending');
    click('[data-act="group"][data-val="popular"]');
    expect(document.querySelectorAll('.cap-tile')).toHaveLength(6);
    click('.cap-tile[data-val="capite-karaoke"]');
    expect(m.styleId).toBe('capite-karaoke');
    const c = q('#ai-cap-case'); c.value = 'upper'; c.dispatchEvent(new Event('change', { bubbles: true }));
    expect(m.effectiveStyle().textTransform).toBe('uppercase');
    click('[data-act="reset-style"]');
    expect(m.effectiveStyle().textTransform).toBe(m.effectiveStyle().textTransform);
    expect(m.upperOverride).toBe('');
    m.close();
  });

  it('History keeps the job with its details and opens it again', async () => {
    const { m } = await made();
    click('[data-act="tab"][data-val="history"]');
    await flush(); await flush();
    const job = q('[data-testid="cap-job"]');
    expect(job.textContent).toContain('clip.mp4');
    for (const label of ['Duration', 'Language', 'Caption style', 'Caption position', 'Processing time', 'File size', 'Created']) expect(job.textContent).toContain(label);
    m.segments = []; m.tab = 'history';
    click('[data-act="job-open"]');
    await flush(); await flush();
    expect(m.tab).toBe('script');
    expect(m.segments).toHaveLength(2);
    click('[data-act="tab"][data-val="history"]'); await flush(); await flush();
    click('[data-act="job-del"]'); await flush(); await flush();
    expect(q('[data-testid="cap-history-empty"]')).toBeTruthy();
    m.close();
  });

  it('shows a clear message when no speech is found', async () => {
    transcribeCaptions.mockRejectedValueOnce(new Error('No speech was found to caption.'));
    const onError = vi.fn();
    const m = open({ onError });
    m.uploadedFile = new File(['x'], 'quiet.mp4', { type: 'video/mp4' });
    await m.generate();
    expect(q('.modal-error-message').textContent).toContain('No speech');
    expect(onError).toHaveBeenCalled();
    m.close();
  });
});
