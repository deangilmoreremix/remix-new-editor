# Phase 3 build + QA report

Project: `video/project` (Remotion 4, 30 fps). Source of every frame: `video/captures` (live smartvid.app, signed out). Rebuild: `cd video/project && ./prepare-assets.sh && npm install`, then `npx remotion render src/index.ts <HeroLoop|FeatureReel|Social|c01-video...> --props='{"bgm":true}'`. The wordmark/lockup use the app's own stack mark and `smartvid.app` text. Accent `#d9ff00`, bg `#05070b`, Inter 900 (sampled from computed styles on the live site).

## Music and sync
Bundled BGM `house-vibez.mp3` (measured 123 BPM, beat jitter <10 ms, first beat 0.093 s, offset trimmed). Every cut and hop is on a whole beat (1 beat = 14.63 frames). Bundled SFX only (whoosh, snap, pop, keyboard, riser, impact, sparkle). Audio is limited to about -0.4 dBFS after a limiter pass (raw SFX peaks overshot by 0.1-0.2 dB). Each hero/reel/social file ships with and without BGM (`-nobgm`, SFX kept). Clips are SFX-only.

## Deliverables (video/out)
| File | Duration | Size (px) | Size on disk |
|---|---|---|---|
| c01-video.mp4 | 6.9s | 1920x1080 | 0.94 MB |
| c02-apps.mp4 | 6.8s | 1920x1080 | 0.27 MB |
| c03-models.mp4 | 6.9s | 1920x1080 | 1.14 MB |
| c04-image.mp4 | 6.9s | 1920x1080 | 1.16 MB |
| c05-cinema-director.mp4 | 6.9s | 1920x1080 | 1.27 MB |
| c06-storyboard.mp4 | 6.9s | 1920x1080 | 0.54 MB |
| c07-edit.mp4 | 6.8s | 1920x1080 | 2.17 MB |
| c08-character-influencer.mp4 | 6.9s | 1920x1080 | 0.8 MB |
| c09-avatar-lipsync.mp4 | 6.8s | 1920x1080 | 0.28 MB |
| c10-vfx-effects.mp4 | 6.8s | 1920x1080 | 1.55 MB |
| c11-workbench.mp4 | 6.9s | 1920x1080 | 0.78 MB |
| c12-templates.mp4 | 6.8s | 1920x1080 | 0.65 MB |
| c13-video-agent.mp4 | 6.9s | 1920x1080 | 0.81 MB |
| c15-community.mp4 | 6.8s | 1920x1080 | 0.4 MB |
| feature-reel-nobgm.mp4 | 58.6s | 1920x1080 | 11.32 MB |
| feature-reel.mp4 | 58.6s | 1920x1080 | 11.66 MB |
| hero-loop-nobgm.mp4 | 17.6s | 1920x1080 | 3.1 MB |
| hero-loop.mp4 | 17.6s | 1920x1080 | 3.13 MB |
| social-9x16-nobgm.mp4 | 19.6s | 1080x1920 | 5.28 MB |
| social-9x16.mp4 | 19.6s | 1080x1920 | 5.44 MB |
| hero-loop.webm | 17.6s | 1920x1080 | 1.59 MB |

Posters (webp): hero-loop, feature-reel, social-9x16, and one per clip (`c*.webp`). Hero also has `hero-loop.webm` (VP9, muted).

## QA performed
- Frame sampling every 0.25 s on every render: no blank or black frames (longest dark run 0 s).
- Strips of every shot viewed by eye (hero, reel, social, all clip posters).
- OCR (Tesseract) on every shipped video at 2 fps, 387 frames, for model/tool counts, prices, "free", "open source", "lifetime". Final result: no hits (one false positive: the Tools button).

## What QA found and fixed
1. **Count text visible in the UI** ("15+ models", "20+ AI models", "200+ effects", "48 agents", "60+ templates", "16 AI editing tools", "154 motion cards", "AI Effects 64 / Motion 47 / VFX 9", "28 examples", app counts): masked with a blur patch on every capture.
2. **"open-source" claim text** surfaced only by OCR: an example tile titled "1980s open-source family comedy" and a thumbnail reading "...IS OPEN SOURCE" in the Video Studio gallery (hero, c01, c03, social). Gallery band masked on both aspect ratios; re-rendered and re-checked.
3. **Camera cropped text mid-word or showed black void** (Storyboard title, model picker, influencer): camera centre is now clamped to the page and keys re-anchored.
4. **Spotlight too dark** for a landing hero: lifted.
5. **Wall-reveal lime lattice looked messy**: edge glow thinned.
6. **Video Agent title clipped at left**: key re-anchored.
7. **Audio overs**: limiter pass.

## Honest limits (please review)
- **Recipes are simplified.** I built compact versions of brand-ink-open, spotlight-hero-card, wall-reveal (bento light-up), cursor-flyover (with hop outline), carousel-3d, quad-split, light-play and the lockup, from the card descriptions. I did NOT port the tuned demo TSX, and I removed the Ink Press scenes/theme/screenshots (they were another product's data). deck-deal-flyin, card-stack, row-embed, timeline-travel and before-after-slider-scrub are approximated by camera moves and hop outlines.
- **No result footage.** Everything is idle UI, typing and picker/panel interaction (see CAPTURE_REPORT.md). Nothing claims an output.
- **Mask patches are visible** as dark blurred bars under studio titles. Honest trade-off versus showing counts; a cleaner fix is to hide those lines in the live UI before capture.
- **Max file size was never given.** Largest file is the reel at about 11.7 MB; everything else is under 6 MB. Tell me your cap.
- **Skill steps not done:** independent clean-context review subagent, SFX Freesound sourcing (bundled SFX only, per brief), workbench manifest.
- Soft frames: 1x sources zoomed to about 1.2x.
- Pages with no usable capture have no clip (chat/assist, agency, commercial, stock, library, render, dubbing).
