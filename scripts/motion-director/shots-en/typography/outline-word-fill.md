---
name: outline-word-fill
one_liner: A hollow word (thin warm-grey stroke, weight 500) snaps down from 3.2× with a fast-then-slow ease and lands; a large dashed circle then shrinks from 2.8× to sit around the word and slowly rotates, while horizontal dashed lines on the left and right extend inward from the frame edges; the stroke first brightens slightly, then the solid white-hot word lights up with a hard cut within a single frame, a single flash of glow, and it freezes
use_when: A hammer-blow beat for a single-word benefit/slogan; the "nail" shot on a rhythm hit point; an emphasis frame in a dark-background brand film
length: about 3.0s (90f@30fps, a short single beat + 36f settle)
energy: high (3.2× shrink + instant light-up, high impact in a short time)
---

## Intent
Driving a word in like a nail isn't done with a slow fade-in but with **two landings**: first the giant hollow word
shrinks rapidly into place (the landing of size), then the stroke turns solid white within one frame (the landing of
texture). The 1.5s in between — the dashed circle shrinking and the horizontal dashed lines extending inward — is the
"aiming" process: technical-drawing vocabulary that makes the light-up read as "confirmed". The fill **must be
instantaneous**: a slow wipe fill would turn the nail into a slow cosmetic animation.

## Motion core
(The demo is calibrated in native 1920×1080 coordinates and frame numbers; look = ember warm black · orange)
- Hollow word fast-then-slow shrink: `scale = mix(3.2, 1, ramp(f, 2, 11, EASE.snappy))`, fade in over 2–8f —
  **the shrink window is only 11f**, so fast it is almost a single impact; apply momentary defocus according to scale velocity (back to zero once it settles)
- Two-layer word: `outline` (`color:transparent` + `-webkit-text-stroke:2px` warm grey) and `solid`
  (white-hot #fff5ee, initial opacity 0) stacked, 220px / **weight 500** Helvetica Neue
  (a medium weight, not the 800 of titles — a hollow word that is too bold smears into a blob)
- Large dashed circle (r=410, `dasharray 22 18`) + an inner 72-segment tick ring (a long tick every 30°, slowly counter-rotating) + four registration ticks:
  fade in over 8–18f, `scale 2.8 → 1` shrinks slowly over 8–52f (EASE.out, **44f, the slowest curve in the whole piece**); the main ring rotates at 0.22°/f,
  and brakes to a stop at the instant of light-up ("lock-on"), while the inner ring keeps slowly turning so the frame still breathes during the hold
- Left and right horizontal dashed lines (`dasharray 14 12`): over 28–46f extend inward from the frame edges to 28px outside the circle edge, with crosshair dots on the line ends;
  mono readouts above the lines, "BEFORE 1 week" / "AFTER 4 hrs" — telling "faster" as a before/after data pair (a week of hand keyframing vs. a finished film from video-shotcraft in one afternoon)
- Stroke pre-heat: over 44–53f, warm grey → bright orange-white with a little outer glow, giving the hard cut a "charging" prelude
- **Instant fill**: at frame 54, `lit = frame >= 54 ? 1 : 0`; solid and outline opacities hard-cut, with no intermediate state;
  on the same frame the circle / horizontal lines lock to orange and the right-hand readout turns orange
- A glow that flashes and vanishes: `flash = lit · (1 − ramp(f, 54, 8))`, two text-shadow layers of white 14px + orange 60px; after decaying over 8f
  only a very faint orange halo remains; a shockwave ring expands 160px outward from the circle edge and dissipates over 14f (only once); the stage key light pulses once in sync
- Settle: over 56–70f the eyebrow inside the circle (a small video-shotcraft logo + an all-lowercase mono wordmark) / subline (40px, "One prompt to a finished promo.") rise; 70–90f hold, with a very slow push-in 1→1.015 throughout

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Shrink | `scale 3.2 → 1`, window 11f, snappy | 3.2× is the amount for "pulling back from right in your face"; <2× reads as an ordinary scale; a window >20f becomes a slow zoom and the impact is completely lost |
| Weight & size | 220px / **500**, about one third of the frame width | 700+ on a hollow word makes the thin stroke enclose a big blank area and it reads as balloon lettering; 500 is the sweet spot for hollow type |
| Stroke | 2px warm grey (138,118,104), pre-heated to bright orange-white before light-up | A thin stroke is "technical drawing" vocabulary; >4px becomes graffiti; delete the pre-heat step and the hard cut feels unmotivated |
| Dashed circle | r=410, `dash 22 18`, scale 2.8→1 (44f), 0.22°/f rotation, brakes at light-up | The 44f slow shrink is the "breath" of the piece, contrasting fast vs. slow with the 11f word shrink; squeeze the window to 20f and the two collide |
| Horizontal dashed lines | `dash 14 12`, extend inward over 28–46f to 28px outside the circle edge | The inward end must stop outside the circle edge (not inside the circle); extending across the full width reads as a crosshair, which is too much |
| Instant fill | Hard cut at frame 54 (decided by frame, not by a normalised time window) | **This moment is the whole point of the card**: any kind of slow wipe (>3f) downgrades the nail into a cosmetic animation |
| Glow | white 14px + orange 60px, fully decayed in 8f; shockwave ring 14f | Only a flash that vanishes reads as "lighting up"; a sustained glow reads as a glowing font and the texture instantly looks cheap |
| Length | 90f (3.0s): 36f hold after light-up | With <20f after light-up the audience doesn't have time to read the subline and readouts |

## Known pitfalls
- Tuned on placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use.
- **Only suits a single short word (demo `Faster`, 6 letters)**: the 220 font size and the dashed circle r=410 are a hard-coded
  set of coordinates; once the word gets longer it punches through the circle, and the inward end of the horizontal dashed lines also lands on the word —
  switching to two words or four Chinese characters requires adjusting `SIZE` / `R` / the inward end point together, all three
- `-webkit-text-stroke` is a prefixed property and only works in Chromium/WebKit; in Firefox the
  outline layer is fully transparent (the word suddenly appears only at the light-up frame). Remotion runs on Chromium, so no problem
- The instant fill must hard-cut by **frame** (demo `frame >= POP`). An early version used a normalised time window `seg(0.742, 0.762)`;
  as soon as the clip got longer that window became a visible gradient lasting several frames — when changing the length, only move the `POP` frame number
- Dark-background only: warm black background + thin stroke + glow is the entire effect; on a light background the hollow word
  is almost invisible and the whole set needs to be reconfigured
- Strong dependence on sound: the light-up frame must have a short, sharp accent (metal / switch / low-frequency hit);
  that is half of this card's "nail" feel; see sound-design.md for the scoring discipline. Division of labour with
  word-relay-geometry: that card is a three-word relay (this card is a standalone, upgraded version of
  its first segment); don't place the two side by side in the same film

## Reference implementation
demos/typography/outline-word-fill/
(OutlineWordFill.tsx)
