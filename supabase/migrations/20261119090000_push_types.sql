-- ===========================================================================
-- push_types.sql — per-alert-type choice of which alerts also send a push
--
-- retarget_preferences.enabled_types decides which alerts exist (always shown
-- in the app). push_types decides which of those ALSO send a browser push:
--   NULL  = legacy behaviour, push every type in enabled_types (nobody changes)
--   array = push only types that are in both push_types and enabled_types
-- Optional and backward compatible: the app and push-dispatch keep working
-- without this column (they treat it as NULL). The existing owner policy and
-- table-level grants already cover new columns on retarget_preferences.
-- ===========================================================================
create or replace function public.retarget_push_types_ok(types text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select types is null or types <@ array[
    'new_lead', 'high_interest', 'pricing_cta', 'contact_cta', 'returning_engagement',
    'milestone', 'interest_surge', 'followup_opportunity', 'daily_digest']::text[];
$$;

alter table public.retarget_preferences add column if not exists push_types text[];

alter table public.retarget_preferences drop constraint if exists retarget_preferences_push_types_known;
alter table public.retarget_preferences add constraint retarget_preferences_push_types_known
  check (public.retarget_push_types_ok(push_types));
