---
name: timeline-travel
one_liner: Timeline lateral move — the camera accelerates along a horizontal tick axis past version ticks, a card springs upright with a short stop at each tick, and it hard-stops and pushes in on the final tick
use_when: changelog/milestone/history passages (another way to shoot "we've been shipping all along"); division of labour with scroll-brake-moves: that card is a vertical list hard brake, this card is horizontal time travel
length: 4–5s
energy: medium-high (an accelerate → hard-brake rhythm shot)
tags: camera
---

## Intent
Shoot the product's version history as a journey along a timeline (the *The Kingdom* title sequence precedent): the camera moves laterally with three-stage variable speed — gentle start → sprint → hard brake; the v1.0/v2.0/v3.0 ticks sweep past in turn, and as each is passed its corresponding card springs upright from the tick line — history flashes past outside the window, it stops hard on "today" and pushes in. The speed itself says "fast development", the hard stop says "now matters most".

## Action phases
| Phase | Frame range reference | Content |
|------|------|------|
| 1 Rest | f0–12 | Empty axis + first tick held |
| 2 Accelerating sweep | ~f12–100 | World layer translateX with piecewise easing: gentle start → sprint → hard brake in the last 12% |
| 3 Card spring | During the sweep | The card starts springing 6f before the camera passes the tick (spring damping ~11, clear overshoot), standing up with scaleY using its bottom edge as the axis |
| 4 Hard stop and push-in | 10f from the hard-stop frame | scale 1→1.28 push-in on the final tick (out cubic), followed by stillness ≥30f |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Variable-speed curve | Input breakpoints [0,0.15,0.88,1] → output [0,0.055,0.9,1] | If the middle isn't fast enough there's no "journey" feel; constant speed throughout is cheap PowerPoint |
| Spring timing | Starts springing 6f before the camera reaches the tick, looked up in reverse via camXAt | Springing only on arrival and the audience has already missed it; too early reads as a preview |
| Tick density | 3–5 major ticks + several small minor-tick dots | Minor-tick dots are the reference for the sense of speed; delete them and you can't feel how fast it is |
| Hard-stop push-in | 1→1.28 / 10f | Without the push-in the hard stop is just "stopped"; the push-in is what makes it "arrived" |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final; re-check with real material on first real use
- If the mid-section sprint is so fast the cards blur, you can layer CameraMotionBlur (wrapping only the fast section, round #8 precedent)
- Budget the post-stop stillness up front: the demo's first version had only 25f of stillness, which failed; only moving the hard-stop frame earlier made it enough — when laying out the timeline, reserve ≥30f for the end first, then work the travel backward
- Each springing card is an information slot: in real use put real version-highlight screenshots / one-liners, and the sweep speed must ensure at least the last two can be read (same source as Q6)
- Sound: a light hit on each spring-up, one impact on the hard stop (same source as S2)

## Reference implementation
demos/data/timeline-travel/
(TimelineTravel.tsx)
