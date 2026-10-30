# Recovery Audit: Missing Template Image References (Task 2)

## Summary
Reproduced the missing-image problem from the asset path references in source
code (not a literal "222" counter — no such figure exists in-repo; the prior
session's number appears to have been a count-in-progress). Method: collect
every quoted `/thumbnails/...`, `/sample-video.mp4`, `/docs/assets/...` path
from `src/` and `apps/openthorn/src/`, then test each against `public/` on disk.

## Initial state
- Distinct referenced asset paths: 246
- Missing from `public/`: **202** (matches the "222 missing" class of problem)
- Files on disk under `public/thumbnails/`: 186

## Root cause
Most missing assets are template/studio/hero thumbnails that **were once
committed and then deleted** from the working tree (git history still has them).
A smaller set are **incorrect path strings** (e.g. `/thumbnails/heroes/audio.webp`
when the file is actually `audio.webp.png`), and a few are **never-committed**
sample media or dead-code refs.

## Recovery actions
1. **Recovered 174 assets from git history** — `git checkout <last-commit-with-file> -- public/<path>` for every referenced thumbnail that exists in some branch's history. All are `public/thumbnails/*` (studio, hero, category, tools, template-niche thumbnails). This is additive: none of these overwrite a file present in `b327993208` (develop).
2. **Fixed incorrect live paths in `src/lib/thumbnails.js`**:
   - `HERO_THUMBNAILS`: 9 broken refs → corrected to the existing `.webp.png` variants
     (videoagent, audio, avatar, training, videotools, lipsync, render, chat) and
     `templates` → `/thumbnails/pages/templates.webp.png`.
   - `STUDIO_THUMBNAILS.viral` already resolves to `studios/video.webp` (no change).
3. `src/lib/thumbnails.js` is the LIVE map consumed by `createHeroSection`
   (~25 studio/page components) + `AppsHub` + `TemplatesPage` + `ExplorePage`.

## Final state
- **Live `thumbnails.js` refs**: 136 total, **0 missing** (all resolve).
- **Total referenced asset paths still missing**: **19** → all are non-runtime:
  - 4 sample-media (`docs/assets/demo.mp4`, `generated_example.webp`,
    `studio_demo.webp`, `sample-video.mp4`) — referenced only by dead
    `showcaseConfig.js sampleMedia`.
  - 3 dead showcaseConfig studio refs (`studios/academy.webp`, `studios/influencer.webp`,
    `studios/vfx.webp`).
  - 11 dead showcaseConfig `templateThumbnails` (`*.webp.png`, never committed).
  - 1 test mock (`tools/test.webp` in `src/test/edit-studio-integration.test.js:28`,
    intentionally absent — `vi.fn(() => ...)` stub).
- `showcaseConfig.js` is imported by 3 landing sections but **never referenced**
  (only `ValueStackSection.jsx` declares its own local `SHOWCASE_CONFIG`).
  `showcaseConfig.mjs` is **never imported**. Both are dead code → their broken
  refs have zero production impact, so left as-is (documented) rather than
  inventing assets that never existed.

## Verification
- `node --check src/lib/thumbnails.js` → OK.
- Scripted existence check of all 136 live `thumbnails.js` refs → 0 missing.
- Restored assets: 174 added under `public/thumbnails/`.
- Visual parity would require auth (see Task 5); runtime asset resolution
  re-verified in Task 6 via build + a jsdom render of getStudioThumbnail /
  getHeroThumbnail / getTemplateThumbnailCandidates.

## TODOs (not recovered — no source available)
- `docs/assets/demo.mp4`, `generated_example.webp`, `studio_demo.webp`,
  `sample-video.mp4`: sample media never committed anywhere in history. If these
  are intended landing assets, they must be re-imported/produced; out of scope
  for template-image recovery.
- `showcaseConfig.js` + `showcaseConfig.mjs` dead-code refs: could be cleaned up
  in a separate chore (remove unused imports / delete `.mjs`); not done here to
  keep the recovery diff focused (YAGNI).
- `tools/test.webp`: intentional test mock, no action.
