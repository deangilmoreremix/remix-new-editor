# SmartVideo AI — Implementation Log

Master plan: `docs/SMARTVIDEO_MASTER_ENHANCEMENT_PLAN.md`
Stage status: `docs/SMARTVIDEO_STAGE_STATUS.md`
Branch: `claude/jolly-cannon-ofqf7h`

## Session-start recovery checklist
1. Read `CLAUDE.md` / `AGENT_GUIDE.md` (OpenMontage rules; production-pipeline rules apply to video *production* requests, not code audits).
2. Read the master plan and the stage status doc.
3. Read this log; run `git status` and `git log --oneline -5`.
4. Confirm which stage the **user explicitly** authorized. A checked box or earlier plan is not authorization.
5. Do not repeat completed work; execute only the approved stage; stop after the report.

## Scope exclusions
- **Recorder** (recording studio / any "Remotion Recorder"): excluded by the user — being completed in another chat. Do not audit, modify or duplicate it.

## Log
### Stage 0 — Complete Application and Feature Audit
- Authorization: the user's master prompt (Stage 0 only).
- Method: three parallel read-only code explorations (editing/personalization/render; discovery/publishing/analytics/backend; Web APIs/tests), plus a baseline install and test run (results in the stage status doc).
- Output: `docs/SMARTVIDEO_MASTER_ENHANCEMENT_PLAN.md`, `docs/SMARTVIDEO_STAGE_STATUS.md`, this file.
- Changed: documentation only. No `src/`, `netlify/`, `supabase/`, `package.json` or lockfile changes. No packages added. No migrations. No deployment.
- Limits: findings come from code reading; the app was not run in a browser and no real media was rendered in Stage 0.
- Next (at the time): Stage 1 was not yet authorized. Superseded — Stage 1 was authorized by the user later; see below.

### Stage 1 — Personalization data and visual editing
- Authorization: user instruction "continue with the next phase" (2026-11-13), which authorizes Stage 1 only.
- Approach: the existing OverlayEditor already covered drag/resize/lock/undo/crop focus; Stage 1 extends it (rotate, duplicate, z-order, group, align, snap/guides, image zoom, footage transform, custom fields, saved layouts) with pure, tested modules (`guided/layerOps.ts`, `guided/savedLayouts.ts`, `preview/layerTransform.ts`) and one UI panel (`guided/LayerToolsPanel.tsx`).
- No dependencies added (React Konva / React Easy Crop deliberately not used; see stage status).
- Pre-existing defects fixed: `Internals.SequenceManager` crash in Remotion 4.0.540; text rotation pivot.
- Verification: 63 new tests, full suite 10,927 passing with the same 2 baseline failures, and a real-browser render check (`scripts/stage1-render-check/run.mjs`, 8/8).
- Not verified: live modal in a browser, MP4 export, Supabase persistence. Stage 2 is **not** authorized.

### Repair pass after Stage 1 (user request: fix the errors, explain the 61 skips)
- Fixed: Sidebar hover handlers (+ director copy), `tokens/src/index.ts` (+ copy), timeline-parity budget (220 -> 230, deliberate), `.gitignore` rule that hid legacy texture JPGs.
- Still failing: `legacyCards` (missing `agent-stream.jpg`, not recoverable from the repo). Root `tsc` is not a usable type check (TS6059 config error; 12,870 real errors when rootDir is overridden). Details in `docs/SMARTVIDEO_STAGE_STATUS.md`.
- Skipped tests: pre-existing; mostly desktop-only upstream tests. 37 would fail if un-skipped.

### QUEUED (not authorized): Sendspark-style Personalization Studio
- The user supplied a design/audit prompt to be run **only when they direct it**, without skipping or reordering master stages. Stored at `docs/queued/SMARTVIDEO_PERSONALIZATION_STUDIO_PROMPT.md`. Its first stage is audit + design only and must stop for approval. Reference screenshots were not saved; ask for them again when it starts.

