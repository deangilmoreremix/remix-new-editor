---
name: typewriter-moves
one_liner: Typewriter error-retype — a three-act "change of wording" with a mistaken delete and retype: type a mediocre word → hesitate → backspace it away → type the selling-point word faster
use_when: Slogan/selling-point title cards, negation-style copy; entrances where the text carries its own sense of time
length: ~5.3s (160f)
energy: low-medium
tags: opening
---

## Intent
Typing is the only text entrance that carries its own sense of time — characters arriving one by one is itself the rhythm,
needing no extra motion. Variant A treats typing as a **monologue**: type out a mediocre phrase character by character
(in the demo, "just a slideshow" under the eyebrow Introducing video-shotcraft) → pause and hesitate
→ backspace it away → type the selling-point phrase faster ("your cinematic crew"); a three-act play of hesitation–negation–declaration,
with all the drama in the differences between the three speeds.

## Variant
| Variant | Approach | Use when |
|----|------|------|
| A error-retype | type 2f/character → pause 16f with the cursor blinking twice → backspace 1.5f/character → retype 1.5f/character with no hesitation; the cursor stays solid while typing and deleting, and blinks only during the pause | The "change of wording" drama in a slogan title card; negation-style copy |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Character rhythm | substring(0, floor((f-start)/step)), frame-deterministic, no interpolation | Any eased typing reads as a loading animation |
| Three speeds | type 2f/character, delete 1.5f, retype 1.5f with zero hesitation | The difference between the three speeds must be perceptible — a change of wording at constant speed reads as a bug, not drama; this is the make-or-break point |
| Three cursor states | solid while typing/deleting = decisive; blinking twice with a 4f half-period during the pause = hesitation; after the copy is finished, blinks twice then is conditionally removed | The cursor is the actor's face; blinking at a constant rate throughout means there's no "hesitation" |
| Layout | fixed-width span per character (60px monospace slot), left edge anchored | A variable-width font / measuring the whole string's width reflows and jitters frame by frame |
| Ending | still ≥50f | Even a leftover cursor at 0.05 opacity ruins true stillness |

## Known pitfalls
- Tuned on placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use.
- Strong sound dependence: key-click sounds aligned per character, backspace pitched lower (sound-design
  §4.5) — a silent typewriter is just a caption generator
- ≤1 time per film — the change of wording is a one-off dramatic turn; changing your wording twice is stuttering
- One of the two — a monospace font or per-character spans — is mandatory, otherwise when characters arrive
  the whole line reflows and the typing turns into twitching

## Reference implementation
demos/typography/typewriter-moves/
(TypewriterErrorRetype.tsx)
