// Smart Video Scheduler: view helpers and the rendered page.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  listScheduledPosts: vi.fn(),
  cancelScheduledPost: vi.fn(),
  openSocialPublish: vi.fn(),
}));

vi.mock('../lib/studioChrome.js', () => ({ mountStudioChrome: vi.fn() }));
vi.mock('../lib/thumbnails.js', () => ({ createHeroSection: vi.fn(() => null) }));
vi.mock('../lib/socialPublishHelpers.js', () => ({ openSocialPublish: h.openSocialPublish }));
vi.mock('../lib/socialSchedule.js', () => ({
  listScheduledPosts: h.listScheduledPosts,
  cancelScheduledPost: h.cancelScheduledPost,
  STATUS_LABELS: {
    scheduled: 'Scheduled', publishing: 'Publishing…', processing: 'Publishing…',
    published: 'Published', failed: 'Failed', cancelled: 'Cancelled',
  },
}));

import { groupPostsByDay, postLink, postTitle, safeHttpUrl, summarizePosts } from '../lib/scheduledPostsView.js';
import { SmartVideoScheduler } from '../components/SmartVideoScheduler.js';

const post = (over = {}) => ({
  id: 'p1', platform: 'youtube', status: 'scheduled', error: null, result: null,
  run_at: new Date(2026, 10, 26, 9, 0).toISOString(),
  payload: { title: 'Launch video' },
  ...over,
});

describe('view helpers', () => {
  test('postTitle falls back through title, caption, description and truncates', () => {
    expect(postTitle({ payload: { title: ' Hi ' } })).toBe('Hi');
    expect(postTitle({ payload: { caption: 'cap' } })).toBe('cap');
    expect(postTitle({ payload: {} })).toBe('Untitled post');
    expect(postTitle({})).toBe('Untitled post');
    const long = postTitle({ payload: { title: 'x'.repeat(200) } });
    expect(long.length).toBe(80);
    expect(long.endsWith('…')).toBe(true);
  });

  test('groupPostsByDay groups by local day and sorts ascending', () => {
    const groups = groupPostsByDay([
      post({ id: 'c', run_at: new Date(2026, 10, 27, 8, 0).toISOString() }),
      post({ id: 'b', run_at: new Date(2026, 10, 26, 15, 0).toISOString() }),
      post({ id: 'a', run_at: new Date(2026, 10, 26, 9, 0).toISOString() }),
    ], 'en-US');
    expect(groups.map((g) => g.key)).toEqual(['2026-11-26', '2026-11-27']);
    expect(groups[0].posts.map((p) => p.id)).toEqual(['a', 'b']);
    expect(groups[0].label).toContain('November 26');
  });

  test('groupPostsByDay skips unparseable dates', () => {
    expect(groupPostsByDay([post({ run_at: 'nope' })])).toEqual([]);
  });

  test('summarizePosts counts statuses and excludes cancelled from platform totals', () => {
    const s = summarizePosts([
      post({ status: 'scheduled' }), post({ status: 'processing' }), post({ status: 'published', platform: 'tiktok' }),
      post({ status: 'failed' }), post({ status: 'cancelled' }),
    ]);
    expect(s).toMatchObject({ total: 5, scheduled: 1, inFlight: 1, published: 1, failed: 1, cancelled: 1 });
    expect(s.byPlatform).toEqual({ youtube: 3, tiktok: 1 });
  });

  test('only http(s) links are ever returned', () => {
    expect(safeHttpUrl('https://youtube.com/watch?v=abc')).toBe('https://youtube.com/watch?v=abc');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,<script>')).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(postLink({ result: { output: { url: 'javascript:alert(1)' } } })).toBeNull();
    expect(postLink({ result: { output: { url: 'https://youtube.com/watch?v=abc' } } })).toBe('https://youtube.com/watch?v=abc');
  });
});

