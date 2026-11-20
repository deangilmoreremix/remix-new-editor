-- First-party funnel analytics for the app-wide onboarding (src/lib/onboarding/telemetry.js).
--
-- Design (same shape as video_analytics.sql):
--   * Raw events live in public.onboarding_events. Browsers never read or write it: RLS is on and every client role is
--     revoked. The only writers are service_role RPCs called by netlify/functions/onboarding-events.js (browser batches)
--     and netlify/functions/clerk-webhook.js (the server-side 'signup' event).
--   * Events carry choice ids only (goal, team, volume, studios...), never company, website or job title, and `props` is
--     capped at 512 bytes. The browser id is hashed by the function before it gets here.
--   * Ingest is idempotent: (session_key, seq) is unique, so a retried batch never double counts.
--   * onboarding_funnel() is the read side (service_role only; the admin function authorizes the caller).
--   * Raw events are pruned after 180 days.

create table if not exists public.onboarding_events (
  id bigint generated always as identity primary key,
  anon_hash text not null check (char_length(anon_hash) between 16 and 64),
  session_key text not null check (session_key ~ '^[A-Za-z0-9_-]{16,64}$'),
  clerk_user_id text check (clerk_user_id is null or char_length(clerk_user_id) between 1 and 80),
  flow text not null default 'app_onboarding' check (flow = 'app_onboarding'),
  flow_version smallint not null default 1 check (flow_version between 1 and 100),
  event text not null check (event in ('signup', 'start', 'step_view', 'step_answer', 'back', 'skip_step', 'complete', 'leave', 'open_studio', 'key_saved', 'key_tested')),
  step smallint check (step is null or step between 1 and 6),
  sub_step text check (sub_step is null or sub_step in ('type', 'tools', 'ready')),
  props jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 512),
  seq integer not null default 0 check (seq between 0 and 999999),
  device_class text check (device_class is null or device_class in ('mobile', 'tablet', 'desktop')),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 120),
  created_at timestamptz not null default now()
);

create unique index if not exists onboarding_events_session_seq on public.onboarding_events (session_key, seq);
create index if not exists onboarding_events_event_time on public.onboarding_events (event, created_at);
create index if not exists onboarding_events_person_time on public.onboarding_events (coalesce(clerk_user_id, anon_hash), created_at);
create index if not exists onboarding_events_created on public.onboarding_events (created_at);

alter table public.onboarding_events enable row level security;
revoke all on public.onboarding_events from public, anon, authenticated;

