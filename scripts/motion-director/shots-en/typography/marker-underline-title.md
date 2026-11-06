---
name: marker-underline-title
one_liner: After the large title lands, a marker-pen underline is drawn quickly left to right beneath the keyword — a variable-width stroke, rough edges, rising slightly to follow the italic's slant, hugging the bottom of the letters
use_when: Emphasising a single keyword in a title (new/free/AI…); a hand-drawn / human brand tone; annotation-style emphasis in body text
length: stroke starts 4–8f after the title lands, drawing 8–12f, 1–1.5s total
energy: low (one finishing stroke, doesn't steal the title's scene)
---

## Intent
A single hand-drawn marker stroke suddenly appearing under a printed title uses material contrast to lift one word out of
the typesetting — like someone taking a pen to a poster and circling the key point. There are three make-or-break points: **fast**
(8–12f in one stroke; slower reads as a loading bar), **close** (hugging the bottom of the letters; farther away it
reads as a divider, not emphasis), **following the slant** (the underline under an italic word must rise slightly from low-left to high-right
— drawing the slant the wrong way is the easiest mistake to make and looks fake at a glance; see the ruling in Known pitfalls).

## Motion core
- SVG path drawing (strokeDashoffset or a clipping window), left to right over 8–12f,
  ease-out with a slight finish (fast at the start of the stroke, a little slower at the end = hand pressure)
- Stroke shape: variable-width path (widest in the middle), rough edges (slight noise perturbation / rough brush
  texture), slightly thinner at start and end = the pen going down and lifting off
- Position: hugging the bottom of the letters (bottom offset ≈ -0.1em), with the centre line rising slightly to follow the italic slant
- Timing: the stroke starts 4–8f after the title has fully landed — the underline is "emphasis after reading the title";
  moving together with the title steals its scene
- Texture (demo): the stroke goes through a deterministic dry-brush filter — low-frequency feTurbulence displacement (1.8px) for rough edges,
  and high-frequency noise stretched along the stroke direction and thresholded for fine dry-brush streaks; warm near-black ink multiplied into the paper
- The demo exports `MARKER_UNDERLINE_TITLE_DURATION = 75`: the title's two lines land with a 22f staggered overlap → f32–42 the underline → 33f still

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Underline duration | 10f (rhythm measured from the source clip; a 14f version was ruled a bit slow) | >14f reads as a progress bar; <6f you can't see the stroke's direction |
| Distance from letter bottom | ≈-0.1em (only after tightening from -40 to -20@1080p did it hug the letterforms) | Farther away reads as a divider; touching the descenders gets messy |
| Slant | rising slightly from low-left to high-right (following the italic) | **Drawn the wrong way (high-left to low-right) it looks fake at a glance** — a rework ruling |
| Stroke width | ~0.12em in the middle, ~0.6x at the ends | Uniform width reads as a machine line; a difference >2x reads as calligraphy |
| Roughness | light noise on the edges | Too rough reads as a glitch; fully smooth reads as a CSS border |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Overlaps in domain with draw-svg-trace (deliberately kept as two separate cards): that one is general
  SVG drawing (icons / illustrations / any line art); this card is specifically the marker texture for **text emphasis**
  (variable width + roughness + following the slant); for drawing graphics, use that one
- Slant ruling: v1's high-left to low-right was caught at the comparison stage — the underline's slant must follow the letterforms;
  for upright (roman) text, keep it horizontal with a slight wobble
- Remaining gap: in the source clip (notion-ai) the dry-brush grain at the pen tip is finer and more broken; in real use you can add
  finer brush noise

## Reference implementation
demos/typography/marker-underline-title/
(MarkerUnderlineTitle.tsx)
Source clip: notion-ai.mp4
