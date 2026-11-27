-- ===========================================================================
-- domain_claims_hardening.sql
--
-- Follow-up to 20261119150000 / 20261119170000 / 20261120120000 (custom domains and the admin alert).
--
--   1. Only an APPROVED domain is exclusive. Until now the unique index also covered unverified claims, so anyone
--      could lock a hostname they do not own just by typing it. Several businesses may now claim the same
--      hostname; the administrator approves the right one (a second approval of the same hostname fails on the index).
--   2. set_custom_domain refuses a hostname another business already has approved ('domain_taken'), does nothing
--      when the domain is unchanged, and allows 5 changes per business per hour ('rate_limited'), so one account
--      cannot flood the alert e-mails or the table.
--   3. One open alert per (business, domain) instead of per domain, and the alert remembers the owner id so a later
--      business rename cannot strand it.
-- ===========================================================================

-- 1. exclusivity only for approved domains ---------------------------------
drop index if exists public.video_owner_profiles_custom_domain_key;
create unique index if not exists video_owner_profiles_verified_domain_key
  on public.video_owner_profiles (custom_domain)
  where custom_domain is not null and custom_domain_verified;
create index if not exists video_owner_profiles_custom_domain_idx
  on public.video_owner_profiles (custom_domain)
  where custom_domain is not null;

-- 2. rate limit -------------------------------------------------------------
create table if not exists public.custom_domain_changes (
  clerk_user_id text not null,
  changed_at timestamptz not null default now()
);
alter table public.custom_domain_changes enable row level security; -- no policies: only the function below writes
revoke all on public.custom_domain_changes from anon, authenticated;
create index if not exists custom_domain_changes_user_idx on public.custom_domain_changes (clerk_user_id, changed_at desc);

create or replace function public.set_custom_domain(p_domain text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me text := auth.jwt() ->> 'sub';
  d text := nullif(lower(btrim(coalesce(p_domain, ''))), '');
  cur text;
  recent integer;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select custom_domain into cur from public.video_owner_profiles where clerk_user_id = me;
  if not found then raise exception 'business_required' using errcode = '22023'; end if;
  if cur is not distinct from d then return d; end if; -- nothing to change: no alert, no count

  delete from public.custom_domain_changes where changed_at < now() - interval '1 day';
  select count(*) into recent from public.custom_domain_changes
   where clerk_user_id = me and changed_at > now() - interval '1 hour';
  if recent >= 5 then raise exception 'rate_limited' using errcode = '54000'; end if;
  insert into public.custom_domain_changes (clerk_user_id) values (me);

  if d is not null and exists (
    select 1 from public.video_owner_profiles
     where custom_domain = d and custom_domain_verified and clerk_user_id <> me
  ) then
    raise exception 'domain_taken' using errcode = '23505';
  end if;

  begin
    update public.video_owner_profiles
       set custom_domain = d,
           custom_domain_verified = false,
           updated_at = now()
     where clerk_user_id = me;
  exception
    when unique_violation then raise exception 'domain_taken' using errcode = '23505';
    when check_violation then raise exception 'invalid_domain' using errcode = '22023';
  end;
  return d;
end;
$$;
revoke all on function public.set_custom_domain(text) from public, anon;
grant execute on function public.set_custom_domain(text) to authenticated;

-- 3. alerts: per (business, domain), and the owner id ---------------------------
alter table public.custom_domain_alerts add column if not exists owner_id text;
drop index if exists public.custom_domain_alerts_open_key;
create unique index if not exists custom_domain_alerts_open_key
  on public.custom_domain_alerts (business_slug, domain) where sent_at is null;
create index if not exists custom_domain_alerts_sent_idx
  on public.custom_domain_alerts (sent_at) where sent_at is not null;

create or replace function public.custom_domain_notify_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg record;
  alert_id bigint;
begin
  -- 1. The durable record. Its own block, so a later failure cannot roll it back.
  begin
    insert into public.custom_domain_alerts (business_slug, domain, owner_id)
    values (NEW.business_slug, NEW.custom_domain, NEW.clerk_user_id)
    on conflict (business_slug, domain) where sent_at is null do nothing
    returning id into alert_id;
  exception when others then
    return NEW; -- saving a domain must never fail because of an alert
  end;
  if alert_id is null then return NEW; end if; -- an alert for this business and domain is already waiting

  -- 2. The instant e-mail, best effort. If it fails the row above stays and the sweep sends it.
  begin
    if to_regnamespace('net') is null then return NEW; end if;
    select admin_alert_url, secret into cfg from public.push_dispatch_config where id = 1;
    if not found or coalesce(cfg.admin_alert_url, '') = '' then return NEW; end if;
    perform net.http_post(
      url := cfg.admin_alert_url,
      body := jsonb_build_object('alert_id', alert_id),
      headers := jsonb_build_object('x-push-secret', coalesce(cfg.secret, ''), 'content-type', 'application/json')
    );
  exception when others then
    null; -- the sweep retries
  end;
  return NEW;
end;
$$;
revoke all on function public.custom_domain_notify_admin() from public, anon, authenticated;
