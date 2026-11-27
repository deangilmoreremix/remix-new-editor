-- ===========================================================================
-- scheduled_publishing.sql
--
-- Turns public.scheduled_posts (the "Schedule post" queue) into a durable
-- publishing job table that a Netlify scheduled function works through while
-- no browser is open. Reminder-only rows from the original window keep working
-- (auto_publish = false is never touched by the server).
--
--  * jobs      the exact MuAPI request per destination (built by the browser with
--              buildPublishPayload) so the server never re-derives copy or media.
--  * results   per-destination progress/outcome written ONLY by the server:
--              request id (idempotency), post url, error, retry state.
--  * job_key   unique id for the job (idempotency / dedupe of notifications).
--  * social_publish_credentials  the user's MuAPI key, AES-GCM encrypted by the
--              server (opt-in). No policy and no grants: the browser can never
--              read it back; only the service role can.
-- Times are timestamptz (UTC); time_zone is only the owner's display zone.
-- ===========================================================================

-- ---------------------------------------------------------------- credentials
create table if not exists public.social_publish_credentials (
  clerk_user_id text primary key,
  key_ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.social_publish_credentials enable row level security;
revoke all on public.social_publish_credentials from public, anon, authenticated;

-- ---------------------------------------------------------------- job columns
alter table public.scheduled_posts
  add column if not exists job_key uuid not null default gen_random_uuid(),
  add column if not exists auto_publish boolean not null default false,
  add column if not exists time_zone text check (time_zone is null or char_length(time_zone) <= 64),
  add column if not exists jobs jsonb check (jobs is null or (jsonb_typeof(jobs) = 'array' and jsonb_array_length(jobs) between 1 and 8)),
  add column if not exists results jsonb not null default '[]'::jsonb check (jsonb_typeof(results) = 'array'),
  add column if not exists attempts integer not null default 0 check (attempts >= 0),
  add column if not exists max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  add column if not exists next_attempt_at timestamptz,
  add column if not exists locked_until timestamptz,
  add column if not exists last_error text check (last_error is null or char_length(last_error) <= 500),
  add column if not exists published_at timestamptz,
  add column if not exists cancelled_at timestamptz;

create unique index if not exists scheduled_posts_job_key_idx on public.scheduled_posts (job_key);
create index if not exists scheduled_posts_due_idx on public.scheduled_posts (scheduled_for)
  where auto_publish and status in ('scheduled', 'publishing');

alter table public.scheduled_posts drop constraint if exists scheduled_posts_status_check;
alter table public.scheduled_posts add constraint scheduled_posts_status_check
  check (status in ('scheduled', 'draft', 'posted', 'failed', 'publishing', 'cancelled'));
alter table public.scheduled_posts drop constraint if exists scheduled_posts_platforms_check;
alter table public.scheduled_posts add constraint scheduled_posts_platforms_check
  check (cardinality(platforms) between 1 and 8);
alter table public.scheduled_posts drop constraint if exists scheduled_posts_auto_needs_jobs;
alter table public.scheduled_posts add constraint scheduled_posts_auto_needs_jobs
  check (not auto_publish or (jobs is not null and scheduled_for is not null));

-- ---------------------------------------------------------------- guard trigger
-- Clients may create/reschedule/cancel/retry; only the server writes progress.
-- Does the CALLER (verified Clerk sub) have a stored key? A definer helper, because clients cannot read the table.
create or replace function public.has_publish_credentials()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.social_publish_credentials c where c.clerk_user_id = (select auth.jwt() ->> 'sub'));
$$;
revoke all on function public.has_publish_credentials() from public;
grant execute on function public.has_publish_credentials() to anon, authenticated, service_role;

