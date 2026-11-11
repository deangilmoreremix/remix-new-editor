---
name: crane-rise-reveal
one_liner: Crane-rise reveal: the opening is jammed up against a close-up of one row of data; the camera decelerates as it rises along the Y axis and pulls back, rows flood in row after row until the whole dashboard fills the frame
use_when: An establishing opening that goes "from detail to the whole"; the mirror of drone-dive-landing (whole → single point dive)
length: 5.5s (165f: close-up hold 24f + rise 102f + landing/aftershock/stillness 39f)
energy: medium-high (sustained one-directional motion, no impact beat)
tags: camera, data
---

## Intent
The library already has drone-dive-landing for establishing openings: it slams from a god's-eye view into a hero close-up,
"whole → focus". This card is its mirror, "focus → whole": first jam up against one row of real data
so the viewer sees clearly "what this is", then crane-rise and pull back as rows of content flood into the frame,
until finally the whole product fills the frame: "the row you just saw is only one cell of this whole wall".
Suits openings that sell on product scale/richness of content; use only one of the two directions in the same film.

## Motion core
- transform-origin fixed at top-left, with the linked formula `translate = screen centre − target point×scale`;
  the target point travels (left part of the tracked row)→(page centre) and scale 3.0→1.0, and they **share the same
  asymmetric easing bezier(0.2,0,0.25,1) progress**: one p = one camera performing one manoeuvre (same ruling as style C)
- The decelerating curve (fast then slow) is the "crane" feel: a strong start, a gentle stop near the top; it starts from zero velocity and peaks at 19%
  (≈2.3× average speed), not jumping from the hold straight to top speed; during the hold the camera first "takes a breath" and pushes in 1.5% as anticipation
- Focus: during the close-up hold only the tracked row is solid (cobalt background + a breathing tracking dot at the start of the row); the other rows are pressed down to 38%,
  and return to full ~26f after lift-off: first let the viewer see "this one shot" clearly, then see everything
- Row-by-row light wash: when the top edge of the camera's visible area `visTop = fy − 540/s` first crosses a row's top edge,
  an accent-colour light wash sweeps across that row from start to end (starts over 3f, falls off over 18f after 6f, with a 1px accent-colour outline);
  this is where the readability of "flooding in" comes from; the trigger frames are solved frame by frame and strictly synced with the camera move
- Sense of scale: the header KPI (frames rendered today) counts from 0 to 48,210 during the rise (expo-out, finishing on the same frame as the camera move), the window shadow rises
  from close-contact to hovering height as it pulls back, and the stage dot grid drifts slowly at 0.35 parallax: the window finally reads as a physical object on a stage
- Aftershock: after landing, the tracked row's status pill flips from "Rendering" to "Rendered" (spring damping 16 + checkmark draw-on + progress bar fills up),
  the only small event in the hold segment
- On a white background "brightening" is invisible; **darkening/adding colour is what's perceptible** (ruling: a brightness boost on a white card is the same as doing nothing)

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Starting close-up | scale 3.0, aimed at the left part of the tracked row (shot number / transition in 63px large text; the bottom of the framing stops above the window's bottom edge, nothing outside the window shows) | Hold ≥20f so that "this is a row of data" is readable before take-off |
| Rise | 102f bezier(0.2,0,0.25,1), scale 3.0→1.0 | Faster than 80f and the row washes can't keep up; slower than 130f and the middle drags |
| Focus | Non-tracked rows 38% → 100%, 26f after lift-off | Without dimming, every row in the close-up has equal weight and the viewer doesn't know which row to look at |
| Row wash | Triggered by line-crossing, accent colour sweeps from the row start + thin outline, ~24f | If the wash can't keep up with the camera (triggered at fixed intervals) it immediately gives the game away |
| Ending | No extra push-in after full frame; the status flip keeps the hold alive, stillness ≥30f | R1; the full-frame frame is the standard composition |

## Known pitfalls
- Tuned on placeholder material in the demo (a hand-built product window with fictional data: a video-shotcraft render queue): the parameters are a starting point, not final;
  re-check with real material on first real use
- The starting close-up = one row of content magnified 3.2× and stared at; real material must first go through
  the high-resolution rasterisation technique from aesthetic guideline Q2, otherwise a low-magnification screenshot is blurry from the first frame
- The fast rise segment can be wrapped in CameraMotionBlur (parameters in the motion-blur row of deck-deal-flyin),
  but only wrap the fast first half; wrapping the slow segment near the top smears the text (round #8 ruling);
  don't put the semi-transparent light-wash overlay inside CameraMotionBlur (multi-sampling stacks up into vertical-stripe artefacts); give it its own layer with the same camera
- Don't use alongside drone-dive-landing in the same film (one rises, one descends, mirrors of each other; the viewer reads them as the same trick);
  tilt-reveal, the move semantically closest to crane, is not in the library; don't conflate the names

## Reference implementation
demos/opening/crane-rise-reveal/
(CraneRiseReveal.tsx)
