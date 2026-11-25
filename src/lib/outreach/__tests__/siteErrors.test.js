import { describe, it, expect } from 'vitest';
import { defaultDraft, loadDraft, siteStatus, backgroundProblems, onMissingOf, campaignLinks, SITE_ERROR, RESTRICTED_ERROR, siteKey, siteErrorFor, guessMapping } from '../draft.js';

const draft = (onMissing) => ({
  ...defaultDraft(),
  background: { ...defaultDraft().background, mode: 'website', fallbackSite: 'mine.example', ...(onMissing ? { onMissing } : {}) },
  contacts: [
    { id: 'a', firstName: 'Ana', website: 'https://ok.example' },
    { id: 'b', firstName: 'Ben', website: 'https://broken.example/about' },
    { id: 'c', firstName: 'Cy' },
    { id: 'd', firstName: 'Di', website: 'https://new.example' },
  ],
  siteShots: { 'https://ok.example/': 'https://cdn/ok.jpg', 'https://mine.example/': 'https://cdn/mine.jpg' },
  siteErrors: { 'https://broken.example/': SITE_ERROR },
});

describe('website background error handling', () => {
  it('uses the fallback by default', () => {
    expect(defaultDraft().background.onMissing).toBe('fallback');
    expect(onMissingOf({ background: {} })).toBe('fallback');
    expect(onMissingOf(draft('error'))).toBe('error');
  });
  it('gives each prospect a website status', () => {
    const d = draft();
    expect(d.contacts.map((c) => siteStatus(d, c))).toEqual(['own', 'error', 'none', 'pending']);
  });
  it('only stops Generate when set to show an error', () => {
    expect(backgroundProblems(draft())).toEqual([]);
    expect(backgroundProblems(draft('error')).map((c) => c.id)).toEqual(['b', 'c']);
    expect(backgroundProblems({ ...draft('error'), background: { mode: 'profile', onMissing: 'error' } })).toEqual([]);
  });
  it('marks fallback links and website errors', () => {
    const links = campaignLinks(draft(), 'https://w/1', (u, p) => `${u}?n=${p.firstName}`);
    expect(links.map((l) => [l.site, !!l.siteError])).toEqual([['own', false], ['fallback', true], ['fallback', false], ['fallback', false]]);
  });
  it('keeps website errors across reloads', () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
    storage.setItem('outreach-draft-v1', JSON.stringify(draft('error')));
    const d = loadDraft(storage);
    expect(d.siteErrors).toEqual({ 'https://broken.example/': SITE_ERROR });
    expect(d.background.onMissing).toBe('error');
  });
  it('keys social links by their profile page, like the server', () => {
    expect(siteKey('youtube.com/@NASA/videos')).toBe('https://www.youtube.com/@NASA');
    expect(siteKey('https://www.tiktok.com/@nasa?lang=en')).toBe('https://www.tiktok.com/@nasa');
    expect(siteKey('facebook.com/AcmePizza/about')).toBe('https://www.facebook.com/AcmePizza');
    expect(siteKey('https://twitter.com/acme/status/1')).toBe('https://x.com/acme');
    expect(siteKey('youtube.com')).toBeNull();
    expect(siteKey('acme.com/pricing')).toBe('https://acme.com/');
    expect(siteKey('https://www.linkedin.com/in/jane/')).toBe('https://www.linkedin.com/in/jane');
  });
  it('shows the server message for a login wall', () => {
    const d = { ...draft(), siteErrors: { 'https://www.facebook.com/AcmePizza': RESTRICTED_ERROR } };
    expect(siteErrorFor(d, { website: 'https://facebook.com/AcmePizza' })).toBe(RESTRICTED_ERROR);
    expect(siteErrorFor(d, { website: 'https://broken.example' })).toBe(SITE_ERROR);
  });
  it('maps social page columns to the website field', () => {
    expect(guessMapping(['Name', 'YouTube']).website).toBe('YouTube');
    expect(guessMapping(['Name', 'Social URL']).website).toBe('Social URL');
  });
});
