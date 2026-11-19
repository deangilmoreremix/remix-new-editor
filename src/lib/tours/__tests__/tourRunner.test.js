// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

let cfg = null;
const drv = { destroy: vi.fn(() => cfg?.onDestroyed?.()), drive: vi.fn(), moveNext: vi.fn(), isLastStep: vi.fn(() => false) };
vi.mock('driver.js', () => ({ driver: (c) => { cfg = c; return drv; } }));
vi.mock('driver.js/dist/driver.css', () => ({}));
vi.mock('../../../styles/tours.css', () => ({}));

const { startTour, stopTour, isTourActive, resolveSteps } = await import('../tourRunner.js');
const { waitForTarget, resolveTarget, isVisible } = await import('../waitFor.js');

const show = (el) => { el.getClientRects = () => [{}]; return el; }; // jsdom has no layout: pretend it is on screen
const add = (html) => { const d = document.createElement('div'); d.innerHTML = html; const el = d.firstElementChild; document.body.appendChild(el); return show(el); };

describe('tour runner', () => {
  beforeEach(() => { document.body.innerHTML = ''; cfg = null; vi.clearAllMocks(); stopTour(); });

  it('skips steps whose target is not on the page, keeps centred steps', async () => {
    add('<button id="a">A</button>');
    const steps = await resolveSteps({ steps: [{ title: 'welcome', target: null }, { title: 'a', target: '#a' }, { title: 'missing', target: '#nope' }] }, { firstWait: 0, otherWait: 0 });
    expect(steps.map((s) => s.title)).toEqual(['welcome', 'a']);
  });
  it('tries fallback selectors in order and ignores hidden elements', () => {
    const hidden = document.createElement('i'); hidden.id = 'h'; document.body.appendChild(hidden); // no layout rects: hidden
    add('<b id="second">x</b>');
    expect(isVisible(hidden)).toBe(false);
    expect(resolveTarget(['#h', '#second'])?.id).toBe('second');
    expect(resolveTarget('((bad selector')).toBeNull();
  });
  it('waits for a late target, and gives up after the timeout', async () => {
    const p = waitForTarget('#late', { timeout: 2000 });
    setTimeout(() => add('<p id="late">hi</p>'), 50);
    expect((await p)?.id).toBe('late');
    expect(await waitForTarget('#never', { timeout: 100 })).toBeNull();
  });
  it('starts driver.js with the resolved steps and reports the finish reason', async () => {
    add('<button id="a">A</button>'); add('<button id="b">B</button>');
    const onFinish = vi.fn();
    const res = await startTour({ id: 't', steps: [{ title: 'A', body: 'first', target: '#a' }, { title: 'B', body: 'second', target: '#b', learnMore: { href: '#/academy', label: 'More' } }] }, { onFinish });
    expect(res).toMatchObject({ started: true, steps: 2 });
    expect(isTourActive()).toBe(true);
    expect(cfg.steps).toHaveLength(2);
    expect(cfg.steps[1].popover.description).toContain('href="#/academy"');
    expect(cfg.popoverClass).toBe('sv-tour');
    expect(drv.drive).toHaveBeenCalled();
    cfg.onDestroyed();
    expect(onFinish).toHaveBeenCalledWith('skipped', expect.objectContaining({ id: 't' }));
    expect(isTourActive()).toBe(false);
  });
  it('reports done on the last step', async () => {
    add('<button id="a">A</button>');
    const onFinish = vi.fn();
    await startTour({ id: 't2', steps: [{ title: 'A', body: '', target: '#a' }] }, { onFinish });
    drv.isLastStep.mockReturnValue(true);
    cfg.onNextClick(null, null, { driver: drv });
    cfg.onDestroyed();
    expect(onFinish).toHaveBeenCalledWith('done', expect.anything());
  });
  it('stops by itself when the route changes', async () => {
    add('<button id="a">A</button>');
    const onFinish = vi.fn();
    await startTour({ id: 't3', steps: [{ title: 'A', body: '', target: '#a' }] }, { onFinish });
    window.dispatchEvent(new Event('hashchange'));
    expect(onFinish).toHaveBeenCalledWith('route', expect.anything());
    expect(isTourActive()).toBe(false);
  });
  it('does not start when no target exists, and never clicks anything', async () => {
    const onFinish = vi.fn();
    const res = await startTour({ id: 't4', steps: [{ title: 'x', body: '', target: '#nothing' }] }, { onFinish });
    expect(res.started).toBe(false);
    expect(onFinish).toHaveBeenCalledWith('empty', expect.anything());
    const clicked = vi.fn();
    const b = add('<button id="c">C</button>'); b.addEventListener('click', clicked);
    await startTour({ id: 't5', steps: [{ title: 'C', body: '', target: '#c' }] });
    cfg.onDestroyed();
    expect(clicked).not.toHaveBeenCalled();
  });
});
