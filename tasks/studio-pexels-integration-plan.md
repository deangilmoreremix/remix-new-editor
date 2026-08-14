# Pexels Integration — Studio Audit & Design Implementation Plan

## 1. Studio Audit Summary

### 1.1 What already exists
- **Backend proxy**: `backend/services/pexelsProxyService.js` mounted at `/api/pexels` with search, curated, and detail endpoints for photos and videos.
- **Frontend page**: `src/components/PexelsMediaPage.js` provides a full-page Stock Media browser with preview modal, attribution, and import buttons.
- **Client helper**: `src/lib/pexelsApi.js` wraps `/api/pexels/*` with `sessionStorage` caching.
- **Local library**: `src/lib/pexelsLibrary.js` stores imported Pexels assets in `localStorage`.
- **Timeline bridge**: `src/lib/editor/pexelsIntegration.js` can inject Pexels assets into the timeline editor.
- **Settings**: `src/components/SettingsModal.js` includes a Pexels API Key form with Test Connection.
- **Sidebar entry**: `src/components/Sidebar.js` has a `Stock Media` nav item (`pexels-media`).
- **Router entry**: `src/lib/router.js` maps `pexels-media` → `PexelsMediaPage`.

### 1.2 Current limitations
- Pexels is only accessible as a **standalone page** (`/#/pexels-media`).
- No studio can directly consume Pexels media as a **reference/input source**.
- Import is limited to “Save to Pexels Library” or “Add to Timeline” (the latter depends on `window.__timelineState` being present).
- No inline Pexels browser inside any creation studio.
- No drag-and-drop or “Use as reference” flow from Pexels into Image/Video/Cinema/Edit studios.
- No B-roll / reference image / mood-board integration for Director/VideoAgent/Storyboard.

---

## 2. Design Principles

1. **Non-destructive**: Pexels assets are always referenced by URL; we never re-host or mutate them on our servers.
2. **Attribution-first**: Every studio that consumes a Pexels asset must surface photographer credit and a Pexels content link.
3. **Progressive enhancement**: Studios work exactly as before if Pexels is disabled or the key is missing.
4. **Shared primitive**: One reusable `PexelsBrowser` modal/panel, not 20 different implementations.
5. **Consistent UX**: Same preview, attribution, and import behavior everywhere.

---

## 3. Shared Primitive: `PexelsBrowser`

Create a reusable modal/panel component that any studio can open.

**File**: `src/components/PexelsBrowser.js` (new)

**Public API**:
```js
export function openPexelsBrowser({
  accept = ['image', 'video'],   // filter media types
  onSelect,                      // (asset) => void
  title = 'Stock Media',         // modal title
}) { ... }
```

**Behavior**:
- Opens a full-screen overlay (z-index 100) with the existing Pexels search grid, preview, and attribution.
- Hides the “Add to Timeline” / “Import to Project” buttons inside the preview when called from a studio; instead shows a single **“Use in <Studio Name>”** button.
- Calling `onSelect(asset)` closes the browser and returns the selected asset to the caller.
- Supports `escape` and backdrop click to cancel.

**Why a modal instead of inline?**
- Studios already have dense prompt bars and control rows. A full inline browser would require resizing/reflowing every studio.
- A modal preserves existing studio layouts and lets users search Pexels without losing their place.
- The modal can be reused by Timeline, Director, and all creation studios identically.

---

## 4. Per-Studio Integration Plan

### 4.1 Tier 1 — Direct Asset Input Studios (Highest Value)

These studios already accept uploaded images/videos as **input seeds** for generation. Pexels fits naturally as an alternative upload source.

#### 4.1.1 ImageStudio (`src/components/ImageStudio.js`)
**Current input mechanism**: `createUploadPicker` for image-to-image mode.

**Pexels integration**:
- Add a **“Browse Stock Photos”** button next to the upload picker trigger.
- Clicking it calls `openPexelsBrowser({ accept: ['image'], onSelect: (asset) => { ... } })`.
- On select: set `uploadedImageUrls = [asset.src]`, switch to `imageMode = true`, update model/AR controls.
- Attribution: show photographer name and Pexels link below the prompt bar when a Pexels image is active.

**UX flow**:
1. User clicks “Browse Stock Photos” (camera icon or “📷 Stock” button).
2. Pexels browser modal opens, pre-filtered to photos.
3. User searches, previews, clicks a photo.
4. Photo is injected into ImageStudio as the i2i reference image.
5. Attribution pill appears: “Reference: Photo by <name> on Pexels” with link.

