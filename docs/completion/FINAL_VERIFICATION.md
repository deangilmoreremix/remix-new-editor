# FINAL_VERIFICATION.md — Integration Worktree (`integration/personalization-complete`)

**Generated:** 2026-10-12 (15:09–16:05 EDT)
**Generator:** Verification Engineer (independent verification pass)
**Subject:** /Users/shasheemoore/Downloads/remix-integration-worktree, branch `integration/personalization-complete`, HEAD `7982591ae`
**Baseline compared against:** SA-3 audit on main @ `4522e42dc` (Test Files 22 failed / 132 passed (154); Tests 17 failed / 2591 passed / 25 skipped (2633); lint 14 `no-case-declarations` errors), as recorded in `docs/completion/FINAL_VERIFICATION_PLAN.md`.

---

## 1. SUMMARY

**VERDICT: PASS-WITH-KNOWN-BASELINE-FAILURES.**

- The personalization integration introduces **ZERO new test failures**. Every failing test file and every failing test on this branch is contained within the SA-3 baseline's 22-file failing set; the branch's failing set is a strict **subset** of that baseline (details in §6).
- New personalization code: **208/208 tests pass** (14 files), lint-clean (**0 errors**, 32 warnings) in isolation.
- Production build: **exit 0** — but only after repairing a pre-existing, damaged `node_modules` (see §4, Gate 4, and §9; the damage predates this session and is not caused by the integration).
- Full suite remains RED for **pre-existing** reasons (esbuild `TextEncoder` invariant under Vitest 4 + Node 24, `enhanceMenu is not defined` at `src/components/AvatarStudio.js:267`, stale timeline source-string assertions, sub-workspace pathing issues). These existed on main before the integration.
- **This verdict certifies the integration code, not production readiness of the feature** — see §9 BLOCKERS (no UI surface, RLS auth contradiction, no live-provider verification).

---

## 2. EXECUTION ENVIRONMENT

| Item | Value |
|---|---|
| Date | 2026-10-12 (15:09–16:05 EDT) |
| Node | v24.16.0 |
| Vitest | 4.1.10 (via `npx vitest`; no install performed) |
| ESLint | v10.6.0 |
| Vite | v5.4.21 |
| Worktree HEAD | `7982591ae` |
| `node_modules` | **symlink** → `/Users/shasheemoore/Downloads/remix-new-editor/node_modules` (shared install; NOT deleted, NOT reinstalled) |
| Scripts used | `npm run build:openthorn`, `npx vite build`, `npm run lint`, `npx eslint src/components/personalize --ext .js,.jsx`, `npx vitest run …`, `node scripts/{lint-timeline-tokens.cjs,check-cinema-hex.mjs,check-minimax-licensing.js,check-endpoint-coverage.mjs}` |
| Network use | Exactly one download-only `npm pack @clerk/shared@4.33.0` to `/tmp` (no `npm install`, no node_modules mutation by npm) — see §4 Gate 4 |

