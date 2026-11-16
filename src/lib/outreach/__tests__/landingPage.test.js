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
    expect(cfg).toMatchObject({ headline: 'Hi {{firstname}}, I made this for you', subhead: 'For {{company}}.', cta: { label: 'Book a call', url: 'https://cal.com/me', type: 'calendar' }, calendar: { url: 'https://cal.com/me?embed=true' }, likes: { enabled: true } });
    expect(cfg.transcript.items[0]).toMatchObject({ t: 1, text: 'Hello there.' });
    const plain = pageConfigFromDraft({ headline: 'Keep' }, { cta: { enabled: true, url: 'http://insecure' } });
    expect(plain.headline).toBe('Keep');
    expect(plain.cta).toBeUndefined();
  });
});

describe('designs as Sendspark-style personal video pages', () => {
  const draft = {
    header: 'Hi {{firstname}}, a quick idea for {{company}}', message: 'Made for {{company}}.',
    cta: { enabled: true, label: 'Book a call', url: 'https://cal.com/me/15min', embed: true },
    sender: { name: 'Dana {{evil}} Lee', title: 'Founder', company: 'Remix', logo: 'https://cdn.test/logo.png', photo: 'javascript:alert(1)' },
  };

  it('keeps the design look but drops its sample sections and lead forms', async () => {
    const { outreachPuck } = await import('../landingPage.js');
    const { PUCK_TEMPLATES } = await import('../../landingPages/puck/designs.js');
    const leadiq = PUCK_TEMPLATES.find((t) => t.id === 'puck-leadiq').puckData;
    const out = outreachPuck(leadiq, draft);
    expect(out.root.props).toEqual(leadiq.root.props);
    expect(out.content.map((c) => c.type)).toEqual(['NavBar', 'Hero', 'OutreachActions', 'Footer']);
    const [nav, hero, actions, footer] = out.content.map((c) => c.props);
    expect(nav).toMatchObject({ brand: 'Remix', logo: 'https://cdn.test/logo.png', links: [], loginLabel: '', ctaLabel: 'Book a call' });
    expect(hero).toMatchObject({ variant: 'video-copy-form', headline: draft.header, subhead: draft.message, showForm: 'no', bullets: [], photo: '' });
    expect(actions).toMatchObject({ senderName: 'Dana evil Lee', senderTitle: 'Founder, Remix', senderPhoto: '', ctaUrl: 'https://cal.com/me/15min', like: 'yes' });
    expect(actions.calendarUrl).toMatch(/^https:\/\/cal\.com\/me\/15min\?/);
    expect(footer.text).toBe('Sent by Dana evil Lee · Remix');
    expect(JSON.stringify(out)).not.toMatch(/Melissa|SmartVideo|VideoLeadIQ|\+317%/);
  });

  it('works for every design, and without sender details or a calendar', async () => {
    const { outreachPuck, pageConfigFromDraft } = await import('../landingPage.js');
    const { PUCK_TEMPLATES } = await import('../../landingPages/puck/designs.js');
    const bare = { header: 'Hi', cta: { enabled: true, label: 'Go', url: 'https://example.com/x' } };
    for (const t of PUCK_TEMPLATES) {
      const types = outreachPuck(t.puckData, bare).content.map((c) => c.type);
      expect(types).toEqual(['Hero', 'OutreachActions']);
    }
    const a = outreachPuck(PUCK_TEMPLATES[0].puckData, bare).content[1].props;
    expect(a).toMatchObject({ ctaLabel: 'Go', ctaUrl: 'https://example.com/x', calendarUrl: '' });
    const cfg = pageConfigFromDraft({ puck: PUCK_TEMPLATES[1].puckData }, draft);
    expect(cfg.puck.content[0].type).toBe('NavBar');
    expect(cfg.sender).toMatchObject({ name: 'Dana evil Lee', avatarUrl: '' });
  });
});
