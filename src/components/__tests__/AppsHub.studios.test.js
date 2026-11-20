// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/muapi.js', () => ({ muapi: {} }));
vi.mock('../../lib/router.js', () => ({ navigate: vi.fn() }));
const { navigate } = await import('../../lib/router.js');
const { AppsHub } = await import('../AppsHub.js');
const { STUDIO_DIRECTORY } = await import('../../lib/studioDirectory.js');

const all = (s, r = document) => [...r.querySelectorAll(s)];

describe('Apps page: all 38 studios', () => {
  beforeEach(() => { localStorage.clear(); document.body.innerHTML = ''; document.body.appendChild(AppsHub()); });

  it('shows 38 studio cards, each a link to its studio with its screenshot', () => {
    const cards = all('[data-studio-card]');
    expect(cards).toHaveLength(38);
    expect(document.querySelector('[data-studio-total]').textContent).toBe('38 studios');
    for (const s of STUDIO_DIRECTORY) {
      const card = document.querySelector(`[data-studio-card="${s.id}"]`);
      expect(card, s.id).toBeTruthy();
      expect(card.tagName).toBe('A');
      expect(card.getAttribute('href')).toBe(`#/${s.id}`);
      expect(card.textContent).toContain(s.name);
      expect(card.querySelector('img').getAttribute('src'), s.id).toBe(s.image);
    }
  });
  it('groups them like the side menu: Discover, Image, Video, Agents, My Work', () => {
    const sections = all('[data-app-section]').map((s) => [s.dataset.appSection, all('[data-studio-card]', s).length]).filter(([t]) => t);
    expect(sections.slice(0, 5)).toEqual([['Discover', 3], ['Image', 7], ['Video', 11], ['Agents', 15], ['My Work', 2]]);
  });
  it('includes the studios that are not in the side menu', () => {
    for (const id of ['influencer', 'motion-director', 'leadfinder', 'outreach', 'recorder', 'find-my-brand', 'render']) {
      expect(document.querySelector(`[data-studio-card="${id}"]`), id).toBeTruthy();
    }
  });
  it('search narrows the cards', () => {
    const input = document.querySelector('input[placeholder="Search apps..."]');
    input.value = 'lip sync';
    input.dispatchEvent(new Event('input'));
    const visible = all('[data-studio-card]').filter((c) => c.style.display !== 'none').map((c) => c.dataset.studioCard);
    expect(visible).toContain('lipsync');
    expect(visible.length).toBeLessThan(10);
  });
  it('a plain click opens the studio through the router (one history entry); a ctrl-click is left to the browser', () => {
    navigate.mockClear();
    const card = document.querySelector('[data-studio-card="avatar"]');
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true });
    card.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith('avatar');
    navigate.mockClear();
    const modified = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    card.dispatchEvent(modified);
    expect(modified.defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
  it('remembers a studio you opened under Recently Used', () => {
    document.querySelector('[data-studio-card="image"]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(JSON.parse(localStorage.getItem('recent_tools'))[0].id).toBe('image');
  });
  it('falls back to the thumbnail when a screenshot fails to load', () => {
    const img = document.querySelector('[data-studio-card="image"] img');
    img.dispatchEvent(new Event('error'));
    expect(img.getAttribute('src')).toBe(STUDIO_DIRECTORY.find((s) => s.id === 'image').fallback);
  });
});

describe('Apps page: Your studios row and stars', () => {
  const key = 'smartvideo-app-onboarding-v1:guest';
  const mount = (answers) => {
    localStorage.clear(); document.body.innerHTML = '';
    if (answers) localStorage.setItem(key, JSON.stringify(answers));
    document.body.appendChild(AppsHub());
  };

  it('guests with no answers see no row, and still 38 cards in 5 sections', () => {
    mount(null);
    expect(document.querySelector('[data-your-studios]')).toBeNull();
    expect(all('[data-studio-card]')).toHaveLength(38);
  });

  it('shows favorites first (primary first), then recommendations, capped at 8, without changing the 38 cards', () => {
    mount({ step: 6, videoTypes: ['talking'], tools: ['image', 'avatar'], primaryTool: 'avatar' });
    const ids = all('[data-reco-card]').map((c) => c.getAttribute('data-reco-card'));
    expect(ids.slice(0, 2)).toEqual(['avatar', 'image']);
    expect(ids).toContain('lipsync'); // recommended for "talking"
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeLessThanOrEqual(8);
    expect(all('[data-studio-card]')).toHaveLength(38);
    expect(all('[data-app-section]').length).toBeGreaterThanOrEqual(5);
  });

  it('a star toggles the favorite, does not navigate, and the row follows', () => {
    mount({ step: 6, tools: ['image'], primaryTool: 'image' });
    navigate.mockClear();
    const star = document.querySelector('[data-studio-card="video"] [data-fav-toggle]');
    expect(star.getAttribute('aria-pressed')).toBe('false');
    star.click();
    expect(navigate).not.toHaveBeenCalled();
    expect(document.querySelector('[data-studio-card="video"] [data-fav-toggle]').getAttribute('aria-pressed')).toBe('true');
    expect(all('[data-reco-card]').map((c) => c.getAttribute('data-reco-card'))).toEqual(['image', 'video']);
    document.querySelector('[data-studio-card="image"] [data-fav-toggle]').click();
    expect(all('[data-reco-card]').map((c) => c.getAttribute('data-reco-card'))).toEqual(['video']);
  });

  it('a first star creates the row for a guest, and the row hides while searching', () => {
    mount(null);
    document.querySelector('[data-studio-card="avatar"] [data-fav-toggle]').click();
    const row = document.querySelector('[data-your-studios]');
    expect(row).not.toBeNull();
    const input = document.querySelector('input[placeholder="Search apps..."]');
    input.value = 'lip'; input.dispatchEvent(new Event('input'));
    expect(row.style.display).toBe('none');
    input.value = ''; input.dispatchEvent(new Event('input'));
    expect(row.style.display).toBe('');
  });
});
