# Timeline Studio — Modal Parity Audit

**Branch:** `reconcile/timeline-studio`
**Date:** 2026-09-01
**Status:** IN PROGRESS

## Inventory of Current Modals

| # | Modal | File | Lines | Status |
|---|-------|------|-------|--------|
| 1 | TemplateGeneratorModal | `src/components/modals/TemplateGeneratorModal.jsx` | 126 | **SHELL** — Yes/No dialog only |
| 2 | TemplatePreviewModal | `src/components/modals/TemplatePreviewModal.jsx` | 207 | NEEDS AUDIT |
| 3 | PersonalizeModal | `src/components/modals/PersonalizeModal.jsx` | 3428 | LARGE — needs audit |
| 4 | ContactImporterModal | `src/components/modals/ContactImporterModal.jsx` | 475 | NEEDS AUDIT |
| 5 | LeadGeneratorModal | `src/components/modals/LeadGeneratorModal.jsx` | 219 | NEEDS AUDIT |
| 6 | RecorderModal | `src/components/modals/RecorderModal.jsx` | 507 | NEEDS AUDIT |
| 7 | EnhancedRecorderModal | `src/components/modals/EnhancedRecorderModal.jsx` | 458 | NEEDS AUDIT |
| 8 | UrlVideoModal | `src/components/modals/UrlVideoModal.jsx` | 177 | NEEDS AUDIT |
| 9 | PageShotModal | `src/components/modals/PageShotModal.jsx` | 359 | NEEDS AUDIT |
| 10 | EndScreenModal | `src/components/modals/EndScreenModal.jsx` | 497 | NEEDS AUDIT |
| 11 | PreviewMediaModal | `src/components/modals/PreviewMediaModal.jsx` | 352 | NEEDS AUDIT |
| 12 | VideoPlayerModal | `src/components/modals/VideoPlayerModal.jsx` | 61 | LIKELY SHELL |
| 13 | VoiceModal | `src/components/modals/VoiceModal.js` | 443 | NEEDS AUDIT |
| 14 | AIVideoCreator | `src/components/modals/AIVideoCreator.jsx` | 220 | NEEDS AUDIT |
| 15 | VideoPersonalizationHub | `src/components/modals/VideoPersonalizationHub.jsx` | 580 | NEEDS AUDIT |
| 16 | LandingPageBuilder | `src/components/modals/LandingPageBuilder.jsx` | 962 | NEEDS AUDIT |
| 17 | SocialPublisherModal | `src/components/modals/SocialPublisherModal.jsx` | 587 | NEEDS AUDIT |
| 18 | EmailCampaignModal | `src/components/modals/EmailCampaignModal.jsx` | 435 | NEEDS AUDIT |
| 19 | SaveProjectModal | `src/components/modals/SaveProjectModal.jsx` | 290 | NEEDS AUDIT |
| 20 | SettingsModal | `src/components/modals/SettingsModal.jsx` | 774 | NEEDS AUDIT |
| 21 | ConnectModal | `src/components/modals/ConnectModal.jsx` | 270 | NEEDS AUDIT |
| 22 | AICaptionsModal | `src/components/modals/AICaptionsModal.jsx` | — | NEEDS AUDIT |
| 23 | FillGapModal | `src/components/modals/FillGapModal.jsx` | — | NEEDS AUDIT |
| 24 | ExtendModal | `src/components/modals/ExtendModal.jsx` | — | NEEDS AUDIT |
| 25 | MusicGenerationModal | `src/components/modals/MusicGenerationModal.jsx` | — | NEEDS AUDIT |
| 26 | GTMInfoModal | `src/components/modals/GTMInfoModal.jsx` | — | NEEDS AUDIT |
| 27 | GTMPromptModal | `src/components/modals/GTMPromptModal.jsx` | — | NEEDS AUDIT |
| 28 | MonetizationHubModal | `src/components/modals/MonetizationHubModal.jsx` | — | NEEDS AUDIT |
| 29 | ModelPickerModal | `src/components/modals/ModelPickerModal.jsx` | — | NEEDS AUDIT |
| 30 | RecipeModal | `src/components/modals/RecipeModal.jsx` | — | NEEDS AUDIT |
| 31 | TemplateThumbnailModal | `src/components/modals/TemplateThumbnailModal.jsx` | — | NEEDS AUDIT |
| 32 | PromptGalleryModal | `src/components/modals/PromptGalleryModal.jsx` | — | NEEDS AUDIT |

## Intentionally Retired (DO NOT RECOVER)

- Image LT Presets
- Image Cropper
- Pixo Image Editor
- IMG.LY Image Editor
- Advanced Image Editor

## Shells Discovered

### TemplateGeneratorModal — CONFIRMED SHELL
- **Current state:** 126 lines, only renders "Do you want to use the Video Automation Creator?" with Yes/No buttons
- **Missing:** All 9 steps of the template generation workflow (Niche → Script → Template → Media → Overlays → Voice → Personalization → Preview → Add to Timeline)
- **Required:** Complete rebuild as multi-step workflow

## Next Steps

1. Complete per-modal audit (read each modal, classify status)
2. Build Timeline integration layer (`addAsset`, `addClip`, etc.)
3. Wave 1: Rebuild TemplateGeneratorModal as full workflow
