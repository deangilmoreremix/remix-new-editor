---
name: spotlight-hero-card
one_liner: In a theatre with the lights off, a tungsten spotlight (with a volumetric light shaft) sweeps across the page and locks onto one card; after an oblique side push-in the card pops up and hovers, a champagne-coloured beam runs twice around its outline, and it settles back into place together with its 3D annotation
use_when: A "single protagonist" style product opening; establishing one core object (card/item/module) as the protagonist of the whole film
length: 172f (about 5.7s; lock-on f34 → touchdown f142 → 30f of true-stillness hold)
energy: medium (the highest-quality shot, a slow and steady rhythm)
tags: effects, camera
---

## Intent
The opening says only one thing: this one card is the product's atomic unit. The spotlight guides the viewer's eye, popping up and hovering gives it volume and weight, the outline beam is a metaphor for "scanning/inspecting", and finally settling back into place says it belongs to this page.

## Motion core
- **Lights off**: the whole real page screenshot (Q1) is multiplied down to ~6–14% brightness (warm black rgba(14,12,10), preserving hue); only inside the light pool is the page its true colour;
  turning on the lights is "throwing the breaker": f1–6 brighten → flicker back to 62% → steady
- **Light pool**: multi-stop near-Gaussian falloff (transparent centre → fully dark edge, not a hard-edged ring) + a low-intensity tungsten warm-white soft-light;
  it roams through 3 intermediate stations (2–3f pause between stations, smooth in-out) and then locks onto the card's centre; the pool contracts + a 6% pulse at the instant of lock-on, and outside the pool is dimmed one more notch;
  after lock-on (f38–58, along with the push-in) the screen-space circular pool cross-fades into a **page-space card-shaped light**: under the same camera, a full-page dark layer
  (translateZ 1px, 0.94 warm black) cuts a card-shaped soft hole at the card's position (tight hole σ22 + a ring of 15% wide spill σ60); the card is higher in z than
  this dark layer, so it's fully lit edge to edge and keeps native text contrast, with falloff happening only outside the card; the soft-light warm light retreats at the same time (no bloom stacked on the card);
  a warm-white hairline rim light around the card edge + a very faint outer spill make the outline read clearly against the dark page; during the hold segment the dark layer breathes very slowly ±1.2%
- **Volumetric light shaft**: the light source is far away above the frame, offset right; a trapezoidal light shaft hits the pool (outer layer blur 28px, inner layer clip-path, soft edges),
  with a layer of deterministic floating dust inside the shaft; after the push-in the shaft fades by 45%
- The camera pushes in from a frontal full-page view to an oblique side close-up (led by a left-side camera position); the focus shifts left so the card lands right of centre in the frame, leaving the left side for the annotation; after the push-in it's locked completely
- Card rise (with overshoot) → hover sin bob → reseat (a slight press on landing + a ring of champagne-coloured landing light); the hover shadow falls to the lower left (light comes from the upper right)
- An SVG rounded-rect outline beam runs two laps: the first lap fast and bright, the second slow and weak (champagne gold + white core)
- After the card takes off, its original position is laid with a page-background-colour patch + champagne outline, which brightens and vanishes at the instant of landing
- 3D floating annotation (the hover-3d-annotation technique, C3): to the left of the card, two lines of white bold sans video-shotcraft tagline "Your product, / in motion." (34px in page space,
  ≈100px after the push-in); behind the keyword a champagne marker bar grows over 12f (the letters turn ink-coloured), and a dark backing beneath the annotation suppresses the text of neighbouring cards;
  the annotation layer uses the same camera maths as the page (camAt) and is drawn separately above the lighting layer: it is self-luminous text, not dimmed by the lights-off.
  On reseat the annotation drops back to the page plane at the same time (translateZ 92→4) and doesn't exit early; the ending is a complete poster
## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Card choice | cards[3], whose centre x is exactly 960 (page centre) | Choose the protagonist card by the "post-push-in composition" first, don't just pick one at random |
| Camera | Static full page zoom 0.8 (0–40f) → 18f push-in to zoom 2.6; rotY 34° dominant + rotX only 8°, persp 1200; focus on the card centre shifted left 105px and up 10px; locked until the end after the push-in | A sideways horizontal camera position reads better than shooting from above ("shoot from the left side, not from below", Q6); at the end, tail drifts like zoom 2.6→2.58 are forbidden; leave the breathing to the light, not the camera (R1) |
| Lights off | Outside the pool multiply 0.90→0.94 (≈6–10% brightness) | <0.8 reads as "a dimmed page", not a theatre; >0.96 neighbouring cards vanish entirely and the "inside the page" context is lost |
| Spotlight | 3 intermediate stations (4→28f), pool radius 400→300, +6% pulse on lock-on; soft-light warm white 0.24; switches to the card-shaped light after lock-on | A circular pool covering the card goes dark at both ends and blows out in the middle ("a flashlight on a page"): the protagonist card needs a card-shaped soft hole to light it edge to edge; the intermediate stations make the "random searching" believable |
| Volumetric shaft | Light source (pool.x+420, −720), shaft width 0.6× pool; screen 0.34→0.06 vertical gradient | A source too close reads as a flashlight; a shaft too wide smears together with the pool |
| Action arc | rise 10f (bezier(0.2,1.25,0.3,1) overshoot) → hover 58f (sin bob amplitude 4px period 40f, z=110px·lift) → reseat 18f, landing press 0.997 | Lock-on → landing ≈108f≈3.6s: quality shots need to "slow down to 3 seconds" (R3); first versions are almost always too fast |
| Outline beam | lap1 68→82f (strokeWidth 5+2.5 double layer), lap2 88→108f (3.5+1.75, overall opacity 0.62); strokeDasharray "0.16 1" driven by dashoffset | Two laps at different speeds read as "continuous scanning"; one lap is a blink; the beam is given only once and only to the protagonist (Q4) |
| Double-layer shadow | Offset lower left `-10·lift, 10·lift …, -36·lift 48·lift 90·lift`, growing with height | If the shadow doesn't grow with height, the hover doesn't hold up; the direction must match the light source |
## Sound
Pin a low light-clunk on the breaker-throw lights-on (f2), whoosh-big on the pop-up (f56 in this demo; pinned at f127 in the template film), sparkle on the beam scan (f68), and transition-snap on the reseat (f142): pop-up/light effect/landing each have their own dedicated sound (S2, S4).

## Known pitfalls
- A multi-card group dance in the opening can't carry the first impression (Q5): the opening was torn down and redone repeatedly before converging on a single card; draft directly from a single protagonist + a complete action arc
- In the push-in close-up the text on the card goes blurry; the root cause is the texture rasterisation resolution, not DoF; the companion technique is expanded in aesthetic guideline Q2
- Per-card glint flashes were vetoed twice ("not every card needs to flash", Q4); light effects strictly go only to the protagonist
- The dark layer for the card-shaped light must be in page space (inside PageCam, translateZ between the page and the card); a screen-space mask can't keep up with perspective and the card's lift; the card's translateZ must be at least +2px so it doesn't z-fight with the dark layer after reseat
- The right edge of the annotation's dark backing must stop before the card's left edge, otherwise it presses a dark wedge into the left side of the card face
- If the annotation is drawn inside PageCam beneath the lighting layer, the lights-off multiply dims it into gray text along with everything else: the annotation layer must be wrapped separately in the same camera and drawn above the lighting

## Reference implementation
demos/opening/spotlight-hero-card/SpotlightHeroCard.tsx (derived from the 82–220 segment of template/src/aifl/live/SceneOpen.tsx, changed to a dark-field theatre version in round two)
