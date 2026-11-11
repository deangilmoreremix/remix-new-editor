---
name: rhythm-interrupt-moves
one_liner: Interrupting the rhythm — jump-cut-punch-in three-step jump-cut push-in: same composition, three un-tweened hard jumps in scale, closing in on the target step by step
use_when: Using "breaking continuity" itself as the rhythm device: a jerky push-in (A); complementary to beat-cut-moves (cut-point arrangement)
length: A 135f ≈4.5s
energy: A medium
---

## Intent
The library's rhythm cards all handle "how to cut, how densely to cut"; this card handles **how to break** — the audience expects continuity, you deliberately interrupt, and the way you interrupt is the expression: A is a spatial break — the same composition jumps larger three times with no tween (1x→1.6x→2.6x), the jerk of a Godard jump cut, carrying more of an instructional "look here, closer, this is it" than a continuous push-in. Suits forcing focus onto a metric.

## Variants
| Variant | Approach | Use when |
|----|------|------|
| A jump-cut-punch-in | transform-origin pinned to the target's centre, three-stage stepwise scale jumps (zero tween), each jump adds a 2f darkening pulse as a tick | Closing in step by step on a core metric; documentary-style staring |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A jump stages | 1.0→1.6→2.6, each held ≥35f | A stage ratio <1.5× reads as the image shaking a little |
| A tick | Starting on the jump frame, 2f full-frame pulse brightness 0.92 | A jump cut without a tick reads as dropped frames |
| Closing | Final stage ≥45f truly still | For the interrupt family, the hold afterwards is given generously |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final; re-check with real material on first real use
- Both this and speed-ramp-freeze manipulate the "timeline"; one shot can have only one time manipulator
- The three stages' compositions must share the same origin (pinned to the target's centre) — re-composing at each stage makes it three shots, not a jump cut
- Strongly sound-dependent: one tick per jump (sound-design §4.5)

## Reference implementation
demos/rhythm/rhythm-interrupt-moves/
(JumpCutPunchIn.tsx)