-- ---- writer: a batch of browser events -------------------------------------------------------------
create or replace function public.ingest_onboarding_events(
  p_anon_hash text,
  p_session_key text,
  p_clerk_user_id text,
  p_device text,
  p_referrer text,
  p_events jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_total integer;
  n_new integer;
begin
  if p_anon_hash is null or char_length(p_anon_hash) not between 16 and 64 then return jsonb_build_object('ok', false, 'error', 'bad_anon'); end if;
  if p_session_key is null or p_session_key !~ '^[A-Za-z0-9_-]{16,64}$' then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' then return jsonb_build_object('ok', false, 'error', 'bad_events'); end if;
  n_total := jsonb_array_length(p_events);
  if n_total < 1 or n_total > 25 then return jsonb_build_object('ok', false, 'error', 'bad_events'); end if;

  -- Every event is checked before anything is written; a bad one rejects the whole batch (the function already
  -- re-shaped them, so this only trips on a bug or a direct call).
  if exists (
    select 1 from jsonb_array_elements(p_events) x
    where jsonb_typeof(x) <> 'object'
       or x->>'event' is null
       or x->>'event' not in ('start', 'step_view', 'step_answer', 'back', 'skip_step', 'complete', 'leave', 'open_studio', 'key_saved', 'key_tested')
       or coalesce(x->>'seq', '') !~ '^[0-9]{1,6}$'
       or (x ? 'step' and x->>'step' is not null and (x->>'step') !~ '^[1-6]$')
       or (x ? 'sub_step' and x->>'sub_step' is not null and x->>'sub_step' not in ('type', 'tools', 'ready'))
       or (x ? 'props' and x->'props' is not null and jsonb_typeof(x->'props') <> 'object')
       or (x ? 'props' and x->'props' is not null and pg_column_size(x->'props') > 512)
  ) then return jsonb_build_object('ok', false, 'error', 'bad_event'); end if;

  with ins as (
    insert into public.onboarding_events (anon_hash, session_key, clerk_user_id, event, step, sub_step, props, seq, device_class, referrer_host)
    select p_anon_hash, p_session_key, nullif(p_clerk_user_id, ''), x->>'event', nullif(x->>'step', '')::smallint,
           nullif(x->>'sub_step', ''), coalesce(x->'props', '{}'::jsonb), (x->>'seq')::integer,
           case when p_device in ('mobile', 'tablet', 'desktop') then p_device else null end,
           left(nullif(p_referrer, ''), 120)
    from jsonb_array_elements(p_events) x
    on conflict (session_key, seq) do nothing
    returning 1
  )
  select count(*) into n_new from ins;
  return jsonb_build_object('ok', true, 'accepted', n_new, 'duplicates', n_total - n_new);
end;
$$;
revoke all on function public.ingest_onboarding_events(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_onboarding_events(text, text, text, text, text, jsonb) to service_role;

-- ---- writer: the server-side 'signup' event (Clerk user.created webhook) ------------------------------
create or replace function public.record_onboarding_signup(p_clerk_user_id text) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text;
  n integer;
begin
  if p_clerk_user_id is null or char_length(p_clerk_user_id) not between 1 and 80 then return false; end if;
  h := encode(sha256(convert_to('user:' || p_clerk_user_id, 'utf8')), 'hex');
  insert into public.onboarding_events (anon_hash, session_key, clerk_user_id, event, seq)
  values (h, 'signup_' || left(h, 24), p_clerk_user_id, 'signup', 0)
  on conflict (session_key, seq) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke all on function public.record_onboarding_signup(text) from public, anon, authenticated;
grant execute on function public.record_onboarding_signup(text) to service_role;

-- ---- reader: the funnel -------------------------------------------------------------------------------
-- A "person" is the Clerk user id when the browser sent a verified token, otherwise the hashed browser id.
create or replace function public.onboarding_funnel(p_from timestamptz default now() - interval '30 days', p_to timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := coalesce(p_from, now() - interval '30 days');
  v_to timestamptz := coalesce(p_to, now());
  steps jsonb;
  res jsonb;
begin
  if v_to < v_from then return jsonb_build_object('ok', false, 'error', 'bad_range'); end if;

  with e as (
    select coalesce(clerk_user_id, anon_hash) as person, session_key, event, step, sub_step, props, created_at
    from public.onboarding_events
    where created_at >= v_from and created_at < v_to
  ),
  stages(ord, key, label) as (
    values (0, 'signup', 'Signed up'), (1, 'start', 'Started'), (2, 'step_1', 'Step 1 · What to do first'),
           (3, 'step_2', 'Step 2 · Team size'), (4, 'step_3', 'Step 3 · Videos per month'), (5, 'step_4', 'Step 4 · Where you work'),
           (6, 'step_5', 'Step 5 · How you heard'), (7, 'step_6', 'Step 6 · Video type and studios'),
           (8, 'ready', 'Get ready screen'), (9, 'complete', 'Finished')
  ),
  hits as (
    select 'signup' as key, person from e where event = 'signup'
    union all select 'start', person from e where event = 'start'
    union all select 'step_' || step, person from e where event = 'step_view' and step between 1 and 6
    union all select 'ready', person from e where event = 'step_view' and sub_step = 'ready'
    union all select 'complete', person from e where event = 'complete'
  )
  select coalesce(jsonb_agg(jsonb_build_object('key', s.key, 'label', s.label, 'people', coalesce(c.n, 0)) order by s.ord), '[]'::jsonb)
  into steps
  from stages s
  left join (select key, count(distinct person) as n from hits group by key) c on c.key = s.key;

  res := jsonb_build_object(
    'ok', true, 'from', v_from, 'to', v_to, 'funnel', steps,
    'left_for_academy', (select count(distinct coalesce(clerk_user_id, anon_hash)) from public.onboarding_events where event = 'leave' and created_at >= v_from and created_at < v_to),
    'median_seconds_to_complete', (
      select percentile_cont(0.5) within group (order by extract(epoch from (c.t - s0.t)))
      from (select session_key, min(created_at) as t from public.onboarding_events where event = 'start' and created_at >= v_from and created_at < v_to group by session_key) s0
      join (select session_key, min(created_at) as t from public.onboarding_events where event = 'complete' and created_at >= v_from and created_at < v_to group by session_key) c using (session_key)
      where c.t >= s0.t
    ),
    'top_goal', coalesce((select jsonb_agg(jsonb_build_object('value', v, 'count', n) order by n desc) from (select props->>'goal' as v, count(*) as n from public.onboarding_events where event = 'complete' and created_at >= v_from and created_at < v_to and props ? 'goal' group by 1 order by 2 desc limit 10) t), '[]'::jsonb),
    'top_team', coalesce((select jsonb_agg(jsonb_build_object('value', v, 'count', n) order by n desc) from (select props->>'team' as v, count(*) as n from public.onboarding_events where event = 'complete' and created_at >= v_from and created_at < v_to and props ? 'team' group by 1 order by 2 desc limit 10) t), '[]'::jsonb),
    'top_volume', coalesce((select jsonb_agg(jsonb_build_object('value', v, 'count', n) order by n desc) from (select props->>'volume' as v, count(*) as n from public.onboarding_events where event = 'complete' and created_at >= v_from and created_at < v_to and props ? 'volume' group by 1 order by 2 desc limit 10) t), '[]'::jsonb),
    'top_heard', coalesce((select jsonb_agg(jsonb_build_object('value', v, 'count', n) order by n desc) from (select props->>'heard' as v, count(*) as n from public.onboarding_events where event = 'complete' and created_at >= v_from and created_at < v_to and props ? 'heard' group by 1 order by 2 desc limit 12) t), '[]'::jsonb),
    'top_first_studio', coalesce((select jsonb_agg(jsonb_build_object('value', v, 'count', n) order by n desc) from (select props->>'primary' as v, count(*) as n from public.onboarding_events where event = 'complete' and created_at >= v_from and created_at < v_to and props ? 'primary' group by 1 order by 2 desc limit 12) t), '[]'::jsonb),
    'top_types', coalesce((select jsonb_agg(jsonb_build_object('value', v, 'count', n) order by n desc) from (select x as v, count(*) as n from public.onboarding_events, jsonb_array_elements_text(case when jsonb_typeof(props->'types') = 'array' then props->'types' else '[]'::jsonb end) x where event = 'complete' and created_at >= v_from and created_at < v_to group by 1 order by 2 desc limit 12) t), '[]'::jsonb),
    'top_studios', coalesce((select jsonb_agg(jsonb_build_object('value', v, 'count', n) order by n desc) from (select x as v, count(*) as n from public.onboarding_events, jsonb_array_elements_text(case when jsonb_typeof(props->'tools') = 'array' then props->'tools' else '[]'::jsonb end) x where event = 'complete' and created_at >= v_from and created_at < v_to group by 1 order by 2 desc limit 12) t), '[]'::jsonb),
    'keys', jsonb_build_object(
      'saved', (select count(distinct coalesce(clerk_user_id, anon_hash)) from public.onboarding_events where event = 'key_saved' and created_at >= v_from and created_at < v_to),
      'tested_ok', (select count(distinct coalesce(clerk_user_id, anon_hash)) from public.onboarding_events where event = 'key_tested' and props->>'ok' = 'true' and created_at >= v_from and created_at < v_to)
    )
  );
  return res;
end;
$$;
revoke all on function public.onboarding_funnel(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.onboarding_funnel(timestamptz, timestamptz) to service_role;

-- ---- retention: raw events are kept 180 days ------------------------------------------------------------
create or replace function public.prune_onboarding_events(p_days integer default 180) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  delete from public.onboarding_events where created_at < now() - make_interval(days => greatest(p_days, 30));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.prune_onboarding_events(integer) from public, anon, authenticated;
grant execute on function public.prune_onboarding_events(integer) to service_role;

-- Nightly prune when pg_cron exists (skipped, not failed, where it does not).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('smartvideo-prune-onboarding-events', '23 3 * * *', 'select public.prune_onboarding_events(180)');
  end if;
end $$;
