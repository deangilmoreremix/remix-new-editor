---
name: pill-slot-cycle
one_liner: Word-slot rotation within a sentence — the fixed sentence stem is nailed in place, while the pill badge at the end of the sentence rolls one notch like a slot machine every ~0.7s (the old one flies up, accelerating and fading out; the new one slides in from below with blur); after cycling through N feature words it lands as a complete sentence to close
use_when: The most elegant solution for "feature list" type copy (faster than a line-by-line list, more meaningful than character-level rolling); a paragraph of a one-sentence selling point + multiple verb phrases
length: entrance 12f + 21f per beat × number of words + close 14f + hold; 6 words about 6.7s (demo 200f, including a 48f hold on the complete sentence)
energy: medium (a steady metronome, no peak)
---

## Intent
Listing six features takes six lines as a list, or six beats fading in one by one while filling the whole screen. Word-slot rotation
packs them into **a single slot in one sentence**: the stem "One skill to ___" (the demo is about video-shotcraft: Storyboard it → Capture the page →
Move the camera → Cut on the beat → Design the sound → Render the film) is the promise, each pill that rolls through the slot
is evidence, and finally the pill flies away and "do it all." lands — the evidence
is listed, the conclusion is stamped. The structure has three acts built in: promise → listing → close. The make-or-break point is that the stem
**doesn't move a hair**: the audience's eyes are nailed to the slot the whole time, and as soon as the stem wobbles, the sense of a list falls apart.

## Motion core
- The stem is absolutely positioned with its left end anchored — **flex centring is not allowed**: changes in pill width would carry
  the stem into a reflow (a pitfall hit in the first round, now a ruling)
- Each beat is 21f (~0.7s): the swap completes in the first 8f, the remaining 13f rest — the rest is for the audience
  to read the word; a beat that can't be read through is as good as no swap
- Entrance: translateY 120→0 + blur 14→4→0, Easing.out(cubic);
  exit: translateY 0→-130 + blur 0→10, Easing.in(cubic), accelerating away
  — the newcomer decelerates into place, the old one accelerates away, and the direction reads as "flipping the page upward"
- The slot uses an invisible placeholder pill (visibility hidden) to hold the width, with the new and old pills absolutely positioned
  on top of each other — the slot width changes naturally with the current word but doesn't jitter
- Closing beat: the last pill flies up (7f ease-in), "do it all." comes up 90px from below with
  Easing.back(1.4) overshoot into place — the only overshoot in the whole piece, saved for the conclusion; after it lands the whole line slowly centres with smooth 26f
  (during the listing the stem stays left-anchored; it only moves once the concluding sentence is complete), and the space between "to do" returns to normal word spacing

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Beat length | 21f/word, 5–7 words | <16f and the phrase can't be read through; >28f and the metronome feel falls apart; at 8+ words the audience starts counting |
| Swap window | first 8f of the beat | Stretch it to 12f+ and old and new share the screen too long, reading as two pills fighting |
| Travel distance | in +120 / out -130px | <80px reads as an in-place flash swap; asymmetry between in and out (out slightly farther) makes the exit more decisive |
| Motion blur | in ≤14 / out ≤12px vertical blur, computed from actual velocity (0 when still); in rotateX -38°→0, out 0→34°, flipping around a drum | Remove the blur and the swap reads as a hard pop; >20px and the middle frames smear into colour blocks |
| Closing overshoot | Easing.back(1.4), 14f | >2 and the conclusion lands like a cartoon; with no overshoot there's no step up between the conclusion and the listing |
| End hold | complete sentence rests ≥45f | This sentence is the purpose of the whole segment; without a hold the listing was wasted |

## Known pitfalls
- Tuned on placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use.
- This card is whole-word pill rotation embedded in a live sentence (not character/digit-level mechanical rolling) — only use this card when the copy
  has a "stem + verb phrase" structure; don't force it onto pure numbers / pure title words
- Division of labour with typewriter-moves: the typewriter "builds a sentence one character at a time", this card is
  "the sentence is built, swap the parts" — they can coexist in the same film, but don't use both back to back on the same line of copy
- Division of labour with type-rhythm-sync: that one has existing text changing properties with the audio track (without changing content),
  this card changes content — when tied to the audio track, just align this card's beats to the drum hits; don't stack weight pulses on top
- Pill phrase lengths should be close (the longest in the demo are "Capture the page" / "Design the sound") — a length difference >2×
  makes the slot width jump too violently and the sentence's centre of gravity swings left and right
- The closing sentence must match the stem exactly in font size and weight (both 96px/800 in the demo) —
  if "do it all." is larger than the stem, it reads as a new title rather than completing the sentence

## Reference implementation
demos/typography/pill-slot-cycle/
(PillSlotCycle.tsx)
Original source: notion-ai 4.5–8.5s
