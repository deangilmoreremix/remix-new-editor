---
name: spotlight-sweep-moves
one_liner: Three dark-field spotlight reveal styles: A wake-sleep sweep (light arrives and it brightens, light leaves and it darkens), B edge-glow pan (purple light hugging the UI edge seeps in + spotlight moving right at constant speed), C corner constant-speed reveal (a radial spotlight expands from a corner at constant speed and lights the whole screen); UI showcases in a black field where "light is the narrative"
use_when: Introducing UI panels/feature areas one by one in dark-toned brand films; a black-field opener where the interface is "lit up" onto the stage; light transitions between sections
length: single style 3.5–4.5s; A/B can be chained into a tour section
energy: low-medium (restrained, mysterious, the burst point at the instant of "lighting up")
tags: ui-entrance, transition
---

## Intent
In a black field the viewer can only see what the light lets them see: the spotlight is lighting, camera move and edit all at once:
wherever the light goes takes the stage, and when the light leaves it bows out. The three styles share the identity element of "an edge-hugging purple glowing light line"
(the light line runs along the UI border/logo/top edge, the glow must be bright and blurry; it's light
"caressing" the interface, not a stroke animation). The make-or-break point is **constant speed**: the spotlight's movement/expansion is
strictly linear: easing gives the light "intent", only constant speed reads as a searchlight's mechanical sweep
(style C ruling: linear but with too large a final radius = saturated within the first 1/4, and it still doesn't look constant speed).

## Motion core
**A wake-sleep sweep** (glow-wake-sleep-panel): a radial reveal mask follows the light head moving left to right
at constant speed, everything outside its range fully black; the purple light line hugging the top edge with three glow layers (blur26 wide blur +
blur9 middle layer + bright core + pink offset layer) travels in sync with the sweep, tracing the logo with boxShadow
as it passes, lighting a vertical residual glow when it reaches the right edge; in the tail the light leaves and the panel sinks back into darkness: there's waking and sleeping.
**B edge-glow pan** (slide-spotlight-pan): the light line is anchored to the panel edge (first rounding the
top-left vertical edge, then after the corner running horizontally along the top edge), the purple glow bleeding into the inside of the UI's top (light seeping in from
the edge into the interface); the spotlight head moves right at constant speed revealing, while the panel slides left at constant speed = a camera pan-right feel.
**C corner constant-speed reveal** (corner-spotlight-reveal): a radial spotlight from the top-left corner expands its radius
strictly linearly; what it reaches is revealed, what it doesn't stays sunk in black, finally fully lit (light as the transition).

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Spotlight movement/expansion | linear throughout, zero easing | **Constant speed is the make-or-break point**: zero easing throughout; adding ease reads as the light having subjective intent |
| Style C final radius | Exactly covering the full screen at the end of the clip (1300@1080p/100f) | Too large a final value = early saturation, fake constant speed: sampled brightness must climb smoothly throughout (measured 8/46/101/…/238) |
| Edge light line glow | 3–4 layers (blur26 + blur9 + bright core + pink offset) | Fewer layers read as a thin stroke; the glow must be bright and blurry enough to be "light" |
| Light line anchoring | Strictly hugging the UI edge/top edge/logo | A light line floating off the edge = losing the "caressing the interface" semantics (style A rework ruling: positioning lost and the purple light ran to the bottom edge) |
| Reveal mask | radial gradient, hard edge slightly blurred (feather ~15%) | Too hard an edge looks like a circular mask; too blurry and there's no boundary between "lit/not lit" |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Division of labour with light-play-moves: that card is
  sheen play on elements/text (sheen/glow breathing); in this card light is the **camera move and edit** (reveal/bowing out/transition),
  light decides what the viewer sees
- Three-style redo ruling: the spotlight sweep must be accompanied by the edge-hugging light line (v1 had only the reveal mask and was rejected with
  "change it and let's see again": a bare spotlight has no identity, the edge-hugging purple light is this technique's signature)
- In the original film (clickup-30) the light line has a momentary rainbow chromatic aberration at the corner, not done in the demo; in real use you can
  add a 1–2f chromatic aberration layer on the corner frame to raise the texture

## Reference implementation
demos/effects/spotlight-sweep-moves/
(CornerSpotlightReveal.tsx / GlowWakeSleepPanel.tsx / SlideSpotlightPan.tsx)
Original source: clickup-30.mp4
