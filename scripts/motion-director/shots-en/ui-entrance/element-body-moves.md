---
name: element-body-moves
one_liner: Element body feel — contact-shadow-lift raises off the surface with a contact shadow: as a card lifts, its shadow on the table grows larger and fainter in sync, and the paper leaving the table is proven by its shadow
use_when: Adding "the body is changing" on top of "the position is changing": giving a called-out card evidence of floating; pairs with 2.5D camera moves and card-by-card callouts
length: A 150f 5s
energy: A low-medium
---

## Intent
The motion cards in the library all deal with "the position is changing" — flying in, sliding, bouncing — the element itself always a rigid body.
This variant deals with **the body changing**: giving floating a believable piece of evidence — as the card lifts, the shadow directly beneath grows larger and fainter in sync,
the paper leaves the table; it's the physical line the staging principle provides to support 2.5D camera moves. The difference from CameraMotionBlur:
shutter drag is the camera's business; lifting off the surface is the body's business.

## Variants
| Variant | Approach | Use when |
|----|------|------|
| A contact-shadow-lift | On a tabletop shot obliquely from above (rotateX 24°→20°), a card moves along its normal translateZ 96px + scale 1.05; the shadow is two independent solid layers lying on the tabletop at z=0 (contact core + ambient shadow) that grow larger, softer, fainter and offset toward the side away from the light as it lifts; a called-out card drops back in 8f in-cubic + a 2f slight press hitch; the final selected card springs up and stays in the air | Emphasis on card-by-card callouts; setting up the off-surface feel in 2.5D passages |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A lift amplitude | 2D: −28px + scale 1.08; 2.5D oblique overhead: translateZ 96px + scale 1.05 (visible on-screen displacement 40–50px) | Locked by precedent: visible on-screen displacement <12px is prohibited (see Known pitfalls) |
| A shadow | Independent divs (2D uses an elliptical radial gradient; 2.5D uses a rounded rectangle the same shape as the card + blur): contact core α 0.32→0.14, blur 3→25px; ambient shadow α 0.09→0.22, blur 14→54px, offset to the lower right; the card itself has no outer shadow | A box-shadow travels with the card and can't give "the shadow stays on the table" |
| A landing | scale 0.99 hitch for 2f then 5f rebound to 1 | Without the slight press it reads as drifting down, with no weight |
| Ending | After the last card is selected, hover ~50f | To loop, make the last card drop back the same way |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- A small-amplitude boost precedent: the original 8px lift was imperceptible, and only passed after being boosted to 28px — in real use never tune back below 12px; better not to use it than to use it weakly
- A lifts only one card at a time — with two leaving the table at once, the viewer can't find which one is being called out (P4)
- Sound: a light inhale on lifting / a light set-down on landing (sound-design §4.5)

## Reference implementation
demos/ui-entrance/element-body-moves/
(ContactShadowLift.tsx: three video-shotcraft shot recipe cards "Pick your shot." on a porcelain tabletop shot obliquely from above, sweep—sweep—select; the selected card is the Logo sting with the mark)
