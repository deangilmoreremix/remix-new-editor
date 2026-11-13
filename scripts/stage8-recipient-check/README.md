# Stage 8 — recipient tokens: full-stack check

`npx vitest run --config scripts/stage8-recipient-check/vitest.stage8.config.mjs` (about 1 min; needs `su postgres` access to a local Postgres 16). Not part of the default suite because it needs that database.

The real route handlers (`recipient-links/route.ts`) and the real `video-events.js` handler run against REAL SQL (the real migrations and the real `ingest_video_events`) on a throwaway database, through a `psql`-backed stand-in for PostgREST. Only the signed-in user (`auth()`) and logging are mocked. It proves the attack paths of the old `?c=<contactId>` scheme are closed: forged contact ids, made-up/truncated/other-video tokens, another user listing/revoking/issuing, revoked and expired links, retried batches.

The SQL-only assertions: `supabase/tests/run-recipient-links-assertions.sh` (43 assertions).
