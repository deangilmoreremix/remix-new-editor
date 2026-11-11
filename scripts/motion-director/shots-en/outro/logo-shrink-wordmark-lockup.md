---
name: logo-shrink-wordmark-lockup
one_liner: A large notched neon ring rapidly contracts into a solid small white O at centre, swaps to the video-shotcraft logo during the overshoot brake, the icon shifts left to make room, the wordmark's letters slide in one by one to complete the lockup, and an accent-colour tagline closes
use_when: End-of-film brand sign-off: converging from full-screen graphic energy to the standard "icon + wordmark + tagline" lockup
length: About 4.4s (132f@30fps; contraction 0.1–1.2s · make room 1.5–2.1s · letters 2–2.7s · tagline 3.2–3.7s)
energy: medium (the contraction has impact; overall a calm settling rhythm)
---

## Intent
The film's closing "stamp": the full-screen neon ring collapses with its energy into a small icon, heals its notch and turns pure white (from performance state to standard state), then settles step by step according to the brand lockup spec — icon makes room, wordmark enters, tagline brings up the rear. What the audience sees is the brand "standing firm" out of motion.

## Motion core
- Main contraction curve: scale 5.4→1 (t=0.02–0.28, inOutCubic), with a `sin(π)*0.06` overshoot brake layered at t=0.26–0.37 — swelling 6% the moment it arrives and settling back, "a hard stop with inertia"
- Notch healing and colour change run on the same track as the contraction (t=0.10–0.28): the neon glow layer fades out, the stroke switches from #dfe9ff to #fff halfway, the solid white O fades in — three layers cross during the shrink, so it's already a clean white mark on landing
- t=0.24–0.32 the white O cross-swaps to the video-shotcraft "Frame Chisel" logo (reversed-out version, on the same beat as the brake and shockwave; already at final size when the swap happens); the ring rotates in the inner layer, the outer layer holding the logo only scales and never rotates — the diagonal cut angle stays constant throughout
- t=0.34–0.47 the icon shifts left as a whole to make room (inOutCubic, −90.5px = half the total lockup width minus half an icon), clearing the right side of the central axis for the wordmark
- The wordmark `video-shotcraft` (15 characters, 22px / 700, all lowercase) slides in staggered by `0.46 + i*(0.24/15)`: opacity 0→1 + translateX 8px→0, each over 0.10 outCubic
- The tagline is the brand short line `FRAME MOTION. CRAFT THE SHOT.` (accent colour `ACCENT`, 12.5px wide letter-spacing), the whole line fades in at t=0.72–0.84, not letter by letter — one tier below the wordmark in hierarchy

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Contraction range | scale 5.4→1 | The starting multiplier decides "from how full to how small"; <3 lacks impact, >7 the initial state blurs off-frame |
| Brake overshoot | +6%, sin envelope 0.26–0.37 | Cut it and it reads as a hard freeze; >10% becomes jelly |
| Healing window | 0.10–0.28 (in sync with the contraction) | Healing must complete before landing — still changing colour after landing reads as "not ready" |
| Left shift to make room | −90.5px (derived from `WORD_W`/`GAP`/`ICON`), 0.34–0.47 | Nearly seamless with the first letter entering (0.46); widening the gap creates an "empty wait" feeling |
| Letter stagger | `(0.7-0.46)/n` (15 characters = 0.016/letter), each 0.10 duration | Short 5-letter words can loosen to 0.035/letter; with many letters back-calculate the interval from `(0.7-0.46)/n` so all have started before 0.7 |
| Tagline entrance | 0.72–0.84 whole line fades in | Deliberately not letter by letter: the tagline is a footnote, not the lead; change the `ACCENT` constant to the project colour |

## Known pitfalls
- `WORDMARK` = `BRAND.name`, tagline = `PITCH.en.motto`; when changing the brand word, the letter stagger rhythm depends on the letter count (already auto back-calculated from the count); when the tagline's character count changes adjust the letter-spacing accordingly, otherwise the wide-spaced layout overflows or becomes too sparse
- The icon is a two-layer "performance state → standard state" structure: an SVG double-arc notched ring (glow/colour) heals into a white O, then on the brake cross-swaps to the video-shotcraft logo (clean state, no glow); when using another logo, likewise don't let the logo rotate along with the ring
- The left shift is coupled to the wordmark width: `WORD_W` is the measured width of the wordmark row (re-measure when changing typeface/font size); `SHIFT` and the letter row's left edge `ROW_LEFT` are both derived from it, keeping the lockup centred in frame overall
- There is no loop-back design after closing; use it as the outro's final shot; if you need a loop, append a 1s still after t=1

## Reference implementation
demos/outro/logo-shrink-wordmark-lockup/
(LogoShrinkWordmarkLockup.tsx)
