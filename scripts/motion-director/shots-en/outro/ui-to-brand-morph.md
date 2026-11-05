---
name: ui-to-brand-morph
one_liner: Two variants of UI turning into the brand — icon-flip-bloom: the icon flattens on the Y axis into a vertical line, expands from the line into the brand logo (the amber diagonal cut slides in after) + the wordmark settles letter by letter; and input-morph-assemble: the input box shrinks into the viewfinder's vertical stroke, three pieces drop into construction slots and assemble the complete logo
use_when: The final beat of the brand closing / before the outro; the visual argument that "the UI you use every day is this brand"
length: A ~4.3s (130f) / B ~5.6s (168f)
energy: medium-high (the closing finishing touch; one complete transformation tells it all)
---

## Intent
The library's brand closings already have two routes: brand-ink-open is an opening draw-and-press, outro-group-photo-launch is elements gathering for a group photo (gathering without transforming). This card adds a third: **the product's UI elements themselves transform into the brand symbol** — variant A is the icon flipping over to become the logo (in-place entity swap), variant B is the input box that recurs throughout the film assembling into the brand logo after the last send (multi-element placement assembly). What the audience sees is not "the logo appeared", but "the thing I was just using was it all along" — the causal chain itself is the brand argument.

## Variants
| Variant | Approach | Use when |
|----|------|------|
| A icon-flip-bloom | Icon wobbles twice in anticipation → Y-axis scaleX flattens into a vertical line (double-layer trail + blur) → entity swap at the thinnest point, the logo expands from the line with an overshoot spring, the amber diagonal cut then slides in along 45° → the mark shifts left to make room, the wordmark settles letter by letter | Single-icon products; icon and logo differ greatly in form and need the magic of "flipping over to transform" |
| B input-morph-assemble | Cursor clicks send → text flies away, the logo's ink colour spreads from the send button and floods the input box → the five quantities x/y/w/h/r spring into the viewfinder's vertical stroke → top bar / bottom bar / amber diagonal cut drop staggered from off-frame into dashed construction slots to assemble the logo → makes room for the wordmark | Films where a rectangular UI such as an input box/card is the protagonist throughout; logos that can be decomposed into a combination of geometric primitives |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A anticipation | 12–34f tilt -12°/+14°/-18°→0°, inOut(sin), transformOrigin pinned to the bottom 78%; the grounding soft shadow shifts with the tilt and narrows during the flatten | Increasing amplitude is what reads as "winding up"; a single wobble doesn't read as an anticipation action |
| A flatten | 34–46f Easing.in(cubic), scaleX 1→0.04; two ghost layers opacity 0.22/0.14 + blur 6px lagging 0.12/0.24 | Accelerating in is the key to the "flick"; a constant-speed flip reads as a flip card. 0.04 is the thinnest point; do the entity swap on this frame |
| A expand | From 46f spring(damping 11, stiffness 130) drives the logo scaleX 0.04→1 (with overshoot); from 53f the diagonal cut slides in along 45° with spring(damping 16, stiffness 170) (cutProgress 0→1) | Only the logo expanding from a closed vertical line follows on from "flipping past the thinnest point"; scaling the whole logo directly breaks causality. The cut arriving 7f later is the second beat; appearing at the same time as the viewfinder doesn't read as "chiselled" |
| A wordmark | Mark shifts left -471px at 64–82f to make room (wordmark starts at mark+187, whole group centred); letter-by-letter 2.6f stagger, each letter 12f: scale 1.9→1 + blur 14→0 (snappy), origin pinned to the baseline; wordmark 112px brand typeface 700, +0.03em (logo height ≈ 2.1× font size) | Compared against the original: each letter settles from big to small, blurred when big and sharp on landing (scale+blur linked, letter-by-letter settle), not a horizontal sweep; with stagger <2.4f each letter's "big to small" can't be read |
| B send feedback | Cursor moves in over 20f, presses with scale 0.84 + button flashes white 6f; text flies out to the upper right with 11f ease-in acceleration (+760,-420) + rotate -9° + trail | The fly-away must accelerate — constant-speed flight reads as a pan, not "it's been sent" |
| B flood fill | 28–40f the logo's ink colour spreads from the send button's position via a circular clip-path to flood the input box (solid colour throughout) | Filling via an opacity gradient passes through a greyish semi-transparent stage; the text must fly off before the flood, otherwise dark text sits on the ink |
| B morph | From 30f spring(damping 15, stiffness 95), 1040×132 r34 → 89×330 square corners (the viewfinder's vertical stroke; the horizontal bar squeezes straight into a vertical bar), five quantities in sync, adding ≤3px trail by spring velocity; the input box's drop shadow retracts with the morph | The five quantities must be driven by the same spring; interpolating them separately falls apart midway |
| B three pieces drop | Top bar / bottom bar / amber diagonal cut at 58/72/86f staggered 14f, each spring(damping 13) dropping from -760px off-frame into its slot; 10f before the drop, the slot first draws a dashed construction frame along its outline (expanded 10px), fading out 14f after landing; stretch by velocity / rebound squash (origin pinned to the bottom), with a falling shadow in the air that flattens on landing | The stagger is the rhythm of "assembling"; dropping together reads as rain; without slot foreshadowing, landing positions read as random |
| B settle | From 108f the mark shifts left over 20f to make room and shrinks to 0.7 (clearing space for the 15-character wordmark), the construction grid exits, the 110px wordmark rises letter by letter (1.5f stagger) from the baseline, the slogan word by word; from 124f the whole group pushes in extremely slowly 2% | A passage that doesn't move at all after settling is dead frames; beat-by-beat scale breathing easily reads as shaking |

## Known pitfalls
- The demo's end logo is the video-shotcraft "Frame Chisel" logo (A: soft-lit bright field + amber diagonal cut; B: Swiss-grid bright field + cobalt construction lines) — the parameters are a starting point, not final; re-check with real material on first real use
- In variant A the entity swap must happen on the thinnest frame with scaleX ≤0.05 — swapping early lets the audience see the two shapes ghosted together, and the magic trick is exposed
- Variant A's wordmark has been changed to letter-by-letter scale+blur settle, stagger 2.2→2.6f; when switching to a longer wordmark, set the interval by watching at normal speed per the perceptibility precedent
- Variant B splits the logo into four pieces: vertical stroke (= input box) + top bar + bottom bar + diagonal cut — in real use swap in your own logo's primitive decomposition; 3–4 primitives is appropriate, more reads as particles, not assembly
- In variant B antialiasing accumulates where same-colour primitives overlap (that edge row of pixels is darker), producing a 1px step at the seams; after assembly (108f) replace the vertical stroke + top and bottom bars with a single viewfinder path of the same geometry
- Don't layer other animations mid-transformation: the morph itself is all the information
- Division of labour with outro-group-photo-launch: that one has the film's elements flying in to surround the wordmark for a group photo (gathering); this card has UI elements themselves becoming the brand symbol (transforming); choose one for the same film's closing
- Sound: A one "whoosh" on the flatten, a "tick" on the expand landing; B one send sound on sending, a pop as each piece lands, the wordmark passage silent

## Reference implementation
demos/outro/ui-to-brand-morph/
(IconFlipBloomLogo.tsx / InputMorphsIntoLogo.tsx)
Original source: A perplexity-promo 88–91.5s / B slack-promo 40–41s

Implementation status: both variants have reference implementations and animated Gallery samples.
