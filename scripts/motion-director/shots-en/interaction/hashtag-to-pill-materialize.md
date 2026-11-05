---
name: hashtag-to-pill-materialize
one_liner: A hashtag typed into a solid entity: "#word" is typed out centred (red solid cursor always lit), a 1-frame hard cut turns it into a wide pill tag, after a hold it shrinks and moves left to land in the page's tag slot, then another 1-frame hard cut reveals the finished page; a rhythm skeleton of "two hard cuts and one slide"
use_when: Demo segments for tag/category/keyword features (typing a tag in a notes app, topic aggregation); three-part narratives of "input → becomes a UI entity → returns to its place in the finished product"
length: 120f (4s): typing ~40f + hard cut to pill and hold ~18f + shrink-move ~14f + rest ~1.2s after the hard-cut reveal (source footage 18–21.5s)
energy: medium (crisp and clean, getting its punch from hard cuts, not bounces)
tags: typography
---

## Intent
The conventional way to turn text into an entity is a gradient/morph/unfold; a frame-level breakdown of the source footage proves that Bear does the opposite:
**the materialisation is a 1-frame hard cut**: one frame it's still text + cursor, the next frame it's a complete
pill, with no unfold, no cross-fade, no rebound. A hard cut gives a "snap, done" certainty;
any gradient would soften the "entity" into an "effect". The whole segment's skeleton is **two hard cuts sandwiching one
slide**: hard-cut materialisation → smooth shrink-move back into place → hard-cut reveal of the finished page. The only continuous
motion (the shrink-move) is framed by two hard cuts, which is what makes it seem both fast and steady. This rhythm skeleton is the make-or-break point;
change the nature of any one of the three segments (turn a hard cut into a gradient, turn the slide into a hard cut) and the whole card collapses.

## Motion core
- Typing segment: geometric sans-serif (Futura vibe) types "#word" centred, with a **red solid cursor
  always lit, not blinking** (measured from the source footage, don't add blink); a human rhythm of 4–6f/character with deterministic jitter
- **Materialisation = 1-frame hard cut**: the whole text + cursor layer disappears, and on the same frame a light gray pill with no outline appears
  + icon + word (same font size, same size in the same place, the # replaced by the icon); only a
  3f 1.03→1 micro-settle is allowed, to avoid stiffness
- Pill hold ~0.6s → one bezier easeInOut segment shrinks and moves left (~0.55x,
  ~14f) to land in the page's tag slot, with position/scale on the same curve with the same start and end, not segmented midway
- After landing, **another 1-frame hard cut** reveals the finished page: background colour/title/body/pill colours all change
  on the same frame, followed by a truly still ending
- Implementation key points: draw the pill at the large font size and scale it with an overall transform, and
  transformOrigin must be 0 0 + translate first, otherwise the landing centre drifts

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Typing rhythm | 4–6f/character (source footage ~6 characters/second), mulberry32 jitter | Uniform intervals read as machine typing; the cursor must always be lit (**measured from the source footage**, it doesn't blink) |
| Materialisation | **1-frame hard cut** (frame-level measurement of the source footage shows no transition at all) + 3f 1.03→1 micro-settle | Adding a fade-in/unfold immediately downgrades it into an ordinary morph; a micro-settle >4f reads as a bounce |
| Pill geometry | 740×236@1920 (**measured from the source footage** 493×157@720p ×1.5), no outline | The pill needs to be "excessively wide" to feel solid; adding an outline reads as a button |
| hold | ~18f (0.6s, **measured from the source footage**) | <12f and it flies off before the viewer has seen what the pill looks like |
| Shrink-move | ~0.55x (**measured from the source footage** 273/493), 14f, bezier(0.5,0,0.25,1) | Scale and displacement must share the same curve; tuned separately they read as two animations |
| Reveal | Landing +3f, then a 1-frame hard cut to the whole page | If the reveal is made into a transition, the second hard cut is gone and half the skeleton collapses |

## Known pitfalls
- Tuned on grayscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Overlaps in domain with typewriter-moves (typing presentation) and ui-to-brand-morph (taking shape by gradient morph):
  this card's make-or-break point is **hard-cut materialisation, not gradient morphing**: whenever you want to add a transition,
  you should use those two cards instead of changing this one
- An early version invented a segment of "the pill flies in and slides down into a note card"; comparison with the source footage disproved it and it was cut;
  don't revive the flight segment
- The default transformOrigin 50% 50% makes the scaled landing centre drift by (1−s)×half-width;
  you must use origin 0 0 + translate to the target centre and then scale (commented in the demo)
- Remaining gap from the source footage: the Futura fallback weight, and a ~10px-level deviation in body spacing on the reveal frame;
  the rhythm and hard-cut timings have been aligned on dense frames. The demo content has been swapped into the video-shotcraft world
  (source footage "#music" + musical note → "#shots" + clapperboard icon, finished page "My favorite shots");
  the hashtag is the same length as the original word, and the pill geometry is unchanged

## Reference implementation
demos/interaction/hashtag-to-pill-materialize/
(HashtagToPillMaterialize.tsx)
Source footage: bear-app.mp4 18–21.5s
