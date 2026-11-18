import { describe, it, expect } from 'vitest';
import { trackedLink, cleanTag, LINK_PRESETS } from '@cinegen/lib/leads/share-links';

const base = 'https://app.test/watch/Abc123XyZ9';
describe('tracked links', () => {
  it('adds the preset tags to the published link', () => {
    const u = new URL(trackedLink(base, 'email'));
    expect(u.origin + u.pathname).toBe(base);
    expect(u.searchParams.get('utm_source')).toBe('email'); expect(u.searchParams.get('utm_medium')).toBe('email');
    expect(u.searchParams.has('utm_campaign')).toBe(false);
  });
  it('adds a cleaned campaign name', () => {
    expect(new URL(trackedLink(base, 'social', 'Spring Sale! 2026')).searchParams.get('utm_campaign')).toBe('spring-sale-2026');
    expect(new URL(trackedLink(base, 'social', '   ')).searchParams.has('utm_campaign')).toBe(false);
    expect(cleanTag('a'.repeat(100))).toHaveLength(60);
    expect(cleanTag('<script>x</script>')).toBe('script-x-script');
  });
  it('the MP4 preset also carries src=mp4, so the Leads tab tags it', () => {
    expect(new URL(trackedLink(base, 'mp4')).searchParams.get('src')).toBe('mp4');
    expect(new URL(trackedLink(base, 'email')).searchParams.has('src')).toBe(false);
  });
  it('keeps other query parameters and replaces an old tag', () => {
    const u = new URL(trackedLink(`${base}?firstname=Ann&utm_source=old&utm_campaign=old`, 'qr'));
    expect(u.searchParams.get('firstname')).toBe('Ann'); expect(u.searchParams.get('utm_source')).toBe('qr'); expect(u.searchParams.has('utm_campaign')).toBe(false);
  });
  it('returns the link unchanged for an unknown preset or a bad URL', () => {
    expect(trackedLink(base, 'nope')).toBe(base);
    expect(trackedLink('not a url', 'email')).toBe('not a url');
    expect(trackedLink('', 'email')).toBe('');
  });
  it('has the presets the card offers', () => { expect(LINK_PRESETS.map((p) => p.id)).toEqual(['email', 'newsletter', 'social', 'qr', 'sms', 'mp4']); });
});
