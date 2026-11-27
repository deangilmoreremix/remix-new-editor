// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openSchedulePost } from '../SchedulePostModal.js';

const flush = () => new Promise((r) => setTimeout(r, 0));
const ITEM = { url: 'https://cdn.test/r.png', type: 'image', prompt: 'a red car', studio: 'image' };
const open = (deps = {}) => {
  const d = { write: vi.fn().mockResolvedValue({ caption: 'Fresh wheels', hashtags: ['car', 'new'] }), save: vi.fn().mockResolvedValue({ saved: 'cloud' }), toast: vi.fn(), ...deps };
  const overlay = openSchedulePost(ITEM, d);
  return { overlay, d, q: (s) => overlay.querySelector(s), err: () => overlay.querySelector('[role="alert"]').textContent };
};
const type = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
beforeEach(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); document.body.innerHTML = ''; document.body.style.overflow = ''; });

describe('Schedule post window', () => {
  it('shows the result, the platforms and the topic from the studio prompt', () => {
    const { overlay, q } = open();
    expect(q('img').getAttribute('src')).toBe(ITEM.url);
    expect(overlay.querySelectorAll('[data-platform]')).toHaveLength(6);
    expect(q('[data-platform="instagram"]').getAttribute('aria-pressed')).toBe('true');
    expect(q('input[aria-label="What the post is about"]').value).toBe('a red car');
  });

  it('Write with AI fills the caption and hashtags for the picked platforms', async () => {
    const { d, q } = open();
    q('[data-platform="twitter"]').click();
    q('[data-action="write-with-ai"]').click();
    await flush();
    expect(d.write).toHaveBeenCalledWith(expect.objectContaining({ platforms: ['instagram', 'twitter'], tone: 'Friendly', language: 'English', media: { type: 'image', prompt: 'a red car' } }), expect.any(Object));
    expect(q('textarea').value).toBe('Fresh wheels');
    expect(q('input[aria-label="Hashtags"]').value).toBe('#car #new');
  });

  it('shows a plain message when the AI fails, and keeps what was typed', async () => {
    const { q, err } = open({ write: vi.fn().mockRejectedValue(new Error('The AI reply was not a usable post. Try again.')) });
    type(q('textarea'), 'mine');
    q('[data-action="write-with-ai"]').click();
    await flush();
    expect(err()).toMatch(/usable post/);
    expect(q('textarea').value).toBe('mine');
  });

  it('will not save without a platform, a caption, or (for a schedule) a future time', async () => {
    const { q, err, d } = open();
    q('[data-action="schedule"]').click(); await flush();
    expect(err()).toMatch(/caption/);
    type(q('textarea'), 'Hello');
    q('[data-platform="instagram"]').click();
    q('[data-action="schedule"]').click(); await flush();
    expect(err()).toMatch(/platform/);
    q('[data-platform="instagram"]').click();
    q('[data-when="custom"]').click();
    q('[data-action="schedule"]').click(); await flush();
    expect(err()).toMatch(/date and time/);
    expect(d.save).not.toHaveBeenCalled();
  });

  it('schedules the post, tells the person where it was saved, and closes', async () => {
    const { overlay, q, d } = open();
    type(q('textarea'), 'Hello');
    type(q('input[aria-label="Hashtags"]'), '#a #b');
    q('[data-action="schedule"]').click(); await flush();
    expect(d.save).toHaveBeenCalledWith(expect.objectContaining({ mediaUrl: ITEM.url, mediaType: 'image', studio: 'image', platforms: ['instagram'], caption: 'Hello', hashtags: ['a', 'b'], status: 'scheduled', scheduledFor: expect.any(Date) }));
    expect(d.toast).toHaveBeenCalledWith(expect.stringMatching(/scheduled for .*saved to your queue/i), 'success');
    expect(overlay.isConnected).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('saves a draft without a time, and says when it only stayed in this browser', async () => {
    const { q, d } = open({ save: vi.fn().mockResolvedValue({ saved: 'browser' }) });
    type(q('textarea'), 'Hello');
    q('[data-action="save-draft"]').click(); await flush();
    expect(d.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft', scheduledFor: null }));
    expect(d.toast).toHaveBeenCalledWith(expect.stringMatching(/in this browser/), 'success');
  });

  it('closes on Escape and on the close button, and opening again replaces the window', () => {
    const a = open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(a.overlay.isConnected).toBe(false);
    const b = open();
    const c = open();
    expect(b.overlay.isConnected).toBe(false);
    expect(document.querySelectorAll('[data-schedule-post]')).toHaveLength(1);
    c.q('[aria-label="Close"]').click();
    expect(c.overlay.isConnected).toBe(false);
  });
});
