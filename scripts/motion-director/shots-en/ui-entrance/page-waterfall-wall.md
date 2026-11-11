---
name: page-waterfall-wall
one_liner: Page waterfall wall: real page screenshots cut into 3–4 columns scroll endlessly at different speeds and in opposite directions on a 3D wall tilted back; parallax + a slow camera push create a "so much content it never stops flowing" overview
use_when: Passages about the scale of "many pages / many features / many templates"; the middle laying-out section of a montage, or a product-breadth shot after the intro
length: 4–6s (an infinite loop body; length is trimmed to what the passage needs)
energy: medium (flowing display type)
---

## Intent
Flowing overview: let the viewer "see many pages flow past" in a few seconds; the read is volume, not detail.
Division of labour with outro-group-photo-launch: that is a **gathering** overview (elements fly in to surround the
wordmark and freeze for a group photo, meaning "they belong to the same product"); this card is a **flowing** overview (content keeps
flowing past without freezing, meaning "there's a lot more we haven't shown you").
Division of labour with wall-reveal-moves: that is the whole wall's **entrance action**; this card is the wall's **ongoing state**;
you can use that card for the entrance and then hand off to this card to keep it flowing.

## Motion core
- lib component `assets/lib/VerticalTicker.tsx`: parent layer perspective(1000px)
  rotateX(20°) scale(1.2) tilts back into a wall; each column is doubled [...items,...items] +
  progress modulo translateY 0→-50% for a seamless loop; top and bottom gradient masks finish the edges
- Different speeds and opposite directions are the make-or-break point of the parallax: the 3 columns' loop durations are offset (e.g. 12/9/14s) and the middle column runs in reverse.
  Same speed and direction reads as one big image scrolling; only different speeds and opposite directions read as "independent columns"
- The slow camera push lives on the outer layer (scale 1→1.06 linear across the whole shot); the wall loops by itself while the
  camera goes one way; the two motion sources have different directions and don't fight
- Material: real page screenshot slices (after Q1 desensitisation); card-level blocks are better than whole-page long images:
  with whole-page slices scrolling, the viewer has no time to read, while card blocks have complete recognisable outlines

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Column count | 3 (1080p) / 4 (ultrawide) | 2 columns don't read as a "wall"; with 5 columns each column is too narrow and the texture smears |
| loop duration | Adjacent columns differ by ≥25% (12/9/14s) | Speed difference too small and the parallax can't be read; fastest column <7s starts reading as "screen spam" |
| Direction | Middle column reversed (-1,1,-1 or alternating) | All same direction = one big image; a reversed column is the strongest evidence of "independent columns" |
| Tilt / perspective | rotateX 20° / perspective 1000px | >25° the top rows' text gets crushed and blurred by perspective (Q2); <12° the wall's backward tilt can't be read |
| scale | 1.2 base + slow push to ~1.26 | 1.2 is the floor that compensates for perspective shrinkage; below it the four corners show the backdrop; the demo puts the enlargement and push on an outer CSS zoom (layout-level scaling), so slice text isn't enlarged and softened (Q2) |
| Mask height | 200px | Too short and rows enter and exit hard; too tall and the visible area can't hold 2 rows |
| Loop period | The -50% offset must exactly equal one copy's period (content height + n·gap) | The lib already guarantees this with marginBottom; a hand-written implementation using flex gap will be off by gap/2 and skip a frame |

## Known pitfalls
- **Parameters borrowed from an external implementation (remotion-3d-ticker), not final;
  re-check with real material on first real use**
- Each column's total item height must be ≥ the viewport's effective height (otherwise the same slice appears twice on screen, which breaks the illusion);
  don't reuse the same image across columns; the same image appearing in two columns at once reads as a lack of material
- This card is an atmosphere/laying-out shot, not an information shot: text on the slices only needs to "look like a real page",
  not be read in full; if you want the viewer to read a particular block, hand off to spotlight-hero-card for single-lead treatment
- P4 de-duplication: coexisting with the outro group photo in the same film is fine (one flowing, one gathering), but the waterfall wall
  appears only once per film; a second appearance reads as padding the length

## Reference implementation
assets/lib/VerticalTicker.tsx (core component);
demo at demos/ui-entrance/page-waterfall-wall/ (PageWaterfallWall.tsx / VerticalTicker.tsx).