#### 4.1.2 VideoStudio (`src/components/VideoStudio.js`)
**Current input mechanism**: Image picker for i2v, video file input for v2v.

**Pexels integration**:
- Add **“Browse Stock Videos”** button (for i2v seed) and **“Browse Stock Photos”** button (for v2v reference).
- For i2v: selecting a Pexels video sets `uploadedImageUrl = video.thumbnail` and switches to i2v mode (same as uploading a still).
- For v2v: selecting a Pexels video sets `uploadedVideoUrl = video.hd_link` and switches to v2v mode.
- Attribution: show source attribution for the selected seed.

**UX flow**:
1. User clicks “Browse Stock Videos”.
2. Pexels browser opens, filtered to videos.
3. User selects a video.
4. VideoStudio uses the video’s thumbnail as the i2v seed OR the video file itself as v2v input.
5. Attribution shown in the upload area.

#### 4.1.3 CinemaStudio (`src/components/CinemaStudio.js`)
**Current input mechanism**: `createUploadPicker` for reference scene image.

**Pexels integration**:
- Add **“Browse Reference Scene”** button next to the upload picker.
- Selecting a Pexels photo sets `currentSettings.referenceUrl = photo.src.large` and switches to i2v models.
- Attribution shown in the reference pill: “Reference scene from Pexels — Photo by <name>”.

**UX flow**:
1. User clicks “Browse Reference Scene”.
2. Pexels browser opens, filtered to photos.
3. User selects a cinematic photo.
4. CinemaStudio uses it as the i2v seed image.
5. Camera builder / prompt builder can now generate from that reference.

#### 4.1.4 EditStudio (`src/components/EditStudio.js`)
**Current input mechanism**: Upload picker for the image to edit.

**Pexels integration**:
- Add **“Browse Photos to Edit”** button.
- Selecting a Pexels photo sets `uploadedUrl = photo.src.large` and loads it into the edit tool.
- Attribution: show “Editing: Photo by <name> on Pexels”.

**UX flow**:
1. User opens EditStudio.
2. Clicks “Browse Photos to Edit”.
3. Selects a Pexels photo.
4. Photo loads into the editor.
5. User applies edit tools (remove bg, colorize, etc.).

---

### 4.2 Tier 2 — Timeline & Assembly Studios

#### 4.2.1 TimelineEditorPage (`src/components/TimelineEditorPage.jsx`)
**Current media ingestion**: `integrateMediaIngest` with `GiphyIntegration`, `StickersLibrary`, `LowerThirds`, `VideoGallery`, `AnimationList`.

**Pexels integration**:
- Add a **“Stock Media”** tab/button in the media library panel (alongside Upload, Giphy, etc.).
- Opens the `PexelsBrowser` in a panel mode (not full modal) docked in the media library sidebar.
- Drag-and-drop from Pexels browser directly onto timeline tracks.
- On drop: call `addMediaToTimeline` with the Pexels asset URL and attribution metadata.
- Attribution persists in the timeline clip metadata and is included in exports.

**UX flow**:
1. User opens Timeline Editor.
2. In the media library panel, clicks “Stock Media”.
3. Pexels browser panel slides out (or replaces the upload panel).
4. User searches, drags a photo/video onto a track.
5. Clip is added with attribution metadata.

#### 4.2.2 DirectorPage (`src/components/DirectorPage.js`)
**Current media ingestion**: Agents operate on uploaded videos or VideoDB-indexed content.

**Pexels integration**:
- Add **“Add B-Roll from Pexels”** action in the B-Roll Adder agent flow.
- When the B-Roll agent needs overlay footage, open `PexelsBrowser` filtered to relevant keywords (derived from the main video’s scenes).
- Selected assets are added as B-roll clips on overlay tracks.

**UX flow**:
1. User runs B-Roll Adder agent.
2. Agent suggests keywords based on main video scenes.
3. User can browse Pexels directly from the agent panel.
4. Selected clips become B-roll overlays.

#### 4.2.3 VideoAgentPage (`src/components/VideoAgentPage.js`)
**Current media ingestion**: Upload video URL/file for processing.

**Pexels integration**:
- Add **“Use Sample Video”** button in the upload area.
- Opens `PexelsBrowser` filtered to videos.
- Selected video URL is fed into the agent pipeline as the source video.

