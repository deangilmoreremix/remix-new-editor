---
name: scanline-assemble-flyin
one_liner: The page opens as a blueprint artboard with only a grid and dashed slots, and a bright scanline sweeps from top to bottom; at each slot it reaches, that component flies in from out of frame and overshoots into place, with directional trail blur and corner marks biting on landing: when the scan finishes the whole page has been assembled exactly
use_when: Openers where "the page generates itself"; core demos of AI site builder/auto-layout products; capability narratives from blank to finished product
length: about 5.2s (156f@30fps)
energy: medium-high (the scanline is steady, but each component fly-in is a burst point, density escalating)
---

## Intent
Give "the page being generated" a credible construction order: the scanline is the construction progress bar,
and components flying in from out of frame to snap into place are the construction actions. The key is that **the moment the scan finishes is exactly when the last piece is installed**:
the scanline finishing early or components dragging behind both dissolve the causal relationship of "scan drives assembly".

## Motion core
- Frame 1 is already the complete "construction drawing": full-screen blueprint grid (24px thin lines α.045 + 120px main lines α.085), the 1640×860 artboard's dashed outer frame
  with width dimensions, and each component's dashed slot (with small labels like `H1 820×250`): the viewer first sees "what will be installed, and where"
- Scanline 8→92f at **strictly constant speed** travels artboard y −20→880: white core + three layers of electric-blue glow, extending 60px past the artboard at each end and fading;
  180px of grid behind the line is lit, and **the page base colour is "brushed" in** (the artboard surface mask moves down with the scanline)
- Landing frames are back-calculated from slot bottom edges: `land = frameAtY(y + h)`, sorted by bottom edge and clamped to a minimum interval of 4f; the 14f flight **takes off early**,
  so the component arrives at the same time as the scanline. demo measured NAV 19f · BADGE 29f · H1 55f · BODY 66f · MEDIA 75f · CTA 79f · STATS 88f
- Each of the 7 components has an out-of-frame starting point: nav from above (0,−260), badge / H1 / body from the left (−620…−980), media card from the right (+900,+80, 6°),
  CTA / stats row from below (+420…+460); `EASE.overshoot` overshooting ~8% into place, rotation ±2–7° returning to zero in sync
- In motion, speed is computed by differencing the pose centre, and `SpeedBlur` trails along the flight direction (0.32×speed, ≤18px), cleared 4f after landing
- Landing: the slot's dashed line vanishes within 4f; four electric-blue L corners (arm length 22px) bite in from 20px expanded to 10px, bright at `land+1→+4`, retracting at `+5→+14`;
  not added for the full-width nav
- Status line `BLOCKS 0n / 07` + a stopwatch running live; after the last block lands it switches to `✓ BUILT` and the stopwatch freezes, the blueprint grid recedes to 30%,
  the media card (galaxy sample film shot) brightens a notch, followed by a ~50f hold

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Scanline | 84f constant speed, artboard y −20→880 | The finishing moment needs to be slightly after the last piece lands to read as "scan finished means assembly finished" |
| Trigger conversion | land = SCAN0 + (y+h−Y0)/(Y1−Y0)·(SCAN1−SCAN0) | To change the scan window change only the four constants; the flight duration FLIGHT is the early take-off amount, remove it and it becomes "only moving after being scanned" |
| Minimum interval | prev + 4f | MEDIA / CTA with close bottom edges would land together; only after clamping is there a "piece by piece" density |
| Fly-in displacement | 260–980px from out of frame, set by the component's position | Displacement under 200px reads as "a jiggle into place", not coming from out of frame |
| Fly-in rotation | ±2–7° | Over 12° reads as "tumbling", and the snap into place isn't snug |
| Fly-in easing | EASE.overshoot, 14f | Overshoot is the feel of "magnetically snapping into place"; pure ease-out becomes sliding in |
| Trail blur | Directional SpeedBlur 0.32×speed, ≤18px, cleared on settling | Isotropic blur reads as defocus rather than speed; not clearing leaves a permanent layer of blur |
| Landing corner marks | Expanded 20→10px, arm length 22px, 3f bright / 9f retract | The corner marks are the visual substitute for the sound of "biting in"; a full stroked flash box reads as a debug box, and firing it 7 times violates Q4 |

## Known pitfalls
- **Trigger moments are bound to the slot boxes in PLAN**: after changing the page template each component's box must be re-measured, otherwise components fly in before the scanline arrives
- Components are absolutely positioned in `Fly` with the slot as the origin; the corner mark layer is an SVG inside the component (overflow:visible),
  and if the component itself is `overflow:hidden` it clips the outward corner marks: put the media card's clipping on an inner layer
- "Brushing in" the page base colour uses a linear-gradient mask on the artboard surface (following the scanline y), and the blueprint grid is another layer;
  both layers follow the scanline; don't mask the grid as well, or the area below the scanline becomes dead black
- Shares the "the scanline is the causality" logic with `scanline-annotate-focus`; the two cards can be chained (assemble first, analyse after),
  but the scanline must reverse direction or leave a gap, otherwise it reads as repetition
- The page content is the video-shotcraft landing page (Frame Chisel logo mark + wordmark nav, "Shoot the / launch film." H1, sample shot card), with accent colours (electric blue / cyan) taken from LOOKS.midnight; to reskin change L

## Reference implementation
demos/effects/scanline-assemble-flyin/
(ScanlineAssembleFlyin.tsx)
