---
name: type-assembly-moves
one_liner: Three variants of text assembly — split-text-stagger character-by-character split rise, letterform-drift-assembly drifting together, text-on-path flowing in along a line
use_when: Entrances for big titles / slogans; belongs to the same broad title-entrance category as type-entrance-moves and document-typewriter-reveal, ≤2 kinds per film
length: 4–5.5s per variant (action segment A ~56f / B ~104f / C ~110f; demo total length including hold: A 130f / B 150f / C 160f, each exporting its own `*_DURATION`)
energy: A medium / B medium-high / C medium
---

## Intent
Title entrances already have the "in-place transformation family" (character drop / typewriter — the characters change form in place). This card fills in the "assembly family": the characters **converge into** the title from elsewhere, and the motion trajectory
itself carries the drama. A is piano-key style — each character slides up from below an invisible crop line, rational and crisp, the most
broadly applicable; B is title-sequence style — characters scattered in all directions drift in with blur and lock one by one as they darken, with the ceremonial feel of Stranger Things,
suited to a brand name debut; C is semantic style — characters file in along a rising curve
and then straighten up; the curve can trace exactly along a chart's growth line, so text and data tell the story in the same frame.

## Variants (choose one of three)
| Variant | Approach | Use when |
|----|------|------|
| A split-text-stagger split rise | Each character inside an overflow box translateY(115%→0) with 10% overshoot, delay i×2f, with the baseline growing in sync (demo: light field, 136px brand tagline "FRAME MOTION.") | General default; crisp and rational |
| B drift-assembly drifting together | Characters drift in from seeded directions ±260–360px + blur 8px + rotation ±24° + depth 1.22, returning to place with staggered overlap; a darkening pulse on the lock frame; after combining, the whole word breathes 1.04 (demo: light field, 148px brand name "Shotcraft") | Brand name / title-sequence-level debut |
| C text-on-path flowing in along a line | The whole string advances rigidly along the arc length at its real advance (last character leading, rotated to the tangent angle, readable while moving); after arriving, characters rise one by one along an arc to the top-left title position (demo: midnight dark-field revenue growth line + value tag) | When the curve carries meaning (growth line / process line) |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A overshoot | 10% (14f out-cubic up to −10%, then 6f falling back; the original 6% was measurable but not perceptible, so it was increased after real renders) | At normal speed you must be able to see that fall-back; during the fast part of the rise add y-direction blur according to vertical velocity |
| B lock pulse | character colour darkens to #000 + stroke 0→3px→0 / 8f | On a white background, darken + stroke, don't use a glow (ruling) |
| B drift binding | displacement (1−p), rotation, depth scale, blur 8(1−p), opacity 0.35→1 all share one p (Easing.out(cubic), 45f per character, 3f staggered overlap) | On separate curves, the characters "arrive but are still blurry" |
| C straightening | after arriving, pause 8f, then left to right with 1.1f staggered overlap, an 18f rise: y uses a fast curve with ~4% overshoot, x uses in-out, rotation converges 2f later → the trajectory is an arc; the final position is laid out from measured character widths | Without straightening it is forever "hanging on the line" and can't be read as a title; when the rise travel is large, overshoot >5% pushes into the eyebrow |
| C curve | evolve (dashoffset proportional to arc length) grows in sync with the leading character; the demo makes it a chart growth line (electric blue 5px stroke + outer glow + gradient area below the line + a cyan leading light dot and a pulse on reaching the top + grid ticks + quarter markers) | If the curve finishes drawing before the text moves, it reads as two animations |
| Ending | everything settled and truly still ≥30f | R1 |

## Known pitfalls
- Tuned on placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use.
- The broad title-entrance category now has five variants (the three in this card + type-entrance-moves + document-typewriter-reveal);
  the iron rule of **≤2 kinds per film** (P4) still stands
- Variants B and C are both high-attention entrances; don't stack camera moves on top — while the characters are flying, the camera must be steady
- In variant C don't let the characters each start running on their own: the later characters would overtake the earlier ones, and the low part of the curve inevitably bunches up into a clump (the original version hit this);
  only by advancing rigidly along the arc length with the character spacing at the real advance can the whole sentence be read; at font sizes >80px the characters bite into each other's corners at the curve's bends —
  for large type switch to a gentler curve or cut the number of characters

## Reference implementation
demos/typography/type-assembly-moves/
(LetterformDriftAssembly.tsx / SplitTextStagger.tsx / TextOnPath.tsx)
