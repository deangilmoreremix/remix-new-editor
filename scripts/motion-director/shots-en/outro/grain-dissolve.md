---
name: grain-dissolve
one_liner: A whole line of text bursts into boiling grain noise as a hatched selection box emerges; the noise cloud rapidly condenses into a larger, glowing short wordmark, displacement decays to zero and it freezes
use_when: Closing "XX. Now Live"-style launch announcements; the energy-gathering beat that compresses a long sentence into a short brand mark
length: About 2.0s (60f@30fps; graining 0.26–0.56s · condensing 1.2–1.42s · solidify and settle to close)
energy: medium-high (a short, one-off energy pulse; a natural outro hit point)
---

## Intent
Shoot "condensing a sentence into one word" as a physical event: the sentence first destabilises and boils into grains (information disintegrating), the selection box hints "selecting and extracting", then all the grains' energy collapses toward the centre into a bigger, brighter short wordmark — what the audience reads is "it all comes down to this".

## Motion core
- The filter chain is the sole engine: `feTurbulence` (fractalNoise, baseFrequency 0.9→1.3) + `feDisplacementMap` (scale 0→52) + `feGaussianBlur` (0→1.1px), all three driven by the same `burst` curve (t=0.13–0.28, outCubic)
- The noise "boils" by changing the seed every frame with `seed = floor(t*46)` — a new noise map each frame, the grains never rest
- t=0.60–0.71 cross-fade: the full line (26px) fades out, the short wordmark (44px bold) fades in, both sharing the same filter — the switch happens at peak boiling so the audience can't see the word change
- t=0.68–0.90 the `lock` curve pulls displacement scale and blur back to 0, the grains "solidify" into crisp letterforms
- White glow in three stages: 0.3 weak light during graining → surges to 0.7 on condensing → settles to 0.45 after t=0.88; within the filter chain, two layers of cool-white bloom, "tight glow + wide glow" (feGaussianBlur → feColorMatrix → feMerge, radius about 4–33px), breathe in sync; the SVG is rasterised at native 1920×1080 so the grains are fine
- The hatched selection box (45° line array + pixel-checkerboard corner handles) emerges with burst and is withdrawn at t=0.55–0.64 — it exits before condensing, so it doesn't steal from the subject

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| displacement scale | Peak 52 | <30 is just "slightly frayed edges"; >80 the grains scatter beyond recognising the outline; "faintly legible" is the floor for the grained texture |
| baseFrequency | 0.9 → +0.4 | Higher = finer grain; below 0.5 it becomes large-block distortion, not "sand" |
| seed change rate | floor(t*46), 46 times in 2s | Lowering it makes the noise map repetition visible; keep a map change rate of ≥20 per second |
| Graining window | 0.13–0.28 (outCubic) | The clean text dwelling for the first 0.13 is the "normal state before destabilising"; cut it and there's no contrast |
| Condensing cross | 0.60–0.71 (inOutCubic) | The word change must complete within the peak boiling section; too early and you see two lines ghosted on top of each other |
| Glow envelope | burst·0.3 + cond·0.7 − settle·0.45 | The condensing surge is the hit point, land it on a BGM accent; don't settle to 0, leave soft-light "residual warmth" |

## Known pitfalls
- The demo copy is `{ video-shotcraft. Now Live }` → condensing into the `video-shotcraft` wordmark (all lowercase); when switching to a project's short mark, both `<text>` lines must change: the full-line pattern `{ XX. Now Live }` and the short mark XX must refer to the same thing, otherwise the narrative breaks
- If the short mark gets longer (>6 characters) shrink the font size or widen the selection box bw accordingly, otherwise after condensing it overflows the box and the visual centre of gravity shifts — the demo's 15-character brand name shrinks the full line from 33px to 26px and the short mark from 54px to 44px, and the landing range of stray grains widens to the wordmark's face accordingly
- `feDisplacementMap` performs poorly on Safari; this card is a 2s short beat so it's acceptable; stretching the duration requires measuring frame rate
- The selection box exit (0.55–0.64) must come before condensing completes (0.71) — a box staying until after solidifying reads as "not done selecting yet", inverting the meaning

## Reference implementation
demos/outro/grain-dissolve/
(GrainDissolve.tsx)