describe('SmartVideoScheduler page', () => {
  let page;
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const mount = async () => {
    page = SmartVideoScheduler();
    document.body.appendChild(page);
    await flush();
    return page;
  };
  const clickTab = (name) => [...page.querySelectorAll('button')].find((b) => b.textContent === name).click();

  beforeEach(() => {
    vi.clearAllMocks();
    h.listScheduledPosts.mockResolvedValue([]);
    h.cancelScheduledPost.mockResolvedValue({});
  });
  afterEach(() => { page?.remove(); });

  test('empty calendar offers to schedule a post, which opens the modal in schedule mode', async () => {
    await mount();
    expect(page.textContent).toContain('Nothing scheduled yet');
    const btn = [...page.querySelectorAll('button')].find((b) => b.textContent === 'Schedule a post');
    btn.click();
    expect(h.openSocialPublish).toHaveBeenCalledTimes(1);
    expect(h.openSocialPublish.mock.calls[0][0].mode).toBe('schedule');
  });

  test('the Schedule tab also opens the modal', async () => {
    await mount();
    clickTab('Schedule');
    [...page.querySelectorAll('button')].find((b) => b.textContent === 'Schedule a post').click();
    expect(h.openSocialPublish).toHaveBeenCalledWith(expect.objectContaining({ mode: 'schedule' }));
  });

  test('after a post is scheduled the calendar reloads', async () => {
    await mount();
    clickTab('Schedule');
    [...page.querySelectorAll('button')].find((b) => b.textContent === 'Schedule a post').click();
    h.listScheduledPosts.mockResolvedValue([post()]);
    h.openSocialPublish.mock.calls[0][0].onScheduled({ platform: 'youtube', post: post() });
    await flush();
    expect(page.textContent).toContain('Launch video');
    expect(h.listScheduledPosts).toHaveBeenCalledTimes(2);
  });

  test('lists posts with status, and shows failures and links', async () => {
    h.listScheduledPosts.mockResolvedValue([
      post({ id: 'a' }),
      post({ id: 'b', status: 'failed', error: 'Muapi returned HTTP 400', payload: { title: 'Broken one' } }),
      post({ id: 'c', status: 'published', payload: { title: 'Live one' }, result: { output: { url: 'https://youtube.com/watch?v=abc' } } }),
      post({ id: 'd', status: 'cancelled', payload: { title: 'Cancelled one' } }),
    ]);
    await mount();
    expect(page.textContent).toContain('Launch video');
    expect(page.textContent).toContain('Muapi returned HTTP 400');
    expect(page.querySelector('a[href="https://youtube.com/watch?v=abc"]')).toBeTruthy();
    expect(page.textContent).not.toContain('Cancelled one');
  });

  test('cancelling a scheduled post calls the server and reloads', async () => {
    h.listScheduledPosts.mockResolvedValueOnce([post()]).mockResolvedValue([post({ status: 'cancelled' })]);
    await mount();
    [...page.querySelectorAll('button')].find((b) => b.textContent === 'Cancel').click();
    await flush();
    await flush();
    expect(h.cancelScheduledPost).toHaveBeenCalledWith('p1');
    expect(page.textContent).toContain('Nothing scheduled yet');
  });

  test('only posts that have not started publishing can be cancelled', async () => {
    h.listScheduledPosts.mockResolvedValue([post({ status: 'processing' }), post({ id: 'z', status: 'published' })]);
    await mount();
    expect([...page.querySelectorAll('button')].some((b) => b.textContent === 'Cancel')).toBe(false);
  });

  test('titles and errors are rendered as text, never as HTML', async () => {
    h.listScheduledPosts.mockResolvedValue([
      post({ payload: { title: '<img src=x onerror="window.__pwned=1">' } }),
      post({ id: 'f', status: 'failed', error: '<script>window.__pwned=1</script>' }),
    ]);
    await mount();
    expect(page.querySelector('img')).toBeNull();
    expect(page.querySelector('script')).toBeNull();
    expect(page.textContent).toContain('<img src=x');
    expect(window.__pwned).toBeUndefined();
  });

  test('a load error is shown instead of an empty calendar', async () => {
    h.listScheduledPosts.mockRejectedValue(new Error('Could not load scheduled posts.'));
    await mount();
    expect(page.textContent).toContain('Could not load your schedule');
    expect(page.textContent).not.toContain('Nothing scheduled yet');
  });

  test('analytics reports real counts', async () => {
    h.listScheduledPosts.mockResolvedValue([post(), post({ id: 'b', status: 'published' }), post({ id: 'c', status: 'failed' })]);
    await mount();
    clickTab('Analytics');
    const text = page.textContent;
    expect(text).toMatch(/1\s*Scheduled/);
    expect(text).toMatch(/1\s*Published/);
    expect(text).toMatch(/1\s*Failed/);
    expect(text).toMatch(/3\s*Total/);
  });
});
