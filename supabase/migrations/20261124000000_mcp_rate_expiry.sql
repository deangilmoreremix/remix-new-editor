-- ===========================================================================
-- mcp_rate_expiry.sql
-- Per-key request rate limit (counter per key per minute) and optional key expiry.
-- Service role only: RLS on, no client grants.
-- ===========================================================================

alter table public.mcp_keys add column if not exists expires_at timestamptz;

create table if not exists public.mcp_rate_window (
  key_id uuid not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key_id, window_start)
);

create or replace function public.mcp_rate_hit(p_key_id uuid, p_window timestamptz) returns integer
language plpgsql as $$
declare c integer;
begin
  insert into public.mcp_rate_window (key_id, window_start, count) values (p_key_id, p_window, 1)
  on conflict (key_id, window_start) do update set count = public.mcp_rate_window.count + 1
  returning count into c;
  if random() < 0.01 then
    delete from public.mcp_rate_window where window_start < now() - interval '1 hour';
  end if;
  return c;
end $$;

alter table public.mcp_rate_window enable row level security;
revoke all on table public.mcp_rate_window from anon, authenticated;
revoke all on function public.mcp_rate_hit(uuid, timestamptz) from public, anon, authenticated;
