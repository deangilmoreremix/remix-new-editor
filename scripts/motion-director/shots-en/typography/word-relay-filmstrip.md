---
name: word-relay-filmstrip
one_liner: In the left column, equal-height page cards alternating black and white scroll in steps (the focus card fully lit, neighbouring cards defocused and darkened); on the right, a big serif word relays in place (the noun constant + the verb rotating) — it scrolls one notch only at the instant the word switches, and the word block's vertical centre is precisely aligned with the midpoint of the current page card
use_when: Enumeration passages of "one subject × many capabilities" (Shotcraft frames/builds/ships…); portfolio / case-study stream showcases; a tour of a product's many scenarios
length: ~1.5–2s per word period × 3–4 words; demo 180f (6s)
energy: low-medium (editorial temperament; the rhythm comes from the "click" of the word switch)
tags: ui-entrance
---

## Intent
On the left is the evidence (a filmstrip of page screenshots), on the right the argument (the big word): each time the verb changes,
the filmstrip steps forward one notch to present new evidence — text and picture annotate each other. The make-or-break point is **stepping**:
the left column is completely still most of the time and scrolls one notch only at the instant the word switches (scrolling = the mechanical action of swapping evidence);
continuous scrolling would reduce the left column to background decoration and the word switch would lose its "click". The second make-or-break point is
**alignment**: the big word block's vertical centre must be precisely aligned with the midpoint of the current page card (pixel-level);
if it's off, the whole layout's "editorial rigour" collapses.

## Motion core
- Stage: a graphite near-monochrome dark field + gold accents; left column: equal-height page cards (940×530, spacing 105) arranged vertically,
  black and white (dark and light) forcibly alternating to show the scroll steps; within the word-switch window, an 18f asymmetric in-out (EASE.swift) scrolls exactly one card height,
  with zero displacement the rest of the time, and vertical motion blur stacked during the fast part
- Depth of field: by distance from the focus point `dist = |card top - 275| / 635`, neighbouring cards darken by `0.68·dist`, shrink to 0.94, and blur ≤3px —
  when stepping, the new evidence "comes into focus"
- Right side: serif type (Didot-like, 140px) in two lines — the subject noun "Shotcraft" in roman, secondary ink, constant; the verb in white italics relays in place:
  the old word greys out over 10f → from the switch point it rises out past the mask's top edge over 8f ease-in (out first), and the new word, from switch point +7f, rises letter by letter from the mask's bottom edge
  (1.2f staggered overlap, the gold full stop arriving last; in after), out first then in, no ghosting allowed (ruling: v2's ghosted "resebuilds" was caught)
- Gold leader line: points from the focus card's right edge to the word block's centre line y=540; retracts over 6f from the start of the word switch, and redraws over 16f after switch point +10f;
  a mono index 01/03 above the word block and a 32px evidence footnote below relay in sync with the verb
- Alignment: each of the word block's two lines is a 154px line box, `top = 540 - 154`, total height centre = current card top + card height/2 = y540@1080p
  (accurate to single-digit pixels)
- Scroll and word switch in sync: scroll start = the old word starts greying out, scroll end = the new word has settled

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Page cards | equal height (530px@1080p), alternating black and white, about half the screen width | Unequal heights / the same colour family can't read as steps; cards that are too narrow lose the weight of "evidence" |
| Word period | ~45–60f/word | <40f and the word can't be read + the filmstrip can't be made out; word periods needn't be even |
| Scroll window | ~16–18f asymmetric in-out, exactly one card height | Continuous scrolling = violating the make-or-break point; overshooting / undershooting reads as a mechanical fault |
| Word relay | old word greys out, then rises out over 8f → switch point +7f the new word rises letter by letter (16f/letter, 1.2f staggered overlap) | Crossing on the same frame always ghosts; a gap >10f reads as a dropped frame |
| Vertical alignment | word block centre = current card midpoint (pixel-level) | A single-point note from the user: "the text height must line up with the midpoint of the page in the middle"; a difference >8px is perceptible |
| Font | serif, Didot-like; verb in white italics / noun in roman, secondary ink | Sans-serif loses the "editorial" temperament; the verb must be brighter than the noun, since it is the one that changes |
| Neighbouring-card defocus | darken 0.68·dist, shrink 6%, blur ≤3px | Without darkening, neighbouring cards compete with the focus card; blur >5px and you can't tell they're pages |

## Known pitfalls
- Tuned on placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use.
- Division of labour with text-column-converge: that card is a reveal drama of a left-right face-off closing together;
  this card is a vertical evidence stream + in-place relay, with no closing and no reveal
- Division of labour with pill-slot-cycle: that card is a pill-slot rotating UI element;
  this card is a layout-level text-and-image counterpoint system
- Real material: the page cards should use real screenshots (the demo uses hand-made fake pages — storyboard script / render pipeline / final-film PR review, each verb stopping on
  the evidence card that corresponds to it; the remaining gap is known); screenshot brightness must be manually graded to keep the alternation readable

## Reference implementation
demos/typography/word-relay-filmstrip/
(WordRelayFilmstrip.tsx)
Original source: perplexity-promo.mp4 ≈76–90s
