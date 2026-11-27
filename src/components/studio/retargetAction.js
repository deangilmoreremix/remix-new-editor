// "Retarget" on a finished video result: make it a tracked video, turn Retarget on for it, and open its Retarget view in Analytics.
// Sits next to "Create landing page" (studio/landingPageAction.js) in the studios' result rows, the results gallery and the media preview.
import { canMakeLandingPage } from './landingPageAction.js';

/** sessionStorage key that tells the Analytics overview which project's Retarget view to open (like `remix_open_projects` for the alerts). */
export const OPEN_RETARGET_PROJECT_KEY = 'remix_open_retarget_project';

/** Pure: a finished https video (pictures and audio have no viewers to retarget). */
export const canRetarget = (item) => canMakeLandingPage(item) && item.type === 'video';

/** The id in a /watch/<id> or /v/... address, or null. */
export function watchIdOf(watchUrl) {
  try {
    const parts = new URL(watchUrl).pathname.split('/').filter(Boolean);
    return parts[0] === 'watch' && parts[1] ? decodeURIComponent(parts[1]) : null;
  } catch { return null; }
}

/**
 * @param {object} item { url, type:'video', prompt?, title?, studio? }
 * @param {object} o { toast(message), deps (tests): { signedIn, getLink, getClient, enable, navigate, storage } }
 * @returns {Promise<boolean>} whether the Retarget view is being opened
 */
export async function retargetFor(item, { toast: say, deps = {} } = {}) {
  // Studios that have no toast of their own still tell the person what is happening.
  const toast = say || ((m) => { import('../../lib/loading.js').then((l) => l.showToast(m, 'info')).catch(() => {}); });
  if (!canRetarget(item)) { toast?.('Retarget needs a finished video with a link.'); return false; }
  if (!(deps.signedIn ?? !!globalThis.Clerk?.user)) { toast?.('Sign in to use Retarget. It keeps your viewers’ data in your account.'); return false; }
  try {
    toast?.('Setting up Retarget…');
    const getLink = deps.getLink || (await import('../../lib/resultActions/getLink.js')).getLink;
    const res = await getLink({ url: item.url, kind: 'video', title: item.prompt || item.title || 'AI video' });
    const videoId = watchIdOf(res?.watchUrl);
    if (!videoId) { toast?.(res?.pageError || 'Could not make a page for this video yet. Try Get link first.'); return false; }
    const client = await (deps.getClient || (async () => (await import('../../lib/resultActions/ownerClient.js')).getPublishOwnerClient()))();
    const enable = deps.enable || (await import('../../cinegen/lib/leads/project-link.ts')).enableRetargetForVideo;
    const projectRowId = await enable(client, videoId);
    try { (deps.storage || globalThis.sessionStorage).setItem(OPEN_RETARGET_PROJECT_KEY, projectRowId); } catch { /* the overview still opens */ }
    const navigate = deps.navigate || (await import('../../lib/router.js')).navigate;
    navigate('timeline');
    return true;
  } catch (err) {
    toast?.(err?.message || 'Could not set up Retarget. Try again.');
    return false;
  }
}

/**
 * A button for a studio's result row. Pass `like` (the studio's own Download button or link) and the new button copies its classes.
 * Set `btn.onclick` where the result is shown, or pass `getItem` (read when it is clicked).
 */
export function createRetargetButton({ getItem, className, like, toast } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.action = 'retarget';
  btn.className = (like && like.className) || className || 'bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5 text-white';
  btn.textContent = 'Retarget';
  btn.title = 'Track viewers of this video and get follow-up suggestions';
  if (getItem) btn.onclick = () => { void retargetFor(getItem(), { toast }); };
  return btn;
}
