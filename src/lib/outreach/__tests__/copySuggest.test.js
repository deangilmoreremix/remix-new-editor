import { describe, it, expect } from 'vitest';
import { suggestHeaders, suggestMessages, suggestEmail, tightenScript, withClosingCta, shortOpening, diffSentences, speakSeconds } from '../copySuggest.js';
import { tokensIn } from '../draft.js';

describe('free copy suggestions', () => {
  it('only use tokens the app fills', () => {
    const all = [...suggestHeaders(), ...suggestMessages('intro'), ...suggestMessages('demo'), ...suggestMessages('followup'), ...Object.values(suggestEmail('intro')), ...Object.values(suggestEmail('followup'))];
    const used = new Set(all.flatMap((t) => tokensIn(t)));
    expect([...used].every((t) => ['firstname', 'company', 'link'].includes(t))).toBe(true);
  });
  it('every email suggestion carries the personal link', () => {
    for (const g of ['intro', 'demo', 'followup']) expect(suggestEmail(g).body).toContain('{{link}}');
    expect(suggestEmail('unknown')).toEqual(suggestEmail('intro'));
  });
});

describe('script tools', () => {
  const script = 'Hi, I just wanted to say that I basically love what you do. We help teams record once and reach everyone. It really saves hours. Our clients see replies go up. Book a time and we can talk.';
  it('removes filler words and says what it removed', () => {
    const r = tightenScript(script);
    expect(r.text).not.toMatch(/\b(just|basically|really)\b/i);
    expect(r.removed.length).toBeGreaterThan(0);
    expect(r.text.startsWith('Hi')).toBe(true);
  });
  it('drops sentences from the end to fit a time, never the first', () => {
    const r = tightenScript(script, { maxSeconds: 6 });
    expect(r.seconds).toBeLessThanOrEqual(6);
    expect(r.text.split('.')[0]).toMatch(/^Hi/);
    expect(r.removed.some((x) => /Book a time/.test(x))).toBe(true);
  });
  it('keeps a script that is already short', () => {
    expect(tightenScript('Hello there. Thanks for watching.').text).toBe('Hello there. Thanks for watching.');
  });
  it('adds a closing line only when there is no call to action, and can be undone by the caller', () => {
    expect(withClosingCta('We help teams.')).toMatch(/pick a time/);
    expect(withClosingCta('We help teams. Book a call today.')).toBe('We help teams. Book a call today.');
    expect(withClosingCta('')).toBe('');
  });
  it('shortens an opening to its first sentence and word limit', () => {
    expect(shortOpening('Hi Mike. I made this for you.')).toBe('Hi Mike.');
    expect(shortOpening('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen.', 5)).toBe('one two three four five.');
  });
  it('shows what changed', () => {
    const d = diffSentences('Hi. Old line. Keep me.', 'Hi. Keep me. New line.');
    expect(d).toEqual([{ type: 'same', text: 'Hi.' }, { type: 'removed', text: 'Old line.' }, { type: 'same', text: 'Keep me.' }, { type: 'added', text: 'New line.' }]);
  });
  it('estimates speaking time at a normal pace', () => { expect(speakSeconds(Array(75).fill('word').join(' '))).toBe(30); });
});
