# SmartVideo Landing Page Repair Plan

## Starting Point
- **Base branch:** `origin/develop` at `55f66049dceea90beecb7f95a1761c09434b7744`
- **Production URL:** https://smartvid.app
- **Repair branch name:** `fix/landing-latest-intended-state`

---

## Phase 1 — Landing History Audit (COMPLETE)

### Commit Classification (Aug 16 – Sep 29)

| SHA | Classification | Reason |
|-----|---------------|--------|
| `977d0382f` | INTENTIONAL_REMOVE | Removed obsolete mock demo section (DemosSection, ImageGenDemo, VideoGenDemo, CharacterDemo). Must stay removed. |
| `2cfbedccd` | REGRESSION | Removed `video-agent`, `workflows`, `mcp-cli` from app catalog. `video-agent` was restored in `c9bb83cc0`, but `workflows` and `mcp-cli` were wrongly removed again in `b522c7af9`. Also removed thumbnails from app cards. |
| `1aefcfa13` | INTENTIONAL_KEEP | Updated screenshots, landing components, gallery assets. |
| `404e93d47` | INTENTIONAL_KEEP | Redesigned checkout buttons, card icons, generation history. |
| `01426bc26` | INTENTIONAL_KEEP | Restored personalization content on landing page. |
| `607b09f38` | INTENTIONAL_KEEP | Committed uncommitted worktree changes. |
| `08b8245ad` / `f5d92161f` | INTENTIONAL_KEEP | Restored per-studio thumbnails and landing imports. |
| `c9bb83cc0` | INTENTIONAL_KEEP | Fixed thumbnail duplicates, broken paths, missing apps. Added back `video-agent`, `workflows`, `mcp-cli`. |
| `b522c7af9` | REGRESSION | Removed `workflows` and `mcp-cli` again ("remove invalid public app entries"). Restored demo components (ImageGenDemo, VideoGenDemo, CharacterDemo) which should NOT have been restored. |
| `07dee25b0` | INTENTIONAL_KEEP | Rendered landing page demos section. |
| `65fe42bd0` | INTENTIONAL_KEEP | Enabled auto-generate for UGC 'Create This Type of Video' CTA. Prefill work is already in develop. |
| `55f66049d` | REGRESSION | PR #26 merge. Too aggressively removed thumbnails and visual enhancements from HeroSection, HookSection, SixEnginesSection, AppsGridSection, ProblemSection, WorkflowSection, OfferSection. Also removed legitimate demo components that were correctly removed earlier. |

---

## Phase 2 — Keep the Correct Removal

**Must NOT return:**
- `src/components/landing/sections/DemosSection.jsx`
- `src/components/landing/demos/ImageGenDemo.jsx`
- `src/components/landing/demos/VideoGenDemo.jsx`
- `src/components/landing/demos/CharacterDemo.jsx`

**LandingPage must NOT render DemosSection.**

Do NOT restore:
- "Live Interactive Demo"
- "Try AI Image Generation"
- "Try AI Video Generation"
- "Try AI Character Creation"
- "Demo - No API calls made"

---

## Phase 3 — Restore Legitimate Newer Visuals

Restore thumbnails/visual enhancements that were wrongly removed by PR #26.

### Files to modify:

#### `src/components/landing/sections/HeroSection.jsx`
- Restore `SHOWCASE_CONFIG` import
- Restore studio visual gallery (8 thumbnails: image, video, cinema, character, edit, audio, avatar, effects)
- Restore thumbnail animation CSS and IntersectionObserver JS

#### `src/components/landing/sections/HookSection.jsx`
- Restore `SHOWCASE_CONFIG` import
- Restore studio visual gallery (10 thumbnails: image, video, cinema, character, edit, audio, avatar, effects, commercial, storyboard)
- Restore `hookFadeIn` animation CSS and thumbnail observer JS

#### `src/components/landing/sections/SixEnginesSection.jsx`
- Restore `SHOWCASE_CONFIG` import
- Restore `thumbnail` property on each engine object
- Restore thumbnail `<img>` rendering inside engine cards
- Restore full `apps` arrays (including `Workflows` and `MCP & CLI` in the Automate engine)

#### `src/components/landing/sections/AppsGridSection.jsx`
- Restore `SHOWCASE_CONFIG` import
- Restore thumbnail `<img>` on each app card
- Restore "Before/After Tool Previews" section (12 tool thumbnails)
- Restore `getStudioThumbnail(app.id)` resolution
- Fix categoryMap to include `workflows` and `mcp-cli` in `All` and `Automate` categories

