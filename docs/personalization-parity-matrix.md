# Personalization modal parity matrix (OpenHiggsBolt -> remix-new-editor)

Generated from `diff` of `OpenHiggsBolt/src/shared/personalization` against `src/features/personalization/shared/personalization`.
Status: MISSING = not in remix; DRIFTED = differs (value = changed lines); IDENTICAL = byte-equal. The Port column is updated as work lands.

Decisions: keep the remix palette/tokens; port OHB features and code; full stack (front-end, routes, migrations written but not applied live).

## Core files (templates and tests excluded)

| Status | File | Changed lines | Port |
|---|---|---|---|
| MISSING | `advanced/AdvancedWorkspace.tsx` | - | todo |
| MISSING | `advanced/FullBodyRecastPanel.tsx` | - | todo |
| MISSING | `advanced/ReadinessChecklist.tsx` | - | todo |
| MISSING | `businessContentFromResearch.ts` | - | todo |
| MISSING | `guided/AssetUsagePanel.tsx` | - | todo |
| MISSING | `guided/DesignLayerPlayer.tsx` | - | todo |
| MISSING | `guided/DesignRecommendations.tsx` | - | todo |
| MISSING | `guided/ImageStyleControls.tsx` | - | todo |
| MISSING | `guided/LayoutQualityPanel.tsx` | - | todo |
| MISSING | `guided/RecastOption.tsx` | - | todo |
| MISSING | `guided/useLayoutQuality.ts` | - | todo |
| MISSING | `preview/StyledBusinessImage.tsx` | - | todo |
| MISSING | `preview/assetUsage.ts` | - | todo |
| MISSING | `preview/endCard.ts` | - | todo |
| MISSING | `preview/fitSettingsToClip.ts` | - | todo |
| MISSING | `preview/imageHintsLoader.ts` | - | todo |
| MISSING | `preview/imagePixels.ts` | - | todo |
| MISSING | `preview/imagePresets.ts` | - | todo |
| MISSING | `preview/imageStyle.ts` | - | todo |
| MISSING | `preview/layerContent.ts` | - | todo |
| MISSING | `preview/mediaRoles.ts` | - | todo |
| MISSING | `preview/placement/buildInput.ts` | - | todo |
| MISSING | `preview/placement/engine.ts` | - | todo |
| MISSING | `preview/placement/frameSampler.ts` | - | todo |
| MISSING | `preview/placement/geometry.ts` | - | todo |
| MISSING | `preview/placement/index.ts` | - | todo |
| MISSING | `preview/placement/quality.ts` | - | todo |
| MISSING | `preview/placement/restore.ts` | - | todo |
| MISSING | `preview/placement/types.ts` | - | todo |
| MISSING | `preview/remoteMedia.ts` | - | todo |
| MISSING | `preview/sourceProfile.ts` | - | todo |
| MISSING | `recast/recastJob.ts` | - | todo |
| MISSING | `recast/useRecastJob.ts` | - | todo |
| MISSING | `researchHelpers.ts` | - | todo |
| MISSING | `websiteClassification.ts` | - | todo |
| DRIFTED | `PersonalizationModal.tsx` | 2033 | todo |
| DRIFTED | `DemoPersonalizeProvider.tsx` | 1824 | todo |
| DRIFTED | `guided/PersonalizationTemplateBrowser.tsx` | 659 | todo |
| DRIFTED | `image-editor/ImageEditorModal.tsx` | 273 | todo |
| DRIFTED | `guided/OverlayEditor.tsx` | 259 | todo |
| DRIFTED | `preview/presets.ts` | 254 | todo |
| DRIFTED | `preview/PersonalizationComposition.tsx` | 172 | todo |
| DRIFTED | `modelCapabilityResolver.ts` | 111 | todo |
| DRIFTED | `guided/StepPreviewApprove.tsx` | 105 | todo |
| DRIFTED | `generationRouter.ts` | 99 | todo |
| DRIFTED | `preview/types.ts` | 65 | todo |
| DRIFTED | `ai/AIAssistPanel.tsx` | 58 | todo |
| DRIFTED | `ai/toolExecutor.ts` | 50 | todo |
| DRIFTED | `guided/tokens.ts` | 49 | todo |
| DRIFTED | `guided/buildPreviewInput.ts` | 46 | todo |
| DRIFTED | `preview/BeforeAfterPreview.tsx` | 43 | todo |
| DRIFTED | `DiscoveredAssetGrid.tsx` | 40 | todo |
| DRIFTED | `guided/StepFindBusiness.tsx` | 39 | todo |
| DRIFTED | `guided/TemplateBrowser.tsx` | 39 | todo |
| DRIFTED | `preview/designSlots.ts` | 39 | todo |
| DRIFTED | `guided/StepPersonalize.tsx` | 31 | todo |
| DRIFTED | `sharedMedia.ts` | 31 | todo |
| DRIFTED | `guided/overlayGeometry.ts` | 28 | todo |
| DRIFTED | `preview/PersonalizationPlayer.tsx` | 26 | todo |
| DRIFTED | `types.ts` | 23 | todo |
| DRIFTED | `postProcessor.ts` | 22 | todo |
| DRIFTED | `guided/StepChooseVideo.tsx` | 18 | todo |
| DRIFTED | `image-editor/MaskEditor.tsx` | 18 | todo |
| DRIFTED | `assetUploadService.ts` | 16 | todo |
| DRIFTED | `ownershipBadge.ts` | 14 | todo |
| DRIFTED | `openaiPersonalizationClient.ts` | 11 | todo |
| DRIFTED | `promptPersonalizer.ts` | 10 | todo |
| DRIFTED | `ai/contextProvider.ts` | 8 | todo |
| DRIFTED | `demoSources.ts` | 8 | todo |
| DRIFTED | `supabaseProjectPersistence.ts` | 7 | todo |
| DRIFTED | `guided/demoCategories.ts` | 6 | todo |
| DRIFTED | `sourceNormalizer.ts` | 6 | todo |
| DRIFTED | `guided/curatedDemos.ts` | 4 | todo |
| DRIFTED | `ai/responseBuilder.ts` | 2 | todo |
| DRIFTED | `guided/SimpleModeWizard.tsx` | 2 | todo |
| DRIFTED | `image-editor/imageEditApi.ts` | 2 | todo |
| DRIFTED | `imageLoadProbe.ts` | 1 | todo |

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

