-- Restrict who can call SECURITY DEFINER functions through the public API (/rest/v1/rpc/<name>).
--
-- Found on production: 80 functions were executable by anon and 90 by authenticated. Several have NO check inside them, so anyone with the
-- public key could, for example, re-activate any user's paid access (restore_subscription_access), set session settings such as
-- app.clerk_user_id (set_config), run maintenance/deletion jobs, or write forged audit/usage/notification rows.
--
-- Three tiers, applied by name across all overloads (skips anything that does not exist; idempotent):
--   1. SERVER-ONLY : revoke from PUBLIC, anon, authenticated. service_role (server code) keeps access.
--   2. SIGNED-IN   : revoke from PUBLIC and anon; authenticated keeps access (they check the caller inside, or are only useful signed in).
--   3. TRIGGERS    : every SECURITY DEFINER function that RETURNS trigger: revoke from PUBLIC, anon, authenticated. Triggers do not need the
--                    caller to hold EXECUTE, so nothing stops firing.
-- Never touched: the SmartVideo public-page functions, rate_limit_check, log_failed_login, and ANY function that a policy, a view rule, a
-- column default or a check constraint depends on (those run as the querying role, so revoking would turn "empty result" into
-- "permission denied").

do $$
declare
  r record;
  n_server integer := 0; n_signed integer := 0; n_trigger integer := 0; n_skipped integer := 0;
  server_only text[] := array[
    'restore_subscription_access','set_config','cleanup_stale_anonymous_users','check_and_revoke_expired_subscriptions',
    'cleanup_rate_limits','rate_limit_cleanup','generate_daily_snapshot','brander_cleanup_old_audit_logs','record_admin_access',
    'log_admin_user_operation','log_user_management_operation','log_credit_usage','log_api_usage','brander_log_api_usage',
    'record_ai_app_run','create_notification','award_achievement','initialize_all_feature_flags','initialize_tenant','sync_user_features'];
  signed_in text[] := array[
    'create_app','create_tenant','invite_user_to_app','accept_app_invitation','user_has_feature','user_has_api_keys',
    'get_ai_app_remaining_runs','get_ai_app_usage','get_user_progress_percentage','has_feature','user_can_access_app','user_has_permission',
    'user_has_app_access_fast','user_has_feature_access','brander_check_and_update_quota','brander_check_rate_limit','brander_get_user_role',
    'brander_is_super_admin','get_recommended_features','get_feature_popularity','get_app_slug','get_tenant_id','decrypt_user_api_key',
    'claim_business_slug','set_video_slug','delete_video_analytics','check_rate_limit','with_advisory_lock','log_analytics_event'];
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args,
           (p.prorettype = 'trigger'::regtype) as is_trigger,
           exists (select 1 from pg_depend d
                    where d.refclassid = 'pg_proc'::regclass and d.refobjid = p.oid
                      and d.classid in ('pg_policy'::regclass, 'pg_rewrite'::regclass, 'pg_attrdef'::regclass, 'pg_constraint'::regclass)) as in_use_by_caller
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
       and (p.proname = any (server_only) or p.proname = any (signed_in) or p.prorettype = 'trigger'::regtype)
  loop
    if r.in_use_by_caller and not r.is_trigger then
      -- a policy / view / default / constraint evaluates it as the querying role: leave it exactly as it is
      n_skipped := n_skipped + 1; continue;
    end if;
    if r.is_trigger or r.proname = any (server_only) then
      execute format('revoke execute on function public.%I(%s) from public, anon, authenticated', r.proname, r.args);
      if r.is_trigger then n_trigger := n_trigger + 1; else n_server := n_server + 1; end if;
    else
      execute format('revoke execute on function public.%I(%s) from public, anon', r.proname, r.args);
      n_signed := n_signed + 1;
    end if;
    execute format('grant execute on function public.%I(%s) to service_role', r.proname, r.args);
  end loop;
  raise notice 'restrict_public_function_access: % server-only, % signed-in-only, % trigger function(s) restricted; % skipped (in use by a policy/view/default/constraint)',
    n_server, n_signed, n_trigger, n_skipped;
end $$;

-- View user_cloudflare_status runs as its owner (ignores the base table's RLS) and exposes account emails, names and token scope to anon.
-- Same fix as user_api_keys_read: honour the caller's rights, and take it away from anon.
do $$
begin
  if to_regclass('public.user_cloudflare_status') is not null then
    alter view public.user_cloudflare_status set (security_invoker = true);
    revoke all on table public.user_cloudflare_status from anon;
  end if;
end $$;
