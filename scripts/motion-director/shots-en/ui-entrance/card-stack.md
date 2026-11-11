---
name: card-stack
one_liner: A set of template cards (9 in the demo) spring in one by one from below the screen, landing faster and faster into a stack; once all have landed, the whole stack fans out in one go — each rotated 6.5° and shifted 138px by its index — and finally the centre card is pulled out
use_when: Product passages that need to say "we have a set of things"; the establishing shot for card walls / template libraries / plan lists; also works as a build-up beat before the logo
length: about 5.0s (150f@30fps)
energy: medium-high (the entrance is a continuous run of small bursts; the fan-out resolves into one smooth collective move)
---

## Intent
The cards first gather into one object, then spread into a set of objects — the order matters: first the "whole", then the "individuals".
The first thing the viewer remembers is a stack with weight (a sense of quantity); only on second look do they see each one is different (variety).
The fan-out is saved for the end and done in one go so that it doesn't clash with the entrance beat.

## Motion core
(Demo version: porcelain template library launch — the video-shotcraft shot recipe library, 9 320×440 shot / template cards, native 1920×1080 coordinates)
- Two layers of motion, separated and stacked: the entrance (each card's own spring) and the fan (one fan-out progress shared by all);
  the final transform is `translate3d(tx, y, tz) rotate(rot)` composed from the components each layer computes
- Entrance: start frame `2 + stagger(i, 9, 40, EASE.out)` — the EASE.out mapping makes intervals large then small (thump——thump—thump-thump-thump, faster and faster);
  each card `springAt(f, start, {damping:13, stiffness:150})`, `y` rising from 820px to 0 (starting outside the frame), seated in ≈20f;
  in flight it carries an alternating ±9° tilt that converges as it seats, plus motion blur by vertical speed (≤10px)
- Weight: as each card seats (crossing the end point about 6f after launch) the whole stack is pressed down 5px (sin envelope 9f); in the stack there's a deterministic ±3.2° / ±11px offset,
  like a casually squared-up pile; before the fan-out, at 62–72f, the stack tightens by 2% (anticipation)
- Fan: `springAt(f, 68, {damping:20, stiffness:95})` is the only fan-out clock (with one slight overshoot = the inertia of a wrist flick),
  end state `k = i-4`, `rot = k*6.5°`, `tx = k*138px`; `transform-origin: 50% 130%` puts the rotation axis outside the cards' bottom edge —
  the fan's handle is in the hand, the cards rotate open around the wrist
- Stacking order = index (`zIndex = i`, left over right, like a fanned hand of cards), never changed — in the stack the top card is the last one,
  so there's no top-card jump when fanning out
- Camera: during the stack phase a very slow push from 1→1.06 gives "a stack" weight; over the same span as the fan-out (64→106f) it pulls back to 0.88 so the whole fan fits the frame;
  the ground contact shadow widens from 220 to 760 with the fan
- Ending: the centre card (solid cobalt cover: reversed Frame Chisel mark + "Launch", card name Launch film) is pulled out 72px along its own axis (overshoot) + a 3px cobalt outline + one sweep of light (Q4);
  the title "Start from a shot recipe." (88px) rises word by word, the subline follows, hold 28f

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Number of cards | N=9 (odd, the centre card owns the middle) | 9 × 6.5° = 52° total spread is the comfortable upper limit; >11 cards drop the per-card angle to 4–5°, otherwise the end cards fly off frame |
| Entrance stagger | 40f span, EASE.out distribution | Faster and faster is the "a run of them" feel; an even distribution reads as a roll call one by one, <20f reads as a clump popping up together |
| Entrance travel | y 820→0, spring damping 13 | The start must be outside the frame; damping <10 bounces more than twice, and as a group the jitters interfere with each other |
| Seat press-down | 5px, sin 9f | This is where "weight" comes from; >10px the stack looks like a trampoline |
| Fan spring | damping 20 / stiffness 95 | One slight overshoot is like a wrist flick; damping >26 has no overshoot and reads as a mechanical fan, <16 the fan sways back and forth |
| Fan angle | `k*6.5°`, shift `k*138px` | Angle and shift must be tuned in proportion: add angle without shift and the cards interpenetrate |
| Depth | `tz = i*2`, perspective 1800px | Only hints at stacking; depth mainly comes from stacking order + two layers of soft shadow |
| Rotation axis | `transform-origin: 50% 130%` | 130% decides how far the "handle" is from the cards; change to 50% 50% and it immediately degrades into a pinwheel scatter |
| Card pull | 72px overshoot + outline + sweep | Only once, for the centre card; a pull <40px doesn't read as "selected", >120px the card fights with the title |

## Known pitfalls
- The two time windows butt up exactly end to start: the last card launches at 42f and seats at ≈62f, anticipation at 62f, fan-out at 68f.
  Adding cards or increasing the stagger makes the entrance eat into the fan-out, producing a muddy "still flying while it starts rotating" — adding cards must
  push anticipation and fan-out start later in step
- With an even number of cards `k` takes half-integers (±0.5, ±1.5…), there's no centre card, and the ending "pull out the hero" lands off to one side;
  the demo uses 9. If you switch to a "middle over both sides" zIndex, watch out for the top card jumping during stack→fan
- The 320×440 cards are centred with `left = CX-CW/2, top = CY-CH/2`, and the handle position changes with CH; when changing size also check
  whether the end cards leave the safe margin (at camera 0.88 the outermost card corner is about 100px from the frame edge)
- The card faces are handmade template-cover placeholders (generative cover image + title + mono metadata); in production replace them with real page slices;
  covers use only light tints of cobalt / teal / ink, and only the centre card is solid cobalt — leave one "hero" card in real material too
- Over the fan-out span (64→106f) the camera pulls back to 0.88 to keep the end cards in frame; to go into the next shot you can cut after the card pull settles (≈120f) — don't leave the fan sitting idle too long

## Reference implementation
demos/ui-entrance/card-stack/
(CardStack.tsx)
