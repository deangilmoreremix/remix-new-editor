-- Smart Website Builder: trigger-only functions must not be callable over the
-- API. Postgres grants EXECUTE to PUBLIC by default; the Supabase security
-- advisor flags these two as anon-executable SECURITY DEFINER functions.
revoke all on function public.wb_protect_privileged_profile_columns() from public, anon, authenticated;
revoke all on function public.wb_update_community_likes_count() from public, anon, authenticated;
