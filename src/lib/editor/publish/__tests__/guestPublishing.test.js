import { describe, it, expect, vi } from 'vitest';
import '../../addons/index.js';
import { renderSharePanel } from '../sharePanel.js';
import { renderBatchHub } from '../../panels/personalPanels.js';
import { friendlyPublishError, GUEST_NOTICE } from '../guestMessages.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = () => { const box = document.createElement('div'); document.body.appendChild(box); return box; };
const published = { id: 'abcdefgh12', title: 'T', published: true, view_count: 0, business: null, slug: null, privacy: 'public' };
const base = { defaultTitle: 'T', getInfo: async () => published, publish: async () => published, setPublished: async () => {}, copy: async () => {}, saveLink: async () => published, setPrivacy: async () => {}, listRevisions: async () => [] };

describe('guest messages', () => {
  it('turns database refusals into plain language', () => {
    expect(friendlyPublishError(new Error('guest_limit_videos'))).toMatch(/10 published videos.*Sign in/);
    expect(friendlyPublishError({ message: 'x', hint: 'guest_limit_links' })).toMatch(/200 personal links/);
    expect(friendlyPublishError(new Error('guest_not_allowed_slug'))).toMatch(/Readable link names need an account/);
    expect(friendlyPublishError({ code: 'guest_rate_limited', message: 'Too many' })).toMatch(/Too many new guest sessions/);
    expect(friendlyPublishError(new Error('network down'))).toBe('network down');
    expect(friendlyPublishError(null, 'fallback')).toBe('fallback');
  });
});

describe('Share panel without an account', () => {
  it('says plainly what a guest gets, and hides readable names and privacy', async () => {
    const box = mount();
    renderSharePanel(box, { ...base, guest: () => true });
    await tick(); await tick();
    expect(box.querySelector('.share-guest').textContent).toBe(GUEST_NOTICE);
    expect(box.querySelector('[data-share-link]').value).toContain('abcdefgh12');
    expect(box.querySelector('[data-share-slug]')).toBeNull();
    expect(box.querySelector('[data-share-privacy]')).toBeNull();
  });

  it('is unchanged for a signed-in user', async () => {
    const box = mount();
    renderSharePanel(box, { ...base, guest: () => false });
    await tick(); await tick();
    expect(box.querySelector('.share-guest')).toBeNull();
    expect(box.querySelector('[data-share-slug]')).not.toBeNull();
    expect(box.querySelector('[data-share-privacy]')).not.toBeNull();
  });

  it('shows the quota message when publishing is refused', async () => {
    const box = mount();
    renderSharePanel(box, { ...base, guest: () => true, getInfo: async () => null, publish: async () => { throw new Error('guest_limit_videos'); } });
    await tick(); await tick();
    box.querySelector('[data-share-publish]').click();
    await tick(); await tick();
    expect(box.querySelector('[role="alert"]').textContent).toMatch(/10 published videos/);
  });
});

describe('Personalized output for a guest', () => {
  const contacts = [{ id: 'c1', contact: { firstName: 'Ann' } }];
  it('shows the notice and a plain message when the link limit is hit', async () => {
    const el = document.createElement('div');
    renderBatchHub(el, {
      contacts: () => contacts, tokensUsed: () => [], exportEach: () => {}, openShare: () => {}, guest: () => true,
      createLinks: async () => { throw new Error('guest_limit_links'); },
    });
    expect(el.textContent).toContain('without an account');
    el.querySelector('[data-rp="links"]').click();
    await tick(); await tick();
    expect(el.textContent).toMatch(/200 personal links/);
  });
});
