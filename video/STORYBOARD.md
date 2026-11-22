# Storyboard (DRAFT for approval)

Source: only the real frames/recordings in `video/captures/` (see `CAPTURE_REPORT.md`). Nothing generated, mocked or composited into fake UI.
Base: Ink Press template (1920x1080, 30fps), re-themed dark (skill presets: Midnight / Deep Ocean / Obsidian Violet; final pick once you give the accent colour + logo).
Audio: skill-bundled BGM only (bgm-tech-house 289s, cat-walk 124s, house-vibez 111s, tonight-hiphop 113s, g-eazy-nba-type 104s) + bundled SFX (`template/public/audio`, 11 files). BPM/beat grid analysed in Phase 3 (`references/music-beat-sync.md`); cuts snap to the beat. Silent autoplay on the page, so audio is only for the downloadable/social versions.

## Copy rules
- No model count, app count or price anywhere (pending your confirmation; the app itself says 15+/20+/200+/28/33 in different places).
- No claim that a typed prompt produced a shown result. The gallery shown is the app's own "Example gallery", labelled as examples.
- On-screen words are either copied from the app UI itself (marked [UI]) or short non-numeric lines proposed below for approval.

## What changed from your suggested plan, and why
| Shot | Your plan | Change | Why |
|---|---|---|---|
| 1 hero | typed prompt, then finished clip | typed prompt -> Generate hover -> pan down to the app's Example gallery | no clip can be generated without a key |
| 6 Storyboard/Backlot | 8-step pipeline, cost counter | DROPPED (placeholder slot) | page is a plain form; the pipeline lives in the separate Backlot board, not captured |
| 11 Timeline/Render | scenes, captions, audio, export | thin: New Project dialog only; used in C only | no project/timeline canvas filmable |
| 13 Video Agent | one prompt end to end | DROPPED | studio shows "Coming soon" placeholder |
| 14 Chat | brainstorm/refine/handoff | DROPPED | panel shows an OpenAI-key nag |
| 16 Agency | dashboard | DROPPED | "Brand not found" |
| 9 Dubbing, 3 languages | one clip, 3 languages | replaced by Avatar + Lip Sync studio UIs | needs generation |
| 7 Edit | before/after slider | use the app's built-in before/after gallery tiles; slider built from those real pairs | the pairs are real app assets |
| D social | shots 1, 7, 9, 6 | 1, 7, 9(UI), 12 | 6 dropped; templates grid is real and vertical-friendly |
Recipe swaps: shot 4 uses `type-and-filter` + `list-reveal` (instead of card-stack, no result cards to stack); shot 10 uses `scan-bracket-sweep` + `light-play-moves` on the gallery tiles (no clip to hit with `impact-feedback`).

## A. Hero loop, 18s, 16:9 (loops: last frame dissolves back to frame 0)
| Shot | Time | Capture | Recipe | On-screen copy | Beat |
|---|---|---|---|---|---|
| A1 | 0.0-6.5 | 01-video-studio typing recording + `b-typed`, `e-controls` | brand-ink-open -> spotlight-hero-card | "Describe it." (proposed) | ink stroke draws wordmark, settles; prompt bar lifts under spotlight, text types on the beat |
| A2 | 6.5-11.5 | 02-apps-hub c-scroll1/2 + a-top | wall-reveal-moves | "Every creative tool, one place." [UI hub heading] | tile wall reveals row by row, 1 row per bar |
| A3 | 11.5-15.5 | 03-model-picker open + scroll recording | picker-carousel-feature-cycle | "Pick your model." (proposed) | picker opens on downbeat, list scrolls, no count visible (crop/blur the scrollbar and any number) |
| A4 | 15.5-18.0 | logo (path TBD) | logo-shrink-wordmark-lockup | wordmark + logo | lockup lands on the final beat, 1s hold, dissolves to A1 start |

## B. Feature reel, 50s, 16:9
| Shot | Time | Capture | Recipe | On-screen copy | Beat |
|---|---|---|---|---|---|
| B1 Image | 0-7 | 04 b-typed, c-advanced | type-and-filter | "Images, tuned." (proposed) | prompt types, Advanced panel slides open on the drop |
| B2 Cinema | 7-14 | 05 builder open (e-controls) + selections | cursor-flyover | "Real camera. Real lenses." (proposed) | cursor flies through camera -> lens -> movement controls |
| B3 Director | 14-19 | 05b director frame | spotlight-sweep-moves | "Direct the scene." (proposed) | sweep across agent list, no result pane shown (empty) |
| B4 Edit | 19-27 | 07 gallery pairs | before-after-slider-scrub | "Before. After." (proposed) | slider scrubs each pair on beats |
| B5 Character | 27-34 | 08 character studio | deck-deal-flyin (hero images from the studio banner) | "One character, every scene." only if banner art is the app's own; otherwise "Characters." | cards deal on beat |
| B6 Avatar/Lip Sync | 34-41 | 09 avatar, 09b lipsync | quad-split-parallel-scenes (2 UIs + 2 hero banners) | "Faces that talk." (proposed) | quad pops on bar line |
| B7 VFX/Effects | 41-47 | 10 ai-vfx gallery, 10b effects | scan-bracket-sweep + light-play-moves | "Effects, applied." (proposed) | bracket locks on tiles on downbeats |
| B8 Templates | 47-50 | 12 templates grid | carousel-3d (outro) | "Start from a template." (proposed) | grid rotates into the lockup |
Slots reserved (not filmed, so omitted): Storyboard/Backlot, Timeline/Render, Video Agent.

## C. Per-feature clips, 7s each, 16:9 (12 clips; all silent-loopable)
C01 hero prompt (A1 cut), C02 apps hub (A2), C03 model picker (A3), C04 Image Studio (B1), C05 Cinema (B2), C06 Director (B3), C07 Edit before/after (B4), C08 Character (B5), C09 Avatar (B6a), C10 Lip Sync (B6b), C11 AI-VFX+Effects (B7), C12 Templates (B8). Each: 1 recipe from above, 1 line of copy (same as B), 7s.
Pending, no clip: Storyboard/Backlot, Timeline/Render (could do dialog-only), Video Agent, Chat, Library/Community/Stock, Agency.

## D. Social cut, 20s, 9:16
Layout: 1080x1920; 16:9 captures are re-framed by PageCam zoom onto the relevant panel (captures are 1080p, so panel crops stay sharp only up to ~1.6x zoom; QA will check).
| Shot | Time | Capture | Recipe | Copy | Beat |
|---|---|---|---|---|---|
| D1 | 0-5 | 01 typing | spotlight-hero-card | "Describe it." | type on beat |
| D2 | 5-11 | 07 before/after | before-after-slider-scrub (vertical stack) | "Before. After." | scrub x2 |
| D3 | 11-16 | 09 avatar + 09b lipsync UI | quad-split (2x2 stack) | "Faces that talk." | pop |
| D4 | 16-20 | 12 templates | carousel-3d -> logo lockup | "Start from a template." | land on last beat |

## Risks to review
1. Several shots are studio screens with empty states; the energy comes from camera moves and typing, not results. Honest, but quieter than a generated-output reel.
2. Dark re-theme of Ink Press (paper look) changes its character; may want Midnight vs Obsidian Violet decided by your accent colour.
3. Any frame showing a number (picker scrollbar, "28 examples", "16 tools") must be cropped/blurred or approved; I will list each in the QA report.
4. 9:16 crops of 1080p source.

## Needed before Phase 3
Accent colour, logo path, size cap per file, confirmed model count + pricing wording (or confirm "no numbers/prices in videos").
