---
name: fui-hud-moves
one_liner: FUI/HUD reticle bite: reticle-lock-on, a viewfinder made of four L-shaped corner marks flies in from out of frame, overshoots, bounces back and bites onto the target to lock
use_when: Any "look here" target call-out (replacing arrows and red circles, without freezing the frame)
length: 2–3s (demo 90f)
energy: medium-high (the bite frame is the hit point)
tags: ui-entrance
---

## Intent
A motif from sci-fi fictional interfaces (Jarvis/Territory) that can be neutralised: capture in motion.
Four L-shaped corner marks rush in from out of frame, overshoot, bounce back and "click" as they bite onto the target element's four corners + a label pops,
in a division of labour with freeze-annotate: that card freezes the frame to annotate, this card calls out while things flow.

## Variants
| Style | Approach | Use when |
|----|------|------|
| A reticle-lock-on | The four L corners = four mirrored copies of the same rectangle, with fly-in (10f out cubic) and contraction (2.2×→0.94×→1 overshoot and bounce back) decoupled; on the bite frame the target brightens slightly + the label pops out with back easing | Target call-outs; hitting a sound effect's downbeat |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Fly-in travel | Rushing in ≥1000px from out of frame | Short travel reads as "corner marks appear", not "pouncing in" |
| Overshoot | Contract past to 0.94× then bounce back to 1 | Without overshoot there's no "click" bite feel |
| Bite frame | Target white overlay quick flash 0.55 → resting 0.28 + label pops out on the same frame | Slight brightening and label on different frames falls apart |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- ≤2 times per film: repeated use reads as a military template; the two lock-on targets must be different
- Sound: one "click" on the bite frame (a mechanical click rather than a game UI sound, within the S1 boundary)

## Reference implementation
demos/effects/fui-hud-moves/
(ReticleLockOn.tsx)
