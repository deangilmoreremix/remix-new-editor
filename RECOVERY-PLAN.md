# Recovery Plan: OpenMontage remix-new-editor → production parity

Branch: `recovery/full-parity-consolidation` (started from develop `b327993208`).
Already completed in this session:
- Shared split-pane picker restored: `src/lib/modelSelectorUI.js` (`mountTemplateModelSelector`, `mountImageModelSelector`, `mountVideoModelSelector`).
- ImageStudio + VideoStudio + CinemaStudio migrated to rich pickers + jsdom parity test.
- Vite build green; ESLint exit 0; unit suite green.

Global Constraints
- Do NOT merge or deploy automatically. PR is documentation-only until human approves.
- Do NOT weaken production Clerk auth; any test-auth path must be gated to dev/CI only.
- Do NOT overwrite newer commits on origin/develop. Recovery branch only ADDS/RESTORES; it must rebase cleanly onto develop with no destructive rewrites.
- Preserve simpler single-model / single-list selectors where a studio does not need category-aware selection (do not over-engineer — YAGNI).
- All code changes must pass: `node --check`, ESLint (no new errors), Vite build, and the affected unit tests.

## Task 1: Audit the 10 remaining legacy model-picker studios and migrate category-aware ones

Goal: Every studio that needs category-aware (provider/category) model selection must use the upstream rich selector; simpler studios keep their existing selectors.

Acceptance:
- Inventory all remaining `mountModelSelector(` call sites in `src/components/*` (expected: CommercialStudio, CharacterStudio, AvatarStudio, VideoToolsStudio, UpscaleStudio, and others from a prior audit).
- Classify each: (a) needs category-aware selection → migrate to `mountImageModelSelector`/`mountVideoModelSelector` with the correct `allowedModelTypes`/catalog, preserving the studio's existing onSelect behavior (update model button, updateControlsForModel, close); (b) single-model/single-list → keep, only delete now-dead legacy symbols if imported but unused.
- Produce `RECOVERY-AUDIT-STUDIOS.md` (one line per studio: file, type, action taken, commits if any).
- No regressions: run the studio picker unit tests + the full unit suite once; build once.

## Task 2: Investigate and recover the 222 missing template image references

Goal: Templates must display their intended images.

Acceptance:
- Reproduce the 222 count (grep/regex for template image refs in `src/` and `apps/` that resolve to nonexistent files), then root-cause: are they (a) moved files, (b) wrong paths, (c) never committed assets, (d) generated-at-build but missing?
- Recover original assets where available (check `lib/`, `assets/`, `public/`, `apps/openthorn/` assets, and git history). Fix incorrect paths to point at existing files. For genuinely-missing assets with no recoverable source, leave a documented `TODO` + count rather than inventing images.
- Verify: a representative sample of templates (image + niche + cinema + character) render their images (headless check against the built `public/` output or jsdom).
- Produce `RECOVERY-AUDIT-IMAGES.md` with the breakdown (recovered / path-fixed / unrecoverable) and the final missing count.

## Task 3: Reconcile the 6 historical commits vs current develop

Goal: Recover only genuinely-missing completed work; never overwrite newer work on develop.

The 6 candidate commits (missing from PRs 1-30): 107ca1d52, 05a085843, ff7825399, 3247129ca, b3523bb39, 991c86384.

Acceptance:
- For each commit: `git show --stat` + `git diff` against `b327993208..develop` to see if its changes already exist on develop under a different commit, or were reverted/lost.
- Recover a commit's changes ONLY if genuinely missing from develop (apply cherry-pick or port of specific hunks; avoid conflicts with newer work).
- Produce `RECOVERY-AUDIT-HISTORICAL.md` (one row per commit: commit, summary, "recovered" / "already present" / "conflicts with newer work / skipped", and commit SHA if recovered).

## Task 4: Complete the SmartVideo Website Builder rebrand in apps/openthorn

