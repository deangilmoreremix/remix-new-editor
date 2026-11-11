-- ===========================================================================
-- retargeting_notifications.sql — behavioural interest scoring + owner alerts
--
-- Interest mapping lives in the published snapshot (immutable per revision):
--   project.interestMap = [{ id, title, start, end, interest: {type,label}, clipIds?: [..] }]
-- type: product | service | offer | topic | cta | pricing.
--
-- Raw observed events (video_events) are never modified. Scores are
-- CALCULATED here from raw events + the owner's rules, replaced idempotently
-- per session (so repeated or duplicate events cannot inflate them), capped
-- per interest, and decayed by age only when reported. Clients cannot submit a
-- score: ingest only accepts event types.
--
-- Segments are counts of anonymous sessions, never identified customers, and
-- there is no inference of sensitive attributes.
--
-- Notifications: in-app rows in owner_notifications, written by triggers on the
-- ingest tables, de-duplicated by dedupe_key, honouring owner preferences.
-- E-mail is NOT sent from the database: notification_email_queue is filled by
-- the scheduled function only when a delivery adapter is configured.
-- ===========================================================================

-- ---------------------------------------------------------------- owner config
create table if not exists public.retarget_rules (
  clerk_user_id text primary key default (auth.jwt() ->> 'sub'),
  weights jsonb not null default '{}'::jsonb check (jsonb_typeof(weights) = 'object'),
  interest_cap integer not null default 100 check (interest_cap between 10 and 500),
  half_life_days integer not null default 14 check (half_life_days between 1 and 365),
  updated_at timestamptz not null default now()
);

