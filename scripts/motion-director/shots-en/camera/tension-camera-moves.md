---
name: tension-camera-moves
one_liner: Two emotional camera-move variants — bullet-time freeze orbit and pull-back isolation; the camera "feels" on the viewer's behalf rather than just "looks"
use_when: Camera language for emotional beats (awe/closure); complements space-camera-moves' "showpiece big moves" — these two variants have small motions and heavy emotion
length: 5–6s per variant (150–170f); ≤2 variants in total per video (each ≤1 time)
energy: A high / B low, winding down
---

## Intent
The three space-camera-moves variants are highlight showpieces that "shoot the page as a 3D object"; these two variants are the opposite —
the motion itself is restrained, and all the force is in the emotional meaning: A says "this moment is worth stopping time to look at"
(elements in motion are frozen while the camera circles to examine them); B says "in the end only this one thing remains"
(as the camera pulls back the surroundings go dark layer by layer, and a single point hangs alone to close the whole video). Each variant occupies one emotional slot,
and they are the direct vocabulary at the storyboard stage for "what should the viewer feel in this section".

## Choosing between the two variants
| Variant | Approach | Use when |
|----|------|------|
| A bullet-time-freeze-orbit (freeze orbit) | The chart freezes halfway through its growth together with the sparks spraying from the bar tops (sparks hang in mid-air, trails kept); in a true 3D scene the camera sweeps rotateY 52° around the panel and back, then time resumes and it finishes growing | The crowning moment for core data/charts; the one shot "worth stopping the clock for" |
| B pull-back-isolation (pull back and isolate) | Pulling back from a close-up of the glowing main card, 8 sibling cards go dark with staggered overlap by distance, the background sinks to black, and the lone card hangs in the centre of the dark field | Closing; the curtain call for "the whole video was for this one number" |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A dual clock | Content animation runs on `eff` (integral of a speed ramp: 8f smooth braking → 52f freeze → 8f resume), the camera runs on real f | Make-or-break point: during the freeze the content must be visibly, completely still while the camera moves — each clock minds its own business; a hard stop/hard start has none of bullet time's speed-ramp feel |
| A orbit | preserve-3d scene with perspective 1800 (panel / sparks with z depth / grid floor / distant dot wall): rotateY 0→-52° (26f smooth) → slow drift at the apex 12f → back to 0 (22f swift), with rotateX raised 6° and a 160px push-in in sync | 50–55° is the minimum for "going around to look from the side"; >70° the panel turns paper-thin and gives it away; without depth references (single panel + flat colour background) it doesn't read as the camera orbiting |
| A frozen motion | Spark trail length and counter roll blur are all computed from the content clock's speed | While frozen they keep their "in motion" form — what's frozen is an instant, not a still life |
| B pull-back | scale 2.2→0.62 / 110f Easing.out(cubic), origin locked to the main card centre, laid out with 2.2× CSS zoom and then scaled down | For the first 20f the main card still fills the frame, so opening on the close-up needs no extra hold; close-up text enlarged with transform will be blurry (Q2) |
| B going dark | Sibling cards sorted by hypot distance, one every 8f starting at frame 30, within 16f opacity→0 (EASE.out) + brightness→0.3 + 5px defocus + sink to 0.97; background crossfades 60–110f from a bright soft-light base into a deep field with hue | Going dark from near to far = "the world collapsing into darkness outward"; going dark out of order reads as a glitch |
| B halo | Two layers of cool-white box-shadow on the main card fade in 60–100f, with the lit top edge emerging in sync | The halo is the visual testimony of "only it remains"; it only works in sync with the sink to black |
| Ending | After either variant's action, hold ≥30f (A keeps only a very slow breathing of the light; B is truly still 110–150f) | R1; variant B is the full stop of the whole video — give stillness a full 40f+, and a closing line can be added in screen space |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Variant A, speed-ramp-freeze and impact-feedback are all time manipulation; don't stack them in the same shot
  (the frame remaps fight each other); A's freeze is "stopping for you to look" + camera movement, speed-ramp-freeze's
  freeze frame is "stopping to annotate" — choose by meaning, not by look-alike form
- When variant B is at the end, following it with outro-group-photo-launch will clash (one closes, the other opens); pick one

## Reference implementation
demos/camera/tension-camera-moves/
(BulletTimeFreezeOrbit.tsx / PullBackIsolation.tsx)
