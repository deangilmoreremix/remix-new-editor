---
name: graze-face-tour
one_liner: Steep-angle surface-grazing roaming close-up — the camera flies low, skimming across the UI surface (sidebar tree / top bar / lists as terrain); the page text starts out floating above the interface with matching-shape soft shadows and, as the camera advances, accelerates down in turn to settle back onto the interface
use_when: Feature-area tours (flying over the UI as landscape); paired with a dark field + neon rim light for a product "inner world" section; interface content entering area by area
length: 4–5s per segment; multiple segments can be relayed to extend it
energy: medium-high (the camera keeps advancing + elements keep landing; high information density)
tags: ui-entrance
---

## Intent
Shoot the UI as terrain: the steep-angle close-up turns the sidebar tree, navigation and list rows into landforms sweeping past,
and the shallow depth of field reinforces the "skimming the surface" feel. The centrepiece is **text dropping from mid-air**: text/components do not fade in on the spot,
but float above the interface (raised on the 3D z axis), casting a matching-shape soft shadow onto the interface while in the air,
and as the camera advances they accelerate down in turn and settle, with the shadow converging and disappearing with height — the viewer watches the interface
"complete itself" as the camera passes. The shadow is the perceptibility make-or-break point: without the shadow, floating reads as
an ordinary positional entrance; with the shadow, the spatial relationship is established instantly.

## Motion core
- Camera position: CSS perspective + rotateX/rotateY at a steep angle (the surface almost grazed side-on),
  advancing continuously along a path across the interface; shallow depth of field = blur increasing into the distance
- Floating elements: initial float height H≈120–180px (raised along the surface normal),
  easeFall accelerating drop + soft landing (no bounce on landing, or an extremely slight one)
- Matching-shape soft shadow: the element renders a blurred, darkened projection at its home position, with blur/offset/opacity all
  varying with the current float height (high = shadow large, blurry and faint; landed = shadow coincides with the body and disappears)
- Staggered landing: each element's landing time is arranged along the camera's direction of travel (whatever is passed first lands first),
  so the interface "completes in sequence" in front of the camera
- A long take can be split into relayed segments: between segments use a crossfade between adjacent segments (ruling: opacity windows that don't overlap
  produce black flash frames)

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Float height | 120–180px | <80px neither the shadow nor the displacement reads; >250px the landing hits too hard |
| Shadow parameters | blur/offset/opacity converge linearly with height | A constant shadow that doesn't change with height = sticker feel; the shadow must go to zero on landing |
| Landing stagger | normalised 0.2→0.85 along the camera's direction of travel | All landing on the same frame reads as a switch; landing out of order reads as a bug; **staggered overlap = offset start points but the drops overlap and run in parallel**; serial waiting (one finishes landing before the next starts) was rejected |
| Drop curve | easeFall acceleration + soft landing | An ease-out drop reads as a balloon drifting down; the sense of gravity comes from acceleration |
| Segment relay | crossfade between adjacent segments ≥8f | If the opacity windows don't overlap there is a black flash (rework ruling: pure-black frame at f100) |
| Depth of field | blur increasing into the distance | Everything sharp reads as flat scrolling; only shallow depth of field gives the "skimming the surface" feel |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Don't let floating elements get swallowed by the ambient darkening band: elements in the air
  need a follow light / brightening of ~1.3x, otherwise the floating state isn't perceptible and it's as if it wasn't done
- Division of labour with space-camera-moves/tension-camera-moves: those two are camera
  language in itself; this card = the combined signature of the surface-grazing camera position **+ elements landing**; if either half is missing,
  use a camera card instead
- **Ruling on landing-rhythm semantics** (the counter-example of neon-frame-orbit-drop and vice versa):
  in this card's tour shot = staggered overlap in parallel; in an all-at-once entrance shot everything must land together on the same frame (that card's
  staggered version was rejected). Choosing the wrong grammar gets rejected either way
- The original footage (clickup-30) is one continuous upward-moving long take; the recreation uses three relayed segments, with the segment
  switches hidden in the crossfades — doing a true single long take in real use costs a lot more in path planning

## Reference implementation
demos/camera/graze-face-tour/
(GrazeFaceTour.tsx)
Original footage source: clickup-30.mp4
