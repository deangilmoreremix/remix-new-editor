# Personalization modal parity matrix (OpenHiggsBolt -> remix-new-editor)

Generated from `diff` of `OpenHiggsBolt/src/shared/personalization` against `src/features/personalization/shared/personalization`.
Status: MISSING = not in remix; DRIFTED = differs (value = changed lines); IDENTICAL = byte-equal. The Port column is updated as work lands.

Decisions: keep the remix palette/tokens; port OHB features and code; full stack (front-end, routes, migrations written but not applied live).

## Core files (templates and tests excluded)

| Status | File | Changed lines | Port |
|---|---|---|---|
| MISSING | `advanced/AdvancedWorkspace.tsx` | - | ported |
| MISSING | `advanced/FullBodyRecastPanel.tsx` | - | ported |
| MISSING | `advanced/ReadinessChecklist.tsx` | - | ported |
| MISSING | `businessContentFromResearch.ts` | - | ported |
| MISSING | `guided/AssetUsagePanel.tsx` | - | ported |
| MISSING | `guided/DesignLayerPlayer.tsx` | - | ported |
| MISSING | `guided/DesignRecommendations.tsx` | - | ported |
| MISSING | `guided/ImageStyleControls.tsx` | - | ported |
| MISSING | `guided/LayoutQualityPanel.tsx` | - | ported |
| MISSING | `guided/RecastOption.tsx` | - | ported |
| MISSING | `guided/useLayoutQuality.ts` | - | ported |
| MISSING | `preview/StyledBusinessImage.tsx` | - | ported |
| MISSING | `preview/assetUsage.ts` | - | ported |
| MISSING | `preview/endCard.ts` | - | ported |
| MISSING | `preview/fitSettingsToClip.ts` | - | ported |
| MISSING | `preview/imageHintsLoader.ts` | - | ported |
| MISSING | `preview/imagePixels.ts` | - | ported |
| MISSING | `preview/imagePresets.ts` | - | ported |
| MISSING | `preview/imageStyle.ts` | - | ported |
| MISSING | `preview/layerContent.ts` | - | ported |
| MISSING | `preview/mediaRoles.ts` | - | ported |
| MISSING | `preview/placement/buildInput.ts` | - | ported |
| MISSING | `preview/placement/engine.ts` | - | ported |
| MISSING | `preview/placement/frameSampler.ts` | - | ported |
| MISSING | `preview/placement/geometry.ts` | - | ported |
| MISSING | `preview/placement/index.ts` | - | ported |
| MISSING | `preview/placement/quality.ts` | - | ported |
| MISSING | `preview/placement/restore.ts` | - | ported |
| MISSING | `preview/placement/types.ts` | - | ported |
| MISSING | `preview/remoteMedia.ts` | - | ported |
| MISSING | `preview/sourceProfile.ts` | - | ported |
| MISSING | `recast/recastJob.ts` | - | ported |
| MISSING | `recast/useRecastJob.ts` | - | ported |
| MISSING | `researchHelpers.ts` | - | ported |
| MISSING | `websiteClassification.ts` | - | ported |
| DRIFTED | `PersonalizationModal.tsx` | 2033 | ported |
| DRIFTED | `DemoPersonalizeProvider.tsx` | 1824 | ported |
| DRIFTED | `guided/PersonalizationTemplateBrowser.tsx` | 659 | ported |
| DRIFTED | `image-editor/ImageEditorModal.tsx` | 273 | ported |
| DRIFTED | `guided/OverlayEditor.tsx` | 259 | ported |
| DRIFTED | `preview/presets.ts` | 254 | ported |
| DRIFTED | `preview/PersonalizationComposition.tsx` | 172 | ported |
| DRIFTED | `modelCapabilityResolver.ts` | 111 | ported |
| DRIFTED | `guided/StepPreviewApprove.tsx` | 105 | ported |
| DRIFTED | `generationRouter.ts` | 99 | ported |
| DRIFTED | `preview/types.ts` | 65 | ported |
| DRIFTED | `ai/AIAssistPanel.tsx` | 58 | ported |
| DRIFTED | `ai/toolExecutor.ts` | 50 | ported |
| DRIFTED | `guided/tokens.ts` | 49 | ported |
| DRIFTED | `guided/buildPreviewInput.ts` | 46 | ported |
| DRIFTED | `preview/BeforeAfterPreview.tsx` | 43 | ported |
| DRIFTED | `DiscoveredAssetGrid.tsx` | 40 | ported |
| DRIFTED | `guided/StepFindBusiness.tsx` | 39 | ported |
| DRIFTED | `guided/TemplateBrowser.tsx` | 39 | ported |
| DRIFTED | `preview/designSlots.ts` | 39 | ported |
| DRIFTED | `guided/StepPersonalize.tsx` | 31 | ported |
| DRIFTED | `sharedMedia.ts` | 31 | ported |
| DRIFTED | `guided/overlayGeometry.ts` | 28 | ported |
| DRIFTED | `preview/PersonalizationPlayer.tsx` | 26 | ported |
| DRIFTED | `types.ts` | 23 | ported |
| DRIFTED | `postProcessor.ts` | 22 | ported |
| DRIFTED | `guided/StepChooseVideo.tsx` | 18 | ported |
| DRIFTED | `image-editor/MaskEditor.tsx` | 18 | ported |
| DRIFTED | `assetUploadService.ts` | 16 | ported |
| DRIFTED | `ownershipBadge.ts` | 14 | ported |
| DRIFTED | `openaiPersonalizationClient.ts` | 11 | ported |
| DRIFTED | `promptPersonalizer.ts` | 10 | ported |
| DRIFTED | `ai/contextProvider.ts` | 8 | ported |
| DRIFTED | `demoSources.ts` | 8 | ported |
| DRIFTED | `supabaseProjectPersistence.ts` | 7 | ported |
| DRIFTED | `guided/demoCategories.ts` | 6 | ported |
| DRIFTED | `sourceNormalizer.ts` | 6 | ported |
| DRIFTED | `guided/curatedDemos.ts` | 4 | ported |
| DRIFTED | `ai/responseBuilder.ts` | 2 | ported |
| DRIFTED | `guided/SimpleModeWizard.tsx` | 2 | ported |
| DRIFTED | `image-editor/imageEditApi.ts` | 2 | ported |
| DRIFTED | `imageLoadProbe.ts` | 1 | ported |

