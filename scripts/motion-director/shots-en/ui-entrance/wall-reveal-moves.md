---
name: wall-reveal-moves
one_liner: Two moves for a whole wall's batch entrance: bento cell-by-cell light-up and blueprint line-draw forming; both reveal in place without displacement, complementing deck-deal-flyin's fly-in displacement type to form a category matrix
use_when: The overall reveal of a feature wall / card wall / full-page interface; passages where the content is already in place and should "materialise" rather than "pour in"
length: about 5s per move (A 150f / B 150f @30fps, including the establishing hold and a still ending)
energy: medium
---

## Intent
For "how does a wall of content make its entrance", the library previously had only one answer, deck-deal-flyin: high energy, displacement type,
"things pouring in". But not every wall should pour in: a brand passage needs to be dignified,
"from design to the real thing" needs to tell the process. What these two moves share is **non-displacement batch entrance**: elements materialise in place,
the layout holds from the first frame, and what the viewer watches is "a wavefront of state change sweeping across a wall" rather than "objects in flight".
Ask one question when choosing: should this wall "pour in" or "light up"? The former goes to deck-deal-flyin, the latter to this card.

## Variants
| Move | Approach | Use when |
|----|------|------|
| A bento-light-up, cell-by-cell light-up | A dark-field 3×2 bento wall (two rows with complementary widths 600/420/420 ↔ 420/420/600, dark card faces) dimmed and on standby; an accent-colour comet streak strokes one lap around each cell in turn, the content then brightens and rises; once all are lit the camera slowly pushes in to finish; the eyebrow above the wall is the video-shotcraft logo + wordmark, main title "Every shot, tuned in one place." | Dignified content / dark-field brand passages; feature overviews with a steady rhythm |
| B wireframe-draw-on, blueprint line-draw forming | The interface is first drawn group by group as a thin-line SVG blueprint, then a glowing accent-colour vertical line sweeps left→right, and where it passes the wireframe materialises into the real interface (in the demo, the video-shotcraft workbench, with the Frame Chisel mark drawn inside the sidebar logo square) | "From design to the real thing / from idea to product" narratives; a product's first overall reveal |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A beat | hold 20f → cells activate in turn every 12f (six cells all lit at ~96f) → scale 1→1.04 slow push over 25f (bezier 0.33,0,0.2,1) → still ending | A 12f cascade is the balance point between "each cell distinguishable" and "the whole wall dragging"; with more cells it can be compressed to 8–10f, but the even spacing itself is where this move's dignity comes from; don't copy the card-dealing acceleration |
| A single cell | Dim state opacity 0.18 + translateY 20px; SVG rect pathLength=100 stroked over 8f: a comet segment of 22% of the perimeter (#e8b45e 6px Gaussian glow + #ffe3ae 2.5px bright core) leads, leaving a 1.5px thin edge behind it; when the stroke is halfway (+6f) the content pops out with back-out(0.3,1.4,0.5,1) over 8f, brightening and returning to place; +12f after the stroke finishes, the streak anneals to a 0.4 steady thin edge | Stroke and content pop must be **a relay, not simultaneous**: starting in the same frame reads as the whole cell flashing; the glow pulse mid-light-up uses a lit·(1−lit)·4 parabola, with peak amplitude varying slightly per cell by seed (sine hash; true randomness forbidden) |
| B line-draw | hold 20f → groups staggered, each finishing in 30f: sidebar starts at 20f / top bar at 30f / 6 cards at 40+i*3f / line chart at 52f; SVG pathLength=1 + dashoffset 1→0, blueprint cool grey-blue #6c7894 (outer frame 1.6px / inner parts 1.25px) round, light-blue 24px dot-grid base + card-corner crop marks | The group stagger is where the "a hand is drawing" feel comes from; all groups starting in the same frame reads as a printer; placeholder lines inside cards get a further fine +3f stagger, with lengths varied slightly by seed hash |
| B materialise | 88–118f the solid layer clip-path inset(0 right% 0 0) expands left to right over 30f, bezier(0.55,0,0.25,1); the leading edge is followed by a 4px accent-colour vertical line (#ffc46b + double-layer glow boxShadow), fading in at 86–92f and out at 112–120f; behind the line is a 260px fading warm glow (the residual warmth of just-developed image) | The line position and the clip leading edge must be driven by the same scan value; out of sync breaks the illusion; leave ~6f of breathing room between the line-draw section and the scan section (82→88f); scanning immediately after the wireframe finishes reads as rushed |
| Still ending | After all actions of both moves have settled, a true still of ≥15f (A counted from the end of the slow push, B from the scan line fading out) | R1 breathing precedent: during the still, every property is locked, including glow / shadow / highlight residue |

## Known pitfalls
- **Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use**
- A/B's accent-colour stroke / scan line fall under "single-point high-quality light effect" (compliant within Q4's three constraints), but per film
  a whole-wall light-up happens ≤1 time (P4 technique de-duplication): using both A and B in the same film counts as two whole-wall light effects; choose one
- Move B's wireframe geometry must align pixel by pixel with the solid layer's layout (in the demo, hand-laid to FakeDashboard A);
  changing material requires re-laying the wireframe; if misaligned, elements jump position the instant the scan line passes, which breaks the illusion at a glance; changing the brand name / logo
  also counts as changing material (the text width changes, and the elements after the breadcrumb shift right as a group); line lengths must be re-matched to the solid layer's measured text widths
- Both moves are "reveal in place"; don't mix in displacement entrances (e.g. adding a translateX fly-in during the cell-by-cell light-up):
  displacement needs go to deck-deal-flyin; a hybrid ends up resembling neither
- Move A's dim state opacity 0.18 depends on a dark base (#2a2a28) to work; on a light base the dimming reads as a faded glitch

## Reference implementation
demos/ui-entrance/wall-reveal-moves/
(BentoLightUp.tsx / WireframeDrawOn.tsx)

Implementation status: both moves have reference implementations and dynamic Gallery samples.
