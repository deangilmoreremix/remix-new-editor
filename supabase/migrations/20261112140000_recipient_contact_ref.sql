-- ===========================================================================
-- recipient_contact_ref.sql  (additive)
--
-- Remember which local contact a recipient link was made for, so the bulk link
-- manager is idempotent (never two active links for one contact on a video).
-- Owner-facing only: resolve_recipient() returns just `variables`, so this
-- never reaches a viewer.
-- ===========================================================================
alter table public.video_recipients
  add column if not exists contact_ref text
    check (contact_ref is null or contact_ref ~ '^[A-Za-z0-9_-]{1,80}$');

create unique index if not exists video_recipients_active_contact_uidx
  on public.video_recipients (video_id, contact_ref)
  where status = 'active' and contact_ref is not null;
