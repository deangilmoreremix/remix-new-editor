---
name: transition-travel
one_liner: Travel-style transition, letterform-counter travel: the letterform of a giant chapter title is a window, and the camera burrows into the letter's stroke to complete the scene change
use_when: Seams where the two shots have an "element/container"-level spatial relationship (technique card, chosen as a complement to the three shot-transitions styles)
length: n/a (technique card; demo 150f, main push action segment 52f, holds before and after counted separately, frames carved out of the adjacent shots' budgets)
energy: n/a (technique card, doesn't take an energy slot)
tags: camera
---

## Intent
The three shot-transitions styles are the "handover" type: the previous shot ends, the next shot enters, and the seam relies on white flash/blurred frames/
a window to cover the instant of the page change. This card is the "travel" type: the background exists inside the foreground frame
as a real element (a letterform hole), and the camera burrows in with one continuous spatial move;
the viewer follows the same object from start to finish, with no handover instant. Selection rule: if the background can be "present
beforehand" in the foreground → travel; if the two scenes are merely sequential with no spatial nesting → handover. The semantics of letterform-counter travel is
"the title is the door" (chapter title card and transition in one).

## Variants

| Style | Approach | Seams it suits |
|----|------|----------|
| A letterform-zoom letterform-counter travel | The giant title's letterforms (holes cut with an SVG mask) show the new page through them; an exponential push goes through the hole, takes over the instant the hole fills the frame, and the remaining strokes are flung out of frame | Chapter title → body; a high-energy alternative to the paper-title-card chapter title card |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A main counter push | A cover SVG mask (white base + black text, weight 900) cuts the holes, with transform-origin aimed at the centre of a letter's stroke (the hole); anchored in a counter, pushing all the way fills the frame with the cover, not the hole (demo: the centre of the I's vertical stroke in 560px "EDITS" at 973,515; vertical stroke 107px×30 > frame width; when choosing the word, put the I's vertical stroke near the frame's centre line so the hole opens from dead centre); scale=30^u, u over 52f bezier(0.6,0,0.85,0.5) slow start steep finish, 26–34f before the push a 2% pull-back as anticipation | Set ZOOM_MAX for "the hole fills the frame"; the thinner the stroke the bigger the multiple; leave the slow-start segment for the viewer to see clearly that "there's something in the hole" |
| A something in the hole | Cover dark, hole bright: warm-black cover vs molten-gold gradient video-shotcraft launch page, with the cards in the hole also made bright (cream-white frosted); a ring of blurred orange stroke around the letter edges drawn only in the cover area (light leaking out of the hole) + a 1.5px warm-white cut edge | When there are dark blocks in the hole, those letters read as "solid letters" and the suspense of going through the hole is gone |
| A only light in the hole, no text | During the title card hold the page's text/card layers are completely hidden, and the hole shows only a warm gradient + soft light shapes (a blob of cream-white light at the card positions, a smudge of dark red at the title position); in the middle of the main push, 64–90f, the content layer fades in from 18px defocus into focus (EASE.out), sharp by takeover | When the page title can be read in the hole, two layers of readable text compete, and the title letters read as "cluttered" rather than one clean cut-out |
| A exit and trails | For scale∈[14,26] cover opacity 1→0; from u>0.35 the desired blur 0→20px (divided by scale and written into blur) + four layers of semi-transparent cover ghosts 0.8–3.2 frames earlier, stacked into a radial zoom trail; at the takeover instant the page flashes brightness +12% then falls back | Blur not divided by scale gets magnified into a blurry wall; with only two ghost layers it reads as hard-edged semi-transparent colour blocks, only four layers connect into a trail |
| A background parallax | The page only pushes 1→1.08 (0.7·u during the main push, completed by quint-out after the takeover, with continuous speed at the handover) + drifts 28px left over 0–100f; after takeover the shot counter on the render card goes 0→12, duration bars fill in staggered overlap, the DONE label pops | If the background doesn't move, the hole shows a dead picture; push the background too much and it moves at the same speed as the cover, and depth vanishes |

## Known pitfalls
- The push anchor must be measured on rendered frames (the demo's vertical stroke coordinates were measured from a still); changing font/word/renderer letter-spacing
  all cause drift: after rendering look at the push direction, and if the hole isn't centred fine-tune origin; don't trust numbers hand-derived from em values of letter widths;
  when the anchor stroke is too far from the frame's centre line (e.g. the I of "FILM" at x≈726), the hole opens off to one side and the cover on the other side lingers; change the word so the vertical stroke is centred
- When the background page pushes to 1.08, 4% is cropped around the edges: leave the layout safe margins for "after the push" (demo left/right 200/230, top 122)
- Letterform-counter travel doesn't stack with the three handover styles on the same seam, one seam one style; the travel style already carries high energy,
  wrapping it in white flash/screen shake reads as giving the trick away (same rule as shot-transitions)

## Reference implementation
demos/transition/transition-travel/
(LetterformZoom.tsx)
