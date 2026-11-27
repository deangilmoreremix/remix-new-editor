// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const modal = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('../../modals/SchedulePostModal.js', () => ({ openSchedulePost: modal.open }));
vi.mock('../../../lib/landingPages/pickerModal.js', () => ({ openLandingPagePicker: vi.fn(), toPickerVideo: (v) => v }));
import { attachSchedule, scanSchedule, mountSchedulePostButtons } from '../socialPostAttach.js';
import { scan as scanLanding } from '../landingPageAttach.js';

const flush = () => new Promise((r) => setTimeout(r, 0));
const html = (s) => { const d = document.createElement('div'); d.innerHTML = s; document.body.appendChild(d); return d; };
const sp = (root) => root.querySelectorAll('[data-action="schedule-post"]');
const lp = (root) => root.querySelectorAll('[data-action="create-landing-page"]');
beforeEach(() => { document.body.innerHTML = ''; modal.open.mockClear(); });

describe('which links get the button', () => {
  it('https images and videos only', () => {
    const root = html('<a href="https://cdn.test/a.mp4" download class="x">Download</a><a href="https://cdn.test/a.mp3" download class="x">Audio</a><a href="blob:https://x/1" download>Blob</a><a href="https://cdn.test/s.csv" download>CSV</a>');
    scanSchedule(root);
    expect(sp(root)).toHaveLength(1);
    expect(sp(root)[0].previousElementSibling.getAttribute('href')).toBe('https://cdn.test/a.mp4');
  });
  it('copies the studio\'s own Download style and sits right after the link', () => {
    const root = html('<div class="flex"><a href="https://cdn.test/r.png" download class="flex-1 btn-secondary-modern py-2.5 rounded-xl">Download</a></div>');
    scanSchedule(root);
    expect(sp(root)[0].className).toBe('flex-1 btn-secondary-modern py-2.5 rounded-xl');
    expect(sp(root)[0].textContent).toBe('Schedule post');
  });
  it('skips links inside its own window and anything marked data-sp-skip', () => {
    const root = html('<div data-schedule-post><a href="https://cdn.test/a.png" download>x</a></div><div data-sp-skip><a href="https://cdn.test/b.png" download>y</a></div>');
    scanSchedule(root);
    expect(sp(root)).toHaveLength(0);
  });
});

describe('together with "Create landing page"', () => {
  it('both buttons sit after the link in the same order, and neither is ever added twice, whichever scans first', () => {
    for (const order of [['landing', 'schedule'], ['schedule', 'landing']]) {
      document.body.innerHTML = '';
      const root = html('<a href="https://cdn.test/r.png" download class="x">Download</a>');
      for (const which of order) { which === 'landing' ? scanLanding(root) : scanSchedule(root); }
      for (let i = 0; i < 2; i++) { scanLanding(root); scanSchedule(root); }   // observers fire again on every change
      expect(lp(root)).toHaveLength(1);
      expect(sp(root)).toHaveLength(1);
      const after = [...root.querySelectorAll('[data-action]')].map((b) => b.dataset.action);
      expect(after).toEqual(['create-landing-page', 'schedule-post']);
      expect(root.querySelector('a').nextElementSibling.dataset.action).toBe('create-landing-page');
    }
  });
});

describe('behaviour', () => {
  it('opens the window with that result and does not download', async () => {
    const root = html('<a href="https://cdn.test/r.png" download class="x">Download</a>');
    scanSchedule(root, { studio: 'character' });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    sp(root)[0].dispatchEvent(click);
    await flush();
    expect(click.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(modal.open).toHaveBeenCalledWith({ url: 'https://cdn.test/r.png', type: 'image', studio: 'character' }));
  });
  it('hides its button when the link stops being a picture or video, and shows it again', () => {
    const root = html('<a href="https://cdn.test/r.png" download class="x">Download</a>');
    const a = root.querySelector('a');
    const b = attachSchedule(a);
    a.setAttribute('href', 'https://cdn.test/r.zip');
    expect(attachSchedule(a)).toBeNull();
    expect(b.hidden).toBe(true);
    a.setAttribute('href', 'https://cdn.test/r.mp4');
    expect(attachSchedule(a)).toBe(b);
    expect(b.hidden).toBe(false);
  });
  it('picks up links added later', async () => {
    const { stop } = mountSchedulePostButtons();
    const root = html('<a href="https://cdn.test/late.mp4" download class="x">Download</a>');
    await vi.waitFor(() => expect(sp(root)).toHaveLength(1));
    stop();
  });
});
