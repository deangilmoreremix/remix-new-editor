-- Finder continuity (E8): server RPCs for the three finder-continuity tables.
-- APPLIED to the project via the Supabase tool as migration `finder_continuity_rpcs` (2026-11-15),
-- approved by the owner as written in PR #184. Recorded here so the repo matches the database.
--
-- Same style as lead_finder_leads_*: SECURITY DEFINER, identity set as the app.clerk_user_id GUC in the same
-- transaction, search_path pinned, execute revoked from public/anon/authenticated and granted to service_role only.
-- Per-user caps are enforced here: 25 saved searches, 500 feedback rows.
--
-- Rollback (functions only; tables untouched):
--   drop function if exists public.finder_saved_searches_list(text), public.finder_saved_searches_save(text, text, text, text, integer, boolean),
--     public.finder_saved_searches_delete(text, uuid), public.finder_lead_feedback_list(text), public.finder_lead_feedback_add(text, text, text, text),
--     public.finder_lead_feedback_delete(text, text, text), public.business_enrichment_cache_get(text), public.business_enrichment_cache_put(text, jsonb, integer);

-- ---------------------------------------------------------------- saved searches
create or replace function public.finder_saved_searches_list(p_clerk_user_id text)
returns setof public.finder_saved_searches
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'finder_saved_searches_list: clerk_user_id is required' using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  return query select * from public.finder_saved_searches
    where clerk_user_id = p_clerk_user_id order by updated_at desc limit 25;
end;
$$;

create or replace function public.finder_saved_searches_save(
  p_clerk_user_id text, p_name text, p_niche text, p_location text,
  p_radius_miles integer default 15, p_include_chains boolean default false
)
returns public.finder_saved_searches
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_row public.finder_saved_searches; v_count integer;
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'finder_saved_searches_save: clerk_user_id is required' using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  -- A re-save under the same name updates it; only a NEW name counts against the cap.
  if not exists (select 1 from public.finder_saved_searches where clerk_user_id = p_clerk_user_id and name = p_name) then
    select count(*) into v_count from public.finder_saved_searches where clerk_user_id = p_clerk_user_id;
    if v_count >= 25 then
      raise exception 'finder_saved_searches_save: limit of 25 saved searches reached' using errcode = '54000';
    end if;
  end if;
  insert into public.finder_saved_searches as s
    (clerk_user_id, name, niche, location, radius_miles, include_chains)
  values (p_clerk_user_id, p_name, p_niche, p_location, coalesce(p_radius_miles, 15), coalesce(p_include_chains, false))
  on conflict (clerk_user_id, name) do update
    set niche = excluded.niche, location = excluded.location,
        radius_miles = excluded.radius_miles, include_chains = excluded.include_chains, updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.finder_saved_searches_delete(p_clerk_user_id text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_deleted integer;
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'finder_saved_searches_delete: clerk_user_id is required' using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  delete from public.finder_saved_searches where id = p_id and clerk_user_id = p_clerk_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

-- ---------------------------------------------------------------- "looks wrong" feedback
create or replace function public.finder_lead_feedback_list(p_clerk_user_id text)
returns setof public.finder_lead_feedback
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'finder_lead_feedback_list: clerk_user_id is required' using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  return query select * from public.finder_lead_feedback
    where clerk_user_id = p_clerk_user_id order by created_at desc limit 500;
end;
$$;

create or replace function public.finder_lead_feedback_add(
  p_clerk_user_id text, p_business_id text, p_reason text, p_note text default null
)
returns public.finder_lead_feedback
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_row public.finder_lead_feedback; v_count integer;
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'finder_lead_feedback_add: clerk_user_id is required' using errcode = '28000';
  end if;
  if p_business_id is null or p_business_id = '' then
    raise exception 'finder_lead_feedback_add: business_id is required' using errcode = '22023';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  -- The cap is for NEW flags only: re-sending an existing business/reason pair (to change its note, or to retry
  -- after a lost response) must still work when the user is at the limit.
  if not exists (
    select 1 from public.finder_lead_feedback
    where clerk_user_id = p_clerk_user_id and business_id = p_business_id and reason = p_reason
  ) then
    select count(*) into v_count from public.finder_lead_feedback where clerk_user_id = p_clerk_user_id;
    if v_count >= 500 then
      raise exception 'finder_lead_feedback_add: limit of 500 flags reached' using errcode = '54000';
    end if;
  end if;
  -- The CHECK constraint rejects an unknown reason; the same flag twice is a no-op that returns the existing row.
  insert into public.finder_lead_feedback (clerk_user_id, business_id, reason, note)
  values (p_clerk_user_id, p_business_id, p_reason, p_note)
  on conflict (clerk_user_id, business_id, reason) do update set note = coalesce(excluded.note, public.finder_lead_feedback.note)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.finder_lead_feedback_delete(p_clerk_user_id text, p_business_id text, p_reason text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_deleted integer;
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'finder_lead_feedback_delete: clerk_user_id is required' using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  delete from public.finder_lead_feedback
    where clerk_user_id = p_clerk_user_id and business_id = p_business_id and reason = p_reason;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

-- ---------------------------------------------------------------- public enrichment cache (no identity)
create or replace function public.business_enrichment_cache_get(p_host text)
returns jsonb
language sql security definer set search_path = public, pg_temp stable
as $$
  select enrichment from public.business_enrichment_cache where host = lower(p_host) and expires_at > now();
$$;

create or replace function public.business_enrichment_cache_put(p_host text, p_enrichment jsonb, p_ttl_seconds integer default 604800)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_host is null or char_length(p_host) < 3 then
    raise exception 'business_enrichment_cache_put: host is required' using errcode = '22023';
  end if;
  insert into public.business_enrichment_cache (host, enrichment, fetched_at, expires_at)
  values (lower(p_host), p_enrichment, now(), now() + make_interval(secs => least(greatest(coalesce(p_ttl_seconds, 604800), 60), 2592000)))
  on conflict (host) do update set enrichment = excluded.enrichment, fetched_at = now(), expires_at = excluded.expires_at;
  -- Opportunistic cleanup keeps the table small without a scheduled job.
  delete from public.business_enrichment_cache where expires_at < now() - interval '1 day';
end;
$$;

-- ---------------------------------------------------------------- grants
revoke all on function public.finder_saved_searches_list(text) from public, anon, authenticated;
revoke all on function public.finder_saved_searches_save(text, text, text, text, integer, boolean) from public, anon, authenticated;
revoke all on function public.finder_saved_searches_delete(text, uuid) from public, anon, authenticated;
revoke all on function public.finder_lead_feedback_list(text) from public, anon, authenticated;
revoke all on function public.finder_lead_feedback_add(text, text, text, text) from public, anon, authenticated;
revoke all on function public.finder_lead_feedback_delete(text, text, text) from public, anon, authenticated;
revoke all on function public.business_enrichment_cache_get(text) from public, anon, authenticated;
revoke all on function public.business_enrichment_cache_put(text, jsonb, integer) from public, anon, authenticated;
grant execute on function public.finder_saved_searches_list(text) to service_role;
grant execute on function public.finder_saved_searches_save(text, text, text, text, integer, boolean) to service_role;
grant execute on function public.finder_saved_searches_delete(text, uuid) to service_role;
grant execute on function public.finder_lead_feedback_list(text) to service_role;
grant execute on function public.finder_lead_feedback_add(text, text, text, text) to service_role;
grant execute on function public.finder_lead_feedback_delete(text, text, text) to service_role;
grant execute on function public.business_enrichment_cache_get(text) to service_role;
grant execute on function public.business_enrichment_cache_put(text, jsonb, integer) to service_role;
