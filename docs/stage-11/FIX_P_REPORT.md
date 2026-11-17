# Fix P: campaign attribution write path for heatmap analytics

Branch `claude/focused-brown-9xfv3c-fixP` (base e0808f243). Nothing pushed or merged. No live Supabase project was touched; all SQL ran on a throwaway local Postgres 16.

## Problem

Fix O added a heatmap campaign filter that stays hidden because nothing writes `video_view_sessions.campaign_id`. The campaigns branch (`origin/claude/modest-tesla-yhjel6`, never merged here) defines `video_campaigns`, `campaign_recipients` (with an unguessable `public_token`) and the anon RPC `get_campaign_recipient_page(token)`, but has no analytics link. This fix adds the column and the only writer.

## Design

- Migration `supabase/migrations/20261117200000_video_session_campaign_attribution.sql` (idempotent, applied twice in tests):
  - `video_view_sessions.campaign_id uuid` (nullable, added only if absent) and a partial index `(video_id, campaign_id) where campaign_id is not null`.
  - Foreign key to `video_campaigns(id)` (`on delete set null`) created in a DO block **only if `video_campaigns` exists** when the migration runs. If the campaigns migration is applied later, the column stays a plain uuid (documented in the migration with the one-line `alter table` to add the key). Nothing depends on the key.
  - New `attribute_video_session_campaign(p_video_id, p_session_key, p_token) returns jsonb`, SECURITY DEFINER, `search_path=''`, EXECUTE for `service_role` only (revoked from public/anon/authenticated).
- `netlify/functions/video-events.js`: accepts an optional body field `recipient` (shape `^[A-Za-z0-9_-]{16,64}$`, else ignored). After a successful `ingest_video_events` (which creates the session row) it calls the new RPC in a try/catch whose failure is swallowed. The `ingest_video_events` signature, grants, the heat RPC and the rate limits (checked before everything) are unchanged. The client response is byte-identical with or without a token.
- `src/lib/editor/publish/analyticsClient.js`: new `recipientToken` option, sent as `recipient` in every batch (so a retried first batch still carries it) only when well formed. `src/pages/WatchPage.jsx` passes `?cr=` as `recipientToken`. Old clients send nothing and are unaffected; a new client against an old function/DB works (unknown field ignored; RPC missing is swallowed).

### Why a separate RPC and not a new parameter on `ingest_video_events`

Adding a parameter means dropping and recreating a 200-line security-definer function (Fix O showed that overloads break PostgREST resolution when args are omitted) for no benefit. A separate writer keeps ingest untouched, keeps the existing grants test valid, and a missing function degrades to "not attributed".

### Carrier decision (with evidence)

Chosen: the **campaign recipient `public_token`** (`/watch/<video>?cr=<token>`).

- It is the only secret-bearing identifier the campaigns schema defines: `gen_random_bytes(18)` (144 bits), unique, and it is already the credential for `/p/<token>` (`get_campaign_recipient_page`, which also requires `status = 'ready'`).
- A bare campaign id was rejected: ids are uuids that appear in the owner's UI/URLs and are not secrets, so any viewer could claim another owner's campaign. A signed id would need a new server secret and a signing flow in the campaigns app; the token already is an unforgeable server-issued bearer value, so it adds nothing.
- Only the campaign id is stored. The token and recipient id never reach the sessions table (asserted).

## Security reasoning

The token is a lookup key, never an assertion. The RPC attributes only when one query finds a recipient with that token such that: recipient `status = 'ready'`, the campaign exists, **campaign.clerk_user_id = published video.clerk_user_id**, **recipient.clerk_user_id = the same owner**, and the video is published. Therefore:

- Spoofing another owner's campaign needs that owner's recipient token (144-bit, not enumerable; the existing per-client/session/video rate limits sit in front) and, even then, only attributes views of *that owner's own videos* to *that owner's campaign*. Using it on your own video (a different owner) fails the owner match.
- A leaked token lets its holder pollute only the same owner's campaign through that owner's own videos. That is inherent to bearer links and is the same trust the recipient page already has. The Fix O small-cohort rules still apply to what the owner sees.
- Never an oracle: the RPC never raises (all errors caught), returns the same shape for bad token / other owner / unknown session / missing tables, and the function response to the browser does not depend on it. Missing campaign tables: they are referenced only inside dynamic SQL after `to_regclass()` checks, so the migration applies and the writer is a silent no-op.
- First valid attribution wins (`campaign_id is null` guard): a replayed or altered link cannot move a session between campaigns; repeated batches are idempotent. A later valid token on a still-null session does attribute it (so a failed first batch can be retried).
- Residual: a recipient who shares their link widely inflates their own campaign (expected); a token holder can attribute sessions they create to their owner's campaign (cannot be told apart from real views without auth).

## What was proven (locally)

