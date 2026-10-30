# Execution Plan — Upload Repair Completion + Production Release

Branch: `fix/upload-repair` · worktree `.kilo/worktrees/upload-functionality` · PR #30
Authorizing user instruction: complete upload repair, resolve verified failures, release to production.
Constraints: no force-push/reset; protected files untouched; retention dry-run only; no new credit/subscription features; GitHub Actions NOT a release requirement (local verification is); never publish an unverified build.

## Verified state at plan time (audited)

- **Phase 1 root cause (PROVEN):** `playwright-matrix.config.ts` had `reuseExistingServer: true`. A long-lived Vite server served pre-`fe1fbd1ce` source (zero `window.alert` in served `LipSyncStudio.js`), so all 6 credit-error (402) e2e tests ran against code without the gating. Instrumented browser probe (`e2e/zz-diagnostic.spec.js`) proved: proxy mock hit → `RES 402` delivered → **no dialog, no toast, no rejection** in the served build. With a killed server + fresh boot: **13/14 upload-matrix PASS.**
- Fixed (uncommitted): `reuseExistingServer: false` (with rationale comment); `page.goto` now `waitUntil:'domcontentloaded', timeout:120_000` in both upload-matrix tests (image-picker 200 previously died on a 60s `load` timeout during cold compile).
- **image-picker transport (PROVEN from source):** ImageStudio's `createUploadPicker` uses default `muapiStudio:false` → Supabase Storage (`uploadService.uploadFileToStorage`), NOT the MuAPI proxy. The 402-credit contract is a MuAPI concept and cannot apply to this picker; the spec currently asserts the wrong transport for it.
- **Phase 2 fixtures (DONE, uncommitted):** `scripts/generate-e2e-fixtures.py` generated real assets replacing stubs — `start-image.png` 320×240 RGB (3,333 B, 317 colors; was 1×1/69 B), `sample-video.mp4` real H.264 (256,670 B, 14,250 B mdat; was 44 B empty shell; encoded by `avconvert` from repo-own `background-tech-data-flow.mp4`), `sample-audio.wav` real PCM (44,144 B; 57-B ID3 stub `sample-audio.mp3` deleted; `audio/wav`+`wav` both allow-listed in `uploadLimits.js`; `upload-picker.spec.js` updated).
- **Known-good rollback deploy:** `6ad38a977484340b3a517869` (ready, commit `078d97744`, PR #29 build). Current live prod: `6ad668c2b26cf1b391713074` (my earlier deploy of the unmerged branch — to be replaced by a verified main build).
- **Deploy mechanics (proven):** release works via `NETLIFY_SITE_ID=ec2fbb0c-c375-4554-898c-194485c2621d npx netlify deploy --prod --dir dist` run from `packages/ai-timeline-editor` (linked project dir; avoids interactive picker crash).
- **Credential reality:** local `.env.local` has VITE_SUPABASE_URL/ANON_KEY, VITE_MUAPI_KEY/URL, CLERK keys. `SUPABASE_JWT_SECRET` unconfirmed in prod (CLI displays only 9 of 22 keys; `getEnvVar` API scope-denied per-var). PR #29's fail-closed design means permanent-asset saves need the verified-identity token path; if the secret/function is absent, durable-save integrations are UNVERIFIABLE — report, don't fake.
- **Pre-existing (NOT regressions, do not fix per scope):** `VideoToolsStudio` mount `ReferenceError: renderProviderLogoImg is not defined` exists identically on `origin/main` (branch diff for that file is empty); `tests/integration/muapi-upload*.test.mjs` fail under vitest with `process.exit(0)` (standalone scripts, pre-existing).

## Tasks (sequential — never parallel implementers)

### Task R1 — Phase 1+2 completion: 14/14 upload-matrix + real-fixture rollout
Owner: implementer subagent. Acceptance: 14/14 upload-matrix; 13/13 image-upload-matrix; upload-picker audio suite green with `sample-audio.wav`; fixtures real; no diagnostic leftovers; all committed.
Details:
1. Delete `e2e/zz-diagnostic.spec.js` (temporary probe).
2. Determine the `image-picker` 200/402 expectations: it is a Supabase-Storage picker. Keep the 200 test asserting the storage path receives the file (mock `**/storage/v1/**` or assert no-proxy + success state, per what the component actually does — verify via dev-server DOM/network first); for 402, a MuAPI-credit alert is inapplicable — assert the picker's real failure surface instead (e.g., mock storage 4xx → user-visible error text). Do NOT weaken the 6 MuAPI pickers' credit assertions; do NOT modify ImageStudio production behavior (switching it to MuAPI would break keyless users — documented decision).
3. Add generated boundary fixtures to `.gitignore` (`boundary-video-*.mp4`, `boundary-image-*.jpg/png`, `corrupt-metadata.png`, `boundary-image-small.png` — all produced by `upload-boundary.spec.js` `beforeAll`); remove the untracked copies.
4. Verify in-browser (Playwright evaluate) that `sample-video.mp4` reports real `videoWidth/videoHeight/duration` and `start-image.png` renders non-uniform pixels; record the numbers.
5. Run, from worktree root, fresh-server: `upload-matrix.spec.js`, `image-upload-matrix.spec.js`, `upload-picker.spec.js` (+ `upload-boundary.spec.js` report-only). Report exact pass/fail/skip counts.

### Task R2 — Phase 3: studio upload validation (previously uncovered paths)
Owner: implementer subagent. Acceptance: mock-based e2e coverage + a real-integration probe with honest limitation reporting; protected files untouched.
Details:
1. Extend mock-based e2e (new spec, `e2e/studio-upload-coverage.spec.js`) for: StoryboardStudio (`/#/storyboard`), Personalizer, AICaptionsModal surface, element-image-upload surface (Element Library), ChatStudio attachments, TimelineEditorPage upload control. Arm the same proxy mock; assert picker mounts, file selection works, and 200/402 messaging surfaces. These must NOT edit any protected component; if a route requires auth, assert the auth gate renders rather than bypassing it.
2. Real-integration probe (`scripts/probe-real-upload-integration.mjs`, node): with `.env.local` creds, (a) real Supabase Storage upload to `uploads` bucket via `uploadFileToStorage` path, (b) real MuAPI `POST api.muapi.ai/api/v1/upload_file` with `VITE_MUAPI_KEY`, (c) real durable `saveAsset` row. Report each VERIFIED / BLOCKED with the exact blocker (e.g., SECURE_SESSION_UNAVAILABLE / ASSET_SIGN_IN_REQUIRED / invalid key). Never present mock results as real.
3. Record per-studio status table (mock + real where possible).

### Task R3 — Phase 4: local regression gate
Owner: implementer subagent. Acceptance: written results table; upload-related failures fixed; no unrelated scope creep.
Details: full `npx vitest run` (JSON reporter to a file); rerun the two `checkouts` of pre-existing failures on `origin/main` via a scratch worktree if needed to classify; fix ONLY upload-related regressions introduced by the branch; guard/retention suites must stay green; production build must succeed.

### Task R4 — Final whole-branch review (SDD gate)
Owner: code-review subagent on most capable model; review package from `git merge-base origin/main HEAD`.

### Task R5 — Phase 5: release to production
Owner: controller (high-stakes, sequential).
Details: commit remaining work on `fix/upload-repair`; verify PR #30 mergeable; merge PR #30; `git checkout main && git pull`; build exact merged commit; `NETLIFY_SITE_ID=… npx netlify deploy --prod --dir dist --message …` from `packages/ai-timeline-editor`; confirm deploy commit/ID; authenticated production smoke tests (if Clerk test credentials exist) + anonymous smoke; verify studios + representative image/video/audio uploads; document deployment ID, commit SHA, rollback = `6ad38a977484340b3a517869`. If publishing-locked: prepare everything, report the exact promotion step. If smoke fails: roll back to the known-good deploy and report.

## Global constraints for every task
- Protected (never modify): `src/components/TimelineEditorPage.jsx`, `src/components/elements/element-image-upload.jsx`, `src/components/modals/AICaptionsModal.jsx`.
- MuAPI `/upload_file` primary for temp AI inputs; Supabase durable; retention dry-run only; BYOK/Clerk/Supabase preserved; no new billing features.
- Exact test counts in every report; no success claims without command output.
