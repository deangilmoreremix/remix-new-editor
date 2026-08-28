-- ============================================================
-- SmartVideo Universal Model Engine — Database Schema
--
-- Adds:
--   ai_models — synchronized MuAPI model registry
--   model_ui_overrides — per-model UI customization
--   model_pricing_rules — per-model pricing markup
--   generation_jobs — universal generation job tracking
--
-- Preserves all existing SmartVideo tables.
-- ============================================================

-- 1. ai_models: Universal model registry
create table if not exists public.ai_models (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_name text not null,
  display_name text,
  description text,
  category text,
  family text,
  group_of text,
  endpoint text,
  estimate_endpoint text,
  cost numeric,
  cost_currency text,
  dynamic_pricing boolean default false,
  input_schema jsonb,
  output_schema jsonb,
  enabled boolean default false,
  featured boolean default false,
  recommended boolean default false,
  studios text[] default array[]::text[],
  tags text[] default array[]::text[],
  synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(provider, model_name)
);

alter table public.ai_models enable row level security;

drop policy if exists "ai_models_select_all" on public.ai_models;
create policy "ai_models_select_all" on public.ai_models
  for select to anon, authenticated using (true);

drop policy if exists "ai_models_admin_insert" on public.ai_models;
create policy "ai_models_admin_insert" on public.ai_models
  for insert to authenticated with check (public.is_admin());

drop policy if exists "ai_models_admin_update" on public.ai_models;
create policy "ai_models_admin_update" on public.ai_models
  for update to authenticated using (public.is_admin());

drop policy if exists "ai_models_admin_delete" on public.ai_models;
create policy "ai_models_admin_delete" on public.ai_models
  for delete to authenticated using (public.is_admin());

create index if not exists idx_ai_models_provider on public.ai_models(provider);
create index if not exists idx_ai_models_enabled on public.ai_models(enabled) where enabled = true;
create index if not exists idx_ai_models_category on public.ai_models(category);
create index if not exists idx_ai_models_featured on public.ai_models(featured) where featured = true;

grant select on table public.ai_models to anon, authenticated;
grant insert, update, delete on table public.ai_models to authenticated;

-- 2. model_ui_overrides: Per-model UI customization
create table if not exists public.model_ui_overrides (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_name text not null,
  field_name text not null,
  canonical_field text,
  component text,
  label text,
  description text,
  section text,
  sort_order integer,
  advanced boolean default false,
  hidden boolean default false,
  config jsonb default '{}'::jsonb,
  unique(provider, model_name, field_name)
);

alter table public.model_ui_overrides enable row level security;

drop policy if exists "model_ui_overrides_select_all" on public.model_ui_overrides;
create policy "model_ui_overrides_select_all" on public.model_ui_overrides
  for select to anon, authenticated using (true);

drop policy if exists "model_ui_overrides_admin_modify" on public.model_ui_overrides;
create policy "model_ui_overrides_admin_modify" on public.model_ui_overrides
  for all to authenticated using (public.is_admin());

grant select on table public.model_ui_overrides to anon, authenticated;
grant insert, update, delete on table public.model_ui_overrides to authenticated;

-- 3. model_pricing_rules: Per-model pricing markup
create table if not exists public.model_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_name text not null,
  markup_multiplier numeric(10, 4) not null default 1.0,
  minimum_credits integer not null default 1,
  credit_rate numeric(10, 4) not null default 1.0,
  subscription_tier text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(provider, model_name)
);

alter table public.model_pricing_rules enable row level security;

drop policy if exists "model_pricing_rules_select_all" on public.model_pricing_rules;
create policy "model_pricing_rules_select_all" on public.model_pricing_rules
  for select to anon, authenticated using (true);

drop policy if exists "model_pricing_rules_admin_modify" on public.model_pricing_rules;
create policy "model_pricing_rules_admin_modify" on public.model_pricing_rules
  for all to authenticated using (public.is_admin());

grant select on table public.model_pricing_rules to anon, authenticated;
grant insert, update, delete on table public.model_pricing_rules to authenticated;

-- 4. generation_jobs: Universal generation job tracking
create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  provider text not null,
  model_name text not null,
  provider_request_id text,
  inputs jsonb default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  estimated_provider_cost numeric(10, 4) default 0,
  actual_provider_cost numeric(10, 4),
  charged_credits integer default 0,
  outputs jsonb,
  error jsonb,
  studio_type text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.generation_jobs enable row level security;

drop policy if exists "generation_jobs_select_own" on public.generation_jobs;
create policy "generation_jobs_select_own" on public.generation_jobs
  for select to authenticated
  using (tenant_id in (select tenant_id from user_profiles where id = auth.uid()));

drop policy if exists "generation_jobs_insert_own" on public.generation_jobs;
create policy "generation_jobs_insert_own" on public.generation_jobs
  for insert to authenticated
  with check (tenant_id in (select tenant_id from user_profiles where id = auth.uid()));

drop policy if exists "generation_jobs_update_own" on public.generation_jobs;
create policy "generation_jobs_update_own" on public.generation_jobs
  for update to authenticated
  using (tenant_id in (select tenant_id from user_profiles where id = auth.uid()));

create index if not exists idx_generation_jobs_tenant_id on public.generation_jobs(tenant_id);
create index if not exists idx_generation_jobs_user_id on public.generation_jobs(user_id);
create index if not exists idx_generation_jobs_status on public.generation_jobs(status);
create index if not exists idx_generation_jobs_created_at on public.generation_jobs(created_at desc);
create index if not exists idx_generation_jobs_provider_request_id on public.generation_jobs(provider_request_id);

grant select, insert, update on table public.generation_jobs to authenticated;

-- 5. Helper function for atomic credit decrement
create or replace function public.decrement_credits(
  p_tenant_id uuid,
  p_amount numeric
)
returns void as $$
begin
  update public.credit_balances
  set credits_available = credits_available - p_amount,
      credits_consumed = credits_consumed + p_amount,
      updated_at = now()
  where tenant_id = p_tenant_id
    and credits_available >= p_amount;
end;
$$ language plpgsql security definer;

-- Trigger for updated_at on ai_models
create trigger update_ai_models_updated_at
  before update on public.ai_models
  for each row execute function update_updated_at_column();

-- Trigger for updated_at on model_pricing_rules
create trigger update_model_pricing_rules_updated_at
  before update on public.model_pricing_rules
  for each row execute function update_updated_at_column();
