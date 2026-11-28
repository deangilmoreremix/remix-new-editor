// src/lib/outreach/followUp.js
//
// Who to follow up with first (requirement 40). A transparent score from signals the hosted page really recorded:
// a form lead, a button click, finishing the video, how far they watched, plays and views. Nothing is guessed:
// every point comes with the reason it was given, and a prospect with no recorded activity scores 0.
//
// stats per prospect (from fetchVideoStats): { views, plays, completes, ctaClicks, progress (0-100), leads?, lastSeen }
// (`lastAt` is accepted as an alias.)
const lastOf = (s) => Date.parse(s?.lastSeen || s?.lastAt || '');

export const WEIGHTS = Object.freeze({ lead: 60, cta: 50, complete: 25, progress75: 15, play: 10, view: 5, recent: 10 });
const DAY = 24 * 3600 * 1000;

/** @returns {{ score:number, reasons:string[] }} */
export function scoreProspect(st, { now = Date.now() } = {}) {
  const s = st || {};
  const reasons = [];
  let score = 0;
  const add = (points, why) => { score += points; reasons.push(why); };
  if ((s.leads || 0) > 0) add(WEIGHTS.lead, 'Sent the form');
  if ((s.ctaClicks || 0) > 0) add(WEIGHTS.cta, 'Clicked the button');
  if ((s.completes || 0) > 0) add(WEIGHTS.complete, 'Watched to the end');
  else if ((s.progress || 0) >= 75) add(WEIGHTS.progress75, 'Watched at least 75%');
  if ((s.plays || 0) > 0) add(WEIGHTS.play, 'Played the video');
  else if ((s.views || 0) > 0) add(WEIGHTS.view, 'Opened the page');
  const last = lastOf(s);
  if (score > 0 && Number.isFinite(last) && now - last <= DAY && now >= last) add(WEIGHTS.recent, 'Active in the last day');
  if (!reasons.length) reasons.push('No activity recorded yet');
  return { score, reasons };
}

/**
 * Prospects in follow-up order: highest score first, then most recent activity, then the original order.
 * @param {{ contactId:string, name?:string }[]} links
 * @param {Record<string, object>|null} statsByContact
 * @param {{ now?:number, followedUp?:Set<string>|string[] }} [opts]  prospects you already followed up sink to the end of their score
 */
export function rankProspects(links, statsByContact, { now = Date.now(), followedUp = [] } = {}) {
  const done = new Set(followedUp);
  return (Array.isArray(links) ? links : [])
    .map((l, order) => ({ link: l, order, followedUp: done.has(l.contactId), ...scoreProspect(statsByContact?.[l.contactId], { now }), lastAt: lastOf(statsByContact?.[l.contactId]) || 0 }))
    .sort((a, b) => (a.followedUp - b.followedUp) || (b.score - a.score) || (b.lastAt - a.lastAt) || (a.order - b.order));
}
