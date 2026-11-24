# V2 Feature reel: storyboard, coverage and honesty record

Composition `V2Feature`, 1920x1080 @30fps, 1593 frames (53.1 s, 108 beats of 122.00 BPM house-vibez). Requested "~60 s, one beat per feature": delivered 10 shots
covering the features below; 53 s because several features share a shot and the rest could not be captured honestly (see Omitted).
Every cut is a `beatF(n)`; SFX table in `src/timeline2.ts` (`V2_SFX`), offsets verified with `analysis/verify_sync.py` (see V2 section of REVIEW-V2.md).

| # | frames | beats | shot | card / style-key (demo) | on screen | source |
|---|---|---|---|---|---|---|
| 1 | 0-118 | 0-8 | brand open | brand-ink-open (BrandInkOpen.tsx) | wordmark, kicker | text |
| 2 | 118-413 | 8-28 | Video Studio + model picker | cursor-flyover (CursorFlyover.tsx) | camera + cursor tour: click prompt, typing "Product shot on a marble pedestal, soft studio light", click the model button (opens the REAL picker), click Advanced (opens the REAL Advanced Options panel) | real captures video-blank / video-typed2 / video-typed2-model |
| 3 | 413-561 | 28-38 | app hub | depth-layer-moves (MultiplaneReal.tsx) | parallax over the hub page, 6 real hub cards in the mid layer, Video Studio card lifts | real capture apps-tall + card cutouts |
| 4 | 561-708 | 38-48 | Image Studio controls | crash-zoom-punch, rebound variant (CrashZoomReal.tsx) | wide page, brackets lock, crash zoom onto the aspect-ratio menu, caption "Controls that adapt to the model." (only the aspect-ratio menu is shown; the model is not switched on screen) | real captures image / image-ar |
| 5 | 708-856 | 48-58 | Cinema Studio | tilt-reveal (TiltReveal.tsx, overhead-camera-moves A) | page lifts from flat with a lime horizon, then the real Prompt Builder opens; caption "Pick the camera and lens." | real capture cinema |
| 6 | 856-1003 | 58-68 | Backlot pipeline | timeline-travel (TimelineTravel.tsx) | camera travels the 8-step rail research -> publish, rings pop on 5 approved stages, ends on pending stages | real capture of the local Backlot board, FICTIONAL demo project |
| 7 | 1003-1180 | 68-80 | Edit tools | deck-deal-flyin (DeckDealFlyin.tsx) | 12 real tool cards dealt into a grid | real cutouts of the Edit Studio tool cards (the app's built-in demo images) |
| 8 | 1180-1269 | 80-86 | Character / Avatar / Lip Sync / AI VFX | quad-split-parallel-scenes (QuadSplitParallelScenes.tsx) | 2x2 with staggered pops, one whip push | real captures character / avatar / lipsync / ai-vfx |
| 9 | 1269-1416 | 86-96 | Cinema Templates | carousel-3d (Carousel3D.tsx) | ring of 8 real template preview images | real cutouts from cinema-template |
| 10 | 1416-1593 | 96-108 | lockup | logo-shrink-wordmark-lockup (LogoShrinkWordmarkLockup.tsx) | in-app mark + SmartVideo + tagline | in-app header mark |

Differences from each demo are listed at the top of each shot file (`src/shots/*.tsx`). Skipped cards: before-after-slider-scrub (the Edit Studio's built-in examples are
single pre-composited split images, no aligned before/after originals exist), spotlight-hero-card, picker-carousel-feature-cycle, row-embed, card-stack, ui-to-brand-morph.

## Requested features: coverage
Shown: Video Studio (prompt, model picker, the real Advanced Options panel opening), Cinema Studio's real Prompt Builder (camera + lens fields) opening after the tilt, app hub (no count shown), Image Studio dynamic controls (aspect-ratio menu), Backlot 8-step pipeline,
Edit tools (remove object / remove background / extend / reframe / change dress / skin enhance / colorize / upscale / product shot as the app's built-in example cards, labelled "BUILT-IN EXAMPLE IMAGES" on screen, NOT live results),
Character, Avatar, Lip Sync, AI VFX, Templates (Cinema Templates).
Omitted. Two different reasons, stated plainly:
- NOT capturable honestly: Director (the capture is an empty player), Storyboard frames (opening a saved storyboard hits an "Unlock full access / Sign in" wall, not clicked through),
  Dubbing (no capture), Timeline / Render / Library / Stock media / Content (empty-state captures), Agency dashboard / Campaign ("Brand not found"), Chat + Assist (the Ask panel nags for a key).
- Capturable but NOT USED (a choice, for shot-slot economy; the reel is 53 s, so there was room): Influencer, Effects, Video Agent, Product Shot / Commercial as its own beat
  (it appears only as one of the Edit tool cards), Image Studio's Advanced panel (only the aspect-ratio menu is shown), and the face-swap Edit card (dropped on purpose: its example image carries the text "AI Deepfake Technology").
No result of a live generation, face swap, colorize, upscale or dubbing is shown or implied; no credits/cost/"generated in" text appears.

## Seeded / fictional frames
- Backlot (frames 856-1003): the fictional project "The Last Lighthouse" built by a scratch driver adapted from `scripts/backlot_simulate_run.py` (adds the missing `proposal` stage;
  scene images were real gallery thumbnails but are NOT shown: the simulator's Activity feed ($ cost, placeholder model "flux-sim") and storyboard strip were hidden at capture time).
  It is a real Backlot board over fictional data; it does not claim a real production ran.
- Everything else is the real app UI in idle states (no seeded generation data). Stock images inside the app (banners, tool cards, templates) are the app's own.

## Claims
No prices, free/open-source wording, model counts or app counts. (Counts: models registry = 601 unique ids, the hub renders 27 cards in this build: neither used.)
"Ratios and resolutions follow the model you pick" is supported in code (`getAspectRatiosForModel`, `getResolutionsForModel` in src/lib/models.js); only the aspect-ratio menu is shown.
Rights: stock imagery and tool/template preview images shipped in the app (public/thumbnails) have unrecorded provenance; confirm before publishing.

## Simulated interaction (stated plainly)
Typing, clicks, cursor motion and the picker / Advanced panel / Prompt Builder opening are SIMULATED from real captures: the typed text is a clip-reveal of a real screenshot with a drawn caret,
and each panel opening is a cross-fade to a second real capture taken after really clicking the control in the app. No generation was triggered and nothing was billed.
Backlot: the "LIVE"/idle badge and simulator timestamps were hidden at capture time so the fictional project does not read as a production in progress; 3 of 8 stages are visibly pending.
