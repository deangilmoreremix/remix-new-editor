// "Schedule post" on a finished result: opens the window where the AI writes the caption and hashtags and
// the post is scheduled (src/components/modals/SchedulePostModal.js). Mirrors landingPageAction.js.
import { canMakeLandingPage } from './landingPageAction.js';

/** Pure: whether a result can be posted (an https video or picture, like a landing page). */
export const canSchedulePost = canMakeLandingPage;

/** Open the window for one result: { url, type: 'video'|'image', prompt?, studio? }. */
export async function openSocialPostFor(item, { toast } = {}) {
  if (!canSchedulePost(item)) {
    toast?.('This result has no shareable link yet.');
    return false;
  }
  const { openSchedulePost } = await import('../modals/SchedulePostModal.js');
  openSchedulePost(item);
  return true;
}

/** A button for a studio's result row, copying the studio's own Download button classes (`like`). */
export function createSchedulePostButton({ like, className } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.action = 'schedule-post';
  btn.className = (like && like.className) || className || 'bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5 text-white';
  btn.textContent = 'Schedule post';
  btn.title = 'Write a post with AI and schedule it';
  return btn;
}
