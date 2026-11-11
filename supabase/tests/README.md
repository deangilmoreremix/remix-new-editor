# SQL behaviour tests (local Postgres)

These scripts exercise the real migrations (RLS, RPCs, triggers) against a plain
Postgres 16 with a tiny Supabase shim (`auth.jwt()` + the `anon` / `authenticated`
/ `service_role` roles). They print results (there is no pass/fail harness);
read the output against the labels in each script. The Supabase CLI / Docker are
not required.

```bash
createdb svtest && psql -q -d svtest -f supabase/tests/00_shim_local_postgres.sql
for m in 20260730_create_distributed_rate_limiter 20261105120000_create_published_videos \
         20261105160000_published_video_events 20261112000000_create_timeline_projects \
         20261112010000_publish_hardening_slugs 20261112020000_video_analytics \
         20261112030000_retargeting_notifications; do psql -q -v ON_ERROR_STOP=1 -d svtest -f supabase/migrations/$m.sql; done
psql -d svtest -f supabase/tests/10_projects_rls.sql   # then 20_, 30_, 40_ (use a fresh database for 40_)
```
Scripts 10-41 are independent: re-create the database between them.
