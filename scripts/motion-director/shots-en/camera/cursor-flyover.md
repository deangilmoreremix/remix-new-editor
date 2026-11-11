---
name: cursor-flyover
one_liner: After an overhead view of the whole page, the camera flies in turn to four feature areas for zoom-in close-ups; an SVG cursor arrives a step ahead to point, each click leaves a ripple and triggers a UI response, and finally the camera pulls back to the overhead view
use_when: Feature tour of a single-page product: one shot takes the viewer through four feature areas, with the cursor as the "tour guide's finger"
length: about 8.0s (240f@30fps; overhead 22f · four stations of 44f each (flight 20f + dwell 24f) · pull-back 24f · hold 18f)
energy: medium (evenly spaced cruising; the rhythm is punctuated by the click ripples)
---

## Intent
A shot-saving alternative to "four features in four cuts": one continuous camera strings the four corners into a single visitor route, and the cursor is the viewer's attention proxy — wherever it goes and clicks, the viewer looks. Spatial continuity also makes the viewer remember the positional relationships between the features along the way.

## Motion core
- The demo uses a porcelain light field (cool white + cobalt blue); the video-shotcraft workbench overview (top bar with logo mark + wordmark) is drawn in native 1:1 layout on a 2400×1500 world canvas: overhead s=0.66 to see the whole, close-up s=1.3 (32px world text → 42px on screen, readable)
- The camera steps through a lookup table: CAMS[0] overhead → the four module centres (top-left Frames rendered → top-right Shot previews → bottom-right Release flags → bottom-left Top shots); the three channels `x/y/s` are interpolated with an asymmetric in-out (bezier 0.55,0,0.18,1: crisp start, very soft landing); during each inter-station flight s pulls out an extra ~8% then pushes back (hop), with directional motion blur by screen speed (SpeedBlur amount 0.09, capped at 8px)
- Transform formula `translate(960 − x·s, 540 − y·s) scale(s)` — x/y is the camera's "aim point" (world px); edit the table to change the tour route
- **The cursor is the hand, the camera is the eye**: the cursor moves first (swift 16f, a light arc perpendicular to the displacement, with zero curvature at start and end), the camera starts 2f later and settles in 20f; the cursor "aims" on the target for a beat and then presses (clickAt = start +22f), shrinking to 0.84 over 3f on press and then overshooting back; the cursor is drawn in screen space and is always 40px on screen
- Each of the four landing points targets a real control, and each click gets a UI response: segmented control 30D→90D (slider slides + the big number's old value slides up and the new one rises from below + 12 bars spring to new heights with staggered overlap) / data-point tooltip pops out with overshoot + leader line drops / toggle slides on a spring + greyscale progress bar 0→25% / table row tints + accent bar + checkmark stroke draws on
- Each click triggers an 80px ring ripple (18f, scale 0.3→1.5 fading out)
- After the 4th station the camera pulls back smoothly over 24f to the overhead view, showing all four states in one frame (an "end of tour" family photo); the tail does a very slow 1% push-in

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Close-up magnification | s=1.3 (overhead 0.66) | Native world layout; derive the magnification backwards from "text to be read ≥40px screen text height"; above 1.6 the module goes out of frame |
| Step rhythm | flight 20f / dwell 24f | Dwell is for reading the feature; shorter than 15f becomes "sweeping past" rather than "visiting" |
| Cursor lead | starts 2f early, arrives 6f early | 0 = the cursor is dragged along by the camera (like a screen recording); >10f the viewer looks at the cursor first and then hunts for the picture |
| Click ripple | 18f, scale 0.3→1.5 | The ripple is the metronome; the four clicks are evenly spaced (every 44f) — pair with four SFX clicks |
| Tour order | top-left→top-right→bottom-right→bottom-left | Edit the CAMS / TARGETS tables to change the route; keep adjacent modules visited consecutively — diagonal jumps are disorienting |
| Ending pull-back | smooth 24f back to overhead | Without the pull-back it stops on the last module; the pull-back puts all four states in one frame as a poster |

## Known pitfalls
- When using real product screenshots, the TARGETS landing points must be re-marked at the centres of the controls in the screenshot; screenshots must have native resolution of ≥1.3× the close-up magnification (Q2)
- The camera table's x/y are world px coordinates; if the world canvas aspect ratio changes (e.g. switching to vertical), the whole table must be re-marked
- The cursor and camera are already decoupled (one table each), but the start/arrival frame offsets between them must be changed in pairs; otherwise the camera is still moving at the click and the UI response gets eaten by motion blur
- Don't overdo the motion blur: on light-field UI, when the end of the hop is still at high speed, amount > 0.12 reads as "out of focus" rather than "motion"

## Reference implementation
demos/camera/cursor-flyover/
(CursorFlyover.tsx)
