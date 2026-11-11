---
name: brand-frame-snap
one_liner: Brand-colour frame grammar: a thick solid-colour frame grows before the content and wraps the full screen, and the screen recording window drops into the frame; on a mode switch the whole frame hard-flips colour on the same frame as the window's layout changes, one borderColor doing three jobs: chapter navigation, status cue and brand exposure
use_when: The whole-film packaging layer for dual-mode/dual-chapter product films (blue = mode A, green = mode B colour coding); branded wrapping of real screen recording material
length: single colour flip ~4.7s (140f); the frame itself can stay on for the whole film
energy: medium (high at the instant of the flip, a quiet packaging layer the rest of the time)
tags: transition
---

## Intent
A real screen recording laid straight across the full screen has no brand presence, and adding a logo watermark looks cheap. This card uses a
thick brand-colour frame to "mount" the recording: the frame **appears before the content** (set up the frame first, then hang the
picture, a sense of ritual), after which the frame colour becomes the film's semantic code: in the demo cobalt = Design,
orange-red = Dev Mode (the original film was blue/green; the key is opposing hues + a lightness difference). On a chapter switch the whole frame hard-flips colour within one frame, no gradient; the hard colour cut is the visual equivalent of a "gear shift"
sound effect; the window's layout A→B on the same frame, corner label and badge changing text in sync, three places resonating on the same frame
to nail down "mode switch". Division of labour with theme-switch-moves: that changes the UI body's own
skin (with a sweeping boundary), this card changes the "frame" packaging layer (same frame, no boundary),
the semantics being mode/chapter switch, not theme switch.

## Motion core
- The frame uses 4 solid colour bands (not the border property), thickness growing 0→60px snappy over 19f
  (a visible frame from frame 2); the opening has 22px rounded corners (colour patches filling the four corners), and the bands carry a thin glaze
  bright at the top and dark at the bottom; colour flip = swap background on the same frame, frame-deterministic
- The product window (1560×864, native pixel layout) with spring(damping 15, stiffness 115)
  drops into the frame from 660px below + forward tilt 18°→0 + scale 0.88→1 (from frame 10, the middle of the frame's
  growth), with vertical motion blur by speed during the drop, and the shadow tightening 70→22 with height
- Motivation: at 56–80f the cursor glides in an arc to the Design | Dev toggle in the title bar, presses at 80, releases at 84 = the flip frame
- Four things on the flip frame: frame changes colour + window layout hard-cuts A→B (right column light inspector → dark
  CSS panel, left column layers → tokens, blue selection box → orange annotation) + band corner label changes text
  (DESIGN → DEV MODE, the video-shotcraft wordmark at top right stays on, the band uses the monochrome white version of the logo mark) + toggle state
- At the instant of the flip overlay a 3-frame radial white flash (from 0.6 in stepped decay, brightest at the bands) + damped bounce of the frame thickness
  (exp(-0.24t)·cos(0.95t)·12px) + a ~1% jolt in the content, giving the "gear shift" a sense of impact;
  aftermath: annotation lines draw on in 3f staggered overlap, value pills overshoot and pop out

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Frame thickness | 60px (1080p), corner label 30px bold all caps | Too thin reads as an outline, and the corner label can't fit a readable size; >64px starts eating the content area |
| Frame growth | 19f snappy, 10f ahead of the window | The frame must be set up first: content arriving first and the frame wrapping afterwards reads as a fix-up |
| Window landing | spring(damping 15, stiffness 115), y 660→0 + rotateX 18°→0 + scale 0.88→1 | Dropping "into the frame" is the semantic key; the landing must be fully inside the bands |
| Flip moment | demo 84f (cursor release frame); pause a beat (≥30f after the window lands) before flipping | Flip before it has settled and the viewer hasn't yet established the "blue = current mode" code |
| White flash pulse | 3f, 0.6→0.2 stepped, radial (brightest at the bands) | Helps the eye register "this frame changed"; >4f reads as base colour strobing, stealing the flip's thunder |
| Thickness bounce | exp-decayed cos, initial amplitude 12px | A pure hard cut is a bit dry; the bounce is the mechanical feedback of "the gear clicking in" |

## Known pitfalls
- The demo is tuned on a hand-built design tool window (the band corner label is the video-shotcraft logo mark + wordmark, and the canvas holds a video-shotcraft promo card): the parameters are a starting point, not final;
  re-check with real material on first real use
- The flip must be truly on the same frame: frame, window layout and corner label text offset by even 2f and the "gear shift" scatters into three small animations
- The colour code must be kept throughout the film: no green primary UI elements in blue-frame sections; once the code is diluted, the flip is just a colour change
- The frame is a packaging layer, not the hero: ≤2 flips per film; more and it reads as a neon sign (P4 restraint principle)
- The two modes' brand colours need enough contrast (demo cobalt #2F55FF / orange-red #FF5B1F, opposing hues + lightness difference); flipping between adjacent colours of the same lightness is as good as not flipping
- Keep the UI inside the window in neutral ink; accent colours only follow the mode (the selected state in the blue section is blue, annotations in the orange section are orange), otherwise the code is diluted by the UI's own colours
- Sound: nail a crisp mechanical click/gear-shift sound on the flip frame, with the white flash on the same frame as the sound; the frame growth segment can be silent

## Reference implementation
demos/effects/brand-frame-snap/
(BrandFrameSnap.tsx)
Original source: figma-devmode 0:28–0:32 + 0:43–0:47
