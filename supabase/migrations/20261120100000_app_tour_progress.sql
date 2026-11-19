-- Guided product tours: which tours a signed-in user has seen (one row per user and tour), readable and writable only
-- by that user (Clerk user id from the JWT `sub`). Written by src/lib/tours/tourState.js. The special tour id
-- '__disabled__' records "turn off guided tours". Separate from public.app_onboarding (the sign-up questions).

create table if not exists public.app_tour_progress (
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  tour_id text not null check (char_length(tour_id) between 1 and 60),
  version smallint not null default 1 check (version between 1 and 1000),
  seen_at timestamptz not null default now(),
  primary key (clerk_user_id, tour_id)
);

alter table public.app_tour_progress enable row level security;

drop policy if exists "Users read own tour progress" on public.app_tour_progress;
drop policy if exists "Users insert own tour progress" on public.app_tour_progress;
drop policy if exists "Users update own tour progress" on public.app_tour_progress;

create policy "Users read own tour progress"
  on public.app_tour_progress for select to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Users insert own tour progress"
  on public.app_tour_progress for insert to anon, authenticated
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Users update own tour progress"
  on public.app_tour_progress for update to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

-- Reset all tours: a user may delete only their own rows (the table holds nothing else of value).
drop policy if exists "Users delete own tour progress" on public.app_tour_progress;
create policy "Users delete own tour progress"
  on public.app_tour_progress for delete to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

grant select, insert, update, delete on public.app_tour_progress to anon, authenticated;
