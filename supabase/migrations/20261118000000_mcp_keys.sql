-- ===========================================================================
-- mcp_keys.sql
--
-- Long-lived SmartVid MCP keys. A signed-in user creates one in Settings and puts
-- it in their MCP client; the gateway (netlify/functions/mcp-gateway.js) resolves it
-- to the Clerk user and runs the app's own functions as that user.
--
-- Only a SHA-256 hash of the key is stored (the raw key is shown once). The user's
-- own generation / OpenAI keys are stored AES-256-GCM encrypted (MCP_KEY_SECRET).
-- RLS is on and anon/authenticated have no grants: only the service role (Netlify
-- functions) can read or write this table. The browser never gets a key back.
-- ===========================================================================

create table if not exists public.mcp_keys (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  workspace_id text not null default 'personal',
  label text not null default 'MCP key',
  key_hash text not null unique,
  key_prefix text not null,
  muapi_key_enc text not null,
  openai_key_enc text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists mcp_keys_user_idx on public.mcp_keys (clerk_user_id) where revoked_at is null;

alter table public.mcp_keys enable row level security;
revoke all on table public.mcp_keys from anon, authenticated;
