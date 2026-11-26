# Social publishing: dependency audit, feature audit and verification record

Scope: `SocialPublishModal` (React) + Studio panel + the new durable scheduler. MuAPI is the only social publishing provider.
Everything below was read from source / `node_modules` / run, not taken from documentation. "Verified" means a test or a run in
this repo; "Not verified" means it could not be exercised here and needs the manual steps at the end.

## 1. Dependencies (installed versions, licences, cost)

| Package | Version | Licence | Runs fully in browser | Server / key / model | Paid? | Used for |
|---|---|---|---|---|---|---|
| mediabunny (mediabunny.dev) | 1.64.0 | **MPL-2.0** (file-level copyleft; fine unmodified, commercial OK) | Yes (WebCodecs) | none | No | Video reframe/trim/compress (`shared/social/mediaProcessing.ts`) |
| idb-keyval (jakearchibald/idb-keyval) | 6.3.0 | Apache-2.0 | Yes (IndexedDB) | none | No | Local drafts/templates (`shared/social/draftStore.ts`) |
| @bg0/browser (opencoredev/bg0) | 0.1.1 | Apache-2.0 (code; **model-weight licence not verified**) | Yes (WebGPU, WASM fallback) | ~190 MB model download on first use | No | Background removal (existing: Asset Finder, template generator) |
| @huggingface/transformers | 4.3.1 | Apache-2.0 | Yes | model download per model (model licences vary) | No | Existing on-device ML workers |
| @remotion/whisper-webgpu | 4.0.540 | MIT (package) | Yes (WebGPU; needs model download) | Whisper model download | No | Existing local transcription (template generator) |
| @remotion/whisper-web | 4.0.540 | **UNLICENSED in package.json** | Yes (needs cross-origin-isolated page) | model download | No | Existing fallback transcription. **Licence unclear: do not rely on it for commercial claims** |
| remotion / @remotion/* (player, captions, web-renderer…) | 4.0.540 | **Remotion License: free for individuals and small companies; a paid Company License is required for larger for-profit companies** | Yes | none | **Conditionally** | Existing editor/caption rendering. Not classified as universally free |
| @ffmpeg/ffmpeg, @ffmpeg/util | 0.12.15 / 0.12.2 | MIT (wrappers). **The ffmpeg-core WASM build is LGPL/GPL depending on the build; codec builds (e.g. x264) carry patent/GPL terms** | Yes | downloads core WASM | No | Existing editor tooling; **not used by the new code** |
| web-push | 3.6.7 | MPL-2.0 | n/a (server) | VAPID keys | No | Existing push delivery (reused) |
| jose | 6.2.18 | MIT | n/a (server) | Clerk JWKS | No | Clerk token check (reused) |
| @supabase/supabase-js | 2.119.2 | MIT | n/a | Supabase project | Existing plan | Cloud persistence (reused) |
| lucide-react | 1.79.0 | ISC | Yes | none | No | Icons |

**New dependencies added by this work: none.** New server code uses Node's built-in `crypto` only.
Not installed and not proposed: FullCalendar (premium plugins are paid; the existing hand-built calendar is kept), any hosted AI service.
Paid-call check: new browser features make **no** network calls. The only new network calls are server-side to `api.muapi.ai`
publish/poll endpoints (the same MuAPI calls the Publish button already makes, billed per publish by MuAPI as today).
The existing "Schedule post" AI writer (PR #299) spends the user's MuAPI credit; that is existing behaviour and untouched.

## 2. Feature audit

Status key: **Done** = implemented and tested here. **Existing** = already in the app, not changed. **Not wired** = exists elsewhere in the
app but is not connected to this modal in this pass. **Missing**.

| Feature | Status | Free API / library | Source file(s) | Browser support | Backend | Test evidence | Blocker |
|---|---|---|---|---|---|---|---|
| Durable automatic publishing | **Done** | Node crypto, Supabase, Netlify scheduled fn | `supabase/migrations/20261126120000_scheduled_publishing.sql`, `netlify/functions/scheduled-publish.mjs`, `_shared/scheduledPublish.js` | n/a (server) | Supabase + Netlify (existing) | 17 server tests; SQL run on real PostgreSQL 16 (insert/update guard, claim, locks, RLS) | Needs `SCHEDULER_KEY_SECRET` env var; **not run on live Netlify/MuAPI** |
| Server-side encrypted MuAPI key (opt-in) | **Done** | AES-256-GCM | `_shared/socialKeyCrypto.js`, `social-publish-key.js` | n/a | Netlify fn, table with no client access | round-trip, wrong-owner, tamper tests; consent + delete tests | same env var |
| Idempotency / no duplicate posts | **Done** | `submitting` marker written before the request; request id saved; published destinations skipped | `scheduledPublish.js` | n/a | — | tests: interrupted submit → not re-sent; resume by request id; network failure → ambiguous, not re-sent | Real MuAPI behaviour on a lost response is not verified |
| Retry, cancel, reschedule, manual retry | **Done** | — | `publishJobs.js`, `AutoPublishPanel.tsx`, SQL guard | all | Supabase | 10 client tests, 8 panel tests, SQL transition tests | — |
| UTC storage, zone display | **Done** | Intl | `publishJobs.toJobRow`, `shared/social/calendar.ts` | all modern | — | tests incl. DST | — |
| Calendar day/week/month + drag-to-reschedule | **Existing (Studio, #293)** + server jobs added | Intl | `PlanPanel.tsx` | all | Supabase for jobs | panel test | — |
| Push for real publish results | **Done** (server writes `owner_notifications`; existing trigger → `push-dispatch`) | Web Push (existing) | migration, `alertTypes.js`, `pushAdapter.js`, `scheduledPublish.js` | Chrome/Edge/Firefox; Safari needs installed web app | existing push stack | push-type test, notification test | Trigger/VAPID delivery **not verified end to end** |
| Publishing history | **Done** | — | `AutoPublishPanel.tsx` | all | Supabase | panel test | — |
| Engagement analytics | **Missing, by design** | none | — | — | — | UI states no data is shown | MuAPI exposes no authorised engagement data to this app |
| Platform previews, safe zones, validation | **Existing (Studio, #293)** | HTML/CSS | `PlatformPreviews.tsx`, `platformConfig.ts`, `validation.ts` | all | — | tests | — |
| Reusable templates, captions, hashtag groups | **Existing (Studio, #293)** | idb-keyval | `OptimizePanel.tsx`, `collections.ts` | all | local only | tests | not synced across devices |
| Batch media processing | Partial | — | `jobQueue.ts` (queue, cancel, memory budget) | all | — | 3 queue tests | **No UI** for multi-post batches; no dedicated Web Worker |
| Background removal | **Not wired** | BG0 (Apache-2.0) | existing `cutout.js`, `bg0Engine.js`, `backgroundRemovalClient.ts` | WebGPU/WASM | none | existing tests | not connected to the Social modal |
| Local transcription | **Not wired** | Whisper WebGPU | existing `captions.worker.js`, `src/lib/editor/remotion/transcribe.worker.js` | WebGPU; CPU fallback | none | existing tests | not connected to the Social modal |
| Burned-in captions | **Not wired** | Remotion captions (licence above) | existing `src/lib/editor/remotion/captions.js` | WebCodecs | none | existing | not connected; licence condition applies |
| Audio adjustment (Web Audio) | **Missing** | Web Audio | — | all modern | — | — | not built |
| Scheduled YouTube custom thumbnail | **Missing** for automatic jobs | — | — | — | — | UI warns | the follow-up `youtube-set-thumbnail` call is only done by the interactive Publish path |

## 3. Honest verification status

Verified here: unit/integration tests (server runner, key crypto, client API, panel UI, push gating); the migration and its guard/claim
logic on a real PostgreSQL 16 instance (a role-switching harness imitating Supabase's `auth.role()`/JWT claims, not a Supabase project).
A bug was found and fixed by that run: the guard trigger was `SECURITY DEFINER`, so every caller looked like the server.

**Not verified (cannot be done from this sandbox):** a real scheduled run on Netlify with the browser closed; a real MuAPI publish
(needs an authorised test account); push delivery to a real device; Chrome/Edge/Firefox/Safari/mobile runs; unsupported-codec,
failed-model-download, permission-denial and large-file behaviour in real browsers. Do not treat the feature as production-verified
until the checklist below passes.

## 4. Deployment steps (required before the scheduler does anything)
1. Apply `20261126120000_scheduled_publishing.sql` to Supabase (after `20261125120000_scheduled_posts.sql`).
2. Netlify env: `SCHEDULER_KEY_SECRET` = `openssl rand -base64 32`. `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_URL` already used by other functions. Without the secret, the UI shows "isn't set up on the server yet" and nothing can be stored.
3. Existing push env (`PUSH_DISPATCH_SECRET`, VAPID keys, pg_net trigger) must already be live for notifications.

## 5. Manual verification checklist (authorised test accounts only)
1. Turn on Automatic publishing (consent + key). Confirm the Supabase `social_publish_credentials` row is ciphertext and not readable with the anon key.
2. Schedule a post 3 minutes ahead to a TEST account, **close the browser**, wait. Confirm the post appears, `scheduled_posts.status = 'posted'`, `results[].url` is set, and a push/in-app notification arrives.
3. Schedule, then cancel before the time: nothing is published. Schedule, then drag to another day: time of day kept, shown in your zone.
4. Break the account connection, schedule, confirm `failed` + plain error + push; reconnect, press Retry: only the failed destination is sent.
5. Kill the function mid-run (or set the Netlify function timeout low) and confirm the next tick resumes without a second post.
6. Turn the feature off: key row deleted, waiting jobs cancelled.
7. Repeat the Studio checklist (`docs/social-studio-audit-and-qa.md`) in Chrome, Edge, Firefox, Safari and a phone.
