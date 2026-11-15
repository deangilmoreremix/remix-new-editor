# Backfill inventory (draft, for review)

Generated from `src/lib/router.js`, `src/lib/studioRoutes.js`, `git log --merges` and `apps/*/README.md`.
Underscore-prefixed, so the index script ignores it. Delete once the backfill is done.

## 1. Routes -> components (62 routes, 57 components, all files exist)
Aliases share a row. Planned page = one per studio; `*-page` variants fold into their studio.

| Route(s) | Component | Exists |
|---|---|---|
| `#/timeline` | `src/cinegen/mount.tsx` | yes |
| `#/academy` | `src/components/academy/AcademyPage.jsx` | yes |
| `#/ai-vfx` | `src/components/AIVFXPage.js` | yes |
| `#/animate` | `src/components/AnimatePage.js` | yes |
| `#/apps` | `src/components/AppsHub.js` | yes |
| `#/asset-edit` | `src/components/AssetCanvasEditor.js` | yes |
| `#/audio` | `src/components/AudioStudio.js` | yes |
| `#/avatar` | `src/components/AvatarStudio.js` | yes |
| `#/brand-dna` | `src/components/BrandDnaEditor.js` | yes |
| `#/brand` | `src/components/BrandStudio.js` | yes |
| `#/campaign-page` | `src/components/CampaignPage.js` | yes |
| `#/campaign` | `src/components/CampaignWizard.js` | yes |
| `#/character-page` | `src/components/CharacterPage.js` | yes |
| `#/character` | `src/components/CharacterStudio.js` | yes |
| `#/cinema-page` | `src/components/CinemaPage.js` | yes |
| `#/cinema` | `src/components/CinemaStudio.js` | yes |
| `#/cinema-template` | `src/components/CinemaTemplateStudio.js` | yes |
| `#/commercial-page` | `src/components/CommercialPage.js` | yes |
| `#/commercial` | `src/components/CommercialStudio.js` | yes |
| `#/content-library` | `src/components/ContentLibraryPage.js` | yes |
| `#/director` | `src/components/DirectorPage.js` | yes |
| `#/edit` | `src/components/EditStudio.js` | yes |
| `#/effects-page` | `src/components/EffectsPage.js` | yes |
| `#/effects` | `src/components/EffectsStudio.js` | yes |
| `#/explore` | `src/components/ExplorePage.js` | yes |
| `#/find-my-brand` | `src/components/FindMyBrandPage.js` | yes |
| `#/image` | `src/components/ImageStudio.js` | yes |
| `#/image-to-image` | `src/components/ImageToImagePage.js` | yes |
| `#/image-to-video` | `src/components/ImageToVideoPage.js` | yes |
| `#/influencer-page` | `src/components/InfluencerPage.js` | yes |
| `#/influencer` | `src/components/InfluencerStudio.js` | yes |
| `#/leadfinder` | `src/components/LeadFinderStudio.js` | yes |
| `#/library` | `src/components/LibraryPage.js` | yes |
| `#/lipsync` | `src/components/LipSyncStudio.js` | yes |
| `#/motion-director`, `#/motion-director/workbench` | `src/components/MotionDirectorPage.js` | yes |
| `#/website-builder` | `src/components/OpenThornStudio.js` | yes |
| `#/personalizer` | `src/components/Personalizer.js` | yes |
| `#/photo-studio`, `#/brand-photo-studio` | `src/components/PhotoStudioPage.js` | yes |
| `#/render` | `src/components/RenderPage.js` | yes |
| `#/smart-video-scheduler`, `#/brightbean` | `src/components/SmartVideoScheduler.js` | yes |
| `#/viral` | `src/components/SmartVideoViral.js` | yes |
| `#/storyboard-page` | `src/components/StoryboardPage.js` | yes |
| `#/storyboard` | `src/components/StoryboardStudio.js` | yes |
| `#/smart-video-studio` | `src/components/studios/SmartVideoStudio/SmartVideoStudio.tsx` | yes |
| `#/video-agent`, `#/video-agent-studio` | `src/components/studios/VideoAgentStudio/VideoAgentStudio.js` | yes |
| `#/workbench` | `src/components/studios/WorkbenchStudio/WorkbenchStudio.js` | yes |
| `#/zackd`, `#/zackd-studio` | `src/components/studios/ZackDStudio/ZackDStudio.js` | yes |
| `#/templates` | `src/components/TemplatesPage.js` | yes |
| `#/text-to-image` | `src/components/TextToImagePage.js` | yes |
| `#/text-to-video` | `src/components/TextToVideoPage.js` | yes |
| `#/timeline-classic` | `src/components/TimelineEditorPage.jsx` | yes |
| `#/upscale-page` | `src/components/UpscalePage.js` | yes |
| `#/upscale` | `src/components/UpscaleStudio.js` | yes |
| `#/video` | `src/components/VideoStudio.js` | yes |
| `#/videotools` | `src/components/VideoToolsStudio.js` | yes |
| `#/video-to-video` | `src/components/VideoToVideoPage.js` | yes |
| `#/video-watermark` | `src/components/VideoWatermarkPage.js` | yes |

Redirects and special cases in `router.js`:
- `#/cinegen` redirects to `#/workbench` (CineGen Studio was replaced by the Workbench).
- `#/timeline` is the CineGen-based editor (`src/cinegen/mount.tsx`); the previous editor stays at `#/timeline-classic`.
- Retired routes (land on a live page instead): `training` -> apps, `chat` -> apps, `assist` -> apps, `community` -> explore, `pexels-media` -> library. These get `status: deprecated` pages only if you want them recorded.
- `ChatStudio.js` exists in `src/components` but `chat` is retired.

## 2. Sub-apps in `apps/` (one page each)
| App | First line of its README |
|---|---|
| ai-vfx | AI-powered image-to-video visual effects |
| cinegen | Video editor with multi-track timeline, node workflows, LLM assistant (upstream CineGen) |
| director | (README is boilerplate, needs a read) |
| motion-agent | Remotion prompt-to-motion-graphics (backs `#/video-agent`) |
| openthorn | Free BYOK AI website builder (backs `#/website-builder`) |
| shotcraft | (no README; has `gallery/`, `workbench/`, `demos/`) |
| video-agent-studio | OpenChatCut (backs `#/video-agent-studio`) |
| vimax | (README is setup docs, needs a read) |

## 3. Features identified from merged PR titles (candidate pages)
| Candidate page | PR |
|---|---|
| Timeline Studio Editor (library, drag-and-drop, 4-track default) | #110 |
| Animations library (267 flag-gated, then on by default; placement controls) | #90, #107, #108 |
| Animations: 118 imported templates from three MIT repos | #111 |
| Timeline Projects, publishing, first-party analytics, retargeting, owner notifications | #113 |
| Analytics, Audience, Retarget, Alerts in the CineGen editor | #121 |
| Projects overview on home screen and Analytics tab | #125 |
| Asset Finder: on-device background removal | #130, #133 |
| Add-to-timeline modal + Template videos tab | #131, #139 |
| Stock media panel | merged with #124 (check) |
| Personalization (image, AI clips, analytics, finder) | #71-#77 |
| Studio banners | #87 |

## 4. Needs a closer look before naming
- Merges #80-#86 (branch `modest-goodall`), #96/#98/#101 (`lucid-cannon`), #105, #116, #118, #119, #136: titles are branch names only.
- `src/features/ask-smartvideo`, `src/features/personalization`, `src/modules/CineGen`: not in `router.js`, found via source tree.