**UX flow**:
1. User opens VideoAgent.
2. Clicks “Use Sample Video” instead of uploading.
3. Browses Pexels videos.
4. Selected video becomes the agent’s input.

---

### 4.3 Tier 3 — Planning & Reference Studios

#### 4.3.1 StoryboardStudio (`src/components/StoryboardStudio.js`)
**Current input mechanism**: AI-generated frames from prompts.

**Pexels integration**:
- Add **“Reference Frame from Pexels”** button on each storyboard frame card.
- Opens `PexelsBrowser` filtered to photos.
- Selected photo is set as `frame.referenceImages[0]`.
- Attribution shown on the frame card.

**UX flow**:
1. User is planning a storyboard.
2. Clicks “Reference Frame” on a shot card.
3. Finds a matching photo on Pexels.
4. Photo becomes the visual reference for that shot.
5. When generating the storyboard frame, the AI can use the reference image.

#### 4.3.2 CharacterStudio (`src/components/CharacterStudio.js`)
**Current input mechanism**: Character generation from prompts/images.

**Pexels integration**:
- Add **“Browse Character References”** button.
- Pexels photos can be used as style/pose references for character generation.

#### 4.3.3 InfluencerStudio (`src/components/InfluencerStudio.js`)
**Current input mechanism**: Influencer-style content generation.

**Pexels integration**:
- Add **“Browse Backgrounds”** button.
- Pexels photos/videos used as background layers for influencer-style compositions.

#### 4.3.4 CommercialStudio (`src/components/CommercialStudio.js`)
**Current input mechanism**: Product/ad content generation.

**Pexels integration**:
- Add **“Browse Product Photos”** and **“Browse Lifestyle Photos”** buttons.
- Pexels images used as product shots or lifestyle backgrounds.

---

### 4.4 Tier 4 — Output/Enhancement Studios

#### 4.4.1 UpscaleStudio (`src/components/UpscaleStudio.js`)
**Current input mechanism**: Upload image to upscale.

**Pexels integration**:
- Add **“Browse Photos to Upscale”** button.
- Pexels photos can be upscaled directly.

#### 4.4.2 EffectsStudio (`src/components/EffectsStudio.js`)
**Current input mechanism**: Upload image/video for effects.

**Pexels integration**:
- Add **“Browse Photos/Video for Effects”** button.
- Pexels media can be loaded into the effects pipeline.

#### 4.4.3 LipSyncStudio (`src/components/LipSyncStudio.js`)
**Current input mechanism**: Upload video + audio.

**Pexels integration**:
- Add **“Browse Talking-Head Videos”** button.
- Pexels videos with people can be used as the lip-sync base.

#### 4.4.4 VideoToolsStudio (`src/components/VideoToolsStudio.js`)
**Current input mechanism**: Upload video for watermark/trim/etc.

**Pexels integration**:
- Add **“Browse Sample Videos”** button.
- Pexels videos can be processed with video tools.

---

### 4.5 Tier 5 — Lower Priority

#### 4.5.1 AudioStudio (`src/components/AudioStudio.js`)
Pexels is image/video-only. Minimal integration. Could show Pexels attribution in audio projects that use Pexels video as visual.

#### 4.5.2 TrainingStudio (`src/components/TrainingStudio.js`)
Not directly relevant unless training on Pexels-style imagery. Skip for v1.

#### 4.5.3 ChatStudio / AssistPage / CommunityPage
No direct media creation. No Pexels integration needed.

---

## 5. Unified Data Model

All studios should normalize Pexels assets to the same shape before consuming them.

```js
// Normalized Pexels asset (returned by PexelsBrowser onSelect)
{
  id: 'pexels-123456',          // Pexels photo/video ID
  type: 'image' | 'video',
  url: 'https://...',            // direct CDN URL for the asset
  thumbnail: 'https://...',      // small preview URL
  width: 1920,
  height: 1080,
  duration: 15,                  // video only, seconds
  photographer: 'John Doe',
  photographerUrl: 'https://...',
  pexelsUrl: 'https://...',      // original Pexels content page
  source: 'pexels',
  attribution: 'Photo by John Doe on Pexels',
}
```

**Storage**:
- **Transient use** (ImageStudio, VideoStudio, CinemaStudio, EditStudio, EffectsStudio, UpscaleStudio): asset lives in memory for the current generation session. No persistence needed.
- **Timeline / project use** (TimelineEditor, Director, Storyboard): asset metadata is persisted in the project state with `source: 'pexels'` and attribution fields.
- **Library use** (LibraryPage, ContentLibraryPage): asset is saved to `pexelsLibrary.js` / `contentLibrary` with attribution.

