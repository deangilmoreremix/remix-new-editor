// Database object names for the embedded Smart Website Builder.
//
// The builder shares SmartVideo's Supabase project, which already has its own
// `projects`, `profiles`, `templates`, ... tables. Every builder table, RPC and
// storage bucket is therefore namespaced with `wb_` (see
// supabase/migrations/20261102120000_website_builder_schema.sql in the main
// repo). Always reference these constants instead of bare names.
export const T = {
  projects: 'wb_projects',
  profiles: 'wb_profiles',
  provider_keys: 'wb_provider_keys',
  default_models: 'wb_default_models',
  project_collaborators: 'wb_project_collaborators',
  project_backends: 'wb_project_backends',
  templates: 'wb_templates',
  blog_posts: 'wb_blog_posts',
  notifications: 'wb_notifications',
  app_config: 'wb_app_config',
  community_posts: 'wb_community_posts',
  community_likes: 'wb_community_likes',
} as const

export const RPC = {
  admin_list_users: 'wb_admin_list_users',
  delete_user: 'wb_delete_user',
  find_account_by_email: 'wb_find_account_by_email',
} as const

/** Public storage bucket for project preview thumbnails. */
export const PREVIEW_BUCKET = 'wb-deployments'
