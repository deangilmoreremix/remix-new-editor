// src/lib/outreach/landingPage.js
//
// Video Outreach on the Video Pages designs (src/lib/landingPages, /p/<slug>): a campaign can be
// published onto any of the landing page designs. The page's video is then the campaign's
// personal player (/watch/<id>?embed=1: each contact's spoken greeting, their website behind
// the presenter) instead of one video file, and each contact's link carries both the page's
// tokens (firstname, company, role…) and the player's.


const WATCH_PATH = /^\/watch\/([A-Za-z0-9_-]{8,32})\/?$/;
// Query keys the page passes on to the player (the personal link's contact id and tokens).
const PASS = /^(c|firstName|lastName|fullName|company|email|website|jobTitle|websiteShotUrl|[A-Za-z]+Url(Focus|Lum)?)$/;

/** The campaign id when a page's video URL is an outreach player on this site, else null. */
export function outreachCampaignId(videoUrl, origin = globalThis.location?.origin || '') {
  try {
    const u = new URL(String(videoUrl || ''));
    if (origin && u.origin !== origin) return null;
    return u.pathname.match(WATCH_PATH)?.[1] || null;
  } catch {
    return null;
  }
}

/** The personal player for this page view: /watch/<id>?embed=1 plus the contact's parameters. */
export function outreachPlayerSrc(videoUrl, search = globalThis.location?.search || '', origin = globalThis.location?.origin || '') {
  const id = outreachCampaignId(videoUrl, origin);
  if (!id) return null;
  const out = new URL(`/watch/${id}`, origin || 'https://invalid.local');
  out.searchParams.set('embed', '1');
  for (const [k, v] of new URLSearchParams(search)) if (PASS.test(k) && v) out.searchParams.set(k, v.slice(0, 2048));
  return origin ? out.toString() : `${out.pathname}${out.search}`;
}

/**
 * A contact's link to the landing page: the player's personal link parameters (contact id,
 * tokens, website screenshot) plus the page's own lowercase tokens.
 */
export function landingLink(pageUrl, watchLink, contact = {}) {
  const url = new URL(pageUrl);
  try { for (const [k, v] of new URL(watchLink).searchParams) url.searchParams.set(k, v); } catch { /* no player params */ }
  const tokens = { firstname: contact.firstName, lastname: contact.lastName, company: contact.company, role: contact.jobTitle };
  for (const [k, v] of Object.entries(tokens)) if (v && String(v).trim()) url.searchParams.set(k, String(v).trim().slice(0, 80));
  return url.toString();
}

/**
 * The campaign's copy of one of your own Video Pages pages: its whole config (design, sections,
 * words, buttons, forms) exactly as you made it. Nothing is added or rewritten; only the page's
 * video differs (the campaign player, set on the page row), and any {{firstname}}-style tokens
 * you wrote fill in from each contact's link.
 */
export function campaignPageConfig(config) {
  return JSON.parse(JSON.stringify(config && typeof config === 'object' ? config : {}));
}

/** Your own pages to choose from: the ones you made in Video Pages, not the copies campaigns made. */
export const ownPages = (rows) => (Array.isArray(rows) ? rows : []).filter((r) => r?.id && r?.source?.kind !== 'outreach');

/** A page row as a picker option: its id, title and when it was last edited. */
export const pageOption = (r) => ({ id: r.id, title: String(r.title || 'Untitled page').slice(0, 120), updatedAt: r.updated_at || r.created_at || null });