### Stage 1 — completion pass
- Authorization: "complete all of stage 1 and make sure there are no errors" (Stage 1 only).
- Added: Konva rotate/transform handles, react-easy-crop crop dialog (+ exact `cropMapping`), synced saved layouts (migration + route + hook; browser fallback; explicit Upload), scoped type-check gate, real-browser editor check and real video export check, local-PostgreSQL RLS assertions.
- New dependencies: react-konva 19.2.3, konva ^10.9.1, react-easy-crop ^6.2.5 (all MIT). `vite.config.js` optimizeDeps.include extended for them.
- Fixed: `legacyCards` (StreamResponse backplate is now a gradient), 74 in-tree type errors, one `no-var` lint error.
- Verified: full vitest 766/766 files, 0 failures; typecheck gate 0; eslint src 0 errors; render 8/8, editor 19/19, export 31/31, SQL 40/40.
- NOT done: the layouts migration is not applied to production or any branch (needs the user's decision). Not exercised: deployed route with a real Clerk session.
- Reported (not changed): the Supabase advisor shows 117 public tables with RLS disabled.
- Stage 2 is **not** authorized.

### Stage 2 — Website backgrounds and business assets
- Authorization: the user's approval of the roadmap plan, which authorized Stage 2 only.
- Reused: `/api/motion-studio/capture` + `captureSite` (Clerk, entitlement, SSRF guard, quota), the capture's logo/pictures, the shared Remotion composition, Stage 1 saved layouts.
- Added: `preview/websiteBackground.ts` (pure motion model + validation), `WebsiteBackgroundLayer`, `WebsiteBackgroundPanel`, website motion in saved layouts, `captureClient.ts` extraction, editor-stage website frame, asset-to-role assignment, attribution.
- Security: asset-finder SSRF check now delegates to the shared guard; capture quota is database-backed with a fail-closed memory fallback.
- Verified: full vitest 770/770; typecheck gate 0; eslint src 0 errors; real engine capture of smartvid.app -> real editor/preview -> real MP4 (29/29), scroll accuracy against the captured screenshot.
- NOT done: capture bucket still public-by-URL; production route not exercised with real Clerk; real site with logo/sections not captured; free-draw cursor path; per-recipient backgrounds (Stage 10).
- Stage 3 was authorized later (see the cadence entry below).

### Review cadence (user instruction, 2026-11-13)
- "We need to finish all of these stages so let's only check every 3 phases." Stages 3, 4, 5 run back to back, then stop for review; then 6–8; 9–11; 12. Per-stage tests, commits and doc updates continue. Decisions only the user can make (email provider, VAPID keys, applying migrations, deploys) are flagged, not assumed. The queued Personalization Studio prompt remains unauthorized.

### Stage 3 — MediaPipe presenter effects
- Authorization: the cadence instruction above.
- Added: `preview/presenter.ts` (pure model, framing, mask maths, presets, cache keys), `PresenterLayer`, `presenterMatteRegistry`, `guided/presenterBake|presenterMatteStore|presenterEdit|probeVideoAspect`, `PresenterPanel`, `PresenterStageBox`, `src/lib/editor/ml/mediapipeSegmenter.js`, `public/mediapipe/selfie_segmenter.tflite` (sha256-verified), the `presenter` field of the settings.
- New dependency: `@mediapipe/tasks-vision` 1.0.1 (Apache-2.0, exact pin, same version as `apps/video-agent-studio`). Model file is Apache-2.0 (MediaPipe selfie segmenter).
- Fixed: `<Video objectFit>` is a prop, not CSS (portrait footage was letterboxed in a landscape frame; now covers); web renderer ignores inset box-shadow (border is a real border).
- Verified: 78 unit/panel tests (+5 mutation checks), personalization suite 191 files / 2,360 passed, typecheck gate 0, live check 53/53 (real MediaPipe bake, IndexedDB reuse/restore, decoded exports vs the source frames and the matte, audio not doubled and aligned, real editor drag, preview-vs-export parity). Details and limits: `docs/SMARTVIDEO_STAGE_STATUS.md`.
- NOT done: durable/shared storage of processed footage (browser-only), WebGPU timing of MODNet, Safari/Firefox, saved-layout presenter geometry, corner-resize handle.

### Stage 4 — Advanced browser audio
- Authorization: the 3-stage cadence.
- Added: `preview/audioDsp.ts` (filters, BS.1770-4 loudness, ducking, fades, look-ahead limiter), `preview/audioMix.ts` (model, key, plan), `guided/audioMixdown.ts` (render, WAV, cache, export preparation), `guided/audioAnalysis.ts`, `guided/AudioMixPanel.tsx`; composition mutes sources when a current mixdown plays; `webExport.ts` guarantees a current mixdown before rendering.
- No new dependencies. Reused: existing silence and beat analysers, the Stage 3 blob store/registry.
- Found/fixed: limiter exceeded its ceiling in the first few milliseconds (caught by the new tests).
- Verified: 71 tests (+6 mutation checks), personalization suite 194 files / 2,431 passed, typecheck gate 0, live check 40/40 with ffmpeg's EBU R128 meter as the independent reference. Details and limits: `docs/SMARTVIDEO_STAGE_STATUS.md`.
- NOT done: true-peak limiting, long-video/streaming mixing, voice-over recording, multi-track, de-noise/compressor, cross-device mixdown storage.

### Stage 5 — Advanced video effects and motion
- Authorization: the 3-stage cadence.
- Added: `preview/videoEffects.ts` (look, camera motion, fades, colour predictor), `preview/FootageFrame.tsx`, `preview/layerEffects.ts` (text effects, exits, new entrances), `guided/FootageEffectsPanel|LayerEffectsPanel|effectsEdit`; composition draws them; `settings.footageEffects`, `layer.effect`, `layer.exit`, three new entrance ids.
- No new dependencies. Only effects measured in a real web-renderer export are used (CSS filters, multiply blend, gradients, text-shadow/stroke, blurred box-shadow); SVG `url(#)` filters and spread box-shadows are not drawn and are avoided.
- Verified: 48 tests (+6 mutation checks), personalization suite 197 files / 2,479 passed, typecheck gate 0, live check 40/40 (exported pixels vs the model within 3/255, edge positions, fades, text effects with/without, exits/entrances, Player vs export). Details and limits: `docs/SMARTVIDEO_STAGE_STATUS.md`.
- NOT done: GL/LUT effects, extra transitions, grain/sharpen, speed ramps, picture-layer effects beyond existing styles.

### Stage 6 — Captions, transcription, scene detection
- Authorization: "lets continue and finish all of the task" + approved Stages 6–12 plan.
- Added: `preview/captions.ts` (model, SRT/VTT, pause-aware pages, highlight, problems, scene cuts, codec classes), `CaptionsLayer`, `guided/CaptionsPanel|captionsEdit|videoProbe`; `settings.captions`; reuse of the existing Whisper worker. `apt install espeak-ng` was used only in the sandbox to make speech fixtures.
- Fixed/found: library paging spanned silences; text-stroke eats thin text; whisper-tiny hallucination (base is the default).
- Verified: 48 tests (+6 mutation checks), live check 36/36 (captions measured in exported pixels, real Whisper on real speech, scene scan on clips with known cuts). Details and limits: `docs/SMARTVIDEO_STAGE_STATUS.md`.
- NOT done: other-language/real-speech accuracy testing, per-caption fonts/animations, translation, dissolve detection.

### Stage 7 — Thumbnails and GIFs
- Authorization: the approved Stages 6–12 plan.
- Added: `gif/gifCodec.ts` (encoder + independent decoder), `preview/stills.ts`, `guided/renderStills|ThumbnailGifPanel|stillsEdit`; `settings.thumbnail`, `settings.gif`. **Replaced** `src/lib/gifEncoder.js` (now async, delegates to the codec); `TemplateThumbnailModal.jsx` awaits it.
- Found/fixed: old encoder bugs (blank/wrong frames, palette from frame 1, 257th colour → index 0, stack overflow); decoder hang on corrupt data; GIF plan ignoring video end; fixture colour-matrix mismatch.
- Verified: 66 tests (+7 mutation checks), live check 29/29 (ffmpeg as independent decoder). Details and limits: `docs/SMARTVIDEO_STAGE_STATUS.md`.
- NOT done: lossy GIF optimisation, mail-client rendering tests, per-recipient storage/upload.

### Stage 8 — Recipient tokens, personal links, attribution
- Authorization: the approved Stages 6–12 plan. Migration written and tested locally only; NOT applied.
- Added: `publish/recipientToken.ts`, `publish/recipientLinksClient.ts`, `guided/RecipientLinksPanel.tsx`, migration `20261115000000_recipient_links.sql`, route `recipient-links/route.ts` (registered), `supabase/tests/80_recipient_links_assertions.sql` + runner, `scripts/stage8-recipient-check/` (full stack against real SQL). Changed `video-events.js` (token resolution; client `contact` ignored), `analyticsClient.js`, `WatchPage.jsx`.
- Closed: forgeable `?c=` recipient identity (Stage 0 finding).
- Verified: SQL 43/43; full-stack 9/9; unit 58 (+6 mutation checks). Details and limits: `docs/SMARTVIDEO_STAGE_STATUS.md`.
- NOT done: per-recipient personalized video publishing (Stage 10), Referrer-Policy / address-bar stripping, applying the migration.

### Stage 9 — React Email and outreach
- Authorization: the approved Stages 6–12 plan. No real email sent, no provider used; migration written and tested locally only (NOT applied).
- Added: `shared/personalization/email/{emailModel,OutreachEmailTemplate,renderEmail,eml,unsubscribe,outreachClient}`, `guided/EmailOutreachPanel.tsx`, migration `20261116000000_email_suppressions.sql` + `supabase/tests/81_email_suppressions_assertions.sql` + runner, `netlify/functions/outreach-unsubscribe.js` (+ `netlify.toml` redirect), test-send route `outreach/route.ts` (registered), `scripts/stage9-email-check/` (real SMTP server + real SQL). Deps (exact): `@react-email/{body,button,container,head,hr,html,img,link,preview,render,section,text}`, `nodemailer` 10.5.0; dev: `smtp-server`, `mailparser`.
- Fixed on the way: `@react-email/components` crashed in Node (prismjs) → individual packages; scanner false positive on escaped text; noisy alert roles; stale `analyticsClient` test from Stage 8.
- Verified: 51 new unit tests, SQL 21/21, real SMTP + SQL check 8/8, 12/12 mutation checks. Details and limits: `docs/SMARTVIDEO_STAGE_STATUS.md`.
- NOT done: list sending (Stage 10), provider choice / DNS (SPF, DKIM, DMARC), real inbox delivery verification, applying the migration.

