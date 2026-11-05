---
name: page-turn-transitions
one_liner: Whole-page volume transition: barn-door-split, a double-door split curtain (the old page splits in two and slides out, the new page comes up to meet you)
use_when: Chapter-level page changes: the "turning the page" ritual between two big sections where old gives way to new; division of labour with the shot-transitions family (shot handover): that is "the drone moves over", this is "the page itself is a solid object"
length: single style 150f (establishing the before state 30–40f + transition 24–40f + follow-through and ending ≥70f), about 5.0s
energy: medium-high
---

## Intent
The three styles of shot-transitions and transition-travel/hidden-cut all treat the page as a "scene":
the camera moves between scenes. This card treats the page as a **solid object**: it has thickness, weight, and can
split open. The volume metaphor has a stronger sense of ritual, suited to big chapter-level page changes (feature A done → feature B)
rather than small shot-level handovers. The double door is "the old making way": the old page tears open down the middle and slides away, the new page
comes up from underneath to meet you, implying replacement, dedicated to old-gives-way-to-new.

## Variants
| Style | Approach | Use when |
|----|------|------|
| A barn-door-split | The old page is two 960px overflow containers aligned and joined, which simultaneously slide outward and out of frame with ease-in acceleration (with horizontal motion blur by speed); light from the new page shines through the crack: the door's inner edge has a 10px lit bevel, the door face near the seam is tinted warm by the light, and the new page comes up with one overexposed light beam scale 1.08→1; the demo is a same-layout video-shotcraft version change: "Shotcraft 3" cool grey old page → "Shotcraft 4" ember launch page (eyebrow carrying the Frame Chisel logo mark), with data rolling from old values to new values (illustrative values) | Old gives way to new: before/after a redesign, plan A → plan B, version releases |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Foreshadowing | Before the split a hairline bright line (with bloom) draws up and down from the midpoint of the centre seam (20–30f); at 30–40f the crack ease-in widens 0→16px into a slit of light | Split open directly and the viewer didn't see where the split point is; a hard on/off flash line reads as a render glitch |
| Slide out | Each translateX ∓1000px / 24f, bezier(0.42,0,0.8,0.25) accelerating | ease-out sliding out is "being pushed away", only ease-in is "making way"; quart-in too strong reads as "stopping → vanishing on the last frame" |
| New page comes up | scale 1.08→1 (snappy 36f, taking off 2f after the doors), the overexposed beam decays ~30f as the doors recede; old and new pages share the same layout and slots | If the old and new pages have different layouts "replacement" can't be read |
| Tear edge | Inner edge 10px lit bevel (bright → accent colour → dark) + 620px light tint on the door face near the seam (screen); the doors cast no shadow on the new page | Without an edge line the two halves read as an ordinary left-right wipe; doors casting shadow into the seam grey out the light |
| Ending | After the new page settles, follow-through action (data rolling / checklist ticking) + hold ≥30f, with a very slow 1.5–2% camera push-in during the hold | R1 |

## Known pitfalls
- The demo is tuned on pages hand-built for the shot: the parameters are a starting point, not final;
  re-check with real material on first real use
- The one-seam-one-style rule is the same as shot-transitions; a volume transition is heavier than a shot handover,
  **≤2 times per film**; two consecutive seams both using volume read as PPT page flips
- The two halves must be **aligned and joined seamlessly** (right half inner layer translateX(−960px)):
  a visible seam when still gives it away; with real screenshots watch rounding of odd widths
- Both pages before and after the transition need ≥30f of still establishing/ending: if both ends are moving, the volume feel is
  drowned in motion

## Reference implementation
demos/transition/page-turn-transitions/
(BarnDoorSplit.tsx)