#### `src/components/landing/sections/ProblemSection.jsx`
- Restore local `SHOWCASE_CONFIG` with `categoryThumbnails`
- Restore category thumbnail gallery (6 thumbnails: camera, commercial, social, portrait, vfx, style)

#### `src/components/landing/sections/WorkflowSection.jsx`
- Restore `SHOWCASE_CONFIG` import
- Restore `thumb` property on each workflow step
- Restore thumbnail `<img>` on step cards

#### `src/components/landing/sections/OfferSection.jsx`
- Restore `SHOWCASE_CONFIG` import
- Restore "Template Gallery" section (12 template thumbnails)

---

## Phase 4 — Fix "34 AI Creative Apps"

### Current state:
- `LandingPage.jsx` ALL_APPS: 31 entries
- `ScrollingAppStrip.jsx` APPS: 30 entries (with naming mismatches)
- `AppsGridSection.jsx` categoryMap `All`: 31 entries
- ScrollingAppStrip heading: "34 AI Creative Apps"
- AppsGridSection comment: "33 AI Creative Apps Showcase"

### Target: Exactly 34 UNIQUE apps

### Canonical 34 apps (audited from history + platform):
1. image
2. video
3. cinema
4. character
5. ai-vfx
6. influencer
7. storyboard
8. effects
9. vfx
10. edit
11. upscale
12. audio
13. avatar
14. training
15. videotools
16. render
17. video-agent
18. director
19. timeline
20. runway-motion
21. tiktok-carousel
22. advanced-dubbing
23. chat
24. commercial
25. templates
26. explore
27. library
28. community
29. assist
30. lip-sync
31. **workflows** (restored from history)
32. agents
33. **mcp-cli** (restored from history)
34. **academy** (existing platform section, missing from app catalog)

### Changes:

#### `src/components/landing/LandingPage.jsx`
- Add `workflows`, `mcp-cli`, `academy` to `ALL_APPS`
- Update comment from "33 AI Creative Apps Showcase" to "34 AI Creative Apps Showcase" (in AppsGridSection props if needed)
- Ensure `ALL_APPS` is the single source of truth

#### `src/components/landing/sections/ScrollingAppStrip.jsx`
- Replace duplicated `[...APPS, ...APPS, ...APPS]` with a single `APPS` array
- Use CSS animation for seamless scrolling (translateX(-33.333%)) with cloned track for infinite loop
- Mark cloned pills `aria-hidden="true"` so accessibility tree only announces 34 unique apps
- Fix APPS array to include all 34 apps with correct names:
  - `runway-motion` (not `Motion`)
  - `tiktok-carousel` (not `TikTok`)
  - `advanced-dubbing` (not `Dubbing`)
  - Add `video-agent`
  - Add `workflows`
  - Add `mcp-cli`
  - Add `academy`
- Update heading to "34 AI Creative Apps"
- Update comment to reflect 34 apps

#### `src/components/landing/sections/AppsGridSection.jsx`
- Update categoryMap `All` to include `workflows`, `mcp-cli`, `academy`
- Update categoryMap `Automate` to include `workflows`, `mcp-cli`
- Add `academy` to `Scale` or create appropriate category
- Update heading to use fixed count: `34 AI Creative Apps`
- Restore thumbnails on app cards
- Restore "Before/After Tool Previews" section

#### `src/content/showcaseConfig.js`
- Add `academy: '/thumbnails/studios/academy.webp'` to `studioThumbnails` (use fallback if asset missing)

---

## Phase 5 — Fix Empty/Failed Landing Section

### `src/components/landing/sections/FeaturesSection.jsx`
- Fix categories resolution:
  ```js
  const resolvedCategories = categories && Object.keys(categories).length
    ? categories
    : defaultCategories;
  ```
- Render `resolvedCategories` instead of `categories`
- Verify section visibly displays feature categories when called with no props

### Audit all lazy-loaded landing sections:
- Verify valid import paths
- Verify correct exports (default vs named)
- Verify returned HTMLElement
- Check for runtime exceptions
- Check for missing assets
- Check for chunk loading failures
- Ensure no section displays "Failed to load section"

Sections to audit:
- CinematicVideoHero
- HeroSection
- ScrollingAppStrip
- HookSection
- MinimaxWorkflowSection
- SixEnginesSection
- AppsGridSection
- MadeWithSmartVideo
- UGCDemoShowcase
- FeaturesSection
- AIVideoGallery
- AcademyVideoShowcase
- ShowcaseRepoVideo
- ProblemSection
- WorkflowSection
- ComparisonSection
- ValueStackSection
- AgencySection
- OfferSection
- FinalCTASection

