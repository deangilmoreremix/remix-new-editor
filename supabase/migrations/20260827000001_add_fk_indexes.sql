-- Add missing foreign key indexes for performance
-- These indexes speed up queries that filter by user_id or project_id

-- project_backends: queried by user_id in api/_supabase.ts
CREATE INDEX IF NOT EXISTS idx_project_backends_user_id ON public.project_backends(user_id);

-- supabase_connections: queried by user_id in api/_supabase.ts
CREATE INDEX IF NOT EXISTS idx_supabase_connections_user_id ON public.supabase_connections(user_id);

-- project_migrations: queried by project_id for mirroring
CREATE INDEX IF NOT EXISTS idx_project_migrations_project_id ON public.project_migrations(project_id);

-- provider_keys: queried by user_id for key lookups
CREATE INDEX IF NOT EXISTS idx_provider_keys_user_id ON public.provider_keys(user_id);

-- notifications: queried for active notifications
CREATE INDEX IF NOT EXISTS idx_notifications_active ON public.notifications(is_active) WHERE is_active = true;
