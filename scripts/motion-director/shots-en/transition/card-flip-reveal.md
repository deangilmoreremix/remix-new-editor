---
name: card-flip-reveal
one_liner: Feature-card 3D flip reveal: the card flips 180° about the Y axis, and as the front UI turns to its thinnest edge-on moment a band of light sweeps across, moving with the angle; the back reveals a big conclusion number, sweeping through the whole row card by card in staggered overlap
use_when: Paired "feature → result" narratives: a row of feature cards flips one by one to reveal each one's metric/conclusion; element-level transition card
length: 150f total (~5s, including hold); per card 4f anticipation + 16f flip + ~10f spring settle, three cards staggered by 12f
energy: medium-high
tags: data
---

## Intent
The "flip" family in the library already has the wipe-transitions venetian blind (slats flip one by one, about changing pages).
This card is a **semantic flip**: the front and back of a card are a cause-and-effect pair: the front is the feature interface,
the back is the numerical conclusion it brings. The flip action itself
is the answer to "so what?", the standard grammar of an Apple bento section. Staggered by 10f across
a row, three cards and three number beats read as "a rolling report of results".

## Motion core
- perspective 1600px + transformStyle preserve-3d; each face has
  backfaceVisibility hidden, the back is pre-rotated rotateY(180°)
- Flip in three stages: 4f anticipation (lean back the opposite way −10°, ease-out) → 16f
  bezier(0.55,0,0.3,1) accelerating flip to 194° (14° overshoot) → physical spring
  (damping 15) falls back to 180°; during the flip translateZ lifts by 60px (sin envelope)
- **Lighting**: faces are shaded by their angle away from facing front (`(1−|cos θ|)` darkening, dark face 0.55 /
  light face 0.4); in the 56°→124° edge-on range a narrow light band sweeps from the card's left to its right with the angle,
  its intensity a triangular envelope peaking at 90° (the thinnest instant). Only when the highlight is linked to the angle does it read as "light sweeping over
  a rotating face": it is physical lighting, not an extra glint effect
- **Front/back in inverted tone**: in the demo the front is a dark feature card (graphite dark field) and the back is a porcelain-white
  conclusion card, so flipping = going from dark to light; after all three flip the frame goes from a row of dark cards to a row of white number
  posters; the back's 158px number tightens 1.08→1 as it settles, the conclusion label rises 4f later, and the
  "before / after using it" comparison bars above shorten after settling
- Space: the cards stand on a dark mirror floor, each with a vertical mirrored reflection that flips in sync
  (mask fade 26%, opacity 0.22); the contact shadow width expands and contracts with the projected width |cos θ|
- Stagger delay 12f/card; after all have flipped, true stillness ≥40f (demo: from 72f, hold 78f);
  the camera does a very slow push-in 1→1.03 throughout

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Flip duration | 4f anticipation + 16f flip + ~10f spring | <14f and you can't see the edge-on instant; >28f reads as slowly turning; cut the anticipation and it reads as being knocked open rather than "flipped" |
| Overshoot | 194°→180° (14°), spring damping 15 | Settling without overshoot reads as a stiff stopwatch; damping <12 bounces twice and reads as jelly |
| Lighting | Face darkening ≤0.55 + narrow edge band peaking @90° | Peak offset from 90° reads as a texture error; sweep light without face darkening reads as a white strip pasted on |
| Stagger | 12f/card, ≤4 cards | Flipping simultaneously reads as a whole wall flipping, and the card-by-card rhythm of "rolling report of results" is lost |
| Back content | Big number (150–170px class) + one label line + at most one set of comparison bars | A full UI crammed on the back can't be read: after the flip there is only one beat of attention; with numbers over 160px, wide strings like "−41%" push past the card edge |
| Ending | Last card settles, true stillness ≥40f | R1 |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Front and back must be a semantic pair (interface → its result); flip to unrelated content and the flip
  is just a flashy image swap
- When the real-material front is a screenshot, watch the backface rendering cost; with more than three cards, split into Sequences
- Sound candidate slot: a light "snap" at each card's flip stop frame (sound-design §4.5); three snaps in a row
  doubles the rhythm

## Reference implementation
demos/transition/card-flip-reveal/
(CardFlipReveal.tsx)
