-- Recipient links (Stage 8): server-issued, unguessable per-recipient tokens for personalized watch pages.
--
-- Why: personalized links used `?c=<contactId>` — regex-checked only and trusted, so anyone could attribute views, clicks and leads
-- to any contact id, and the contact was never tied to the video's owner. A recipient link instead carries a 192-bit random token;
-- this table stores ONLY its SHA-256 hash (a leaked table cannot be turned back into working links) and the owner's own label.
--
-- Ownership idiom (same as personalization_saved_layouts): rows carry clerk_user_id; RLS is own-row on auth.jwt()->>'sub' (or the
-- app.clerk_user_id GUC the RPCs set), so a browser calling PostgREST directly sees nothing; the RPCs are SECURITY DEFINER with a
-- pinned search_path and executable by service_role only. Views/clicks/leads are NOT stored here: they are counted from the existing
-- analytics tables by contact_id = link id, which keeps them idempotent (ingest_video_events already de-duplicates by session+seq).

create table if not exists public.recipient_links (
  id             uuid primary key default gen_random_uuid(),
  clerk_user_id  text not null,
  video_id       text not null references public.published_videos (id) on delete cascade,
  token_hash     text not null,
  label          text not null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz,
  revoked_at     timestamptz,
  constraint recipient_links_token_hash_check check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint recipient_links_label_check check (char_length(btrim(label)) between 1 and 80),
  constraint recipient_links_expiry_check check (expires_at is null or expires_at > created_at)
);

comment on table public.recipient_links is
  'Per-recipient watch-page tokens (hash only), owned by a Clerk user id. See netlify/functions/_personalization/app/api/personalization/recipient-links/route.ts.';

create unique index if not exists recipient_links_token_hash_uidx on public.recipient_links (token_hash);
-- One live link per (video, label): re-issuing for the same recipient means revoking the old one first.
create unique index if not exists recipient_links_video_label_live_uidx
  on public.recipient_links (video_id, lower(btrim(label))) where revoked_at is null;
create index if not exists recipient_links_owner_video_idx on public.recipient_links (clerk_user_id, video_id, created_at desc);

alter table public.recipient_links enable row level security;

drop policy if exists "recipient_links_select_own" on public.recipient_links;
create policy "recipient_links_select_own" on public.recipient_links for select
  using (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));
-- No insert/update/delete policies: only the security-definer RPCs write.

revoke all on table public.recipient_links from anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs (service_role only)
-- ---------------------------------------------------------------------------

-- Inserts one link per (label, hash). The caller (the server route) made the tokens; only their hashes arrive here.
create or replace function public.recipient_links_issue(
  p_clerk_user_id text,
  p_video_id text,
  p_labels text[],
  p_token_hashes text[],
  p_expires_at timestamptz
)
returns table (id uuid, label text, created_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n integer;
  i integer;
  existing integer;
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'recipient_links_issue: clerk_user_id is required' using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  n := coalesce(array_length(p_labels, 1), 0);
  if n < 1 or n > 200 or n <> coalesce(array_length(p_token_hashes, 1), 0) then
    raise exception 'recipient_links_issue: 1-200 labels with one hash each are required' using errcode = '22023';
  end if;
  if p_expires_at is not null and (p_expires_at <= now() or p_expires_at > now() + interval '731 days') then
    raise exception 'recipient_links_issue: expiry must be in the future and within 2 years' using errcode = '22023';
  end if;
  -- The video must belong to the caller. "Missing" and "not yours" look the same (no existence leak).
  if not exists (select 1 from public.published_videos v where v.id = p_video_id and v.clerk_user_id = p_clerk_user_id) then
    raise exception 'recipient_links_issue: video not found' using errcode = 'P0002';
  end if;
  select count(*) into existing from public.recipient_links l where l.video_id = p_video_id and l.revoked_at is null;
  if existing + n > 5000 then
    raise exception 'recipient_links_issue: link limit (5000 live links per video) reached' using errcode = '53400';
  end if;
  return query
    with ins as (
      insert into public.recipient_links as l (clerk_user_id, video_id, token_hash, label, expires_at)
      select p_clerk_user_id, p_video_id, h, btrim(lb), p_expires_at
        from unnest(p_labels, p_token_hashes) as u(lb, h)
      returning l.id, l.label, l.created_at, l.expires_at
    )
    select ins.id, ins.label, ins.created_at, ins.expires_at from ins;
end;
$$;

-- The owner's links for one video, with counts taken from the analytics tables. Never returns the hash.
create or replace function public.recipient_links_list(p_clerk_user_id text, p_video_id text)
returns table (
  id uuid, label text, created_at timestamptz, expires_at timestamptz, revoked_at timestamptz,
  views bigint, plays bigint, completes bigint, cta_clicks bigint, leads bigint, last_seen timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'recipient_links_list: clerk_user_id is required' using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  return query
    select l.id, l.label, l.created_at, l.expires_at, l.revoked_at,
           coalesce(a.views, 0), coalesce(a.plays, 0), coalesce(a.completes, 0), coalesce(a.cta_clicks, 0), coalesce(a.leads, 0), a.last_seen
      from public.recipient_links l
      left join lateral (
        select count(*) filter (where ev.type = 'page_open') as views,
               count(*) filter (where ev.type = 'play') as plays,
               count(*) filter (where ev.type = 'complete') as completes,
               count(*) filter (where ev.type in ('cta_click', 'call_click')) as cta_clicks,
               count(*) filter (where ev.type = 'lead_submit') as leads,
               max(ev.created_at) as last_seen
          from public.video_view_sessions s
          join public.video_events ev on ev.session_id = s.id
         where s.video_id = l.video_id and s.contact_id = l.id::text
      ) a on true
     where l.clerk_user_id = p_clerk_user_id and l.video_id = p_video_id
     order by l.created_at desc, l.label
     limit 5000;
end;
$$;

-- Owner only. true when a live link of the caller's was revoked; false otherwise (including "not yours").
create or replace function public.recipient_links_revoke(p_id uuid, p_clerk_user_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'recipient_links_revoke: clerk_user_id is required' using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  update public.recipient_links set revoked_at = now()
   where id = p_id and clerk_user_id = p_clerk_user_id and revoked_at is null;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- The PUBLIC path (called by the video-events function with the service role). Returns the link id when the hash belongs to a
-- live link FOR THIS VIDEO, else null. A token for another video, a revoked or expired token, and a made-up token are all null.
create or replace function public.recipient_link_resolve(p_video_id text, p_token_hash text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.id from public.recipient_links l
   where l.video_id = p_video_id
     and p_token_hash ~ '^[a-f0-9]{64}$'
     and l.token_hash = p_token_hash
     and l.revoked_at is null
     and (l.expires_at is null or l.expires_at > now())
   limit 1;
$$;

revoke all on function public.recipient_links_issue(text, text, text[], text[], timestamptz) from public, anon, authenticated;
revoke all on function public.recipient_links_list(text, text) from public, anon, authenticated;
revoke all on function public.recipient_links_revoke(uuid, text) from public, anon, authenticated;
revoke all on function public.recipient_link_resolve(text, text) from public, anon, authenticated;
grant execute on function public.recipient_links_issue(text, text, text[], text[], timestamptz) to service_role;
grant execute on function public.recipient_links_list(text, text) to service_role;
grant execute on function public.recipient_links_revoke(uuid, text) to service_role;
grant execute on function public.recipient_link_resolve(text, text) to service_role;
