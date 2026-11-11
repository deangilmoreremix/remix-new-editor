---
name: stroke-segment-build
one_liner: Broken strokes become letters: the title is split into a dozen-plus mutually disconnected stroke segments that light up one by one in scrambled order; for the first 70% it's unreadable, and the instant the last segment lands the meaning "snaps" into place
use_when: A suspense-building product-name/big-number reveal in an opening; ≤1 per film; division of labour with type-assembly/draw-svg-trace: those are "watching letters being assembled/drawn", this card is "a delayed reveal of meaning"
length: 165f (5.5s; 2s hold after the reveal at f105)
energy: starts low, ends medium (suspense type; the landing frame is the energy point)
tags: typography
---

## Intent
The *Alien* title-sequence ruling: the title isn't drawn, it "develops": split into discrete
stroke segments lit in scrambled order, the viewer sees only mysterious fragments for the first 70% of the time, and the instant the last few segments land
they suddenly read what the word is. "The moment of recognition" is the hook, and the hook's strength depends on
how long the unreadable period holds and how late the key segments are held back.

## Action phases
| Phase | Frame range reference | Content |
|------|------|------|
| 1 Dark field | f0–12 | Deep purple wall + very faint wall light, resting (not dead black) |
| 2 Scrambled lighting | f12–72 | The start points of the first 13 segments are distributed by ease-out (intervals from 9f getting denser down to 3f); each segment is a 7f neon strike-up flicker (on—off—on—half—on), then holds steady at 0.58 brightness |
| 3 Held breath | f72–86 | 14f with no new segments at all, only the faint hum of current in the tubes: the tightest beat of suspense |
| 4 Key segments | f86 / f93 / f99 | S lower spine → H middle bar → P bowl bottom, falling on three beats |
| 5 Reveal | f105 | All tubes 0.58→1, current surges up to 1.25 and falls back (the sign's own wide bloom surges once), whole word scale 1→1.02, wall and floor get lit |
| 6 Freeze | f113–165 | Hold after the subtitle rises; the camera pushes in very slowly 1→1.035 throughout |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Segment granularity | 4 letters, 16 segments (monoline geometric letters 260×400/letter, tube line width 30, round caps, 4% electrode gap left at each end) | Too few segments and the suspense period is short; too fragmented and it reads as noise. S is split into two opposing arcs of 3 segments each |
| Scramble table | Hand-ordered: jumps randomly across letters, the "readability key segments" (S lower spine / H middle bar / P bowl bottom) held back to the last 3 segments | Lighting in order = no suspense; key segments too early = giving it away early |
| Lighting rhythm | Sparse → dense (9f→3f, `stagger(.., EASE.out)`) → held breath 14f → three beats 7f/6f | Constant equal intervals have no tension; held breath <8f can't be felt, >20f reads as frozen |
| Unreadable period | The first 13 segments (about 60% of the duration) don't read as a word | For QA, sample mid-segment frames and ask yourself "could I guess it?"; if you can, reorder |
| Half-lit → fully lit | 0.58 during suspense, 1.0 + surge 1.25 at reveal | Too bright during suspense (>0.8) and the reveal loses its "powering on" contrast |
| Landing pulse | scale 1.02 + the light surge | Neon is an object hung on the wall; large scaling looks fake; leave the impact to the light |
| Wall illumination | Ambient = 0.12 + 0.5×proportion of segments lit + reveal/surge | The more tubes, the brighter the wall, physically believable; constant wall light makes the lighting lose its weight |
| Floor reflection | Mirrored along the floor intersection line, blur 5px, opacity 0.42, fainter the further from the floor | The mask is written in local coordinates before mirroring; above the intersection line it must be fully transparent |
| Unlit segments | Conditionally not rendered (not opacity 0) | A precondition for true stillness at the end and for "not giving it away" |
## Known pitfalls
- The demo is a neon-sign version (aurora dark field); for other materials (LED segment displays, glowing outlines) the strike-up curve and half-lit value must be retuned
- Auxiliary text on a dark base should be light gray: in the demo's first version the top title was dark gray on a dark base and invisible (caught by the P1 self-check)
- Don't paint a separate radial light spot for the reveal bloom: it forms a dirty bright spot in the middle of the word; let the sign's own wide bloom (shaped like the word) surge once
- The reflection renders the whole sign twice (each pass with two layers of SVG Gaussian blur), doubling a single shot's render cost; when performance is tight, cut the reflection first
- Word-length limit: 4–6 letter words are best; with long words the unreadable period is hard to control and the segment count explodes
- This card relies on "the instant of recognition", so the title must be a word the viewer knows (product name/SHIP/LIVE and the like);
  a made-up word offers nothing to "recognise"
- Sound: pair each segment's lighting with a short electrical tick of a neon strike-up (sparse, volume stepping down), keep only a low-frequency hum in the held-breath segment, and on the landing frame one impact + optionally a riser underneath

## Reference implementation
demos/opening/stroke-segment-build/
(StrokeSegmentBuild.tsx)
