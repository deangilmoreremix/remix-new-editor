-- ===========================================================================
-- video_leads_followup.sql
--
-- Lead follow-up on the Leads tab: a status (new / contacted / qualified / won /
-- lost), a private note and a few tags per lead.
--
-- create_video_leads.sql made leads read-only ("nobody can update them") and
-- 20261105130000 revoked UPDATE from anon/authenticated. That stays true for
-- everything the viewer supplied (answers, source, kind): this migration lets an
-- owner change ONLY these three follow-up columns, and only on their own rows.
--   * column-level GRANT: UPDATE (status, notes, tags), nothing else
--   * row-level POLICY: the row's clerk_user_id must equal the caller's verified sub
-- Safe to apply before the app change: existing rows get status 'new'.
-- ===========================================================================

alter table public.video_leads
  add column if not exists status text not null default 'new',
  add column if not exists notes text,
  add column if not exists tags text[] not null default '{}';

alter table public.video_leads drop constraint if exists video_leads_status_check;
alter table public.video_leads add constraint video_leads_status_check
  check (status in ('new', 'contacted', 'qualified', 'won', 'lost'));
alter table public.video_leads drop constraint if exists video_leads_notes_size;
alter table public.video_leads add constraint video_leads_notes_size
  check (notes is null or char_length(notes) <= 2000);
alter table public.video_leads drop constraint if exists video_leads_tags_size;
alter table public.video_leads add constraint video_leads_tags_size
  check (cardinality(tags) <= 10);

drop policy if exists "Clerk-verified users update follow-up on own video leads" on public.video_leads;
create policy "Clerk-verified users update follow-up on own video leads"
  on public.video_leads
  for update
  to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

-- Only the follow-up columns may be updated, and only on rows whose clerk_user_id is the caller's verified sub (an unauthenticated
-- caller has no sub, so the policy matches nothing). Same roles as the select / delete policies, which Clerk sessions use.
revoke update on public.video_leads from anon, authenticated;
grant update (status, notes, tags) on public.video_leads to anon, authenticated;
