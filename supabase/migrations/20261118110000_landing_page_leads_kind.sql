-- ===========================================================================
-- landing_page_leads_kind.sql — which form a page lead came from
--
-- Page forms now follow the timeline's List Builder / Lead Generator: a lead carries the form's kind
-- (Lead Generator = lead-form, List Builder = list-builder, Personalizer = personalizer). Additive and idempotent:
-- existing leads become 'lead-form'. Nothing is dropped or rewritten.
-- ===========================================================================
alter table public.landing_page_leads add column if not exists kind text not null default 'lead-form';
alter table public.landing_page_leads drop constraint if exists landing_page_leads_kind_check;
alter table public.landing_page_leads add constraint landing_page_leads_kind_check check (kind in ('lead-form', 'list-builder', 'personalizer'));
