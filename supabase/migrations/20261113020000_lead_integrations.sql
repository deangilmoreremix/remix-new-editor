-- ===========================================================================
-- lead_integrations.sql
--
-- Per-owner API keys for email-list delivery (Kit, MailerLite). The `lead-capture`
-- edge function pushes each published-video lead to the owner's list.
--
-- Keys are stored AES-GCM encrypted (INTEGRATIONS_ENCRYPTION_KEY edge secret) and
-- this table has NO client policies: RLS is on and anon/authenticated have no
-- grants, so only the edge function (service role) can read or write it. The
-- browser can never read a key back, only whether one is connected.
-- ===========================================================================

create table if not exists public.lead_integrations (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  provider text not null check (provider in ('kit', 'mailerlite')),
  secret_enc text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_integrations_owner_provider unique (clerk_user_id, provider)
);

alter table public.lead_integrations enable row level security;
revoke all on table public.lead_integrations from anon, authenticated;
