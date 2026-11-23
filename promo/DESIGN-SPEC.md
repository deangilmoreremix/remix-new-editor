# SmartVideo promo: design spec (work in progress, Stage 0-1 + capture checkpoint)

Mode: autonomous free creation (video-shotcraft `references/pipeline.md`). Status: Stage 0 findings, tokens, claims, music choice and
first capture pass are done. Storyboard, shots, SFX, renders, final review: NOT done yet (see STATUS at the bottom).

## Stage 0 findings (no code fix needed, so no fix commits)
- Director `escapeHtml is not defined`: not reproducible on current develop. `src/components/DirectorPage.js:9`
  imports `escapeHtml` from `../lib/security.js`; it is used at lines 586 and 879. (ESLint no-undef scan not re-run.)
- `LANDING_THUMBNAIL_AUDIT.md` is stale: `public/thumbnails/studios/lipsync.webp`, `studios/render.webp`,
  `pages/templates.webp.png` all exist. Registration in `src/lib/thumbnails.js` not re-verified line by line.

## Design tokens (source: `tailwind.config.js`, `index.html`)
- Background `#050505` (app-bg), panel `#0a0a0a`, card `#141414`; accent `#d9ff00` (hover `#c4e600`); secondary text `#a1a1aa`; muted `#52525b`.
- Font Inter 400-900 (Google Fonts link in `index.html`). Radii: xl 1rem, 2xl 1.5rem, 3xl 2rem. Glow `0 0 20px rgba(217,255,0,.4)`.
- The videos show the app, so they use the app palette (lime on black), not the landing page's cyan.
- Logo: use the in-app header mark as it appears in the app UI (repo has conflicting marks). Not yet extracted.

## Claims (verified from code only)
- Model count: `src/lib/models.js`, unique `id`s across every exported model array = 601 (t2i 84, i2i 92, t2v 115, i2v 188, v2v 77,
  audio 24, avatar 13, lipsync 16, videoTools 13, text 6, training 3; ids overlap across arrays). Image (t2i+i2i) unique = 172, video (t2v+i2v+v2v) unique = 380.
  Only "601" may be used, described as "model entries in the registry".
- App count: "33 apps" is NOT verified (hero says 34, hub shows 28 cards, landing ALL_APPS differs). Use no app number until counted from `AppsHub.js` + `collabSuite`.
- No prices, no "free"/"open source". Badge counts ("20+ models" etc.) are hidden in captures by `scripts/capture.mjs` HIDE.

## Music (Stage 0 beat analysis, `analysis/beat_analyze.py`)
- Candidates with recorded sources: cat-walk (Arulo, Mixkit) and house-vibez (Lily J, Mixkit). bgm-tech-house.mp3 rejected: source untraceable.
- cat-walk: 130.00 BPM, first detected beat 15.02 s (long intro), max residual 10.6 ms, kick coverage only 65%.
- house-vibez: 122.00 BPM, t0 7.94 s, max residual 15.6 ms, kick coverage 87.6% at 1x (2x 65.8%, 0.5x 87.6%, 1x chosen: 2x loses).
- Chosen: house-vibez (Mixkit Stock Music licence, per skill ATTRIBUTION.md). The doc's 98% coverage gate was NOT met with my simple
  band-envelope metric; plan is grid for regular cuts, sparse hits pinned to measured transients, and post-render cross-correlation check.

## Capture pass 1 (`scripts/capture.mjs`, `?dev` auth bypass, nothing generated, nothing billed)
Contact sheet: `out/qa/contact-captures-1.png`. Usable: video, image, cinema, cinema-template, edit (built-in before/after gallery),
character, influencer, ai-vfx, effects, avatar, lipsync, videotools, templates, explore, commercial, video-agent, render, workbench, storyboard, upscale, audio, animate, viral.
Weak (empty state / error / blank): media-hub (blank), campaign ("Brand not found"), timeline (empty), library (empty), brand (sparse), director (empty player), apps (partially loaded; needs a longer wait).
Seeded sample media: none yet. Any seeded frame must be recorded here and never labelled as a live generation.

## STATUS: not delivered
Not done: styleframe, shot-card reading (only brand-ink-open, spotlight-hero-card, type-and-filter, wall-reveal-moves,
logo-shrink-wordmark-lockup read), storyboard, Remotion compositions V1-V4, SFX (bundled template SFX only), renders, independent review,
workbench.ts + parity, landing wiring, PR.
