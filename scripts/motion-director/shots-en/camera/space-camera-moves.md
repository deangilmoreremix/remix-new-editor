---
name: space-camera-moves
one_liner: Two 3D spatial camera-move variants — exploded-view (components blow apart along Z and then reassemble) and drone-dive-landing (a drone-style dive and landing)
use_when: Highlight sections that shoot a flat page as a 3D object; both variants are "big moves", ≤2 in total per video
length: A 170f (5.7s, the full run of explode-hover-reassemble-closing title); C 105f (3.5s, dive 69f + landing hold 36f), a one-way dive
energy: high
---

## Intent
The depth-layer card adds depth to a pan — the layers move, but the page is still a page. These two variants go further:
the whole page is treated as a 3D object, and the camera (or the world) performs live-action-grade manoeuvres around it. The two variants each own one
narrative meaning: A says "look at what it's made of" (teardown display, Apple keynote-film language);
C says "slam from the global overview onto the hero" (a god's-eye view diving straight into the hero close-up, wide → focus).

## Choosing between the two variants

| Variant | Approach | Use in sections |
|----|------|----------|
| A exploded-view | The whole page lies flat in 3/4 axonometric; components blow apart along the page normal with staggered overlap and hover (with numbered annotations), then after a beat reassemble in reverse order and close with a hammer-landing | Architecture/composition showcase: "what's inside this product"; module overview section |
| C drone-dive-landing | Hovering at a near-vertical overhead angle → a hard plunging dive → air-cushion deceleration stopping on the hero card close-up | Opening establishing shot → into the topic; chapter starts that slam from a global map into a single point |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A spatial base | perspective 2400 + `translate·scale·rotateX(54°)·rotateZ(−34°)` axonometric + preserve-3d; on explode the camera pulls out 0.56→0.47 and moves down to leave frame room for the layer stack; during the hover it orbits rotateZ +10° and the tilt angle closes by 4° | A slight front-on tilt (18°/−12°) only reads as "floating up"; lying flat in axonometric is what looks like an exploded diagram; the hover orbit lets inter-layer parallax read as depth |
| A explode | 5 layers translateZ 150/270/400/520/640, spring (damping 15, stiffness 120) staggered by 5f | Layers further toward the far end (top) of the page must go higher, otherwise lower layers block the layers above once they rise; identical depths read as the whole page floating up |
| A reassemble | Annotations withdraw first (ease-in 8f), layers reverse in order with ease-in 14f, staggered 3f; on the seating frame the whole group sinks 8px with a damped rebound + the tabletop contact shadow tightens, followed by a light sweep across the whole page | The hammer-landing is required — without it the reassembly reads as a limp fade-in; but no screen shake (Q3): the sink-and-rebound + shadow tightening also give the "click" |
| A depth anchors | Each layer's shadow cast on the base plate moves down and becomes softer and fainter with height + a thickness edge behind each layer + the base plate reveals dashed component slots | With any of the three cues missing the inter-layer relationship gets muddy |
| A annotations | Anchor = the 3D projection of the midpoint of the layer's outer edge (hand-computed with the same matrix as the CSS), two columns left and right, horizontal leader lines with one bend just before the column; title 44px + caption 30px, line draws on 8f + rise 12f, staggered 6f | Leader lines drawn from the middle of a layer cut across other layers; annotation text <32px is unreadable |
| C travel | One p drives rotateX 72°→0 + scale 0.42→1.35 + translate convergence; origin pinned to the hero card centre (e.g. 518,335); the page is laid out at the end magnification of 1.35 + CSS zoom rasterisation and then scaled back, so close-up text isn't blurry | One p = one camera making one manoeuvre; driving them separately reads as three animations fighting |
| C speed curve | 0–24f god's-eye establishing + lift-up anticipation (travel backs off 2.5%) → main dive 25f Easing.in(cubic) covering 82% of the travel → air cushion 20f Easing.out(poly(5)) covering 18% → landing hold 36f | The sudden velocity drop at the switch frame = the feel of the air cushion catching it; the 82/18 ratio matters more than the frame counts |
| C atmosphere | The scene is wrapped in CameraMotionBlur(shutterAngle 220, samples 12), with background and grain kept outside the blur; the page hovers above a dotted ground in the same 3D world (starting lift 150), and during the dive the dot grid rushes toward the lens; the matching-shape ground contact shadow tightens and solidifies as it descends, fading to 0 just before touchdown; after landing a light darkening ring around the hero tightens focus | The soft shadow sells the "hover height"; blur sells speed — missing either dimension looks fake; large gradients put through multi-sampling quantise into colour rings, so keep the background outside the blur |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Both variants depend on layered real screenshots/high-resolution textures: A needs the page captured as separate screenshots per component (top bar/sidebar/
  cards each as their own image; a single whole-page image can't be blown apart); C ends on a close-up, so process the assets first with
  aesthetic guideline Q2's high-resolution rasterisation technique
- Easy mistake in C: Remotion has no Easing.quint; write Easing.poly(5) (a trap hit while rendering this batch)
- In A the component layout must be absolutely positioned to replicate the original page grid (5 layers in the demo: sidebar/chart/assistant/metrics/command bar);
  flow layout can't do per-component translateZ

## Reference implementation
demos/camera/space-camera-moves/
(DroneDiveLanding.tsx / ExplodedView.tsx)
