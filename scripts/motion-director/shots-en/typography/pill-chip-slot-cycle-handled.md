---
name: pill-chip-slot-cycle-handled
one_liner: On a white background, in the sentence "Your `chip` Handled", the word inside a dark pill rotates on a vertical reel; the pill's width interpolates smoothly from pre-measured text widths, so the text on both sides is naturally pushed apart and drawn back in, and grey ghost items at 13% opacity peek out above and below the pill
use_when: Selling-point sentences of the "we handle ___ for you" kind; a one-sentence wrap-up of a SaaS feature list; a key-visual beat in a light-background brand film
length: about 5.0s (150f@30fps: rest → 3 switches (0.25/0.47/0.69) → rest at the end)
energy: medium (three steady beats; the width change is the only continuous motion)
---

## Intent
There are two schools of word-slot rotation: make the sentence dodge the change (a fixed-width reel), or make the sentence **accept**
the change (the pill widens and the text on both sides is pushed apart). This card is the latter; the cost is that the width must be calculated precisely,
the reward is that the sentence reads as alive — "Your" and "Handled" get pushed around, and the audience feels that the word inside the pill
has weight. The grey ghost items peeking out above and below are the second marker: they state plainly "this is a list that can scroll",
so the audience expects another word to come.

## Motion core
- Width pre-measurement: during setup, use a hidden `<span>` to measure each word's `offsetWidth`, add 74px of padding to each,
  and store them as `widths[]` (with an `o.w.length·13` fallback, in case it isn't mounted during setup and can't be measured)
- The position value `pos` is accumulated from 3 segment windows: switch points `[0.25, 0.47, 0.69]`, each window 0.12
  (≈18f), easing `E.inOutCubic` — **eased at both ends**, corresponding to "the reel starting up and coming to rest"
- The inner column `colIn` moves vertically by `-pos·48`px (line height 48 = pill height); the pill width is
  `lerp(frac, widths[ci], widths[ci+1])`, **interpolated per frame**, so the resizing is continuous, and
  the `flex:none` text on both sides is naturally pushed apart by the flex layout
- The ghost items sit outside the pill (inside chipWrap), above at -38px / below at 58px, using the neighbour texts before and after
  `near = round(pos)`, and drift slightly with the scroll by `(pos-near)·48·0.5` (**half-speed parallax**, half as slow as the word
  inside the pill, so it feels like an "outer ring")
- Ghost opacity `0.13 · (0.4 + settle·0.6)`, `settle = 1 - min(1, |pos-near|·3)`
  — fainter mid-scroll, clearest when settled
- Each row is a two-part structure of emoji + word (emoji 18px, word 700 22px white),
  pill with `#1a1c24` background + `0 8px 24px rgba(20,22,40,.22)` shadow + `overflow:hidden`

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Word list | 4 words + emoji (Shots/Camera/Sound/Renders — the shots/camera moves/sound effects/rendering that video-shotcraft takes care of), 3 switches | The difference in word length determines how the push-apart reads: in the demo the shortest is 5 letters and the longest 7; a difference >2× makes the pill jump too violently and the sentence's centre of gravity swings left and right |
| Switch points | `[0.25, 0.47, 0.69]`, window 0.12 (≈18f) | About 0.10 (≈15f) of rest between segments to read the word; the rest before the 0.25 start lets the audience recognise the sentence pattern first |
| Easing | `E.inOutCubic` | Only easing at both ends feels like a reel starting and stopping; outCubic (eased only at the end) reads as being flung up, and the pill width jumps along with it |
| Pill | height 48px, radius 99, `#1a1c24`, width = text width + 74 | +74 is left/right padding + the emoji slot; <50 and the word touches the edge, >100 and the pill gets fat like a button |
| Ghost items | above -38 / below 58px, base opacity 0.13 | 0.13 is the sweet spot of "visible but not competing"; >0.25 reads as three parallel lines of text, not ghosts; delete them and the list hint is gone |
| Ghost parallax | `(pos-near)·48·0.5` (half speed) | Half speed is the source of the "outer ring is farther away" depth; at the same speed the three rows slide like one solid block and the ghosts lose their point |
| Sentence font size | both sides 30px/800, inside the pill 22px/700 | Smaller inside the pill than the sentence is the right hierarchy (the badge depends on the sentence); equal or larger reads as two titles fighting |
| Colours | background `#fbfbfd`, sentence `#15171d`, white text in the pill | A light background + a single dark block is this card's ID; a dark-background version makes the pill disappear and needs a full reconfiguration |

## Known pitfalls
- Tuned on placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use.
- **Widths rely on actual `offsetWidth` measurement during setup**: if the font hasn't finished loading you measure the fallback font's
  width, and the pill comes out too narrow or too wide — when porting, make sure the webfont is ready before measuring, or switch to
  an offscreen canvas `measureText`; the `length·13` fallback only guarantees it won't crash, not that it's accurate
- Keep the word-length difference within 2×: width adaptation is both this card's selling point and its risk;
  a jump of 5→8 letters (e.g. `Sales`→`Workflow`) is already the acceptable upper limit; any bigger and the sides of the sentence swing distractingly
- The text on both sides must be `flex:none`: otherwise flex will compress it instead of moving it, and
  "pushed apart" becomes "letters squashed"
- Ghost text takes the neighbours of `round(pos)`, so right in the middle of a switch (pos=x.5) the
  **text jumps once** — this happens when `settle` has pushed it to its faintest, so it's basically invisible to the eye; but if you
  raise the opacity to 0.25+, the jump will show
- Emoji glyph widths vary across platforms (especially `⚙️` with its variation selector), making the measured width
  drift by a few pixels; for real use, switch to the project's own monochrome icons rather than relying on system emoji
- Division of labour with vertical-word-roll-blur-cycle: that card has fixed width, bare words, and a reel blur
  (the word is part of the sentence); this card has adaptive width, a dark pill, and ghost items (the word is a badge) —
  keep only one per film; for sound, the three landings are three rhythm points: use a light switch / pill-snap sound,
  alternating two samples for back-to-back hits; see sound-design.md for the scoring discipline

## Reference implementation
demos/typography/pill-chip-slot-cycle-handled/
(PillChipSlotCycleHandled.tsx)
