-- ===========================================================================
-- video_leads_followup_hardening.sql
--
-- Completes the lead-management columns started in 20261118120000_video_leads_followup.sql:
--   * tags: every tag is 1-30 characters (the earlier migration only capped the count at 10)
--   * updated_at: set automatically whenever an owner changes status / notes / tags
--
-- Access is unchanged and stays narrow: the owner-only UPDATE policy plus the column-level
-- grant UPDATE (status, notes, tags). updated_at is written by a trigger (a trigger may set any
-- column of NEW regardless of the caller's column grants), so owners still cannot touch data,
-- source, kind, email_key or clerk_user_id. No SECURITY DEFINER is used: the function below only
-- reads its own argument.
-- Safe to apply before the app change: existing rows get updated_at = created_at.
-- ===========================================================================

alter table public.video_leads
  add column if not exists updated_at timestamptz;

update public.video_leads set updated_at = created_at where updated_at is null;

alter table public.video_leads
  alter column updated_at set default now(),
  alter column updated_at set not null;

create or replace function public.video_leads_tags_ok(tags text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(tags) <= 10, true)
    and not exists (select 1 from unnest(tags) as t where t is null or char_length(t) not between 1 and 30);
$$;

alter table public.video_leads drop constraint if exists video_leads_tags_item_size;
alter table public.video_leads add constraint video_leads_tags_item_size
  check (public.video_leads_tags_ok(tags));

create or replace function public.video_leads_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.status, new.notes, new.tags) is distinct from (old.status, old.notes, old.tags) then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists video_leads_touch_updated_at on public.video_leads;
create trigger video_leads_touch_updated_at
  before update on public.video_leads
  for each row execute function public.video_leads_touch_updated_at();
