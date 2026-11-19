// src/lib/tours/autoStart.js
//
// Decides when a guided tour starts. On every page change (the `app:route-ready` event from main.js) it shows, in
// order, the app-shell tour (once) and the page's own tour (once per studio), but only when:
//   - tours are not turned off, and the person has not already seen that tour (at its current version);
//   - nothing modal is open (the API-key popup, Settings, a welcome overlay): it waits for them to close;
//   - the person is still on the page when it is ready.
// The header "?" button and Settings replay tours on demand (`tour:replay`), ignoring "seen".
import { shellTour, tourForPage, TOURS, TOUR_LIST, routeId } from './registry.js';
import { loadBestTours, markTourSeen, setToursDisabled, resetTours, hasSeen, toursDisabled } from './tourState.js';
import { blockingOverlayOpen } from './waitFor.js';

const defaultDeps = () => ({
  userId: () => globalThis.window?.Clerk?.user?.id || '',
  loadState: loadBestTours, markSeen: markTourSeen, setDisabled: setToursDisabled, reset: resetTours,
  runner: () => import('./tourRunner.js'),
  blocked: blockingOverlayOpen,
});

/**
 * initTours({ getPage, ...deps }) -> { schedule, replay, start, list, destroy }
 * `getPage` returns the current route (src/lib/router.js getCurrentPage).
 */
export function initTours({ getPage = () => '', pollMs = 700, maxWaitMs = 40000, ...overrides } = {}) {
  const deps = { ...defaultDeps(), ...overrides };
  let state = null;
  let token = 0; // a newer page change cancels an older wait
  const load = async () => { if (!state) state = await deps.loadState(deps.userId()); return state; };

  async function run(def, { replay = false } = {}) {
    const { startTour } = await deps.runner();
    const uid = deps.userId();
    return startTour(def, {
      replay,
      onFinish: async (reason) => {
        if (replay) return;
        if (reason === 'done' || reason === 'skipped') state = await deps.markSeen(uid, def.id, def.version, state);
        if (reason === 'off') { state = await deps.markSeen(uid, def.id, def.version, state); state = await deps.setDisabled(uid, true, state); }
      },
    });
  }

  async function waitUntilClear(page, my) {
    const t0 = Date.now();
    while (deps.blocked()) {
      if (my !== token || routeId(getPage()) !== routeId(page) || Date.now() - t0 > maxWaitMs) return false;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    return my === token && routeId(getPage()) === routeId(page);
  }

  /** Called on each page change. Resolves when the tours for that page have run (or were skipped). */
  async function schedule(page) {
    const my = ++token;
    const s = await load();
    if (my !== token || toursDisabled(s)) return;
    const queue = [];
    const shell = shellTour();
    if (shell && !hasSeen(s, shell.id, shell.version)) queue.push(shell);
    const pageTour = tourForPage(page);
    if (pageTour && !hasSeen(s, pageTour.id, pageTour.version)) queue.push(pageTour);
    for (const def of queue) {
      if (!(await waitUntilClear(page, my))) return;
      const res = await run(def);
      if (!res.started) continue; // nothing to point at: try the next tour
      // Wait for this tour to end before the next one starts.
      await new Promise((resolve) => {
        const iv = setInterval(async () => {
          const { isTourActive } = await deps.runner();
          if (!isTourActive()) { clearInterval(iv); resolve(); }
        }, 300);
      });
      if (my !== token || routeId(getPage()) !== routeId(page) || toursDisabled(state)) return;
    }
  }

  /** Replay on demand: the current page's tour, or the app tour when the page has none. */
  async function replay(page = getPage()) {
    const def = tourForPage(page) || shellTour();
    if (!def) return null;
    return run(def, { replay: true });
  }

  const onReady = (e) => { schedule(e?.detail?.page ?? getPage()); };
  const onReplay = (e) => { replay(e?.detail?.page || undefined); };
  const onReplayShell = () => { const d = shellTour(); if (d) run(d, { replay: true }); };
  const onChanged = () => { state = null; };
  if (typeof window !== 'undefined') {
    window.addEventListener('app:route-ready', onReady);
    window.addEventListener('tour:replay', onReplay);
    window.addEventListener('tour:replay-shell', onReplayShell);
    window.addEventListener('tour:state-changed', onChanged);
  }
  const api = {
    schedule, replay,
    start: (id, opts) => (TOURS[id] ? run(TOURS[id], { replay: true, ...opts }) : Promise.resolve(null)),
    list: () => TOUR_LIST.map((t) => ({ id: t.id, route: t.route, version: t.version, steps: t.steps.length })),
    destroy() {
      if (typeof window === 'undefined') return;
      window.removeEventListener('app:route-ready', onReady);
      window.removeEventListener('tour:replay', onReplay);
      window.removeEventListener('tour:replay-shell', onReplayShell);
      window.removeEventListener('tour:state-changed', onChanged);
    },
  };
  return api;
}
