---
name: bottom-push-stack-wipe
one_liner: Bottom-edge push chapter change: the new scene, base colour and all, pushes in full-screen from the bottom edge and physically shoves the old scene out of frame; several chapters are pushed in a row, each with its own saturated base colour, and the content is nailed into its own colour-base coordinate system and travels with the base colour
use_when: The chapter-change skeleton of a multi-chapter product film (one selling point and one base colour per chapter); section switches that need a "page-turning rhythm" running through the whole film
length: demo triple push 170f (~5.7s); single push-in 26f + in-chapter hold ~1.2s
energy: medium
---

## Intent
wipe-transitions is a boundary sweeping across while neither the old nor the new page moves; page-turn is the old page splitting open
like double doors and sliding out. This card is a third physicality: **the new chapter shoves the old chapter out**: two screens in rigid contact, moving at the same speed
in the same direction, like a vending machine pushing its stack. The make-or-break point is "the whole screen travels with its base colour": base colour + window card + decorative
strips are welded into one solid piece that pushes in from the bottom edge, so the viewer reads "the world changed" rather than "the card changed".
A heavy ease-out (fast in, slow stop) gives the push-in a "clunk" landing feel; the 40px seam shadow on the top edge
is the evidence of physical contact between the two screens. Push three chapters in a row with base colours at full saturation and the chapter change itself becomes the
metronome of the whole film: the original slack film uses this one move as its entire skeleton.

## Motion core
- One full-screen layer per chapter: `translateY` pushes from +1080 to 0, while the old chapter is shoved up to
  −1080 in sync; the two layers' displacements are strictly synchronised with the same easing, and any speed difference reads as "sliding clipping"
- Push-in easing = heavy ease-out `cubic-bezier(0.12, 0.9, 0.2, 1)` (fast in,
  slow stop), finished in 26f (~95% by ~12f); chapter i's y = (1 − its own push-in progress)×H
  − next chapter's push-in progress×H, one formula governs both entry and exit; the whole stack gets vertical directional blur according to speed
- The new chapter's top edge carries a 56px gradient seam shadow (the new chapter's hue-tinted dark at 0.42→transparent, laid over
  the old chapter) + a 2px lit edge on the new chapter's top edge, both returning to zero after landing; the physical contact feel of "shoving out" depends entirely on it
- The demo is "Swiss poster" style (product video-shotcraft, one selling point per chapter): chapter 0 is a near-black opener, the three chapters are cobalt #2d4cff / vermilion orange
  #ff4d1f / acid lime #cdf23a (dark text), hues spread at the 120° level; each chapter has a left-column eyebrow +
  116px ultra-bold two-line title + 40px description, and in the right column a big-type UI card designed for the shot
  (chat with agent / beat timeline / delivery pipeline); the colour panel is lit top-left and darkened bottom-right, the same light direction as the card shadows
- In-chapter animation is all staggered away from the push-in: the title only rises from below the line 12f after the push-in starts (when it is already at 95%),
  and the small UI moves (typing → message pops in / waveform hands over to current shot / delivery steps ticked one by one) are placed in the hold
- Push-in interval ~44f (demo starts pushes at 22/66/110f); layers that have left frame are unmounted promptly; final 28f
  very slow push-in of 1.5%

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Push-in duration | 26f, heavy ease-out | <20f reads as a flash cut; linear constant speed reads as a roller shutter, the "clunk" is gone |
| Inter-chapter hold | ~18f still + tail of the push-in, total in-chapter dwell ~44f | The chapter is the content performance zone; <25f and the viewer is shoved away before seeing it clearly |
| Seam shadow | Top edge 56px, chapter colour dark tier 0.42 gradient + 2px lit edge | Without it the two screens look like sliding double exposures; >80px reads as the new chapter having its own black border |
| Base colour | One saturated colour per chapter, adjacent chapters' hues spread apart | Adjacent chapters in the same colour family make "chapter change" read as "minor tweak"; a greyscale chapter can only be chapter 0 |
| Content nailed down | Window cards/decorative strips use absolute in-chapter coordinates | If content is positioned relative to the viewport it "floats" on the push-in animation, giving the trick away |
| Number of pushes | 2–4 chapters | 1 push makes no rhythm; >4 and the viewer starts counting base colours, fatigue |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Division of labour with wipe-transitions: in that card neither page moves and one geometric boundary sweeps across for the handover
  (neutral, usable anywhere); in this card both pages move and one is rigidly shoved out (physical, with its own chapter
  rhythm). Use that card for a single seam, this card for the whole-film skeleton
- Same-layer selection with the three styles of shot-transitions: this card is medium energy with a fixed upward direction;
  for seams that need a big energy drop (e.g. into the outro) give way to the white flow
- A unified direction is where the skeleton feel comes from: every chapter in the film pushes from the bottom edge; switch to a left push/top push midway
  and the metronome falls apart. If you want to change direction, don't use it as the skeleton
- While a push-in is in progress the two chapters share the screen, both full-screen layers; in-chapter animation (card entrances etc.) must avoid the push-in's
  26f window (wait at least until 95% landed), otherwise both chapters are moving and the eye has no anchor
- In real use, take base colours from the saturated tier of the brand palette; when base colour saturation is insufficient, the subordinate relationship of the window card being "nailed onto the colour base"
  can't be read, and it degrades into "each card changes its own background"

## Reference implementation
demos/transition/bottom-push-stack-wipe/
(BottomPushStackWipe.tsx)
Original source: slack-promo 22–27s
