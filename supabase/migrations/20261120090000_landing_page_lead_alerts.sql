-- ===========================================================================
-- landing_page_lead_alerts.sql — owner alerts for landing-page leads
--
-- New-lead alerts (and so push, email and the live bell) were only created for
-- leads on PUBLISHED VIDEOS (trigger video_events_notify on video_events).
-- Leads from landing pages (/p/<slug>, the OpenHiggsBolt "Video Pages" app)
-- were stored but never alerted. This adds the missing alert source:
--
--   * landing_page_leads  (the landing-page app's own store)  -> new_lead alert
--   * video_leads rows that lead-capture stored for a landing page
--     (source.landingPage = true, not previews)                -> new_lead alert
--
-- The alert goes to the landing page's owner through the same _notify() the
-- video alerts use, so the owner's preferences (enabled types, in-app) apply,
-- and the existing owner_notifications trigger then sends push / email. The
-- alert has no video attached (video_id is nullable), and the editor's
-- Notifications list already shows alerts without a project.
--
-- One alert per stored lead (dedupe key = table + row id). A lead stored in
-- both tables would alert twice; the landing-page app avoids that by calling
-- lead-capture with skipStore. The trigger never raises: an alert problem can
-- never block or roll back saving the lead.
-- ===========================================================================
create or replace function public._on_landing_page_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page text;
  v_key text;
  v_kind text;
  v_owner text;
  v_title text;
begin
  begin
    if tg_table_name = 'landing_page_leads' then
      v_page := new.page_id;
      v_key := 'lpl:' || new.id::text;
      v_kind := new.kind;
    else -- video_leads: only the rows lead-capture stored for a landing page
      if coalesce(new.preview, false) or coalesce(new.source ->> 'landingPage', 'false') <> 'true' then
        return new;
      end if;
      v_page := new.project_id;
      v_key := 'vl:' || new.id::text;
      v_kind := new.kind;
    end if;

    select clerk_user_id, title into v_owner, v_title from public.landing_pages where id = v_page;
    if v_owner is null or v_owner = '' then return new; end if;

    perform public._notify(
      v_owner, null, 'new_lead', 'New lead captured',
      format('A visitor submitted a form on your page "%s".', left(coalesce(nullif(v_title, ''), 'your landing page'), 80)),
      'Review the lead in your landing page.', null,
      jsonb_build_object('page', v_page, 'source', 'landing-page', 'kind', v_kind, 'count', 1),
      v_key);
  exception when others then
    null; -- an alert problem must never block saving the lead
  end;
  return new;
end;
$$;
revoke all on function public._on_landing_page_lead() from public, anon, authenticated;

create or replace trigger landing_page_leads_alert
  after insert on public.landing_page_leads
  for each row execute function public._on_landing_page_lead();

create or replace trigger video_leads_landing_alert
  after insert on public.video_leads
  for each row execute function public._on_landing_page_lead();
