---
name: neon-frame-orbit-drop
one_liner: After the neon frame draws itself first, the camera rotates around the page in a left→right arc, and all of the page's components/text drop from the air onto it **in the same frame** (same-shape soft shadows converging in sync): a whole-page entrance placed inside the frame
use_when: A one-off grand entrance for a single UI page (as opposed to a tour / zone-by-zone reveal); the main visual unveiling of a dark-field neon-toned passage; sister shot of neon-frame-forerun
length: frame draw ~0.5s + rotation & simultaneous drop-in ~2.5s + settle ~1s; whole passage ~4.7s (140f; rotation stops at 128f, leaving time to settle)
energy: medium-high (one big one-off action; still once settled)
tags: effects, camera
---

## Intent
The twin variant of neon-frame-forerun: likewise frame first, content dropping in after, but the camera
is not fixed: it rotates in a continuous arc from a left-side view of the page to a right-side view, and while the rotation
is under way all components drop from the air. The make-or-break point is **simultaneous landing**: all components and text
lift off in the same frame, land in the same frame, and their soft shadows vanish in sync. This is the grammar of the "whole entrance"
(precedent: the staggered version was rejected with "all components and text should drop from the air onto it at the same time").
Staggered drop-in belongs to the tour shot (graze-face-tour); a page's one-off reveal
must land all together; the rhythmic semantics must not be mixed.

## Motion core
- Neon frame draw: a gradient neon frame race-draws into shape in ~14f (same as neon-frame-forerun)
- Viewing-angle arc: rotateY +38° → -26° in a continuous arc (perspective origin 30%→64% following along
  to approximate a camera orbit), running through the whole shot
- Simultaneous drop-in: all elements share one LAND moment (normalised ~0.52): lift off and hover
  in the same frame, descend through the air in the same frame, land in the same frame; FloatWrap same-shape soft shadows (blur/offset/
  opacity with height) all converge in sync
- A background cluster of neon tube frames dresses the scene and gives way after the main panel settles

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Drop-in simultaneity | All elements lift and land in the same frame (zero stagger) | **Make-or-break point**; any stagger reads as tour grammar (see above for the precedent ruling's original words) |
| Viewing-angle arc | rotateY +38°→-26°, perspective origin following | Small arc reads as shaking; rotating without dropping = spinning idle |
| Rotation × drop-in coupling | Drop-in window centred on the rotation travel | Dropping only after rotation finishes = two separate scenes; still rotating after the drop = can't wrap up |
| Hover height / soft shadow | Same as graze-face-tour (100–180px, shadow with height) | Imperceptible shadow = not done (cumulative precedent) |
| Frame draw | ~14f race-draw | Same as neon-frame-forerun |

## Known pitfalls
- Parameters passed two rounds of tuning on placeholder material, not final; re-check with real material on first real use
- **Precedent on drop-in rhythm semantics** (this card and graze-face-tour are each other's counter-example):
  tour shot = offset start points + overlapping parallel falls; whole-entrance shot = everything in the same frame. Choose the wrong grammar
  and either one gets rejected
- Division of labour with neon-frame-forerun: that card has a fixed camera, staggered drop-in + page light-up
  interlocking in three layers; this card has a rotating camera + all landing in the same frame. Pick one per passage, don't use them back to back (same frame
  language repeated)
- The arc rotation is a perspective-origin approximation rather than a true 3D camera orbit; at extreme angles the frame glow
  deforms slightly flat. If a real job needs a large-angle orbit, consider a true 3D scene

## Reference implementation
demos/ui-entrance/neon-frame-orbit-drop/
(NeonFrameForerunOrbit.tsx)
Source footage: no corresponding original passage
