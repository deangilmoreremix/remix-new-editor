# SmartVideo AI — final validation report (Stages 0–12, 2026-11-14)

Branch `claude/jolly-cannon-ofqf7h`. No pull request, merge, deploy or production migration was made. Recorder was out of scope.

## Gates run on the final tree
| Gate | Result |
|---|---|
| `npx vitest run` (whole repo) | 803 files; **11,680 passed**, 61 skipped (pre-existing), **1 failed**: `upload_file … 401 when x-api-key is missing`, a cold dynamic import that times out under the full run's load; it passes alone, within the whole `netlify` folder, and on a clean tree. |
| `npx eslint src --quiet` | clean |
| `npm run typecheck:personalization` | 0 errors in scope (98 pre-existing in imported vendored/legacy files) |
| Production `vite build` | succeeds |
| Real-browser checks (headless Chromium + ffmpeg/ffprobe/unzip) | Stage 3 **53/53**, 4 **40/40**, 5 **40/40**, 6 **36/36**, 7 **29/29**, 10 **29/29**, 12 **15/15** |
| Full-stack checks on real local Postgres | Stage 8 **9/9**, Stage 9 (real SMTP server) **8/8**, Stage 11 (real push service) **8/8**, Stage 12 end-to-end chain **9/9** |
| SQL assertion runners | recipient links (43), email suppressions (21), report + push (40+); the last run three times |
| Mutation checks | every stage; all caught (weak tests found by mutations were strengthened) |

Defects the final validation itself found and fixed: a Stage 6 test with a literal BOM (lint), and the browser-check harness missing `react-dom/server` (page error `require is not defined` in five checks).

## What exists now
Visual editing, website backgrounds, MediaPipe presenter, browser audio mix, video effects and motion, captions and scene detection, thumbnails and GIFs (new codec, independently decoded), personal links with server-issued tokens, React Email outreach with unsubscribe and suppression, bulk CSV batches with resumable browser jobs and an outreach-sequence plan, owner-checked results report with PDF and opt-in push, autosave/recovery and backups. All in the shared Remotion composition and the existing Supabase/Netlify stack; no new database, renderer, player, queue or always-on server.

## What is NOT proven (read this)
* **No real email was sent and no real browser received a push.** Both are proven only against local stand-ins (a real SMTP server and a push service that decrypts with an independent library). Inbox placement, SPF/DKIM/DMARC, Outlook/Gmail rendering and real push delivery need your provider, DNS and VAPID keys.
* **Three migrations are NOT applied** to any Supabase project: `20261115000000_recipient_links.sql`, `20261116000000_email_suppressions.sql`, `20261117000000_analytics_report_push.sql` (plus the earlier layouts migration). Until they are, the related routes answer with an error and the panels say so.
* **Per-recipient published video is not built:** a published video here is a timeline snapshot, not a rendered MP4. Batches produce per-recipient files and personal links to one published video; serving a rendered file per recipient needs a storage decision.
* **Nothing runs on a schedule:** no always-on server. Batches run in an open tab; the outreach sequence is a plan; list sending (`mode: 'send'`) is 501.
* 1080p/long-video export time and memory were not measured; the audio mix is limited to 10 minutes from measurement.
* The PDF uses standard fonts (non-Latin scripts show "?", and the file says so). Safari/Firefox were not tested for OPFS, Web Locks, BroadcastChannel or push.

## Follow-up phase (decisions you made, 2026-11-14)
Production was not touched. Nothing was sent. No secret is in the repository or the frontend.

**Applied where**
* Supabase **branch** `smartvideo-stage-validation` (project ref `gahymlskmvhfeprcwgaw`, child of `bzxohkrxcwodllketcpz`) only. Auto-replay of main's history ends `MIGRATIONS_FAILED` (as with every earlier branch), so the chain was applied by hand: rate limiter, published videos/events/timeline projects, publish hardening/slugs, video analytics, a **subset** of the retargeting migration (tables, helpers, `_notify`, the event trigger; not interest scoring or scheduled jobs), then layouts, recipient links, email suppressions, analytics report/push and `20261118000000_recipient_videos.sql`. The branch is therefore not an exact copy of main. Nothing was merged or applied to main.
* Security advisors on the branch: none of our RPCs or tables is flagged except the generic `auth_allow_anonymous_sign_ins` lint, which also fires on tables that have policies `to authenticated` (it looks like a project setting, not a gap in our policies; not confirmed). Earlier, our policies had no role clause; they are now `to authenticated`. Pre-existing findings that are not ours and were left alone: `rate_limit_*` functions, slug RPCs, policies on `brand_*`, thumbnails, `timeline_projects`, `retarget_*`, `owner_notifications`, and `video_slug_redirects` with RLS on but no policy.
* The private bucket was confirmed private, with no browser-role policies; table and RPC access is locked for `anon` and `authenticated`.

**Email: Kit.** Kit broadcasts made through its tools are always drafts and only the account owner sends them, so there is no send adapter. The outreach package now includes `kit-import.csv` (email, name, `smartvideo_link`, `smartvideo_gif`, suppressed addresses removed) and an HTML body that uses Kit's Liquid tags and Kit's own unsubscribe link. To use it: create the two custom fields in Kit, import the CSV, paste the HTML into a broadcast, and send from Kit yourself. The Liquid tag names were not tested inside Kit.

