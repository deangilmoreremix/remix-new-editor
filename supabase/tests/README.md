# Local SQL behavior tests (no Supabase project needed)

`live_replica.sql` rebuilds the publishing tables/functions the LIVE project already has (read from the database),
`supabase_shim.sql` provides the `anon` / `authenticated` roles and `auth.jwt()`. The new migrations are applied on
top and `recipients_drafts_library.test.sql` checks isolation, revocation, drafts and promotion.

```bash
# as a non-root user:
initdb -D /tmp/pgtest -A trust && pg_ctl -D /tmp/pgtest -o '-p 54329 -k /tmp' -w start
psql -h /tmp -p 54329 -U postgres -v ON_ERROR_STOP=1 -f supabase/tests/supabase_shim.sql
psql -h /tmp -p 54329 -U postgres -v ON_ERROR_STOP=1 -f supabase/tests/live_replica.sql
for f in 20261112120000_business_asset_library 20261112150000_recipients_and_drafts; do
  psql -h /tmp -p 54329 -U postgres -v ON_ERROR_STOP=1 -f supabase/migrations/$f.sql; done
psql -h /tmp -p 54329 -U postgres -f supabase/tests/recipients_drafts_library.test.sql   # prints ALL LIVE-SCHEMA CHECKS PASSED
```

These prove the SQL logic against a replica of the live schema; they do not replace the post-apply checks on the real project.
