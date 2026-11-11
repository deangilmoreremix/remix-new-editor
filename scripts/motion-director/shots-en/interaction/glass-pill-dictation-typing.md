---
name: glass-pill-dictation-typing
one_liner: A fixed-width glass pill pops out about 1.25× slightly oversized and then settles gently into place, with a layer of warm accent-colour light inside fading from light on the left to dense on the right; the cursor leads, then the dictated sentence is typed out at a constant speed, and the light (together with the ambient light behind the pill) gradually recedes with the typing progress, ending as a neutral frosted-glass bar
use_when: The entrance of a voice/AI input box; an interaction-hint shot for "talk to it"; a quiet transitional beat between high-energy segments
length: about 3.3s (100f@30fps)
energy: low (the quietest beat of the whole film; only the light is receding)
---

## Intent
Use "the light going out with the input" to tell a very small story: on standby it glows (waiting for you to speak), and the moment you open your mouth
it hands its light over to the text. In 3.3s it does only three things: pop out, type, light recedes. Any extra motion
(bounces, colour changes, icon animations) would stop this beat from being a rest.

## Motion core
- Pill 1240×132, corner radius 66, `padding: 0 20px 0 58px`, **fixed width** (doesn't stretch or shrink with typing);
  dictated text 56px, a 92px circular waveform button at the right end
- Entrance `scale 1.25→1`, snappy (strong ease-out) 20f; opacity is full within the first 2f: it "is there" first, then settles;
  for the 14f before settling it carries a 6px→0 depth-of-field blur (the enlarged segment reads as "closer to the lens")
- Material: `backdrop-filter: blur(26px) saturate(1.3)` true frosting (the warm light spots behind are diffused by it),
  a bright-top/dark-bottom white volume gradient + 1.5px white outline + a highlight line along the top edge fading out at both ends + an inner dark edge at the bottom rim + a two-layer warm landing shadow
- Embedded accent-colour light: `linear-gradient(90deg, α0 → α.18 @38% → α.62 @78% → apricot α.95 @100%)` light on the left, dense on the right,
  plus a burst of screen-blended highlight in the lower right corner: the light is **inside** the pill
- Typing: the cursor leads at f2, characters from f8 at a constant 2f/character until all 28 are laid out; the cursor is withdrawn at f66–74
- Light going out `g = 1 − smooth(f10→f72)`, in the same window as the typing; `g` drives four things at once: the gradient inside the pill, the warm "sun" behind the pill,
  the floor reflection beneath the pill, the waveform button (solid warm → neutral outline), and the outer bloom `60g px`
- The waveform's 5 vertical bars have base heights `[30,16,24,13,20]` (high on the left, low on the right), with a very light breathing of `±2.4·sin(f·0.5 + i·1.7)` stacked on

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Fixed pill width | 1240px (≈1.8× the whole sentence's width) | **The fixed width is key**: stretching with the text reads as a chip rather than an input bar |
| Entrance scale | scale 1.25→1, snappy 20f | 1.25× is the amount for "falling back from right in front of the viewer"; at 1.5× it becomes a pop-up dialog |
| opacity timing | Jumps to full in the first 2f (earlier than the scale settling) | A synchronised fade-in makes it look like it's "gradually appearing", losing that slight sense of solidity |
| Embedded light | 90deg, 0 → .18@38% → .62@78% → .95@100% | The light must be inside the pill; change it to an outer glow and it becomes "awaiting a notification" rather than "awaiting input" |
| Typing | 28 characters, from f8 at a constant 2f/character | Adding ease reads as "someone is hesitating"; dictation is constant speed |
| Light going out | 1 → 0, f10→f72 smooth | Being in the same window as the typing is the film's only causality: the light yields to the text |
| Ambient follows | Warm light behind 0.15+0.6g, floor reflection 0.22g | If only the pill goes out and the environment stays the same, "the light receding" can't be read in a bright field |
| Waveform bars | 5 bars, ±2.4px | At 6px amplitude it becomes the active "recording" state, contradicting "standby" |
| Cursor | Leads at f2, withdrawn at f66–74 | The cursor appearing before the text is the signal that "the input box is ready" |

## Known pitfalls
- backdrop-filter only diffuses the layers **behind** it: the warm light spots must be placed beneath the pill (painted first within the same stacking context);
  if the light spots are too far from the pill, the frosting just looks like a flat white board
- In a bright field the light/dark contrast of light is much smaller than in a dark field: the embedded light needs to reach apricot .95 saturation, and the ambient light behind must recede along with it, otherwise "the light receding" doesn't hold;
  to make a dark-field version, switch the stage back to near-black and desaturate the light colour; the curves don't need to change
- The waveform bars breathe continuously (not controlled by g), so the first and last frames have different heights: when using it as loop material, set the frequency to an integer multiple of 2π/duration
- Typing progress is `floor(p·len + 1e-6)`; that epsilon prevents the last character from not appearing at the whole number due to floating-point error; don't delete it
- The two variables WARM / APRICOT are the brand colours shared by the embedded light, outer bloom, ambient light and button; when switching projects change only these two
- If the sentence length changes, adjust the fixed pill width (keep it ≈1.8–2× the sentence width) and the typing window to match

## Reference implementation
demos/interaction/glass-pill-dictation-typing/
(GlassPillDictationTyping.tsx)
