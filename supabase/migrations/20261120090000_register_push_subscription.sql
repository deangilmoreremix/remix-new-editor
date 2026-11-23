-- ===========================================================================
-- register_push_subscription.sql — atomic "register this device" for browser push
--
-- owner_push_subscriptions has no UPDATE policy, so the app used to refresh a device by
-- deleting its row and inserting a new one in two calls. A failure between the two (or a
-- second tab racing in) could leave the device unregistered. This function does the whole
-- refresh in ONE statement:
--   * the row is created, or refreshed (keys, user agent, failure count reset) when it is
--     already THIS owner's;
--   * an endpoint registered to ANOTHER account is never touched: the function raises
--     unique_violation (23505), the same error the plain insert gave, so the app starts a
--     fresh browser subscription for this account exactly as before.
-- The owner is always the signed-in account (auth.jwt() ->> 'sub'); it is never a parameter.
-- Safe to re-run. The app keeps working without it (it falls back to delete + insert).
-- ===========================================================================

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me text := auth.jwt() ->> 'sub';
begin
  if me is null or me = '' then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  insert into public.owner_push_subscriptions as s (clerk_user_id, endpoint, p256dh, auth, user_agent)
  values (me, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        failure_count = 0
    where s.clerk_user_id = me;

  if not found then
    -- the endpoint exists and belongs to another account
    raise exception 'push endpoint is registered to another account' using errcode = '23505';
  end if;
end;
$$;

revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;
