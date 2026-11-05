---
name: carousel-3d
one_liner: 8 cards arranged in a ring; the whole ring spins one full turn (a constant-speed base + a stepped component that docks every 45°). Each card only revolves around Y and billboards outward; two front/back layers carry the same-facing artwork with backface-visibility:hidden so they are upright and never inverted at any moment. The card directly in front is lit up and the caption under the ring changes with it; the camera is pinned at a shallow downward angle throughout
use_when: Looping showcases of portfolios / template libraries / integration lists; background plates or landing-page heroes that need a seamless loop
length: about 5.6s (168f@30fps)
energy: medium (steady-state motion that can loop forever; one dock every 45° supplies the beat)
---

## Intent
The easiest way to show "a set of things" is a horizontal slide in a row, but a slide has a start and an end. A ring doesn't — it loops by nature,
and however long the viewer watches, it never feels "finished". What this card really solves is the point where ring carousels most often fall over:
the backs of the cards. The answer is double-sided, same-facing artwork, so seen from inside or outside the ring it's the same upright card, and over a full turn
not a single frame shows mirrored or inverted content.

## Motion core
(Demo version: acid-lime graphite dark-field video-shotcraft shot recipe gallery, cards 340×460, radius 700px, native 1920×1080 coordinates)
- The ring placement formula is a single line: `transform: rotateY(i*360/N) translateZ(RADIUS)` — first rotate to its own
  azimuth, then push out by the radius along the new Z axis. This step does both layout and billboarding: the card's normal naturally faces outward;
  the card turned to the front is pushed out an extra 44px along its normal (translation only, no rotation), reading as "selected" when it docks
- The whole ring's spin comes from the parent: `ring.transform = rotateY(-spin)`; the cards' own transforms contain only positioning.
  **A card never rotates around X or Z** — this is the fundamental guarantee of "always upright"
- The rotation isn't strictly constant: `turn = 0.5·f/168 + 0.5·stepPart(f)`, with `stepPart` taking one step every 21f (8f dock + 13f smooth change).
  The constant base keeps the ring always moving (loop steady state); the stepped layer gives a "push—dock" every 45°; 8 steps × 21f = 168f is exactly one turn,
  at f=168 turn=1, and first and last frames join pixel-perfectly
- Double-sided same-facing artwork: front and back use **the same card face**, back adds an extra `rotateY(180deg)`,
  and both layers set `backface-visibility:hidden`. So from outside the ring you see front, from inside you see back, and both contents
  face the same way — with only one layer you'd see mirrored text when it turns to the back of the ring
- Front-card highlight: `hl = smooth(1 - |azimuth|/26°)` drives the fluorescent outline, graphic colour (graphite grey → fluorescent yellow-green interpolation) and the push-out amount;
  the caption below the ring (mono number + 72px name) rolls upward in a clipping window with the stepped layer to change text, freezing on each dock
- The camera is fixed and doesn't move for a single frame: `perspective: 2200px`, ring container `translateZ(-RADIUS) rotateX(-9deg)` —
  the front card sits at z=0 (rasterised at native size, so text stays crisp); all motion comes from the ring's spin; this is a "gallery", not a "roller coaster"
- Floor: a reflective disc at 2.7× the radius + a 96-tick scale ring (rotating with the ring) laid flat under the cards' feet with `rotateX(90deg)`; plus a reflection ring mirrored on the floor plane
  with `scaleY(-1)` (leaf layers at 8% opacity + fade-out mask; opacity must not be put on the preserve-3d container, or the whole ring gets flattened)
- Aerial perspective: based on each card's azimuth, `(1-cos θ)/2` overlays a layer of background colour on the card face (70% at the very back), so the ring's front/back relationship reads at a glance

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Number of cards | N=8 (45° azimuth spacing) | 8 cards on a 700px radius don't occlude each other front to back; >12 cards press into each other's edges and RADIUS must grow in step |
| Radius | RADIUS=700px (card 340×460) | Radius / card width ≈2 is the density sweet spot; below 1.5× the cards at the back of the ring squeeze through the gaps between front cards and the frame gets messy |
| Speed composition | 50% constant + 50% stepped (21f/step, dock 8f) | Stepped share >70% and the whole ring almost stops when docking, and the loop reads as "stuttering"; <30% the docking feel disappears and it's flat constant speed again |
| Number of turns | 1 turn for the whole clip (8 steps) | Both turns and steps must be integers to loop; non-integers jump on the last frame |
| Perspective | `perspective: 2200px` | Relatively flat perspective for a 700 radius; below 1200 near cards are exaggeratedly enlarged and read as fisheye |
| Camera tilt | `rotateX(-9deg)` | Just "looking slightly down", exactly enough to show the floor disc and tick ring; beyond -20° the ring squashes into an ellipse |
| Highlight window | azimuth ±26° | Too wide and two neighbouring cards are half-lit at once, the hero isn't clear; too narrow and the whole ring goes grey mid-change |
| Reflection | 8% opacity, fade from 62% | >15% the text in the reflection becomes readable and fights with the caption below |

## Known pitfalls
- The steady-state loop is both this card's feature and its limitation: **it has no beginning and no end**. The stepped docking provides a beat, but as a main shot it's
  still flat; it suits use as a background layer, loop material, or layered with foreground text / camera moves
- All 8 cards' transforms are reset every frame (`rotateY(i*45) translateZ(RADIUS + 44·hl)`) — the rotation component is constant,
  only the push-out along the normal changes with the highlight. This makes "the card itself doesn't take part in the rotation" explicit in the code; don't attach the push-out to the rotation
- `backface-visibility:hidden` needs the `-webkit-` prefix on some WebKit builds (the code writes both).
  Miss the prefix and both face layers are visible at once, piling the card content into a mess
- The card faces are handmade shot recipe card placeholders (mono number + generative graphic + big number + name); in production replace them with real screenshots,
  **and front/back must be replaced with the same content**, otherwise the double-sided same-facing premise is broken
- When the ring turns to the back, the card is "the front facing away from the viewer" (you're seeing the back layer), so the content is always readable — but that also means
  there's no room for a "flip reveal". To do a flip you must give up the backface-hidden approach and build a different setup
- Dark soft-light background + graphite card faces + aerial-perspective darkening are one set; switching to a white background means re-tuning both the darkening layer and the reflection
  (darkening becomes blending toward the background colour, reflection opacity drops to around 5%)
- The caption's "current card" comes from the stepped layer's step number, not the real azimuth: the constant base moves the ring about 8.6° more during docking,
  so the front card sitting slightly left is normal; if you change the stepped share, confirm the highlight window (±26°) still covers this drift when docked

## Reference implementation
demos/ui-entrance/carousel-3d/
(Carousel3D.tsx)
