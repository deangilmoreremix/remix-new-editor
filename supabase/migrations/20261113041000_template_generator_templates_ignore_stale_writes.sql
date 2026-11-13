-- ===========================================================================
-- template_generator_templates_ignore_stale_writes.sql
--
-- Two devices can sync the same template at the same moment: both read the old
-- row, both decide to push, and whichever request lands LAST wins — even when
-- it carries the OLDER edit (or an older state than a delete). The client's
-- merge (sync.js planSync) only sees its own snapshot, so the check has to be
-- made by the database, atomically, against the row as it is when the write
-- arrives.
--
-- An UPDATE whose updated_at is older than the stored row's is a stale write:
-- the trigger drops it (RETURN NULL skips the update; an upsert reports no
-- error). Equal timestamps still apply. Inserts are unaffected.
--
-- Replaces the guard function from 20261112212041_create_template_generator_templates.sql
-- (CREATE OR REPLACE keeps its privileges: still not executable by API roles).
-- IDEMPOTENT: safe to re-run.
-- ===========================================================================

create or replace function public.template_generator_templates_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- an absurd client clock must not pin a template as "newest forever"
  new.updated_at := least(coalesce(new.updated_at, now()), now() + interval '1 day');
  if tg_op = 'UPDATE' then
    -- a late-arriving older write (another device finishing last) must not overwrite a newer edit or a delete
    if new.updated_at < old.updated_at then
      return null;
    end if;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.template_generator_templates_guard() from public, anon, authenticated;
