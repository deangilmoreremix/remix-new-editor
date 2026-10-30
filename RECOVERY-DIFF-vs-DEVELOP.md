# Recovery: Diff vs develop (Task 7)

## Premise
Recovery branch `recovery/full-parity-consolidation` was cut from develop tip.
All comparisons use the develop tip as the base.

## Develop has NOT moved since the recovery branch was cut
```
$ git rev-list --count b327993208..origin/develop   => 0
$ git rev-parse --git-path... merge-base = b327993208
```
`origin/develop` == recover-base `b327993208`. There is **no newer work on
develop to overwrite**. The recovery branch is strictly additive on top of the
current develop head.

## Recovery-branch commits since develop base (8 recovery commits)
```
9f53048a0  chore(recovery): Task 5 — safe browser-auth path doc
4cea08816  feat(website-builder): Task 4 — OpenThorn -> Smart Video rebrand (apps/openthorn)
5b1cefc86  chore(recovery): Task 2 audit doc
1ab395370  chore(recovery): Task 2 — recover 174 thumbnails + fix live image paths
86c7ad0da  chore(recovery): Task 1 audit doc
d6a6ff8ca  chore(recovery): Task 3 audit doc
4d6c3766b  restore rich image/video model picker (Image/Video/Cinema) + tests
bc3f9e772  feat(agent): add ponytail skills (PRE-EXISTING on branch, not part of recovery)
```
History is **linear, no merge commits**.

## Files changed vs develop base (232)
```
 232 files changed, 1167 insertions(+), 386 deletions(-)
```
Breakdown by category:
- **Restored assets (ADDITIVE):** 174 `public/thumbnails/*` files (previously
  deleted from the tree; recovered from git history). Additive — none of these
  exist in develop's working tree, so no overwrite.
- **Live code fixes:** `src/lib/thumbnails.js` (9 HERO_THUMBNAILS path corrections),
  `src/components/ImageStudio.js`, `VideoStudio.js`, `CinemaStudio.js`,
  `src/lib/modelSelectorUI.js` (rich split-pane picker), `src/data/studioLandingPages.js`
  (Smart Video rebrand). All modify-only, restoring/intended behavior — no logic
  removed.
- **Tests:** `tests/unit/studio-picker-integration.unit.spec.ts` (new, jsdom parity).
- **Docs:** `RECOVERY-AUDIT-*.md`, `RECOVERY-BRAND-RENAME.md`, `RECOVERY-BROWSER-AUTH.md`
  (audit artifacts; non-runtime).

## Per-file overwrite risk assessment
| Changed file | Risk | Why |
|---|---|---|
| `public/thumbnails/*` (174) | None (additive) | absent in develop; restored from history |
| `src/lib/thumbnails.js` | None | only HERO_THUMBNAILS values corrected to existing `.webp.png`/`pages/templates.webp.png` (verified to exist) — no function/signature change |
| `src/lib/modelSelectorUI.js` | Low | adds `mountImageModelSelector`/`mountVideoModelSelector`/`mountTemplateModelSelector` + rich UI; keeps legacy `mountModelSelector` (still used by 12 sites). No removal. |
| `src/components/ImageStudio.js` | Low | legacy flat branch replaced with rich mount; `node --check` + build + browser parity pass |
| `src/components/VideoStudio.js` | Low | same pattern |
| `src/components/CinemaStudio.js` | Low | same pattern |
| `src/data/studioLandingPages.js` | None | OpenThorn->Smart Video display strings only |
| apps/openthorn `src/**` (34 files) | None | customer-facing string rebrand only (OpenThorn->Smart Video); internal IDs/route slugs/GitHub URL preserved; verbatim port from prior commit 107ca1d52 |
| `tests/unit/studio-picker-integration.unit.spec.ts` | None | new test file |

## Conclusion
No change overwrites any work on `origin/develop` (develop is identical to the
recovery base for every file we touched). The branch is ready for a clean PR
against develop with zero destructive risk. Build + 179 unit tests + browser
picker parity all green (see Task 6 results).
