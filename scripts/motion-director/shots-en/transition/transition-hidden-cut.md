---
name: transition-hidden-cut
one_liner: Three hidden-cut-point transition styles: foreground-occlusion invisible cut, versus slam opener, warm light leak; the hard cut is hidden inside 1-3 frames of occlusion/impact/light peak, and the viewer can't see the scissors
use_when: Junctions between two shots that need a "seamless scene change" or a "ceremonial opener" (technique card, same-layer selection with the three shot-transitions styles)
length: n/a (technique card; the frames each style takes are in the parameters table, carved out of the adjacent shots' budgets)
energy: n/a (technique card, doesn't take an energy slot)
---

## Intent
Same family as shot-transitions style A flash-cut: flash-cut covers a hard cut with a layer of white flash,
and these three styles swap in three other "decoys": a foreground card sweeping past (A), the impact frame of a collision (B),
a light leak climbing to its peak (C). The shared principle is magician's misdirection: the hard cut is done in the 1-3 frames when the viewer's eye is drawn away by a big move/strong light,
and by the time they recover the scene has changed; "you can't see the scissors" throughout.
flash-cut is the plainest option; choose A for directionality, B for ceremony, C for warmth.

## Variants
| Style | Approach | Seams it suits |
|----|------|----------|
| A invisible-cut foreground-occlusion invisible cut | An out-of-focus foreground object skimming right past the lens (larger than frame, soft edges = defocus + motion blur) sweeps across; within the occlusion frame that covers the full screen the background hard-cuts A→B, the foreground sweeps out and the viewer thinks it's still the same shot | Page → page where the scene change should be completely seamless; the main workhorse for faux "one take" |
| B versus-slam opener | Two half-screens left and right (two contrasting posters) with slanted cut edges accelerate in from out of frame and slam together; the impact frame has white flash + screen shake + VS stamp, the cut point is the impact itself | Openers or chapter heads with comparison/face-off semantics (old vs new plan, two products, before/after) |
| C light-leak-burn warm light leak | A warm light leak in three colour temperatures sweeps diagonally; on the light-peak frame, when it swallows over 70% of the old frame, hard cut to the new frame; as the light recedes the new frame is already in place | Chapter transitions wanting a warm tone/film flavour; softer than a white flash, directional, with warmth |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A occluder | Dark brown out-of-focus foreground drawn purely with gradients: solid core 2600px + 340px soft edges on each side (total width 3280), a terracotta rim light on the leading edge; right → left 14f (32–46f), bezier(0.3,0,0.7,1); cut point = the frame where the solid core covers 0..1920 (f39 in the demo, the frames before and after covered by the soft edges) | The soft-edge gradient itself is defocus + motion blur, no need for CameraMotionBlur (12× sampling is too expensive); light/dark overlays on the occluder must be limited to the solid area with a mask, otherwise they draw hard edges on the transparent soft edges |
| A near-object shading | A 640px soft shadow in front of the occluder (0→0.38→0.5) sweeps across the page along with it | Sells the distance feel of "skimming right past the lens" |
| A one take | Throughout, content slowly drifts sideways +40→−40px (smooth) right through the cut point; before the cut A is dragged 28px left (ease-in), after the cut B settles back from 28px right over 14f (ease-out); B page's layout as a whole shifted 40px right to offset the drift's end point | Sells the illusion of "the same shot nudged by the wind", half the credit for the seamless feel; the drift eats into the safe margin, reserve room at the end point |
| A causality | At 24f Render is pressed (0.96 scale + darken + Rendering… spinner) → sweep → B "That's a wrap." render-complete ticket stub + stamp spring-seating, checkmark drawing on | Give an action before the occlusion and a result after the cut, and the viewer reads it as "done in a flash" |
| B slanted seam geometry | clip-path polygon slant about 78° (seam top x=1075 → seam bottom x=845); the two half-screens slam into place from ±1240px with ease-in(cubic) over 10f (18–28f), with horizontal motion blur by speed (capped at 36px) | Only ease-in acceleration gives the "smash" feel; a vertical seam reads as a PPT split screen |
| B impact trio | Fired together on the impact frame (28f): paper-white flash 0.85→0 over 3f + whole-camera shake 16px·e^(−t/1.7) settling in about 5f + VS round stamp spring-pressed out (damping 12 / stiffness 260, scale 1.9→1, one visible overshoot); plus an impact ring 16f + 12 radial speed lines 7f | All three must start on the same frame; offset by one frame and it falls apart; shake amplitude must cross the naked-eye threshold (perceptibility ruling) |
| B layout | Both sides made as colour-block posters: ink black "The old way" vs vermilion "With video-shotcraft", each with a 340px big number (14 days / 1 prompt) + 44px description + 32px checklist; after the impact the numbers bounce 1.05→1 (2f later), descriptions staggered left first then right; from 54f a bottom conclusion bar (Frame Chisel logo mark + brand slogan) sits over the slanted seam | The numbers themselves are the comparison's conclusion; put a rhetorical question in the establishing segment, with an ink line foreshadowing the slanted seam (leave a gap at the text band, don't strike through the text) |
| C light layer | 3 radial-gradient ellipses stretched along the diagonal (1.35:1, rotated −34°) (#c2311a / #ff5a1f / #ffb347, long axis 3000/2300/1700px, screen, no blur filter) + a linear light band of gate spill on the top-right edge, sweeping top right → bottom left over 71f | Offset the light blobs as a trail along the sweep direction, avoiding a perfectly concentric "flashlight feel"; the gradients are soft in themselves, saving a 90px big blur |
| C light intensity envelope | ease-in (t²) climbs over 28f (24–52, building) → cut hidden on the peak frame → ease-out converges over 43f (afterglow); at the peak overlay a 40% full-screen warm veil + a near-white hot core (opacity=intensity³) + a slight 2f lift at the cut point | Slow climb and fast convergence reads as a glitch flash; the hot core only burns up close to the peak |
| C washing out | At the peak, page filter: brightness up 85%, contrast down 50%, saturate down 25%; the old frame's title fades to ~25% with light intensity | This is where the "burning through" feel comes from: light that only overlays without washing out reads as a sticker; if the title doesn't burn out along with it, you see the text suddenly swap at the cut point |

## Known pitfalls
- The demo is tuned on programmatically drawn frames (A warm sand video-shotcraft render page / B paper comparison poster / C dark-field video-shotcraft viewfinder night → dusk,
  with the brand short phrase "Frame motion. / Craft the shot." cut in two by the light peak):
  the parameters are a starting point, not final; re-check with real material on first real use
- Style C is the first light-effect technique entered into the library after the Q4 light-effect ruling was lifted; strictly observe the three Q4 constraints:
  single-point use (one place per film, not scattered), only passes if it looks good on self-check at normal playback speed,
  the light effect serves the cut point and isn't decoration; mixing it with flash-cut in the same film counts as two light-effect hidden cuts
- Style A's occluder must truly cover everything: in the demo only a 2600px solid core leaves about a 1-frame fully covered window
  (mid-section speed ~530px/frame); after changing the sweep duration or width, first compute/check frame by frame whether the cut frame shows any background edge;
  one visible slit and the whole magic trick is given away
- Style B's VS block semantics only fit "comparison/face-off" content: when there's no two-sided confrontation
  don't use it as a general transition; remove VS and keep just the slam and it degrades into a slanted-seam wipe, with the semantic requirements lowered accordingly
- Transitions don't stack (same rule as shot-transitions): one seam uses only one style;
  these three styles are a same-layer selection with the three shot-transitions styles; for same-kind seams in the same film, don't use both flash-cut and style C
- Mark per seam already at the storyboard table stage (in the "key motion" column); the frame budget is carved from the adjacent shots (R3)

## Reference implementation
demos/transition/transition-hidden-cut/
(InvisibleCut.tsx / LightLeakBurn.tsx / VersusSlam.tsx)
