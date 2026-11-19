// [remix] How many viewers saw each form and how many signed up (conversion), from the heatmap analytics the owner can already read.
// `video_heat_cta_stats` is owner-only and privacy-thresholded: numbers below the minimum cohort are withheld, never guessed.

export interface FormStat { seen: number | null; signedUp: number | null; rate: number | null; hidden: boolean }
export interface FormStats { minCohort: number; byKey: Record<string, FormStat> }

interface CtaRow { cta_key?: string | null; suppressed?: boolean; impressions?: number | null; clicks?: number | null; ctr?: number | null }

/** The RPC's answer -> one entry per form key (a Lead Generator's overlay id, or "list-builder"). Bad input gives no stats. */
export function parseFormStats(result: unknown): FormStats {
  const r = (result && typeof result === 'object' ? result : {}) as { min_cohort?: number; ctas?: CtaRow[] };
  const byKey: Record<string, FormStat> = {};
  (Array.isArray(r.ctas) ? r.ctas : []).forEach((c) => {
    if (!c || typeof c.cta_key !== 'string' || !c.cta_key) return;
    const seen = typeof c.impressions === 'number' ? c.impressions : null;
    const signedUp = typeof c.clicks === 'number' ? c.clicks : null;
    const rate = typeof c.ctr === 'number' ? c.ctr : seen && signedUp !== null ? Math.min(1, signedUp / seen) : null;
    byKey[c.cta_key] = { seen, signedUp, rate, hidden: !!c.suppressed || (seen === null && signedUp === null) };
  });
  return { minCohort: Number(r.min_cohort) || 0, byKey };
}

export const percent = (rate: number | null): string => (rate === null ? '' : `${Math.round(rate * 1000) / 10}%`);

/** One line for a form: "Seen by 40 · 12 signed up · 30%", or why there is nothing to show yet. */
export function formStatLine(stat: FormStat | undefined, minCohort = 0): string {
  if (!stat) return 'No views recorded yet';
  if (stat.hidden || stat.seen === null) return minCohort ? `Not enough views yet (shown from ${minCohort} viewers)` : 'Not enough views yet';
  const parts = [`Seen by ${stat.seen}`];
  if (stat.signedUp !== null) parts.push(`${stat.signedUp} signed up`);
  if (stat.rate !== null) parts.push(percent(stat.rate));
  return parts.join(' · ');
}

/** The last `days` days as the date range the RPC takes (UTC dates). */
export function statsRange(days = 90, now = new Date()): { from: string; to: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(new Date(now.getTime() - (days - 1) * 86400000)), to: iso(now) };
}
