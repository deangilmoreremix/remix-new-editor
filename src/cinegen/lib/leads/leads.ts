// [remix] The Leads tab's logic, kept free of React: which forms a video has, filtering / counting / searching lead rows,
// the answer columns, the CSV, and the "this published video includes" summary.
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JS opt-in form helpers
import { leadFormToOptin, normalizeListBuilder } from '../../../lib/editor/addons/listBuilder.js';
// @ts-expect-error plain JS pointer registry
import { getPointerDesign } from '../../../lib/editor/addons/pointerDesigns.js';
// @ts-expect-error plain JS lead helpers
import { leadsToCsv } from '../../../lib/editor/addons/leadClient.js';
// @ts-expect-error plain JS attribution helpers
import { sourceLabel as rawSourceLabel } from '../../../lib/editor/publish/attribution.js';

export interface LeadSource { utm?: Record<string, string>; referrer?: string; page?: string | null; variant?: string; session?: string }
export interface LeadRow { id: string; kind: string; clipId: string | null; createdAt: string; data: Record<string, string>; source?: LeadSource; status?: string; notes?: string; tags?: string[]; updatedAt?: string }
/** "google / spring-sale", else the referring host, else "". */
export const sourceLabel = (row: LeadRow): string => String(rawSourceLabel(row.source) || '');
export interface LeadForm { key: string; label: string; short: string; tone: 'wall' | 'lead' }

export const LEAD_STATUSES: Array<[string, string]> = [['new', 'New'], ['contacted', 'Contacted'], ['qualified', 'Qualified'], ['won', 'Won'], ['lost', 'Lost']];
/** Follow-up (status, notes, tags) is available once the database has those columns, i.e. when rows carry a status. */
export const hasFollowUp = (rows: LeadRow[]): boolean => rows.some((r) => r.status !== undefined);
export const statusLabel = (status?: string): string => LEAD_STATUSES.find(([id]) => id === status)?.[1] ?? 'New';

/** What the database accepts for follow-up: a known status, a note up to 2,000 characters, up to 10 tags of 30 characters. Unknown keys are dropped. */
export function cleanFollowUp(patch: { status?: unknown; notes?: unknown; tags?: unknown }): { status?: string; notes?: string; tags?: string[] } {
  const out: { status?: string; notes?: string; tags?: string[] } = {};
  if (patch.status !== undefined && LEAD_STATUSES.some(([id]) => id === patch.status)) out.status = String(patch.status);
  if (patch.notes !== undefined) out.notes = String(patch.notes ?? '').slice(0, 2000);
  if (patch.tags !== undefined) {
    const raw = Array.isArray(patch.tags) ? patch.tags : String(patch.tags ?? '').split(',');
    out.tags = [...new Set(raw.map((t) => String(t).trim().toLowerCase().replace(/\s+/g, '-').slice(0, 30)).filter(Boolean))].slice(0, 10);
  }
  return out;
}

/** The tags with `input` added (cleaned like the database wants: lower-case, no spaces, 30 characters, no repeats, at most 10). */
export const addTag = (tags: string[], input: string): string[] => cleanFollowUp({ tags: [...tags, input] }).tags ?? tags;
export const removeTag = (tags: string[], tag: string): string[] => tags.filter((t) => t !== tag);

/** How many rows are in each status (rows without one count as "new"). */
export function statusCounts(rows: LeadRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  rows.forEach((r) => { const k = r.status ?? 'new'; out[k] = (out[k] ?? 0) + 1; });
  return out;
}

export const WALL_KEY = 'list-builder';
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** The forms in a video that collect leads: the List Builder wall and each Lead Generator (named by when it appears). */
export function leadForms(overlays: OverlayClip[]): LeadForm[] {
  const out: LeadForm[] = [];
  const wall = overlays.find((o) => o.type === 'list-builder');
  if (wall) {
    const personalizer = (wall.config as { kind?: string } | undefined)?.kind === 'personalizer';
    out.push({ key: WALL_KEY, label: personalizer ? 'Personalizer' : 'List Builder', short: personalizer ? 'Personalizer' : 'List Builder', tone: 'wall' });
  }
  overlays.filter((o) => o.type === 'lead-form').sort((a, b) => a.start - b.start).forEach((o) => {
    out.push({ key: o.id, label: `Lead Generator · ${mmss(o.start)}`, short: 'Lead Generator', tone: 'lead' });
  });
  return out;
}

