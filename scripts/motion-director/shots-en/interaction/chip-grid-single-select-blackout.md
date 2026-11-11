---
name: chip-grid-single-select-blackout
one_liner: Five option chips in a centred 3+2 layout fade in one by one; on the selection frame a gray press block is inserted for one frame first, then within a few frames the background turns ink black, the text turns white, with a very light 1→1.04→1 rebound, while the other chips fade to 18% but stay locked in position; then the rest go to zero, the black chip moves up and narrows, and the settlement price rises below
use_when: Interaction demos of single choice/plan/tier selection; the causal shot of "what happens after you pick it"; price/parameter settlement flows
length: about 5.5s (165f@30fps)
energy: low-medium (the only burst is that one-frame gray flash; everything else is winding down)
---

## Intent
One gray flash frame + three frames of reversal to black takes the real UI's two-level `:active → :selected` state
and performs them separately. What the viewer sees is "the finger presses" and then "the system confirms", not a single gradient. The other
chips drop to 18% and **their positions never move**: once they re-layout, the viewer thinks the page refreshed,
and the meaning of "single choice" is lost.

## Motion core
- 5 chips centred in two rows of 3+2 (1080p native: height 96, corner radius 48, gap 22, 36px text, fixed widths 346/364/476/236/330),
  rising snappy from 8f at 3f intervals; the eyebrow above + an 84px question arrive first
- The cursor moves 26–54f on a swift arc from the lower right to the target chip (causal preview), pressing at 56f
- **1-frame press gray flash**: only on the frame FS=56, a `rgba(120,128,146,.5)` overlay
- **Reversal to black**: 57→62f linear (5 frames) drives background white→ink black `#0b1020`, outline, and text ink→white, while ✓ grows out from 0 width
- **Press rebound**: `sc = 1 + sin(pr·π)*0.04`, pr runs 57→66f: the sine guarantees both start and end land exactly back on 1
- **Demoting the rest**: 57→66f outQuad presses opacity down to 18%, `transform` is always `none`
- Protagonist light: after the reversal to black, a very faint ring of cobalt landing light comes up beneath the chip (given only once and only to the protagonist), with the shadow deepening and growing as it lifts
- **Wind-down**: from 101f (≈1.5s after selection), the rest go to zero over 9f; the black chip moves up over 18f smooth to y=330, scale→0.88,
  returning horizontally to the centre line (geometry computed from the fixed widths, not measured at runtime); the question moves up and fades out at the same time to make room
- Settlement: at 108f the original price $42.00 rises → at 118f a strike line crosses it out and it fades to gray → from 116f the current price $34.44 rises letter by letter (180px)
  → at 128f the cobalt "Save 18% · billed $413.28 yearly" pops out with overshoot; 134–165f hold

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Entrance | From 8f, 3f intervals, 16f snappy each | The 5 chips are all laid out within 1s, leaving time for the selection segment |
| Selection moment | FS = 56f (about 1/3 of the film) | Read the question in the first part, see the result in the second; earlier than 40f and the viewer hasn't finished reading the options |
| Gray flash | 1 frame, rgba(120,128,146,.5) | **Just one frame**: give it 2 or more frames and it reads as a hover highlight, not a press |
| Reversal to black | 57→62f linear (5f) | linear is deliberate: adding ease gives "turning black" a sense of process, too soft |
| Press rebound | 1 + sin(pr·π)·0.04, over 9f | 0.04 is very light; at 0.1 it becomes a bouncy button and steals the scene |
| Demoting the rest | Down to 18%, position transform:none | **Locking position is the make-or-break point**: dropping to 18% while staying in place is what reads as "not selected" rather than "disappeared" |
| Wind-down moment | From 101f (≈1.5s after selection), 18f smooth in-out | 1.5s is the shortest dwell that lets the viewer see the selected state clearly; cut to 0.5s and it's rushed |
| Move up and narrow | To y=330, scale→0.88, horizontally compensated back to the centre line | Without compensating to the centre line it sits off to the left after moving up, reading as "being dragged away"; scale past 0.85 and the text falls below 32px |
| Settlement order | Original price → strike line → current price → savings pill, 8–10f apart | Show the old price first and then cross it out, so the viewer can read the causality of "it got cheaper" |

## Known pitfalls
- The selected chip's return-to-centre-line displacement is computed from fixed chip widths (offsetWidth isn't measured at runtime): when changing copy, update the width table to match,
  otherwise the text overflows or it drifts off the centre line after moving up
- The other chips' `transform` must be explicitly written as `'none'`; you can't rely on flex auto re-layout, otherwise the rest slide horizontally when they go to zero
- Placeholder content: 5 billing-period option names (Annual billing … Nonprofit rate) + the settlement "$42.00 → $34.44/mo, Save 18%",
  all to be replaced in real use; overly long option names will burst the fixed widths (the third, "Two-year commitment", is the long-name stress test)

## Reference implementation
demos/interaction/chip-grid-single-select-blackout/
(ChipGridSingleSelectBlackout.tsx)