Identical already (33 files): ResumeProjectBanner.tsx, ai/index.ts, ai/toolRegistry.ts, ai/types.ts, aiAssist/toolRegistry.ts, alphaVerification.ts, businessNiches.ts, clientAssets.ts, clientProfile.ts, editedAssetPersistence.ts, finalOutput.ts, guided/AudioTrackPicker.tsx, guided/CardPreviewVideo.tsx, guided/DemoGalleryControls.tsx, guided/audioTrack.ts, guided/index.ts, image-editor/batchVideoReady.ts, image-editor/imageEditRegistry.ts, image-editor/imageEditSupport.ts, image-editor/normalizeImage.ts, image-editor/responsesVisionApi.ts, index.ts, leadStages.ts, preview/PreviewControls.tsx, preview/index.ts, preview/previewAssets.ts, preview/previewMediaEvents.ts, projectRestore.ts, studioEntry.ts, supabaseGeneratedVideos.ts, supabaseSharedMedia.ts, urlNormalizer.ts, webExport.ts

## Templates

OHB `templates/`: 313 files; remix: 61 files.

## Backend routes (`netlify/functions/_personalization/app/api`)

| Route | Status |
|---|---|
| `demo/discover/route.ts` | DRIFTED (17 lines) |
| `media/remote/route.ts` | MISSING |
| `media/shotcraft/[styleKey]/route.ts` | DRIFTED (2 lines) |
| `personalization/discover-assets/route.ts` | DRIFTED (20 lines) |
| `personalization/discover-assets/status/route.ts` | DRIFTED (10 lines) |
| `personalization/download-image/route.ts` | DRIFTED (12 lines) |
| `personalization/find-businesses/route.ts` | DRIFTED (14 lines) |
| `personalization/image-analyze/route.ts` | DRIFTED (12 lines) |
| `personalization/image-edit/route.ts` | DRIFTED (10 lines) |
| `personalization/image-smart-edit/route.ts` | DRIFTED (8 lines) |
| `personalization/leads/[id]/route.ts` | DRIFTED (14 lines) |
| `personalization/leads/route.ts` | DRIFTED (16 lines) |
| `personalization/persist-edited-asset/route.ts` | MISSING |
| `personalization/project/route.ts` | DRIFTED (32 lines) |
| `personalization/record/route.ts` | DRIFTED (10 lines) |
| `personalization/research-business/route.ts` | DRIFTED (10 lines) |
| `personalization/resolve-website/route.ts` | MISSING |
| `v1/[...slug]/route.ts` | MISSING |
| `v1/upload_file/route.ts` | DRIFTED (19 lines) |
| `video/record/route.ts` | MISSING |

