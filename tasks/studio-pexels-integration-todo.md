# Studio Pexels Integration — Todo List

## Phase 1: Shared Primitive + Tier 1 Studios (Weeks 1-2)

- [ ] Task 1: Create reusable PexelsBrowser modal component
  - [ ] Extract preview/search logic from PexelsMediaPage.js into PexelsBrowser.js
  - [ ] Support `accept` filter (images/videos)
  - [ ] Support `onSelect` and `onCancel` callbacks
  - [ ] Keyboard accessible (Escape to close, Tab trap)
  - [ ] Backdrop click closes modal

- [ ] Task 2: Create studioPexels helper
  - [ ] `browsePexels({ accept, onSelect, title })` in `src/lib/studioPexels.js`
  - [ ] Wraps PexelsBrowser with studio-friendly API

- [ ] Task 3: Create attributionChip component
  - [ ] `renderAttributionChip(asset, container)` in `src/lib/attributionChip.js`
  - [ ] Shows photographer + Pexels link
  - [ ] Compact, non-intrusive styling

- [ ] Task 4: Integrate Pexels into ImageStudio
  - [ ] Add "Browse Stock Photos" button next to upload picker
  - [ ] Wire `browsePexels({ accept: ['image'] })` to set `uploadedImageUrls`
  - [ ] Switch to i2i mode on selection
  - [ ] Show attribution chip below reference preview

- [ ] Task 5: Integrate Pexels into VideoStudio
  - [ ] Add "Browse Stock Videos" button (i2v mode)
  - [ ] Add "Browse Stock Videos" button (v2v mode)
  - [ ] Wire selection to `uploadedImageUrl` / `uploadedVideoUrl`
  - [ ] Show attribution chip

- [ ] Task 6: Integrate Pexels into CinemaStudio
  - [ ] Add "Browse Reference Scene" button next to upload picker
  - [ ] Wire selection to `currentSettings.referenceUrl`
  - [ ] Switch to i2v models automatically
  - [ ] Show attribution in reference pill

- [ ] Task 7: Integrate Pexels into EditStudio
  - [ ] Add "Browse Photos to Edit" button
  - [ ] Wire selection to `uploadedUrl`
  - [ ] Show attribution chip

### Checkpoint: After Phase 1
- [ ] ImageStudio, VideoStudio, CinemaStudio, EditStudio can browse and use Pexels
- [ ] Attribution chips visible in all four studios
- [ ] Existing upload flows unchanged

---

## Phase 2: Timeline + Tier 2 Studios (Weeks 3-4)

- [ ] Task 8: Add Pexels tab to Timeline media library panel
  - [ ] Add "Stock Media" tab alongside Upload/Giphy/Stickers
  - [ ] Embed PexelsBrowser in panel mode (not full modal)
  - [ ] Drag-and-drop from Pexels grid to timeline tracks

- [ ] Task 9: Wire Pexels import to timeline
  - [ ] On drop: call `addMediaToTimeline` with Pexels asset
  - [ ] Store attribution in clip metadata
  - [ ] Show Pexels badge on timeline clips

- [ ] Task 10: Integrate Pexels into DirectorPage
  - [ ] Add "Add B-Roll from Pexels" in B-Roll Adder agent
  - [ ] Auto-suggest keywords from main video scenes
  - [ ] Selected clips become B-roll overlays

- [ ] Task 11: Integrate Pexels into VideoAgentPage
  - [ ] Add "Use Sample Video" button in upload area
  - [ ] Pexels video URL becomes agent input

### Checkpoint: After Phase 2
- [ ] Timeline can import Pexels media via drag-and-drop
- [ ] Director B-Roll agent can browse Pexels
- [ ] VideoAgent can use Pexels sample videos

---

## Phase 3: Tier 3 Studios (Week 5)

- [ ] Task 12: Integrate Pexels into StoryboardStudio
  - [ ] Add "Reference Frame from Pexels" on each frame card
  - [ ] Set `frame.referenceImages[0]` on selection

- [ ] Task 13: Integrate Pexels into CharacterStudio
  - [ ] Add "Browse Character References" button

- [ ] Task 14: Integrate Pexels into InfluencerStudio
  - [ ] Add "Browse Backgrounds" button

- [ ] Task 15: Integrate Pexels into CommercialStudio
  - [ ] Add "Browse Product Photos" and "Browse Lifestyle Photos" buttons

### Checkpoint: After Phase 3
- [ ] Storyboard, Character, Influencer, Commercial can use Pexels references

---

## Phase 4: Tier 4 Studios (Week 6)

- [ ] Task 16: Integrate Pexels into UpscaleStudio
- [ ] Task 17: Integrate Pexels into EffectsStudio
- [ ] Task 18: Integrate Pexels into LipSyncStudio
- [ ] Task 19: Integrate Pexels into VideoToolsStudio

### Checkpoint: After Phase 4
- [ ] All Tier 4 studios can browse and use Pexels media

---

## Phase 5: Export Attribution + Polish (Week 7)

- [ ] Task 20: Add attribution toggle in Settings
  - [ ] "Include Pexels attribution in exports" (default: on)

- [ ] Task 21: Modify RenderPage for Pexels credits
  - [ ] Append Pexels credit line when project has Pexels assets
  - [ ] List photographers in credits

- [ ] Task 22: Add Pexels badge to LibraryPage and ContentLibraryPage
  - [ ] Show "Pexels" badge on imported assets
  - [ ] Link to original Pexels page

- [ ] Task 23: Performance optimization
  - [ ] PexelsBrowser opens in < 300ms
  - [ ] Thumbnails load lazily
  - [ ] Consider virtualization for large result sets

- [ ] Task 24: Error handling
  - [ ] Graceful fallback when Pexels API is down
  - [ ] Quota exhaustion messaging
  - [ ] Retry logic for failed searches

### Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Ready for review
