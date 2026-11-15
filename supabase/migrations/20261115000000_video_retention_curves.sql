-- Retention curves for many videos in ONE call.
--
-- The Projects cards and the Personalization Suite show a small "where viewers
-- stay" heatmap for each video. video_retention_curve() answers for a single
-- video, which meant one request per card. This returns the same curves
-- (bucket 0..99, viewers, base) for a list of videos at once.
--
-- Same security model as video_retention_curve(): SECURITY INVOKER, so the row
-- level security on video_view_sessions applies and a caller only ever gets
-- rows for videos they own. Ids the caller does not own simply return base = 0.
create or replace function public.video_retention_curves(p_video_ids text[], p_from date, p_to date)
returns table (video_id text, bucket integer, viewers bigint, base bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with ids as (
    -- Capped so one call can never fan out over an unbounded list.
    select distinct x as id from unnest((p_video_ids)[1:200]) as x where x is not null
  ),
  ss as (
    select s.video_id, s.covered
      from public.video_view_sessions s
      join ids on ids.id = s.video_id
     where s.played and (s.started_at at time zone 'utc')::date between p_from and p_to),
  base as (select ss.video_id, count(*) as n from ss group by ss.video_id),
  cnt as (select ss.video_id, b::integer as bucket, count(*) as viewers from ss, unnest(ss.covered) b group by ss.video_id, b)
  select ids.id, g.b, coalesce(c.viewers, 0)::bigint, coalesce(base.n, 0)::bigint
    from ids
    cross join generate_series(0, 99) as g(b)
    left join cnt c on c.video_id = ids.id and c.bucket = g.b
    left join base on base.video_id = ids.id
   order by ids.id, g.b;
$$;

revoke all on function public.video_retention_curves(text[], date, date) from public;
grant execute on function public.video_retention_curves(text[], date, date) to authenticated;
