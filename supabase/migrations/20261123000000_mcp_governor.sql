-- ===========================================================================
-- mcp_governor.sql
--
-- Safeguards for MCP keys: a per-key daily counter for destructive/publish calls and an audit log (tool, risk, outcome, time; no
-- arguments, URLs or keys). Service role only: RLS is on and anon/authenticated have no grants.
-- ===========================================================================

create table if not exists public.mcp_usage_daily (
  key_id uuid not null,
  day date not null,
  risk text not null check (risk in ('destructive', 'publish')),
  count integer not null default 0,
  primary key (key_id, day, risk)
);
create table if not exists public.mcp_audit (
  id bigint generated always as identity primary key,
  key_id uuid,
  clerk_user_id text,
  tool text not null,
  risk text not null check (risk in ('read', 'write', 'destructive', 'publish')),
  ok boolean not null,
  ms integer not null default 0,
  at timestamptz not null default now()
);
create index if not exists mcp_audit_user_idx on public.mcp_audit (clerk_user_id, at desc);
create or replace function public.mcp_usage_incr(p_key_id uuid, p_day date, p_risk text) returns integer
language sql as $$
  insert into public.mcp_usage_daily (key_id, day, risk, count) values (p_key_id, p_day, p_risk, 1)
  on conflict (key_id, day, risk) do update set count = public.mcp_usage_daily.count + 1
  returning count;
$$;
alter table public.mcp_usage_daily enable row level security;
alter table public.mcp_audit enable row level security;
revoke all on table public.mcp_usage_daily, public.mcp_audit from anon, authenticated;
revoke all on function public.mcp_usage_incr(uuid, date, text) from public, anon, authenticated;
