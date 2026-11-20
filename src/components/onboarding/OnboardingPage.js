// src/components/onboarding/OnboardingPage.js
//
// Full-page onboarding (#/onboarding, no header or side menu), mounted by src/main.js. Loads the saved answers
// (browser + Supabase), shows the flow, saves every answer, and on the way out opens the tool the person chose.
import { mountOnboarding } from './OnboardingFlow.js';
import { stageBrandPrefill } from '../../lib/onboarding/brandPrefill.js';
import { stageSamplePrompt } from '../../lib/onboarding/samplePrompt.js';
import { telemetry } from '../../lib/onboarding/telemetry.js';
import { isAppDone, isAppSkipped, loadBestAppOnboarding, persistAppOnboarding, saveLocalAppOnboarding, cleanAppOnboarding, seedOutreach } from '../../lib/onboarding/store.js';

export const ONBOARDING_ROUTE = 'onboarding';
const SKIP_DEST = 'image'; // where the app used to open after sign-up
const SESSION_KEY = 'smartvideo-onboarding-shown';

const clerkUser = () => globalThis.window?.Clerk?.user || null;

/** The side-menu route to open when the onboarding ends. */
export function destinationFor(a) {
  return a?.primaryTool || 'apps';
}

// Funnel events (src/lib/onboarding/telemetry.js): choice ids and booleans only, never company, website or job title.
const track = (event, o) => { try { telemetry.track(event, o); } catch { /* reporting must never block onboarding */ } };
// Waits (briefly) for the queued events to be sent: the reload that follows would otherwise lose the last ones.
const flushEvents = () => Promise.race([telemetry.flush(), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});

// The shell is not mounted on this page, so leaving means a real load of the target route. Other query
// parameters (utm tags, ?dev) are kept; only the redo flag is dropped.
function leaveTo(route) {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* storage blocked */ }
  // The key popup would sit on top of the studio they are about to open; this screen already offered the key.
  try { sessionStorage.setItem('setup_popup_shown', '1'); } catch { /* storage blocked */ }
  const params = new URLSearchParams(window.location.search);
  params.delete('redo');
  const query = params.toString();
  const search = query ? `?${query}` : '';
  window.location.replace(`${window.location.pathname}${search}#/${route}`);
  if (search === window.location.search) window.location.reload(); // only the hash differs: no navigation happens by itself
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
  // Redo starts again at step 1 with the old answers as defaults. The earlier completion is kept until the new run
  // finishes, so abandoning a redo does not bring the onboarding back as if it were never done.
  if (redo && initial) initial = cleanAppOnboarding({ ...initial, step: 1 });
  track('start', { props: { redo, resumedAtStep: initial?.step || 1 } });

  let timer = null;
  const save = (a) => persistAppOnboarding(uid, a);
  const flush = async (a) => { clearTimeout(timer); await save(a); };

  return mountOnboarding(host, {
    name: String(user?.firstName || '').trim().slice(0, 40),
    initial,
    onChange: (a) => { saveLocalAppOnboarding(uid, a); clearTimeout(timer); timer = setTimeout(() => save(a), 500); },
    onEvent: (event, { step, sub, props } = {}) => track(event, { step, sub, props }),
    onFinish: async (a) => {
      track('complete', {
        props: {
          goal: a.goal, team: a.team, volume: a.volume, heard: a.heard, types: a.videoTypes, tools: a.tools, primary: a.primaryTool,
          company: !!a.company, website: !!a.website, jobTitle: !!a.jobTitle,
        },
      });
      seedOutreach(uid, a);
      try { stageBrandPrefill(a.website); } catch { /* optional */ }
      try { stageSamplePrompt(destinationFor(a), a); } catch { /* a missing sample must never block leaving */ }
      await Promise.all([flush(a), flushEvents()]);
      leaveTo(destinationFor(a));
    },
    // The person left early (the Academy button): remember it, then open where they asked to go.
    onDismiss: async (a, destination) => {
      track('leave', { props: { to: destination === 'academy' ? 'academy' : 'image', atStep: a.step } });
      await Promise.all([flush(a), flushEvents()]);
      leaveTo(destination || SKIP_DEST);
    },
  });
}
