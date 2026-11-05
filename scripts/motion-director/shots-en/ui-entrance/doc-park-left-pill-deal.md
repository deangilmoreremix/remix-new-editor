---
name: doc-park-left-pill-deal
one_liner: The document doesn't fade out; instead it slides out to the left until only about 35% of its width shows, shrinking slightly to 0.92. On the right, three white outlined pills are dealt slowly in time with the narration (popping in with outBack); after each lands, the caption beneath it darkens word by word, and the whole sentence fades out before the next arrives. The document on the left auto-scrolls extremely slowly throughout, staying "being read"
use_when: Narration-driven "conclusions given one by one" passages; the core explanatory shot for document understanding, recommendation reasons, and review-comment products
length: about 5.8s (174f@30fps)
energy: low (a slow dealing rhythm, no peak in the whole clip; kept alive by the auto-scroll)
---

## Intent
Conclusions must be given one at a time for the viewer to remember them. But if you fade out the source document, the conclusions become castles in the air — the viewer
doesn't know where these words came from. This card's solution is to **keep the source in frame**: the document parks on the left showing only a strip, still
scrolling slowly (showing it's being read), and every conclusion on the right grows out of this document. The dealing rhythm is deliberately slow
to leave the narration time to finish a sentence.

## Motion core
- Parking is not fading out: `seg(t, 0.06, 0.24, E.inOutCubic)` drives
  `translateX(0→-55%) scale(1→0.92)`; `transform-origin: 0% 50%` anchors the scale at the left edge,
  so the document doesn't leave the left side of the frame as it shrinks — in the end only about 35% of its width shows
- Constant auto-scroll: `translateY(-t * 120)`, continuous and constant-speed (≈0.7px/f), with content at least 140px longer than the container.
  The old approach `-(t*3 % 1) * 40` used modulo, so non-periodic content jumped back a full 40px every 1/3 of the clip, visible to the naked eye; it's been dropped
- Slow dealing: the three pills' start points are hard-coded as `T0 = [0.26, 0.48, 0.70]` — interval 0.22 (about 38f / 1.27s),
  which is the length of one short narration line, not a conventional UI stagger
- Each pill runs two curves in parallel: `o = seg(t, f, f+0.035, E.outQuad)` controls opacity (fast, about 6f),
  `b = seg(t, f, f+0.062, E.outBack)` controls `translateY(14→0) scale(0.94→1)` (slow, about 11f
  with overshoot) — seen first, then settled; it has more of a "caught it" feel than a single curve
- Four-part caption choreography: start `cs = f+0.05` (about 3 frames after the pill lands); `show` appears quickly with a 0.02 window;
  `inn` darkens word by word spread over `(ce-cs)*0.7`; `ce` is the next pill's start minus 0.03 (for the last one ce=0.98);
  `out` fades out over `ce-0.05→ce` — each caption has cleared before the next pill enters, so there's only ever one sentence on screen
- The pills' end state is a static list (`top = 54 + k*48`); once all three are in place they stay on screen, reading as
  "the conclusion list has taken shape"
- Evidence linkage: after each pill lands, the corresponding evidence sentence in the document is swept by a highlighter left to right (f+0.06→0.13),
  and a thin accent-colour line connects from the end of that sentence's line to the pill's left edge (f+0.04→0.11 draw-on), fading out as that sentence's caption exits

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Deal start points | `T0 = [0.26, 0.48, 0.70]`, interval 0.22 (≈38f) | The interval is the narration line length; below 0.12 the caption's "word-by-word darkening" can't finish and it reads as the caption flashing and vanishing |
| Park window | 0.06→0.24 (inOutCubic) | Must be finished before the first pill (0.26); overlap produces a muddy "document still sliding while pills are already being dealt" |
| Park amplitude | `translateX -55%` + `scale 0.92`, about 35% showing | Showing too little (<25%) turns the document into decoration and loses the "source" meaning; showing too much leaves no room on the right for the 172px-wide pills |
| Pill opacity window | 0.035 (≈6f, outQuad) | Shorter than the movement window on purpose — solid first, then steady; equal windows read as an ordinary fade-in |
| Pill movement window | 0.062 (≈11f, outBack), y 14→0, scale 0.94→1 | outBack's overshoot is the "card dealt onto the table" feel; switch to outCubic and it becomes a bland float-up |
| Caption delay | `cs = f + 0.05` (≈9f) | The caption starts only after the pill has landed (0.062); earlier and the caption appears before the conclusion |
| Caption darkening travel | `(ce-cs)*0.7` | Takes 70% of the sentence's visible time; the last 30% is fully solid resting reading time; set to 1.0 and the caption fades out the moment it's finished |
| Auto-scroll | `-t × 120px`, continuous constant speed | About 0.7px/f over 5.8s, a hint-level "being read" speed; >3px/f steals attention and becomes a scrolling showcase |

## Known pitfalls
- The auto-scroll is a continuous displacement, not a modulo loop (modulo only avoids jumping back when the content itself is strictly periodic); when changing duration or
  travel, ensure the document content is longer than the container by at least the whole travel, or the end will scroll into blank space
- The last caption's `ce = 0.98` means it fades out over 0.93→0.98, and the last frame has only the three pills with no caption. To
  keep the last line to the end, change the last `ce` to >1 and remove out
- Pill positions are hard-coded as `left:214px, top:54+k*48`, width 172px — a set of numbers matched to the parked document
  (about 87px showing) on a 480-wide canvas. Changing the document's park amplitude means changing PX in step, otherwise the two overlap
- The three pill texts (in the demo, the three shot cards recommended by a video-shotcraft promo brief: Crash Zoom / Deck Deal / Logo Sting) and the three captions are illustrative, and caption
  length directly affects how fast the "word-by-word darkening" reads — after switching to real copy, retune the `inn` travel to the new sentence lengths
- The number of pills is hard-coded to 3 (the length of `T0`). At 4 there isn't enough time: the last start goes past 0.9 and the caption
  can't finish at all; for 4 or more consider shortening each sentence rather than forcing them in
- The caption's `ce` depends on `T0[k+1]`, so changing any pill's start also changes the previous caption's visible duration — this
  is a deliberate linkage (the caption always fills up to just before the next pill), but when tuning be aware they are not independent parameters

## Reference implementation
demos/ui-entrance/doc-park-left-pill-deal/
(DocParkLeftPillDeal.tsx)
