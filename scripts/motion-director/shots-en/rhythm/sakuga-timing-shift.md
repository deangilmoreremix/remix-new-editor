---
name: sakuga-timing-shift
one_liner: On threes to on ones — the element first moves in the jerky flipbook steps of one drawing every 3 frames, then at the climax switches to a frame-by-frame silky sprint; the sudden change in frame-rate quantisation is itself the spectacle
use_when: Emphatic displacement of a single element (card entrance, a metric crossing the finish line); passages that need a "handmade feel → climactic burst" contrast
length: 150f (5s)
energy: medium-high
tags: ui-entrance
---

## Intent
The library's timeline manipulation already includes speed-ramp-freeze's freeze-and-thaw and hit-counter's local hit-stop. This card is a different kind — **what changes is not the speed but the frame rate itself**: in the jerky section the driving frame is q=floor(f/3)*3, so the element moves only one step every 3 frames (10fps flipbook); from the switch frame onward it is driven frame by frame by the raw f, a silky sprint. The bluntness of on threes and the smoothness of on ones are cut against each other on the same screen — the timing direction of Japanese animation (shooting on 3s / on 1s). The jerky section is not low quality, it's a handmade feel; the switch point is the climax marker.

## Motion core
- Jerky section: q = Math.floor(f/3)*3 as the driving frame, position linear X 140→1180, 16 key drawings, each step ≈69px; the pose freezes with q: sin(q) rotate ±5° + alternating squash/stretch (0.97/1.035) + alternating high and low small hops (−18/−2px), a different look each step
- Switch at f48: two "impact frames" (the image inverts to an ink background + speed lines focused on the card) as the climax marker, then continuous drive by the raw f, Easing.out(poly(4)) high-initial-velocity sprint doubling back to centre + 40px overshoot + 6f rebound, landing with scaleX 0.92 / scaleY 1.07 squash
- In the sprint section, motion stretch is driven by velocity from the position difference (scaleX peak ≈1.3 / scaleY 0.9), with 9 horizontal tapered ink speed lines behind, length ∝ velocity, **conditionally mounted** — removed when velocity is low
- The timing change is labelled in three synchronised places: the corner badge "ON 3s / 3コマ打ち"→"ON 1s / 1コマ打ち" (pop 1.25×; the hand-drawn underline is redrawn every 4 frames to boil, frozen after f=108); the bottom "exposure sheet" in on-threes writes a drawing number only every 3 cells with vertical lines in the cells between (= hold the previous drawing), in on-ones every cell has a number — the audience directly sees how many drawings per second
- Visuals: paper-look animation paper (registration holes, pale-blue pencil safe frame/crosshair); the subject is a video-shotcraft product card with 5px ink lines + hard-edged cel drop shadow (30fps · every frame, crafted); after f74 the hold section has a 2% extremely slow push-in

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Timing | floor(f/3) in the jerky section (on threes) | /2 isn't jerky enough; /4 or above reads as the player freezing |
| Displacement per step | ≈69px (derived from total travel 1040 ÷ 15 steps) | <30px reads as stutter/dropped frames, not jerkiness — make-or-break point |
| Pose between steps | sin(q) rotate ±5° + alternating squash/stretch + alternating high/low small hops | Pure-displacement jerkiness with no pose change looks like a bug, not a flipbook |
| Switch frame | f48 (jerky : sprint ≈ 3:2) | The switch must complete in one frame; any tween ruins the "timing change" feel |
| Sprint easing | Easing.out(poly(4)) + 40px overshoot + 6f rebound | The initial velocity must be fierce, maximising contrast with the jerky section |
| Closing | Hold 70f after landing (only a 2% extremely slow push-in), corner badge boiling frozen at f108 | Residual boiling ruins true stillness (same family as the feTurbulence matte-removal precedent) |

## Known pitfalls
- The demo was tuned with hand-made animation paper + a cel card: the parameters are a starting point, not final; re-check with real material on first real use
- The impact frames are a full-frame-level impact (counts toward R4); give only this one at the switch point per shot, and only 2f
- Single-time-manipulator-per-shot precedent: mutually exclusive with speed-ramp-freeze / hit-counter hit-stop; only one thing per shot may move the timeline
- Each step in the jerky section needs ≥30px displacement to read as "jerky" — micro-step jerkiness reads as dropped render frames; this is the card's make-or-break point; if the stride isn't enough, shorten the total duration in exchange for bigger strides
- The switch point must be labelled (corner badge "ON 3s"→"ON 1s", exposure-sheet cells, or a hit sound, sound-design §4.5) — without labelling the audience just feels "it got faster" and can't read "the timing changed"

## Reference implementation
demos/rhythm/sakuga-timing-shift/
(SakugaTimingShift.tsx)