---

## 6. Attribution Strategy

### 6.1 In-studio attribution
Every studio that receives a Pexels asset shows a small, non-intrusive attribution chip:
```
📷 Photo by John Doe on Pexels
```
- Clicking the chip opens the Pexels content page in a new tab.
- The chip is positioned near the seed/reference image preview, not in the main prompt bar.

### 6.2 Timeline attribution
- Timeline clips sourced from Pexels display a small “Pexels” badge on the clip.
- Hovering the badge shows the photographer name.
- Export metadata includes `pexelsAttribution: [{ photographer, pexelsUrl }]`.

### 6.3 Export attribution
- When a project containing Pexels assets is exported (RenderPage), a Pexels credit line is appended:
  ```
  Media provided by Pexels (https://www.pexels.com)
  Photos by John Doe, Jane Smith
  ```
- This is controlled by a Settings toggle: “Include Pexels attribution in exports” (default: on).

---

## 7. Implementation Phases

### Phase 1: Shared Primitive + Tier 1 Studios (Weeks 1-2)
**Goal**: ImageStudio, VideoStudio, CinemaStudio, and EditStudio can browse and use Pexels media as input seeds.

**Tasks**:
1. Create `src/components/PexelsBrowser.js` — the reusable modal.
2. Add `openPexelsBrowser` helper to `src/lib/pexelsApi.js` or a new `src/lib/pexelsUI.js`.
3. Integrate into ImageStudio (photo reference for i2i).
4. Integrate into VideoStudio (video reference for i2v, video seed for v2v).
5. Integrate into CinemaStudio (reference scene image).
6. Integrate into EditStudio (photo to edit).
7. Add attribution chip component (`src/lib/attributionChip.js`).

**Verification**:
- Each studio can open Pexels browser, select media, and have it injected as the studio’s input seed.
- Attribution chip appears in each studio after selection.
- Existing upload flows continue to work unchanged.

### Phase 2: Timeline + Tier 2 Studios (Weeks 3-4)
**Goal**: Timeline, Director, and VideoAgent can ingest Pexels media.

**Tasks**:
1. Add “Stock Media” tab to Timeline media library panel.
2. Implement drag-and-drop from PexelsBrowser to timeline tracks.
3. Integrate Pexels into DirectorPage B-Roll Adder agent.
4. Integrate Pexels into VideoAgentPage as sample video source.
5. Persist attribution metadata in timeline clips.

**Verification**:
- Drag-and-drop from Pexels browser to timeline creates clips with attribution.
- B-Roll Adder agent can browse and add Pexels overlays.
- VideoAgent can process Pexels sample videos.

### Phase 3: Tier 3 Studios (Week 5)
**Goal**: Storyboard, Character, Influencer, Commercial can use Pexels references.

**Tasks**:
1. Add reference image picker to StoryboardStudio frames.
2. Add reference image picker to CharacterStudio.
3. Add background browser to InfluencerStudio.
4. Add product/lifestyle browser to CommercialStudio.

### Phase 4: Tier 4 Studios (Week 6)
**Goal**: Upscale, Effects, LipSync, VideoTools can consume Pexels media.

**Tasks**:
1. Add Pexels browse button to UpscaleStudio.
2. Add Pexels browse button to EffectsStudio.
3. Add Pexels video browser to LipSyncStudio.
4. Add Pexels video browser to VideoToolsStudio.

### Phase 5: Export Attribution + Polish (Week 7)
**Goal**: Attribution is included in all exports and the UX is polished.

**Tasks**:
1. Add attribution toggle in Settings.
2. Modify RenderPage to append Pexels credits when exporting projects with Pexels assets.
3. Add “Pexels” badge to LibraryPage and ContentLibraryPage for imported assets.
4. Performance: ensure Pexels browser opens in < 300ms, previews load lazily.
5. Error handling: graceful fallback when Pexels API is down or quota exhausted.

---

## 8. Reusable Components & Helpers

### 8.1 `PexelsBrowser` (modal)
**Location**: `src/components/PexelsMediaPage.js` → extract modal logic into `src/components/PexelsBrowser.js`.

