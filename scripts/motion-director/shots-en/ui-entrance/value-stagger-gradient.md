---
name: value-stagger-gradient
one_liner: As 16 bars enter, the delay is a time stagger, while four properties (height / hue / offset / blur) each spread into a numeric gradient from first to last; on the second beat the stagger origin switches to the centre, and the pulse amplitude spreads out anew with the centre at maximum
use_when: Showcase shots for technique demos and parametric capability; can also serve directly as the entrance for data / spectrum / equaliser type interfaces
length: about 5.0s (150f@30fps)
energy: medium-high (the first beat is a continuous spread, the second beat's centre pulse is one clear peak)
---

## Intent
stagger is usually used only to offset time. What this card wants to say is that it can also offset **values**: the same index decides both
"when it moves" and "how far it moves". The two beats are a controlled experiment: on the first beat the origin is at the first bar (the gradient spreads monotonically from left to
right), on the second beat the origin moves to the centre (the gradient spreads symmetrically about the central axis). What the viewer sees is not two animations
but the same recipe with one parameter changed. The on-screen code caption switches to the corresponding stagger call in sync, stating this explicitly.

## Motion core
- The core tool is an 8-line `staggerVal(i, n, a, b, ease)`: normalise the index to `k = i/(n-1)`
  then `lerp(k, a, b)`; equivalent to anime.js's `stagger([a, b])` value mode, with an optional ease to make the gradient non-linear
- Static gradients (written in setup, computed once): hue `staggerVal(i,N,200,320)`,
  max height `staggerVal(i,N,92,32)`: the 16 bars are inherently a slope from blue to purple and from tall to short
- Dynamic gradients (used every frame): offset `staggerVal(i,N,46,14)`, blur `staggerVal(i,N,8,2)`:
  the first bar travels 46px with 8px blur, the last only 14px with 2px blur. **Within the same entrance, each bar's travel is different**
- First-beat time stagger: `d = i*0.02`, `e = seg(t, 0.06+d, 0.28+d, E.outCubic)`: starting from the first bar,
  the 16 bars are spread over a 0.3 window; `opacity = e`, `filter = blur((1-e)*b0)`,
  `translateY((1-e)*y0)` + height `hMax*e` (bottom-anchored growth via height, so rounded corners aren't squashed by scaleY), all driven by the same e
- Second beat changes origin: `distC = |i - 7.5| / 7.5` is the normalised distance to the centre,
  `w = seg(t, 0.56 + distC*0.13, +0.18)`: the centre bar moves first and the wave spreads to both ends; this is `from:'center'`
- The second beat's amplitude is also a gradient: `amp = lerp(1-distC, 0.06, 0.42)`, the centre bar pulses 42%, the ends only 6%;
  `pulse = sin(w*π)` is a pure pulse, added both to height `hMax*e*(1+pulse*amp)` and
  `brightness(1+pulse*0.55)`
- The code caption is a syntax-highlighted code strip; at t≈0.52 it swaps lines with an up/down crossover of about 5f (old line moves up and fades out, new line replaces it from below), changing from `scale: stagger([1, 0.35])  hue: stagger([200, 320])`
  to `pulse: stagger([.06, .42], { from: 'center' })`, landing exactly between the two beats

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Bar count | N=16 (`left: 8+i*5.4%`, width 3.4%) | 16 bars give the gradient enough steps; <8 bars the gradient reads as "every bar is different" rather than a slope, >24 bars the bar spacing must be recalculated |
| Time stagger | `d = i*0.02` (≈3f/bar, 0.3 total) | 3f is a continuous spread; >0.05 it becomes a bar-by-bar roll call and the gradient's "wholeness" is lost |
| Per-bar travel | window 0.22 (≈33f, outCubic) | Travel is 0.73× the total stagger → most of the time a dozen or so bars are moving at once; with travel < total stagger it becomes one bar after another |
| Height gradient | `stagger([92, 32])`px | A 2.9× difference between first and last is a clear slope; ratio <1.5 the gradient can't be read, >4 the end bars are too short to see |
| Hue gradient | `stagger([200, 320])` | 120° span (blue→purple); span <40° the hue is wasted, >200° it wraps back to red and the slope reads as a ring |
| Offset / blur gradient | `stagger([46,14])`px / `stagger([8,2])`px | These two are this card's main evidence of "value stagger": change them to constants and the motion immediately degrades into an ordinary stagger entrance |
| Second-beat origin | `from:'center'`, `distC*0.13` | 0.13 is the propagation delay from centre to the ends (≈4f); at zero the whole row pulses at once and the `from` parameter is meaningless |
| Pulse amplitude gradient | `lerp(1-distC, 0.06, 0.42)` | Centre 42% / ends 6% is a 7× difference, a clear waveform; giving the ends large amplitude too reads as the whole row swelling together, and the centre origin can't be seen |
| Brightness pulse | `brightness(1 + pulse*0.55)` | 55% brightening makes the pulse readable on a dark base; this one is not a gradient (same amplitude for all bars), intentionally: with too many gradients stacked, the viewer can't tell which one is the lead |

## Known pitfalls
- The first and second beats butt end to end: the last bar's entrance ends at `0.28+15*0.02 = 0.58`, while the centre bar's pulse
  starts at 0.56. Adding bars or increasing the time stagger makes the entrance eat into the pulse section, blurring the two beats into one thing; when adding bars you must push 0.56 later
- The end bars' second-beat window is `0.69→0.87`, after which there are about 0.13 (20f) of complete stillness until t=1. This is time for
  the viewer to see the "final-state gradient" clearly, not dead air
- The denominator of `distC`, `C=(N-1)/2`, divides by zero when N=1; `staggerVal` already guards with `n<=1 ? 0`,
  but `distC` doesn't: changing the bar count to 1 gives NaN
- Bar position `left: 8+i*5.4%` and width `3.4%` are hand-fitted for N=16 (last bar's right edge 8+15*5.4+3.4 = 92.4%).
  Changing the bar count requires recalculating these two percentages, otherwise bars overflow or bunch up in the left half
- The caption is an anime.js API call string; in essence it is a **technique explanation**, not content. In a real finished film
  either replace it with a meaningful title or remove it, otherwise what the viewer reads is code
- The 16 small dots at the bottom (`bottom:17%`, opacity .35) are static decoration and take no part in any animation; their
  `left` offset `+1.2%` is a centring amount hand-matched to the 3.4% bar width; change it together with the bar width
- Dark base (`#0a0b10`) + high-saturation bars (85%/66%) + 12px glow are a set; under a light theme both the glow and the
  brightness pulse stop working, and you need to express the pulse with saturate or shadows instead

## Reference implementation
demos/ui-entrance/value-stagger-gradient/
(ValueStaggerGradient.tsx)
