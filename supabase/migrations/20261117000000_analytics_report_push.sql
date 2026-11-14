-- Analytics report + web push (Stage 11).
--
-- 1. analytics_report(): ONE owner-checked read for the results dashboard and PDF report. The existing analytics functions are SECURITY
--    INVOKER and rely on a signed-in Supabase client; the personalization server routes use the service role instead, so this function
--    checks ownership itself (a video that is not yours reads exactly like one that does not exist) before it assembles the report from
--    the existing functions and the recipient links.
-- 2. push_subscriptions: a browser's Web Push subscription, owned by a Clerk user id (opt-in; the browser creates it after the owner
--    clicks "Turn on"). Keys are needed by the sender, so they are stored, but only security-definer RPCs for service_role touch them.
-- 3. Push is driven by the EXISTING owner_notifications rows (already de-duplicated by the trigger on video events and filtered by the
--    owner's preferences): push_claim_for_video() atomically marks the not-yet-pushed alerts as pushed and returns them with the owner's
--    subscriptions. At-most-once by design: two events arriving together can never push the same alert twice; if a send then fails the
--    alert stays in the in-app list and is not retried.
--
-- NOT applied to any Supabase project by this change.

-- ---------------------------------------------------------------- owner_notifications: when was it pushed
alter table public.owner_notifications add column if not exists pushed_at timestamptz;
create index if not exists owner_notifications_unpushed_idx on public.owner_notifications (video_id, created_at) where pushed_at is null;

-- ---------------------------------------------------------------- subscriptions
create table if not exists public.push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  clerk_user_id    text not null,
  endpoint_hash    text not null,
  endpoint         text not null,
  p256dh           text not null,
  auth             text not null,
  device_label     text,
  created_at       timestamptz not null default now(),
  last_success_at  timestamptz,
  constraint push_subscriptions_endpoint_check check (endpoint ~ '^https://[^[:space:]]+$' and char_length(endpoint) <= 1000),
  constraint push_subscriptions_p256dh_check check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  constraint push_subscriptions_auth_check check (auth ~ '^[A-Za-z0-9_-]{20,32}$'),
  constraint push_subscriptions_hash_check check (endpoint_hash ~ '^[a-f0-9]{64}$')
);
comment on table public.push_subscriptions is
  'Web Push subscriptions (opt-in) owned by a Clerk user id. See netlify/functions/_personalization/app/api/personalization/push/route.ts.';
create unique index if not exists push_subscriptions_endpoint_uidx on public.push_subscriptions (endpoint_hash);
create index if not exists push_subscriptions_owner_idx on public.push_subscriptions (clerk_user_id, created_at desc);

alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions for select
  using (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));
revoke all on table public.push_subscriptions from anon, authenticated;

-- Saves (or moves to this owner) a subscription. The endpoint is a capability only the browser holds, so a browser that signs in as a
-- different user simply becomes that user's device. At most 10 devices per owner: the oldest are dropped.
create or replace function public.push_subscription_save(p_clerk_user_id text, p_endpoint text, p_p256dh text, p_auth text, p_device_label text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then raise exception 'push_subscription_save: clerk_user_id is required' using errcode = '28000'; end if;
  insert into public.push_subscriptions (clerk_user_id, endpoint_hash, endpoint, p256dh, auth, device_label)
  values (p_clerk_user_id, encode(sha256(convert_to(p_endpoint, 'UTF8')), 'hex'), p_endpoint, p_p256dh, p_auth, left(nullif(btrim(p_device_label), ''), 60))
  on conflict (endpoint_hash) do update
    set clerk_user_id = excluded.clerk_user_id, p256dh = excluded.p256dh, auth = excluded.auth, device_label = excluded.device_label, last_success_at = null;
  delete from public.push_subscriptions
   where clerk_user_id = p_clerk_user_id
     and id not in (select id from public.push_subscriptions where clerk_user_id = p_clerk_user_id order by created_at desc, id limit 10);
  select count(*) into n from public.push_subscriptions where clerk_user_id = p_clerk_user_id;
  return n;
end;
$$;

-- true when one of the caller's own subscriptions was removed.
create or replace function public.push_subscription_remove(p_clerk_user_id text, p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then raise exception 'push_subscription_remove: clerk_user_id is required' using errcode = '28000'; end if;
  delete from public.push_subscriptions where clerk_user_id = p_clerk_user_id and endpoint_hash = encode(sha256(convert_to(p_endpoint, 'UTF8')), 'hex');
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- The owner's own devices, without keys (for the settings panel).
create or replace function public.push_subscriptions_list(p_clerk_user_id text)
returns table (device_label text, created_at timestamptz, last_success_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then raise exception 'push_subscriptions_list: clerk_user_id is required' using errcode = '28000'; end if;
  return query select s.device_label, s.created_at, s.last_success_at from public.push_subscriptions s where s.clerk_user_id = p_clerk_user_id order by s.created_at desc limit 10;
end;
$$;

-- The push service said the subscription is gone (404/410): forget it. Also records successes.
create or replace function public.push_subscription_report(p_gone text[], p_ok text[])
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.push_subscriptions where endpoint = any (coalesce(p_gone, '{}'));
  update public.push_subscriptions set last_success_at = now() where endpoint = any (coalesce(p_ok, '{}'));
$$;

-- All of the caller's subscriptions (used for the "send me a test" button).
create or replace function public.push_subscriptions_for_owner(p_clerk_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then raise exception 'push_subscriptions_for_owner: clerk_user_id is required' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth) order by created_at desc) from public.push_subscriptions where clerk_user_id = p_clerk_user_id), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------- claiming alerts to push
-- Only alerts that someone did something about (not digests or milestones), created in the last 10 minutes (a late claim must not
-- announce old news), at most p_limit per call. Nothing is claimed when the owner has no subscription, so a device added later is not
-- flooded with history. The UPDATE ... RETURNING is the claim: concurrent callers cannot both get the same row.
create or replace function public.push_claim_for_video(p_video_id text, p_limit integer default 3)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_owner text; v_subs jsonb; v_rows jsonb;
begin
  select clerk_user_id into v_owner from public.published_videos where id = p_video_id;
  if v_owner is null then return jsonb_build_object('notifications', '[]'::jsonb, 'subscriptions', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]'::jsonb) into v_subs
    from public.push_subscriptions where clerk_user_id = v_owner;
  if v_subs = '[]'::jsonb then return jsonb_build_object('notifications', '[]'::jsonb, 'subscriptions', '[]'::jsonb); end if;
  with c as (
    update public.owner_notifications n set pushed_at = now()
     where n.id in (select id from public.owner_notifications
                     where clerk_user_id = v_owner and video_id = p_video_id and pushed_at is null and read_at is null
                       and created_at > now() - interval '10 minutes'
                       and type in ('new_lead', 'pricing_cta', 'contact_cta', 'high_interest', 'returning_engagement')
                     order by created_at limit least(greatest(coalesce(p_limit, 3), 1), 10)
                       for update skip locked)
    returning n.id, n.type, n.title, n.summary, n.video_id)
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'type', type, 'title', title, 'summary', summary, 'video_id', video_id)), '[]'::jsonb) into v_rows from c;
  return jsonb_build_object('notifications', v_rows, 'subscriptions', case when v_rows = '[]'::jsonb then '[]'::jsonb else v_subs end);
