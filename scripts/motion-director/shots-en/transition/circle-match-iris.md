---
name: circle-match-iris
one_liner: Centre-matched iris cut: the iris bursts open from the centre of a circular element on the page, and the circular chart of the new page inside the iris connects onto the same circle; the match cut gives the iris a semantic anchor
use_when: Seams where the foreground has a circular element (avatar/icon/round button) and the background has a circular subject (donut chart/progress ring); transition technique card
length: 5.5s / 165f (entrance + focus 40f + wind-up 7f + circle connect and iris open 37f + sweep 58f + still 47f)
energy: medium-high
---

## Intent
An ordinary iris (the original glossary entry) opens from any point, and the viewer only reads "the page changed".
This card welds it to match-cut: the iris must burst open from the centre of a **real circular element** in the foreground,
and the new page growing inside the iris has a circular chart that connects exactly onto the same circle: what the viewer sees
is "the avatar's circle became the chart's circle", and the circle itself carries the narrative (this person → this person's data).
This is how match-cut lands in a UI context: not relying on a compositional coincidence, but on a semantic circle-to-circle.
Like the three travel styles, it belongs to "the background is present in the foreground beforehand", but the anchor is an abstract shape rather than a container.

## Motion core
- **The two scenes' circles being strictly concentric is the make-or-break point**: the anchor centre is hard-coded as a set of constants (demo: CX=540,
  CY=540, = leaderboard row's left edge + padding + rank column + avatar radius); the avatar, ripples,
  clip-path circle, the new scene's ring and the dial all reference the same set of constants; computing coordinates separately inevitably puts them off-centre
- Focus guidance: the other rows are pressed down to ~32% brightness, the anchor's row is brightened; the avatar does two enlargement pulses +
  two spreading light rings (18f / 30f); the camera slowly pushes in 3% with the anchor as transform-origin
  (the anchor doesn't move on screen); at 40–47f the avatar shrinks to 0.9 as anticipation
- **Circle connect = solid circle hollowed into a ring**: at the instant the iris opens, the new scene ring's stroke width = its diameter (so it looks
  exactly like the solid avatar); within 28f the radius goes 36→300 and the stroke shrinks to 44px (expo-out),
  the colour retreating from fluorescent solid to a dark track; iris radius = ring outer edge + an ease-in accelerating outward expansion
  (adding 2400px over 54–84f), so it's "the ring prying the iris open": the circle connect necessarily happens before the screen is filled
- At the same time the old page enlarges 1.03→1.22 centred on the anchor and darkens (ease-in); the iris's outer edge has a drop shadow ring +
  a fluorescent lit ring that appears only in the early stage of the opening: the new scene "presses" on top of the old page
- Ring sweep: strokeDasharray = sweep×circumference, rotate(-90) starting the stroke from the top,
  60–118f slow start, long tail to 87%; the central 200px number counts up in sync with the sweep, and a soft glow on the arc head follows the pen tip

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Anchor pulses | 2× scale 1→1.16 + two light rings spreading (starting at 18f / 30f, 22f each) | Without focus guidance, the viewer can't find the centre at the instant the iris opens |
| Circle connect | Solid disc → ring: r 36→300, stroke 72→44px / 28f expo-out | If the ring and iris grow independently, "the avatar becomes the chart" can't be read |
| Iris expansion | Ring outer edge + 0→2400px / 30f bezier(.62,0,.32,1) | Faster than 20f and the circle connect can't be read; centre offset >10px gives it away at a glance |
| Old page pushed back | scale 1.03→1.22 + brightness 1→0.45 / 34f ease-in | If the old page doesn't move, the new scene looks like a round sticker stuck on top |
| sweep | to 87% over 60–118f, bezier(.4,0,.12,1), number counts in sync | Number and sweep out of sync read as two animations; too fast (<40f) and you can't read the number climbing |
| Ending | Still for 47f after the sweep finishes (only the dial's 0.06°/f slow rotation + arc glow breathing remain) | R1 |

## Known pitfalls
- The demo is a hand-built video-shotcraft weekly output leaderboard (dark field fluorescent green; scene A creator ranking → scene B this week's output goal ring): the parameters are a starting point, not final;
  re-check with real material on first real use
- On real material, measure the anchor coordinates from the screenshot (devtools/ruler); what you measure is the element box, not
  the visual centre: for an avatar with padding take the content circle's centre; after measuring, render a frame and if it doesn't line up adjust the constants,
  don't trust the first measurement (same as the counter-centre ruling for the A-counter travel in transition-travel)
- The foreground anchor must be a **true circle**: with a rounded square (border-radius < 50%) as the anchor,
  the square/circle mismatch at the instant the iris opens is obviously fake; when the anchor in a real screenshot is a rounded square, first cover it with a same-colour patch and then overlay a true circle
- The semantics must be paired: avatar → personal data, product icon → product metric; circle to circle is only the shape,
  "the content of this circle becomes its expansion" is the reason the match cut works
- The one-seam-one-style rule is the same as shot-transitions; this card has its own chart growth section, so don't layer
  an extra entrance effect on the new scene inside the iris

## Reference implementation
demos/transition/circle-match-iris/
(CircleMatchIris.tsx)
