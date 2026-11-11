---
name: wipe-transitions
one_liner: Geometric wipe transition: blinds-slice venetian-blind strips (12 3D slats flip in staggered overlap to form a wave; once the wave has swept past, the whole page has changed from A to B)
use_when: A general-purpose transition where neither old nor new page moves and one geometric boundary sweeps across to complete the handover; doesn't depend on the composition having a suitable element, usable anywhere
length: before state ≥20f + wipe ~56f + ending ≥40f, about 4.4s (132f)
energy: medium
---

## Intent
The transition library already has three families: travel (burrow in), hidden cut (cover the cut), volume (the page is a
solid object). This card is a fourth family, **geometric wipe**: neither old nor new page moves, one geometric boundary sweeps across
to complete the handover, and the shape of the wipe is the semantics: a strip sweep is "venetian blinds flipping slat by slat to change the page". The difference from
shot-transitions style C through-the-window (element mask wipe): C uses a real element on the page as the mask
(depends on composition), this card is pure geometry: generality is its positioning. Suits lateral progression and page-turning semantics.

## Approach
| Style | Approach | Use when |
|------|------|------|
| A blinds-slice | 12 160px true-3D slats (preserve-3d double-sided panels: front is an A slice, back is a B slice pre-rotated 180°, backface hidden), sharing a 1900px perspective, each rotateY 0→180° about its own vertical axis, staggered into a wave; when edge-on they reveal a dark groove behind the slat | Page-turn/progression semantics; pages with a horizontal reading flow |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Wave | Starts at 24f, slat i takes off at = 24 + 28·(i/11)^0.78 (interval 3.4f→2.1f, flipping faster and faster); each slat a physical spring damping 13 / stiffness 75 (~13f to 180°, ≈5° overshoot falling back) | Only with 4–5 slats turning at once does it read as a "wave"; with EASE.out staggering the first interval is 9f, there's dead waiting after the first slat, and the wave feels draggy |
| Slat face lighting | The face turning away from the key light darkens by 0.5·sin θ (gradient across the slat width), the face turning toward the key light gets a screen highlight sweeping past at ~35°, a 2px lit thin line on the slat edge ∝ sin θ; the dark groove revealed when edge-on, #1d1712→#120d0a, is the boundary line | The true-3D dark groove + lighting is itself the "bright line" of the wipe boundary; no need to stack an SVG seam line |
| Remove the mask | After the last slat's spring converges (|θ−180°|<0.3° for 4 consecutive frames, demo ≈80f) unmount all 3D slats and output page B directly | opacity 0 doesn't count as removing; leftover clip-path / 3D layers ruin true stillness, and text in 3D layers is also less sharp than flat |
| Ending | After removing the mask ≈50f to settle (≥40f; the masthead hairline redraws once, camera 1.02 falls back to 1) | R1 |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- The wipe boundary must carry a bright line/highlight: a wipe without a bright line reads as a PPT transition, the make-or-break point;
  this style uses the dark groove revealed when slats are edge-on + the lit thin line on slat edges as the boundary
- Geometric wipes ≤2 times per film; don't use them consecutively in the same film (two "boundary sweeps" read as template-ish)
- Removing the mask must wait until the last slat's spring converges (≈80f); unmounting one frame early is a slat jump that gives the trick away
- The two pages need strong contrast (demo: warm white paper vs full-page vermilion; the two pages are consecutive pages of a video-shotcraft publication, masthead the video-shotcraft wordmark,
  giant type "Frame." → "Craft."), and the layout grid is best isomorphic with the slat width (12 columns × 160px): two pages in the same colour family flipping show only the dark grooves
- Draw vignette / grain only once on the outermost layer, not into each page (each slat slice would carry its own piece of vignette, giving it away at the slat seams)

## Reference implementation
demos/transition/wipe-transitions/
(BlindsSlice.tsx)