**Props**:
```js
{
  accept: ['image', 'video'],   // media type filter
  onSelect: (asset) => void,
  onCancel: () => void,
  title: string,
}
```

### 8.2 `attributionChip`
**Location**: `src/lib/attributionChip.js`

**Usage**:
```js
import { renderAttributionChip } from '../lib/attributionChip.js';
const chip = renderAttributionChip(asset);
container.appendChild(chip);
```

### 8.3 `usePexelsAsset` (studio hook pattern)
Since the codebase uses vanilla DOM (not React), provide a helper:

```js
// src/lib/studioPexels.js
export async function browsePexels({ accept, onSelect, title }) {
  const { openPexelsBrowser } = await import('../components/PexelsBrowser.js');
  openPexelsBrowser({ accept, onSelect, title });
}
```

Studios call:
```js
import { browsePexels } from '../lib/studioPexels.js';

btn.onclick = () => browsePexels({
  accept: ['image'],
  title: 'Select Reference Photo',
  onSelect: (asset) => {
    uploadedImageUrls = [asset.url];
    imageMode = true;
    renderAttributionChip(asset, referenceArea);
  },
});
```

---

## 9. Design Plan (Visual/UX Spec)

### 9.1 PexelsBrowser Modal Layout
```
┌─────────────────────────────────────────────────┐
│  Stock Media                              [×]   │
├─────────────────────────────────────────────────┤
│  [Photos] [Videos] [All]          🔍 Search...  │
├─────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │ img  │ │ img  │ │ vid  │ │ img  │         │
│  │      │ │      │ │ ▶    │ │      │         │
│  └──────┘ └──────┘ └──────┘ └──────┘         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │ vid  │ │ img  │ │ img  │ │ vid  │         │
│  │ ▶    │ │      │ │      │ │ ▶    │         │
│  └──────┘ └──────┘ └──────┘ └──────┘         │
│                                                 │
│  Scroll for more...                             │
└─────────────────────────────────────────────────┘
```

### 9.2 Preview Panel (inside PexelsBrowser)
```
┌─────────────────────────────────────────────────┐
│  ← Back to results                              │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  │          Full-size photo/video           │   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Attribution:                                    │
│  Photo by John Doe on Pexels                     │
│  View on Pexels →                                │
│                                                  │
│  [ Use in Image Studio ]                         │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 9.3 Attribution Chip (in-studio)
```
┌──────────────────────────────┐
│ 📷 Photo by John Doe on Pexels │
└──────────────────────────────┘
```
- Small, rounded, semi-transparent background.
- Positioned below the reference image preview.
- Clicking opens Pexels content page.

### 9.4 Timeline Clip Badge
```
[Clip] ──── [Pexels badge] ──── [Duration]
```
- Small “P” badge on the clip thumbnail.
- Tooltip: “Photo by John Doe on Pexels”.

---

## 10. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pexels API quota exhaustion | High | Server-side caching + user key override + graceful degradation |
| Large video downloads slow studios | Medium | Auto-select smallest adequate quality; show loading states |
| Attribution forgotten in exports | Medium | Enforce in UI; add export-time credit renderer |
| Pexels ToS violation (bulk export) | High | No bulk endpoints; rate-limit searches; server key never exposed |
| Browser modal z-index conflicts | Low | Use fixed z-index 100 with `isolation: isolate` |
| Performance on low-end devices | Medium | Lazy-load thumbnails; virtualize grid if > 100 items |

---

## 11. Open Questions

1. Should Pexels search be scoped by studio context? (e.g., “landscape photos” pre-filtered for CinemaStudio)
2. Do we need Pexels Collections support in v1, or is search/curated sufficient?
3. Should users be able to “like” Pexels photos and build a personal collection inside our app?
4. Do we need to proxy video downloads through the backend for virus scanning, or always use direct CDN links?

---

## 12. Acceptance Criteria (Overall)

- [ ] All 20 studios can open the Pexels browser from a clearly labeled button.
- [ ] Selecting media in Pexels browser injects it into the studio’s input/reference area.
- [ ] Attribution chip is visible in every studio that uses a Pexels asset.
- [ ] Timeline clips created from Pexels carry attribution metadata.
- [ ] Exports include Pexels credit lines when Pexels assets are present.
- [ ] Server key is never exposed to the browser.
- [ ] All existing studio flows work unchanged when Pexels is disabled.
- [ ] Tests pass for `PexelsBrowser`, `attributionChip`, and `studioPexels` helper.
