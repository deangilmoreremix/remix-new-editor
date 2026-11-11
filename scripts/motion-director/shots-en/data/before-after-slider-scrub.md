---
name: before-after-slider-scrub
one_liner: Before/after comparison slider — the "before/after processing" versions are stacked, the divider bar first whips fast then sweeps slowly, and the new version "develops" into view where the bar passes
use_when: Effect-comparison passages for AI enhancement/optimisation/refactoring features ("before vs after" explained in one shot)
length: 4–5s
energy: medium (the fast whip is the hit, the slow sweep is the reading period)
tags: interaction
---

## Intent
The standard comparison grammar of AI imaging product launch films: the same frame "before processing" (low-contrast grey haze) and "after processing" (the clear version) stacked, a vertical divider bar with a round handle first whips from the left edge to 70% (overshoot rebound), pauses a beat, then sweeps back at about 1/5 the speed to let the audience see the difference clearly — **the speed contrast of fast whip and slow sweep is the rhythm**: the fast whip announces "it changed", the slow sweep proves "where it changed".

## Action phases
| Phase | Frame range reference | Content |
|------|------|------|
| 1 Rest | f0–14 | Bar rests at 8%, the frame is almost entirely "before"; at f10–14 it first pulls back left in anticipation to 6.5% |
| 2 Fast whip | 12f | 8%→76% (out cubic) overshoot |
| 3 Rebound | 12f | 76%→70% |
| 4 Pause | ~18f | Let the audience see the after clearly |
| 5 Slow sweep | ~48f | 70%→40%, second showing of the difference |
| 6 Freeze | Last ≥40f | Truly still |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Speed ratio | Fast whip 12f vs slow sweep 48f, about 5:1 | A ratio <3:1 makes the rhythmic contrast imperceptible |
| Reveal | The after layer's clip-path inset right edge follows the bar's x | Any misalignment between the bar and the reveal boundary breaks the illusion |
| Handle | Round handle + slight scaleX stretch driven by velocity difference (peak 1.18), automatically returns to 1 at rest | The stretch gives the handle the weight of "being whipped" |
| Before treatment | Low-contrast grey-haze version | A before that's too ugly is self-mockery; the "worse" must be credible (the real old version / unoptimised state) |
| Corner labels | BEFORE/AFTER labels placed in the content area | Demo precedent: the first version covered the sidebar/avatar and broke the illusion |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final; re-check with real material on first real use
- Both versions must have the same layout and same camera position — different layouts read as two pages and the comparison fails (same constraint as theme-switch-moves)
- In real use both before and after are real screenshots (Q1): the before is the real state with old data injected / the feature turned off; don't hand-craft a fake "deliberately ugly" before
- The slow sweep ends at 40%, not 0% — leaving a stretch of the after on screen for the freeze (the conclusion is visible)
- Sound: one whoosh on the fast whip + a light tick on the rebound; the slow sweep silent or with a very faint friction sound (S4)

## Reference implementation
demos/data/before-after-slider-scrub/
(BeforeAfterSliderScrub.tsx)
