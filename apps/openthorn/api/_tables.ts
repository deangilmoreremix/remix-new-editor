// Database names used by the server endpoints. Mirrors src/lib/tables.ts: the
// builder shares SmartVideo's Supabase project, where the bare names belong to
// the main app, so every builder table is prefixed `wb_`.
export const TBL = {
  projects: 'wb_projects',
  profiles: 'wb_profiles',
  notifications: 'wb_notifications',
  supabase_connections: 'wb_supabase_connections',
  project_backends: 'wb_project_backends',
  project_migrations: 'wb_project_migrations',
  cloudflare_credentials: 'wb_cloudflare_credentials',
} as const
