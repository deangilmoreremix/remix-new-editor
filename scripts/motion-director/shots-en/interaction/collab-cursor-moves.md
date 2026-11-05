---
name: collab-cursor-moves
one_liner: Collaboration cursors as actors: cast-ensemble, a five-cursor crowd atmosphere layer (staggered fly-in + sine drift + typing cameo + gathering round to watch)
use_when: Canvas scenes on a collaboration/multiplayer theme, laying down the warmth of "the team is here" over the frame
length: A ~5.2s (156f)
energy: A low-medium (an atmosphere layer, can pad any duration)
---

## Intent
In the library, cursors have always been "operating tools" (the cursor in cursor-flyover
is a single cursor giving a click-through tour). This card promotes collaboration cursors with identity name tags into **actors**:
after five cursors enter with staggered overlap they keep drifting as atmosphere particles; the feeling of "the team is here" rests entirely on them, and one of them
can even stop and type (a cameo role). SVG cursors + name-tag chips cost very little and carry very high narrative density;
they're the cheapest visual argument for the "collaboration" theme.

## Variants
| Style | Approach | Use when |
|----|------|------|
| A cast-ensemble | 5 named coloured cursors spring-fly in with staggered overlap onto video-shotcraft's storyboard whiteboard (the avatar group pops out on the same frame, sticky notes carry author colours) → stay on with dual-frequency sine drift → one hangs on the insertion point and types out the brief card's title → at the end everyone gathers round smoothly to watch | Film-wide atmosphere layer for canvas/whiteboard products; when background liveliness of "other people are here too" is needed beyond the main content |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A entrance | 5 cursors with delay 2/7/11/16/22f staggered, spring(damping 15, stiffness 80); name tags fade in 10f later + float up 12px; the avatar group at top right pops out on the same frame (the slot width grows as they pop out) | Name tags appearing on the same frame as the cursor read as stickers; only fading in as it decelerates reads as "someone has arrived and introduces themselves" |
| A drift | Dual-frequency sine superposition (0.055/0.021 rad/f, each with a different phase), amplitude ±40/26px | Single-frequency sine reads as a pendulum; only dual frequencies out of phase give "the randomness of a human hand" |
| A typing cameo | 48–104f types 29 characters (1.6–2.4f/character with deterministic jitter, an extra 0.9f pause after spaces); the cursor arrow hangs on an in-line insertion-point anchor and follows it across line breaks; the hand is steady while typing (drift pressed down to 0) | Computing the arrow and the insertion point's positions separately will always misalign; an in-line zero-width anchor lets browser layout do the maths for you |
| A gathering | From 98f, 28f smooth to watching positions around the card (not covering the title or eyebrow), drift amplitude decays to 25% and is kept | Drift must not go to zero after gathering: a completely still group of cursors reads as a frozen machine |

## Known pitfalls
- Tuned on a hand-built frame in the demo (a porcelain-white whiteboard + sticky notes + a brief card, with the board name carrying the video-shotcraft logo, title "Ship a launch film by Friday."): the parameters are a starting point, not final;
  re-check with real material on first real use
- Name-tag colour = identity coding, and must be consistent throughout the film (if blue = Designer, it stays blue); change colour midway and the viewer thinks it's a different person
- When changing the title copy, keep the character count and number of spaces, so the typing rhythm (per-character jitter indexed by position, extra pause after spaces) and the ending frame stay unchanged
- Drifting cursors must never cover the main content being read: the atmosphere layer must yield the scene, and the drift range avoids the subject's safe area
- Division of labour with cursor-flyover: there the cursor "operates the UI" (clicks have a payload), in this card the cursors "perform for you" (displacement is the plot); when a cursor needs to click something, go back to that card
- Sound: one very light pop per cursor on entrance, silence during the drift segment, soft keyboard during the typing segment

## Reference implementation
demos/interaction/collab-cursor-moves/
(CursorCastEnsemble.tsx)
Source footage: figma-devmode 0:05 + miro-promo full film + pitch-app 82–90s typing cameo
