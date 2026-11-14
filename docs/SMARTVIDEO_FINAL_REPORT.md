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

## Decisions waiting for you
1. Apply the migrations (ideally to a Supabase branch first)?
2. Which email provider/SMTP, and the sending domain's DNS?
3. VAPID keys (`node scripts/make-vapid-keys.mjs`) and a real device test?
4. Where per-recipient rendered videos should live (storage, access, retention)?
5. Recorder status, the private capture bucket, and the 117 RLS-disabled tables (unchanged, still open).
6. The queued "Personalization Studio" prompt remains unstarted.
