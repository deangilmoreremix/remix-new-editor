// src/components/onboarding/OnboardingPage.js
//
// Full-page onboarding (#/onboarding, no header or side menu), mounted by src/main.js. Loads the saved answers
// (browser + Supabase), shows the flow, saves every answer, and on the way out opens the tool the person chose.
import { mountOnboarding } from './OnboardingFlow.js';
import { analytics } from '../../lib/analytics.js';
import { isAppDone, isAppSkipped, loadBestAppOnboarding, persistAppOnboarding, saveLocalAppOnboarding, cleanAppOnboarding, seedOutreach } from '../../lib/onboarding/store.js';

export const ONBOARDING_ROUTE = 'onboarding';
const SKIP_DEST = 'image'; // where the app used to open after sign-up
const SESSION_KEY = 'smartvideo-onboarding-shown';

const clerkUser = () => globalThis.window?.Clerk?.user || null;

/** The side-menu route to open when the onboarding ends. */
export function destinationFor(a) {
  return a?.primaryTool || 'apps';
}

// The shell is not mounted on this page, so leaving means a real load of the target route. Other query
// parameters (utm tags, ?dev) are kept; only the redo flag is dropped.
function leaveTo(route) {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* storage blocked */ }
  const params = new URLSearchParams(window.location.search);
  params.delete('redo');
  const query = params.toString();
  const search = query ? `?${query}` : '';
  window.location.replace(`${window.location.pathname}${search}#/${route}`);
  if (search === window.location.search) window.location.reload(); // only the hash differs: no navigation happens by itself
}

// Product analytics (no company, website or other answers that identify the person; only the choices).
const track = (type, props) => { try { analytics.track(type, props); } catch { /* analytics must never block onboarding */ } };

/**
 * mountOnboardingPage(host, { redo }) -> Promise<{ destroy }>
 * redo = true restarts a finished or skipped onboarding (answers are kept as defaults).
 */
export async function mountOnboardingPage(host, { redo = false } = {}) {
  const user = clerkUser();
  const uid = user?.id || '';
  let initial = await loadBestAppOnboarding(uid);
  // Already finished or skipped (an old sign-up link, a bookmark): go straight to the app, unless redoing.
  if (!redo && (isAppDone(initial) || isAppSkipped(initial))) {
    leaveTo(isAppDone(initial) ? destinationFor(initial) : SKIP_DEST);
    return { destroy() {} };
  }
  // Redo starts again at step 1 with the old answers as defaults. The earlier completion is kept until the new run
  // finishes, so abandoning a redo does not bring the onboarding back as if it were never done.
  if (redo && initial) initial = cleanAppOnboarding({ ...initial, step: 1 });
  track('onboarding_start', { redo, resumedAtStep: initial?.step || 1 });
  let lastStep = initial?.step || 1;

  let timer = null;
  const save = (a) => persistAppOnboarding(uid, a);
  const flush = async (a) => { clearTimeout(timer); await save(a); };

  return mountOnboarding(host, {
    name: String(user?.firstName || '').trim().slice(0, 40),
    initial,
    onChange: (a) => {
      if (a.step !== lastStep) { lastStep = a.step; track('onboarding_step', { step: a.step }); }
      saveLocalAppOnboarding(uid, a); clearTimeout(timer); timer = setTimeout(() => save(a), 500);
    },
    onFinish: async (a) => {
      track('onboarding_complete', { goal: a.goal, team: a.team, volume: a.volume, heard: a.heard, videoTypes: a.videoTypes, tools: a.tools, primaryTool: a.primaryTool });
      seedOutreach(uid, a);
      await flush(a);
      leaveTo(destinationFor(a));
    },
    onDismiss: async (a) => {
      track('onboarding_skip', { atStep: a.step });
      await flush(a);
      leaveTo(SKIP_DEST);
    },
  });
}
