import { describe, it, expect } from 'vitest';
import { outreachCampaignId, outreachPlayerSrc, landingLink } from '../landingPage.js';

const origin = 'https://smartvid.app';

describe('outreach on landing page designs', () => {
  it('recognises a campaign player on this site only', () => {
    expect(outreachCampaignId('https://smartvid.app/watch/abc12345', origin)).toBe('abc12345');
    expect(outreachCampaignId('https://evil.test/watch/abc12345', origin)).toBeNull();
    expect(outreachCampaignId('https://smartvid.app/video.mp4', origin)).toBeNull();
    expect(outreachCampaignId('not a url', origin)).toBeNull();
  });

  it('the page shows the personal player with the contact’s parameters only', () => {
    const src = outreachPlayerSrc('https://smartvid.app/watch/abc12345', '?c=c1&firstName=Mike&firstname=Mike&websiteShotUrl=https%3A%2F%2Fcdn%2Fa.jpg&embed=0&utm_source=x', origin);
    const u = new URL(src);
    expect(u.pathname).toBe('/watch/abc12345');
    expect(Object.fromEntries(u.searchParams)).toEqual({ embed: '1', c: 'c1', firstName: 'Mike', websiteShotUrl: 'https://cdn/a.jpg' });
    expect(outreachPlayerSrc('https://cdn.test/plain.mp4', '?c=c1', origin)).toBeNull();
  });

  it('a contact’s page link carries the player’s and the page’s tokens', () => {
    const link = landingLink('https://smartvid.app/p/page12345', 'https://smartvid.app/watch/abc12345?c=c1&firstName=Mike&company=Acme', { firstName: 'Mike', lastName: 'M', company: 'Acme', jobTitle: 'CEO' });
    const u = new URL(link);
    expect(u.pathname).toBe('/p/page12345');
    expect(Object.fromEntries(u.searchParams)).toEqual({ c: 'c1', firstName: 'Mike', company: 'Acme', firstname: 'Mike', lastname: 'M', role: 'CEO' });
  });
});

describe('page settings from the campaign', () => {
  it('fills the header, message, booking button, calendar, Like and transcript', async () => {
    const { pageConfigFromDraft } = await import('../landingPage.js');
    const { sanitizeConfig, defaultConfig } = await import('../../landingPages/templates.js');
    const draft = {
      header: 'Hi {{firstname}}, I made this for you', message: 'For {{company}}.',
      cta: { enabled: true, label: 'Book a call', url: 'https://cal.com/me', embed: true },
      captions: { lines: [{ startMs: 1200, endMs: 2000, text: 'Hello there.' }] },
    };
    const cfg = sanitizeConfig(pageConfigFromDraft(defaultConfig('clean', { title: 'x' }), draft));
    expect(cfg).toMatchObject({ headline: 'Hi {{firstname}}, I made this for you', subhead: 'For {{company}}.', cta: { label: 'Book a call', url: 'https://cal.com/me', type: 'calendar' }, calendar: { url: 'https://cal.com/me' }, likes: { enabled: true } });
    expect(cfg.transcript.items[0]).toMatchObject({ t: 1, text: 'Hello there.' });
    const plain = pageConfigFromDraft({ headline: 'Keep' }, { cta: { enabled: true, url: 'http://insecure' } });
    expect(plain.headline).toBe('Keep');
    expect(plain.cta).toBeUndefined();
  });
});
