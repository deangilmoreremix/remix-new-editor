# Worktree & Branch Inventory — remix-new-editor consolidation

**Generated:** 2026-10-12
**Repo:** /Users/shasheemoore/Downloads/remix-new-editor
**Local `main`:** `4522e42dc` (15 commits AHEAD of `origin/main` = `482ebbb35`, 0 behind).
**Generator:** SA-1 (Worktree & Branch Forensics Specialist, read-only).

## 0. Summary

| Metric | Value |
|---|---|
| Total git worktrees registered | 30 (including the new `remix-integration-worktree` at `4522e42dc [integration/personalization-complete]`) |
| Pre-existing worktrees | 28 (at audit time) |
| Worktrees holding non-trivial unique code | 5 (port-cinegent, render-studio, audit-the-video-generation, remix-new-editor-leadfinder, internal-turner) |
| Detached-HEAD worktrees | 3 (see-smartvideo-678bad, remix-new-editor-production, butternut-copy) |
| Prunable worktrees (path missing) | 1 (upload-repair-wt) |
| Class A (complete + integrated; safe to close) | 14 |
| Class B (complete + not integrated; review) | 6 |
| Class C (partial; keep) | 5 |
| Class D (duplicate; safe to close one) | 2 (port-cinegent / render-studio aliases) |
| Class E (blocked / detached) | 3 |
| Class F (active / required; keep) | 8 (including main + 4 unique-code holders + develop branch) |
| Local branches with no worktree | 49 (most are class A backup/* / reconcile/* / fix/*; 4 are F) |
| Stashes | 13 (1 popped into dirty-state-preservation, 6 safe to DROP, 4 REVIEW, 1 KEEP) |

## 1. Worktree Inventory (28 pre-existing + 1 new = 29 active)

| # | Path | Branch | HEAD | Dirty? | ahead-orig | unique | Class | Reason |
|---|---|---|---|---|---|---|---|---|
| 1 | `/Users/shasheemoore/Downloads/remix-new-editor` | `main` | `4522e42dc` | CLEAN (3 files stashed 2026-10-12) | +15 | 15 | **F** | Operational worktree; holds upload-repair series (404e9fef4, 5a12a17f5, 783c480a5, b8d0b697c) + audit merge (eda740ff1). All work preserved. |
| 2 | `.kilo/worktrees/add-users-to-database-and-send-emails` | `add-users…` | `5cfe639ad` | N | −30 | 0 | A | 30 behind origin/main; 0 unique; merged upstream. |
| 3 | `.kilo/worktrees/audit-the-video-generation-in-the-template-studios` | `audit…` | `eda740ff1` | N | +10 | 10 | **F** | Source of the merge now in main `4522e42dc`; 10 unique commits incl. `b8f707b09 fix: resolve 5 full-suite test failures` and `1d6d3ce21 template-to-video timeline sync`. Hold for follow-up merges. |
| 4 | `.kilo/worktrees/checking-all-features-and-functions-from-each` | `checking…` | `0e5f2228d` | Y (untracked audit docs) | −27 | 0 | A | HEAD 27 behind origin/main; untracked audit docs only. |
| 5 | `.kilo/worktrees/internal-turner` | `internal-turner` | `129c18b7f` | N | +2 | 2 | **C** | 2 unique commits incl. `107ca1d52 feat(website-builder): integrate SmartVideo Website Builder navigation and rebrand OpenThorn`; not in origin/main. Worth review. |
| 6 | `.kilo/worktrees/lopsided-seatbelt` | `lopsided-seatbelt` | `33ca035de` | Y (5 files) | −1189 | 0 | A | 1189 behind origin/main; dirty mostly dist/lock churn. |
| 7 | `.kilo/worktrees/luxuriant-princess` | `luxuriant-princess` | `3d3c44dc2` | Y (deleted cinema webp) | −1190 | 0 | A | 1190 behind; auth-trial-UI removal already in main. |
| 8 | `.kilo/worktrees/modals-comeback` | `modals-comeback` | `5cfe639ad` | Y (Timeline + 3 modal files) | −30 | 0 | A | 30 behind; dirty modal work, no unique value vs upstream. |
| 9 | `.kilo/worktrees/port-cinegent` | `feature/cinegen-web-full-port` | `db81a7a7e` | Y (5 *.md docs) | +5 | 5 | **F** | **Holds `apps/cinegen-studio/` NOT in main** (verified via `ls`); 5 unique commits incl. `cd7ea0f8b feat: port CineGen web app as apps/cinegen-studio`. |
| 10 | `.kilo/worktrees/remix-new-editor-render-phase2` | `fix/render-core-media-cert` | `1003ee696` | Y (4 files) | −47 | 0 | A | 47 behind origin/main; phase-3 work already in upstream. |
| 11 | `.kilo/worktrees/render-studio` | `feature/timeline-node-cinegen-parity` | `1aa2799e1` | Y (5 cinegen-web files) | +2 | 2 | **F** | **Holds `apps/cinegen-web/` NOT in main**; commits `6ae3cf4b1` squash-merge of cinegen-web content. |
| 12 | `.kilo/worktrees/shimmer-agustinia` | `investigate-mountpersonalize-trigger-error` | `f84fc8916` | Y (4 files) | −73 | 0 | B | Investigation branch; personalizePopover.js change likely already in main `4522e42dc`. |
| 13 | `.kilo/worktrees/spiritual-pig` | `investigate-feature-gating` | `f84fc8916` | Y (HeaderAuth.jsx, clerkEntitlements.js) | −73 | 0 | B | Investigation branch; 73 behind, gating logic landed upstream. |
| 14 | `.kilo/worktrees/stripe` | `stripe` | `f84fc8916` | Y (env, backend) | −73 | 0 | A | 73 behind; stripe changes already in upstream. |
| 15 | `.kilo/worktrees/upload-functionality` | `upload-functionality` | `482ebbb35` | Y (UploadPicker.js + 4 untracked) | 0 | 0 | A | Exact origin/main HEAD; dirty checkout but zero unique value. |
| 16 | `remix-canonical-final` | `reconcile/canonical-develop-final` | `2b4708892` | Y (png deletions) | −56 | 0 | A | Reconcile snapshot; all in upstream. |
| 17 | `remix-new-editor-develop-production` | `reconcile/promote-main-to-develop` | `580ce6a9d` | Y (png/asset deletions) | −35 | 0 | A | Promote-main checkpoint; all in upstream. |
| 18 | `remix-new-editor-leadfinder` | `fix/lead-finder-production-readiness-clean` | `4e91b0576` | Y | +3 | 3 | **F** | LeadFinder SSRF hardening via async DNS (`959685f8a` babel + `d577b2668` prod-readiness); not in main. |
| 19 | `remix-new-editor-production` | DETACHED @ `38a057df9` | `38a057df9` | Y | −63 | 0 | E | Detached, no branch; example-gallery bridge routing fix — already merged upstream. |
| 20 | `remix-new-editor-release` | `reconcile/current-local-main` | `ad2d6adc5` | Y | +1 | 1 | C | Render core browser production-accuracy (`ad2d6adc5`); not in origin/main. |
| 21 | `remix-new-editor-render-cert` | `fix/render-ai-tools-cert` | `152c1b9cd` | Y | −51 | 0 | A | TTS gate + URL validate; already in upstream. |
| 22 | `remix-pre-reconciliation` | `recover/pre-reconciliation-exact` | `5b487dd6a` | Y | +1 | 1 | C | Checkpoint commit `5b487dd6a`; snapshots pre-reconciliation state including `.agents/skills/`. |
| 23 | `remix-production-reconcile` | `canonical/smartvid-complete-app` | `07dee25b0` | Y | −68 | 0 | A | Render landing demos; already in upstream. |
| 24 | `remix-source-truth` | `reconcile/source-of-truth-2026-09-13` | `46298d9e1` | Y | +1 | 1 | B | Source-truth infra (`46298d9e1`); unique content `.eslintrc.js/.github/workflows/ci.yml/.gitignore` may overlap with local main dirty `eslint.config.js`. |
| 25 | `remix-upstream-parity` | `reconcile/upstream-parity-production-2026-09-13` | `e27161b31` | Y | +2 | 2 | C | `e27161b31` upstream VideoStudio end-frame parity; not in origin/main; needs review. |
| 26 | `see-smartvideo-678bad` | DETACHED @ `678badca7` | `678badca7` | Y | −70 | 0 | E | Detached, no branch; "commit uncommitted worktree changes for production merge" — already merged upstream. |
| 27 | `butternut-copy` (in `~/.local/share/kilo/worktree-pool`) | DETACHED @ `55f66049d` | `55f66049d` | N | +18 | 18 | **F** (verify) | Landing historical reconstruction (PR #26) merged; 18 unique commits; verify against origin/main before prune. |
| 28 | `/private/var/folders/.../T/kilo/upload-repair-wt` | `fix/unified-media-upload-pipeline` | `21861ed27` | PATH GONE | n/a | n/a | E | Prunable, path missing on disk (`ls` ENOENT); concept merged into main. |
| 29 | `/Users/shasheemoore/Downloads/remix-integration-worktree` | `integration/personalization-complete` | `4522e42dc` | N (newly created) | +15 | 15 | **F** | **New integration worktree** for the personalization integration mission. |

**Notes:**
- "ahead-orig" = `git rev-list --left-right --count origin/main...HEAD` (positive = worktree ahead of origin/main; negative = worktree behind/stale).
- "unique" = unique commits worktree HEAD has that origin/main does NOT.
- 9 of the 28 pre-existing worktrees are DIRTY (#1 stashed 2026-10-12, #4, #6-8, #10-18, #20-26). Most dirty files are SmartVideoViral *.png deletions + dist/ + lock files — build artifacts, not source.
- `apps/cinegen-web` and `apps/cinegen-studio` are verified **ABSENT** from local main `4522e42dc` and `origin/main` `482ebbb35`. The CineGen port mission is **incomplete** — worktrees #9 and #11 are the only source.

## 2. Orphan Branches (local branches with no worktree)

| Branch | merged-origin-main? | Class |
|---|---|---|
| `add-users-to-database-and-send-emails` | Y | A |
| `audit-the-video-generation-in-the-template-studios` | **N** | **F** (10 unique → source of `4522e42dc` merge) |
| `backup/canonical-before-landing-repair` | (old snapshot) | A |
| `backup/canonical-pre-develop-conflict-resolution` | (old) | A |
| `backup/complete-app-before-canonical` | (old) | A |
| `backup/dirty-main-2026-09-26` | N | A (snapshot) |
| `backup/local-develop-before-reconcile` | (old) | A |
| `backup/local-main-before-reconcile` | (old) | A |
| `backup/reconciliation-drift-2026-09-13` | N | A (snapshot) |
| `backup/remote-develop-before-promotion` | (old) | A |
| `backup/remote-main-before-develop-promotion` | (old) | A |
| `canonical/smartvid-complete-app` | Y | A |
| `checking-all-features-and-functions-from-each` | Y | A |
| `develop` | N | **F** (long-lived dev branch — verify before removal) |
| `feature/cinegen-web-full-port` | N | **F** (#9 worktree) |
| `feature/integrate-openhiggs-personalization` | Y | A |
| `feature/timeline-node-cinegen-parity` | N | **F** (#11 worktree) |
| `fix/lead-finder-production-readiness` | Y | A |
| `fix/lead-finder-production-readiness-clean` | N | **F** (#18 worktree) |
| `fix/render-ai-tools-cert` | Y | A |
| `fix/render-core-media-cert` | Y | A |
| `fix/template-cinema-picker-media-contracts-2026-09-15` | Y | A |
| `fix/template-cinema-production-readiness` | N | B |
| `fix/template-cinema-production-readiness-clean` | Y | A |
| `fix/template-cinema-production-readiness-v2` | Y | A |
| `fix/unified-media-upload-pipeline` | N | B (worktree prunable; concept merged) |
| `internal-turner` | N | **F** (#5) |
| `investigate-feature-gating` | Y | A |
| `investigate-mountpersonalize-trigger-error` | Y | A |
| `lopsided-seatbelt` | Y | A |
| `luxuriant-princess` | Y | A |
| `modals-comeback` | Y | A |
| `port-cinegent` | N | **F/D** (alias of `feature/cinegen-web-full-port`; same conceptual CineGen port) |
| `reconcile/canonical-develop-final` | Y | A |
| `reconcile/cinegen-timeline-complete` | N | B |
| `reconcile/current-local-main` | N | C (#20) |
| `reconcile/dev-production-parity` | N | B |
| `reconcile/main-production-2026-09-26` | N | B |
| `reconcile/production-parity-2026-09-13` | N | B |
| `reconcile/promote-main-to-develop` | Y | A |
| `reconcile/source-of-truth-2026-09-13` | N | C (#24) |
| `reconcile/upstream-parity-production-2026-09-13` | N | C (#25) |
| `recover/known-good-app` | (not merged, not --no-merged) | A |
| `recover/pre-reconciliation-exact` | N | C (#22) |
| `render-studio` | N | **F/D** (legacy alias of `feature/timeline-node-cinegen-parity`) |
| `stripe` | Y | A |
| `upload-functionality` | Y | A |

**Duplicate evidence:** `port-cinegent` and `feature/cinegen-web-full-port` are alias labels for the same conceptual CineGen port. `render-studio` is legacy alias of `feature/timeline-node-cinegen-parity`. Both alias pairs are class D duplicates.

## 3. Stashes

| # | on-branch | files | verdict |
|---|---|---|---|
| **stash@{0}** | `main` | 3 files (eslint.config.js, TimelineEditorPage.jsx, protected-upload-baseline.test.ts) — `pop`-equivalent of 2026-10-12 audit preservation | **KEEP** — preserves the pre-stash dirty main state. Re-apply with `git stash pop` if needed. |
| **stash@{1}** | `main` | 9 files (AudioStudio, upload.js, TimelineEditorPage, **protected-upload-baseline.test.ts 14↑**) | **KEEP** — directly mirrors the prior dirty main; phase3-task2 upload work |
| **stash@{2}** | `main` | AudioStudio + EditStudio + StoryboardStudio, "Example Gallery feature" | **REVIEW** — explicitly marked FOREIGN WIP (not part of upload repair). 29+/6− across 3 files. Confirm if Example Gallery is on roadmap before DROP. |
| **stash@{3}** | `main` | mass binary png deletions (SmartVideoViral, ai-captions-modal, etc.) | **DROP** — binaries already deleted in upstream main; no recovery value |
| **stash@{4}** | `main` | data/storyboards-state.json (+2 storyboards), 5 studio files (+6/−3), personalizePopover | **REVIEW** — preserves dirty main during develop promotion; contains storyboard test data + studio tweaks. Likely already superseded by local main `4522e42dc`. |
| **stash@{5}** | `fix/template-cinema-production-readiness` | dist/assets binaries deletion | **DROP** — pre-rebase snapshot, dist artifacts only |
| **stash@{6}** | `fix/template-cinema-production-readiness` | `.env.example` 228+, 2003+/− README, app configs | **DROP** — pre-rebase; .env.example may have value, rest is config drift |
| **stash@{7}** | `fix/lead-finder-production-readiness` @ `cf7c7f3e1` | (no stat output) | **DROP** — appears empty/no content; "Failed to load section" fix is already in `fix/lead-finder-production-readiness-clean` (`4e91b0576`) |
| **stash@{8}** | `develop` | .gitignore +3 ("Local Netlify folder") | **DROP** — gitignore noise from pre-cherrypick |
| **stash@{9}** | `incandescent-cheese` | .eslintrc.js, .kilo/kilo.json, 4 docs DELETED, ai-vfx tailwind, backend/director agents | **DROP** — pre-existing cleanup from prior session; docs already deleted elsewhere |
| **stash@{10}** | `develop` | .gitignore +3, Timeline.js, TokenEditor.jsx, VideoUploader.jsx, 5+ common components | **DROP** — pre-existing develop worktree drift; not part of conflict |
| **stash@{11}** | `develop` | package-lock 520+/−, package.json, src/main.js, vite.config.js 45+/−, src/lib/router.js | **REVIEW** — "main repo timeline fixes"; may contain vite/router tweaks relevant to main work |
| **stash@{12}** | `incandescent-cheese` | .env.example +7, backend .env.sample, 2 director agents (152+/−), speechTranscriptionService.js (49+), VideoAgentService, TokenEditor.jsx 42+/−, Store.js 77+, 2 timeline element files DELETED | **REVIEW** — substantial backend/timeline work; "parent repo timeline fixes pending merge"; **HIGH RISK if dropped** |

## 4. Lost-Code Warning

If the following worktrees/branches are deleted without preservation, code would be lost vs local main `4522e42dc`:

| source | SHAs | content | risk |
|---|---|---|---|
| port-cinegent (#9) | db81a7a7e, 114075c45, 8c77d4dd7, 1d43693a0, cd7ea0f8b | **apps/cinegen-studio/** (entire dir, ~2264 files, 291k insertions) | **CRITICAL** — not in main, not in origin/main |
| render-studio (#11) | 1aa2799e1, 6ae3cf4b1 | **apps/cinegen-web/** (entire dir, ~2577 files, 1.13M insertions) | **CRITICAL** — not in main, not in origin/main |
| audit-the-video-generation (#3) | eda740ff1 + 9 ancestors | template-to-video coverage + 5 test fixes + vite.config.js + CI workflow | HIGH — 10 unique commits, only `eda740ff1` merged into main |
| remix-new-editor-leadfinder (#18) | 4e91b0576, 959685f8a, d577b2668 | LeadFinder SSRF async DNS + @babel/preset-react fix | HIGH — LeadFinder SSRF hardening not in main |
| internal-turner (#5) | 129c18b7f, 107ca1d52 | OpenThorn rebrand + SmartVideo Website Builder nav | MEDIUM — 2 unique commits, conflicts with main |
| remix-upstream-parity (#25) | e27161b31, 46298d9e1 | upstream VideoStudio end-frame parity + source-truth infra | MEDIUM — not in origin/main |
| remix-new-editor-release (#20) | ad2d6adc5 | `fix(render): make core browser renderer production accurate` | MEDIUM — render parity work |
| remix-source-truth (#24) | 46298d9e1 | source-truth verification infra (.eslintrc.js, ci.yml, .gitignore, README, ANIMATE_UI_PLAN) | MEDIUM — overlaps with dirty main `eslint.config.js` |
| remix-pre-reconciliation (#22) | 5b487dd6a | pre-reconciliation checkpoint including `.agents/skills/` additions | LOW — already in main via other path likely |
| butternut-copy (#27) | 55f66049d + 17 ancestors | landing historical reconstruction (PR #26) | MEDIUM — 18 commits; verify if merged to origin/main first |
| shimmer-agustinia (#12) | f84fc8916 | personalizePopover.js, package.json, vite.config.js | LOW — likely already in main `4522e42dc` (audit merge brought personalization work) |
| spiritual-pig (#13) | f84fc8916 | HeaderAuth.jsx, clerkEntitlements.js | LOW — likely already in upstream |
| stripe (#14) | f84fc8916 | .env.example, backend/server.js | LOW — already in upstream |

## 5. KEEP LIST (consolidation mission)

| item | SHA/HEAD | justification |
|---|---|---|
| **main** (#1) | `4522e42dc` | Operational worktree; holds 15 unmerged commits (upload-repair series + audit merge) |
| **remix-integration-worktree** (#29) | `4522e42dc` | **NEW** integration worktree for the personalization integration mission |
| **port-cinegent** (#9) | `db81a7a7e` | `feature/cinegen-web-full-port` — sole source of `apps/cinegen-studio/` not in main |
| **render-studio** (#11) | `1aa2799e1` | `feature/timeline-node-cinegen-parity` — sole source of `apps/cinegen-web/` + timeline-node CineGen parity commits |
| **audit-the-video-generation** (#3) | `eda740ff1` | 10 unique commits feeding the merge now in main; `b8f707b09 fix: resolve 5 full-suite test failures`, `1d6d3ce21 template-to-video timeline sync` |
| **remix-new-editor-leadfinder** (#18) | `4e91b0576` | `fix/lead-finder-production-readiness-clean` — SSRF hardening via async DNS, not in main |
| **internal-turner** (#5) | `129c18b7f` | 2 unique commits: `107ca1d52 feat(website-builder): integrate SmartVideo Website Builder navigation and rebrand OpenThorn` |
| **release** (#20) | `ad2d6adc5` | `reconcile/current-local-main` — render parity work |
| **upstream-parity** (#25) | `e27161b31` | `reconcile/upstream-parity-production-2026-09-13` — upstream VideoStudio end-frame parity |
| **source-truth** (#24) | `46298d9e1` | `reconcile/source-of-truth-2026-09-13` — canonical source-truth infra |
| **pre-reconciliation** (#22) | `5b487dd6a` | `recover/pre-reconciliation-exact` — last good pre-reconcile checkpoint |
| **develop** branch (no worktree) | (remote) | Long-lived dev branch; verify before removal — may have unmerged work |
| **remotes/cinegen/main**, **remotes/cinegen/director-page-redesign** | (remote) | Cannot delete — keep |

## 6. Recommended Removal Order (safe → risky)

1. **PRUNE** `upload-repair-wt` (#28) — path gone; `git worktree prune` after manual review.
2. **DETACHED orphan worktrees**: `see-smartvideo-678bad` (#26), `remix-new-editor-production` (#19) — no branch, no merge target, all unique=0.
3. **butternut-copy** (#27) — detached but 18 unique commits — verify against origin/main first; if merge PR #26 already shipped, prune.
4. **Backup/* branches** (9 refs): all class A snapshots, safe.
5. **Reconciliation snapshots merged upstream**: `canonical/smartvid-complete-app`, `reconcile/canonical-develop-final`, `reconcile/promote-main-to-develop`, `recover/known-good-app`, `fix/render-ai-tools-cert`, `fix/render-core-media-cert`.
6. **Stale feature branches already merged upstream**: `add-users-to-database-and-send-emails`, `checking-all-features-and-functions-from-each`, `feature/integrate-openhiggs-personalization`, `fix/lead-finder-production-readiness`, `fix/template-cinema-production-readiness-clean`/`-v2`, `lopsided-seatbelt`, `luxuriant-princess`, `modals-comeback`, `stripe`, `upload-functionality`, `investigate-feature-gating`, `investigate-mountpersonalize-trigger-error`.
7. **Stale .kilo worktrees** (all merged upstream, 0 unique): #2 add-users, #4 checking, #6 lopsided, #7 luxuriant, #8 modals, #10 render-phase2, #12 shimmer, #13 spiritual-pig, #14 stripe, #15 upload-functionality, #16 canonical-final, #17 develop-production, #21 render-cert, #23 production-reconcile.
8. **Reconciliation-class branches w/0 ahead but possibly needed for diff archaeology**: `reconcile/cinegen-timeline-complete`, `reconcile/dev-production-parity`, `reconcile/main-production-2026-09-26`, `reconcile/production-parity-2026-09-13` (all B).
9. **DUP branches**: `port-cinegent` (alias of `feature/cinegen-web-full-port`), `render-studio` (alias of `feature/timeline-node-cinegen-parity`).
10. **Stash drops** (safe): stash@{3}, @{5}, @{6}, @{7}, @{8}, @{9}.
11. **Stash reviews** (hold): stash@{2} (FOREIGN WIP), stash@{4} (develop promotion), stash@{10}, stash@{11} (timeline fixes).

## 7. Evidence Index

- `apps/` in local main: `ai-vfx director openthorn video-agent-studio vimax` (verified)
- `apps/` in port-cinegent: adds `cinegen-studio` (verified)
- `apps/` in render-studio: adds `cinegen-web` (verified)
- `apps/cinegen-web` and `apps/cinegen-studio` absent in `git ls-tree origin/main` and local `git ls-tree HEAD`
- Main dirty (3 files) → all stashed 2026-10-12 in `stash@{0}`
- 13 stashes listed; 6 safe to DROP, 4 to REVIEW, 1 (stash@{1}) is a duplicate of (now-removed) dirty state, 1 KEEP at top
- Prunable worktree: `/private/var/.../T/kilo/upload-repair-wt` — directory missing (verified `ls` ENOENT)