1. `supabase/tests/run-heatmap-assertions.sh` (plain and `HARDEN=1`): Stage 7 (36) and Fix O (36) assertions unchanged and passing; it now builds a second database through the new migration (applied twice) and runs the new `supabase/tests/72_campaign_attribution_assertions.sql`. Fix O's 71 needs a database without `campaign_id`, hence the two databases.
   72 on our branch alone (no campaign tables): ingest plus attribution call succeed and record NULL; garbage / null / SQL-looking tokens never raise; options RPC reports `available:true` with no campaigns (UI stays hidden). Then with campaign tables: valid token attributes (6 + 5 sessions); another owner's token, garbage token, pending recipient, recipient/campaign owner mismatch, owner A's token on B's video are all NOT attributed; B's own token on B's video is; identical response shape in every failure; first-wins and idempotence; unknown session / unpublished video no-ops; grants (service_role only, ingest unchanged, one overload, pinned search_path); no token stored.
2. Heatmap RPCs with `p_campaign`, on those sessions: clicks/cta/scroll/engagement for A1 count exactly its 6 sessions (no spoofed ones), A2 exactly 5 (K), options list exactly the two valid campaigns (not B's), a 3-session campaign is withheld (suppressed, 0 sessions), B's campaign id on A's video leaks nothing, owner B gets 42501 on A's video, B sees only its own campaign.
3. **Trial with the real campaigns schema, not merged into our branch**: throwaway worktree `/home/user/wt-fixP-trial` (branch `...-fixP-trial`), `git merge --no-commit origin/claude/modest-tesla-yhjel6` merged cleanly with no conflicts (router.js, studioRoutes.js auto-merged). Migrations applied in order: base set, Fix O, the campaigns migration (`pgcrypto` created first, Supabase has it), then the attribution migration twice. 72 passed plain and with `HARDEN=1` using the real tables (FK exists with `on delete set null`; deleting a campaign nulls its sessions). Browser harness with the real schema: 30/30. vitest in the trial (publish, projectLibrary, video-events tests, the campaigns branch's own engine test, migration tests): 258 pass. The trial worktree was removed with `git worktree remove --force`, the branch deleted with `git branch -D`, and the trial databases dropped.
4. Reverse deploy order (attribution migration applied before the campaigns migration, so no FK): every behavioural assertion passes (the only failing one is the "FK exists" assertion, as expected). The writer does not need the FK.
5. Real Chromium: new `tests/browser-harness/heatmaps/watch-campaign.mjs` (+ `mkdb-campaign.sh`): the real `WatchPage.jsx` opened with seven link variants, batches pushed through the real `video-events.js` handler into local Postgres: valid token attributed; another owner's token, garbage, malformed (never sent), no token, A's token on B's video: NULL; B's own token on B's video: attributed; handler responses identical; no token stored. 30/30 on both the stand-in tables and the real schema.
6. vitest (our branch): `src/lib/editor/publish`, `src/lib/editor/projectLibrary`, `netlify/functions/__tests__/video-events*`, `src/test/campaign-attribution-migration.test.js`, `src/test/heatmap-*migration*`: all pass (new: `video-events-campaign.test.js` 7 tests, `campaignAttribution.test.js` WatchPage wiring, analyticsClient token test, migration shape test). eslint (`NODE_OPTIONS=--max-old-space-size=6144`) on the changed src/netlify files: 0 errors (only pre-existing warnings). `tests/browser-harness` is outside the repo eslint config, as before.

## Not verified

- **Live Supabase**: not touched. Applying the migrations there, PostgREST schema-cache reload for the new RPC (the function calls it through `/rest/v1/rpc/`; until the cache sees it the call fails and is swallowed, i.e. attribution silently does not happen) and the real Clerk `sub` identity path are unverified. Local tests use the shim roles and a hand-set `request.jwt.claims`.
- Real Netlify runtime of `video-events.js` (tests call `handle()` with a fake `fetch` or a psql-backed `fetch`).
- The campaigns branch's own app code: it was only used for its schema. Nothing in it generates `?cr=` links.
- Overlapping date/device ranges differencing remains the documented Stage 7/Fix O residual.

## Deployment order

Migrations (Fix O filter migration, the campaigns migration, then this one), the app (`WatchPage`/`analyticsClient`) and the Netlify function should ship together; reload the PostgREST schema cache after migrating. Any order degrades safely: function before migration: attribution RPC missing, swallowed; app before function: the extra `recipient` field is ignored; migration before app/function: nothing writes, filter stays hidden (the options RPC reports `available:true` but lists no campaigns, so the UI hides it). Caveat: until campaign sessions exist, options returns `available:true` with an empty list on every database; the UI already hides the control in that case (Fix O).

## What the campaigns branch must do for this to be useful

1. Apply its migration (any order relative to this one; if it is applied after, add the optional FK from the migration header comment).
2. Every link it gives a recipient to a **published video** must be `https://<app>/watch/<video id>?cr=<campaign_recipients.public_token>` (or the `/v/<business>/<slug>` form with the same query string). The video must be owned by the same Clerk user as the campaign and the recipient row (the existing RLS already makes recipient.clerk_user_id the campaign owner for owner-created rows), and the recipient must be `status = 'ready'`.
3. Its `/p/<token>` page, which plays `output_video_url` directly and not through the watch page, would record nothing. If personalized outputs are to be measured, that page must either be published as a `published_videos` row and linked through the watch page with `?cr=`, or embed the same `createAnalytics({ videoId, recipientToken })` and `heatmapCapture`. That is campaigns-branch work and was not done here.
4. Do not pass the campaign id in links; the writer deliberately ignores it.
