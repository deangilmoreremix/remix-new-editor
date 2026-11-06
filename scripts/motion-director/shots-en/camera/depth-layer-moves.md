---
name: depth-layer-moves
one_liner: Layered-depth camera move — a multi-layer parallax slide: 3 layers with a speed gradient pan sideways to create depth, and the hero lifts when the slide settles
use_when: Sections where a flat screenshot needs "thickness": horizontal tours of card groups / lists / whole pages
length: 4–5.5s sustained (demo 165f)
energy: medium (texture-driven)
---

## Intent
A whole-page pan is "looking at the page"; layered depth is "being inside the page's space". The parallax slide adds depth to a horizontal pan
(the principle of Disney's multiplane camera; the same texture as the Linear video).

## Motion core
- **Parallax slide (3 layers + a 0x text layer)**: one drive displacement multiplied by each layer's coefficient — the background is the whole page (0.35x + scaled up one notch + blur 5px +
  desaturated to 0.7 + a same-colour atmospheric haze, dense at top and thin at bottom, so it recedes into ambience), the midground is the real card group (0.7x, the main reading layer, no blur, two soft shadow layers falling on
  the "desk"), the foreground is floating chips (1.4x + blur 7px + deep, distant drop shadow + horizontal speed-based smear, sweeping past the lens). The demo (MultiplaneReal) uses
  warm sand beige: the foreground is 5 enlarged terracotta / ink tag capsules (taken from the real tags on the cards), and a static title layer is pinned on top of the frame
  (0x: video-shotcraft logo mark + wordmark eyebrow, "Your page, in depth." at 120px) — the text stays still while the world moves, which actually makes the parallax easier to read
- The slide has an end point: the total drive is solved backwards from "card4 sits exactly at screen centre when the midground settles", asymmetric in-out (bezier 0.45,0,0.18,1) over 130f;
  after settling the hero lifts (elevation 6→26, 1.035x, ~8f later than the position converges) + terracotta outline + an 「In focus」 corner badge, and the final frame is the poster;
  the foreground capsules' world coordinates are laid out so that "when it settles only two are left, pressing on the bottom edge of the frame"
- Don't break apart the real page layout: the whole page forms a layer as one piece, and independent elements are cut out as slices into their own layers — the relationship between layers is "depth of field", not "the page torn apart"

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Parallax layer coefficients | 0.35 / 0.7 / 1.4 (+ 0x text layer) | The gradient between layers must be ≥2× to be distinguishable; ≤4 layers to avoid overload |
| Layer anchors | foreground/background blur + background desaturation + atmospheric haze | Without blur/saturation anchors it reads as "stickers flying around" |
| Slide end point | drive solved backwards so the hero is centred | A constant-speed pan with no end point reads as a screensaver; after settling give the hero a beat of lift |

## Known pitfalls
- The main reading layer must be a high-resolution texture with no blur — the viewer is reading it
- A full-screen real-time `filter: blur()` on a whole layer that changes every frame is very expensive (measured at 3× or more render time): put the blur on small elements inside the layer, not on a layer container that fills the frame
- The combination of parallax with PageCam rot 3D (parallax at an oblique angle) is unverified; in real use render a still first to confirm
- Parameters were tuned on placeholder material before being promoted; they are not final for real use — re-check after the first real use

## Reference implementation
demos/camera/depth-layer-moves/
(MultiplaneReal.tsx)
