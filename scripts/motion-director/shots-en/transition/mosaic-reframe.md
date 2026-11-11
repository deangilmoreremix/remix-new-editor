---
name: mosaic-reframe
one_liner: 12 tiles morph continuously between three layouts, a regular grid, a feature mosaic and a diagonal cascade, with position, width and height each interpolated, slight per-tile staggered overlap, and holds between segments
use_when: Display transitions about "many ways of looking at the same batch of content": showcasing the layout capabilities of portfolio/template library/photo album products
length: about 7.1s (214f@30fps; emerge 0–22f · hold A · A→B 56–92f · hold B · B→C 132–176f · hold C until 214f)
energy: medium (continuously flowing rearrangement, no burst point, a composed temperament)
---

## Intent
Let the viewer see "the layout itself thinking": the same 12 pieces of content go from a tidy archive state (grid) to a curated state with hierarchy (feature mosaic), then to a dynamic state with attitude (diagonal cascade).## Motion core
- The three layouts are hard-coded as coordinate tables in native 1920×1080 pixels (content area x 96–1824, y 212–984): A=4×3 regular grid (gap 24);
  B=6×4 cell mosaic (first tile occupies a large 3×2 slot, gap 16); C=portrait photo prints 300×372 spread diagonally along (850,214)→(1724,930),
  with increasing rotation `rot = −15° + i·3°`
- Each tile's centre x/y, w/h and rot are **interpolated independently**, not via whole-transform scaling: width and height genuinely change, and rounded corners and shadows don't distort;
  position arrives first: w/h converge 2f later, rotation 4f later, and B→C rotation has one light overshoot (bezier 0.45,0,0.3,1.22)
- Move curve bezier(0.75,0,0.15,1) (slow start → rush → long-tail soft landing), A→B 26f per tile, B→C 30f per tile;
  in transit tiles lift according to a sin envelope of segment progress (3.5% enlargement + shadow grows larger and softer), and settle back on landing
- Causal drive: in the top-right segmented control Grid / Mosaic / Cascade, the accent-colour pill slides to the next option first (snappy 12f, stretching horizontally in transit),
  and the tiles only start rearranging 4f later (parent moves first, children follow)
- Staggered overlap: A→B sweeps by index, dense first then sparse (10f span); B→C deals out one by one at equal intervals like dealing cards (14f span);
  from B→C the stacking order switches to "later-dealt on top" (the B state has no overlaps, so the switch is invisible)
- Three states, three tones: in the B state the main image carries a big serif caption (Featured shot / Golden Hour / Shot 01 · Crash zoom · 4.5 s rising word by word);
  in the C state the tiles grow a 14px white photo-print border, and in the empty bottom-left space a big serif title + subline rise; the final frame is a complete poster
  (the demo is video-shotcraft's 12-shot storyboard: header logo + wordmark + Storyboard, closing on "Every shot, in sequence." + brand tagline)
- Opening: 12 photos rise along the diagonal in staggered overlap (16f snappy); throughout, the camera does a very slow push-in 1→1.025

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Segment duration / hold | A→B 26f, B→C 30f; hold A 30f, B 36f, C 34f | The hold is the breathing slot for reading the layout; squeeze it to <20f and the three segments blur into one |
| Control → tile lag | 4f | 0 = causality can't be read; >8f looks like the control is broken |
| Stagger span | A→B 10f, B→C 14f | 0 = whole layout flashes mechanically; >24f the wave upstages the layout itself |
| Cascade parameters | Photo print 300×372, centre spacing about (79,65)px, rot −15°+3°/tile | Increasing rotation is the soul of the "cascade"; equal angles degrade into a slanted grid |
| mosaic large slot | First tile 3×2 cells | Swap the slots table to rearrange the hierarchy; make sure there is an anchor slot of ≥2×2 |
| Lift envelope | scale +3.5%, shadow elevation 6→40 | Too big looks like pop-ups flying around; 0 reads as flat sliders |
| Tile content | SVG procedural photos (viewBox + slice ≈ cover, eight warm-toned film-style looks) | When switching to real photos keep the overflow:hidden rounded container + object-fit: cover |

## Known pitfalls
- Independent interpolation of centre/width/height means you **cannot** switch to `transform: scale`: width/height animation causes child elements to reflow, so images must use `object-fit: cover`
- In segment C the last tile deliberately goes past the bottom edge of the frame; the frame crop is part of the composition; C's diagonal must avoid the top-left wordmark and top-right control, leaving the bottom left for the title
- Portrait photo prints crop landscape photos to a middle strip: put the photo's subject near the frame's horizontal centre; the main image's sun is to the right, making room for the bottom-left caption
- Stacking order can only switch in a "no overlap" state (the B→C take-off frame); changing zIndex mid-overlap shows tiles jumping layers
- After segment windows + stagger + lag stack up, the last tile of B→C only settles at about 176f; to add more segments compress the earlier segments rather than pushing things later

compress the earlier segments rather than pushing things later (ensuring everything has settled before t=1)

## Reference implementation
demos/transition/mosaic-reframe/
(MosaicReframe.tsx)
