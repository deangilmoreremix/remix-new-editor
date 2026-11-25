// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../lib/router.js', () => ({ navigate: vi.fn() }));
vi.mock('../../../lib/supabase.js', () => ({ supabase: null, isSupabaseConfigured: () => false }));

import { mountOutreachWelcome } from '../OutreachWelcome.js';

const DISCOVERY = {
  ok: true, url: 'https://acme.com/', title: 'Acme | Plumbing in Austin', description: 'Fast, friendly plumbers serving all of Austin.',
  logo: 'https://acme.com/logo.png', brandColors: { primary: '#112233', accent: '#ff8800' },
  assets: [{ kind: 'product', url: 'https://acme.com/a.jpg' }, { kind: 'brand', url: 'https://acme.com/b.jpg' }],
};
const mockDiscovery = (impl) => vi.stubGlobal('fetch', vi.fn(impl || (async () => ({ ok: true, status: 200, json: async () => DISCOVERY }))));

const $ = (s) => document.querySelector(s);
const typeIn = (name, v) => { const i = $(`input[name="${name}"]`); i.value = v; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); };

describe('SmartVideo welcome', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="host"></div>'; localStorage.clear(); mockDiscovery(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('walks the six steps, saving every answer; the Brand Kit is the last step and Save finishes', async () => {
    const onChange = vi.fn();
    const onFinish = vi.fn();
    mountOutreachWelcome($('#host'), { name: 'Sam', onChange, onFinish, onAcademy: () => {} });
    expect($('h1').textContent).toBe('Welcome, Sam. What do you want to do first?');
    expect(document.body.textContent).toContain('SmartVideo');
    expect(document.body.textContent).toContain('Step 1 of 6');
    $('[data-welcome-goal="dynamic"]').click();
    expect(onChange.mock.calls.at(-1)[0]).toMatchObject({ goal: 'dynamic', step: 2 });
    expect(document.body.textContent).toContain('Step 2 of 6');
    $('[data-welcome-team="2-5"]').click();
    $('[data-welcome-volume="100+"]').click();
    expect($('[data-welcome-skip]')).toBeNull(); // where you work has no Skip
    const go = $('[data-welcome-work] button[type="submit"]');
    expect(go.disabled).toBe(true);
    typeIn('company', 'Acme'); typeIn('website', 'acme'); typeIn('jobTitle', 'AE');
    expect(go.disabled).toBe(true);
    typeIn('website', 'https://acme.com');
    expect(go.disabled).toBe(false);
    $('[data-welcome-work]').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(document.body.textContent).toContain('how did you hear about us');
    $('[data-welcome-heard="linkedin"]').click();
    // "How did you hear" is no longer the end: the Brand Kit is the last step.
    expect(onFinish).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Step 6 of 6');
    expect($('h1').textContent).toBe('Last step: Find My Brand');
    await vi.waitFor(() => expect($('[data-welcome-brand-save]')).not.toBeNull(), { timeout: 5000 });
    expect(fetch).toHaveBeenCalledWith('/api/demo/discover', expect.objectContaining({ body: JSON.stringify({ websiteUrl: 'acme.com' }) }));
    expect($('[data-welcome-brand]').textContent).toContain('Acme');
    expect(JSON.parse(localStorage.getItem('sv_brand_kits') || '[]')).toHaveLength(0); // nothing saved until Save
    $('[data-welcome-brand-save]').click();
    await vi.waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(JSON.parse(localStorage.getItem('sv_brand_kits'))).toHaveLength(1);
    expect(onFinish.mock.calls[0][0]).toMatchObject({ goal: 'dynamic', team: '2-5', volume: '100+', company: 'Acme', website: 'acme.com', jobTitle: 'AE', heard: 'linkedin' });
    expect(onFinish.mock.calls[0][0].completedAt).toBeTruthy();
    expect($('[data-outreach-welcome]')).toBeNull();
  });

  it('picks up where you left off; Back and Skip move between questions; Something else is typed', async () => {
    const onFinish = vi.fn();
    mountOutreachWelcome($('#host'), { initial: { step: 3, goal: 'personal', team: 'solo' }, onFinish });
    expect(document.body.textContent).toContain('Step 3 of 6');
    $('[data-welcome-back]').click();
    expect($('[data-welcome-team="solo"]').getAttribute('aria-pressed')).toBe('true');
    $('[data-welcome-skip]').click();
    $('[data-welcome-skip]').click();
    expect(document.body.textContent).toContain('Step 4 of 6');
    typeIn('company', 'Acme'); typeIn('website', 'acme.com'); typeIn('jobTitle', 'AE');
    $('[data-welcome-work]').dispatchEvent(new Event('submit', { cancelable: true }));
    const other = $('input[aria-label="Something else"]');
    other.value = 'A billboard';
    other.closest('form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(onFinish).not.toHaveBeenCalled();
    await vi.waitFor(() => expect($('[data-welcome-brand-save]')).not.toBeNull(), { timeout: 5000 });
    $('[data-welcome-skip]').click(); // Skip on the last step finishes the welcome
    expect(onFinish.mock.calls[0][0]).toMatchObject({ heard: 'other', heardOther: 'A billboard' });
    expect(JSON.parse(localStorage.getItem('sv_brand_kits') || '[]')).toHaveLength(0); // skipped: nothing saved
  });

  it('Brand Kit step: asks for a website when there is none, shows a readable error, and can be retried', async () => {
    const onFinish = vi.fn();
    fetch.mockImplementation(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    mountOutreachWelcome($('#host'), { initial: { step: 6, company: 'Acme' }, onFinish });
    expect(fetch).not.toHaveBeenCalled(); // no website, no lookup
    const input = $('input[name="brandWebsite"]');
    input.value = 'acme.com'; input.dispatchEvent(new Event('input'));
    $('[data-welcome-brand] form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect($('[data-welcome-brand] [role="alert"]')).not.toBeNull(), { timeout: 5000 });
    expect($('[data-welcome-brand] [role="alert"]').textContent).toContain('Too many lookups');
    expect($('[data-welcome-brand] button[type="submit"]').textContent).toBe('Try again');
    mockDiscovery();
    $('[data-welcome-brand] form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect($('[data-welcome-brand-save]')).not.toBeNull(), { timeout: 5000 });
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('Brand Kit step: a failed save is reported and the welcome does not finish as if it had saved', async () => {
    const onFinish = vi.fn();
    mountOutreachWelcome($('#host'), { initial: { step: 6, company: 'Acme', website: 'acme.com' }, onFinish });
    await vi.waitFor(() => expect($('[data-welcome-brand-save]')).not.toBeNull(), { timeout: 5000 });
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    $('[data-welcome-brand-save]').click();
    await vi.waitFor(() => expect($('[data-welcome-brand] [role="alert"]')).not.toBeNull(), { timeout: 5000 });
    expect($('[data-welcome-brand] [role="alert"]').textContent).toContain("Couldn't save");
    expect(onFinish).not.toHaveBeenCalled();
    spy.mockRestore();
    $('[data-welcome-skip]').click(); // Skip still finishes the welcome
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('does not look up a website for anyone who finished the welcome before (their step never reaches the Brand Kit)', () => {
    mountOutreachWelcome($('#host'), { initial: { step: 5, goal: 'dynamic' } });
    expect(document.body.textContent).toContain('how did you hear about us');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('greets without a name when there is none', () => {
    mountOutreachWelcome($('#host'), {});
    expect($('h1').textContent).toBe('Welcome. What do you want to do first?');
  });
});