/** Which form a stored row came from (the wall is stored under clip "list-builder", Lead Generators under their overlay id). */
export function rowFormKey(row: LeadRow): string {
  if (row.kind === 'list-builder' || row.kind === 'personalizer' || row.clipId === WALL_KEY) return WALL_KEY;
  return row.clipId ?? 'unknown';
}

/** Where the viewer came from: "mp4" when they followed the QR / link on an exported video (`?src=mp4` on the page they submitted from). */
export function rowSource(row: LeadRow): string {
  const page = row.source?.page;
  if (!page) return '';
  try { return new URL(page).searchParams.get('src') ?? ''; } catch { return ''; }
}
/** 'A' or 'B' when the viewer saw one version of an A/B-tested form, else ''. */
export const variantOf = (row: LeadRow): string => (row.source?.variant === 'A' || row.source?.variant === 'B' ? row.source.variant : '');
/** Leads per version, for forms being A/B tested (null when no lead carries a version). */
export function variantCounts(rows: LeadRow[]): { A: number; B: number } | null {
  const out = { A: 0, B: 0 };
  rows.forEach((r) => { const v = variantOf(r); if (v === 'A' || v === 'B') out[v] += 1; });
  return out.A + out.B ? out : null;
}
// ---------------------------------------------------------------------------------------------- how much a lead watched
export interface WatchInfo { progress: number; completed: boolean }
/** The viewing session a lead came from (sent with the lead when analytics was on), or ''. */
export const sessionOf = (row: LeadRow): string => (typeof row.source?.session === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(row.source.session) ? row.source.session : '');
/** Hot: finished or watched 75%+; Warm: 25%+; Cold: less. */
export const watchTag = (w?: WatchInfo | null): '' | 'Hot' | 'Warm' | 'Cold' => (!w ? '' : w.completed || w.progress >= 0.75 ? 'Hot' : w.progress >= 0.25 ? 'Warm' : 'Cold');
export const watchPercent = (w?: WatchInfo | null): string => (w ? `${Math.round(Math.max(0, Math.min(1, w.progress)) * 100)}%` : '');
/** The distinct session ids to look up (most recent first, at most `max`). */
export const sessionKeys = (rows: LeadRow[], max = 200): string[] => [...new Set(rows.map(sessionOf).filter(Boolean))].slice(0, max);

export const fromMp4 = (row: LeadRow): boolean => rowSource(row) === 'mp4';

/** Leads per day for the last `days` days (oldest first), zero-filled, in the viewer's local time. */
export function leadsPerDay(rows: LeadRow[], days = 14, now = new Date()): Array<{ day: string; label: string; n: number }> {
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const out: Array<{ day: string; label: string; n: number }> = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push({ day: key(d), label: `${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}`, n: 0 });
  }
  const at = new Map(out.map((o) => [o.day, o]));
  rows.forEach((r) => { const d = new Date(r.createdAt); if (!Number.isNaN(d.getTime())) { const slot = at.get(key(d)); if (slot) slot.n += 1; } });
  return out;
}

/** The email a lead gave (any answer whose name contains "email"), lower-cased, or ''. */
export const leadEmail = (row: LeadRow): string => {
  const k = Object.keys(row.data).find((x) => /e-?mail/i.test(x));
  return k ? String(row.data[k]).trim().toLowerCase() : '';
};

/**
 * Repeat sign-ups (the same email on the same form) collapsed to one row, the newest, with how many times it came in.
 * Rows without an email are never merged. Order is kept.
 */
