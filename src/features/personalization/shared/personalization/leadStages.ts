/**
 * Lead pipeline stages for the SmartVideo GO Lead Finder.
 *
 * The vocabulary lives under `src/shared/` so the server route, the client UI
 * and the database all read the SAME list. The stage list is duplicated in
 * exactly two places — here and the CHECK constraint on
 * `public.lead_finder_leads` (supabase/migrations/20261021000000_lead_finder_leads.sql)
 * — because the database has to reject an unknown stage even when the API is
 * bypassed. Every other consumer (route validation, filter dropdowns, the
 * pipeline view) derives from this module, so a stage can never exist in the
 * UI while being rejected by the database.
 *
 * This module is intentionally dependency-free: it is imported from both
 * server route handlers and client components, so it must not pull in any
 * server-only module.
 */

export const LEAD_STAGES = [
  'New',
  'Qualified',
  'Shortlisted',
  'Demo Created',
  'Contacted',
  'Responded',
  'Converted',
  'Not Interested',
] as const

export type LeadStage = (typeof LEAD_STAGES)[number]

/** Stage a lead is created with. Mirrors the column default in SQL. */
export const DEFAULT_LEAD_STAGE: LeadStage = 'New'

/**
 * Exact, case-sensitive membership test. Stage values are persisted verbatim
 * in the `stage` column, so a case-insensitive match here would accept a
 * value the database CHECK constraint then rejects.
 */
export function isLeadStage(value: unknown): value is LeadStage {
  return (
    typeof value === 'string' &&
    (LEAD_STAGES as readonly string[]).includes(value)
  )
}

/**
 * Display copy for a stage, in one place so a UI rename never has to touch
 * every call site (and never drifts from the stored value). Today the label
 * equals the stored stage string; the indirection exists so the pipeline
 * header copy can change without rewriting the callers.
 */
const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  New: 'New',
  Qualified: 'Qualified',
  Shortlisted: 'Shortlisted',
  'Demo Created': 'Demo Created',
  Contacted: 'Contacted',
  Responded: 'Responded',
  Converted: 'Converted',
  'Not Interested': 'Not Interested',
}

export function leadStageLabel(stage: LeadStage): string {
  return LEAD_STAGE_LABELS[stage] ?? stage
}
