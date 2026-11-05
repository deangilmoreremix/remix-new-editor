---
name: basic-3d-scene
one_liner: impress.js-style spatial presentation: cards are scattered through 3D space at different positions/rotations/scales; the camera takes the inverse of each step's pose and flies to align with them in turn, and the last step pulls out to an OVERVIEW
use_when: Spatial storytelling for concepts / roadmaps / three-step methods; replaces flat slides with "every step gets a new spatial viewpoint"
length: about 7.5s (225f@30fps; four stations, three flight segments of 28/32/32f, each station dwells ≥30f)
energy: medium (every transition brings a spatial surprise; dwell segments are quiet for reading the card)
---

## Intent
Turn "flipping pages" into "travelling through the space of ideas": each card has not just a position but an attitude (at the second station the world turns 38° left; at the third the whole frame lies on its side at 90°), and when the camera aligns to it the viewer's world turns with it — the spatial change itself becomes the ritual of "entering a new chapter".

## Motion core
- The core recipe in one line: **camera = stepTransform.inverse()**. Each station only writes the card's own pose (x/y/z/rx/ry/rz/s); the camera transform is the inverse, `scale(1/s) rotateZ(-rz) rotateY(-ry) rotateX(-rx) translate3d(-x,-y,-z)`, in strictly reversed order
- The demo uses a graphite dark field (near-monochrome + champagne-gold accents) with video-shotcraft's three chapter cards Frame / Craft / Ship (the brand tagline split into three chapters, with the logo mark + wordmark hung on the right of the card header): cards are 1240×700 with **native 1:1 layout** (when aligned they are screen pixels, not scaled up from design coordinates, so text is not blurry), a 156px title + 44px caption + a 560px light-weight chapter number cropped by the card edge
- Each of the four station poses has its own dramatic point: STEP01 front-on at the origin → STEP02 (1690,−260,−650) + ry−38° → STEP03 (2590,830,−850) + rz90° (the frame lies on its side and the camera rotates with it to set it upright) → OVERVIEW s=2.7 (the camera pulls out by 1/2.7); the overview station's position is solved backwards from "the three cards land top-right, bottom-left is left free for the end lockup"
- Chained flight interpolation: three flight segments 36–64 / 96–128 / 158–190 (frames), asymmetric in-out bezier(0.62,0,0.16,1); during each inter-station flight the camera pulls out an extra 30% (hop, sin envelope) so the viewer sees the other cards in the space; flight segments get time-sampled motion blur (shutter 0.5f, 1–8 sub-frames adapting to camera displacement)
- Dwell segments are not dead: after landing the camera pushes in very slowly by 1.5% (restored on the same curve when the next segment takes off), and a gold progress line at the bottom of the card fills over the current segment; the title rises letter by letter from below a line starting 8f before landing, and each card is revealed only once
- Spatial reference: 70 real-3D dust motes hang in world coordinates (each with its own z), so all parallax comes from the camera; enter/exit focus uses the "station distance" `d = |af − i|` to give `opacity 0.22–1 + blur 0–7px`, and during the overview segment everything returns to 0.85
- The OVERVIEW end lockup hangs on the overview station's pose (laid out at 2.7× scale; the camera looking back at 1/2.7 = 1:1 on screen): the eyebrow is the video-shotcraft logo mark + wordmark, "Craft the shot." at 150px serif rises word by word, and the tail segment holds with a 1.5% push-in

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Station pose | Each station adds at least one new transform dimension | Moving only x/y is a panning slideshow; the rz station (frame rotation) is the memorable moment — use it once per video |
| Flight duration | 28–32f | Segments with rotation should not be shorter than 28f; the viewer needs time to understand that "the world is turning" |
| Dwell duration | ≥30f | Reading time for the card; when a card has a lot of text, add dwell rather than cut flight |
| Hop pull-out | 30% | 0 = panning flush against the card face, no space visible; >50% every segment looks like the overview |
| OVERVIEW scale | s=2.7 | The larger the value, the more "high-altitude" the overview; decide the overview poster composition first, then solve each station's world coordinates backwards |
| Focus falloff | opacity floor 0.22 + blur peak 7px | Keep the floor no lower than 0.2 — out-of-focus cards need to stay "present"; pure black loses the sense of space |
| perspective | 2600px | Ratio to the max |z| (850) is about 3:1; deeper z needs a larger persp in step to prevent distortion |

## Known pitfalls
- The rotation order of the inverse transform (Z→Y→X, reversing the forward X→Y→Z) must not be scrambled — a wrong order is invisible with single-axis rotation but makes multi-axis compound stations skew
- The card pose is consumed in two places, the card's own transform and the camera formula; to add a station change only the POSES table and leave both transform strings alone
- At the rz90° station the text in the card lies on its side too and only becomes readable once the camera sets it upright — this is by design (the "ah, now I get it" moment when it rights itself), but that station's copy should be short
- With the end lockup hanging in the world, it is tilted during the last flight: bring it in late (fade in after the flight is half done), and start the letter-by-letter reveal only 6f before landing
- There is no return trip after OVERVIEW; use it as a section ending. To loop back to STEP01, add a fly-back segment at the end (cam lerps back to POSES[0] again)

## Reference implementation
demos/camera/basic-3d-scene/
(Basic3DScene.tsx)
