---
name: brace-expand
one_liner: A pair of small, touching curly braces appears dead centre, then springs apart left and right with one overshoot while scaling up to title size; the text's clip width is strictly bound to the braces' inner edges, revealed from the middle like a curtain being drawn open, and after landing the tracking relaxes slightly
use_when: Title cards for developer/technical products; chapter openers; a minimalist single beat where "one symbol does the whole reveal"
length: about 4s (120f@30fps: cursor 0–6f → 6f hard cut to small braces → 14f spring apart → 40–64f tracking relax → subtitle → hold)
energy: medium (a single overshoot is the only peak; everything else is still)
---

## Intent
Of all title-reveal techniques, this card is the most economical: no mask bars, no per-character, no travel — just
a pair of braces moving apart, and the text gets "bracketed out". It carries a built-in code feel (`{}` are curly braces),
so in a technical-product context it reads as "this is the content itself". The make-or-break point is that the clip width **must be strictly
bound to the brace positions**: as soon as the text fades in or wipes in on its own, the braces degrade into decoration and the curtain feel is lost.

## Motion core
- On frame 0 the centre holds a blinking text cursor (editor feel, not an empty frame); at 6f it is **hard-cut replaced** by a pair of "{}" at 0.4× with inner edges touching
  (no fade-in), and rests 8f — first establish "this is a pair of braces"
- Spring apart `ex = springAt(f, 14, { damping: 14, stiffness: 130 })`: ~8f after launch it arrives, ~11f overshoot peak ≈9%, ~24f converged — one visible rebound
- Synchronous scale-up `sc = mix(0.4, 1, ex)`; curtain half-width `x = (HALF − INNER)·ex·sc`, brace centres `±(x + INNER·sc)`
  (HALF=676, INNER=64) — **travel and scale are multiplied together**, so the scale-up itself also pushes the braces apart; at ex=0 the two braces' inner edges exactly touch
- Text reveal width `clip.width = 2x` (strictly bound to the braces' inner edges), 14px feather on both sides (the feather shrinks with the clip when it is narrow)
- The text also gets `scale(sc)`, sharing the same sc with the braces; after landing the tracking relaxes −0.05em → −0.03em (40–64f smooth) — "letting out a breath"
- Texture (midnight): monospace 300px electric-blue braces + bloom (bloom peak follows the overshoot, falls back over 34–64f); during the fast part of the spring-apart, directional
  motion blur by horizontal velocity (amount 0.22, capped at 16, 0 once landed); the title (in the demo the brand name video-shotcraft, all lowercase) 164px weight 800 white→cool-blue gradient; background an editor dot grid (32px, radial fade-out) +
  top light + horizon light band, and below the braces a cool light reflection that widens as they spread
- Aftermath: the eyebrow `// shot recipes for your agent` (monospace 32px cyan) enters from 44f with tracking tightening, the subtitle (brand tagline Frame motion. Craft the shot.) rises word by word out of blur from 54f; 70–120f the whole frame slowly pushes 1→1.012
- Everything is absolutely positioned (braces / clip box / text all compute left from a 960 centre line), **no flex**: widths change throughout and flex would reflow

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Brace appearance | 6f hard cut replacing the cursor | The hard cut is right (the symbol is just "snap", there); switch to a fade-in and you lose the frames where you "see the braces clearly first", and the spring-apart feels abrupt |
| Spring apart | spring from 14f, damping 14 / stiffness 130 (≈9% overshoot) | The overshoot is the only peak in the whole piece; damping ≥18 reads as sliding open, without the force of "propping open"; <12 rebounds twice and reads as jelly |
| Half spacing | HALF = 676px (brace centre), INNER = 64px (brace centre to inner edge) | Determines the width the title can fit: inner cavity = 2·(HALF−INNER) = 1224px |
| Scale | `mix(0.4, 1, ex)`, braces 300px / text 164px | 0.4 start is the "small font size" amount; a start >0.8 doesn't read as scaling up, <0.3 the braces start so small they look like punctuation |
| Copy width | "video-shotcraft" at 164px measured ≈1130px when landed (inner cavity 1224px minus feather on both sides) | Text much narrower than the cavity is fully revealed before the braces arrive, weakening the curtain feel; wider than the cavity and both ends get clipped |
| Tracking relax | −0.05 → −0.03em, 40–64f smooth | This is the "breath after landing"; relaxing makes the text wider, so it must stay within the cavity |
| Motion blur | SpeedBlur amount 0.22 / max 16 | At amount 0.35 the braces smear into three horizontal streaks on the peak frame and are unrecognisable as braces |

## Known pitfalls
- **Copy length must match HALF**: the clip only crops, it doesn't scale — with a long title the braces crop both ends of the text,
  so HALF must be increased (or the font size reduced) at the same time; Chinese characters are about twice as wide as English letters, so 6 Chinese characters is close to the limit
- The clip width grows from 0, so the text **always reveals from the middle outwards**: the copy's
  visual centre of gravity needs to be in the middle (a centred single-line short phrase works best); long phrases asymmetric left/right reveal awkwardly
- The braces and the text must share the same `sc`: writing two separate scale curves (even with identical values)
  produces, during the overshoot frames, a mismatch where the braces have arrived but the text is still growing
- Only one overshoot: no other motion in the piece overshoots, which pins attention on the single action of
  "propping open"; layering any other back / spring overshoot devalues it
- The clip box height is hard-coded at 220px (164px title plus top/bottom margin); if the font size changes a lot, update it too — otherwise the top and bottom get cut
- Sound: the spring-apart deserves one short mechanical/wooden open-close sound, silence after landing;
  for scoring discipline see sound-design.md

## Reference implementation
demos/typography/brace-expand/
(BraceExpand.tsx)