end;
$$;

-- ---------------------------------------------------------------- the report
-- Owner-checked. Returns null when the video is not the caller's (or does not exist): the two are indistinguishable.
create or replace function public.analytics_report(p_clerk_user_id text, p_video_id text, p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_title text; v_pub boolean; v_from date; v_to date; v_summary jsonb; v_daily jsonb; v_ret jsonb; v_cta jsonb; v_rec jsonb;
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then raise exception 'analytics_report: clerk_user_id is required' using errcode = '28000'; end if;
  select title, published into v_title, v_pub from public.published_videos where id = p_video_id and clerk_user_id = p_clerk_user_id;
  if not found then return null; end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  v_to := coalesce(p_to, (now() at time zone 'utc')::date);
  v_from := coalesce(p_from, v_to - 29);
  if v_from > v_to then raise exception 'analytics_report: from is after to' using errcode = '22023'; end if;
  if v_to - v_from > 365 then raise exception 'analytics_report: at most 366 days' using errcode = '22023'; end if;

  v_summary := public.video_analytics_summary(p_video_id, v_from, v_to);
  select coalesce(jsonb_agg(to_jsonb(t) order by t.day), '[]'::jsonb) into v_daily from public.video_analytics_timeseries(p_video_id, v_from, v_to) t;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.bucket), '[]'::jsonb) into v_ret from public.video_retention_curve(p_video_id, v_from, v_to) t;
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_cta from public.video_cta_performance(p_video_id, v_from, v_to) t;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.views desc, l.label), '[]'::jsonb) into v_rec
    from (select r.id, r.label, case when r.revoked_at is not null then 'revoked' when r.expires_at is not null and r.expires_at <= now() then 'expired' else 'live' end as status,
                 r.views, r.plays, r.completes, r.cta_clicks, r.leads, r.last_seen
            from public.recipient_links_list(p_clerk_user_id, p_video_id) r limit 500) l;
  return jsonb_build_object('video', jsonb_build_object('id', p_video_id, 'title', v_title, 'published', v_pub),
    'period', jsonb_build_object('from', v_from, 'to', v_to), 'summary', v_summary, 'daily', v_daily, 'retention', v_ret, 'cta', v_cta, 'recipients', v_rec, 'generated_at', now());
end;
$$;

-- ---------------------------------------------------------------- privileges: service_role only
revoke all on function public.push_subscription_save(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.push_subscription_remove(text, text) from public, anon, authenticated;
revoke all on function public.push_subscriptions_list(text) from public, anon, authenticated;
revoke all on function public.push_subscription_report(text[], text[]) from public, anon, authenticated;
revoke all on function public.push_subscriptions_for_owner(text) from public, anon, authenticated;
revoke all on function public.push_claim_for_video(text, integer) from public, anon, authenticated;
revoke all on function public.analytics_report(text, text, date, date) from public, anon, authenticated;
grant execute on function public.push_subscription_save(text, text, text, text, text) to service_role;
grant execute on function public.push_subscription_remove(text, text) to service_role;
grant execute on function public.push_subscriptions_list(text) to service_role;
grant execute on function public.push_subscription_report(text[], text[]) to service_role;
grant execute on function public.push_subscriptions_for_owner(text) to service_role;
grant execute on function public.push_claim_for_video(text, integer) to service_role;
grant execute on function public.analytics_report(text, text, date, date) to service_role;
