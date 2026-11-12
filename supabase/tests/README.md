# Local SQL behavior tests (no Supabase project needed)

Runs the real migrations on a scratch Postgres with a minimal Supabase shim
(`anon` / `authenticated` roles, `auth.jwt()` reading `request.jwt.claims`).

```bash
initdb -D /tmp/pgtest -A trust && pg_ctl -D /tmp/pgtest -o '-p 54329 -k /tmp' -w start   # as a non-root user
psql -h /tmp -p 54329 -U postgres -f supabase/tests/supabase_shim.sql
for f in 20261105120000_create_published_videos 20261112120000_business_asset_library 20261112130000_publish_links; do
  psql -h /tmp -p 54329 -U postgres -v ON_ERROR_STOP=1 -f supabase/migrations/$f.sql; done
psql -h /tmp -p 54329 -U postgres -f supabase/tests/publish_links_and_library.test.sql   # prints ALL SQL SECURITY CHECKS PASSED
```

These prove the SQL logic only. They do not replace testing against a live Supabase project with Clerk third-party auth.
