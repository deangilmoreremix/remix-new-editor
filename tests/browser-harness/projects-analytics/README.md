# Projects / Analytics browser verification harness

Local-only harness used to verify the Projects section in a real browser against a real Postgres
(the repo's migrations, RLS, RPCs and triggers). It is **not** run in CI and needs no Supabase CLI or Docker.

- `seed.py` generates `seed.sql`: projects, published videos, and ~160 viewing sessions pushed through the real
  `ingest_video_events()` (so notifications come from the real triggers), then dates are spread over 60 days.
- `bridge.mjs` is a small REST bridge (NOT product code) that turns the PostgREST calls the UI makes into SQL and
  runs them with the caller's JWT `sub`, so row-level security is exercised. Run it with `node bridge.mjs`.
- `e2e.cjs` drives Chromium (Playwright) through the app (Vite dev server on :3100 started with
  `VITE_SUPABASE_URL=http://127.0.0.1:54321`), compares every displayed figure with SQL ground truth, and checks
  desktop / tablet / mobile layouts and tenant isolation.

Setup, in short: create a database, apply `supabase/tests/00_shim_local_postgres.sql` and the migrations listed in
`supabase/tests/README.md`, `python3 seed.py && psql -f seed.sql`, set the `postgres` password to `browsertest`,
mint test JWTs (HS256, `sub` = `userA` / `userB`) into `tokens.json`, serve `media/kitchen.mp4` and
`media/thumb-kitchen.png` on :8099 (any CORS-enabled static server), then `node bridge.mjs` and `node e2e.cjs`.

## Real-chain scripts
- `fn-adapter.mjs` serves the REAL `netlify/functions/video-events.js` handler on :8890 (start it with `SUPABASE_URL` = the bridge and `SUPABASE_SERVICE_ROLE_KEY` = an HS256 JWT with `role: service_role`).
- `chain.cjs`: hosted player (`/v/<business>/<slug>`) -> analyticsClient -> function -> database -> Analytics tab, plus consent (DNT), idempotency, unpublished/forged/malformed/rate-limit checks. Only stub: the Deno `lead-capture` edge function.
- `publish.cjs`: editor Share panel publish, readable link, slug change + redirect, reserved names, namespace protection, privacy, unpublish/republish/revisions, and the interest map producing server-calculated scores.