export function collapseRepeats(rows: LeadRow[]): { rows: LeadRow[]; counts: Record<string, number> } {
  const seen = new Map<string, LeadRow>();
  const counts: Record<string, number> = {};
  const out: LeadRow[] = [];
  rows.forEach((r) => {
    const email = leadEmail(r);
    if (!email) { out.push(r); return; }
    const key = `${rowFormKey(r)}|${email}`;
    const first = seen.get(key);
    if (!first) { seen.set(key, r); counts[r.id] = 1; out.push(r); return; }
    counts[first.id] += 1;
  });
  return { rows: out, counts };
}

// ------------------------------------------------------------------------------------------------------- lead score
export type LeadTemperature = 'Hot' | 'Warm' | 'Cold';
export interface LeadScore { score: number; label: LeadTemperature; reasons: string[] }
type Part = [number, string];

/** Personal inbox providers: a lead on one of these is worth less than one on a company domain. */
const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.net', 'mail.com', 'yandex.com', 'qq.com', '163.com']);
export const isFreeMail = (email: string): boolean => FREE_MAIL.has(email.slice(email.lastIndexOf('@') + 1).toLowerCase());

const looksLikeEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const answerOf = (row: LeadRow, pattern: RegExp): string => String(Object.entries(row.data).find(([k, v]) => pattern.test(k) && String(v).trim())?.[1] ?? '').trim();

/** Points for the email: a company address beats a personal one; none (or a malformed one) scores nothing. */
function emailPoints(row: LeadRow): Part[] {
  const email = leadEmail(row) || Object.values(row.data).map((v) => String(v).trim().toLowerCase()).find(looksLikeEmail) || '';
  if (!looksLikeEmail(email)) return [];
  return [isFreeMail(email) ? [15, 'Personal email address'] : [30, 'Business email address']];
}

/** The lead's own answers that count: a phone number (7+ digits), a name, company / project details, and how many fields they filled in. */
function answerPoints(row: LeadRow): Part[] {
  const out: Part[] = [];
  if (answerOf(row, /phone|mobile|tel|whats/i).replace(/\D/g, '').length >= 7) out.push([20, 'Gave a phone number']);
  if (answerOf(row, /name/i) && !/mail/i.test(Object.keys(row.data).find((k) => /name/i.test(k)) ?? '')) out.push([5, 'Gave a name']);
  if (answerOf(row, /company|business|organi[sz]ation|website|budget|message|need|question|comment/i)) out.push([10, 'Gave company or project details']);
  const filled = Object.values(row.data).filter((v) => String(v).trim()).length;
  if (filled > 1) out.push([Math.min(filled - 1, 5) * 3, `${filled} answers filled in`]);
  return out;
}

/** Campaign tags show intent from an ad or campaign; a referrer shows they followed a link. */
function attributionPoints(row: LeadRow): Part[] {
  if (row.source?.utm && Object.values(row.source.utm).some(Boolean)) return [[10, 'Came from a tracked campaign']];
  return row.source?.referrer ? [[5, 'Came from another site']] : [];
}

/** A tap on a call button is the strongest signal there is, so it scores high before anything else is looked at. */
export const CALL_ATTEMPT_POINTS = 70;
const KIND_POINTS: Record<string, Part> = { 'lead-form': [10, 'Filled in a form mid-video'] };

export const temperatureOf = (score: number): LeadTemperature => (score >= 65 ? 'Hot' : score >= 30 ? 'Warm' : 'Cold');

/**
 * A 0-100 score and a Hot / Warm / Cold label from what the lead row itself holds: the kind of form, the answers given
 * (email quality, phone, name, other fields) and where they came from (utm / referrer). It needs no watch-time data.
 */
export function scoreLead(row: LeadRow): LeadScore {
  const parts: Part[] = row.kind === 'call-attempt'
    ? [[CALL_ATTEMPT_POINTS, 'Tapped to call you']]
    : [...(KIND_POINTS[row.kind] ? [KIND_POINTS[row.kind]] : []), ...emailPoints(row), ...answerPoints(row)];
  const earned = [...parts, ...attributionPoints(row)].filter(([n]) => n > 0);
  const score = Math.min(100, earned.reduce((sum, [n]) => sum + n, 0));
  return { score, label: temperatureOf(score), reasons: earned.map(([, why]) => why) };
}

