---
name: gradient-transition
one_liner: The background transitions smoothly between three kinds of CSS gradient, linear, radial and conic: angle, colour stops, centre and radius interpolated parameter by parameter, with cross-fades between segments to change type
use_when: Continuous variations on ambient bases/chapter base colours; providing a "living" background layer for static typographic sections
length: about 6.7s (200f@30fps; linear 0–2.3s · radial 1.9–4.4s · conic 3.9–6.7s)
energy: low (pure background motion, making way for foreground content)
---

## Intent
A gradient isn't a static texture but an animatable set of parameters: within the same gradient type any parameter can be interpolated into a silky change, and across types a short cross-fade joins them. Used as a background layer, it gives sections "with no subject motion" a layer of sustained low-speed energy.

## Motion core
- Each of three layers holds one gradient type; only one layer dominates at any moment, the cross-fade window is very narrow (12–14f) and both layers are moving inside the window
- linear segment (0–68f): angle 18°→198° (swift in-out), three lightness-tier colour stops (64→40→7) interpolated on three channels in HSL space
  (`mixH` lerps h/s/l separately, which doesn't go grey the way RGB does); spread the lightness apart so that the direction of the bright band shows "the angle is sweeping"
- radial segment (56–132f): centre migrates diagonally (24%,72%)→(68%,38%) + radius expands 48%→80%, outer ring near-black;
  the light spot seems to wander through the frame and come into focus
- conic segment (118–200f): A→B→C→A three-colour ring (purple / magenta / ice blue, first and last the same colour), `from` rotating 0→250°,
  a slow-start long-tail ease that turns slower and slower to settle; centre placed behind and to the right of the subject at (64%,54%), with the outer ring and text side darkened further
- **Paint on a small canvas**: the three gradient layers are painted at 480×270 and then `transform: scale(4)` to fill the frame; enlarging at composite time softens naturally,
  and the conic blur(9px) is done on the small canvas (≈36px at full resolution), so the per-frame cost is 1/16 of a full-screen real-time blur; grain is laid on top to prevent banding
- demo foreground: one big line of text per segment (180px), with a verb describing that segment's parameter motion (Bend light. / Focus it. / video-shotcraft wordmark + brand short phrase),
  the line change on the same beat as the type change; mono annotations at the bottom read out in real time the gradient parameters being interpolated

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Segment window overlap | Each segment starts 12f before the previous segment ends | Overlap ensures both layers are moving during the fade; without overlap you see "a still instant at the takeover" |
| Cross-fade | 56–68f / 118–132f (smooth in-out) | Widen it and you see two gradient structures fighting on screen; a narrow fade + parameters moving together is the key to "changing type without catching breath" |
| HSL interpolation | h/s/l three channels lerped independently | When the hue difference is >180° it takes the long way round (e.g. 340→160); when you need the short path add +360 to the start |
| Colour stop lightness difference | linear bright 64 / mid 40 / dark 7 | With lightness difference <20 the angle sweep can't be read, leaving just a flat base changing colour |
| radial migration | Centre moves diagonally + radius 48%→80% | Centre fixed and only the radius expanding reads as "breathing", not "wandering" |
| conic rotation | from 0→250° (less than a full turn, ease-out long tail) | A full 360° ends on the same frame as the start, use that for loops; for one-off playback leave a gap to avoid the "back to the origin" feel |
| Colour stop set | The same purple / magenta / ice blue set across all three segments | When switching to project colours keep the "light colour + dark colour" pairing structure; the radial outer ring must be dark (the premise for the light spot to work) |

## Known pitfalls
- This is a background card: when placing typography/UI in front, lay a dark scrim on the text side (demo: linear darkening on the left + outer vignette), otherwise the bright colours of the conic segment eat the foreground contrast
- The R in `radial-gradient(circle R …)` only accepts a length: written as `circle 45%` the whole gradient fails and that segment renders pure black; for a percentage radius either convert to px (the demo treats the small canvas width of 480px as 100%) or switch to `ellipse X% Y%`
- Rewriting the CSS gradient string every frame triggers repaint rather than composite; large frames + low-end devices need real testing; Remotion server-side rendering has no such concern
- The conic segment uses a three-colour loop (A→B→C→A); a seven-segment rainbow ring is "show" in nature, don't use it in branded scenes
- The three segments can each be taken apart and used independently: just the linear segment (0–68f renormalised) is a minimal "angle sweep" base

## Reference implementation
demos/transition/gradient-transition/
(GradientTransition.tsx)
