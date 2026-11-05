---
name: orbit-ring-title-open
one_liner: On a graphite dark field, eight dark 16:9 content cards are evenly distributed at 45° on a 720×380 ellipse and orbit at constant speed (the card bodies never tilt; depth comes only from sin θ giving ±12% scale, z-order, and dimming/defocus in the distance); while the ring opens out the card contents are frozen on their first frame, and after f24 all eight start playing together; a centred two-level title de-blurs and sinks into place letter by letter, the moment the keyword lands a fluorescent marker block sweeps from left to right to fill it, and the letters it passes reverse to ink, then a mono subline floats up; optionally at the end the whole line defocuses and fades out while the ring keeps turning to hand off to the next shot
use_when: First shot of an opening = "this product has a whole set of things"; the storefront shot for an asset library/template library/feature matrix/case collection; when you need genuinely moving product footage to support a claim, rather than laying screenshots out as a static 3×3 grid
length: 150f (5s@30fps; 2.9s of steady-state touring + a very slow push-in after the marker block lands at f64; with HANDOFF_EXIT on, the exit handoff starts at f118)
energy: medium (the only sustained motion is the constant-speed orbit; the whole film has only one impact, the marker-block sweep)
tags: ui-entrance
---

## Intent
When an opening wants to say "we have a whole set of things", the most common approach is to arrange screenshots in a grid, but a grid is static, and what the viewer
reads is "a pile of images", not "a set of products that move". This card turns the display into a **circular tour**: eight cards orbit along an
ellipse at constant speed, there are always cards entering and cards leaving the frame, the image carries a built-in hint that "there's more", and the title stays firmly
pinned in the very centre, unaffected.

The key trade-off is that **the card contents must really be playing**. With static screenshots on the ring, the viewer will only recognise a "carousel"; with real
motion running inside the cards, the same ring immediately becomes "the product at work". But if all eight cards start playing at once, eight animations fight for attention and none of them can be read
. So during the entrance the card contents are **frozen on their first frame**, and only once the ring has opened out and the title has started do they all start playing together. The viewer's attention
order is therefore: first recognise that this is a ring of product footage → read the title → only then notice that everything inside the cards is moving.

## Motion core
- **Positioning on the ring**: `θ = -π/2 + i·2π/8 + t·0.3`, `x = 960 + cos θ·RX·ringScale`,
  `y = 540 + sin θ·RY·ringScale`. An ellipse with RY/RX ≈ 0.53 reads as "a ring seen from above"; a perfect circle reads as a turntable.
  The elliptical orbit itself is drawn as a ring of accent-colour hairline at 16% opacity, traced out with pathLength during entrance 0–30f
- **Card bodies never tilt**: a card only changes position with θ; its own transform is only scale, with no rotation whatsoever.
  Depth is handed entirely to `depth = sin θ` (+1 = bottom of frame, near; −1 = top, far):
  `scale = 1 + 0.12·depth`, `zIndex = 10 + round(depth·5)`; in the distance (depth<0) additionally stack
  `blur(1.6·|depth|px)` + a dimming layer (depth of field + aerial perspective), and near ones get a little top light. Scale, z-order and
  brightness must be driven by the same depth, otherwise you get "a far card covering a near card"
- **Ring entrance**: f0–24 `ringScale 0.62→1` (expo-out, 80% covered in the first 1/3 of the time) opening out from the centre;
  at the same time each card fades in, card i fading in over 11f from frame `2+1.5i` and growing 0.9→1. Opening out and fading in overlap,
  reading as "the ring grows out" rather than "cards being stuck on one by one"
- **Freeze the first frame, then play**: card contents are wrapped in `<Freeze frame={max(0, frame - 24)}>`. Before f24
  all eight cards stay on their own frame 0; from f24 they all enter the normal timeline together
- **Decoupled in-card coordinates**: card contents are drawn at 960×540, and the outer layer uses `scale((CW·s)/960)` to shrink to card width +
  `transform-origin: top left`. Content components don't need to know they've been shrunk; when you swap in real screenshots or
  other shot-card components from the library in real use, not a single line needs changing. For line-drawing cards use `pathLength={1}` for the dash, so path length doesn't affect the first frame
- **Two-level title, per-letter blur-slide**: top line 64px secondary gray (starting f10, staggered 1f, 27f per letter), bottom line
  156px protagonist large text (starting f18, staggered 2f, 32f per letter: heavier and slower). Each letter has two channels that start together but end differently:
  de-blur runs the full per-letter duration (`blur (1-p)·fontSize/6`), the sink takes only the first 1/3 (`translateY (1-p)·fontSize·0.22`),
  easing quint-out. Translation stops first and blur stops later, so the letters have the feel of "continuing to come into focus after landing"
- **Marker-block sweep + reverse-out**: `spring(frame-50, damping 20, stiffness 190)` drives `scaleX`
  (capped at 1.03), `transform-origin: left center`; the block is 0.14em wider than the text on both left and right, sitting beneath the letters.
  The text is drawn in two layers: the white-text layer is clipped to the left of the block's leading edge, the ink-text layer (onAccent) is clipped to the right of the leading edge, and the leading-edge position is converted to the text box by
  `(m·(W+0.28em) − 0.14em)/W`: reverses out as soon as it's swept, reading as "run over by a highlighter"
