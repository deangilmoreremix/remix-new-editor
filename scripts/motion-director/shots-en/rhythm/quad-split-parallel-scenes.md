---
name: quad-split-parallel-scenes
one_liner: The frame hard-cuts to a 2×2 quad grid; the four quadrants run their own micro-scenes in parallel (typing, whip push-in, word-by-word, interaction chain), with key beats staggered 3–6 frames apart to create an information barrage
use_when: The montage beat in a rhythm passage where "there are many features, all happening at once"; the density peak in the middle of a trailer
length: 90f (3s@30fps: 0–62f parallel barrage + 28f final-state hold, no transitions throughout)
energy: high (four parallel threads + offbeat impacts; the standard BGM chorus slot)
---

## Intent
Replace sequential display with parallel density: four things happen in front of the viewer at once; the audience can't read each in detail, but every 3–6 frames some quadrant "moves" — the scanning rhythm is firmly pinned. This is a technique card: all in-panel content is replaceable; the offbeat choreography is the recipe.

## Motion core
- Four independent quadrant scenes (content is an example: four sites happening simultaneously while video-shotcraft produces a promo): TL browser tabs pop in one after another with overshoot + address bar typed character by character + at 44f the page loads and a big headline slides up from below + inQuad slow push 1→1.1 throughout; TR terminal command typed + two output lines + the moment the last line appears, a whip push-in 1→1.85 (sin-envelope blur 5px, old lines fade back to 8%); BL three 132px big words drop and slam in one by one with overshoot; BR approval card slides in → cursor flies on a bezier to Approve and clicks → button turns Approved → second flight to Publish and clicks → a go-live notification pops up and counts
- **The offbeat is the soul**: TL tabs 6/11/16/21, page 44; TR output 27/33, push-in 37; BL words 14/30/49; BR click 25, colour change 27, click 52, notification 56 — any two adjacent heavy events are ≥3 frames apart; something is always moving but never in unison
- The two typing cursors blink on offset periods (16 frames vs 14 frames +5 phase) to avoid blinking together
- The four panels alternate lightness in a checkerboard (ember: cream #f7eee4 / warm black #160d09 / solid orange / latte #e9d7c4), 8px warm-black gutters + 20px rounded corners; in-panel text re-laid out for 1080p (secondary ≥32px, main words 132px)
- After 62f all four panels stop in their final states (Launch film. / promo.mp4 ready / Prompt. Render. Ship. / Live · 3,214 views), assembling a complete poster held for 28f

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Offbeat interval | 3–6 frames between adjacent heavy events | <2 frames reads as on the same beat (moving in unison = stiff); >8 frames the density scatters and the barrage feel disappears |
| TL slow push | inQuad 1→1.1, origin 50% 90% | A slowly accelerating "noise-floor motion" throughout so that even a still panel isn't still; too large and the window hits the corner badge |
| TR whip push-in | 37–47f, scale 1.85 + blur peak 5px, old lines fade to 8% | This is the heaviest beat of the whole card; land it on a BGM accent; the blur envelope must be sin (symmetric in and out) |
| Typing speed | TL 20 characters / 0–40f, TR 19 characters / 0–24f | When changing copy keep the character count about the same, otherwise the typing rhythm drifts out of its offbeat relationship with the other quadrants |
| BR interaction chain | Slide in 4 → cruise 14 → click 25 → colour change 27 → second cruise 38 → click 52 → notification 56 | Each link depends on the previous; changing any step requires shifting everything after it; the overshoot pop of the notification is the accent at the end of the chain |
| Background colours | Light / dark / accent / light in a checkerboard | When switching to a project's theme colours keep adjacent panels' lightness difference ≥15%, otherwise the sense of panel lines disappears |
| Closing | Final-state hold 28f after 62f | After the parallel barrage you must give one beat for all four panels to be read at once |

## Known pitfalls
- This is a technique card: the four panels' content is entirely replaceable (product screenshots/screen recordings/other motion cards), but **the offbeat table must be re-arranged** — new content's keyframes must inherit the original timetable, otherwise the four panels become a collage of four independent videos
- The ~2.1s barrage is the density ceiling; to stretch it longer, give each quadrant a second round of events, otherwise the second half has "nothing moving"; the closing hold is counted separately
- Cursor blinking is computed by frame number (periods 16f / 14f+5); after changing the timetable re-check the two cursors' phase offset
- Four panels typing at the same time / popping in at the same time is the most common degenerate version — how to check: step through frame by frame; no frame should have two quadrants with a "heavy event" at the same time

## Reference implementation
demos/rhythm/quad-split-parallel-scenes/
(QuadSplitParallelScenes.tsx)
