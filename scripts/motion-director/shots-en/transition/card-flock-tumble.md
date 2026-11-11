---
name: card-flock-tumble
one_liner: Three UI page cards tumble in 3D from their thin side edges into a standing staircase (sharp throughout, spline-continuous and silky); once standing they keep turning slowly without stopping, then are rapidly drawn into the centre, bursting into a single turbulent smoke ring that spreads out, with giant type running across to close
use_when: Energy climax sections (a burst transition from a group of feature pages → brand slogan); neon/aurora dark-field tone; sections where "multi-page capability" converges into one sentence
length: tumble ~1.5s + slow-turn showcase ~0.3s + convergence 0.3s + smoke ring + giant type ~2s; whole section 4.5s
energy: very high (use at the film's energy peak)
---

## Intent
Three page cards tumble and line up in 3D space like flung playing cards; after standing for their reveal they are instantly
drawn into the centre, bursting into a ring of smoke, and the brand's giant type punches out through the ring: "capability showcase → energy
collapse → slogan eruption" in one breath. There are three make-or-break points: **silky** (side edge → tumble → standing is
one Catmull-Rom spline with continuous derivatives; the jerkiness of piecewise interpolation will be noticed),
**never stop** (after standing it keeps a low angular velocity slow turn right up to convergence; a still segment was rejected with "don't stop,
keep it rotating": a climax has no still frames), **sharp throughout** (all motion blur/depth-of-field blur removed, rejected with
"don't add blur effects").

## Motion core
- Tumble: each of the three cards follows a k0 (near-90° thin side edge) → k1 (mid-tumble) → k2 (standing in the
  staircase) Catmull-Rom spline, driven by Easing.out(cubic), ~44f
- Standing slow turn: idle drift ry +0.34°/f, rx -0.1°/f, rz +0.05°/f (14f
  quadratic ease-in to avoid a jolt at the spline junction), not stopping when convergence arrives
- Convergence: 10f Easing.in(quad), accelerating straight from the slow-turn pose into the centre while shrinking;
  opacity stays full for the first 60% (the "suck-in" motion must be clearly readable)
- Flash core: on the same frame the suck-in arrives (70f), a white-hot core at the centre + a 12% full-screen micro-exposure, 6f
  exponential decay, and the ring grows out of the flash core; this fills the energy gap between convergence and the giant type; use only
  radial light, don't draw a geometric stroked ring, don't add particles (both were rejected in rulings)
- Smoke ring: **single** (multiple rings were rejected), three sets of feTurbulence displacement (wispy edge/bright patches/
  dark patches) + a top cream-peach → pink → purple gradient (aurora colour band), screen blend: broken wispy edges,
  light and dark patches, decelerating outward expansion growing slowly, decaying very slowly and lingering, no water-surface light at the centre; zero particle residue
- Giant type: "slams" in just 4f after convergence (74f): 14f snappy shrink from 1.22 to 1, letter-spacing
  tightening from +0.06em to −0.025em, then very slow continuous growth; fill is a vertical gradient from a solid white-hot core → pale purple
  + double-layer pink-purple bloom (brighter at the instant of landing, then falling back), 282px italic spanning about 80% of
  frame width; inside the ring's centre, an eyebrow above (demo: video-shotcraft logo stroke-on + lowercase wordmark) and a
  44px tagline below (brand short phrase) rise in staggered overlap; the final frame is a launch poster
- Background: two rows of 300px monochrome pale-purple outlined type walls drifting slowly in opposite directions + an aurora key light behind the cards holding up
  the card group; at convergence the type walls contract toward the centre with the suck-in and fade out. The card group, convergence point, ring centre and giant type
  share one centre (frame centre moved down 30px)

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Three-card spacing/size | Heavily overlapping into one stacked staircase, scale 1.6–1.74 | Two rounds of escalation rulings: "closer, and bigger": the staircase must read as one group, not three cards |
| Standing slow turn | ry ~0.34°/f continuous | **Never still** (ruling); >1°/f reads as not yet settled |
| Convergence duration | 10f ease-in | The 22f version was rejected as "needs to be fast"; opacity fading out early = suck-in unreadable (rework ruling) |
| Smoke ring | Single ring, turbulent wispy edge, very slow decay | Multiple rings rejected; smooth neon ring/particle versions rejected: build the turbulent texture against dense frames of the original film |
| Blur | Zero blur throughout | Adding blur to tumble/convergence was rejected in both cases |
| Spline | One Catmull-Rom throughout | Piecewise lerp has speed steps; "silky smooth" is the ruling's exact wording |
| Giant type entrance | 4f after convergence arrives, 14f snappy 1.22→1 + letter-spacing tightening | The original version waited 14f before the type appeared, leaving a black field with only a small ring in between, and the climax ran out of breath; slow enlargement (0.7→1 / 34f) reads as a fade-in rather than a slam |
| Flash core | Radial white-hot core + 12% full-screen micro-exposure, 6f decay | Without it the ring seems to pop out of nowhere; adding a stroked bright ring instantly looks cheap (same ruling as the smoke ring) |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Smoke ring texture ruling: clean graphic rings (stroked circles/concentric waves) were rejected three rounds; the final version
  has feTurbulence turbulent wispy edges checked frame by frame against dense frames of the original film: "it must be the same"; the remaining gap
  is that the noise field is static (whole-ring rotation + growth), with no per-frame turbulent rolling, so the flow feels weak up very close
- The smoke ring is the aftershock of energy collapse, not a celebratory hit point: adding particle confetti is forbidden

## Reference implementation
demos/transition/card-flock-tumble/
(CardFlockTumble.tsx)
Original source: clickup-30.mp4
