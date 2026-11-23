-- Server-side keys for the lead-capture edge function, generated here so nobody has to paste them:
--   lead_webhook_signing         master for per-owner webhook signing secrets (X-Remix-Signature)
--   lead_integrations_encryption key that encrypts saved Kit / MailerLite API keys
-- They live in Supabase Vault (encrypted at rest) and only the service role can read them, through
-- get_lead_function_key(). The WEBHOOK_SIGNING_SECRET / INTEGRATIONS_ENCRYPTION_KEY edge function secrets,
-- when set, still take priority over these.

create extension if not exists supabase_vault with schema vault;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'lead_webhook_signing') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'lead_webhook_signing', 'lead-capture webhook signing master');
  end if;
  if not exists (select 1 from vault.secrets where name = 'lead_integrations_encryption') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'lead_integrations_encryption', 'lead-capture email-list key encryption');
  end if;
end $$;

create or replace function public.get_lead_function_key(p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = p_name
    and name in ('lead_webhook_signing', 'lead_integrations_encryption')
  limit 1;
$$;

revoke all on function public.get_lead_function_key(text) from public, anon, authenticated;
grant execute on function public.get_lead_function_key(text) to service_role;
