-- ===========================================================================
-- template_generator_templates_labels.sql
--
-- LABELS ONLY — no data, grants or access rules change.
--
-- This Supabase project is SHARED by several applications. Everything the Template
-- Generator (the timeline editor's reusable-templates feature) added is labelled so
-- anyone looking at the database can tell which app owns it:
--
--   * every object name starts with `template_generator_`
--     (table, index, function, trigger, and — renamed here — the four RLS policies,
--      which used to have generic names like "Owners read own templates");
--   * every object carries a `COMMENT` starting with `[app: template-generator]`
--     (visible in the Supabase dashboard and in psql `\d+`).
--
-- Objects owned by this app (list kept here so it can be audited or removed as a unit):
--   table    public.template_generator_templates
--   index    template_generator_templates_owner_updated_idx
--   function public.template_generator_templates_guard()
--   trigger  template_generator_templates_guard  (on the table)
--   policies template_generator_owners_{read,insert,update,delete}_own  (on the table)
--
-- Find them any time:
--   select c.relname, obj_description(c.oid) from pg_class c
--     where obj_description(c.oid) like '[app: template-generator]%';
--
-- IDEMPOTENT: safe to re-run.
-- ===========================================================================

-- policies: generic names -> app-prefixed names (only if they still have the old name)
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('Owners read own templates',   'template_generator_owners_read_own'),
      ('Owners insert own templates', 'template_generator_owners_insert_own'),
      ('Owners update own templates', 'template_generator_owners_update_own'),
      ('Owners delete own templates', 'template_generator_owners_delete_own')
    ) as v(old_name, new_name)
  loop
    if exists (select 1 from pg_policies
               where schemaname = 'public' and tablename = 'template_generator_templates' and policyname = r.old_name) then
      execute format('alter policy %I on public.template_generator_templates rename to %I', r.old_name, r.new_name);
    end if;
  end loop;
end
$$;

comment on table public.template_generator_templates is
  '[app: template-generator] Reusable templates saved in the Template Generator (timeline editor) and synced across a signed-in user''s devices. Owner-only RLS on the Clerk subject; no anon access. Owned by the Template Generator app; other apps should not read or write it. Migrations: 20261112212041_create_template_generator_templates, 20261113040821_template_generator_templates_labels.';

comment on column public.template_generator_templates.clerk_user_id is '[app: template-generator] Owner: the verified Clerk subject from the JWT (auth.jwt() ->> ''sub''). Part of the primary key.';
comment on column public.template_generator_templates.id           is '[app: template-generator] Client-generated template id ("tpl-..."); unique per owner.';
comment on column public.template_generator_templates.name         is '[app: template-generator] Template name shown in My templates (max 120 chars).';
comment on column public.template_generator_templates.niche        is '[app: template-generator] Industry / niche the template was made for (optional).';
comment on column public.template_generator_templates.record       is '[app: template-generator] The template recipe as JSON: script, clips (by link), transition, text elements, voice settings, animation references. Max 256 KB.';
comment on column public.template_generator_templates.deleted_at   is '[app: template-generator] Delete marker (tombstone): set when the owner deletes a template so their other devices drop it too.';
comment on column public.template_generator_templates.created_at   is '[app: template-generator] When the row was first stored (set by the database, never rewritten).';
comment on column public.template_generator_templates.updated_at   is '[app: template-generator] Last edit, from the client clock (capped one day ahead); the newest edit wins when devices sync.';

comment on index public.template_generator_templates_owner_updated_idx is '[app: template-generator] Lists one owner''s templates, newest edit first.';

comment on function public.template_generator_templates_guard() is
  '[app: template-generator] BEFORE INSERT/UPDATE guard on template_generator_templates: caps updated_at one day ahead and keeps created_at fixed. Not callable by API roles.';

comment on trigger template_generator_templates_guard on public.template_generator_templates is
  '[app: template-generator] Runs template_generator_templates_guard() before every insert/update.';

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('template_generator_owners_read_own',   'read'),
      ('template_generator_owners_insert_own', 'insert'),
      ('template_generator_owners_update_own', 'update'),
      ('template_generator_owners_delete_own', 'delete')
    ) as v(policy_name, verb)
  loop
    if exists (select 1 from pg_policies
               where schemaname = 'public' and tablename = 'template_generator_templates' and policyname = r.policy_name) then
      execute format('comment on policy %I on public.template_generator_templates is %L',
                     r.policy_name,
                     format('[app: template-generator] Signed-in users may %s only their own templates (clerk_user_id = the token''s sub). Anon has no access.', r.verb));
    end if;
  end loop;
end
$$;