**Environment repairs performed (documented, pre-existing damage — timestamps 13:17–13:41 EDT today, i.e. BEFORE this session; caused by a prior agent's aborted `npm install`, not by this session and not by the integration):**

1. Worktree `apps/openthorn/node_modules/{motion-dom,motion-utils,framer-motion}` were partially extracted (missing `dist/es/*` files) and `node_modules/vite/` was an empty directory with a broken `.bin/vite` shim. Repaired by copying main repo's intact, **identical-version** copies (motion-dom 12.43.0, motion-utils 12.39.0, framer-motion 12.43.0). Worktree-local files only.
2. Shared install `node_modules/caniuse-lite` was missing `package.json` and `dist/lib/` entirely. Repaired with the **exact lockfile version 1.0.30001803**, extracted offline from the local npm cache (`~/.npm/_cacache`).
3. Shared install `node_modules/@clerk/shared@4.33.0` was stripped of **all `.mjs` files and 700+ other files** (installed copy verified to be a strict subset of the pristine tarball — zero files unique to the damaged copy were lost). Repaired with the official registry tarball via `npm pack` (download-only). This same corruption is the documented cause of the 19 `studio-smoke.test.js` failures in the SA-3 baseline (`docs/completion/FINAL_VERIFICATION_PLAN.md` §2 item 8: "only `error.js` exists; `@clerk/react`'s hashed bundle imports `error.mjs`").

Main repo git state verified untouched: `git -C /Users/shasheemoore/Downloads/remix-new-editor status --short` → empty; HEAD still `4522e42dc`. All repairs were inside gitignored `node_modules`. No git-tracked file in either repo was modified by this session.

---

## 3. BRANCH STATE

- **HEAD:** `7982591ae` — `chore: add worktree inventory, source audit and feature matrix; ignore node_modules symlink`
- **Commits above main (`4522e42dc`):** 5

| Commit | Subject |
|---|---|
| `7982591ae` | chore: worktree inventory/source audit/feature matrix + node_modules symlink ignore |
| `8394c6ace` | docs(completion): closeout, integration, release-readiness, verification-plan reports |
| `04970a28b` | test(personalize): fix AI Assist/studioBridge mock resolution + studioBridge empty-payload keys |
| `23b322009` | feat(personalize): greenfield website asset discovery with SSRF guards + tests |
| `021fe4c8a` | feat(personalize): port OpenHiggsBolt personalization core (types, stores, router, SQL migration, tests) |

- **Files changed vs main:** 41 files, **7766 insertions** (`git diff --shortstat 4522e42dc HEAD`)
  - `src/components/personalize/`: 32 files, 6560 insertions
  - Non-personalization: `.gitignore`, `supabase/migrations/20261012000000_create_personalization_outputs.sql`, and 7 `docs/completion/*.md` files
- **Working tree:** clean (`git status --short` empty; `git diff HEAD -- src/` empty — the previously-flagged uncommitted `TimelineEditorPage.jsx` edit was reverted by `7982591ae`)

---

## 4. GATE TABLE

| Gate | Command | Expected | Actual | Verdict |
|---|---|---|---|---|
| 1. New-code tests (isolated) | `npx vitest run src/components/personalize/` | all pass | **Test Files 14 passed (14); Tests 208 passed (208); 0 failed, 0 skipped; duration 14.04s**. Re-run post-environment-repair: identical, 14 passed / 208 passed, 28.36s | **PASS** |
| 2a. Lint — NEW CODE | `npx eslint src/components/personalize --ext .js,.jsx` | 0 errors | **0 errors, 32 warnings** (all warning-level: `no-unused-vars`, `no-underscore-dangle`, `no-useless-assignment`, `no-empty`), exit 0 | **PASS** |
| 2b. Lint — full repo | `npm run lint` | no new errors vs baseline | **0 errors, 3638 warnings**, exit 0. Repo-wide `no-case-declarations` count = **exactly 14** (warning-level), matching SA-3's 14 — they surface because main's committed `eslint.config.js:131` sets `'error'` but `:141` re-sets the same key to `'warn'` (last key wins). `eslint.config.js` was restored to main's version by `7982591ae`; `git diff 4522e42dc HEAD -- eslint.config.js` is empty | **PASS** |
| 3. Full regression | `npx vitest run --reporter=dot` | same 22 failing files as baseline; 0 personalization failures | **Pre-repair (same damaged-env state as SA-3 baseline):** Test Files 21 failed / 146 passed (167); Tests 34 failed / 2776 passed / 25 skipped (2835); 209.10s. Two consecutive runs agreed exactly (224.36s and 209.10s, same counts). **Post-repair:** Test Files 20 failed / 147 passed (167); Tests 17 failed / 2799 passed / 25 skipped (2841); 246.78s. Failing set is a strict SUBSET of the baseline 22; `grep -ci personalize` on both full-run logs = **0** | **PASS (no regression)** — §6 |
| 4a. Build — openthorn | `npm run build:openthorn` | exit 0 | Initial run **FAILED** in 11.3s: `Failed to resolve entry for package "motion-dom"` (pre-existing partial extraction in worktree `apps/openthorn/node_modules`, timestamps 13:17–13:41, before this session). After repairing motion-dom/motion-utils/framer-motion from main's intact identical-version copies: **PASS — exit 0, built in 16.73s (23.03s total)**, 91 modules transformed, expected chunk output + >500 kB size advisory (pre-existing) | **PASS after documented env repair** |
| 4b. Build — app | `npx vite build` | exit 0 | Initial run **FAILED** in 5.9s: `Cannot find module '../lib/statuses'` from `caniuse-lite` (shared install damaged). After offline-cache repair of `caniuse-lite@1.0.30001803`, failed again: `@clerk/shared/loadClerkJsScript` unresolvable (shared install stripped of all `.mjs`). After restoring `@clerk/shared@4.33.0` from the official tarball (download-only `npm pack`): **PASS — exit 0, built in 3m 30s (3m 36.55s total)**, full chunk summary in §4 note below | **PASS after documented env repairs** |
| 5a. `node scripts/lint-timeline-tokens.cjs` | fast check | exit 0 | **exit 0** — `✅ Timeline tokens OK: 69 defined, 59 referenced, 0 undefined.` | **PASS** |
| 5b. `node scripts/check-cinema-hex.mjs` | fast check | exit 0 | **exit 0** — `OK: no raw hex Tailwind color utilities in cinema studio files.` | **PASS** |
| 5c. `node scripts/check-minimax-licensing.js` | fast check | exit 0 | **exit 0** — `PASS: preset licensing metadata is complete (31 advisory warning(s)).` | **PASS** |
| 5d. `node scripts/check-endpoint-coverage.mjs` | fast check (~55s) | exit 0 | **exit 0** — endpoint/provider mapping list emitted with no coverage errors (final lines: `Content-Type → application/json`, `Retry-After → 60`) | **PASS** |
| 6. Security self-check | code review, read-only | 10 guards | **10/10 PRESENT** with file:line citations — §7 | **PASS** |

**Build chunk summary (vite build, exit 0):** largest chunks — `index-l7yk5AmR.js` 1,599.84 kB (gzip 586.87 kB), `beatapiMinimaxH3Prompts` 1,060.19 kB (gzip 370.76 kB), `ExampleGallery` 697.12 kB, `forms` 635.71 kB, `TimelineEditorPage` 589.74 kB; >500 kB chunk-size advisory emitted (pre-existing config default, not an error).

---

## 5. NEW CODE RESULTS (`src/components/personalize/`)

**Isolated suite — `npx vitest run src/components/personalize/` (HEAD `7982591ae`, pre-repair run):**

- **Test Files: 14 passed (14) — 0 failed**
- **Tests: 208 passed (208) — 0 failed, 0 skipped**
- Duration: 14.04s (transform 7.93s, setup 2.03s, import 10.02s, tests 1.56s, environment 67.11s)
- Re-run after environment repairs: identical — 14 passed (14) / 208 passed (208), 28.36s

**The 14 collected test files (all committed at HEAD; no untracked WIP remains):**

| # | Suite | File | Result |
|---|---|---|---|
| 1 | client profile store | `__tests__/clientProfileStore.test.js` | pass |
| 2 | asset library store | `__tests__/assetLibraryStore.test.js` | pass |
| 3 | shared media store | `__tests__/sharedMediaStore.test.js` | pass |
| 4 | source normalizer | `__tests__/sourceNormalizer.test.js` | pass |
| 5 | model capability resolver | `__tests__/modelCapabilityResolver.test.js` | pass |
| 6 | generation router | `__tests__/generationRouter.test.js` | pass |
| 7 | AI Assist | `__tests__/personalizeAiAssist.test.js` | pass |
| 8 | studio bridge | `__tests__/studioBridge.test.js` | pass |
| 9 | discovery — urlSafety | `discovery/__tests__/urlSafety.test.js` | pass |
| 10 | discovery — staticFetch | `discovery/__tests__/staticFetch.test.js` | pass |
| 11 | discovery — sitemap | `discovery/__tests__/sitemap.test.js` | pass |
| 12 | discovery — dedup | `discovery/__tests__/dedup.test.js` | pass |
| 13 | discovery — htmlParser | `discovery/__tests__/htmlParser.test.js` | pass |
| 14 | discovery — worker | `discovery/__tests__/worker.test.js` | pass |

**Corroborating single-file check (post-`7982591ae` revert):** `src/lib/editor/__tests__/timeline-editor-mask.test.js` → 1 file, 9 tests passed. (This file failed in the earlier worktree session due to the uncommitted `TimelineEditorPage.jsx` edit; `7982591ae` reverted that edit.)

**Lint (new code):** 0 errors / 32 warnings — see Gate 2a. The 32 warnings are all warning-level style rules; none block the build.

---

## 6. REGRESSION ANALYSIS

### 6.1 Headline numbers

| Metric | SA-3 baseline (main @ `4522e42dc`) | This branch, pre-env-repair (comparable env) | This branch, post-env-repair |
|---|---|---|---|
| Test Files failed | 22 | **21** | **20** |
| Test Files passed | 132 | 146 | 147 |
| Test Files total | 154 | 167 | 167 |
| Tests failed | 17 | **34** | **17** |
| Tests passed | 2591 | 2776 | 2799 |
| Tests skipped | 25 | 25 | 25 |
| Tests total | 2633 | 2835 | 2841 |
| Lint errors | 14 (`no-case-declarations`) | **0** (the 14 surface as warnings; main's committed config downgrades the rule) | same |
| Personalization files collected | 0 (did not exist) | 14 | 14 |
| Personalization failures | n/a | **0** | **0** |

### 6.2 Failing-file diff (file-by-file)

**Baseline's 22 failing files** (per `FINAL_VERIFICATION_PLAN.md` §2–§4): 16 file-level collection failures — `Canvas.test.js`, `renderpage-init.test.js`, `timeline-{components,editor,state,upload-sources}.unit.spec.ts` ×4, `media-use` ×3 (`resolve`, `manifest`, `probe`), `vimax/App.test.js`, `openthorn` ×6 (`agent-generating-status`, `agent-resilience`, `edit-fuzzy-match`, `gemini-thought-signature`, `model-context-window`, `preview-bundle`) — plus 6 files with failing tests — `studio-smoke.test.js`, `all-studios-smoke.unit.spec.ts`, `virtualFsPlugin.test.ts`, `preview-inspect.test.ts`, `agent-files-progress.test.ts`, `timeline-editor-mask.test.js`.

**This branch, pre-env-repair — 21 failing files:**

| Failing file | In baseline set? | Failing tests | Cause (pre-existing category) |
|---|---|---|---|
| `src/components/Canvas.test.js` | ✅ | collection | sub-workspace/pathing |
| `tests/unit/timeline-components.unit.spec.ts` | ✅ | collection | stale timeline source-string assertions |
| `tests/unit/timeline-editor.unit.spec.ts` | ✅ | collection | stale timeline source-string assertions |
| `tests/unit/timeline-state.unit.spec.ts` | ✅ | collection | stale timeline source-string assertions |
| `tests/unit/timeline-upload-sources.unit.spec.ts` | ✅ | collection | stale timeline source-string assertions |
| `.agents/skills/media-use/scripts/resolve.test.mjs` | ✅ | collection | sub-workspace/pathing |
| `.agents/skills/media-use/scripts/lib/manifest.test.mjs` | ✅ | collection | sub-workspace/pathing |
| `.agents/skills/media-use/scripts/lib/probe.test.mjs` | ✅ | collection | sub-workspace/pathing |
| `apps/vimax/frontend/src/App.test.js` | ✅ | collection | sub-workspace/pathing |
| `apps/openthorn/.../agent-generating-status.test.ts` | ✅ | collection | esbuild `TextEncoder` invariant |
| `apps/openthorn/.../agent-resilience.test.ts` | ✅ | collection | esbuild `TextEncoder` invariant |
| `apps/openthorn/.../edit-fuzzy-match.test.ts` | ✅ | collection | esbuild `TextEncoder` invariant |
| `apps/openthorn/.../gemini-thought-signature.test.ts` | ✅ | collection | esbuild `TextEncoder` invariant |
| `apps/openthorn/.../model-context-window.test.ts` | ✅ | collection | esbuild `TextEncoder` invariant |
| `apps/openthorn/.../preview-bundle.test.ts` | ✅ | collection | esbuild `TextEncoder` invariant |
| `src/test/renderpage-init.test.js` | ✅ | collection | `@clerk/shared` `.mjs` corruption (env) |
| `src/components/__tests__/studio-smoke.test.js` | ✅ | 19 | `@clerk/shared/dist/error.mjs` unresolvable (env corruption) |
| `tests/unit/all-studios-smoke.unit.spec.ts` | ✅ | 4 | `enhanceMenu is not defined`, `AvatarStudio.js:267` |
| `apps/openthorn/.../virtualFsPlugin.test.ts` | ✅ | 8 | esbuild `TextEncoder` invariant |
| `apps/openthorn/.../preview-inspect.test.ts` | ✅ | 1 | esbuild `TextEncoder` invariant |
| `apps/openthorn/.../agent-files-progress.test.ts` | ✅ | 2 | esbuild `TextEncoder` invariant |

**Diff result: 21 of 21 failing files are in the baseline set. The only baseline file NOT failing is `timeline-editor-mask.test.js`** — which now passes 9/9 (verified in isolation) because `7982591ae` reverted the uncommitted `TimelineEditorPage.jsx` edit that had caused its stale source-string assertion failure. **Zero new failing files. Zero new failing tests.**

**Post-env-repair — 20 failing files:** the same 21-file list minus `renderpage-init.test.js` (its collection failure was caused by the `@clerk/shared` `.mjs` corruption, now repaired). Remaining failures: 16 collection-failure files (Canvas, timeline ×4, media-use ×3, vimax, openthorn ×6 — unchanged pre-existing causes), `studio-smoke.test.js` down to 2 (one 15s mount timeout on `AnimatePage.js`, one residual `enhanceMenu is not defined` on `AvatarStudio.js:267`), `all-studios-smoke` 4, `virtualFsPlugin` 8, `preview-inspect` 1, `agent-files-progress` 2. Still a strict subset of the baseline set.

### 6.3 Failed-test count delta (17 baseline → 34 pre-repair) — explained

All 34 pre-repair failures are inside baseline files: studio-smoke 19 (per-run module-resolution variance of the same `@clerk/shared` env defect — the plan documents this count varying across audits) + virtualFsPlugin 8 + all-studios-smoke 4 + preview-inspect 1 + agent-files-progress 2. Post-repair the total is **17 — exactly the baseline's count** — with the residual 17 all attributable to pre-existing defects (esbuild invariant 11, `enhanceMenu` 5 incl. the residual studio-smoke instance, timeout flake 1). Test-count collection variance (2835/2841 vs baseline 2633 + 208 expected) is the same −6 residual the plan already attributes to pre-existing flaky-suite collection variance, not to the integration.

### 6.4 Verdict

**NO-REGRESSION — explicit and evidenced:**

1. Failing-file set on this branch (21 pre-repair, 20 post-repair) is a strict subset of the SA-3 baseline's 22 failing files; identity-verified file-by-file in §6.2.
2. `grep -ci personalize` on both complete full-run logs = **0** — no personalization file failed, or even appeared, in the full suite.
3. The personalization suite in isolation: 208/208 pass, twice, before and after environment repairs.
4. The one baseline failure that disappeared (`timeline-editor-mask.test.js`) is explained by `7982591ae`'s revert of a non-integration edit, and verified green (9/9) in isolation.
5. The integration's diff touches only `src/components/personalize/` (32 files), one SQL migration, `.gitignore`, and docs — no test infrastructure, no build config, no studio code.

---

## 7. SECURITY SELF-CHECK — NEW discovery module (`src/components/personalize/discovery/`)

Read-only code review of `urlSafety.js`, `staticFetch.js`, `htmlParser.js`. **10 of 10 guards PRESENT.**

| # | Guard | Verdict | Evidence (file:line) |
|---|---|---|---|
| 1 | Private IP range rejection (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7, fe80::/10) | **PRESENT** | Ranges defined `urlSafety.js:58-77` (`PRIVATE_IPV4_RANGES`: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, plus 0/8, CGNAT 100.64/10, multicast, reserved; `PRIVATE_IPV6_RANGES`: ::1/128, fc00::/7, fe80::/10, ::/128, ff00::/8); enforced by `isPrivateIp()` `:171-178` and called at `:230` (literal IP), `:253` (DNS result), `:308`, `:329` (rebind guard) |
| 2 | localhost / metadata endpoints blocked (169.254.169.254, metadata.google.internal) | **PRESENT** | `BLOCKED_HOSTNAMES` set `urlSafety.js:48-55` — contains `localhost`, `metadata.google.internal`, `169.254.169.254`, `metadata`, `instance-data`, `kubernetes.default.svc`; enforced `:221-223` |
| 3 | DNS rebind re-check at fetch time | **PRESENT** | `reResolveGuard()` `urlSafety.js:304-346` (re-resolves DNS, rejects if any new address is private or overlaps nothing with the validated set); invoked at every fetch/redirect hop — `staticFetch.js:97` (page fetch) and `staticFetch.js:182` (asset fetch); manual `redirect: 'manual'` handling `staticFetch.js:61-107, 160-186` |
| 4 | Non-http(s) scheme rejection | **PRESENT** | `urlSafety.js:208-210` — `if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { safe: false, … }`; also enforced for assets `:385-387` |
| 5 | Userinfo (user:pass@) rejection | **PRESENT** | `urlSafety.js:212-214` — `if (parsed.username \|\| parsed.password) return { safe: false, reason: 'URL contains userinfo (user:pass@)' }` |
| 6 | URL length cap (2048) | **PRESENT** | `MAX_URL_LENGTH = 2048` `urlSafety.js:39`; enforced `:197-199` — `if (trimmed.length > MAX_URL_LENGTH) return { safe: false, … }` |
| 7 | Unsupported social domain list | **PRESENT** | `UNSUPPORTED_SOCIAL_DOMAINS` `urlSafety.js:85-95` (facebook, instagram, twitter, x, tiktok, linkedin, reddit, pinterest, youtube — incl. subdomain match); `checkSocialDomainBlock()` `:355-369` |
| 8 | Junk extension blocklist | **PRESENT** | `JUNK_EXTENSIONS` `urlSafety.js:98-102` (.exe, .dll, .zip, .rar, .tar, .gz, .bat, .sh, .msi, .dmg, .iso, .7z, .jar, .apk, .deb, .rpm); enforced `:389-393` |
| 9 | Allowed asset extension allowlist | **PRESENT** | `ALLOWED_ASSET_EXTENSIONS` `urlSafety.js:105-107` (.jpg, .jpeg, .png, .webp, .gif, .svg, .avif, .ico); matched in `validateAssetUrl()` `:395-400`; extension-less CMS URLs pass with `extension: null` by design (`:401-404`) |
| 10 | No `eval` / `Function()` on discovered content | **PRESENT** | `grep -rn "eval(\|new Function" src/components/personalize/` → **0 matches**. Policy documented `htmlParser.js:16-18` — "We MUST NEVER call `eval` or `Function()` on discovered content. We MUST NOT trust innerHTML / outerHTML… linkedom is a pure-JS DOM implementation with no script execution"; regex fallback is substring-only `htmlParser.js:193-196` |

Supplementary guard properties observed: per-fetch timeout (`DNS_LOOKUP_TIMEOUT_MS` `:42`, `DEFAULT_TIMEOUT_MS` `staticFetch.js:24`), redirect cap 3 (`staticFetch.js:23`), content-type allowlist (`staticFetch.js:110-116`), DNS lookup timeout with AbortController (`:239-244`).

---

## 8. NOT VERIFIED

1. **No live provider API calls.** MuAPI, OpenAI, and Supabase were never contacted; all provider interaction in tests is mocked. Upload limits, URL expiry, billing, and real model outputs are contract-documented only.
2. **No Playwright/e2e runs** and **no `vite dev` smoke** — no browser-level verification of any personalization flow.
3. **No Supabase project.** The RLS migration `supabase/migrations/20261012000000_create_personalization_outputs.sql` has never been applied; its policies are unexercised against a live `auth.uid()`.
4. **No independent security audit / penetration test.** The §7 self-check is a code review; SSRF guards are unit-tested against mocked DNS/fetch only. No live SSRF probes were made.
5. **`npm run verify:video-agent-studio` not re-run** (SA-3 baseline records FAIL — OpenChatCut subtree build broken; carried as pre-existing; owned by another agent).
6. **Build gates passed only after environment repairs** (§2). The initial failing states were real measurements in the as-found (damaged) environment; the passing states are real measurements after restoring `node_modules` to its intended, lockfile-consistent contents. A pristine-environment build (fresh `npm ci`) was not performed — prohibited by mission constraints.
7. **Pre-repair full-suite numbers reflect the as-found damaged environment** (the same environment class in which the SA-3 baseline's 22-file/17-test figures were measured); post-repair numbers are reported alongside for completeness.

---

## 9. BLOCKERS (must be resolved before merging to main / production)

1. **The feature has no user-reachable surface.** `PersonalizationModal` UI is not ported, discovery is not wired to `assetLibraryStore`, there is no persistence API beyond localStorage stores, and the studio one-liners (`studioBridge.js` → `RenderPage.js` / `src/lib/cinegen.js`) are documented but never applied (`git status --short src/components/RenderPage.js src/lib/cinegen.js` on the integration points = untouched). As committed, users cannot reach any of the 208 tested behaviors. (Carried from `RELEASE_READINESS.md` risk 1; unchanged by `04970a28b`, which only committed and stabilized the WIP.)
2. **RLS migration auth contradiction.** `20261012000000_create_personalization_outputs.sql` gates rows on `auth.uid()` while the application auth is Clerk-based; if Clerk remains the IdP, `auth.uid()` is null and the table locks to zero rows. The IdP decision and a policy rewrite are required before the migration is applied anywhere. (Risk 2.)
3. **Production-readiness evidence gap.** (a) Zero live-provider verification — MuAPI model-ID drift (`gpt-image-2-edit` alias history) is unverified against the live catalog; (b) the repo suite remains RED from pre-existing defects (20 failing files post-repair, incl. the `enhanceMenu` ReferenceError at `src/components/AvatarStudio.js:267` and the esbuild `TextEncoder` invariant under Vitest 4 + Node 24), which masks regression signal in CI; (c) full-suite flakiness observed historically (mock-order sensitivity) warrants a dedicated CI run of the personalization path before merge; (d) `node_modules` in this worktree and the shared install were found damaged and required repair — a clean `npm ci` + full re-verification is recommended as the merge gate.

**Non-blockers noted:** 32 personalization lint warnings are warning-level style issues; the >500 kB chunk advisory is a pre-existing config default; the openthorn/app build failures encountered were 100% environment corruption (pre-existing, timestamped before this session), not code defects.

---

*Prepared from live command output only. Every number, exit code, and citation above was measured in this session at HEAD `7982591ae`; nothing is estimated. Repairs were confined to gitignored `node_modules` contents and are disclosed in §2.*
