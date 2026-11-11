---
name: flying-words
one_liner: 22 keywords laid out by the golden angle on a flattened elliptical cross-section fly along the z axis from far away to brush past the camera, opacity following a [0,1,0.5,0.2,0] life curve, running a full 2 cycles with a seamless loop
use_when: A dynamic background for keyword clouds / capability lists; an "information density" underlay for openers and closers; transitions that need a sense of travelling through depth
length: about 6.0s (180f@30fps, 2 complete cycles, can be chained seamlessly)
energy: high (continuous full-screen 3D motion, the frame is never still for a moment)
---

## Intent
The most clumsy way to list keywords is to pile up a screen of static word cloud. The word tunnel **spreads the same batch of words out along the timeline**:
spawned in the distance, growing from small to large, brushing past the lens and disappearing; viewers are only ever reading three to five words, yet the subjective impression is
"there are a lot of words". It is a background layer, not a hero layer — the camera doesn't move, the elements do — so pressing a title
or UI layer over it in the foreground doesn't clash at all. Replace the word list wholesale with project keywords and you're done; not a single line of motion logic changes.

## Motion core
- Perspective (in 480 design coordinates) `perspective:1100px`; words advance linearly along z from **-1750 → 800px** — positive values pass through
  the camera plane, which is what produces the "brushing past". The demo is drawn natively at 1920, with the same set of values scaled ×4 throughout: P=4400, z −7000 → +3200,
  with the projection computed by hand as `s = P/(P−z)` (point-for-point equivalent to CSS perspective)
- Placement uses the golden angle: `a = i·2.39996 + rand(i·7+1)·0.8`, radius `r = 82 + rand·165` (native ×4: 330 + rand·660),
  with the y radius further ×0.6 to flatten it into an ellipse — keeping clear of dead centre and stopping a few nearby words from piling into a clump
- Life curve `OP=[0,1,0.5,0.2,0]` @ `OT=[0,0.25,0.6,0.85,1]`: **in the first 1/4 it brightens sharply to full,
  in the middle drops to semi-transparent, and at the end trails off and disappears** — not a simple fade-in/fade-out; dimming in the middle is what keeps it from covering the foreground
- Spreading outwards `drift = 0.5 + u·1.35`: far away they are gathered at the centre, and the closer they get the more they are flung off-frame,
  which stacks with the z advance into real perspective
- Near-end blurring: when `u > 0.86`, defocus is added linearly by `(u-0.86)` — words rushing at the eye grow uncontrollably large, and this blur layer hides the ugliness;
  the real sense of speed is handed to directional trails by screen velocity (demo: 6 layers of progressively fainter text-shadow afterimages along −v, much cheaper than putting
  a full-screen SVG filter on every word); for the first 22% of travel at the far end, atmospheric-haze defocus is added too
- The demo adds two more depth references moving through the same tunnel: 10 flattened elliptical hairline rings (the tunnel walls, thickening and fading out when near) + 56 dust motes drawn as
  light-speed streaks stretched radially (streak length = the screen displacement of the last 2.6 frames); the whole tunnel rolls extremely slowly by `±2.5°·sin(2πt)` (a periodic function, consistent at start and end)
- Foreground: in the demo a static wordmark group is pressed at dead centre (mono eyebrow + 112px title + radial dark scrim), and words flying into the wordmark's elliptical area have their opacity pushed down to 20%
  — demonstrating how "background layer + foreground title don't clash"; the wordmark is static, so the loop stays seamless
- `CYCLES = 2` is a whole number of cycles; the demo takes `t = frame / DURATION` (the frame after the last frame = frame 0) so it loops seamlessly; each word's phase
  `ph = i/N` is evenly distributed, and spawning is fully deterministic; the central electric-blue glow `opacity = 0.82 + sin(t·4π)·0.14` breathes twice,
  pinning the visual anchor of "the end of the tunnel"

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Word list | 22 words, font size `20 + rand·16`px (20–36; native 64–120), weight 700 + 6 serif italic words | Word count is bound to the phase `i/N`: <12 words and the frame is sparse, >30 words and the near field blurs into a mass; random font sizes are the source of layering, all the same size reads as a texture |
| Depth travel | z −1750 → +800px, perspective 1100 (native ×4) | A farther start (−2500+) makes words too small to recognise; if the end doesn't pass 0 there's no "passing through", only "flying up to your face and stopping" |
| Spread factor | `drift = 0.5 + u·1.35` | Factor <1 and all words spray from dead centre like an explosion; >2 they fly off-frame too early and the tunnel becomes a fountain |
| Life curve | `[0,1,0.5,0.2,0]` @ `[0,0.25,0.6,0.85,1]` | That 0.5 in the middle is there to make way for the foreground; change it to full brightness all the way and it steals the hero's scene, drop it to zero early and the tunnel goes empty |
| Cycle count | `CYCLES = 2` (must be an integer) | Non-integer → t=1 doesn't join t=0 and there's a jump at the loop; the more cycles, the faster each word passes the lens |
| Near-end blur | linear defocus from `u>0.86` + directional trail by velocity | Raise the threshold to 0.95 and huge words have harsh hard edges; a factor >40 turns the final stretch into colour smudges |
| Palette | demo (midnight): three cool-white tiers `#f2f5ff/#c3cbe2/#8a95b5` + 4 electric-blue accent words `#86a8ff` (only accent words have bloom), central glow electric blue | Light text glowing on a dark background is its ID card; applying this card on white simply fails — for a light background, the whole palette must be reworked |
| Central glow | ~1040×720 radial gradient, breathes 2 times per piece | Delete it and the tunnel's end has no focal point, the words look like they're flying around at random; the breathing frequency must align with CYCLES or it beats against it |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- When replacing the word list **keep the word count and word-length magnitude** (demo 22 words, 4–9 letters each): the phase is
  evenly distributed by `i/N`, so a change in word count scales the density as a whole; Chinese words are more than twice as wide as English ones,
  so when switching to Chinese keywords reduce the font size accordingly, or near words will fill the whole frame
- `CYCLES` must be an integer, otherwise start and end don't join — this is the sole precondition for this card's "seamless loop";
  if you want to tune how fast words pass the lens, add or subtract whole numbers, don't change it to a decimal
- Background layer only: the life curve is pressed to 0.5 in the middle precisely to make way for the foreground; treating it as the hero
  (maxing out brightness) actually reads as clutter
- Dark backgrounds only: `text-shadow` glow + radial vignette are half the effect; on a light background the words smear into
  dirty specks; all 22 word elements stay mounted in the DOM throughout (not destroyed and rebuilt), changing only transform/opacity —
  when porting to Remotion keep this structure, don't change it to adding/removing nodes per frame

## Reference implementation
demos/typography/flying-words/
(FlyingWords.tsx)
