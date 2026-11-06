---
name: vertical-word-roll-blur-cycle
one_liner: The word at the end of a sentence becomes a vertical reel; 3 word changes of 0.55s each (70% outQuint + 30% outBack — fast at first, then extremely slow, with a slight overshoot); neighbouring rows get vertical blur and greying according to distance, and the centre word is tinted from grey to the accent colour at the instant it settles
use_when: One-sentence selling points of the "Crafted for ___" / "Built for ___" kind, a stem + a list of audiences/objects; a clean beat in a light-background brand film
length: about 5.0s (150f@30fps: rest → 3 word changes → the whole group fades out at the end)
energy: medium (three steady beats, no peak)
---

## Intent
The best solution for swapping the word at the end of a sentence is a reel rather than a crossfade: a reel carries its own **direction** (flipping upward),
so the audience knows "there's another one coming". The two identity markers of this card are the **vertical blur** on neighbouring rows
(reel depth of field, simulating the defocus of a mechanical drum) and the **tinting** on settling (grey → accent colour,
"this one is the answer"). The stem (demo `Crafted for`) doesn't move a hair the whole time — the eyes are nailed to the reel,
and as soon as the stem wobbles, the sense of a list falls apart.

## Motion core
- The position value `p` is accumulated from 3 segment windows: `STEPS = [0.16, 0.36, 0.56]`, each window 0.11
  (≈16f, about 0.55s), with 0.09 of rest between segments for the audience to read the word
- Each segment's easing is a **blended curve**: `0.7·E.outQuint(u) + 0.3·E.outBack(u)` —
  outQuint gives the "fast at first, extremely slow at the end" mechanical deceleration, and that 30% of outBack gives the slight overshoot and fall-back on settling
- Reel positioning `translateY(ROW - p·ROW)`, ROW=44px, mask height `ROW·3`=132px
  (showing three rows) — the centre row is always the mask's second row
- Three distance-driven channels, `d = |i - p|`:
  - blur: `3d` when `d<1`, `3 + 2·min(d-1,1)` when `d≥1` (farthest 5px); the demo uses SVG
    `feGaussianBlur stdDeviation="0 b"` to blur only vertically, and while turning stacks ≤4px of vertical motion blur according to reel velocity (0 when still)
  - opacity: `1 - 0.65d` when `d<1`, otherwise `max(0.1, 0.35 - 0.23(d-1))`
  - colour: `mixHex(ACCENT_DIM, ACCENT, clamp01(1 - 2.4d))` — **at d>0.42 it is already fully
    the dark colour**, so only the instant it truly settles is it the accent colour; mid-scroll it is grey throughout
- Ending: `seg(t, 0.9, 0.985)` fades out the whole group (stem + reel), leaving no ghost for the next shot

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Word list | 4 words (Launches→Demos→Promos→Every Shot), 3 word changes | The last word is the conclusion (the widest word), the first three are examples; >5 words and the audience starts counting, <3 words and it doesn't read as a "list" |
| Beat points | `[0.16, 0.36, 0.56]`, window 0.11 (≈16f) | The 0.09 (≈13f) rest between segments is for reading the word; a beat that can't be read through is as good as no change; a window >0.18 and old and new share the screen too long |
| Easing recipe | `0.7·outQuint + 0.3·outBack` | outQuint is the source of the mechanical deceleration; that 30% of outBack gives the landing a "click"; pure outQuint reads as an electronic screen slide |
| Row height / viewport | ROW 44px, mask `44×3`px, word width 190px | Only showing three rows gives the drum feel (showing one row reads as a crossfade); the width is hard-coded to 190 so it doesn't crowd the stem — for longer words increase it to match |
| Neighbouring-row blur | neighbour rows 3px, farthest 5px, **perceived only vertically** | The blur is the ID card of "drum depth of field"; delete it and it degrades into a word strip sliding; >8px and neighbouring rows smear into grey bars you can't tell are text |
| Settle tint | `1 - 2.4d` maps ACCENT_DIM→ACCENT | The 2.4 coefficient makes the tint happen only at the instant of settling; <1.5 and it takes colour mid-scroll, and the sense of "the answer" falls apart |
| Font size & weight | stem and reel both 30px/800, `letter-spacing:-.5px` | Must be exactly identical — if the reel word is larger than the stem it reads as two elements, not one sentence |
| Ending fade-out | `seg(t, 0.9, 0.985)` for the whole group | Rest about 40f after the last word settles, then fade out; without a hold the listing was wasted |

## Known pitfalls
- Tuned on placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use.
- **The mask width is hard-coded to 190px**: when changing the word list, the longest word (demo `Every Shot`; phrases with spaces need `white-space: nowrap`) must fit inside,
  otherwise characters get cropped; conversely, if all the words are short, a large blank area is left on the right and the sentence's centre of gravity shifts left — when changing the word list you must
  re-measure the width
- The word lengths shouldn't differ too much: the mask width is fixed (this card doesn't do width adaptation, that's the job of
  pill-chip-slot-cycle-handled), and with a word-length difference >2× short words look isolated in the frame
- The stem must be nailed down: the demo uses `flex + gap:14px` because the mask width is constant and won't push
  the stem — once you switch to a width-adaptive reel, you must switch to absolute positioning anchored at the left end,
  otherwise the stem swings left and right with the word width
- `p` is **accumulated** from three segment windows, so the three windows must not overlap: overlap would let p
  cross a whole row within one frame, and the reel "skips a notch"
- Division of labour with pill-chip-slot-cycle-handled: that card is a dark pill + width-adaptive push-apart
  (the word is a badge); this card is a bare-word reel (the word is part of the sentence) — keep only one per film
- Sound: each settle is a rhythm point; use a light mechanical / switch sound; for three in a row alternate two samples
  to avoid a machine-gun feel; see sound-design.md for the scoring discipline

## Reference implementation
demos/typography/vertical-word-roll-blur-cycle/
(VerticalWordRollBlurCycle.tsx)