-- SECURITY INVOKER on purpose: current_user must be the CALLER's role. (A definer function would always
-- see its owner and treat every client as the server.)
create or replace function public.scheduled_posts_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_server boolean := coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'service_role', 'supabase_admin');
begin
  if is_server then return new; end if;

  if tg_op = 'INSERT' then
    new.results := '[]'::jsonb; new.attempts := 0; new.locked_until := null; new.next_attempt_at := null;
    new.published_at := null; new.cancelled_at := null; new.last_error := null;
    -- defence in depth (the RLS policy checks this too): a job can only be created for the caller
    if new.clerk_user_id is distinct from (select auth.jwt() ->> 'sub') then
      raise exception 'jobs can only be created for your own account' using errcode = '42501';
    end if;
    if new.status not in ('draft', 'scheduled') then
      raise exception 'new posts start as draft or scheduled' using errcode = '42501';
    end if;
    if new.auto_publish then
      if new.scheduled_for is null or new.scheduled_for < now() - interval '1 minute' then
        raise exception 'automatic publishing needs a future time' using errcode = '22023';
      end if;
      if not public.has_publish_credentials() then
        raise exception 'turn on automatic publishing first (no MuAPI key is stored on the server)' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE
  if new.clerk_user_id is distinct from old.clerk_user_id or new.job_key is distinct from old.job_key
     or new.jobs is distinct from old.jobs or new.results is distinct from old.results
     or new.attempts is distinct from old.attempts or new.locked_until is distinct from old.locked_until
     or new.next_attempt_at is distinct from old.next_attempt_at or new.published_at is distinct from old.published_at
     or new.last_error is distinct from old.last_error or new.cancelled_at is distinct from old.cancelled_at
     or new.auto_publish is distinct from old.auto_publish or new.max_attempts is distinct from old.max_attempts then
    raise exception 'job progress is managed by the server' using errcode = '42501';
  end if;
  if old.status in ('posted', 'publishing') then
    raise exception 'a post that is publishing or published cannot be changed' using errcode = '42501';
  end if;
  if old.auto_publish and (new.media_url is distinct from old.media_url or new.caption is distinct from old.caption
     or new.platforms is distinct from old.platforms or new.hashtags is distinct from old.hashtags) then
    raise exception 'cancel and create a new job to change its content' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and (old.status, new.status) not in (('draft','scheduled'), ('scheduled','draft'), ('scheduled','cancelled'),
                                          ('failed','scheduled'), ('failed','cancelled'), ('cancelled','scheduled')) then
    raise exception 'status % -> % is not allowed', old.status, new.status using errcode = '42501';
  end if;
  if new.status = 'cancelled' then new.cancelled_at := now(); end if;
  if new.status = 'scheduled' and old.status in ('failed', 'cancelled') then
    -- manual retry / re-activate: fresh try, finished destinations are never re-sent (the server skips them)
    new.attempts := 0; new.last_error := null; new.next_attempt_at := now(); new.cancelled_at := null;
    if new.auto_publish and (new.scheduled_for is null or new.scheduled_for < now()) then new.scheduled_for := now(); end if;
  end if;
  if new.status = 'scheduled' and new.scheduled_for is distinct from old.scheduled_for then
    new.next_attempt_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists scheduled_posts_guard_trg on public.scheduled_posts;
create trigger scheduled_posts_guard_trg
  before insert or update on public.scheduled_posts
  for each row execute function public.scheduled_posts_guard();

-- ---------------------------------------------------------------- claim (server only)
-- Atomically picks due jobs (SKIP LOCKED: two ticks never take the same row). A job whose
-- lock expired mid-publish is picked up again and RESUMED from results, never re-sent.
create or replace function public.claim_due_scheduled_posts(p_limit integer default 10, p_lock_seconds integer default 90)
returns setof public.scheduled_posts
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select s.id from public.scheduled_posts s
    where s.auto_publish and s.jobs is not null
      and ((s.status = 'scheduled' and s.scheduled_for <= now() and coalesce(s.next_attempt_at, s.scheduled_for) <= now())
        or (s.status = 'publishing' and coalesce(s.locked_until, now()) <= now()))
    order by s.scheduled_for
    limit greatest(1, least(p_limit, 50))
    for update skip locked
  )
  update public.scheduled_posts t
     set status = 'publishing', locked_until = now() + make_interval(secs => greatest(30, p_lock_seconds))
    from due where t.id = due.id
  returning t.*;
end;
$$;
revoke all on function public.claim_due_scheduled_posts(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_due_scheduled_posts(integer, integer) to service_role;

-- ---------------------------------------------------------------- notifications
-- Real publish results use the existing owner_notifications -> push-dispatch path.
alter table public.owner_notifications drop constraint if exists owner_notifications_type_check;
alter table public.owner_notifications add constraint owner_notifications_type_check
  check (type in (
    'new_lead', 'high_interest', 'pricing_cta', 'contact_cta', 'returning_engagement',
    'milestone', 'interest_surge', 'followup_opportunity', 'daily_digest',
    'post_published', 'post_failed'));

create or replace function public.retarget_push_types_ok(types text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select types is null or types <@ array[
    'new_lead', 'high_interest', 'pricing_cta', 'contact_cta', 'returning_engagement',
    'milestone', 'interest_surge', 'followup_opportunity', 'daily_digest',
    'post_published', 'post_failed']::text[];
$$;