---

## Phase 6 — Standardize Demo CTA Wording

### Rule:
- **VIDEO demos:** "Create This Type of Video"
- **IMAGE-specific cards:** Can use "Create This Style" if contextually appropriate
- **All other CTAs:** Standardize to "Create This Type of Video" for video showcase sections

### Files to modify:

#### `src/components/landing/sections/AIVideoGallery.jsx`
- Change `label: 'Create This Style'` to `label: 'Create This Type of Video'` in `createGalleryCard`

#### `src/components/landing/sections/MadeWithSmartVideo.jsx`
- Change `label: 'Create This Style'` to `label: 'Create This Type of Video'` in `createReelCard`

#### `src/components/landing/sections/ShowcaseRepoVideo.jsx`
- Change `label: 'Create This Style'` to `label: 'Create This Type of Video'` in `createGalleryCard`

#### `src/components/landing/sections/MinimaxWorkflowSection.jsx`
- Change `label: 'Create This Style'` to `label: 'Create This Type of Video'` in primary actions

#### `src/components/landing/sections/GTMBoostSection.jsx`
- Change `label: 'Create This Style'` to `label: 'Create This Type of Video'` in `createGtmResultCard`

#### `src/components/landing/sections/UGCDemoShowcase.jsx`
- Already uses "Create This Type of Video" — no change needed

#### `src/components/landing/sections/minimax/ui.js`
- Update `createStyleLink` default label from `'Create This Style'` to `'Create This Type of Video'`
- Allow image-specific cards to override with `'Create This Style'` if needed

---

## Phase 7 — Fix CTA Functionality

### Verify existing prefill/autogenerate flow:

#### `src/lib/studioPrefill.js`
- Already contains `stageStudioPrefill` with `autoGenerate` flag
- Already contains `consumeStudioPrefill` for reading staged payload
- No changes needed

#### `src/lib/exampleGalleryBridge.js`
- Already handles routing for minimax, seedance, zerolu, academy, youmind sources
- `handleCreateThisStyle` stages prefill and navigates
- No changes needed

#### `src/components/VideoStudio.js`
- Already imports `consumeStudioPrefill` (line 18)
- Already reads prefill on mount
- No changes needed

#### `src/components/landing/sections/minimax/ui.js`
- `createStyleLink` already calls `stageStudioPrefill` with `autoGenerate: Boolean(autoGenerate)`
- Already loads prompt via `loadPrompt` before staging
- Already navigates with `navigate(route, target.params)`
- No changes needed

### Verification:
- Test each source family: MiniMax, BeatAPI MiniMax, Seedance, ZeroLu, Academy
- Verify CTA click loads full prompt
- Verify correct studio/template is determined
- Verify `stageStudioPrefill` is called with correct payload
- Verify navigation occurs
- Verify destination studio receives prompt/model/template
- Verify `autoGenerate` flag triggers generation when set

---

## Phase 8 — Audit Unmerged Landing Work

### Open PRs/Branches touching landing:

#### PR #20 (branch: `reconcile-merge-main-into-develop`)
- **HEAD_SHA:** `e31457f9c`
- **AHEAD_OF_DEVELOP:** No (primary commit `65fe42bd0` is already ancestor of develop)
- **BEHIND_DEVELOP:** Yes
- **LANDING_FILES_CHANGED:** `src/lib/studioPrefill.js`, landing CTA sections
- **FUNCTIONALITY_ALREADY_PRESENT:** Yes (prefill/autogenerate is in develop)
- **MISSING_FROM_DEVELOP:** No
- **SAFE_TO_CHERRY_PICK:** NO (already merged)

#### Branch `fix/landing-historical-reconstruction-2026-09-29`
- **HEAD_SHA:** `fa61b2ffa`
- **AHEAD_OF_DEVELOP:** No (merged into develop at `55f66049d`)
- **BEHIND_DEVELOP:** No
- **LANDING_FILES_CHANGED:** DemosSection, demo components, thumbnails, app counts
- **FUNCTIONALITY_ALREADY_PRESENT:** Partially (demo removal is correct, thumbnail removal is regression)
- **MISSING_FROM_DEVELOP:** No
- **SAFE_TO_CHERRY_PICK:** NO (already merged, and parts need reversal)