**Push.** VAPID keys were generated. Public key: `BC7rUjcBTkZmGe6NDgn5JqmCA1-GbOUsQuzdEqEX9NesrjJu3QhNU4hng5krf6z0LNXWXL3dOZsETPOUdSaqtkw`. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (a real `mailto:` address) in Netlify yourself. The private key exists only in this session's scratchpad file; treat it as exposed to this session and rotate it (`node scripts/make-vapid-keys.mjs`) if you prefer. Real delivery to a real browser is still untested.

**Private per-recipient video.** Migration `20261118000000_recipient_videos.sql` (private `recipient-videos` bucket, `recipient_videos` table, five service-role RPCs), `netlify/functions/_storage/signedUrls.js`, the owner route `/api/personalization/recipient-videos` (signed upload URL, register, remove) and the public token-gated `/api/recipient-video` (1-hour signed download URL, only for a live link whose token hash and video match). The watch page plays the personal video only from an https URL. Bulk panel has "Upload videos privately". Tests: 20 SQL assertions, function/route/client/watch-page tests, 13 mutations caught. **Not verified:** the real Supabase Storage REST calls (needs the branch's service-role key, which this session did not have). Set `SUPABASE_URL`/service role in Netlify only after the migration is applied where you want it.

**Gates on the final tree:** full vitest 11,710 passed (61 skipped), eslint clean on changed files, `typecheck:personalization` 0 errors in scope (98 pre-existing out of scope), `vite build` passes (needs `--max-old-space-size=7168`), all SQL assertion runners pass.

## Remaining items (2026-11-15)
* **Retention (your choice: 90 days).** `20261119000000_recipient_videos_retention.sql`: a private video stops being served 90 days after upload, and `recipient_videos_purge_expired` deletes expired rows. The daily scheduled function `netlify/functions/recipient-video-purge.js` then deletes the stored files (a file that cannot be deleted is logged and left; it is private and nothing can sign it). Re-uploading starts a new 90 days. Applied to the validation branch only. Tests: SQL assertions (including a 45-day-old row that must survive), 6 purge tests, 5 mutations caught. It runs on Netlify's schedule (not an always-on server) and only once deployed with `SUPABASE_URL` and the service-role key set.
* **Kit fields created** in your Kit account: `smartvideo_link` (id 1432595) and `smartvideo_gif` (id 1432596). Nothing else in Kit was touched; nothing was sent. The Liquid tags still need a test import in Kit.
* **Validation branch kept**, as you chose, until production is done. Production migrations are **not applied**, as you chose.
* **Security finding on production (read-only check, nothing changed).** 117 of 314 tables in `public` have row-level security OFF, and `anon` and `authenticated` hold SELECT and INSERT/UPDATE/DELETE on all of them, including `api_keys`, `user_api_keys`, `subscriptions`, `user_credits`, `credit_transactions`, `payouts`, `partners`, `access_tokens`, `sessions`, `user`, `audit_log`. None are SmartVideo tables. Recommended: check which live apps use them with the anon key, then try an RLS-enabling migration on a branch. Not done: it could break running apps and needs your decision.
* **Still yours to do:** set the three VAPID variables in Netlify and test push on a real device; sending-domain DNS; the real Storage upload test needs a service-role key for the branch.

## RLS fix for the exposed production tables (2026-11-15): written and tested, NOT on production
`supabase/migrations/20261120000000_enable_rls_on_exposed_tables.sql` finds every ordinary `public` table without RLS (not partitions, not extension-owned), enables RLS, and removes INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER from `anon` and `authenticated`. SELECT stays granted, so an app that polls a table gets an empty result instead of an error. One exception keeps the live write path: `admin_analytics_events` accepts INSERT only from anon/authenticated (no read, update or delete). `service_role` bypasses RLS, so server-side code is unaffected. It is idempotent.
* **Tested:** 15 SQL assertions on a throwaway local Postgres (`supabase/tests/run-enable-rls-assertions.sh`), 5 mutations caught, and the same behaviour confirmed on the real Supabase validation branch using two stand-in tables with production-style open grants (anon read 0 rows, insert/delete denied 42501, analytics insert allowed but not readable or updatable, service role sees all). The stand-ins were removed afterwards.
* **Not proven:** the branch does not contain the real 117 tables (they exist only on production), so the effect on the real tables and on the other apps that use this database is untested. Those apps (admin dashboards and others) read tables such as `user_credits`, `failed_logins`, `api_keys` and write `admin_analytics_events`; a client that writes to any other of the 117 tables with the public key would now fail. Production still has the exposure until you approve applying it.
* Roll back: `alter table ... disable row level security` and re-GRANT.

## Decisions still waiting for you
1. Apply the RLS migration to production? Safer first: tell me which apps use this database, or apply it in a quiet window and watch for errors.
2. Apply the SmartVideo migrations (now 6) to production when ready; delete the validation branch afterwards.
3. Recorder status and the private capture bucket (unchanged).
4. The queued "Personalization Studio" prompt remains unstarted.