create table if not exists public.retarget_preferences (
  clerk_user_id text primary key default (auth.jwt() ->> 'sub'),
  enabled_types text[] not null default array[
    'new_lead', 'high_interest', 'pricing_cta', 'contact_cta', 'returning_engagement',
    'milestone', 'interest_surge', 'followup_opportunity', 'daily_digest'],
  in_app boolean not null default true,
  email boolean not null default false,
  digest_frequency text not null default 'daily' check (digest_frequency in ('off', 'daily', 'weekly')),
  interest_threshold integer not null default 60 check (interest_threshold between 10 and 500),
  quiet_hours jsonb check (quiet_hours is null or jsonb_typeof(quiet_hours) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists public.viewer_interests (
  session_id uuid not null references public.video_view_sessions (id) on delete cascade,
  video_id text not null references public.published_videos (id) on delete cascade,
  interest_key text not null check (char_length(interest_key) <= 80),
  interest_type text not null check (interest_type in ('product', 'service', 'offer', 'topic', 'cta', 'pricing')),
  section_id text,
  score integer not null check (score >= 0),
  updated_at timestamptz not null default now(),
  primary key (session_id, interest_key)
);
create index if not exists viewer_interests_video_idx on public.viewer_interests (video_id, interest_key);

create table if not exists public.owner_notifications (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  video_id text references public.published_videos (id) on delete cascade,
  project_id uuid,
  type text not null check (type in (
    'new_lead', 'high_interest', 'pricing_cta', 'contact_cta', 'returning_engagement',
    'milestone', 'interest_surge', 'followup_opportunity', 'daily_digest')),
  title text not null check (char_length(title) <= 200),
  summary text not null check (char_length(summary) <= 600),
  suggestion text check (suggestion is null or char_length(suggestion) <= 300),
  interest text check (interest is null or char_length(interest) <= 80),
  metrics jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (clerk_user_id, dedupe_key)
);
create index if not exists owner_notifications_owner_idx
  on public.owner_notifications (clerk_user_id, created_at desc);
create index if not exists owner_notifications_unread_idx
  on public.owner_notifications (clerk_user_id, created_at desc) where read_at is null;

create table if not exists public.notification_email_queue (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.owner_notifications (id) on delete cascade,
  clerk_user_id text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (notification_id)
);
create index if not exists notification_email_queue_due_idx
  on public.notification_email_queue (next_attempt_at) where status = 'pending';

alter table public.retarget_rules enable row level security;
alter table public.retarget_preferences enable row level security;
alter table public.viewer_interests enable row level security;
alter table public.owner_notifications enable row level security;
alter table public.notification_email_queue enable row level security;

do $$
declare t text;
begin
  foreach t in array array['retarget_rules', 'retarget_preferences'] loop
    execute format('drop policy if exists "Owners manage own settings" on public.%I', t);
    execute format($p$create policy "Owners manage own settings" on public.%I for all to authenticated
      using ((select auth.jwt() ->> 'sub') = clerk_user_id) with check ((select auth.jwt() ->> 'sub') = clerk_user_id)$p$, t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end $$;

drop policy if exists "Owners read own interests" on public.viewer_interests;
create policy "Owners read own interests" on public.viewer_interests for select to authenticated
  using (exists (select 1 from public.published_videos v
                  where v.id = viewer_interests.video_id and v.clerk_user_id = (select auth.jwt() ->> 'sub')));
revoke all on public.viewer_interests from anon, authenticated;
grant select on public.viewer_interests to authenticated;

drop policy if exists "Owners read own notifications" on public.owner_notifications;
drop policy if exists "Owners mark own notifications" on public.owner_notifications;
create policy "Owners read own notifications" on public.owner_notifications for select to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);
create policy "Owners mark own notifications" on public.owner_notifications for update to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id) with check ((select auth.jwt() ->> 'sub') = clerk_user_id);
revoke all on public.owner_notifications from anon, authenticated;
grant select on public.owner_notifications to authenticated;
grant update (read_at) on public.owner_notifications to authenticated; -- nothing else is editable

revoke all on public.notification_email_queue from anon, authenticated; -- service role only

-- ---------------------------------------------------------------- helpers
create or replace function public._rule_weights(p_owner text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select '{"watch50":10,"watch90":20,"rewatch":15,"click":25,"pricing":30,"return":15,"lead":40}'::jsonb
         || coalesce((select weights from public.retarget_rules where clerk_user_id = p_owner), '{}'::jsonb);
$$;

create or replace function public._clip_label(p_project jsonb, p_clip text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(coalesce(c ->> 'buttonText', c ->> 'ctaText', c ->> 'heading',
                               c -> 'addon' ->> 'buttonText', c -> 'addon' ->> 'text', c ->> 'name')), '')
    from jsonb_array_elements(coalesce(p_project -> 'tracks', '[]'::jsonb)) t,
         jsonb_array_elements(coalesce(t -> 'items', t -> 'clips', '[]'::jsonb)) c
   where p_clip is not null and c ->> 'id' = p_clip
   limit 1;
$$;

-- Owner wording only (never viewer-supplied): does a CTA label talk about price?
create or replace function public._is_pricing_label(p_label text)
returns boolean
language sql immutable set search_path = ''
as $$ select coalesce(p_label ~* '(pric|cost|quote|estimate|\mrates?\M|\mfees?\M|\$)', false); $$;

create or replace function public._is_contact_label(p_label text)
returns boolean
language sql immutable set search_path = ''
as $$ select coalesce(p_label ~* '(contact|call|book|consult|schedule|appointment|talk to|speak)', false); $$;

-- ---------------------------------------------------------------- scoring
create or replace function public.recompute_session_interests(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.video_view_sessions;
  v record;
  w jsonb;
  cap integer;
  dur numeric;
  entry jsonb;
  clips text[];
  key text;
  itype text;
  sec_id text;
  st numeric; en numeric;
  b0 integer; b1 integer; total integer; seen integer; frac numeric;
  sc integer;
  clip text;
  lbl text;
  clicked boolean; priced boolean; led boolean;
  any_pricing boolean := false; any_lead boolean := false;
begin
  select * into s from public.video_view_sessions where id = p_session;
  if not found then return; end if;
  select pv.clerk_user_id, pv.project, (pv.project ->> 'timelineSeconds')::numeric as dur into v
    from public.published_videos pv where pv.id = s.video_id;
  if not found then return; end if;
  w := public._rule_weights(v.clerk_user_id);
  cap := coalesce((select interest_cap from public.retarget_rules where clerk_user_id = v.clerk_user_id), 100);
  dur := v.dur;

  delete from public.viewer_interests where session_id = p_session;
  if jsonb_typeof(v.project -> 'interestMap') = 'array' and dur is not null and dur > 0 then
    for entry in select value from jsonb_array_elements(v.project -> 'interestMap') loop
      key := nullif(left(coalesce(entry -> 'interest' ->> 'label', entry ->> 'title'), 80), '');
      itype := coalesce(entry -> 'interest' ->> 'type', 'topic');
      if key is null or itype not in ('product', 'service', 'offer', 'topic', 'cta', 'pricing') then continue; end if;
      sec_id := left(entry ->> 'id', 80);
      st := (entry ->> 'start')::numeric; en := (entry ->> 'end')::numeric;
      if st is null or en is null or en <= st then continue; end if;
      b0 := least(99, greatest(0, floor(st / dur * 100)::integer));
      b1 := least(99, greatest(b0, ceil(en / dur * 100)::integer - 1));
      total := b1 - b0 + 1;
      select count(*) into seen from unnest(s.covered) b where b between b0 and b1;
      frac := seen::numeric / total;
      sc := 0;
      if frac >= 0.9 then sc := sc + (w ->> 'watch90')::integer;
      elsif frac >= 0.5 then sc := sc + (w ->> 'watch50')::integer; end if;
      if exists (select 1 from public.video_events e where e.session_id = p_session and e.type = 'section_rewatch' and e.section_id = sec_id) then
        sc := sc + (w ->> 'rewatch')::integer;
      end if;
      if s.is_return and frac >= 0.5 then sc := sc + (w ->> 'return')::integer; end if;

      clips := array(select jsonb_array_elements_text(coalesce(entry -> 'clipIds', '[]'::jsonb)));
      clicked := false; priced := false; led := false;
      for clip in select unnest(clips) loop
        if exists (select 1 from public.video_events e where e.session_id = p_session and e.clip_id = clip
                    and e.type in ('cta_click', 'call_click', 'product_select', 'overlay_click')) then
          clicked := true;
          if public._is_pricing_label(public._clip_label(v.project, clip)) then priced := true; end if;
        end if;
        if exists (select 1 from public.video_events e where e.session_id = p_session and e.clip_id = clip and e.type = 'lead_submit') then
          led := true;
        end if;
      end loop;
      -- Each interaction counts once per interest, however often it is repeated.
      if clicked then sc := sc + (w ->> 'click')::integer; end if;
      if priced then sc := sc + (w ->> 'pricing')::integer; end if;
      if led then sc := sc + (w ->> 'lead')::integer; end if;

      sc := least(sc, cap);
      if sc > 0 then
        insert into public.viewer_interests (session_id, video_id, interest_key, interest_type, section_id, score)
        values (p_session, s.video_id, key, itype, sec_id, sc)
        on conflict (session_id, interest_key) do update set score = least(cap, public.viewer_interests.score + excluded.score), updated_at = now();
      end if;
    end loop;
  end if;

  -- Unmapped pricing / inquiry behaviour still counts, as its own interests.
  for clip, lbl in
    select distinct e.clip_id, public._clip_label(v.project, e.clip_id) from public.video_events e
     where e.session_id = p_session and e.type in ('cta_click', 'call_click', 'product_select', 'overlay_click') and e.clip_id is not null
  loop
    if public._is_pricing_label(lbl) then any_pricing := true; end if;
  end loop;
  select exists (select 1 from public.video_events e where e.session_id = p_session and e.type = 'lead_submit') into any_lead;
  if any_pricing and not exists (select 1 from public.viewer_interests where session_id = p_session and interest_type = 'pricing') then
    insert into public.viewer_interests (session_id, video_id, interest_key, interest_type, score)
    values (p_session, s.video_id, 'Pricing', 'pricing', least(cap, (w ->> 'pricing')::integer));
  end if;
  if any_lead and not exists (select 1 from public.viewer_interests where session_id = p_session and score >= (w ->> 'lead')::integer) then
    insert into public.viewer_interests (session_id, video_id, interest_key, interest_type, score)
    values (p_session, s.video_id, 'Inquiry', 'cta', least(cap, (w ->> 'lead')::integer))
    on conflict (session_id, interest_key) do nothing;
  end if;
end;
$$;
revoke all on function public.recompute_session_interests(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- notifications
create or replace function public._notify(
  p_owner text, p_video text, p_type text, p_title text, p_summary text, p_suggestion text,
  p_interest text, p_metrics jsonb, p_dedupe text, p_bump boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare pref public.retarget_preferences;
begin
  select * into pref from public.retarget_preferences where clerk_user_id = p_owner;
  if found and (not pref.in_app or not (p_type = any(pref.enabled_types))) then return; end if;
  insert into public.owner_notifications (clerk_user_id, video_id, project_id, type, title, summary, suggestion, interest, metrics, dedupe_key)
  values (p_owner, p_video, (select project_id from public.published_videos where id = p_video), p_type,
          left(p_title, 200), left(p_summary, 600), left(p_suggestion, 300), left(p_interest, 80), coalesce(p_metrics, '{}'::jsonb), p_dedupe)
  on conflict (clerk_user_id, dedupe_key) do update
    set metrics = case when p_bump
                       then public.owner_notifications.metrics || jsonb_build_object('count', coalesce((public.owner_notifications.metrics ->> 'count')::int, 1) + 1)
                       else public.owner_notifications.metrics end;
end;
$$;
revoke all on function public._notify(text, text, text, text, text, text, text, jsonb, text, boolean) from public, anon, authenticated;

-- Per-event alerts: lead, pricing click, contact click. Repeated clicks do not
-- create repeated alerts (session key for leads; hourly bucket for CTA clicks).
create or replace function public._on_video_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pv record;
  lbl text;
  hour text := to_char(now() at time zone 'utc', 'YYYYMMDDHH24');
begin
  if new.type not in ('lead_submit', 'cta_click', 'call_click', 'product_select', 'overlay_click') then return new; end if;
  select clerk_user_id, title, project into pv from public.published_videos where id = new.video_id;
  if not found then return new; end if;
  lbl := public._clip_label(pv.project, new.clip_id);

  if new.type = 'lead_submit' then
    perform public._notify(pv.clerk_user_id, new.video_id, 'new_lead', 'New lead captured',
      format('A viewer submitted a form on "%s".', pv.title), 'Review the inquiry in your leads.', null,
      jsonb_build_object('clip', new.clip_id, 'label', lbl, 'count', 1), 'lead:' || new.session_id || ':' || coalesce(new.clip_id, ''));
  elsif public._is_pricing_label(lbl) then
    perform public._notify(pv.clerk_user_id, new.video_id, 'pricing_cta', 'Pricing interest',
      format('Viewers clicked "%s" on "%s".', coalesce(lbl, 'a pricing link'), pv.title),
      'Consider a pricing explainer or quote follow-up video.', 'Pricing',
      jsonb_build_object('clip', new.clip_id, 'label', lbl, 'count', 1), 'price:' || new.video_id || ':' || hour, true);
  elsif new.type = 'call_click' or public._is_contact_label(lbl) then
    perform public._notify(pv.clerk_user_id, new.video_id, 'contact_cta', 'Contact action taken',
      format('Viewers used "%s" on "%s".', coalesce(lbl, 'a contact button'), pv.title),
      'Be ready to respond quickly to new inquiries.', null,
      jsonb_build_object('clip', new.clip_id, 'label', lbl, 'count', 1), 'contact:' || new.video_id || ':' || hour, true);
  end if;
  return new;
end;
$$;
revoke all on function public._on_video_event() from public, anon, authenticated;
drop trigger if exists video_events_notify on public.video_events;
create trigger video_events_notify after insert on public.video_events
  for each row execute function public._on_video_event();

-- Per-session alerts: recompute interests when playback state changes, then
-- high-interest / returning-viewer / milestone alerts.
create or replace function public._on_session_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pv record;
  pref_threshold integer;
  top record;
  plays bigint;
  m integer;
begin
  if new.event_count = old.event_count and new.covered = old.covered then return new; end if;
  select clerk_user_id, title into pv from public.published_videos where id = new.video_id;
  if not found then return new; end if;

  perform public.recompute_session_interests(new.id);

  pref_threshold := coalesce((select interest_threshold from public.retarget_preferences where clerk_user_id = pv.clerk_user_id), 60);
  select interest_key, interest_type, score into top from public.viewer_interests
   where session_id = new.id order by score desc, interest_key limit 1;

  if top.score is not null and top.score >= pref_threshold then
    perform public._notify(pv.clerk_user_id, new.video_id, 'high_interest', 'High-interest viewer',
      format('A viewing session showed strong interest in "%s" on "%s".', top.interest_key, pv.title),
      format('Create a follow-up about %s.', top.interest_key), top.interest_key,
      jsonb_build_object('score', top.score, 'threshold', pref_threshold, 'type', top.interest_type, 'returning', new.is_return),
      'hi:' || new.video_id || ':' || new.id);
    if new.is_return then
      perform public._notify(pv.clerk_user_id, new.video_id, 'returning_engagement', 'Returning viewer is more engaged',
        format('A returning viewer engaged again with "%s".', top.interest_key),
        'Review audience insights for this video.', top.interest_key,
        jsonb_build_object('score', top.score), 'ret:' || new.video_id || ':' || new.id);
    end if;
  end if;

  if new.played and not old.played then
    select coalesce(sum(a.plays), 0) into plays from public.video_analytics_daily a where a.video_id = new.video_id;
    foreach m in array array[100, 500, 1000, 5000, 10000] loop
      if plays >= m then
        perform public._notify(pv.clerk_user_id, new.video_id, 'milestone', format('%s plays reached', m),
          format('"%s" has been played %s times.', pv.title, m), null, null,
          jsonb_build_object('plays', m), 'ms:' || new.video_id || ':' || m);
      end if;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function public._on_session_change() from public, anon, authenticated;
drop trigger if exists video_sessions_interest on public.video_view_sessions;
create trigger video_sessions_interest after update on public.video_view_sessions
  for each row execute function public._on_session_change();

-- ---------------------------------------------------------------- reporting
-- Scores are decayed by age here (not stored): half-life from the owner's rules.
create or replace function public.video_interest_summary(p_video_id text, p_from date, p_to date)
returns table (interest text, interest_type text, sessions bigint, decayed_score numeric, high_interest_sessions bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with cfg as (
    select coalesce((select half_life_days from public.retarget_rules where clerk_user_id = (select auth.jwt() ->> 'sub')), 14) as hl,
           coalesce((select interest_threshold from public.retarget_preferences where clerk_user_id = (select auth.jwt() ->> 'sub')), 60) as thr),
  rows as (
    select i.interest_key, i.interest_type, i.session_id,
           i.score * power(0.5, greatest(0, extract(epoch from (now() - s.started_at)) / 86400.0) / (select hl from cfg)) as d
      from public.viewer_interests i
      join public.video_view_sessions s on s.id = i.session_id
     where i.video_id = p_video_id and (s.started_at at time zone 'utc')::date between p_from and p_to)
  select r.interest_key, r.interest_type, count(*), round(sum(r.d), 1), count(*) filter (where r.d >= (select thr from cfg))
    from rows r group by r.interest_key, r.interest_type order by sum(r.d) desc limit 50;
$$;

-- Anonymous behavioural segments (sessions, not people).
create or replace function public.video_audience_segments(p_video_id text, p_from date, p_to date)
returns table (segment text, sessions bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with cfg as (
    select coalesce((select interest_threshold from public.retarget_preferences where clerk_user_id = (select auth.jwt() ->> 'sub')), 60) as thr),
  ss as (
    select s.* from public.video_view_sessions s
     where s.video_id = p_video_id and s.played and (s.started_at at time zone 'utc')::date between p_from and p_to),
  ev as (
    select e.session_id,
           bool_or(e.type in ('cta_click', 'call_click', 'product_select', 'overlay_click')) as clicked,
           bool_or(e.type = 'lead_submit') as led
      from public.video_events e join ss on ss.id = e.session_id group by e.session_id),
  it as (
    select i.session_id, max(i.score) as top,
           bool_or(i.interest_type = 'product' and i.score >= 20) as prod,
           bool_or(i.interest_type = 'service' and i.score >= 20) as serv,
           bool_or(i.interest_type = 'pricing' and i.score >= 20) as price
      from public.viewer_interests i join ss on ss.id = i.session_id group by i.session_id)
  select x.segment, x.n from (
    select 'new_viewers' as segment, count(*) filter (where not ss.is_return) as n from ss
    union all select 'returning_viewers', count(*) filter (where ss.is_return) from ss
    union all select 'highly_engaged', count(*) filter (where ss.max_progress >= 0.75) from ss
    union all select 'product_interested', count(*) filter (where it.prod) from ss left join it on it.session_id = ss.id
    union all select 'service_interested', count(*) filter (where it.serv) from ss left join it on it.session_id = ss.id
    union all select 'pricing_interested', count(*) filter (where it.price) from ss left join it on it.session_id = ss.id
    union all select 'cta_clickers', count(*) filter (where ev.clicked) from ss left join ev on ev.session_id = ss.id
    union all select 'lead_submitters', count(*) filter (where ev.led) from ss left join ev on ev.session_id = ss.id
    union all select 'high_interest', count(*) filter (where it.top >= (select thr from cfg)) from ss left join it on it.session_id = ss.id
  ) x;
$$;

-- Section engagement from real retention buckets (average share of the section's
-- 1% slices that played sessions covered).
create or replace function public.video_section_engagement(p_video_id text, p_sections jsonb)
returns table (section_id text, engagement_percent numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (select count(*) as n from public.video_view_sessions where video_id = p_video_id and played),
  dur as (select (project ->> 'timelineSeconds')::numeric as d from public.published_videos where id = p_video_id)
  select sec ->> 'id',
         case when (select n from base) = 0 or (select d from dur) is null or (select d from dur) <= 0 then null
              else round(100.0 * coalesce((
                select avg(r.viewers)::numeric from public.video_retention_buckets r
                 where r.video_id = p_video_id
                   and r.bucket between least(99, greatest(0, floor((sec ->> 'start')::numeric / (select d from dur) * 100)::int))
                                    and least(99, greatest(0, ceil((sec ->> 'end')::numeric / (select d from dur) * 100)::int - 1))
              ), 0) / (select n from base), 1) end
    from jsonb_array_elements(p_sections) sec;
$$;

-- Notifications: list, count, mark read, preferences.
create or replace function public.owner_unread_notifications()
returns bigint
language sql stable security invoker set search_path = ''
as $$ select count(*) from public.owner_notifications where read_at is null; $$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare n integer;
begin
  update public.owner_notifications set read_at = now()
   where read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------- scheduled jobs (service role)
create or replace function public.detect_interest_surges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare r record; n integer := 0; wk text := to_char(now() at time zone 'utc', 'IYYY-IW');
begin
  for r in
    with cur as (
      select i.video_id, i.interest_key, count(*) as c from public.viewer_interests i
        join public.video_view_sessions s on s.id = i.session_id
       where s.started_at >= now() - interval '7 days' and i.score >= 20 group by 1, 2),
    prev as (
      select i.video_id, i.interest_key, count(*) as c from public.viewer_interests i
        join public.video_view_sessions s on s.id = i.session_id
       where s.started_at >= now() - interval '14 days' and s.started_at < now() - interval '7 days' and i.score >= 20 group by 1, 2)
    select cur.video_id, cur.interest_key, cur.c as cur_c, coalesce(prev.c, 0) as prev_c, pv.clerk_user_id, pv.title
      from cur left join prev using (video_id, interest_key)
      join public.published_videos pv on pv.id = cur.video_id
     where cur.c >= 5 and cur.c >= 2 * coalesce(prev.c, 0)
  loop
    perform public._notify(r.clerk_user_id, r.video_id, 'interest_surge', format('Interest in %s is rising', r.interest_key),
      format('%s sessions showed interest in "%s" on "%s" this week, up from %s last week.', r.cur_c, r.interest_key, r.title, r.prev_c),
      'Consider a follow-up video about this topic.', r.interest_key,
      jsonb_build_object('current', r.cur_c, 'previous', r.prev_c), 'surge:' || r.video_id || ':' || r.interest_key || ':' || wk);
    perform public._notify(r.clerk_user_id, r.video_id, 'followup_opportunity', format('Follow-up opportunity: %s', r.interest_key),
      format('%s sessions showed strong interest in %s.', r.cur_c, r.interest_key),
      'Create a personalized follow-up video for this interest.', r.interest_key,
      jsonb_build_object('sessions', r.cur_c), 'fu:' || r.video_id || ':' || r.interest_key || ':' || wk);
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.build_daily_digests(p_weekly boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare r record; n integer := 0;
  span integer := case when p_weekly then 7 else 1 end;
  today date := (now() at time zone 'utc')::date;
begin
  for r in
    select pv.clerk_user_id,
           coalesce(sum(a.plays), 0) as plays, coalesce(sum(a.leads), 0) as leads,
           coalesce(sum(a.cta_clicks) + sum(a.call_clicks), 0) as ctas
      from public.published_videos pv
      join public.video_analytics_daily a on a.video_id = pv.id and a.day >= today - span and a.day < today
      left join public.retarget_preferences p on p.clerk_user_id = pv.clerk_user_id
     where coalesce(p.digest_frequency, 'daily') = case when p_weekly then 'weekly' else 'daily' end
     group by pv.clerk_user_id
    having coalesce(sum(a.plays), 0) + coalesce(sum(a.leads), 0) > 0
  loop
    perform public._notify(r.clerk_user_id, null, 'daily_digest',
      case when p_weekly then 'Your weekly video summary' else 'Your daily video summary' end,
      format('%s plays, %s CTA/call interactions and %s leads across your published videos.', r.plays, r.ctas, r.leads),
      'Open Projects to see what changed.', null,
      jsonb_build_object('plays', r.plays, 'ctas', r.ctas, 'leads', r.leads, 'period_days', span),
      case when p_weekly then 'wk:' || to_char(today, 'IYYY-IW') else 'day:' || today end);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.detect_interest_surges() from public, anon, authenticated;
revoke all on function public.build_daily_digests(boolean) from public, anon, authenticated;
grant execute on function public.detect_interest_surges() to service_role;
grant execute on function public.build_daily_digests(boolean) to service_role;

revoke all on function public.video_interest_summary(text, date, date) from public;
revoke all on function public.video_audience_segments(text, date, date) from public;
revoke all on function public.video_section_engagement(text, jsonb) from public;
revoke all on function public.owner_unread_notifications() from public;
revoke all on function public.mark_notifications_read(uuid[]) from public;
grant execute on function public.video_interest_summary(text, date, date) to authenticated;
grant execute on function public.video_audience_segments(text, date, date) to authenticated;
grant execute on function public.video_section_engagement(text, jsonb) to authenticated;
grant execute on function public.owner_unread_notifications() to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
