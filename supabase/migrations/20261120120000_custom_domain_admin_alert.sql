-- ===========================================================================
-- custom_domain_admin_alert.sql
--
-- Tell the administrators when an owner saves a custom domain.
--
-- A domain only serves after an administrator adds it as a hosting alias and sets
-- custom_domain_verified = true (see 20261119170000_custom_domain_verified.sql).
-- Until now nothing told them a domain was waiting.
--
--   custom_domain_alerts          one row per domain waiting for an alert e-mail.
--                                 Service role only. sent_at is set once it went out.
--   push_dispatch_config.admin_alert_url
--                                 the Netlify function the trigger calls (the same shared
--                                 secret as push-dispatch is reused).
--   trigger on video_owner_profiles
--                                 fires when custom_domain changes to a non-null value.
--
-- The HTTP call is best effort (pg_net is fire and forget). The alert row is the durable
-- record: a scheduled Netlify function re-sends any alert that is still unsent, so a
-- failed call is retried instead of lost. Nothing here can block set_custom_domain().
-- ===========================================================================

create table if not exists public.custom_domain_alerts (
  id bigint generated always as identity primary key,
  business_slug text not null,
  domain text not null,
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text check (last_error is null or char_length(last_error) <= 200)
);
alter table public.custom_domain_alerts enable row level security; -- no policies: service role only
revoke all on public.custom_domain_alerts from anon, authenticated;
grant select, insert, update, delete on public.custom_domain_alerts to service_role;

-- One open alert per domain: saving the same domain again does not queue a second e-mail.
create unique index if not exists custom_domain_alerts_open_key
  on public.custom_domain_alerts (domain) where sent_at is null;
create index if not exists custom_domain_alerts_pending_idx
  on public.custom_domain_alerts (requested_at) where sent_at is null;

alter table public.push_dispatch_config add column if not exists admin_alert_url text;

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
    insert into public.custom_domain_alerts (business_slug, domain)
    values (NEW.business_slug, NEW.custom_domain)
    on conflict (domain) where sent_at is null do nothing
    returning id into alert_id;
  exception when others then
    return NEW; -- saving a domain must never fail because of an alert
  end;
  if alert_id is null then return NEW; end if; -- an alert for this domain is already waiting

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

drop trigger if exists video_owner_profiles_domain_alert on public.video_owner_profiles;
create trigger video_owner_profiles_domain_alert
  after update of custom_domain on public.video_owner_profiles
  for each row
  when (new.custom_domain is not null and new.custom_domain is distinct from old.custom_domain)
  execute function public.custom_domain_notify_admin();