Goal: Remove outdated customer-facing OpenThorn branding without breaking Website Builder functionality.

Acceptance:
- Inventory "OpenThorn" customer-facing strings/UI in `apps/openthorn/` (not internal comments).
- Replace with SmartVideo / Website Builder branding where they are user-facing.
- Do NOT remove internal references that are not customer-facing unless trivial. Do not break build/runtime.
- Produce `RECOVERY-BRAND-RENAME.md` with the list of changes and any "internal-only, left as-is" notes. Build still passes.

## Task 5: Investigate the Clerk auth overlay blocking browser tests; establish a safe authenticated test path

Goal: A repeatable, auth-gated browser-check path — without weakening production auth.

Acceptance:
- Confirm the overlay is the Clerk dev auth modal (`<ClerkProvider>` with `dev` mode / `Publishable key`), and that it intercepts pointer events on `#/image`, `#/video`, `#/cinema`.
- Determine a safe test path: e.g., a dedicated `ClerkProvider` test harness / test user seeded in dev, or a `data-testid`/bypass flag guarded by `NODE_ENV === 'test'` (or equivalent) that is NOT reachable in production. Must NOT ship a production auth bypass.
- Produce `RECOVERY-BROWSER-AUTH.md` describing the chosen path + exact env vars/seed steps + any code added (if any). If no safe path exists without new infra, state that clearly and name the blocker so the human can decide.

## Task 6: Run tests, lint, build verification, browser checks, and regression tests for all affected studios

Goal: End-to-end verification gate.

Acceptance:
- Run `npx vite build` once — must succeed.
- Run ESLint on all changed files + `scripts/audit-studio-imports.js` if present — no NEW errors.
- Run the full unit suite (`npx vitest run`) once — record pass/total. (If it exceeds the typical ~timeout, run the picker + studio specs at minimum and note full-suite status.)
- Run targeted browser parity (Task 5 path) for Image, Video, and Cinema pickers — record outcome; if auth-gated and no safe path, document as environment-blocked (not a code defect).
- Record results in the final report; do not merge until green.

## Task 7: Compare recovery branch vs origin/develop; flag overwrite risks

Goal: Prove the recovery branch only ADDS/RESTORES and won't clobber newer develop work.

Acceptance:
- `git log --oneline origin/develop..HEAD` and `git diff --stat b327993208 HEAD` to enumerate all commits on the recovery branch since develop.
- `git log --oneline b327993208..origin/develop` to enumerate newer develop work; confirm none of the recovery commits overwrite/modify those newer files in a conflicting way (i.e., recovery changes are additive or re-derive already-missing work).
- Produce `RECOVERY-DIFF-vs-DEVELOP.md` with the commit list + a conflict/overwrite risk assessment per changed file.

## Task 8: Commit verified fixes to recovery/full-parity-consolidation

Goal: All verified recovery code lives on the recovery branch only; no stray temp files; clean commits.

Acceptance:
- No `.tmp_*` / temp probe files committed (remove if present).
- Each task's changes committed with a clear subject; the picker parity commit (4d6c3766b) stays.
- `git status` clean of untracked temp/probe artifacts.
- Branch is rebased (not merged with merge commits) onto latest develop `b327993208` if any task touched develop-only code; keep linearized history.

## Task 9: Prepare a comprehensive PR (do NOT merge or deploy)

Goal: One PR that documents all recovered features, remaining issues, and test results.

Acceptance:
- `gh pr create` (or manual PR description) against `develop` from `recovery/full-parity-consolidation`, with title `recover: studio features, assets, and branding to production parity` and a body containing:
  - summary of recovered features per task,
  - remaining issues (items Tasks 2/5/7 could not fully close),
  - test/build/lint results (Vite build, ESLint, unit pass/total, browser parity status),
  - file inventory per task.
- PR is marked `DO NOT MERGE` / draft until human approves; no deploy triggered.
- Provide the PR URL in the final report.
