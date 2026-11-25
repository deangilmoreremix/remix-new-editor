// @vitest-environment jsdom
// The Edit Studio guide's apps gallery: every Edit Studio app is listed, and clicking one opens the preview.
import { describe, test, expect, beforeEach } from 'vitest';
import { GUIDES } from '../data/studioGuides.js';
import { renderGuideHtml } from '../components/guides/renderGuide.js';
import { wireAppShowcase } from '../components/guides/appShowcase.js';
import { EDIT_APPS, getEditAppGroups } from '../lib/muapiEditApps.js';

const guide = GUIDES.find((g) => g.slug === 'edit-studio');

function page() {
  const root = document.createElement('div');
  root.innerHTML = renderGuideHtml(guide, GUIDES.length);
  document.body.innerHTML = '';
  document.body.appendChild(root);
  return root;
}

describe('Edit Studio guide: apps showcase', () => {
  test('lists exactly the apps the Edit Studio shows, in the same groups', () => {
    expect(guide.appsShowcase.total).toBe(EDIT_APPS.length);
    expect(guide.appsShowcase.groups.map((g) => [g.key, g.apps.map((a) => a.slug)]))
      .toEqual(getEditAppGroups().map((g) => [g.key, g.apps.map((a) => a.slug)]));
  });

  test('no app appears twice', () => {
    const slugs = guide.appsShowcase.groups.flatMap((g) => g.apps.map((a) => a.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test('is plain HTML with one card per app (so search engines see it)', () => {
    const root = page();
    expect(root.querySelectorAll('[data-app-slug]').length).toBe(EDIT_APPS.length);
    expect(root.querySelector('a[href="#apps"]')?.textContent).toContain(String(EDIT_APPS.length));
  });

  test('only the Edit Studio guide has the showcase', () => {
    expect(GUIDES.filter((g) => g.appsShowcase).map((g) => g.slug)).toEqual(['edit-studio']);
  });

  describe('page script', () => {
    let root;
    beforeEach(() => { window.history.replaceState(null, '', '/studios/edit-studio'); root = page(); wireAppShowcase(root); });
    const dialog = () => root.querySelector('[data-app-preview]');
    const frame = () => root.querySelector('[data-pv-frame]');

    test('search narrows the cards and shows a message when nothing matches', () => {
      const search = root.querySelector('[data-app-search]');
      search.value = EDIT_APPS[0].name.toLowerCase();
      search.dispatchEvent(new Event('input'));
      const shown = [...root.querySelectorAll('[data-app-slug]')].filter((c) => !c.hidden);
      expect(shown.length).toBeGreaterThan(0);
      expect(shown.length).toBeLessThan(EDIT_APPS.length);
      search.value = 'zzzz-not-an-app';
      search.dispatchEvent(new Event('input'));
      expect(root.querySelector('[data-app-empty]').hidden).toBe(false);
    });

    test('a category chip shows only that category', () => {
      const [, second] = root.querySelectorAll('[data-app-cat]');
      second.click();
      const key = second.dataset.appCat;
      const shown = [...root.querySelectorAll('[data-app-slug]')].filter((c) => !c.hidden);
      expect(shown.every((c) => c.closest('[data-app-group]').dataset.appGroup === key)).toBe(true);
    });

    test('clicking an app opens the preview of that app, and Escape closes it', () => {
      const card = root.querySelector('[data-app-slug]');
      card.click();
      expect(dialog().hidden).toBe(false);
      expect(frame().getAttribute('src')).toBe(`/edit-preview?tool=${card.dataset.appSlug}`);
      expect(root.querySelector('[data-pv-open]').getAttribute('href')).toBe(`/?tool=${card.dataset.appSlug}#/edit`);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(dialog().hidden).toBe(true);
      expect(frame().hasAttribute('src')).toBe(false);
    });

    test('closes when the preview frame reports Escape', () => {
      root.querySelector('[data-app-slug]').click();
      window.dispatchEvent(new window.MessageEvent('message', { data: { source: 'sv-edit-preview', type: 'close' }, origin: window.location.origin }));
      expect(dialog().hidden).toBe(true);
    });

    test('ignores close messages from other sites', () => {
      root.querySelector('[data-app-slug]').click();
      window.dispatchEvent(new window.MessageEvent('message', { data: { source: 'sv-edit-preview', type: 'close' }, origin: 'https://evil.example' }));
      expect(dialog().hidden).toBe(false);
    });

    test('next and previous step through the visible apps', () => {
      const cards = [...root.querySelectorAll('[data-app-slug]')];
      cards[0].click();
      root.querySelector('[data-pv-next]').click();
      expect(frame().getAttribute('src')).toContain(cards[1].dataset.appSlug);
      root.querySelector('[data-pv-prev]').click();
      root.querySelector('[data-pv-prev]').click();
      expect(frame().getAttribute('src')).toContain(cards[cards.length - 1].dataset.appSlug); // wraps around
    });
  });
});
