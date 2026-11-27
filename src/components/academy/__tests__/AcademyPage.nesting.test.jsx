import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';

vi.mock('../../../lib/router.js', () => ({ navigate: vi.fn() }));

import { AcademyPage } from '../AcademyPage.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

// Interactive content inside a <button> is invalid HTML: React warns, and a click on the inner control also fires the outer one.
const nestedInteractive = (root) => [...root.querySelectorAll('button')].filter((b) => b.querySelector('button, a[href], input, select, textarea'));

describe('Academy page: no interactive element nested in a button', () => {
  let container;
  let errors;

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/'); // the Academy keeps its route in the URL
    window.location.hash = '';
    errors = [];
    vi.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args.join(' ')); });
  });

  afterEach(() => {
    container?.cleanup?.();
    container?.remove();
    vi.restoreAllMocks();
  });

  const mount = async () => {
    await act(async () => { container = AcademyPage(); document.body.appendChild(container); });
    await flush();
  };

  const openFirstTrack = async () => {
    const card = [...container.querySelectorAll('button')].find((b) => /Track\s*\d/.test(b.textContent));
    expect(card, 'a track card should be rendered').toBeTruthy();
    await act(async () => { card.click(); });
    await flush();
  };

  it('lesson rows in a track hold no nested buttons', async () => {
    await mount();
    await openFirstTrack();
    expect(container.textContent).toMatch(/Lessons \(/);
    expect(nestedInteractive(container).length).toBe(0);
    expect(errors.filter((e) => /cannot be a descendant of/.test(e))).toEqual([]);
  });

  it('bookmark rows on the home page hold no nested buttons', async () => {
    await mount();
    await openFirstTrack();
    // Bookmark the first lesson through its own (inner) control, then go back home.
    const bookmark = container.querySelector('[title="Bookmark for later"]');
    expect(bookmark, 'a bookmark control should be present on a lesson row').toBeTruthy();
    await act(async () => { bookmark.click(); });
    await flush();
    expect(JSON.parse(localStorage.getItem('academy_bookmarks') || '[]').length).toBe(1);

    await act(async () => { container.cleanup(); container.remove(); });
    window.history.replaceState(null, '', '/');
    window.location.hash = '';
    await mount();
    expect(container.textContent).toMatch(/Bookmarks \(1\)/);
    expect(nestedInteractive(container)).toEqual([]);
    expect(errors.filter((e) => /cannot be a descendant of/.test(e))).toEqual([]);
  });

  it('a lesson row still opens its lesson and keeps working from the keyboard', async () => {
    await mount();
    await openFirstTrack();
    const row = container.querySelector('[data-lesson-row]');
    expect(row, 'lesson rows are marked data-lesson-row').toBeTruthy();
    expect(row.getAttribute('role')).toBe('button');
    expect(row.tabIndex).toBe(0);
    await act(async () => { row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    await flush();
    expect(container.textContent).toMatch(/Lesson\s*\d/);
  });

  it('the inner bookmark control does not open the lesson', async () => {
    await mount();
    await openFirstTrack();
    const before = container.textContent;
    const bookmark = container.querySelector('[title="Bookmark for later"]');
    await act(async () => { bookmark.click(); });
    await flush();
    expect(container.textContent).toMatch(/Lessons \(/); // still on the track page
    expect(container.textContent).not.toMatch(/Back to track/);
    expect(before).toMatch(/Lessons \(/);
  });
});
