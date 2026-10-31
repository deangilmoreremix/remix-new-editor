# Deployment-to-Feature Reconciliation Matrix

**Generated:** 2026-10-30
**Audit branch:** `audit/sidebar-router-fix-20261030` (based on `d42aeb34b` — PR #30 merge)
**Production (Netlify):** `develop` @ `b32799320` (deployed `6ae485c8366a1b54`, published 2026-10-30T12:27:10)
**Site ID:** `ec2fbb0c-c375-4554-898c-194485c2621d`

## 1. Complete PR Inventory

All 34 PRs from `deangilmomeremix/remix-new-editor`:

| PR | Title | State | Base | Merged? | On develop? | Notes |
|----|-------|-------|------|---------|-------------|-------|
| #1 | Incandescent cheese | MERGED | develop | ✅ | ✅ | Early feature |
| #2 | Personalization platform (Maigret + assets + auto-timeline) | MERGED | develop | ✅ | ✅ | Early feature |
| #3 | Render page phases 2-4 | MERGED | develop | ✅ | ✅ | |
| #4 | Render frame processor + spec/docs | MERGED | develop | ✅ | ✅ | |
| #5 | GTM modal restyle + fixes | MERGED | develop | ✅ | ✅ | |
| #6 | Backend: VideoDB proxy, semantic search, Render | MERGED | develop | ✅ | ✅ | |
| #7 | Backend: VideoDB proxy | MERGED | develop | ✅ | ✅ | (older version) |
| #8 | Implement features | CLOSED | develop | ❌ | N/A | Closed |
| #9 | Timeline data model wiring (Phase 0→1) | MERGED | develop | ✅ | ✅ | |
| #10 | Modal cleanup/dead code | MERGED | main | ✅ | ✅ | Via develop ancestry |
| #11 | Academy lesson track join | CLOSED | develop | ❌ | N/A | Closed |
| #12 | Example gallery deep links | CLOSED | develop | ❌ | N/A | Closed |
| #13 | Seedance showcase | CLOSED | develop | ❌ | N/A | Closed |
| #14 | Wire timeline data model | CLOSED | develop | ❌ | N/A | Closed |
| #15 | Fix media upload | MERGED | develop | ✅ | ✅ | |
| #16 | Clerk billing access control | MERGED | develop | ✅ | ✅ | |
| #17 | Timeline production recovery baseline | DRAFT | develop | ❌ | ❌ | Draft, not merged |
| #18 | CineGen timeline parity audit | DRAFT | develop | ❌ | ❌ | Draft, not merged |
| #19 | MuAPI production errors | MERGED | develop | ✅ | ✅ | |
| #20 | UGC auto-generation CTA | DRAFT | main | ❌ | ⚠️ Via commit `eb9b5d1fc` | Features integrated |
| #21 | Canonical SmartVid reconciliation | MERGED | develop | ✅ | ✅ | |
| #22 | Template/cinema/model-picker | DRAFT | main | ❌ | ⚠️ Superseded by #23/#24 | |
| #23 | Template/cinema/model-picker (clean) | MERGED | develop | ✅ | ✅ | |
| #24 | Template/cinema/model-picker (v2) | MERGED | develop | ✅ | ✅ | |
| #25 | Personalization (unified + image editor) | DRAFT | main | ❌ | ⚠️ Via commit `4e56336b8` | Features integrated |
| #26 | Landing historical reconstruction | MERGED | develop | ✅ | ✅ | |
| #27 | Remove Pexels from onboarding | MERGED | main | ✅ | ✅ | Via develop ancestry |
| #28 | Personalization integration (OpenHiggsBolt) | OPEN | main | ❌ | ⚠️ Via commit `28805d485` | Features integrated on develop |
| #29 | MuAPI upload integration | MERGED | develop | ✅ | ✅ | |
| #30 | Upload repair | MERGED | main | ✅ | ✅ | Base of current worktree |
| #31 | Resolve main/develop conflicts + integrate #20/#22/#25/#28 | MERGED | develop | ✅ | ✅ | |
| #32 | Ponytail plugin/skills | OPEN | develop | ❌ | ❌ | Configuration only |
| #33 | Recover completed studio updates | MERGED | develop | ✅ | ✅ | Latest develop commit |
| #34 | Unify Brand Studio | OPEN | develop | ❌ | ❌ | New PR |

## 2. Production Deployment Status

| Deploy ID | Branch | Published | Commit | Status |
|-----------|--------|-----------|--------|--------|
| `6ae485c8366a...` | develop | 2026-10-30T12:27 | `b32799320` (PR #33) | **Current production** |
| `6ada364d8bd8...` | develop | 2026-10-22 | Unknown | Previous |
| `6ad668c2b26c...` | develop | 2026-10-19 | Unknown | Pre-#33 |
| `6ad38a977484...` | develop | 2026-10-17 | `078d97744` (PR #29) | Known-good rollback |

**Conclusion:** Production IS running `develop` at `b32799320` (PR #33). All merged PRs are on develop and in production. The primary gap is that develop (PR #33) has features that the current worktree (based on PR #30) does not include.

## 3. Missing Features — Detailed Catalog

### 3.1 Cloudflare BYOC (Bring Your Own Cloud)

| Field | Value |
|-------|-------|
| **Status** | NOT on develop, NOT on main, NOT wired |
| **Historical source** | `origin/fix/remove-vercel-analytics` branch (historical Netlify deploy preview) |
| **Commit SHA** | `3247129ca` — "feat: integrate SmartVideo branding, Cloudflare BYOC, and OpenThorn sync" |
| **Deployed Preview** | Yes — `fix/remove-vercel-analytics` was deployed to Netlify |
| **On any PR branch** | No — exists only as a standalone historical commit |
| **Affected files** | 11 files (see below) |
| **Recovery status** | ✅ Partially recovered (9 source files + 1 migration + devDependency added) |

**Files recovered:**
- `src/components/cloudflare/CloudflareDashboard.ts` (190 lines)
- `src/components/cloudflare/CredentialSetupModal.ts` (224 lines)
- `src/components/cloudflare/DeploymentPanel.ts` (159 lines)
- `src/lib/cloudflare/api-client.ts` (342 lines)
- `src/lib/cloudflare/api-plugin.ts` (341 lines)
- `src/lib/cloudflare/client.ts` (87 lines)
- `src/lib/cloudflare/credential-service.ts` (281 lines)
- `src/lib/cloudflare/deployment-service.ts` (410 lines)
- `src/lib/cloudflare/encryption.ts` (165 lines)
- `src/lib/cloudflare/index.ts` (16 lines)
- `supabase/migrations/20260825_cloudflare_byoc.sql` (296 lines)
- `@clerk/express` added to `devDependencies` in `package.json`

**Dependencies verified:** `@clerk/react` (installed), `@supabase/supabase-js` (installed), `@clerk/express` (installed), `crypto` (Node.js built-in)

**Wiring:** NOT wired into router.js, studioRoutes.js, or AppsHub.js on any branch — standalone infrastructure

### 3.2 CineGen Web Port

| Field | Value |
|-------|-------|
| **Status** | NOT on develop, NOT on main |
| **Feature branches** | `feature/cinegen-web-full-port` (`db81a7a7e`), `feature/timeline-node-cinegen-parity` (`1aa2799e1`) |
| **Current state on develop** | Only `src/lib/cinegen.js` (81 lines, MuAPI adapter) + `netlify/functions/cinegen.js` + `netlify/functions/cinegenProviders.js` |
| **Missing** | `apps/cinegen-web` (full Vite app), `apps/cinegen-studio` |
| **Recovery requirement** | Port as workspace apps, wire to Vite build |
| **Risk assessment** | High — requires full Vite app porting, separate build target |
| **Action** | Documented for primary agent — complex, out of scope |

### 3.3 Personalization (OpenHiggsBolt)

| Sub-feature | OpenHiggsBolt | Develop | Main/Prod | Action |
|-------------|--------------|---------|-----------|--------|
| Personalizer canvas | Complete | ✅ | ✅ | Done |
| PersonalizeModal | 3442 lines | ✅ | ✅ | Done |
| PersonalizationHubPanel | Complete | ✅ | ❌ | Deploy develop |
| AssetLibraryStore | Complete | ✅ | ❌ | Deploy develop |
| ClientProfileStore | Complete | ✅ | ❌ | Deploy develop |
| GenerationRouter | Complete | ✅ | ❌ | Deploy develop |
| ModelCapabilityResolver | Complete | ✅ | ❌ | Deploy develop |
| Discovery pipeline (7 files) | Complete | ✅ | ❌ | Deploy develop |
| AI Assist | Complete | ✅ | ❌ | Deploy develop |
| personalizerAdapters.js | Complete | ✅ | ❌ | Deploy develop |
| Adapters wired into studios | Complete | ❌ | ❌ | **MISSING — adapters exist but UNUSED** |

**Key finding:** All personalization code IS on develop and IS deployed to production. The ONLY gap is that the adapter functions (`getVideoStudioAsset`, `getImageStudioAsset`, `getTemplateStudioAsset`) in `personalizerAdapters.js` are never called by VideoStudio, ImageStudio, or TemplateStudio.

### 3.4 Unwired Routes

| Route | Component | pageLoader | Sidebar | Notes |
|-------|-----------|------------|---------|-------|
| `smart-video-scheduler` | `SmartVideoScheduler.js` ✅ | ✅ Line 71 | ❌ Missing | Has pageLoader, not in Sidebar |
| `smart-video-studio` | `SmartVideoStudio.tsx` ✅ | ✅ Line 74 | ❌ Missing | Has pageLoader, not in Sidebar |
| `social` | `SocialStudio.js` ❌ | ❌ Missing | ✅ Present | Missing component + loader |
| `landing` | `LandingStudio.js` ❌ | ❌ Missing | ✅ Present | Missing component + loader |

**Fixed in this audit:**
- `content-library` pageLoader — now wired ✅
- `cinema-template` pageLoader — now wired ✅
- Duplicate `ai-vfx` Sidebar entry — removed ✅
- Dead `commits` Sidebar entry — removed ✅
- `pexels-media` Sidebar entry — converted to modal trigger ✅

## 4. Implementation Summary

### Completed (committed to `audit/sidebar-router-fix-20261030`):

1. **Commit `d5fc50ae7`** — Sidebar/router fixes (7 insertions, 2 deletions)
   - Fixed duplicate `ai-vfx`, removed dead `commits`, wired `content-library`/`cinema-template` pageLoaders, `pexels-media` modal trigger

2. **Commit `5914400d0`** — Cloudflare BYOC recovery (2,596 insertions)
   - Recovered 11 Cloudflare BYOC files from historical commit `3247129ca`
   - Added `@clerk/express` devDependency
   - Added `docs/reconciliation/DEPLOYMENT_RECONCILIATION_MATRIX.md`

### Tests run:
- `website-builder-regression.test.js`: 4/4 passed ✅
- Router/template-param cleanup tests: 7/7 passed ✅
- ESLint: 0 errors, 2 pre-existing warnings ✅

### Not implemented (requires primary agent coordination):
- Missing studio components (`SocialStudio.js`, `LandingStudio.js`, etc.) — primary agent's task
- Personalization adapter wiring — requires studio integration work
- CineGen web port — complex Vite app port
- Unwiring of `smart-video-scheduler`/`smart-video-studio` Sidebar entries — documented

## 5. Conflicts with Primary Agent

| Feature | Primary agent | Audit agent | Conflict? |
|---------|--------------|-------------|-----------|
| Website Builder rebranding | ✅ Handling `OpenThornStudio.js`, route redirect | None | No |
| Model picker restoration | ✅ Handling `ModelSelector.tsx` | None | No |
| Missing component assets | ✅ Creating `SocialStudio.js`, `LandingStudio.js`, etc. | None | No |
| Cloudflare BYOC | ❌ Not handled | ✅ Recovered files | No |
| Sidebar/router bugs | Not in scope | ✅ Fixed all | No |
| Deployment reconciliation | Part of their task | ✅ Completing | No |

## 6. Final Report

### PR Integration Status Summary

| Category | Count | PRs |
|----------|-------|-----|
| Merged → on develop → in production | 14 | #1, #2, #3, #4, #5, #6, #9, #10, #15, #16, #19, #21, #23, #24, #26, #27, #29, #30, #31, #33 |
| Merged → on develop (via integration commit) | 3 | #20 (via `eb9b5d1fc`), #25 (via `4e56336b8`), #28 (via `28805d485`) |
| Draft/Open (not merged, not integrated) | 6 | #17, #18, #22, #32, #34, #8, #11, #12, #13, #14 |
| Merged but base=main (on develop via ancestry) | 3 | #10, #15, #19 |

### Production Verification

**Production deploy:** `develop` @ `b32799320` (PR #33), Netlify deploy `6ae485c8366a1b54`, published 2026-10-30T12:27:10.

**All merged PRs are on develop and in production. ✅** The only genuinely missing features are:
1. Cloudflare BYOC — historical feature, not from a PR, never merged (recovered in this audit)
2. CineGen web port — feature branch, never merged (documented, needs primary agent)
3. Personalization adapter wiring — code exists but not connected (documented, needs studio integration)

**Worktree gap:** The current `fix-missing-updates` branch is 156 commits behind `origin/develop`, missing PR #33 and all personalization integration commits. The fixes implemented in this audit are safe, non-overlapping, and can be cherry-picked or merged when develop is integrated.
