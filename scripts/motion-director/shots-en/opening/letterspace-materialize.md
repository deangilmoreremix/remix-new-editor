---
name: letterspace-materialize
one_liner: A widely letterspaced wordmark crystallises with all characters drawn continuously in parallel: every letter starts its stroke on the same frame, strokes grow continuously like handwriting, and they all finish on the same frame to form the word; a brand wordmark developing over an atmospheric background
use_when: Brand wordmark entrance at the end/start of a film (widely spaced thin-skeleton wordmark; the demo is video-shotcraft in all lowercase); chapter titles; closing frames that need a quiet/premium feel
length: Rest ~15f + draw-on ~50f + final-state rest ≥30f; whole segment 3–4s
energy: low (a quiet sense of ceremony, completed in one breath)
tags: typography, outro
---

## Intent
The wordmark doesn't fade in and isn't a typewriter; it "crystallises": the strokes of all letters start growing
continuously at the same time, as if one invisible hand were writing every letter at once, and they all finish at the same instant
to form the word. Two make-or-break points: **continuous** (the strokes must be a process of being drawn continuously, no mask
segmentation: half first and then the other half gets seen through; every intermediate frame should look "half-written");
**synchronous** (all letters start on the same frame and finish on the same frame: per-letter staggered overlap is typewriter semantics,
here it's the ceremony of the whole word as one).

## Motion core
- Each character uses a skeleton-stroke SVG path (single-line glyph), pathLength normalised +
  strokeDashoffset drawn continuously from 1→0
- All characters share the same progress p: same-frame start; pathLength normalisation ensures letters with different stroke
  lengths finish on the same frame (no per-char delay/jitter)
- Glyph proportions: squarish and slightly wide (letterform aspect ratio ≈1.07; measured ruling: tall narrow glyphs were rejected as
  "too tall and narrow"); thin strokes + wide letterspacing (letterSpacing ≈0.6em). The demo wordmark is
  video-shotcraft (brand guidelines require all lowercase): a geometric lowercase monoline, bowls are perfect circles,
  in a 64-high viewbox baseline 59 / x-height 22 / ascender 5, scaled ×1.3 overall with strokes counter-scaled to stay at 5.5px
- Draw-on curve: overall ease-in-out, slightly faster in the middle and slightly slower at both ends (the feel of starting and finishing a stroke)
- Background: atmospheric gradient/live-action establishing footage (dusk mountain scenery and the like); the wordmark is the only motion in the frame

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Draw-on duration | ~50f (starts f16, finishes f68 @30fps) | <30f the "drawing" process can't be read; >80f drags |
| Synchrony | All characters start and finish on the same frame, zero staggered overlap | Ruling: the per-letter staggered version was rejected with "all the letters finish being written at the same time" |
| Continuity | pathLength grows continuously, no segmented jumps | Ruling: the mask-segmented version was rejected with "it should be continuous strokes being drawn" |
| Glyphs | Skeleton monoline, letterform aspect ratio ~1.07, thin strokes | Tall narrow (ratio <0.8) was rejected; thick strokes lose the crystallising feel |
| Letterspacing | ~0.6em | Wide letterspacing is this card's identity; at <0.3em use an ordinary draw-on card instead |
| Final-state rest | ≥30f | After crystallisation completes the viewer must be allowed to read the whole word once |

## Known pitfalls
- Tuned on grayscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Division of labour with draw-svg-trace: that card is general draw-on (icons/illustrations/single elements);
  this card's make-or-break point is the whole-word crystallisation ceremony with **all characters synchronised**, and it's limited to the brand-wordmark context
- Division of labour with type-assembly-moves: that card assembles text blocks (combining by translation);
  in this card the strokes grow from nothing, and characters don't move
- Skeleton glyphs need hand-drawn paths (off-the-shelf font outlines are double-line outlines, the draw-on looks different);
  each of the demo's 13 lowercase glyphs (v i d e o - s h t c r a f) carries its own width w;
  in real use prefer reusing the demo's glyph library; for letters with multiple sub-strokes (the dot of i, the crossbar of t/f), place them
  at the end of the path in drawing order; after pathLength normalisation they still finish on the same frame
- In the source footage (superhuman-promo) the background is live-action dusk mountains + reflections on water; the demo uses
  a gradient approximation; in real use, live-action/AI-generated establishing footage is recommended

## Reference implementation
demos/opening/letterspace-materialize/
(LetterspaceMaterialize.tsx)
Source footage: superhuman-promo.mp4 ≈4.5–6.5s
