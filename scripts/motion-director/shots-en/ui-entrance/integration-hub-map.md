---
name: integration-hub-map
one_liner: The old page does one quick 180° flip (its side edge flashing for an instant) and lands as a new hub page; five integration app icons pop in on the same frame, then immediately five rainbow light pipes connect on the same frame, with transport pulses flowing continuously inside the pipes — "turn to a new page, and the whole ecosystem plugs in at once"
use_when: Integration / ecosystem capability passages (one product connects everything); version-renewal narratives (the old page turns into a new page); the feature climax in a dark-field neon tone
length: wind-up ~0.5s + quick flip ~1.2s + icons appear together → pipes connect together, two beats ~0.7s + transport breathing ≥1.5s; whole section 4.5–5s
energy: medium-high (the flip is the burst, the transport section is the afterglow)
tags: effects
---

## Intent
The flip means "a new era": the whole old document page flips 180° to reveal the new hub page — it must be
a complete flip, not a turn by some angle (precedent); the flip motion is a **quick flip + slowing at the tail**, done in one breath
with no segmented pauses (the "constant speed" precedent: when the user said constant speed they meant no pauses, not literally
linear; a version pausing on the side edge at 90° was rejected). At the side-edge moment it only "flashes once" (a 1–3f pulse;
a long glow plateau was rejected). Plugging in is **two beats**: the five icons pop in on the same frame (beat one) → the
five pipes start drawing and connect on the same frame (beat two) — only all together does it read as "the ecosystem is in place at once"; staggered
one-by-one connection reads as negotiating one at a time (rejected twice). Once connected, bright pulses inside the pipes keep cycling in the icon → hub
direction; the "sense of transport" is the life of the end state.

## Motion core
- Flip: rotateY 0→180°, 35f, Easing.out(cubic) (80% of the angle in the first 41% of the time,
  a long deceleration at the tail for a gentle landing), double-sided card (front old page / back new page)
- Side-edge flash: at the ~90° moment a 2f pulse bloom (0→1→0.25→0, back to zero within 4f)
- Two-beat plug-in: five icons tIcon pop in on the same frame (flip settles +3f); +10f the five pipes
  tPipe start drawing on the same frame, fully grown and lit together in 9f
- Transport pulses: bright dash spots in the pipes cycle in the icon → hub direction (speed ~4.6px/f,
  phases staggered per pipe); once fully connected the hub page breathes gently
- Background: dark purple noise + neon rectangles emerging to set the scene

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Flip duration | 35f (70f was once rejected: "make it 2× faster") | <24f doesn't read as double-sided; tail deceleration ratio ~60% of the time for 20% of the angle |
| Flip curve | ease-out, monotone with no pauses | Side-edge pause / segmentation was rejected; strict linear with stiff start and stop was also rejected — fast flip, gentle tail |
| Side-edge flash | 2f pulse, back to zero in 4f | A long glow plateau was rejected: "just flash once" |
| Plug-in rhythm | Two beats: icons on the same frame → +10f pipes on the same frame | Staggered one-by-one connection was rejected twice: "appear at the same time, then connect at the same time"; an interval <6f between the beats reads as one beat |
| Pipe growth | 9f, all together | The 18f version was slow; pipes differ in length but arrive on the same frame (normalised by each one's len) |
| Transport pulses | ~4.6px/f cycling, phases staggered | Static connecting lines = no "feeling of transport" (precedent); in-phase pulses read as blinking |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- The timing precedent chain is fully on record: staggered connection ×2 rejected → pipes together with staggered icons rejected →
  two-beat passed. "Simultaneous" is this card's rhythmic identity
- Division of labour with glow-flyline-moves: that card is about the light effect of the fly-lines themselves; this card is
  the narrative structure of flip + two-beat plug-in + transport, and the light pipes are just an element
- Division of labour with canvas-materialize-moves: that card is about canvas elements materialising; this card's
  core is the generational meaning of "the old page turns into a new page"
- Double-sided card implementation: horizontal/vertical lines with bbox=0 make SVG filters/gradients fail (precedent of three pipes
  disappearing); define the pipe gradients with userSpaceOnUse, independently for each pipe

## Reference implementation
demos/ui-entrance/integration-hub-map/
(IntegrationHubMap.tsx)
Source footage: clickup-30.mp4
