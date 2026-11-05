---
name: assemble-then-type-flyin
one_liner: On an empty dark grid, text-free component skeletons first fly in from every direction and snap into place; then text everywhere flies in character by character, rotating through 3D space into position, big titles first and small annotations after, and once everything has landed the page has taken shape
use_when: Openers where a page/poster "grows itself"; capability showcases for typography products; two-stage narratives from skeleton to finished piece
length: about 5.6s (168f@30fps)
energy: medium-high (skeleton segment sparse, text segment dense, energy rising monotonically to the ending)
---

## Intent
Split "page generation" into two semantically clear stages: first set up the skeleton (frames, cards, dividers,
colour blocks, all without text), then fill in the text. The text uses character-by-character 3D rotation into place because the skeleton segment
has only planar translation: the motion dimensions of the two segments must differ, otherwise the viewer can't read "this is step two".

## Motion core
- Once formed, the demo is video-shotcraft's dark-field launch page (graphite look, film gold accent2 the only accent colour; the nav bar is the Frame Chisel logo mark +
  video-shotcraft wordmark, the big title is the brand short phrase "Frame motion. / Craft the shot."),
  native 1920×1080 coordinates; on the opening frame 1 there are already 12-column layout guides, which fade back once the skeleton is complete
- 10 skeleton pieces (nav bar, grading desk card + film frame colour block, Frame Chisel logo mark, three colour wheel rings, divider, CTA, secondary button, three metric blocks)
  fly in one after another at take-off frames 6/10/15/19/23/27/31/35/39/44, each piece 16f `EASE.overshoot` overshooting into place,
  `from` displacement 120–420px + ±7° rotation (rotation converging 4f later)
- While skeleton pieces move, directional motion blur by real speed (px/frame) (`SpeedBlur` ×0.32, cap 18px), 0 when still
- 19 text blocks start one after another at start frames 58→114: the 112px serif big title first (58/66),
  then nav, eyebrow, description sentence, button text (76–95), metric numbers (96–102), and finally the mono small annotations everywhere (104–114)
- Per-character 3D: each character holds deterministic seeded random
  `dx ±260px / dy ±200px / dz −200→−760 / rotateX ±170° / rotateY ±190° /
  rotateZ ±120°`, via `perspective(900px) translate3d + rotateX/Y/Z`,
  each character 16f `EASE.snappy` into place, with depth-of-field blur by defocus distance in flight; when `a>=1` set transform directly to `none`
- Adaptive in-block character interval: `step = clamp((128 − start − 16)/character count, 0.35, 1.6)` frames
  : guarantees that however long a block is, it finishes landing before f128, leaving 40f at the end for whole-page still breathing (1.5% very slow push-in)
- The "finalising" stroke after landing: the CTA powers up from an outline into a solid gold fill (118–132), the film frame is wiped by a gold vertical line from log-grey footage
  into a warm-toned finished grade (124–146), and the three colour wheels' control points push in sync from neutral to tinted positions
- All randomness comes from `rand(i) = frac(sin(i*127.1 + 311.7) * 43758.5453)`,
  deterministic, seekable

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Skeleton timing | 10 pieces, take-off frames 6→44 (interval 4–5f) | The skeleton segment takes the first 30%; compress it into 20f and it blurs into the text segment |
| Skeleton fly-in | overshoot, 16f, displacement 120–420px + ±7° | The same technique as `scanline-assemble-flyin`; with the scanline removed, the order is read through timing |
| Skeleton trails | Directional motion blur, by speed ×0.32, capped at 18px | Only appears in fast segments; constant blur reads as out of focus |
| Break between segments | Skeleton complete (f50) → text starts (f58), leaving 8f, guides fading back in the same period | Without this half-beat the viewer can't read "this is step two" |
| Text start points | Big title 58/66, small annotations 104→114 | Big type landing first is a readability requirement: if small type lands first the viewer goes to read the small type |
| Per-character displacement | dx ±260 / dy ±200 / dz −200→−760 | dz is the main force behind "coming from far away"; giving only dx/dy makes it a planar scatter-in |
| Per-character rotation | rotateX/Y/Z each ±120°–190° | Only big angles give the "flying while tumbling" feel; ±30° just looks like jitter |
| perspective | 900px (written into each character's own transform) | 112px big type with 600px distorts excessively; above 1400px the 3D feel basically vanishes |
| Character interval | clamp((128−start−16)/n, 0.35, 1.6) frames | The 1.6f upper limit is the minimum speed for "distinguishable character by character" |
| Clear on landing | a>=1 → transform:'none' | Not clearing leaves composite layers for 19 blocks, and long films drop frames |

## Known pitfalls
- Character spans follow normal layout flow (`display:inline-block`), the animation only moves transform:
  don't position characters one by one with absolute positioning, or changing the copy messes everything up
- Space characters must be explicitly inserted as non-breaking spaces (the code uses `ch === ' ' ? ' ' : ch`),
  otherwise an empty inline-block span's width goes to zero and word spacing disappears
- `start` is 19 hand-written values; when changing the copy (especially with big changes in character count) check again
  that the last block still finishes landing before f128; `step` only guarantees within a block, not between blocks
- The content is video-shotcraft's sample launch page (title / metrics / colour wheel annotations); in real use swap in the project's own;
  GOLD (graphite's accent2 `#e4c58a`) is the accent colour slot, and the CTA text colour turning from gold to dark as it powers up must be swapped together
- The difference from `scanline-assemble-flyin` is that **there is no scanline**: that card relies on the scanline
  to explain the order, this card relies on the two-stage "skeleton first, then text" to explain the order; don't mix the two

## Reference implementation
demos/effects/assemble-then-type-flyin/
(AssembleThenTypeFlyin.tsx)
