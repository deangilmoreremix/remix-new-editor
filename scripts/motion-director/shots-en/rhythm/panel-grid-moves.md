---
name: panel-grid-moves
one_liner: Panel rhythm — comic-panel-split slices diagonal comic panels showing three camera angles of the same subject; snap-snap-snap three panels freeze, then the last panel's diagonal edge eats the screen into a poster
use_when: Using "panels" as a rhythm device: multiple frozen angles of the same subject side by side, sliced out panel by panel on the beat; beat-driven
length: 156f ≈5.2s (20f full-screen side shot + three-stroke panel split freeze + screen eat + poster hold)
energy: medium-high
tags: ui-entrance
---

## Intent
The difference from wall-reveal-moves is this card's positioning anchor: that one is "how the whole wall enters" (a one-off reveal); this one is "how panels act as a rhythm device" — the splitting happens on the beat, each panel change is a drum hit. A is juxtaposition: the frame is cleaved by three diagonal seams snap-snap-snap, three camera angles of the same product freeze simultaneously, hold for a beat, then the last panel's diagonal edge sweeps across and eats the whole screen — Scott Pilgrim's split-screen language. Suits multiple views of a single product (demo: a prime lens engraved with video-shotcraft, the three panels' caption boxes numbered "Shot 01 / 02 / 03", landing after the screen eat as a "Craft the shot." poster).

## Variants
| Variant | Approach | Use when |
|----|------|------|
| A comic-panel-split | Full-screen 3/4 side shot for 20f → three 12° diagonal seams slice out top-to-bottom one every 4f, the corresponding panel hard-cuts and pops in (5f scale 1.07→1 + white flash); the three panels = full body / partial close-up / macro of the same subject; the 29f freeze is kept alive by the subject's own action; the last panel pulls back 2f in reverse + a 14f sweep eats the whole screen into the poster | Multiple views of the same subject side by side; comic-style passages |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A diagonal seam | SVG double line: ink edge + cream paper core (total width 18px), 12° angle, each stroke drawn top-to-bottom over 3f | The paper core of the diagonal seam is the make-or-break point of the comic feel; a straight seam reads as a split-screen tool |
| A keeping alive | During the freeze the subject itself moves: focus ring turns 26°, aperture blades close, very slow push-in on the full-body panel | Three fully still panels read as a screenshot collage; "the lens is working" carries more content than a slow push |
| A caption boxes | Cream background + 4px ink stroke + 7px hard drop shadow, −2° tilt, stamped pop-in; they live inside the panel and get covered along with it | The comic language's second anchor; floating above the panels breaks the illusion |
| Closing | After the last line of text is revealed, ~50f poster hold (only a 1.5% extremely slow push-in) | R1; the matte-removal frame and the screen-eat final value must align pixel-perfectly to avoid a jump |

## Known pitfalls
- Tuned on fictional content (a vector lens) in the demo: the parameters are a starting point, not final; re-check with real material on first real use
- The three panels must be **different camera angles of the same subject** — stuffing different content into the three panels reads as bento layout, not comic panels, and the meaning falls apart
- Beat-driven and strongly sound-dependent: snap-snap-snap, one sound per panel (sound-design §4.5); panel splitting that doesn't hit the beat is just a layout animation
- Draw the subject as SVG vector (or high-resolution material): the panel angles go up to 2.45x zoom; bitmap screenshots blur when enlarged (Q2)
- At most 1 panel-split passage per film — the panel language is too distinctive; two passages collide

## Reference implementation
demos/rhythm/panel-grid-moves/
(ComicPanelSplit.tsx)
