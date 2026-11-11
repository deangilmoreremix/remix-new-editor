---
name: line-carry-transition
one_liner: Line relay lateral-move transition: scene A's progress bar extends out of frame, the camera tracks the line sideways, and while moving the line turns corners to enclose scene B's card frame, with no cut at all
use_when: Between two scenes with graphic kinship (progress bar → card frame, underline → chart axis); a film's signature transition slot, the graphic relay of the Catch Me If You Can title sequence
length: ~6.3s / 190f (progress bar fills 36f + bursts out 10f + lateral move 56f + frame closes 24f + poster inside frame 30f + still 24f)
energy: medium
tags: camera
---

## Intent
The three big families of the transition library (travel/hidden cut/volume) all answer "how do scenes change"; this card's answer is
**they don't change at all: a line leads you across**. After the progress bar fills, its end extends into a long line that bursts out past
the card edge, the camera tracks the line 1920px sideways into a new world, and while moving the line turns right angles to enclose scene B's
card frame; the frame closes, the content fades in, and from start to finish the viewer's eye never leaves this line. Graphic
continuity is itself the transition. The difference from match-cut: that aligns shapes on both sides of a cut point, which is
still a cut in the end; this is continuous drawing: **there is no cut**. The line's identity needs narrative logic (the progress bar
"finished" so it extends onward); a line with no reason is mere decoration.

## Motion core
- A 3840-wide world container with translateX as the camera, moving 1920px over 56–112f, smooth in-out (bezier .65,0,.35,1)
- One hand-written polyline path (progress bar 648 + burst-out segment + right angle + 720×480 rectangular frame, total length 4944) uses
  dasharray evolve throughout, with segments driving the drawn length
- **Make-or-break point: during the lateral move drawn = 1144 + cam, line growth at the same speed as the camera**: the pen tip is nailed at frame x≈1480, right of centre,
  never leaving frame and never falling behind; once it loses speed, a viewer who loses the line has lost the transition
- **Speed continuity at handovers**: progress bar ease-out to zero speed → full bar holds 6f (status flips to complete, checkmark pops) →
  burst-out segment zero speed at both ends (swift) → camera in-out starts from zero speed → frame closing in-out catches the camera's landing point at zero speed
- The pen tip is the only accent colour dot in the whole film (terracotta r=14 + halo); after the frame closes it dissipates at 136–142f and is conditionally unmounted (remove-the-mask ruling)
- During the lateral move the world content (cards, dot grid, exhibition labels) gets horizontal motion blur according to camera speed (SpeedBlur, ≤16px), while the line and pen tip stay sharp outside the blur layer;
  after the line passes, drafting tick marks grow below it, giving the eye a speed reference when the mid-move frame contains only the line
- B's exhibition label title is outside the frame and can rise before or after the camera arrives; the poster inside the frame must wait for the frame to close (from 136f) before growing

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Line body | 8px solid ink line, square cap + right-angle miter | Too thin and it gets lost during the move; a dashed line reads as an unfinished state |
| Lateral move ratio | 1920px / 56f (average 34px/f) | For a longer move stretch the duration proportionally, don't speed up: at peak speed >80px/f the pen tip starts getting lost |
| Pen tip position | Frame x≈1480 (about 77%, right of centre) | Centred reads as "the line chasing the camera"; hugging the edge, one tremor and it's out of frame |
| Corners | Hard right angles, not rounded | Soft rounded corners lose the drafting feel, and the Saul Bass flavour is gone |
| Frame closing | Content inside the frame appears only from the closing frame | Content appearing before the frame closes wastes the line's suspense |
| Ending | ≥24f true stillness after the poster finishes growing | The pen-tip ink dot must be conditionally unmounted; any residue ruins the stillness |

## Known pitfalls
- The demo is a hand-built video-shotcraft render scene (beige paper + ink + terracotta; A render-and-publish film progress card → B this film's poster): the parameters are a starting point, not final;
  re-check with real material on first real use
- Relationship to draw-svg-trace: that is element-level stroke call-out (the line belongs to the element), this is
  scene-level line relay (the line belongs to the camera); they can coexist in one film, but the line's semantics must be consistent:
  both ink 8px geometric hard lines, or both hand-drawn feel; mixing reads as two art directions
- ≤1 time per film: this is a signature transition, not a routine one; a second appearance gives the magic away
- The starting point must be a natural extension of an existing graphic component (progress bar filling, underline finishing drawing);
  a line starting out of nowhere reads as a screensaver
- Sound: a continuous pen scratch as the line grows, a light tap as the frame closes (sound-design §4.5)

## Reference implementation
demos/transition/line-carry-transition/
(LineCarryTransition.tsx)