| OHB migration | Status |
|---|---|
| `20260905000000_create_personalization_outputs.sql` | present |
| `20260919000000_create_smartvideo_go_personalization_outputs.sql` | MISSING |
| `20260928000000_create_personalization_discovery_jobs.sql` | present |
| `20261010160100_personalization_projects_owner_rls.sql` | MISSING |
| `20261013000000_personalization_saved_projects.sql` | MISSING |
| `20261014000000_demo_discovery_limits.sql` | MISSING |
| `20261014010000_pz_demo_constraint_name.sql` | MISSING |
| `20261021000000_lead_finder_leads.sql` | MISSING |
| `20261024000000_personalization_saved_projects_list_by_source.sql` | MISSING |
| `20261031000000_generated_videos.sql` | MISSING |

## Intentional remix divergences (allow-list)

- Remix palette and tokens (`guided/tokens.ts`, `--cyan:#d9ff00`, `--bg:#050505`).
- `@ohb/...` import aliases and remix glue: `mount.jsx`, `lib/apiAuth.ts`, `SocialPublishContext` bridge, studio-id maps, `hashchange` auto-close.
- `renderStrongMarkup`, `mergeIntoClientLibrary`, `importDiscoveredAssets(options)`; Motion Director integration.

## Baseline (before port)

`npx vitest run src/features/personalization`: 131 files, 1199 passed, 1 failed, 8 skipped, 13 unhandled rejections ("Durable storage is not configured").
Pre-existing failure: `apps/motion-director/__tests__/legacyCards.test.ts` (retired recipes textures) - unrelated to the modal.