### Other relevant branches:
- `feature/example-gallery-deep-links` — audit if it touches landing CTAs
- `feat/ai-creator-academy` — audit if it touches landing academy section

**Action:** Do NOT merge any branches wholesale. Cherry-pick only specific commits if needed.

---

## Phase 9 — Verify Current Landing Composition

### Final section ordering (from latest intentional commits):

1. `CinematicVideoHero` (if `ENABLE_CINEMATIC_HERO = true`)
2. `HeroSection`
3. `ScrollingAppStrip`
4. `HookSection`
5. `MinimaxWorkflowSection`
6. `SixEnginesSection`
7. `AppsGridSection`
8. `MadeWithSmartVideo`
9. `UGCDemoShowcase`
10. `FeaturesSection`
11. `AIVideoGallery`
12. `AcademyVideoShowcase`
13. `ShowcaseRepoVideo`
14. `ProblemSection`
15. `WorkflowSection`
16. `ComparisonSection`
17. `ValueStackSection`
18. `AgencySection`
19. `OfferSection`
20. `FinalCTASection`

**DemosSection is NOT in this list.** It must remain removed.

---

## Phase 10 — Test

### Commands:
```bash
npm install --include=optional
npm run typecheck
npm run build
```

### Landing tests:
- Run existing landing page tests
- Run example-gallery tests
- Run CTA/prefill tests

### Regression coverage to add:
- Exactly 34 canonical unique apps
- No duplicate logical apps
- FeaturesSection renders defaults when called with no categories
- Removed mock DemosSection stays removed
- Thumbnails present on app cards and section cards
- CTA labels standardized to "Create This Type of Video"
- Each CTA stages correct prefill
- "Create This Type of Video" performs expected navigation/generation
- All landing lazy imports resolve
- ScrollingAppStrip has exactly 34 unique visible apps (clones are aria-hidden)

### Browser/Playwright test:
- Scroll ENTIRE page
- Verify every section becomes visible
- Verify no "Failed to load section" errors

---

## Phase 11 — Production Branch

### Steps:
1. Create repair branch from `origin/develop`:
   ```bash
   git checkout -b fix/landing-latest-intended-state origin/develop
   ```

2. Implement all fixes from Phases 2-9

3. Run verification (Phase 10)

4. Merge repair into develop:
   ```bash
   git checkout develop
   git merge fix/landing-latest-intended-state
   ```

5. **Do NOT merge main into develop again**
6. **Do NOT merge stale PR #20 wholesale**

---

## Phase 12 — Netlify

- Netlify production branch remains: `develop`
- After merge, verify Netlify deploys new develop SHA
- Verify production deployment shows:
  - `branch = develop`
  - `context = production`
  - `state = ready`
- Visually verify https://smartvid.app

---

## Final Report Template

```
STARTING_DEVELOP_SHA: 55f66049dceea90beecb7f95a1761c09434b7744
FINAL_DEVELOP_SHA: <after merge>
NETLIFY_PRODUCTION_SHA: <after deploy>
CANONICAL_APP_COUNT: 34
APP_PILL_DUPLICATION: FIXED
CANONICAL_34_APPS: [list of 34 app IDs]
THUMBNAILS_RESTORED: YES
OLD_MOCK_DEMOS_REMOVED: YES
FEATURES_SECTION: PASS
ALL_LANDING_SECTIONS: PASS
FAILED_SECTION: none
CTA_STANDARD_TEXT: Create This Type of Video
CTA_PREFILL: PASS
CTA_NAVIGATION: PASS
CTA_AUTOGENERATE: PASS
UNMERGED_RELEVANT_COMMITS: [list]
STALE_BRANCHES_NOT_MERGED: [list]
BUILD: PASS
TYPECHECK: PASS
LANDING_TESTS: PASS
NETLIFY_DEPLOY: PASS
PRODUCTION_VISUAL_CERTIFICATION: PASS
```

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Adding `academy` to app catalog is seen as "inventing" | Academy is a real platform route (`/academy`) with a real landing showcase section (`AcademyVideoShowcase.jsx`) and sidebar entry |
| Thumbnail assets missing for restored sections | Use `SHOWCASE_CONFIG` fallback paths; verify assets exist before deploy |
| CTA prefill flow breaks for edge cases | Test all 5 source families (MiniMax, BeatAPI MiniMax, Seedance, ZeroLu, Academy) |
| ScrollingAppStrip CSS animation causes layout shift | Use `will-change-transform` and fixed-width clones |
| `FeaturesSection` default categories still render empty | Verify with React/component test that `resolvedCategories` is used |
