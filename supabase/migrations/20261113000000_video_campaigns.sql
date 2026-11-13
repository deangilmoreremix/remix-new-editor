-- ===========================================================================
-- video_campaigns.sql
--
-- Personalized-video outreach (Sendspark-style): one campaign = one base
-- video + voice + script template + CTA; one recipient row per contact, each
-- with an unguessable public_token that powers /p/<token>.
--
-- Same identity model as timeline_projects / published_videos: the verified
-- Clerk `sub` minted into the Supabase JWT. Public (anon) access is ONLY via
-- the security-definer RPC get_campaign_recipient_page(token).
-- ===========================================================================

create table if not exists public.video_campaigns (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  name text not null default 'Untitled campaign'
    check (char_length(name) between 1 and 200),
  base_video_url text,
  voice_id text,
  -- Owner attests they have the speaker's consent to clone voice / lip-sync.
  voice_consent boolean not null default false,
  script_template text not null default ''
    check (char_length(script_template) <= 4000),
  cta jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'sampling', 'ready', 'generating', 'done', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_campaigns_cta_is_object check (jsonb_typeof(cta) = 'object')
);

create index if not exists video_campaigns_owner_idx
  on public.video_campaigns (clerk_user_id, updated_at desc);

create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.video_campaigns(id) on delete cascade,
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  email text check (email is null or char_length(email) <= 320),
  contact jsonb not null default '{}'::jsonb,
  public_token text not null unique
    default translate(encode(gen_random_bytes(18), 'base64'), '+/=', '-_'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  output_video_url text,
  thumb_gif_url text,
  error text check (error is null or char_length(error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_recipients_contact_is_object check (jsonb_typeof(contact) = 'object')
);

create index if not exists campaign_recipients_campaign_idx
  on public.campaign_recipients (campaign_id, status);
create index if not exists campaign_recipients_owner_idx
  on public.campaign_recipients (clerk_user_id);

alter table public.video_campaigns enable row level security;
alter table public.campaign_recipients enable row level security;

drop policy if exists "Owners manage own campaigns" on public.video_campaigns;
drop policy if exists "Owners manage own recipients" on public.campaign_recipients;

create policy "Owners manage own campaigns"
  on public.video_campaigns for all to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

-- Recipients must belong to a campaign the caller owns.
create policy "Owners manage own recipients"
  on public.campaign_recipients for all to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check (
    (select auth.jwt() ->> 'sub') = clerk_user_id
    and exists (
      select 1 from public.video_campaigns c
      where c.id = campaign_id
        and c.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

revoke all on public.video_campaigns, public.campaign_recipients from anon, authenticated;
grant select, insert, update, delete on public.video_campaigns to authenticated;
grant select, insert, update, delete on public.campaign_recipients to authenticated;

-- Owner / token / created_at are immutable for API roles; updated_at server-set.
create or replace function public.video_campaigns_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and current_user in ('anon', 'authenticated') then
    new.clerk_user_id := old.clerk_user_id;
    new.created_at := old.created_at;
    if tg_table_name = 'campaign_recipients' then
      new.public_token := old.public_token;
      new.campaign_id := old.campaign_id;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.video_campaigns_guard() from public;

drop trigger if exists video_campaigns_guard on public.video_campaigns;
create trigger video_campaigns_guard
  before insert or update on public.video_campaigns
  for each row execute function public.video_campaigns_guard();

drop trigger if exists campaign_recipients_guard on public.campaign_recipients;
create trigger campaign_recipients_guard
  before insert or update on public.campaign_recipients
  for each row execute function public.video_campaigns_guard();

-- ---------------------------------------------------------------------------
-- Public read by token: returns only what the recipient page needs. Never
-- exposes email, other contacts, owner id or campaign internals.
-- ---------------------------------------------------------------------------
create or replace function public.get_campaign_recipient_page(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'recipient_id', r.id,
    'first_name', r.contact ->> 'first_name',
    'company', r.contact ->> 'company',
    'video_url', r.output_video_url,
    'thumb_gif_url', r.thumb_gif_url,
    'cta', c.cta,
    'campaign_name', c.name
  )
  from public.campaign_recipients r
  join public.video_campaigns c on c.id = r.campaign_id
  where r.public_token = p_token
    and r.status = 'ready'
  limit 1;
$$;

revoke all on function public.get_campaign_recipient_page(text) from public;
grant execute on function public.get_campaign_recipient_page(text) to anon, authenticated;
