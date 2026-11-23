-- ===========================================================================
-- mcp_bridge.sql
--
-- Live-tab bridge: a tab the user switched on registers a session and the tools it offers; MCP commands for it queue here.
-- Service role only (RLS on, no client grants). Commands expire after 60 s and carry no secrets.
-- ===========================================================================

create table if not exists public.mcp_bridge_sessions (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  label text not null default 'Browser tab',
  studio text not null default 'app',
  tools jsonb not null default '[]'::jsonb,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists mcp_bridge_sessions_user_idx on public.mcp_bridge_sessions (clerk_user_id) where closed_at is null;
create table if not exists public.mcp_bridge_commands (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mcp_bridge_sessions (id) on delete cascade,
  clerk_user_id text not null,
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  risk text not null default 'write' check (risk in ('read', 'write', 'destructive', 'publish')),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'error', 'declined', 'expired')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists mcp_bridge_commands_pending_idx on public.mcp_bridge_commands (session_id, status, created_at);
alter table public.mcp_bridge_sessions enable row level security;
alter table public.mcp_bridge_commands enable row level security;
revoke all on table public.mcp_bridge_sessions, public.mcp_bridge_commands from anon, authenticated;
