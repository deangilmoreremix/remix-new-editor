---
name: scroll-brake-moves
one_liner: Two variants of long-scroll hard braking — changelog-scroll-brake, the basic version (high-speed long scroll, exponential deceleration, precise stop + target lift), and brake-reticle-lock, the combo version (reticle snaps shut on the same frame as the hard brake)
use_when: changelog/release history/long list passages: "we've been shipping all along, and today's is the biggest"; use B to give the stop point a stronger impact
length: A 4–5s / B 5s
energy: high opening, medium close (speed-contrast type)
tags: rhythm
---

## Intent
Linear changelog video grammar: a whole year of update logs sweeps past at high speed as a long scroll (blurring into colour bands), decelerates exponentially and brakes precisely on this release's entry, which lifts off the surface and highlights while the rest dims — density says "we've been shipping all along", the hard stop says "today's is the biggest". B is a combo variation: on **the same frame** as the hard brake, four L-shaped corner brackets fly in from off-frame and snap shut, locking onto the stop entry — the brake's "clunk" and the snap's "click" stack and resonate on the same frame (the combo's make-or-break point: the brackets' launch frame = the list's first stop frame; offset them and it degrades into two moves placed side by side).

## Variants
| Variant | Approach | Use when |
|----|------|------|
| A changelog-scroll-brake | translateY sweeps ~2400px (cubic-bezier(.45,0,.06,1): ~5f to full speed then a long-tail exponential-style deceleration, 50f total), vertical directional blur driven by inter-frame displacement difference (×0.32 capped at 30px, automatically clears to zero when settled); the stop row lifts with scale 1.03 + shadow + 2px accent-colour stroke, the rest dim to opacity 0.38 | The basic version for changelog passages |
| B brake-reticle-lock | Scroll in three segments: sin-in acceleration → cubic-out hard deceleration overshooting by +30px → rebound to rest; vertical directional blur = v×0.15 capped at 32px; corner brackets fly in from ±620/±320 off-frame with Easing.back(2.4) and snap shut, highlight completes within 6f, label pops out with back(2.6) | Highlight passages where the stop point needs a stronger impact |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Deceleration curve | A fast start + long-tail deceleration (bezier .45,0,.06,1); B adds "overshoot 30px and rebound" | A constant-speed scroll reads as a marquee; B's overshoot rebound is the source of the "clunk" |
| blur driver | Inter-frame displacement difference `|p(f)-p(f-1)|` × coefficient | Hand-placed blur keyframes will inevitably mismatch the speed; the difference method is frame-deterministic (the pattern has been distilled into assets/lib/helpers/motion.ts velocityAt) |
| Row-height rhythm | 72/94/116 three staggered tiers | Equal-height rows sweeping at high speed make colour bands with no rhythm |
| Stop position | Target row stops at the vertical centre of the frame | Stopping off-centre reads as an accident |
| B resonance frame | Bracket mount launch frame = the list's first stop frame (strictly the same frame) | The combo's make-or-break point; off by 2f or more and it falls apart |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final; re-check with real material on first real use
- Division of labour with timeline-travel: this card brakes on the "latest" in a vertical list; that card travels a horizontal timeline to look at "history" — when using both in the same film, separate them in sequence and each ≤1 time
- Entries in the high-speed section don't need real readable text — they blur into colour bands anyway, placeholder grey blocks are fine; the stop entry must have publication-grade real content (Q10)
- Dimming the other rows to 0.38 after the stop is a compositional move: don't dim to 0 (the context disappears)
- Sound: a low-frequency riser leading in during the high-speed section, one impact on the hard brake; B stacks one more "click" on the snap frame (same frame as the impact, different voice)

## Reference implementation
demos/data/scroll-brake-moves/
(BrakeReticleLock.tsx / ChangelogScrollBrake.tsx)
