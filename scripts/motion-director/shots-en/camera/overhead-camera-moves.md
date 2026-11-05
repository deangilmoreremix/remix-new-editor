---
name: overhead-camera-moves
one_liner: Two overhead-reveal variants — tilt-reveal (tilt up to level for a reveal) and overhead-tabletop-drop (pan across a tabletop card array, then plunge down into one)
use_when: Openings/transitions that tell the story with "tilt angle": use A for a single-page establishing shot, B for touring multiple pages and plunging into one
length: A 120f (4s) / B 140f (4.7s)
energy: A medium / B medium-high
tags: opening, transition
---

## Intent
The library has always lacked an overhead viewpoint — crane-rise is a "pan + scale" rise (the tilt angle
does not change), and space-camera variant C drone-dive is a single-take dive-and-land; these two variants let
**the tilt angle itself tell the story**: A is a reveal — the whole page lies flat via rotateX, and at the opening only a glowing perspective sliver of the far top edge
is visible (like the first light on the skyline); the camera "looks up" back to level, and the content rows pour into view one after another,
like lifting a blueprint off the table; B is a choice — three page cards lie flat as a tabletop card array, the camera slides sideways overhead sweeping past them
one by one (Wes Anderson tabletop), and on reaching the target page it suddenly dives in and tilts up to full screen:
"took a look around, picking this one". Selection: single-page opening → A; multi-page transition/opening → B.

## Choosing between the two variants
| Variant | Approach | Use when |
|----|------|------|
| A tilt-reveal | The whole page lies face up via rotateX 86° around a hinge at its bottom edge and tilts up to level over 40f (overshoot −2.2° then softly back); angle/scale/hinge position/perspective/eye height share one progress value | Opening establishing shot; single subject |
| B overhead-tabletop-drop | The card array lies flat at rotateX 62°; the pan segment only moves translateX to slide sideways across; in the drop segment the three channels angle/scale/position run together to plunge in and land on the end frame | Choosing one after touring multiple pages; works for both transitions and openings |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A tilt angle | rotateX 86° (f0–20 very slow creep to 83°) → −2.2° (f60, velocity reaches zero) → 0° (f70); main segment EASE.swift asymmetric in-out, overshoot settles with smooth; transformOrigin 50% 100% (bottom-edge hinge) | The first version's −55° was too weak: half the page was still visible at f0, no "sliver" suspense (render ruling); an eye point below the page plane shows the back side (the text in the sliver is upside down, render ruling) — the eye point must be above the page; using out-cubic for each sub-segment produces velocity jumps at the seams |
| A linkage | perspective 700→1500, eye y from 300px above the hinge → frame centre; scale 2.5→0.84 (leaving a margin on settle so the stage is visible), hinge y 600→935; background light pool and dust motes move down 150px in counter-parallax | If perspective isn't linked, the initial tilt can't show "only a sliver"; without background parallax it reads as the page rotating, not the camera looking up |
| A ending | Camera settles at f70; 38–82 area-chart line draws on, at 80f the end-point light dot lights up; 70–120 very slow push-in 1→1.018 | Overshoot amplitude ≤3°; larger reads as a spring, not a camera move; 69f of pure stillness is too long (> 1s of dead frames), the hold needs a very slow push-in |
| B pan segment | 0–50f only changes translateX +760→−360 (smooth), angle unchanged; 50–58 pause 8f to select (target sheet lifts 16px off the table, its overhead light turns on, the other two dim to 35%) | Moving the angle in the pan segment = the two segments' jobs blur together (ruling: pan tours, drop commits); without that selection beat the dive reads as random |
| B drop segment | 58–86f three channels run together: rotateX 62→−1.6→0.5→0 (asymmetric curve starting from zero velocity + smooth settling overshoot), scale 1→2.04→2.0 (with ~5% anticipation shrink at the start), translateX −360→0 | The three channels must run together; running them one after another reads as two actions; jumping straight into out-cubic after the pan stops is a velocity jump |
| B card array | Cards 996×560 (exact 16:9), the end frame at scale 2.0 exactly fills the screen front-on; transform order translateX→rotateX→scale | With the wrong order the pan produces an arc trajectory |
| B floor | Dark graphite tabletop + hairline grid + an overhead light pool/volumetric light beam per sheet + printed labels under the sheets (01 SHOTS…) | Without a floor reference the sideways slide doesn't read as "the camera moving"; the contrast of white sheets on a dark table is the layering |
| B ending | Camera lands on the end frame at f94; 98–118 a gold shot block inside the page slides into an empty storyboard slot (one overshoot); 94–140 very slow push-in 1→1.012 | Complete stillness for 47f after landing feels dead; give one small in-page action to finish |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Under steep-angle perspective, cards must have backfaceVisibility hidden + translateZ(4px)
  as a safeguard, otherwise the back side/depth gives it away on some frames
- A and crane-rise-reveal are mutually exclusive within one video — both are opening reveals; two "reveal openings"
  is the same as no reveal
- Locking the angle in B's pan segment is the make-or-break point (ruling on separating the two segments' jobs): touring is touring, plunging in is
  plunging in; mixing the moves leaves the viewer not knowing what the camera wants
- Both variants are "big camera moves" and are mutually exclusive with space-camera/crane-rise in the same section;
  a section can only have one camera operator

## Reference implementation
demos/camera/overhead-camera-moves/
(OverheadTabletopDrop.tsx / TiltReveal.tsx)
