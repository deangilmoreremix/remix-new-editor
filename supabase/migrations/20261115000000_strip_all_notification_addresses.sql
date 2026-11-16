-- ===========================================================================
-- strip_all_notification_addresses.sql
--
-- The public read path (get_published_video) removes private fields from a
-- project's JSON before anonymous viewers see it. The scrubber only knew the
-- single `notificationEmail` key, so these were still readable by anyone who
-- opened a published video:
--   * the Lead Generator's extra recipients: notificationEmail2, notificationEmail3
--   * the List Builder's recipients:          emailAddress, emailAddress2, emailAddress3
--
-- Widen the pattern. The scrub happens at read time, so this protects videos
-- that are already published, with no data migration. lead-capture reads the
-- recipients straight from the table with the service role, so notifications
-- are unaffected.
-- ===========================================================================

create or replace function public.strip_private_keys(j jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  el jsonb;
  out jsonb;
begin
  if jsonb_typeof(j) = 'object' then
    out := '{}'::jsonb;
    for k, el in select * from jsonb_each(j) loop
      if k ~* '^(webhook.*|notificationEmail[0-9]*|notifyEmail[0-9]*|callNotifyAddress|notifyAddress|emailAddress[0-9]*)$' then
        continue;
      end if;
      out := out || jsonb_build_object(k, public.strip_private_keys(el));
    end loop;
    return out;
  elsif jsonb_typeof(j) = 'array' then
    select coalesce(jsonb_agg(public.strip_private_keys(e.value) order by e.ord), '[]'::jsonb)
      into out from jsonb_array_elements(j) with ordinality as e(value, ord);
    return out;
  end if;
  return j;
end;
$$;
revoke all on function public.strip_private_keys(jsonb) from public;
