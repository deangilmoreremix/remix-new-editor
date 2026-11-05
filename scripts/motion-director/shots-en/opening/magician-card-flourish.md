---
name: magician-card-flourish
one_liner: On a midnight-blue dark field a blue starburst flashes for 0.3s (X-shaped needle beams rotating 90° + a central glow radiating small rays), and a card is ejected from the flash point: spinning at high speed it flies toward the lens on an arc, the spin decays as it approaches, it hard-freezes instantly (card height 86% of frame height), a light pulse + sheen sweep, then the copy on the right is revealed line by line
use_when: A magical entrance for a single card/poster/cover (title key visual, product card reveal); pure black dark field; bursts that need the ceremony of "conjuring it up"
length: 156f (flash 0.3s + flight 1.6s + freeze/sheen/copy reveal + hold 3.3s; whole segment 5.2s)
energy: high (a one-off burst, still immediately after the freeze)
tags: ui-entrance, effects
---

## Intent
A magician flicking a card: a blue starburst flashes past, and the card seems to be conjured out of the light: from extremely far away at the
centre of the frame (visually a tiny dot) it is ejected, spins at high speed along an arc toward the lens,
and the instant it reaches the centre it hard-freezes into a near-full-frame display. Three make-or-break points for the magic feel: **the flash leads**
(light is the ceremony of "conjuring", 0.3s short and crisp), **the ejection rhythm** (slow wind-up at take-off →
sharp acceleration kicking it out → decelerating arrival along the arc, slow-in→burst→decelerating arc),
**freeze means still** (no deceleration tail, no rebound; 13 full revolutions of spin guarantee the freeze lands exactly face-on).

## Motion core
- Opening starburst (the final form converged on round by round from the user's reference image IMG_2505):
  - X-shaped **diagonal** needle beams (starting at -38°/52°); during the flash the whole thing **dynamically rotates
    90°** (easeInOut); long axis 840 / short axis 420 (ratio 2:1)
  - Beams in pure saturated blue (#3f9bff→#2277f2 along the full length, the white section only the 5% at the root),
    three layers per axis: wide blurry glow envelope + bright main beam + overexposed thin core
  - The centre is **not a white ball**: a tiny bright dot (26px) + blue glow halo (140px) + a ring of
    10 alternating long and short radiating spikes (slowly turning opposite to the starburst)
  - Rhythm: brightens over 2.5f → slight flicker → collapses, done in 9f (0.3s)
- Ejection flight: flash point = landing point (left 1/3 of the frame, cx=700), departing from extremely far (scale≈0.11),
  true perspective scale=F/(F+z) (z 14000→0); travel curve slow-in (first 14% of the time covers 6%)
  → slope jump ejection → easeOut(cubic) deceleration; a single sine arch swings out to the upper right (passing where
  the copy will later be) and then returns to the landing point; in flight the card carries a ring of blue glow, dragged into a light trail by motion blur
- Spin: 13 full revolutions about the card's diagonal axis; the first 40% of travel is near-constant and extremely fast, for the last 60%
  angular velocity decays by a power of 2.4 (the closer to the lens the slower it turns); the whole-revolution count guarantees freezing face-on
- Freeze: at f=57 (TAKEOFF+48) everything freezes, card height ≈86% of frame height; at the instant of landing a ring of
  blue light pulse in the same shape as the card expands outward from the card edge and fades (22f), and the backlight behind the card and the stage key light come up together (during the flash the stage is dimmed
  so the starburst is the only light source)
- Sheen: 8f after the freeze settles, a diagonal sheen band sweeps left→right once (screen blend, clipped to the rounded corners)
- Card face: a dark navy video-shotcraft "Launch Film" premiere ticket: brand row (logo + lowercase wordmark), the central
  video-shotcraft logo resting on concentric thin rings + crossed needle lines (the opening starburst "stays on the card"; the rings and needle lines start from the logo's outer edge
  and don't pass through the viewfinder opening), a 58px large title (≈100px after the freeze), a mono ticket-stub row; in the emblem area a layer of
  holographic foil sits beneath the logo, its hue rolling with the spin angle (shimmering in flight, frozen at the freeze); the centre of the card back is also the logo
- Copy on the right (after the freeze): eyebrow NOW SHOWING with letterspacing tightening at 63f → 132px title "Craft / the shot." two lines rising at 67/74f →
  36px subtext "Cinematic product videos, crafted by your agent." word by word at 86f
- The card is laid out at its freeze size (×1.72) and rasterised with CSS zoom, flight only scales down: text is sharp in the freeze frame (Q2)

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Flash duration | 9f (0.3s, a precise value set by the user; shortened round by round from 1.5s→0.8s→0.5s) | The light is ceremony, not the protagonist; >15f steals the card's scene |
| Starburst rotation | Rotates dynamically 90° during the flash (ruling: a static angled pose was rejected with "didn't see any rotation") | The rotation must be visible frame by frame; >120° reads as a propeller |
| Beam colour | Pure saturated blue along the full length | A white section too long/decay too fast was rejected as "not faithful enough"; a grayish cyan-blue was rejected with "it should be blue" |
| Centre | Small bright dot + glow + radiating short spikes | **A white ball was rejected**: the centre is an optical glow, not a solid ball |
| Ejection curve | slow-in 14% → burst → decelerating arc | Straight constant speed / pure easeOut has no wound-up "ejection" feel |
| Spin decay | Power-of-2.4 deceleration over the last 60% of travel | Constant to the end was rejected with "it should decay with distance as it approaches the lens"; the whole-revolution count = the guarantee of freezing face-on |
| Freeze size | Card height 86% of frame height (the right side is left for the copy) | The first version at 1.0x was rejected with "closer and bigger, basically touching the top and bottom edges"; for a single centred card without copy it can go back to 94% |
| Hard freeze | Full freeze with zero rebound | Magic feel = instant stillness; a rebound reads as a physical toy |

## Known pitfalls
- Tuned on grayscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- **The light-effect quality ruling chain** (a global methodology this card contributed): geometric colour blocks were rejected as "cheap
  effects" → redone with optical realism → game-like + realistic → the user provided a reference image and it converged in one round.
  Feedback on quality loses a lot in words, so **proactively ask the user for a reference image**
- Engineering pitfall: the thin needle beams **must not go inside CameraMotionBlur**: the blur sampling breaks the rotation
  into striped duplicates (a hidden source of the "cheap feel"); render the flash layer independently of motion blur
- Engineering pitfall: the starburst SVG viewBox must be ≥ beam length + rotation sweep radius, otherwise the endpoints
  get clipped into straight edges
- Division of labour with card-flip-reveal/deck-deal-flyin: those two cards are multi-card rhythm scenes of flipping/dealing cards;
  this card is the magic ceremony of "conjuring up" a single card, conjuring only one at a time

## Reference implementation
demos/opening/magician-card-flourish/
(MagicianCardFlourish.tsx)
Source footage: none (custom-made from the user's verbal description, converged over multiple iterations)
