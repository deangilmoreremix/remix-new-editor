// src/components/onboarding/OnboardingPage.js
//
// Full-page onboarding (#/onboarding, no header or side menu), mounted by src/main.js. Loads the saved answers
// (browser + Supabase), shows the flow, saves every answer, and on the way out opens the tool the person chose.
import { mountOnboarding } from './OnboardingFlow.js';
import { isAppDone, isAppSkipped, loadBestAppOnboarding, persistAppOnboarding, saveLocalAppOnboarding, cleanAppOnboarding, seedOutreach } from '../../lib/onboarding/store.js';

export const ONBOARDING_ROUTE = 'onboarding';
const SKIP_DEST = 'image'; // where the app used to open after sign-up
const SESSION_KEY = 'smartvideo-onboarding-shown';

const clerkUser = () => globalThis.window?.Clerk?.user || null;

/** The side-menu route to open when the onboarding ends. */
export function destinationFor(a) {
  return a?.primaryTool || 'apps';
}

// The shell is not mounted on this page, so leaving means a real load of the target route.
function leaveTo(route) {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* storage blocked */ }
  window.location.replace(`${window.location.pathname}#/${route}`);
  window.location.reload();
}

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
  if (redo && initial) initial = cleanAppOnboarding({ ...initial, step: 1, completedAt: null, skippedAt: null });

  let timer = null;
  const save = (a) => persistAppOnboarding(uid, a);
  const flush = async (a) => { clearTimeout(timer); await save(a); };

  return mountOnboarding(host, {
    name: String(user?.firstName || '').trim().slice(0, 40),
    initial,
    onChange: (a) => { saveLocalAppOnboarding(uid, a); clearTimeout(timer); timer = setTimeout(() => save(a), 500); },
    onFinish: async (a) => {
      seedOutreach(uid, a);
      await flush(a);
      leaveTo(destinationFor(a));
    },
    onDismiss: async (a) => {
      await flush(a);
      leaveTo(SKIP_DEST);
    },
  });
}
