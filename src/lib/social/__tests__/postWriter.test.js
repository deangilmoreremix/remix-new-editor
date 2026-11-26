import { describe, it, expect, vi } from 'vitest';
import { buildPostPrompt, parsePostReply, writePostWithAI, captionLimit, normalizeHashtags, cleanHashtag } from '../postWriter.js';

describe('caption limit', () => {
  it('is the shortest limit among the picked platforms', () => {
    expect(captionLimit(['instagram'])).toBe(2200);
    expect(captionLimit(['instagram', 'twitter'])).toBe(280);
    expect(captionLimit([])).toBe(2200);
  });
});

describe('hashtags', () => {
  it('are cleaned, unique and capped', () => {
    expect(cleanHashtag('#Hello World!')).toBe('HelloWorld');
    expect(normalizeHashtags('#a #A, b  #c-d')).toEqual(['a', 'b', 'cd']);
    expect(normalizeHashtags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(12);
    expect(normalizeHashtags(['', '#', null])).toEqual([]);
  });
});

describe('prompt', () => {
  it('names the platforms, tone, language and what the media shows', () => {
    const { prompt, maxChars } = buildPostPrompt({ platforms: ['instagram', 'twitter'], tone: 'Bold', language: 'French', media: { type: 'video', prompt: 'a red sports car at dusk' } });
    expect(prompt).toContain('Instagram, X (Twitter)');
    expect(prompt).toContain('Tone: Bold');
    expect(prompt).toContain('French');
    expect(prompt).toContain('a red sports car at dusk');
    expect(prompt).toContain('for a video');
    expect(maxChars).toBe(280);
  });
  it('prefers what the person typed, and falls back to a known tone', () => {
    const { prompt } = buildPostPrompt({ platforms: ['tiktok'], tone: 'nope', topic: 'our launch', media: { prompt: 'ignored' } });
    expect(prompt).toContain('our launch');
    expect(prompt).not.toContain('ignored');
    expect(prompt).toContain('Tone: Friendly');
  });
});

describe('reply', () => {
  it('gives a caption and hashtags, with any # moved out of the caption', () => {
    expect(parsePostReply('Here you go: {"caption": "Big news #launch today", "hashtags": ["#launch", "news"]}')).toEqual({ caption: 'Big news today', hashtags: ['launch', 'news'] });
  });
  it('keeps caption and hashtags inside the platform limit', () => {
    const out = parsePostReply(JSON.stringify({ caption: 'x'.repeat(500), hashtags: ['one', 'two'] }), { maxChars: 280 });
    const total = out.caption.length + out.hashtags.reduce((n, t) => n + t.length + 2, 0);
    expect(total).toBeLessThanOrEqual(280);
    expect(out.caption.endsWith('…')).toBe(true);
  });
  it('rejects replies that are not a post', () => {
    for (const bad of ['', 'sorry', '{"hashtags": ["a"]}', '{"caption": "   "}', '{not json}']) expect(() => parsePostReply(bad)).toThrow(/usable post/);
  });
});

describe('writePostWithAI', () => {
  it('sends the prompt to the injected generator and parses its reply', async () => {
    const generate = vi.fn().mockResolvedValue('{"caption": "Hello", "hashtags": ["hi"]}');
    const out = await writePostWithAI({ platforms: ['linkedin'] }, { generate });
    expect(generate).toHaveBeenCalledWith(expect.stringContaining('LinkedIn'), undefined);
    expect(out).toEqual({ caption: 'Hello', hashtags: ['hi'] });
  });
});
