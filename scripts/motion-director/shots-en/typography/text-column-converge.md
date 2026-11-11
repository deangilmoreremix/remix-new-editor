---
name: text-column-converge
one_liner: A two-word face-off that closes together — "NEW" on the left and a feature word on the right are nailed to equal screen margins on either side and hard-cut through a rotation with zero shrinking throughout; only after switching to the last word do they, for the one and only time, ease-in-out slide to the centre and lock together into a phrase, while small text below appears with a near hard cut; a closing reveal-type text card
use_when: A passage where a feature list wraps up into the product name / slogan ("NEW × a string of features → NEW <product name>" style); launch-event style recaps, version-number reveals
length: rotation 7–16f/word × 8–9 words + close ~36f + rest after the small text; the whole segment about 5–6s
energy: low-medium (machine rhythm, the temperament of a small-print spec list, not word-slamming)
tags: outro
---

## Intent
The two words hold left and right like a facing table-of-contents page, and the audience thinks it's just rotating captions; only when the last word
comes to rest do they discover that left and right are actually two halves of the same phrase — the single continuous closing retroactively
recasts the whole rotation as "suspense set-up". The make-or-break point is being **nailed down**: during the rotation the two words don't move a single pixel,
and the left and right screen margins are exactly equal (measured in the original at 412 vs 413@1280); any gradual shrinking would
spoil the closing early and dilute the reveal into a progress bar. The closing may happen only once, and it must come after
the last word — this is a closing reveal, not a continuous motion effect.

## Motion core
- The left word's left edge and the right word's right edge are each nailed at equal screen margins (measured in the original at 412/413px
  @1280, ×1.5 → 618/1302@1920); whether the right word gets longer or shorter, it is always positioned by its right edge
- Word rotation is pure hard cuts, with uneven hold frame counts (16/12/9/8/7/8/10/12f — machine rhythm
  with a human touch); throughout the rotation the gap has zero shrinking (ruling: the gradual-shrink version was rejected by the user and redone)
- **The one and only closing**: after the last word has rested ~10f, a ~1.2s (36f) ease-in-out
  (cubic) continuous slide, the two words sliding to freeze centred on the screen's centre line
- The closing end point is calculated from the monospace font's actual advance (0.6em+letterSpacing × number of characters),
  so the two words lock together with exactly one space, no overlap and no gap; no stamp scale, no secondary compensating move
  (demo: video-shotcraft's eight feature words rotate; the last word is the all-lowercase wordmark video-shotcraft, and the end point is computed from `NEW ` + the wordmark's character count;
  the small text is the second half of the brand tagline, "CRAFT THE SHOT.")
- About 18f after the freeze, italic small text appears with a near hard cut (4f quick fade, zero displacement), sharing the left edge with the whole
  line, at the same font size as the body text
- Texture: cool dark background + very faint top light + vignette/grain; a 1-frame brightening at the instant of each word change; during the rotation NEW is secondary grey,
  and brightens to the primary colour with progress during the closing; the closing slide gets horizontal motion blur according to velocity (≤4px, 0 when still);
  demo total length 180f (exported as `TEXT_COLUMN_CONVERGE_DURATION`)

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Screen margin | 618px@1920 (**measured in the original** 412/413@1280 ×1.5) | A left/right difference >2px reads as misaligned; the margin is this card's identity, don't change it to a golden ratio |
| Word hold | 7–16f, uneven | Even holds read as a metronome; <7f and the word can't be read |
| Closing trigger | last word settled +10f (measured in the original 32.4→32.7s) | If the settled period is too short, it starts sliding before the audience realises "this word isn't changing any more" |
| Closing duration | 36f ease-in-out cubic (**measured in the original** ~1.2s continuous slide) | <24f reads as bouncing back into place; >50f reads as dragging |
| Lock-together advance | 0.6em+letterSpacing/character, monospace font | With a non-monospace font the advance is unpredictable and will overlap or leave a gap |
| Font size | 42@1080p (**measured in the original** character height ~20/720) | This segment has the temperament of a small-print spec list; enlarge it to 60+ and it becomes word-slamming (for a single-word hammer blow use outline-word-fill) |
| Small text appearance | freeze +18f, 4f quick fade, zero displacement (appears directly between 34.4→34.6s in the original) | Adding a slide-in / long fade-in steals the closing's thunder |

## Known pitfalls
- Tuned on placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use.
- Overlaps in territory with type-rhythm-sync (type-property beats) / beat-cut-moves (hard-cut beats):
  in those two cards "the rotation itself is the content"; this card's make-or-break point is the closing reveal of **nailed positions + one final closing**,
  and the rotation is only set-up. If the passage has no "closing reveal", don't use this card
- The closing may happen only once — the gradual-shrink version that closed one notch with each word cut has been disproved against the original and
  deleted; don't revive it
- A monospace font is required (the demo uses SF Mono); with a proportional font the lock-together end point can't be calculated accurately
- In the original, each word change carries a 1-frame brightness flicker (like a typewriter line feed); the demo has added back the 1f brightening;
  a flicker >1f reads as a glitch

## Reference implementation
demos/typography/text-column-converge/
(TextColumnConverge.tsx)
Original source: raycast-teams.mp4 28–36s
