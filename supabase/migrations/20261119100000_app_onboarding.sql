-- App-wide SmartVideo onboarding answers (shown right after sign-up): one row per signed-in user, readable and
-- writable only by that user (Clerk user id from the JWT `sub`). Written by src/lib/onboarding/store.js.
-- Separate from public.user_onboarding (the Video Outreach welcome) so finishing one never hides the other.

create table if not exists public.app_onboarding (
  clerk_user_id text primary key default (auth.jwt() ->> 'sub'),
  goal text check (goal is null or goal in ('ai-video', 'images', 'personal', 'edit', 'marketing', 'explore')),
  team_size text check (team_size is null or team_size in ('solo', '2-5', '6-25', '25+', 'agency')),
  videos_per_month text check (videos_per_month is null or videos_per_month in ('few', '100+', '1000+', '5000+', '10000+', 'unsure')),
  company text check (company is null or char_length(company) <= 120),
  website text check (website is null or char_length(website) <= 200),
  job_title text check (job_title is null or char_length(job_title) <= 120),
  heard_from text check (heard_from is null or char_length(heard_from) <= 40),
  heard_other text check (heard_other is null or char_length(heard_other) <= 120),
  video_types text[] not null default '{}' check (cardinality(video_types) <= 8),
  tools text[] not null default '{}' check (cardinality(tools) <= 40),
  primary_tool text check (primary_tool is null or char_length(primary_tool) <= 40),
  step smallint not null default 1 check (step between 1 and 6),
  completed_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_onboarding enable row level security;

drop policy if exists "Users read own app onboarding" on public.app_onboarding;
drop policy if exists "Users insert own app onboarding" on public.app_onboarding;
drop policy if exists "Users update own app onboarding" on public.app_onboarding;

create policy "Users read own app onboarding"
  on public.app_onboarding for select to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Users insert own app onboarding"
  on public.app_onboarding for insert to anon, authenticated
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Users update own app onboarding"
  on public.app_onboarding for update to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

grant select, insert, update on public.app_onboarding to anon, authenticated;

create or replace function public.app_onboarding_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_onboarding_touch on public.app_onboarding;
create trigger app_onboarding_touch
  before update on public.app_onboarding
  for each row execute function public.app_onboarding_touch();
