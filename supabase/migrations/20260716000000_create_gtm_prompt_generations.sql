/*
  # GTM Prompt Generations Tracking

  Persists GTM cinematic-prompt generations produced via the OpenAI Responses
  API (ai-cinematic-prompt-generator edge function). Captures the structured
  prompt, token usage, and the OpenAI response id (for multi-turn refine),
  so usage can be audited/billed and previous responses replayed.

  ## Tables Created

  ### gtm_prompt_generations
  - `id` (uuid, PK): generation identifier
  - `user_id` (uuid, FK to auth.users): owner of the generation
  - `tenant_id` (uuid, FK to tenants, nullable): tenant ownership when available
  - `studio_type` (text): originating studio/theme (e.g. 'image-studio')
  - `action` (text): generate | refine | variants
  - `base_prompt` (text): user's original concept
  - `gtm_params` (jsonb): role/industry/methodology/tonality/focus/cinematicOptions
  - `structured_prompt` (jsonb): the Responses API json_schema output
  - `openai_response_id` (text): previous_response_id for multi-turn refine
  - `input_tokens` (int): Responses API usage.input_tokens
  - `output_tokens` (int): Responses API usage.output_tokens
  - `model` (text): model used (gpt-4.1-mini etc.)
  - `created_at` (timestamptz): generation timestamp
*/

create table if not exists public.gtm_prompt_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  tenant_id uuid,
  studio_type text,
  action text not null default 'generate',
  base_prompt text,
  gtm_params jsonb,
  structured_prompt jsonb,
  openai_response_id text,
  input_tokens integer default 0,
  output_tokens integer default 0,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists idx_gtm_prompt_generations_user
  on public.gtm_prompt_generations (user_id, created_at desc);

create index if not exists idx_gtm_prompt_generations_response
  on public.gtm_prompt_generations (openai_response_id)
  where openai_response_id is not null;

-- Row-level security: users only see their own generations.
alter table public.gtm_prompt_generations enable row level security;

drop policy if exists "gtm generations are readable by owner" on public.gtm_prompt_generations;
create policy "gtm generations are readable by owner"
  on public.gtm_prompt_generations
  for select
  using (auth.uid() = user_id);

drop policy if exists "gtm generations are insertable by owner" on public.gtm_prompt_generations;
create policy "gtm generations are insertable by owner"
  on public.gtm_prompt_generations
  for insert
  with check (auth.uid() = user_id);
