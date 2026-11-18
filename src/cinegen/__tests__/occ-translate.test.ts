// [remix] Caption translation pipeline (OpenChatCut segmenter + translateLines prompt, OpenAI Responses call mocked).
import { describe, it, expect, vi, beforeEach } from 'vitest';
const responsesChat = vi.fn();
vi.mock('../adapters/llm-responses', () => ({ responsesChat: (...a: unknown[]) => responsesChat(...a) }));
import { phrasesFromWords, translateCues, translateLines, toSrt } from '@cinegen/lib/occ/translate';

const words = 'Hello there. This is a short test of the caption translation pipeline, and it keeps timing.'.split(' ')
  .map((text, i) => ({ text, startMs: i * 400, endMs: i * 400 + 350 }));
beforeEach(() => responsesChat.mockReset());

describe('caption translation', () => {
  it('groups words into timed phrases that cover every word', () => {
    const cues = phrasesFromWords(words);
    expect(cues.length).toBeGreaterThan(1);
    expect(cues[0].startMs).toBe(0);
    expect(cues[cues.length - 1].endMs).toBe(words[words.length - 1].endMs);
    expect(cues.map((c) => c.text).join(' ').split(/\s+/).length).toBe(words.length);
  });
  it('keeps timing and count, using their numbered-line prompt', async () => {
    const cues = phrasesFromWords(words);
    responsesChat.mockResolvedValue({ message: JSON.stringify(cues.map((c) => `ES:${c.text}`)), usage: {} });
    const out = await translateCues(cues, 'Spanish');
    expect(out.map((c) => [c.startMs, c.endMs])).toEqual(cues.map((c) => [c.startMs, c.endMs]));
    expect(out[0].text).toBe(`ES:${cues[0].text}`);
    expect(responsesChat.mock.calls[0][0].system).toContain('Translate each numbered line into Spanish');
    expect(responsesChat.mock.calls[0][0].user).toMatch(/^1\. /);
  });
  it('pads/truncates to the source count and tolerates fenced JSON', async () => {
    responsesChat.mockResolvedValue({ message: '```json\n["uno"]\n```', usage: {} });
    expect(await translateLines(['a', 'b', 'c'], 'Spanish')).toEqual(['uno', '', '']);
  });
  it('writes valid SRT', () => {
    expect(toSrt([{ startMs: 0, endMs: 1500, text: 'Hola' }, { startMs: 3661001, endMs: 3662000, text: 'Adiós' }]))
      .toBe('1\n00:00:00,000 --> 00:00:01,500\nHola\n\n2\n01:01:01,001 --> 01:01:02,000\nAdiós\n');
  });
});
