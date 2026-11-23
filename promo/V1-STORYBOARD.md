# V1 Hero promo: storyboard (final) and frame timeline

Composition `V1Hero`, 1920x1080 @30fps, 826 frames (27.53 s). BGM house-vibez (Mixkit, Lily J), grid 122.00 BPM, beat = 14.754 f.
Energy arc follows `references/sequences/promo-energy-arc.md` (low open, single-hero typing beat, wall, lockup), merged for a 27 s cut:
the "single hero card" segment (spotlight-hero-card) is intentionally not used; the prompt-typing beat is the hero. 

| # | frames (beats) | shot | card / style-key | what is on screen | page state / source | caption | SFX (from table) |
|---|---|---|---|---|---|---|---|
| 1 | 0-118 (b0-8) | brand open | brand-ink-open / brand-ink-open (demo demos/typography/brand-ink-open/BrandInkOpen.tsx) | crosshair draw, "SmartVideo" letterpress, kicker "AI video & image studio", 49f full-title hold | text only | wordmark | transition-soft at wordmark landing |
| 2 | 118-443 (b8-30) | prompt to clip | type-and-filter / type-and-filter (demo TypeAndFilter.tsx): GRAMMAR LOAN only (typing, caret, breath, pull-out kept; filter/slide/click ripple/push-through dropped) | real Video Studio, camera at the prompt box, 3f/char typing of "A lone tower in golden wheat", pull-out, page dims, example clip card | REAL capture video-blank/video-typed (textures/live). Clip = built-in sample asset public/media/awesome-seedance/videos/john10.mp4, labelled "EXAMPLE FROM THE GALLERY" (36px) | "Describe the shot." | keyboard (typing window 86f), whoosh-fast at card rise |
| 3 | 443-649 (b30-44) | studios wall | wall-reveal-moves / bento-light-up (demo BentoLightUp.tsx) | 3x2 bento of real studio captures (Video, Image, Cinema, Edit, Character, Lip Sync), one cell per beat, push 1.04, 72f rest | REAL captures (cropped), names are the app's own studio names | "Your studios, one place." | whoosh-big |
| 4 | 649-826 (b44-56) | lockup | logo-shrink-wordmark-lockup / logo-shrink-wordmark-lockup (demo LogoShrinkWordmarkLockup.tsx) | ring collapses to the in-app mark, wordmark letters slide in, lime tagline, 68f hold | in-app header mark (src/components/Header.js) | "DESCRIBE IT. DIRECT IT." | riser-cine, impact-cine, sparkle |

Backups considered (not used): spotlight-hero-card (opening), picker-carousel-feature-cycle (model picker, reserved for V2), card-stack.
Full-frame slams: 0 (limit 3). Glints/sweeps: only the comet stroke on the wall cells (card-native, per-cell). One technique lead per beat.

## Seeded / sample frames (honesty record)
- No generation, face swap, colorize, upscale or dubbing is shown. No "generated in N seconds", credits or billing text appears.
- Frames 270-443: the clip card is a SAMPLE built-in media file shipped in the repo (public/media/awesome-seedance/videos/john10.mp4). It is NOT a result of the prompt
  typed in frames 134-243; the on-screen "EXAMPLE FROM THE GALLERY" label says so (clip plays at 0.85x so the visible seconds stay in the tower part). Provenance of this repo asset is NOT verified (third-party showcase folder): confirm usage rights before publishing.
- Studio thumbnails/banners inside real captures are the app's own stock imagery.
- Typing is real UI text rendered by the app (canvas-measured glyph widths drive the reveal); only the typing cadence is scripted.

## Claims
No prices, no free/open-source wording, no model or app counts in V1. (Gallery thumbnail text "OPEN SOURCE" in the app is covered by a patch in frames 118-443.)
