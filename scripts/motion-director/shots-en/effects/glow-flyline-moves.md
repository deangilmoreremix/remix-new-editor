---
name: glow-flyline-moves
one_liner: Three dark-field light-orb and flyline styles: glow-orb-ambient light-orb ambience, flyline-arc flyline connection, orb-flyline-relay same-frame resonance combination
use_when: Atmosphere and data narrative for the film's only dark-field section: A for laying ambience, B for telling data flow direction, C when the background should chime in with the foreground; Linear website flavour
length: A 170f (~5.7s) / B 140f (~4.7s) / C 165f (5.5s)
energy: A low (ambience level) / B medium / C medium-high
tags: data
---

## Intent
This is the first card in the library that lives entirely in a **dark field**. Read the "brightening on a white base is invisible" ruling backwards and you get:
to play with light, go to a dark field first. A is the breathing of space: three big light orbs on a dark base drift organically, swimming behind
a central frosted glass card, their colour dyeing the card face through the glass, the card edge glowing as the nearest orb approaches,
so the background is no longer dead; B is the verb of data: a glowing arc "fires" from card A to card B,
a bright head leading, a fading light tail, the landing outline lit by a pulse, and metric relationships for the first time have a direction; C is the welding of A+B: on the flyline's landing frame the neighbouring orb brightens for a beat on the same frame,
the ambience layer and the event layer **resonating on the same frame**, chiming in with each other rather than each doing its own show (the make-or-break point of the combination: split off the resonance frame
and it degrades into two cards side by side).

## Variants
| Style | Approach | Use when |
|----|------|------|
| A glow-orb-ambient | Three 760–1200px multi-stop radial-gradient light orbs (screen blend, no real-time blur), double-sine drift; a central 1100×600 frosted glass card (backdrop blur + saturation boost) lets the orbs' colour through; the card edge glow is driven by the max of weights from orb distance [240,760]px→[1,0] + a directional rim light toward the dominant orb | Laying the base of a dark-field section; card breathing feel |
| B flyline-arc | A darkened dashboard as the base, a hand-written bezier from card centre to card centre sampled into 100 segments, 22f out-cubic growth; light head + comet tail conditionally mounted leading the way, segment opacity fading by distance from the head, smoothed out over 10f on arrival; the start anchor lights up, the landing node stays on; landing card outline pulse + impact ring, relayable | Data flow direction/metric relationships; dashboard narrative |
| C orb-flyline-relay | A+B welded: each of three glass nodes has its own orb behind it, the orb surge and node lighting share the landing frame constant, brightening 1+1.6×surge and enlarging 12%, 5f rise 15f dissipation; after arrival the flyline dissipates into a fine dotted line | Dark-field highlight sections; three-stop relay closing |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A light orbs | Tidal teal / deep-sea blue / coral, peaks 0.55/0.5/0.42; drift amplitude 280–300px, periods 96–150f interleaved and unequal | Drift at the same period reads as the whole thing swaying, not "organic" |
| A glass card | backdrop blur 44px + saturate 1.5; ancestors must not carry filter / opacity<1 | When an ancestor becomes the backdrop root you can't see the orbs in the glass (put the entrance fade-in on the glass layer itself) |
| A card edge glow | box-shadow 0→90px in the dominant orb's colour 0.32 + 1.5px directional gradient rim light | Without the glow, orbs and card don't know each other |
| A convergence | 115–145f out-sine converging to a freeze (amplitude 60/π, initial slope = 1 for speed continuity), true stillness for the last 25f | A one-frame hard stop reads as freezing up; only an eased convergence gives true stillness |
| B line body | Dark-field version (demo): white core 3.5px butt-cap segments + 7px/18px two layers of indigo glow; light-base version: white line 4.5px + 9px dark underlay | On a light base a white line without underlay simply disappears (ruling); round caps on segments stack into a string of beads in the fading tail |
| B light head | White dot r7 + r40 halo + 9-point comet tail, conditionally mounted only during growth | opacity reaching 0 doesn't count as removing the mask, never truly still |
| B pulse | Outline spread out-cubic 6f / dissipation 12f to a residual 0.25; dark-field version brightened (accent-colour outline + outer glow + very faint card-face brightening) + 14f impact ring; fully still after f86 | Brightening forbidden on white bases: the light-base version uses a darkening veil 0.16 instead |
| C resonance | surge starts on the same frame as landing (the same constant LIT_B / LIT_C); node lights to 1 over 8f + outline pulse residual 0.35 + 20f impact ring | Off by 2f or more and the resonance can't be read as "chiming in" |
| C timeline | Actions end before f98, orbs converge to a freeze at 110–140f, true stillness for the last 25f | The ambience layer freezes last, the event layer wraps up first |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Switching between a dark-field section and the paper-and-ink light-base key visual is costly: ≤1 dark-field section per film, and going in and out
  cushion it with the shot-transitions hidden-cut family; don't cut raw between light and dark
- The end of the orb drift **must** ease to a convergence before freezing: clamping a constant-speed drift directly
  is a visible hard brake (style A out-sine convergence ruling)
- Real-use brand colour version: use a brand colour pair for the orbs (e.g. blue-purple); the greyscale parameters only guarantee the lightness relationships,
  hue contrast needs re-tuning
- When B relay lines are ≥3, switch to C: pure flylines in rapid succession read as a big-screen template, only resonance gives an authorial feel
- Sound: B/C a light tick at each landing, A silent (sound-design §4.5)

## Reference implementation
demos/effects/glow-flyline-moves/
(FlylineArc.tsx / GlowOrbAmbient.tsx / OrbFlylineRelay.tsx)