## Supabase migrations

Correction to the first audit: remix does not lack these by content. The consolidated
`20261102000000_lead_finder_personalization.sql` already defines `personalization_saved_projects` (+ `_list`, `_get`,
`_upsert`, `_delete`, `_list_by_source`), `personalization_demo_discovery_limits` / `_cache` and their RPCs
(including the `pz_demo_limits_request_count_non_negative` constraint), `lead_finder_leads` + RPCs,
`smartvideo_go_personalization_outputs` and the owner policies. Matching by file name overstated the gap.

| OHB migration | Status |
|---|---|
| `20260905000000_create_personalization_outputs` | present (`20261012000000_...`) |
| `20260919000000_create_smartvideo_go_personalization_outputs` | present (consolidated) |
| `20260928000000_create_personalization_discovery_jobs` | present (`20261013000000_...`) |
| `20261010160100_personalization_projects_owner_rls` | present (consolidated policies) |
| `20261013000000_personalization_saved_projects`, `20261024000000_..._list_by_source` | present (consolidated) |
| `20261014000000_demo_discovery_limits`, `20261014010000_pz_demo_constraint_name` | present (consolidated) |
| `20261021000000_lead_finder_leads` | present (consolidated) |
| `20261031000000_generated_videos` | **added** as `20261112120000_generated_videos.sql` (not applied to any database) |

## Intentional remix divergences (allow-list)

- Remix palette and tokens (`guided/tokens.ts`, `--cyan:#d9ff00`, `--bg:#050505`).
- `@ohb/...` import aliases and remix glue: `mount.jsx`, `lib/apiAuth.ts`, `SocialPublishContext` bridge, studio-id maps, `hashchange` auto-close.
- `renderStrongMarkup`, `mergeIntoClientLibrary`, `importDiscoveredAssets(options)`; Motion Director integration.

## Baseline (before port)

`npx vitest run src/features/personalization`: 131 files, 1199 passed, 1 failed, 8 skipped, 13 unhandled rejections ("Durable storage is not configured").
Pre-existing failure: `apps/motion-director/__tests__/legacyCards.test.ts` (retired recipes textures) - unrelated to the modal.

## Port status (after the port)

- Front-end: all 35 missing core files and the template tree added; 42 drifted files merged (three-way, base = closest OHB
  revision); provider and modal keep the remix palette, `renderStrongMarkup`, session guards and OpenAI/MuAPI key gating.
- Backend: `src/server` refreshed from OHB (remix `createRequire` kept in `browserDiscovery.ts`); new routes
  `personalization/resolve-website`, `media/remote` and a real `video/record` (replaces the acknowledge-only stub).
  Not ported on purpose: `v1/[...slug]` (entitlement-gated; remix serves the MuAPI proxy through `api/api/v1`),
  Stripe / design-agent / access routes and their tests.
- Vendored studio package: `muapi.js` merged (adds `resumeGeneration`, keeps remix Clerk upload auth); `lib/assetStore.js`
  added as a no-op shim because remix already stores originals (`personalization-assets`) and approved results (Asset Library).
- Verification: personalization suite 2128 tests (2117 pass, 10 skipped, 1 pre-existing `legacyCards` failure); server suite
  572/572; `vite build` succeeds; scoped `tsc` at baseline (+3 `.js` declaration warnings).
- Skipped tests (documented in-file): jsdom 27 limits (image load, Blob/Response, computed CSS) - re-enable after a jsdom upgrade.
