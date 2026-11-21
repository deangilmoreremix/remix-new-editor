-- ===========================================================================
-- video_leads_email_dedupe.sql
--
-- One lead per email per form: the same email (ignoring case) signing up again on the same
-- form of the same published video no longer creates a second row (or a second notification).
--
-- lead-capture computes `email_key` (the lead's first valid email, trimmed and lower-cased) and
-- writes it with the row. The partial UNIQUE index below turns a repeat into a unique_violation
-- (23505), which the function answers as { ok: true, duplicate: true } without notifying anyone.
--
--   * Only published (preview = false) rows with an email take part; call attempts, editor
--     previews and leads without an email have a NULL key and are never de-duplicated.
--   * Existing rows are NOT back-filled (their email lives under an editable answer label), so
--     the rule applies to sign-ups from now on. The Leads tab's "Merge repeat sign-ups" still
--     folds older repeats on screen.
--   * Owners cannot change email_key: UPDATE stays limited to status / notes / tags (see
--     20261118120000_video_leads_followup.sql); the column grant is not widened here.
-- Safe to apply before the function change: the column is nullable and nothing reads it.
-- ===========================================================================

alter table public.video_leads
  add column if not exists email_key text;

alter table public.video_leads drop constraint if exists video_leads_email_key_size;
alter table public.video_leads add constraint video_leads_email_key_size
  check (email_key is null or char_length(email_key) <= 254);

create unique index if not exists video_leads_email_dedupe_idx
  on public.video_leads (clerk_user_id, project_id, coalesce(clip_id, ''), email_key)
  where email_key is not null and preview = false;
