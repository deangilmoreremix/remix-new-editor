---
name: steep-tilt-glide
one_liner: With a locked-off camera, an upright page stands sideways at a strong 60° perspective (right near, left far), and the page itself slides along its own 3D horizontal plane past the lens (the subject moves, the camera doesn't); the slide carries speed ghosting, text components drop from mid-air, and it reveals from dark to bright
use_when: Showpiece tours of long pages/multi-section UIs (content slides past a fixed camera position in sequence); dark-field neon tone; a "side-skim" camera position complementing the surface-grazing camera card
length: 4s (120f) single shot; the wider the page, the longer it can run
energy: medium-high (perspective showpiece + continuous motion, but the rhythm is even)
tags: ui-entrance
---

## Intent
Stand the page up as a slanted wall: the camera is locked dead still, the strong 60° perspective puts the right edge right in your face and the left edge
vanishing into the vanishing point, and the page itself slides horizontally along its own plane — the content passes by
in sequence like train carriages. The make-or-break point is **the subject moves, the camera doesn't**: perspective/origin/rotY are constant throughout, and the
only moving quantity is the page's local translateX — as soon as the camera moves, the meaning becomes a camera-move showpiece,
whereas the drama here is "the page presenting itself". The angle converged to exactly 60° over three rounds
(-45° "not right" → -53° "a bit more" → -60° chosen).

## Motion core
- Camera constants: perspective 1100, origin 30% 58%, rotateY(-60°)+
  rotateZ(-2°), transformOrigin left top; not one number changes throughout
- Page: an extra-wide panel (6200×2400 @ content coordinates), sliding along the local X axis +60→-4100,
  bezier(0.3,0.12,0.72,0.9) — a gentle start and then near-constant speed, with the tail slope
  not going to zero (no settling to a dead stop)
- Speed ghosting: the trail layers = re-projections of the local position at past moments (three layers at f-1.6/-3.2/-4.8, decreasing weight),
  with opacity ∝ slide speed (denser ghosting when fast)
- Mid-air landing: page elements in FloatWrap float 230–280px up with matching-shape soft shadows, and land
  with staggered overlap as the slide progresses (tour grammar)
- Reveal to bright: the panel starts darkened to 0.7 and is revealed to full brightness over ~1.4s; an extra gradient shadow on the left edge recedes along with it

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Tilt angle | rotateY **-60°** (value set precisely by the user) | -45° was rejected as "wrong angle", -53° "a bit more"; beyond -70° the content becomes unreadable |
| Motion model | Camera fully constant, page moves itself | **Make-or-break point** — the camera-panning version was rejected: "the camera is fixed; the page itself moves along the horizontal direction of its 3D space" |
| Slide curve | bezier whose tail slope doesn't go to zero | Stopping dead mid-way was caught (v4 rework); fully linear loses the breath at the start |
| Ghosting | opacity ∝ speed, three layers f-1.6/-3.2/-4.8 | Constant ghosting reads as a double-image glitch |
| Page width | ≥3 screens of content | Too narrow and the slide is over in two seconds, not enough to carry a shot |
| Mid-air landing | staggered overlap (tour grammar) + shadow following height | For the semantic ruling see the three-card family graze-face-tour/orbit-drop |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Angle ruling: the perspective angle is this card's identity; for fine-tuning in real use a range of 55–65° is recommended — going outside that
  range amounts to a different technique
- Division of labour with graze-face-tour: there the camera moves (surface-grazing roam) and the page is still; in this card the
  camera is still and the page moves. Pick one per section
- Hand-drawing an extra-wide page is costly; in real use a real long screenshot can be used instead (the slide logic is unchanged)

## Reference implementation
demos/camera/steep-tilt-glide/
(SteepTiltGlide.tsx)
Original footage source: clickup-30.mp4
