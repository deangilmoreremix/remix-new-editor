-- ===========================================================================
-- Stage 11 (Fix P): write path for video_view_sessions.campaign_id
--
-- Fix O added an optional campaign filter to the heatmaps that stays hidden until something records which campaign a
-- view session belongs to. This migration adds the column and the ONLY writer of it.
--
-- Carrier: the campaign RECIPIENT public_token (campaign_recipients.public_token, unguessable, 18 random bytes), as
-- defined by the campaigns schema (20261113000000_video_campaigns.sql, branch claude/modest-tesla-yhjel6). A watch link
-- for a recipient is /watch/<video>?cr=<public_token>. A bare campaign id is NOT accepted: ids are not secrets (they appear
-- in the owner's UI and URLs), so an anonymous viewer could name someone else's campaign and pollute its analytics.
--
-- attribute_video_session_campaign(video, session, token) (service_role only, called by netlify/functions/video-events.js
-- after ingest_video_events() created the session row):
--   * attributes ONLY when the token resolves to a READY recipient whose campaign AND recipient row belong to the same
--     owner (clerk_user_id) as the published video. A token of another owner's campaign, a garbage token, an unready
--     recipient, a missing session: nothing is written.
--   * never raises and never reveals why: every path returns {ok:true}. Without the campaign tables it is a silent no-op
--     (the table is only referenced through dynamic SQL after a to_regclass() check), so it works on our branch alone.
--   * first valid attribution wins (campaign_id is only set while NULL) so a replayed or altered link cannot move a
--     session between campaigns; repeated batches are idempotent.
--   * only the campaign id is stored, never the token or the recipient.
--
-- Foreign key: added only when public.video_campaigns exists when this migration runs (on delete set null). If the campaigns
-- migration is applied LATER, the column stays a plain uuid; add the key then with:
--   alter table public.video_view_sessions add constraint video_view_sessions_campaign_id_fkey
--     foreign key (campaign_id) references public.video_campaigns (id) on delete set null;
-- Nothing depends on it (the writer validates against the tables itself).
-- Idempotent. Existing grants, RLS and rate limits are untouched.
-- ===========================================================================

alter table public.video_view_sessions add column if not exists campaign_id uuid;

do $$
begin
  if to_regclass('public.video_campaigns') is not null
     and not exists (select 1 from pg_constraint
                      where conname = 'video_view_sessions_campaign_id_fkey'
                        and conrelid = 'public.video_view_sessions'::regclass) then
    execute 'alter table public.video_view_sessions add constraint video_view_sessions_campaign_id_fkey
             foreign key (campaign_id) references public.video_campaigns (id) on delete set null';
  end if;
end $$;

create index if not exists video_view_sessions_campaign_idx
  on public.video_view_sessions (video_id, campaign_id) where campaign_id is not null;

create or replace function public.attribute_video_session_campaign(p_video_id text, p_session_key text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
  n integer := 0;
begin
  begin
    if p_video_id is null or p_session_key is null or p_token is null
       or p_token !~ '^[A-Za-z0-9_-]{16,64}$'
       or to_regclass('public.video_campaigns') is null
       or to_regclass('public.campaign_recipients') is null then
      return jsonb_build_object('ok', true, 'attributed', false);
    end if;
    -- Dynamic SQL: this migration must apply (and this function run) where the campaign tables do not exist.
    execute $q$
      select c.id
        from public.campaign_recipients r
        join public.video_campaigns c on c.id = r.campaign_id
        join public.published_videos pv on pv.id = $1 and pv.published = true
       where r.public_token = $2
         and r.status = 'ready'
         and c.clerk_user_id = pv.clerk_user_id
         and r.clerk_user_id = pv.clerk_user_id
       limit 1
    $q$ into cid using p_video_id, p_token;
    if cid is not null then
      update public.video_view_sessions
         set campaign_id = cid
       where video_id = p_video_id and session_key = p_session_key and campaign_id is null;
      get diagnostics n = row_count;
    end if;
  exception when others then
    return jsonb_build_object('ok', true, 'attributed', false); -- tolerated by design: attribution is best effort and never an oracle
  end;
  return jsonb_build_object('ok', true, 'attributed', n = 1);
end;
$$;

revoke all on function public.attribute_video_session_campaign(text, text, text) from public, anon, authenticated;
grant execute on function public.attribute_video_session_campaign(text, text, text) to service_role;
