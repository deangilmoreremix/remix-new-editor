// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initRouter, navigate, isKnownPage } from '../../../lib/router.js';
import { ACADEMY_LESSONS } from '../../../data/academy/catalog.js';
import { getAppForLesson } from '../../../data/academyApps.js';

const T07 = '07-ai-product-photography';
const T08 = '08-ai-fashion-and-virtual-tryon';
const studioLessons = ACADEMY_LESSONS.filter((l) => [T07, T08].includes(l.trackSlug)).map((l) => ({ lesson: l, app: getAppForLesson(l.trackSlug, l.id) })).filter((x) => x.app?.format === 'studio');

describe('Academy "Open <studio>" buttons go to real studios', () => {
  it('covers the eight product-photography and fashion lessons', () => expect(studioLessons).toHaveLength(8));

  it.each(studioLessons.map((x) => [x.lesson.id, x.app]))('%s opens a page the router knows', (_id, app) => {
    expect(isKnownPage(app.pageId), `${app.pageId} has no router entry (it would open the Coming Soon page)`).toBe(true);
    expect(app.pageId).not.toMatch(/^studios\//);
  });

  it('maps product photography to Product Shot Studio, batch workflows to Photo Studio, fashion to Change Dress', () => {
    const by = (id) => getAppForLesson(id.split('::')[0], id);
    expect(by(`${T07}::01-product-photography`)).toMatchObject({ pageId: 'commercial', app_name: 'Product Shot Studio' });
    expect(by(`${T07}::04-batch-workflows`)).toMatchObject({ pageId: 'photo-studio', app_name: 'Photo Studio' });
    for (const f of ['01-garment-tryon', '02-studio-lookbooks', '03-sizing-layout-consistency', '04-conversion-cases']) {
      expect(by(`${T08}::${f}`)).toMatchObject({ pageId: 'edit', params: { tool: 'change-dress' } });
    }
  });

  it('the Change Dress deep link names a real Edit Studio tool', async () => {
    const { getEditToolBySlug } = await import('../../../components/EditStudio.js');
    expect(getEditToolBySlug('change-dress')?.slug).toBe('change-dress');
  });

  it('isKnownPage rejects the old stub ids and unknown pages', () => {
    expect(isKnownPage('studios/product-photo-studio')).toBe(false);
    expect(isKnownPage('studios/fashion-studio')).toBe(false);
    expect(isKnownPage('definitely-not-a-page')).toBe(false);
    expect(isKnownPage('academy/track/02-ai-filmmaking')).toBe(true);
    expect(isKnownPage('chat')).toBe(true); // retired routes redirect to a live page
  });
});

describe('Academy lesson pages show the right button', () => {
  let area;
  beforeEach(() => {
    area = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(area);
    initRouter(area, () => {});
  });
  it.each([
    [`${T07}::01-product-photography`, T07, 'Open Product Shot Studio'],
    [`${T07}::04-batch-workflows`, T07, 'Open Photo Studio'],
    [`${T08}::01-garment-tryon`, T08, 'Open Edit Studio (Change Dress)'],
  ])('%s → %s', async (id, track, label) => {
    await navigate(`academy/track/${track}/lesson/${id}`);
    // The studio button is on the lesson's "See" tab.
    await vi.waitFor(() => expect([...area.querySelectorAll('button')].some((b) => b.textContent.trim() === 'See')).toBe(true));
    [...area.querySelectorAll('button')].find((b) => b.textContent.trim() === 'See').click();
    await vi.waitFor(() => expect(area.textContent).toContain(label));
    expect(area.textContent).not.toContain('AI Product Studio');
    expect(area.textContent).not.toContain('AI Fashion Studio');
  });
});

describe('clicking the button opens the studio with the right URL', () => {
  it('Change Dress deep-links Edit Studio via ?tool=change-dress', async () => {
    const area = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(area);
    initRouter(area, () => {});
    await navigate(`academy/track/${T08}/lesson/${T08}::01-garment-tryon`);
    await vi.waitFor(() => expect([...area.querySelectorAll('button')].some((b) => b.textContent.trim() === 'See')).toBe(true));
    [...area.querySelectorAll('button')].find((b) => b.textContent.trim() === 'See').click();
    await vi.waitFor(() => expect(area.textContent).toContain('Open Edit Studio (Change Dress)'));
    [...area.querySelectorAll('button')].find((b) => b.textContent.includes('Open Edit Studio')).click();
    expect(window.location.hash).toBe('#/edit');
    expect(new URLSearchParams(window.location.search).get('tool')).toBe('change-dress');
  });
});
