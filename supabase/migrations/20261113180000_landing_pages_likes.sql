-- ===========================================================================
-- landing_pages_likes.sql
--
-- Adds the viewer "Like" button to video landing pages:
--   * 'like' becomes a valid landing_page_events.kind
--   * record_page_event() accepts it
--   * page_stats() also returns a likes count
--
-- Incremental on top of 20261113120000_create_landing_pages.sql (already
-- applied to the test branch), so it is a separate file.
-- ===========================================================================

alter table public.landing_page_events drop constraint if exists landing_page_events_kind_check;
alter table public.landing_page_events add constraint landing_page_events_kind_check
  check (kind in ('view', 'play', 'progress_25', 'progress_50', 'progress_75', 'complete', 'cta_click', 'lead', 'like'));

create or replace function public.record_page_event(
  page_id text,
  kind text,
  contact_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if kind not in ('view', 'play', 'progress_25', 'progress_50', 'progress_75', 'complete', 'cta_click', 'lead', 'like') then
    return;
  end if;
  if contact_id is not null and contact_id !~ '^[A-Za-z0-9_-]{1,80}$' then
    contact_id := null;
  end if;
  insert into public.landing_page_events (page_id, contact_id, kind)
  select p.id, record_page_event.contact_id, record_page_event.kind
    from public.landing_pages p
   where p.id = record_page_event.page_id
     and p.published = true;
  if kind = 'view' then
    update public.landing_pages
       set view_count = view_count + 1
     where id = record_page_event.page_id and published = true;
  end if;
end;
$$;

revoke all on function public.record_page_event(text, text, text) from public;
grant execute on function public.record_page_event(text, text, text) to anon, authenticated;

-- The return type changes (new column), so the function is replaced, not altered.
drop function if exists public.page_stats(text);
create function public.page_stats(page_id text)
returns table (
  views bigint,
  plays bigint,
  completes bigint,
  cta_clicks bigint,
  leads bigint,
  unique_contacts bigint,
  likes bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*) filter (where e.kind = 'view'),
         count(*) filter (where e.kind = 'play'),
         count(*) filter (where e.kind = 'complete'),
         count(*) filter (where e.kind = 'cta_click'),
         count(*) filter (where e.kind = 'lead'),
         count(distinct e.contact_id),
         count(*) filter (where e.kind = 'like')
    from public.landing_page_events e
   where e.page_id = page_stats.page_id;
$$;

revoke all on function public.page_stats(text) from public;
grant execute on function public.page_stats(text) to anon, authenticated;
