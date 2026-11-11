---
name: type-entrance-moves
one_liner: One title-text entrance variant — letter-drop-physics character drop (slammed down by gravity, bouncing, standing crooked, and on the final beat all snapping to attention back into place)
use_when: Entrances for big titles / chapter title cards; same category as type-assembly-moves (assembly family) and document-typewriter-reveal (typewriter), choose one, mutually exclusive
length: 5s for the single variant (including hold and a still ending; action segment ~116f, demo 150f)
energy: medium-high (physical fun)
---

## Intent
The title-entrance library already has the typewriter (a steady document feel) and the assembly family (characters converging from elsewhere); this card adds
physical comedy — characters fall from the sky, slam into the ground and bounce, stand crooked, and on the final beat
all snap to attention back into place; suited to an icebreaker opening with a light-hearted tone (the demo has the brand name "Shotcraft" slam down and stand,
with the subtitle "Every shot lands on the beat." floating up on the beat of the snap back). Title entrances ≤2 kinds per film (P4).

## Approach
| Variant | Approach | Use when |
|----|------|------|
| A letter-drop-physics character drop | Characters slam down from the top with staggered overlap, gravity acceleration + two decaying bounces + standing crooked on landing, and on the final beat all straighten up together | Openings with a light-hearted tone; a "living creature" title icebreaker |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Drop | character i takes off at frame 4+36·(1−(1−i/(n−1))^1.5) (first and last characters fixed at 4f / 40f, the intervals getting denser and denser; demo 9 characters 6.5→1.6f); y = −DROP + DROP·(t/24)² (gravity) → 4u(1−u) parabolic bounce 30% → second bounce 9% | A bounce decay ratio of 30%/9% is the sweet spot of "springy but not rowdy"; three or more bounces read as jelly |
| Tilt | at the instant of landing, rotate to a seed hash ±6° and hold it | The tilt angle is half of the "physical feel"; everything landing perfectly upright reads as an ordinary translate entrance |
| Snap-back beat | after everyone has landed (e.g. frame 110), 6f ease-out, all together rotate→0 + scale 1.06→1 | The collective snap back is the full stop — a staggered snap back breaks up the ceremony of "standing to attention" |
| Ending | truly still ≥20f after the action is done | R1: all properties locked during the still period (including after the tilt angle returns to zero) |

## Known pitfalls
- Tuned on placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use.
- The landing thud is a candidate slot with strong sound dependence (sound-design §4.5): pinning each character's frame doubles the sense of weight;
  a silent version also works but has half the punch
- No real collision between characters (the demo uses independent trajectories per character) — just spacing them apart is enough;
  wanting them to "knock each other crooked" requires pre-baked trajectories, high cost and thin benefit
- Choose words that avoid letters with descenders (g/j/p/q/y), or calibrate the ground per glyph — the demo rests on the baseline,
  so descenders would "stick into" the ground
- Title entrances come with high attention built in — don't let them compete on the same frame with other high-energy entrances

## Reference implementation
demos/typography/type-entrance-moves/
(LetterDropPhysics.tsx)
