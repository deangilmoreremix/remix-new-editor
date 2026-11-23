-- ===========================================================================
-- push_deferred.sql — remember pushes that quiet hours held back
--
-- push-dispatch records one row here instead of silently dropping a push that
-- arrives during the owner's quiet hours (unless they turned the summary off:
-- retarget_preferences.quiet_hours.summary = false). The scheduled function
-- push-quiet-flush sends ONE "While you were away" summary push once quiet
-- hours end, then deletes the rows it included; rows older than 3 days are
-- pruned. Service role only: owners never read or write this table directly.
-- Additive and optional: push-dispatch works without it (pushes are then
-- dropped during quiet hours, as before).
-- ===========================================================================
create table if not exists public.owner_push_deferred (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  notification_id uuid not null references public.owner_notifications (id) on delete cascade,
  type text not null,
  created_at timestamptz default now(),
  unique (notification_id)
);
create index if not exists owner_push_deferred_owner_idx on public.owner_push_deferred (clerk_user_id, created_at);

alter table public.owner_push_deferred enable row level security; -- no policies: service role only
revoke all on public.owner_push_deferred from anon, authenticated;
grant select, insert, update, delete on public.owner_push_deferred to service_role;
