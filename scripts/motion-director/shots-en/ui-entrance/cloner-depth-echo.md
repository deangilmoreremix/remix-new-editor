---
name: cloner-depth-echo
one_liner: Clone column — the main card instantly "photocopies" 7 semi-transparent doubles that line up in a column receding diagonally into depth; after a beat they all accelerate back into the original, merge, and bounce
use_when: "Multiple copies / multi-tenant / sense of scale / batch processing" selling points; saying "one = many" in a single shot
length: 138f (about 4.6s)
energy: medium (display-then-gather type)
---

## Intent
A UI translation of the Spline/C4D Cloner vocabulary: a main card "snaps" out 7 clones
lined up at equal spacing backward along the Z axis (250px apart, opacity decreasing 100%→28%, the farther the more it's only an outline),
popping out into a column with staggered overlap; it holds ~32f so the viewer can count "there are many"; then they all ease-in accelerate back
into the original and merge, and at the moment of merging the original bounces to 1.06x and settles. The demo lands "one = many" on a concrete selling point:
one video-shotcraft render card (launch-film) × 8 shots; on merging, the 8 shot slots at the bottom of the card light up together, and the title lands "One prompt. / Eight shots.". Division of labour with depth-layer-moves parallax
(different content in layers): this is an equally spaced echo array of **the same content**, and the meaning is scale,
not space.

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Depth layout | Real 3D perspective, perspective 1500, vanishing point at top-left (360,120); clone translateZ = −250·idx, plus dx=−58·idx / dy=−6·idx | **Make-or-break point**: with pure translateZ and the vanishing point in the dead centre, the clones are all hidden behind the original (imperceptible); move the vanishing point to a corner of the frame and receding itself lines the column up toward that corner |
| Clone count / spacing | 7 / 250px | Fewer than 5 doesn't read as "a column", more than 9 and the tail blurs into a lump |
| Falloff | Opacity 100%→28% linear; fill fades away leaving only the accent-colour outline; increasing 0→1.6px depth-of-field blur with distance | Fainter and more "outline only" with distance = evidence of depth; clones keep only the top bar + line chart + shot number, don't repeat the big readout (it stacks into gibberish) |
| Spread / pull back | Spring staggered 2.2f per clone (damping 15, one light overshoot); pull back is a strong ease-in over 10f, all in sync, with trailing motion blur by depth speed | The spread must be staggered (photocopy feel), the pull back must be synchronous (gathering feel) — the asymmetric rhythm is by design |
| Hold | 32f, during which the camera pushes in very slowly by 2% + the column drifts with slight parallax | Too short and you can't count "there are many"; completely still is a dead frame |
| Merge | Main card sin single pulse 1.06x + one accent-colour outline glow (14f decay); on the same frame all shot slots light up and the counter rebounds | A pull back without a bounce reads as a fade-out; the bounce = evidence of mass |
| Count | Bottom-left 260px "×N", rolling one notch per clone popped out (5f; the outgoing digit moves up and fades + vertical speed blur) | The count turns "scale" from picture into number; don't clip the rolling digit with overflow, or the glow gets cut into a box |

## Known pitfalls
- Tuned on placeholder material in the demo (a handmade video-shotcraft render card, lime dark field): the parameters are a starting point, not final;
  re-check with real material on first real use
- Clones must render back to front to ensure correct occlusion; unmount conditionally when opacity ≤0.005
- The other two in the same batch of 3D channels (thick-slab turntable eliminated, corridor to be revised and reviewed) — pure-display
  3D camera moves are of doubtful fit; this card passed review thanks to the narrative action of "spread out - pull back";
  in real use don't let it degrade into a static column display
- Sound: a string of fine staggered "snaps" for the spread, a rising whoosh for the pull back, a solid "thud" for the merge

## Reference implementation
demos/ui-entrance/cloner-depth-echo/
(ClonerDepthEcho.tsx)
