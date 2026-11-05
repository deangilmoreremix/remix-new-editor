---
name: gradient-word-sweep
one_liner: In a tagline on black, the keyword is "charged" by a gradient colour light sweeping quickly left to right — characters at the wavefront glow brightest, decaying behind it; once filled, thin purple-magenta lightning links between characters and the whole word breathes with a steady-state bloom
use_when: Charging a single verb / selling-point word in a tagline (Supercharged/faster/AI…); text action for the energy climax; the slogan frame of a black-field brand film
length: sweep-charge ~15–20f (must be fast) + steady-state lightning breathing 1–2s; whole section 2.5–3.5s
energy: high (one word is the explosive point; everything before and after should give way)
tags: effects
---

## Intent
In a sentence of white text, only the keyword is "electrified": a gradient colour light sweeps quickly across the characters from left to right,
like energy being injected — brightest at the moment of passing (the wavefront trail), then decaying to steady state;
once filled, thin lightning jumps and links between the characters, and the word keeps breathing with bloom. Three make-or-break points:
**fast** (sweep-charge 15–20f; slower reads as a progress bar), **brightest at the wavefront** (just-lit
characters have the strongest effect; without this gradient it is just a static gradient clip), **restrained glow**
(AE-style multi-layer bloom but don't let it smear into a blob; lightning that is thin and sparse is what makes it an accent).

## Motion core
- Gradient fill: the keyword is two layers of text (white / gradient colour), with the colour layer revealed by a
  mask advancing left to right; the angled mask edge is slightly soft (~8% of word width)
- Wavefront trail brightening: a brightening band ~34% of word width follows the mask's leading edge, with glow strongest
  at the wavefront and decaying behind; after the fill ends it fades to steady state over ~10f
- Glow: 4 layers of bloom (large ambient soft light + mid halo + near core + bright core), steady-state opacity
  in the 0.55–0.72 range (measured: the 0.75–0.95 range was ruled "the bloom feels a bit strong")
- Lightning: once filled, thin lightning links between characters, a purple-magenta family with three stroke layers (outer halo 6 / mid 2.4 /
  bright core 1.4), flickering at random jumping positions from a mulberry32 seed, sparse and sporadic (not a continuous arc)
- Forbidden: no following light dots/sparkles moving with the fill (measured ruling: a following white light dot reads as cheap decoration — delete)
- Glow layers with blur cannot use the text box directly as mask/clip: blur that overflows the box gets cut into a rectangular "boxed light" —
  the demo puts these layers into a box expanded by 90px on all sides, with the mask colour stops converted back into text coordinates via `calc(PAD + (100% − 2·PAD)·x)`
- Demo duration `GRADIENT_WORD_SWEEP_DURATION = 105` (3.5s): the two lines enter with a staggered blur-slide,
  sweep-charge at 12→30f, 7 scheduled lightning strikes from 33f (the last goes out at ~92f), with an extremely slow push-in of 1→1.025 over the whole section

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Sweep-charge duration | 15–20f | In the source clip it's "very fast"; >28f reads as a progress bar |
| Wavefront brightening band | ~34% of word width, brightest at the wavefront, decaying behind | No gradient = static gradient; band too wide = the whole word lights at once with no sense of "injection" |
| Steady-state bloom | 4 layers at opacity 0.55/0.55/0.62/0.72 | The 0.75+ range was ruled too strong; fewer than 3 glow layers reads as flat colour |
| Lightning line width | outer 6 / mid 2.4 / core 1.4 @1080p | Doubling it got ruled "thick"; colour leans purple-magenta (magenta 216,60,190 family) |
| Lightning frequency | sparse and sporadic (≤2 bolts on screen at once, gaps >8f; demo schedules 7, 1 bolt on screen at a time, intervals ≥4–11f) | High frequency reads as an electrical-arc malfunction |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Three rulings (distilled from the user's verbatim feedback): ① no following light dot during the fill; ② the lightning
  must be purple-magenta + thin; ③ bloom should err weak rather than strong, with the wavefront gradient supplying the impact
- Division of labour with type-rhythm-sync: that card is about the beat;
  this card is the energy semantics of "charging" a single word, and the word must be the sentence's selling-point word
- Body text other than the keyword stays pure white and still — if the whole sentence moves, there's no drama of "only it is electrified"

## Reference implementation
demos/typography/gradient-word-sweep/
(GradientWordSweep.tsx)
Source clip: clickup-30.mp4
