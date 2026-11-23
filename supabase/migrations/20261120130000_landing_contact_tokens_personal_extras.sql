-- Personal links can now carry each contact's own website, phone, offer, button link, industry,
-- brand colour, picture and video. Only these whitelisted keys are ever returned to a viewer, and
-- only for a published page (email and any other field stay owner-only).
create or replace function public.landing_page_contact_tokens(page_id text, contact_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(kv.key, kv.value) filter (
      where kv.key in (
        'firstname', 'lastname', 'company', 'companylogo', 'role', 'city', 'custom1', 'custom2', 'custom3',
        'website', 'phone', 'offer', 'cta', 'industry', 'accent', 'image', 'video'
      )
    ),
    '{}'::jsonb
  )
    from public.landing_page_contacts c
    join public.landing_pages p on p.id = c.page_id and p.published = true
    cross join lateral jsonb_each(c.fields) as kv
   where c.id = landing_page_contact_tokens.contact_id
     and c.page_id = landing_page_contact_tokens.page_id;
$$;

revoke all on function public.landing_page_contact_tokens(text, text) from public;
grant execute on function public.landing_page_contact_tokens(text, text) to anon, authenticated;
