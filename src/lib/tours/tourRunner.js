// src/lib/tours/tourRunner.js
//
// Runs one guided tour (a definition from src/lib/tours/defs) with driver.js: spotlight on a real control, a short
// popover, Next / Back / Skip. Targets are resolved when the tour starts and steps whose target is not on the
// page are skipped, so a studio that has changed never leaves a dead step. A tour only highlights: it never
// clicks anything. It stops by itself when the route changes.
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '../../styles/tours.css';
import { resolveTarget, waitForTarget } from './waitFor.js';

let active = null; // { id, controller }

export const isTourActive = () => !!active;
export const activeTourId = () => active?.id || null;

const isMobile = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches;
const sidebarEl = () => document.querySelector('aside');
const sidebarOpen = () => !!sidebarEl()?.classList.contains('fixed');
const toggleSidebar = () => document.querySelector('[aria-label="Toggle navigation menu"]')?.click();
// On phones the side menu is hidden until the hamburger is pressed.
const setSidebar = (open) => { if (isMobile() && sidebarOpen() !== open) toggleSidebar(); };

/** Resolves a definition's steps to the ones whose target exists now. Exported for tests. */
export async function resolveSteps(def, { firstWait = 6000, otherWait = 400, signal = null } = {}) {
  const out = [];
  for (let i = 0; i < def.steps.length; i += 1) {
    const s = def.steps[i];
    if (signal?.aborted) return out;
    if (!s.target) { out.push({ ...s, el: null }); continue; } // a centred step with no target
    if (s.sidebar) setSidebar(true);
    const el = await waitForTarget(s.target, { timeout: out.length === 0 ? firstWait : (s.wait ?? otherWait), signal });
    if (el) out.push({ ...s, el });
  }
  return out;
}

/**
 * startTour(def, { onFinish(reason), replay }) -> Promise<{ started, steps, stop }>
 * reason is 'done' (last step), 'skipped' (closed early), 'off' (Don't show tours again) or 'route' (left the page).
 */
export async function startTour(def, { onFinish = () => {}, replay = false } = {}) {
  if (!def?.steps?.length) return { started: false, steps: 0, stop() {} };
  stopTour('replaced');
  const abort = new AbortController();
  let finished = false;
  let drv = null;
  let lastReason = 'skipped'; // why driver.js was closed; set before it is destroyed
  const finish = (reason) => {
    if (finished) return;
    finished = true;
    window.removeEventListener('hashchange', onRoute);
    document.body.classList.remove('sv-tour-active');
    if (active?.id === def.id) active = null;
    if (isMobile()) setSidebar(false);
    try { onFinish(reason, def); } catch { /* the caller's problem must not break the page */ }
  };
  const onRoute = () => { abort.abort(); lastReason = 'route'; try { drv?.destroy(); } catch { /* ignore */ } finish('route'); };
  window.addEventListener('hashchange', onRoute);
  const controller = { stop: (reason = 'skipped') => { abort.abort(); lastReason = reason; try { drv?.destroy(); } catch { /* ignore */ } finish(reason); } };
  active = { id: def.id, controller };

  const steps = await resolveSteps(def, { signal: abort.signal, firstWait: def.firstWait ?? 6000 });
  if (finished) return { started: false, steps: 0, stop() {} };
  if (!steps.length) { finish('empty'); return { started: false, steps: 0, stop() {} }; }

  drv = driver({
    showProgress: steps.length > 1,
    progressText: '{{current}} of {{total}}',
    allowClose: true,
    overlayColor: '#000',
    overlayOpacity: 0.72,
    stagePadding: 6,
    stageRadius: 12,
    popoverClass: 'sv-tour',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    smoothScroll: true,
    steps: steps.map((s) => ({
      element: s.el || undefined,
      popover: {
        title: s.title,
        description: `${s.body || ''}${s.learnMore ? ` <a href="${s.learnMore.href}" data-tour-learn>${s.learnMore.label || 'Learn more'}</a>` : ''}`,
        side: s.side || (s.el ? 'bottom' : 'over'),
        align: s.align || 'start',
      },
      onHighlightStarted: () => { if (s.sidebar) setSidebar(true); else if (isMobile()) setSidebar(false); },
    })),
    onNextClick: (_el, _step, { driver: d }) => { if (d.isLastStep()) lastReason = 'done'; d.moveNext(); },
    onPopoverRender: (popover) => {
      if (replay) return;
      const off = document.createElement('button');
      off.type = 'button';
      off.className = 'sv-tour-off';
      off.setAttribute('data-tour-off', '');
      off.textContent = "Don't show tours again";
      off.addEventListener('click', () => { lastReason = 'off'; drv.destroy(); });
      popover.footer.after(off);
    },
    onDestroyed: () => finish(lastReason),
  });
  document.body.classList.add('sv-tour-active');
  drv.drive();
  return { started: true, steps: steps.length, stop: controller.stop };
}

/** Ends the running tour (if any). */
export function stopTour(reason = 'skipped') {
  const a = active;
  if (a) a.controller.stop(reason);
}

export { resolveTarget };
