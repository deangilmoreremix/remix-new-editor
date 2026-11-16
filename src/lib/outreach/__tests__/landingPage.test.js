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

describe('your own landing page, exactly as you made it', () => {
  it('copies every design in full: nothing added, nothing rewritten, original untouched', async () => {
    const { campaignPageConfig } = await import('../landingPage.js');
    const { PUCK_TEMPLATES } = await import('../../landingPages/puck/designs.js');
    const { defaultConfig } = await import('../../landingPages/templates.js');
    for (const t of PUCK_TEMPLATES) {
      const mine = { ...defaultConfig(t.id, { title: 'Mine' }), puck: t.puckData };
      const before = JSON.stringify(mine);
      const out = campaignPageConfig(mine);
      expect(out).toEqual(mine);
      expect(out).not.toBe(mine);
      expect(out.puck.content).not.toBe(mine.puck.content);
      expect(JSON.stringify(out)).not.toMatch(/OutreachActions/);
      out.puck.content[0].props.id = 'changed';
      expect(JSON.stringify(mine)).toBe(before);
    }
    const classic = { headline: 'My words', calendar: undefined };
    expect(campaignPageConfig(classic)).toEqual({ headline: 'My words' });
    expect(campaignPageConfig(null)).toEqual({});
  });

  it('lists only the pages you made, not the copies campaigns made', async () => {
    const { ownPages, pageOption } = await import('../landingPage.js');
    const rows = [
      { id: 'mine12345', title: 'Spring offer', source: { kind: 'upload' }, updated_at: '2026-11-01T00:00:00Z' },
      { id: 'copy12345', title: 'Q4', source: { kind: 'outreach', page: 'mine12345' } },
      { id: 'bare12345' }, null, { title: 'no id' },
    ];
    expect(ownPages(rows).map((r) => r.id)).toEqual(['mine12345', 'bare12345']);
    expect(ownPages(undefined)).toEqual([]);
    expect(pageOption(rows[0])).toEqual({ id: 'mine12345', title: 'Spring offer', updatedAt: '2026-11-01T00:00:00Z' });
    expect(pageOption(rows[2]).title).toBe('Untitled page');
  });
});