export type LeadSort = 'newest' | 'score-desc' | 'score-asc';
/** The rows in the chosen order. "newest" keeps the order given; equal scores keep it too. */
export function sortRows(rows: LeadRow[], sort: LeadSort = 'newest'): LeadRow[] {
  if (sort === 'newest') return rows;
  const dir = sort === 'score-desc' ? -1 : 1;
  const scored = rows.map((r, i) => ({ r, i, n: scoreLead(r).score }));
  return scored.sort((a, b) => dir * (a.n - b.n) || a.i - b.i).map(({ r }) => r);
}

export function countsByForm(rows: LeadRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  rows.forEach((r) => { const k = rowFormKey(r); out[k] = (out[k] ?? 0) + 1; });
  return out;
}

export type LeadRange = 'all' | 'today' | '7d' | '30d';
export const LEAD_RANGES: Array<[LeadRange, string]> = [['all', 'All time'], ['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days']];

/** Earliest allowed timestamp (ms) for a range, or null for "all". "today" is since local midnight; N days is a rolling window. */
function rangeStart(range: LeadRange, now: Date): number | null {
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (range === '7d') return now.getTime() - 7 * 86400000;
  if (range === '30d') return now.getTime() - 30 * 86400000;
  return null;
}

export function filterRows(rows: LeadRow[], { form = 'all', query = '', range = 'all', status = 'all', now = new Date() }: { form?: string; query?: string; range?: LeadRange; status?: string; now?: Date } = {}): LeadRow[] {
  const q = query.trim().toLowerCase();
  const since = rangeStart(range, now);
  return rows.filter((r) => {
    if (form !== 'all' && rowFormKey(r) !== form) return false;
    if (status !== 'all' && (r.status ?? 'new') !== status) return false;
    if (since !== null) {
      const t = new Date(r.createdAt).getTime();
      if (Number.isNaN(t) || t < since) return false;
    }
    if (!q) return true;
    return Object.values(r.data).some((v) => String(v).toLowerCase().includes(q)) || sourceLabel(r).toLowerCase().includes(q)
      || String(r.notes ?? '').toLowerCase().includes(q) || (r.tags ?? []).some((t) => t.includes(q));
  });
}

