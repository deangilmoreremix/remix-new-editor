---
name: print-texture-transitions
one_liner: Print-texture transition: ink-bleed-reveal (a feathery bleeding edge spreads and eats the old scene)
use_when: The paper-and-ink aesthetic option for scene-change seams; the third family alongside the three handover styles/travel styles: a "medium developing" type of transition
length: 4–4.5s (spreading segment 55–80f + still ending ≥30f)
energy: medium (gradual reveal, no impact beat)
---

## Intent
The transition language already has handovers (the three styles of shot-transitions) and travel (transition-travel),
both spatial/optical metaphors. This style opens a third family: **the medium metaphor**: the new frame doesn't "arrive"
but is "printed and dyed" into being, directly invoking the physical imagination of the library's paper-and-ink aesthetic: like a drop of ink falling on
rice paper and spreading to eat the old scene, organic, with a handwritten feel. It has a natural affinity with films of a paper/ink tone,
and is another "medium family" seam option besides light-leak-burn (accent-colour light leak).

## Variants
| Style | Approach | Use when |
|----|------|------|
| A ink-bleed-reveal | The new page spreads from the ink drop point through an organic circular mask with a feathery bleeding edge, eating the old scene at an uneven pace | Old scene → new scene replacement; handwritten feel, narrative tone |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Bleeding edge | SVG mask white circle with `feTurbulence(fractalNoise, baseFrequency 0.02, octaves 3, seed fixed)` + `feDisplacementMap scale 60→160 rising with frames` | The filter only kneads the mask shape, content stays sharp throughout; the seed must be hard-coded (determinism) |
| Spreading | Radius [20,98f]→[0,1450px] Easing.out(quad), multiplied by `1+0.08·sin(0.32f)·env` uneven-pace perturbation (env decays to zero over the last 20f) | Constant-speed circular expansion reads as an ordinary iris: the perturbation is "the ink's temper" |
| Ink edge | Two layers of mask circles leading the new scene by 20–42px: outer rim 0.42 opacity + 3.2px feather, inner core 0.86 + 1px feather, plus one more ring +110px out with heavy feathering as a wet halo (0.12); at 14–22f a small ink dot lands first | Without an ink edge it reads as an ordinary iris wipe; an ink edge too wide and solid reads as a hole burned in paper |
| Developing | The new scene scales 1.035→1 inside the mask (20–100f ease-out), returning exactly to 1 before the mask is removed | If it doesn't converge, it jumps on the remove-the-mask frame |
| Ending: remove the mask | Once fully spread (frame ~100) remove the SVG mask and lay the new scene down directly | feTurbulence has sub-pixel jitter; without removing it the ending is never truly still (ruling from real renders in this batch) |
| Ending | True stillness ≥30f after the new scene is in place | R1 |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- The one-seam-one-style rule is the same as shot-transitions: medium transitions don't stack with white flash/screen shake;
  this style and light-leak-burn of the medium family total ≤2 times per film; more and the film reads as a print shop promo
- In the middle of the spread, old-scene content briefly shows through the noise holes in fragments: reading as ink-stain texture,
  this is an acceptable organic effect, but if the old scene contains highly recognisable elements like faces/logos it reads as a glitch, avoid that
- A slow transition (55–80f action segment); don't use it in fast-paced rapid-fire sections: there use shot-transitions style B whip pan

## Reference implementation
demos/transition/print-texture-transitions/
(InkBleedReveal.tsx)
