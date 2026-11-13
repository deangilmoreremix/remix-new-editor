// [remix] The Leads tab's logic, kept free of React: which forms a video has, filtering / counting / searching lead rows,
// the answer columns, the CSV, and the "this published video includes" summary.
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JS opt-in form helpers
import { leadFormToOptin, normalizeListBuilder } from '../../../lib/editor/addons/listBuilder.js';
// @ts-expect-error plain JS pointer registry
import { getPointerDesign } from '../../../lib/editor/addons/pointerDesigns.js';
// @ts-expect-error plain JS lead helpers
import { leadsToCsv } from '../../../lib/editor/addons/leadClient.js';

export interface LeadRow { id: string; kind: string; clipId: string | null; createdAt: string; data: Record<string, string> }
export interface LeadForm { key: string; label: string; short: string; tone: 'wall' | 'lead' }

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

export function filterRows(rows: LeadRow[], { form = 'all', query = '', range = 'all', now = new Date() }: { form?: string; query?: string; range?: LeadRange; now?: Date } = {}): LeadRow[] {
  const q = query.trim().toLowerCase();
  const since = rangeStart(range, now);
  return rows.filter((r) => {
    if (form !== 'all' && rowFormKey(r) !== form) return false;
    if (since !== null) {
      const t = new Date(r.createdAt).getTime();
      if (Number.isNaN(t) || t < since) return false;
    }
    if (!q) return true;
    return Object.values(r.data).some((v) => String(v).toLowerCase().includes(q));
  });
}

/** One column per answer, in the order they first appear (EMAIL, FIRST NAME, …), shown in Title Case. */
export function answerColumns(rows: LeadRow[]): Array<{ key: string; label: string }> {
  const seen: string[] = [];
  rows.forEach((r) => Object.keys(r.data).forEach((k) => { if (!seen.includes(k)) seen.push(k); }));
  return seen.map((key) => ({ key, label: key.replace(/_\d+$/, '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) }));
}

export function rowsToCsv(rows: LeadRow[], forms: LeadForm[]): string {
  const name = (r: LeadRow) => forms.find((f) => f.key === rowFormKey(r))?.label ?? 'Form';
  return leadsToCsv(rows.map((r) => ({ Submitted: r.createdAt, Form: name(r), ...r.data })));
}

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