- **Title scrim**: a dark radial scrim sits above the card layer and below the text layer, so near cards passing behind the title are dimmed
- **Hold**: f40–150 the whole frame pushes in smoothly by 2.5%, and the ring keeps orbiting at constant speed
- **Exit (optional, HANDOFF_EXIT)**: from f118, over 10f the whole line goes `opacity 1→0` + `blur 0→6.5px`,
  after which only the ring is turning; turn it on in a finished film when cutting into crash-zoom / a straight cut through a shallow field; a single-shot demo stops on the complete poster
## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Ellipse radii | RX=720 / RY=380 (cards 400×225) | RY/RX≈0.53 is the sweet spot for "ring seen from above"; ratio →1 reads as a circular turntable, →0.3 the cards squeeze into a strip at the top and bottom edges |
| Card count | 8 (45° azimuth spacing) | At this radius 8 cards never overlap at any rotation angle; ≥10 cards require enlarging RX/RY to match, otherwise near cards press against the edge |
| Orbit speed | 0.3 rad/s (about 86° in 5s) | **Don't speed it up just because "it looks slow"**: at >0.5 rad/s cards sweeping past the frame edge strobe, and it upstages the main subject |
| Ring entrance | f0–24, scale .62→1, expo-out | <15f looks like a popup; >30f the ring is still growing when the title starts, the two things cover each other |
| Per-card fade-in | Card i from frame `2+1.5i` over 11f | A 1.5f step is just enough to read "one after another"; >3f the last card arrives after the title |
| Playback start frame | PLAY_START=24f | Must be ≥ the frame where the ring finishes opening out; starting earlier makes eight animations fight for attention together during the entrance |
| Depth | Scale ±12%, distant defocus ≤1.6px + dimming | Scale >15% shrinks the top cards to icons and the ring reads as a "perspective tunnel"; defocus >3px makes distant cards read as dirty |
| Title | Top line 64px/500 gray + bottom line 156px/600 white | The ring is always moving, so the protagonist line must be big and heavy enough to hold its own; two lines at the same size lose their hierarchy |
| Per-letter rhythm | Top line stagger 1f/27f per letter; bottom line stagger 2f/32f per letter | 1–2f stagger is the "whole thing de-blurs" feel; ≥3f reads as a per-letter typewriter |
| Marker block | From f50, spring damping 20, fluorescent yellow-green #c6f432 | damping <14 rebounds past the block edges; in the dark field it's the only high-saturation colour block, don't give it a second one |
| Subline | video-shotcraft logo + lowercase wordmark 30px + mono 26px "SHOT RECIPE CARDS" (letterspacing 0.2em), floats up over 16f from f60 | Widely spaced mono reads as a "product codename"; in the same font as the title it reads as a second title line; don't write numbers that go stale, like the card count |
| Exit (optional) | f118–128, blur 0→6.5px | The whole line defocuses together; **a per-letter exit reads as a second entrance** |
## Known pitfalls
- **Cards must not tilt with θ**. Once you add `rotate(θ)` to the cards, the ring immediately turns from "display" into "roller coaster", and the text inside the cards
  goes crooked, dropping readability straight to zero. Cards change position only, not angle
- The first frame of card contents must carry its own static skeleton (background colour/border/labels/dark-base track). What's shown during the freeze is frame 0;
  if a card's animation is "drawn from nothing", then those 24f of entrance are eight blank cards. That's why every placeholder card in the demo was given
  a dark-base sparkline / faint draft lines / a persistent prompt glyph: so the first frame isn't empty
- `zIndex` must follow depth. If you only scale without sorting z-order, DOM order makes later cards cover earlier ones,
  and the near-large/far-small sense of depth is instantly void
- The marker colour block and the text layers are a pair: colour block `zIndex:0` + text `position:relative; zIndex:1`. If you miss
  the relative on the text, the colour block covers the text (in a stacking context, static elements are ordered after positioned ones)
- The title's `white-space: nowrap` is a precondition for the marker block: the block's 0.14em outward extension on both sides and the reverse-out clipping both assume the highlighted
  phrase is within the same line box. If it wraps, the colour block breaks across lines into two pieces. If you change the highlighted word's letter count, update W in the leading-edge conversion to match
- The ring is a background layer but it's always moving, so **don't stack a second moving thing on the ring** (particles, sheen sweeps, gradient
  breathing). With one sustained motion already present, a second one makes it impossible to read what's primary and secondary
- Division of labour with `carousel-3d`: that card is true 3D (`rotateY + translateZ` + backface-hidden),
  so cards turn to the back of the ring, suited to a seamless-loop pure display; this card is 2D elliptical pseudo-depth, so cards always face the viewer,
  suited to an opening with "a ring underneath + a foreground title". If you want the cards to turn over, use the former; if you want the title to hold its own, use the latter
- The demo's eight cards are original generic DOM placeholders (dark product cards + a single fluorescent accent colour, card-frame shadow/brightness changing with depth) and contain no product screenshots;
  in real use just replace the whole block with your own shot-card components or real page screenshots, and the ring's grammar needs not a single line changed

## Reference implementation
demos/opening/orbit-ring-title-open/
(OrbitRingTitleOpen.tsx)
