// src/lib/outreach/campaignStats.js
//
// Campaign numbers from what fetchVideoStats really returns, per prospect: views, plays, completes, ctaClicks, leads and
// progress (the furthest point reached, 0-100). Nothing is estimated: a prospect counts only when the page recorded it.

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const QUARTILES = Object.freeze([25, 50, 75, 100]);

/**
 * @param {object[]} rows  one per prospect (a row without a contactId is a visit nobody was named for)
 * @returns {{ watched:number, views:number, clicks:number, leads:number, finished:number, opened:number,
 *   avgProgress:number, hasProgress:boolean, reach:Record<number, number> }}
 * `reach[25]` is how many prospects got at least 25% of the way through, and so on; `reach[100]` is those who finished.
 */
export function summarizeCampaign(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const named = list.filter((r) => r?.contactId);
  const watched = named.filter((r) => n(r.plays) > 0);
  const reach = Object.fromEntries(QUARTILES.map((q) => [q, named.filter((r) => (q === 100 ? n(r.completes) > 0 || n(r.progress) >= 100 : n(r.progress) >= q || n(r.completes) > 0)).length]));
  const progressOf = (r) => (n(r.completes) > 0 ? 100 : Math.max(0, Math.min(100, n(r.progress))));
  return {
    watched: watched.length,
    views: list.reduce((a, r) => a + n(r?.views), 0),
    clicks: list.reduce((a, r) => a + n(r?.ctaClicks), 0),
    leads: list.reduce((a, r) => a + n(r?.leads), 0),
    finished: reach[100],
    opened: named.filter((r) => n(r.views) > 0).length,
    avgProgress: watched.length ? Math.round(watched.reduce((a, r) => a + progressOf(r), 0) / watched.length) : 0,
    hasProgress: named.some((r) => n(r.progress) > 0 || n(r.completes) > 0),
    reach,
  };
}

/** Add several campaigns' summaries together (averages are re-weighted by watchers). */
export function combineSummaries(list) {
  const items = (Array.isArray(list) ? list : []).filter(Boolean);
  const sum = (k) => items.reduce((a, s) => a + n(s[k]), 0);
  const watched = sum('watched');
  return {
    watched, views: sum('views'), clicks: sum('clicks'), leads: sum('leads'), finished: sum('finished'), opened: sum('opened'),
    avgProgress: watched ? Math.round(items.reduce((a, s) => a + n(s.avgProgress) * n(s.watched), 0) / watched) : 0,
    hasProgress: items.some((s) => s.hasProgress),
    reach: Object.fromEntries(QUARTILES.map((q) => [q, items.reduce((a, s) => a + n(s.reach?.[q]), 0)])),
  };
}
