import { describe, it, expect, vi } from 'vitest';
import { generateFieldCopy, roleForLabel, maxCharsFor } from '../rewrite.js';

const KEY = { 'X-OpenAI-Key': 'sk-test0123456789abcdefghijkl' };
const reply = (items, status = 200, ok = true) => vi.fn(async () => new Response(JSON.stringify(ok ? { ok: true, items } : { ok: false, error: { message: 'No credit' } }), { status }));

describe('Write with AI: one field', () => {
  it('maps a field label to a kind of text and a sensible length', () => {
    expect(roleForLabel('Button text')).toBe('button');
    expect(roleForLabel('Headline (wrap words in [[double brackets]] to highlight)')).toBe('headline');
    expect(roleForLabel('Quote')).toBe('quote');
    expect(roleForLabel('Small label above the headline')).toBe('label');
    expect(roleForLabel('Sub-headline')).toBe('headline');
    expect(roleForLabel('Anything else')).toBe('text');
    expect(maxCharsFor('button')).toBe(30);
    expect(maxCharsFor('headline', 'x'.repeat(200))).toBe(260);   // never tighter than what is there now
    expect(maxCharsFor('text', '', true)).toBe(320);
  });

  it('needs the user\'s own key', async () => {
    const fetchImpl = vi.fn();
    await expect(generateFieldCopy({ label: 'Headline', headers: {}, fetchImpl })).rejects.toThrow(/OpenAI key/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('works on an empty field and sends the write request', async () => {
    const fetchImpl = reply([{ id: 'o1', text: 'Fast plumbing, fair prices' }, { id: 'o2', text: 'Your Reno plumber' }]);
    const out = await generateFieldCopy({ label: 'Headline', current: '', instruction: 'friendly', context: 'Plumber', headers: KEY, fetchImpl });
    expect(out).toEqual(['Fast plumbing, fair prices', 'Your Reno plumber']);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body).input;
    expect(body).toMatchObject({ mode: 'write', label: 'Headline', role: 'headline', current: '', instruction: 'friendly', context: 'Plumber', n: 3 });
  });

  it('drops options with markup, links, repeats, the current text, or that are too long', async () => {
    const fetchImpl = reply([{ id: 'o1', text: 'Same as before' }, { id: 'o2', text: 'Good one' }, { id: 'o3', text: 'Good one' }, { id: 'o4', text: '<b>x</b>' }, { id: 'o5', text: 'see https://x.test' }, { id: 'o6', text: 'x'.repeat(300) }]);
    expect(await generateFieldCopy({ label: 'Button text', current: 'Same as before', headers: KEY, fetchImpl })).toEqual(['Good one']);
  });

  it('keeps a field\'s own placeholders and highlight marks', async () => {
    const fetchImpl = reply([{ id: 'o1', text: 'Hello {{firstname|there}}, [[grow]] fast' }, { id: 'o2', text: 'Hello friend, grow fast' }]);
    expect(await generateFieldCopy({ label: 'Headline', current: 'Hi {{firstname|there}}, [[grow]] now', headers: KEY, fetchImpl })).toEqual(['Hello {{firstname|there}}, [[grow]] fast']);
  });

  it('shows the service\'s own message when it fails', async () => {
    await expect(generateFieldCopy({ label: 'Headline', headers: KEY, fetchImpl: reply([], 429, false) })).rejects.toThrow('No credit');
  });
});
