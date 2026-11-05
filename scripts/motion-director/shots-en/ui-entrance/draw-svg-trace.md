---
name: draw-svg-trace
one_liner: Stroke-growth outline callout — an ink line with a pen tip runs once around an element's outline, "drawing" it; at the moment it closes, it flashes black and hands off, and the content fades in; the same routine can draw an underline under a title
use_when: A single card / chart / title being called out as it enters; an element-level technique (the page-level blueprint trace belongs to wall-reveal-moves variant B)
length: 132f (preview 10f + stroke 40f + black-flash handoff 16f + underline 18f + hold 40f, about 4.4s)
energy: medium
tags: typography
---

## Intent
"Drawing it" is the most natural entrance metaphor in a paper-and-ink aesthetic: the element doesn't fly in or fade in,
it's traced out on the spot by an invisible pen. The library's wall-reveal-moves variant B already has a full-page
blueprint version (full-screen wireframe drawn segment by segment + areas lighting up); this card is its **element-level close-up version** —
one line, one subject, one closure, the pen tip visible, the direction readable, suited to the "now let's talk about this"
callout moment. The second use is title underline growth: the same routine in an 18f short version, giving a key word
a hand-drawn stroke of emphasis, naturally from the same family as the marker-pen aesthetic tokens.

## Motion core
- **No perimeter measurement**: set `pathLength={1}` on the SVG rect/path, strokeDasharray="1",
  dashoffset 1→0 (40f Easing.inOut(cubic)) — no getTotalLength
- **Pen tip**: the same path overlaid with three more tapering short dashes (0.04/6.4px → 0.024/8px → 0.011/9.6px), dashoffset = tip length − p,
  so it naturally runs at the front; plus a solid nib positioned precisely by arc length on the rounded rectangle (with a drop shadow);
  without a pen tip it's just "the border getting longer"; with a pen tip it's "someone is drawing"
- Preview: in the opening 0–12f, crop marks (print registration lines, staggered by 2f) grow at the four corners first, over a layer of graph-paper dot grid that's sharp in the centre and fades out at the edges —
  there's an image from frame 1, and the viewer knows first that "something is going to be drawn here"; on closure the crop marks spring outward 22px and fade out
- Closure flash: at 50–52f the stroke punches to pure black + thickens from 6→11px, then 52–58f eases out back down
  — on a white background darken and thicken; don't use glow (precedent)
- Handoff: at 56–66f the stroke layer fades out and the element's own hairline border fades in; from 50f the card base takes ink and the card lifts from flat on the ground (the shadow grows out),
  content goes from blurred to sharp top to bottom staggered by 3f + floats up, bar chart bars grow from the baseline staggered by 1.5f — closure means "finished drawing", and the content follows by "getting coloured"
- Second use: at 74–92f a vermilion marker underline is drawn under the key word "100%" (a slightly curved hand-drawn path, pen tip following), and it stays after it's drawn

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Stroke speed | One full loop in 40f (10→50f, inOut cubic, with breathing at start and end) | <28f doesn't read as "drawing", >60f reads as loading |
| Main line / pen tip | Main line 6px; pen tip three tapering sections, thickest 9.6px, nib r 7.5 | If the pen tip ≤ main line thickness it disappears into the main line |
| Closure flash | 2f punch to black + thicken to 11px, 6f settle back | Without this beat, "finished drawing" has no full stop |
| Subject size | 1120×660, corner radius 28 (stroke rx the same) | The subject takes ~58% of the frame width, so one loop of the stroke has the weight of "drew something big"; the stroke rx must equal the card's corner radius |
| Underline version | 18f out cubic one-way growth, 12px vermilion, path with ±5px hand-drawn curvature, stays after drawn | For a single key word; ≥2 on one screen reads as decorative lines |
| Ending | After the handoff completes hold 40f (92→132f), with only a very slow 0.9% push-in | R1 |

## Known pitfalls
- Tuned on placeholder material in the demo (a handmade video-shotcraft render report card, paper-and-ink look, "Cuts on the beat / 100%" + per-shot energy bars + logo wordmark signature): the parameters are a starting point, not final;
  re-check with real material on first real use
- Same family as and mutually exclusive with wall-reveal-moves variant B (page-level blueprint trace): pick one per film;
  using both reads as announcing the same thing twice
- The stroke path must match the element's real outline (same corner rx) — if the line draws a 14px
  radius and the element is 8px, the shape mismatch gives the game away at the handoff
- On real material don't let the content fade in before closure: if content appears before the line finishes, the cause and effect of "drawing"
  breaks
- Call out and draw one subject at a time; multiple elements on screen queueing to each be drawn around reads as a loading animation

## Reference implementation
demos/ui-entrance/draw-svg-trace/
(DrawSvgTrace.tsx)
