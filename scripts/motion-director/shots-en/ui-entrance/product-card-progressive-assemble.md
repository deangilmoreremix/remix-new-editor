---
name: product-card-progressive-assemble
one_liner: A detail card builds itself as if being scraped field by field: a "fill cursor" jumps ahead from slot to slot; image → title → category pills pop in turn → the original price appears and is then struck through and demoted, the accent-coloured new price springs out → body text reveals line by line with highlight blocks brushing left to right → colour swatches light up → the button fills; the whole card pushes forward with an extremely slow scale throughout
use_when: Capability showcases for product/item detail pages; the main shot for "structured extraction", "autofill", "data grows by itself" type narratives
length: about 5.7s (172f@30fps)
energy: medium (densely arranged small continuous events, no single-point burst; the forward push keeps the sense of progression)
---

## Intent
If a detail card simply fades in, the viewer only sees "there's a card". Landing field by field instead turns the card into **a form
being filled in**: each field arrives on its own, and the viewer's attention is led through the card's information structure: where the image is, where the title is,
where the price is, where the key body text is. The price strike-through demotion is the only semantic event in the shot (not "appearing" but "changing"),
so it is placed in the most prominent position in the middle section.

## Motion core
(demo: porcelain look, native 1920 coordinates; the 1520×840 detail card takes 79% of the frame width; the product is video-shotcraft itself: the logo sits in the studio shot, and the title Shotcraft, selling points and colour swatches are all its own)
- The field schedule uses 30fps frame numbers directly: cursor arrives at image 8 / title 20 / pill 30 / price 42 / body 76 / swatches 96 / button 114;
  each field starts landing 2f after the cursor arrives; within a group the interval is 3f (pills, body lines, swatches), between groups 10–20f; the density of intervals is the information grouping
- Fill cursor: cobalt-blue 2.5px stroked box + 6px faint outer glow + a small AUTOFILL tag; between two adjacent field boxes it uses an asymmetric in-out
  (`cubic-bezier(.4,0,.2,1)`, 6f) to interpolate position and width/height together; finally it tucks into the button (ease-in 8f fade-out). This is the only light effect in the shot
- Skeleton slots: before a field lands, its slot holds a light-grey skeleton bar, which fades out with the landing progress: "a form is being filled in", not "elements are appearing"
- Two kinds of landing: `rise` (moving up 10–26px + 6px→0 defocus fade-in, expo-out 14f) for image/title/price/body; `pop`
  (physical spring damping 13, scale 0.4→1 with one visible overshoot) for pills and swatches; small pieces pop, large pieces rise
- Price demotion f62 ($449 fully landed then hold 18f): within the same 6f window "scale 1→0.46 + turn grey + a 9px strike-through line drawn from the left";
  from f63 the cobalt-blue new price Free (Apache-2.0 open source) springs (damping 14) from 1.18 down to 1, and the OPEN SOURCE chip slides in at f69
- Marker highlight: a cobalt-blue 16% background block `scaleX 0→1` (origin left), starting at f86 / f90, 6f each: faster than field landing, reading as "one stroke of the pen"
- Button: ink-black fill from f116 fills left to right over 12f, label fades in at f122
- Whole-card breathing: `scale 1→1.035` (asymmetric in-out) spread over 0–132f; entrance 0–14f scale .96→1 + moving up 30px; the last 40f is a still hold

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Field schedule | Cursor 8/20/30/42/76/96/114, landing +2f | 3 frames between same-type fields, 10–20 frames across types; making it all evenly spaced reads as a mechanical roll call |
| Cursor jump | 6f, swift in-out, box shape morphing in sync | <4f reads as a flash/teleport; >10f the cursor trails behind the fields, and "grabbing ahead" turns into "boxing after the fact" |
| Per-field travel | 14f expo-out | Travel much longer than the in-group interval → several fields in the same group move at once; the frame "surges" rather than "dots" |
| rise offset | 10–26px (by font size) | Large titles move more, small text less; >40px fights with the direction of the whole-card forward push |
| pop | spring damping 13, 0.4→1 | Pills and swatches are small, so the overshoot doesn't bump neighbours; using pop on large pieces looks cheap |
| Price demotion point | f62 (hold 18f after price lands) | You must leave time to "see the original price clearly first"; tight against the landing it reads as having always been a discounted price |
| New-price spring | damping 14, 1.18→1 | The only scale-up rebound event in the shot; lower damping makes it wobble twice and compete for attention with the strike-through next to it |
| Highlight brush | 6f, `scaleX` from left | 5–6f is marker speed; >12f reads as a background colour gradient rather than a pen stroke |
| Whole-card push | `scale 1→1.035`, 0–132f | Spread over 4.4s it is pure breathing; >8% the card hits the frame edge |

## Known pitfalls
- The field boxes (cursor landing points) are hard-coded absolute coordinates: after changing font size or copy, update the box in the `F` table accordingly, otherwise the cursor won't frame the fields
- The last field settles at ~f128, after which ~1.3s has only the extremely slow push: this is time for the viewer to read the whole card; don't cut it as a bug
- The three body lines are hard-coded `white-space: nowrap` (34px, line width ≤ 700px). With longer copy or Chinese they overflow the card edge;
  in real use you must re-fit font size and line length
- The new price and the discount chip are absolutely positioned (x estimated from the width of 112px bold digits); changing the number of price digits requires re-layout, otherwise the chip overlaps the text
- The content is video-shotcraft's example fill ($449 struck → Free, selling-point copy, four-colour brand swatches; $449 is only an illustrative original price); the field structure itself is the reusable part.
  After switching to real product data the number of fields often changes, and the schedule must be re-spaced according to the new field grouping
- The highlight start points (f86/90) are 8–9f later than the start of their lines' landing (f78/81); when changing line landing times you must change the highlights in sync, otherwise you get "highlight arrives first, text comes later"
- `BLUE` (cobalt) is the card's only source of hue (cursor + new price + chip + highlight); to switch to a brand colour, change the look's accent; everything else is neutral

## Reference implementation
demos/ui-entrance/product-card-progressive-assemble/
(ProductCardProgressiveAssemble.tsx)
