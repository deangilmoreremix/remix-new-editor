---
name: trailer-grammar-moves
one_liner: One variant of trailer grammar — trailer-bumper, a fast-cut hook up front: three shots at 9f each + one beat of silent black, then the opening title
use_when: A trailer's opening hook (cold open): before the main film, pack in the three most eye-catching shots, then one beat of silence before the proper opening
length: A ~4.7s (140f)
energy: A high
tags: opening, transition
---

## Intent
The library's rhythm cards each handle one part: beat-cut handles cut-point arrangement, rhythm-interrupt handles interruption. This card handles **a trailer's structural moments** — not how a particular shot moves, but how the joints of the whole film connect: A is the opening hook — 0.9 seconds before the main film, a fast cut of the three most eye-catching shots + one beat of silent black before the opening, the "preview" in the trailer.

## Variants
| Variant | Approach | Use when |
|----|------|------|
| A trailer-bumper | Three shots hard-cut at equal 9f lengths (0/9/18), each with an internal scale 1→1.04 micro-push to keep alive; 27–33f pure black silence; from 33f the title fades in over 16f + 44px out-cubic slight rise (demo title is the video-shotcraft wordmark + brand tagline) | The hook before the main film's opening; cold open |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A fast cut | Three shots, equal 9f each, zero transitions; shot 3 focuses on the Top pages card in the middle column, enlarged 2.2x into an in-your-face close-up (CSS zoom, text stays crisp) | The beat feel comes from equal lengths; the three shots' compositions must be clearly different |
| A micro-push | Each shot internally scale 1→1.04 linear | Three still frames in a row read as a slideshow — make-or-break point |
| A black | 27–33f pure black #000 empty div, 6f | Putting anything in the black ruins the "one beat of silence" |
| Closing | A still for 77f (≥40f) | After the letter-spacing finishes tightening (63f) the whole frame freezes, true stillness |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final; re-check with real material on first real use
- A's black must be pure black and empty (same family as the drop-blackout precedent) — the black is a breath, not another title card
- A: one hit sound per cut in the triple cut, the black is fully muted (sound-design §4.5)

## Reference implementation
demos/rhythm/trailer-grammar-moves/
(TrailerBumper.tsx)