/** One column per answer, in the order they first appear (EMAIL, FIRST NAME, …), shown in Title Case. */
export function answerColumns(rows: LeadRow[]): Array<{ key: string; label: string }> {
  const seen: string[] = [];
  rows.forEach((r) => Object.keys(r.data).forEach((k) => { if (!seen.includes(k)) seen.push(k); }));
  return seen.map((key) => ({ key, label: key.replace(/_\d+$/, '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) }));
}

/** A viewer controls utm_* and the referrer; a leading = + - @ (or tab/CR) would be read as a formula by spreadsheets. */
export const csvSafe = (v: string): string => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export type ExportRecord = Record<string, string | number>;

/**
 * One flat record per lead for CSV / Excel: when, form, every answer, campaign + follow-up columns (only when some lead has
 * them, so older exports keep their shape) and the lead score, and how much of the video each lead watched when that is known. `escape` guards spreadsheet formulas in CSV; Excel cells are
 * typed text, so the Excel export leaves values as they were typed.
 */
export function exportRecords(rows: LeadRow[], forms: LeadForm[], { escape = true, watch = {} }: { escape?: boolean; watch?: Record<string, WatchInfo> } = {}): ExportRecord[] {  const name = (r: LeadRow) => forms.find((f) => f.key === rowFormKey(r))?.label ?? 'Form';
  const safe = escape ? csvSafe : (v: string) => v;
  // The visitor's own answers are never overwritten. A computed column whose name an answer uses (an editable label such as
  // "Lead Score" or "Status") gets " (computed)" appended, decided ONCE for the whole export from every row's answers, so all rows put
  // the computed value in the same column (CSV / Excel merge records by key into shared headers).
  const answerKeys = new Set(rows.flatMap((r) => Object.keys(r.data)));
  const columnNames = new Map<string, string>();
  const column = (key: string): string => {
    let k = columnNames.get(key);
    if (k === undefined) { k = key; while (answerKeys.has(k)) k = `${k} (computed)`; columnNames.set(key, k); }
    return k;
  };
  return rows.map((r) => {
    const utm = r.source?.utm ?? {};
    const src: ExportRecord = {};
    if (utm.source) src['UTM Source'] = safe(utm.source);
    if (utm.medium) src['UTM Medium'] = safe(utm.medium);
    if (utm.campaign) src['UTM Campaign'] = safe(utm.campaign);
    if (utm.term) src['UTM Term'] = safe(utm.term);
    if (utm.content) src['UTM Content'] = safe(utm.content);
    if (r.source?.referrer) src.Referrer = safe(r.source.referrer);
    if (fromMp4(r)) src['From MP4'] = 'Yes';
    if (variantOf(r)) src.Version = variantOf(r);
    const w = watch[sessionOf(r)];
    if (w) { src['Watched %'] = watchPercent(w).replace('%', ''); src.Interest = watchTag(w); }
    if (r.status !== undefined) { src.Status = statusLabel(r.status); if (r.notes) src.Notes = safe(r.notes); if (r.tags?.length) src.Tags = safe(r.tags.join(', ')); }
    const { score, label } = scoreLead(r);
    const rec: ExportRecord = { Submitted: r.createdAt, Form: name(r), ...r.data };
    Object.entries(src).forEach(([k, v]) => { rec[column(k)] = v; });
    rec[column('Lead Score')] = score; rec[column('Lead Rating')] = label;
    return rec;
  });}

export const rowsToCsv = (rows: LeadRow[], forms: LeadForm[], watch: Record<string, WatchInfo> = {}): string => leadsToCsv(exportRecords(rows, forms, { watch }));

/** "Today 14:02" / "Yesterday 19:05" / "Nov 3 09:12" */
export function whenLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return `Today ${hm}`;
  if (diff === 1) return `Yesterday ${hm}`;
  return `${d.toLocaleString('en', { month: 'short' })} ${d.getDate()} ${hm}`;
}

export interface IncludeItem { icon: string; title: string; detail: string; note?: string }

/** What a published video gives viewers: the wall, each Lead Generator, each CTA. */
export function publishIncludes(overlays: OverlayClip[]): IncludeItem[] {
  const out: IncludeItem[] = [];
  const wall = overlays.find((o) => o.type === 'list-builder');
  if (wall) {
    const cfg = normalizeListBuilder({ ...(wall.config as object) }) as { elements?: unknown[]; pointerEnabled?: boolean; pointerStyle?: string; kind?: string };
    const boxes = (cfg.elements ?? []).length;
    out.push({
      icon: '🔒', title: cfg.kind === 'personalizer' ? 'Personalizer' : 'List Builder', detail: 'viewers sign up before the video plays',
      note: `${boxes} ${boxes === 1 ? 'box' : 'boxes'}${cfg.pointerEnabled ? ` · ${String(getPointerDesign(cfg.pointerStyle).label).toLowerCase()} pointer` : ''}`,
    });
  }
  overlays.filter((o) => o.type === 'lead-form').sort((a, b) => a.start - b.start).forEach((o) => {
    const boxes = (leadFormToOptin(o) as { elements: unknown[] }).elements.length;
    out.push({ icon: '📝', title: `Lead Generator at ${mmss(o.start)}`, detail: 'pauses the video', note: `${boxes} ${boxes === 1 ? 'box' : 'boxes'}` });
  });
  overlays.filter((o) => o.type === 'click-to-call').sort((a, b) => a.start - b.start).forEach((o) => {
    out.push({ icon: '📞', title: `CTA button at ${mmss(o.start)}`, detail: String(o.buttonText ?? 'Call Now') });
  });
  return out;
}
