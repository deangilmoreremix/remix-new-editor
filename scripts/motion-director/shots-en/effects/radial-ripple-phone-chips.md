---
name: radial-ripple-phone-chips
one_liner: Four layers of concentric circles on a warm sand base breathe out of phase like water ripples, the feed inside the central phone mockup's screen scrolls slowly on its own, and white chips on both sides spring-pop in one after the other and float
use_when: The "this is it" hold shot for mobile products; introduction sections with feature points arranged on both sides; product panoramas for openers/closers
length: about 5.6s (168f@30fps)
energy: low (quiet, breathing, kept from going dead by the concentric circles' continuous rise and fall)
---

## Intent
Use the fewest moves to put the phone at dead centre and make it "alive": the concentric circles handle the atmospheric breathing,
the in-screen auto-scroll proves "there's content running inside", and the chips on both sides call out the feature names.
Each of the three layers of motion is extremely slow, and only stacked together do they avoid looking static: this is the standard recipe for a product hold shot.

## Motion core
- demo frame (look = sand, the phone shows video-shotcraft's shot library feed): laid out at native 1080p size (not scaled up through DesignStage),
  phone 430×900 taking 83% of frame height; at bottom left the Frame Chisel logo mark + video-shotcraft wordmark rise after both chips have settled, ending on a product poster
- 4 layers of concentric circles (2240/1760/1280/840px, #dccbb4→#f2eadf from dark to light, the two outermost going out of frame to fill it), each
  `scale 1 ± 0.06`, running 1.5 sine cycles over the whole film, with a 1.7 rad phase difference between adjacent layers
  : the phase offset is the key to "water ripples" rather than "whole-thing scaling"; each layer has a lit top edge + white hairline outer rim, and a warm white soft glow at the centre holds up the phone
- Phone: warm titanium metal frame 12px + black bezel 9px, 70px rounded corners, Dynamic Island/side buttons/glass diagonal reflection, two layers of contact shadow;
  at 0–26f it rises from 90px below with snappy, the shadow tightening as it lands
- Inside the screen a feed designed for the shot: big title + featured big card + 8 episode cards (geometric illustration cover / title / duration · show / listening progress),
  a mini player bar always on at the bottom (progress advancing at constant speed, waveform hopping lightly and deterministically), with a fade of screen base colour under the status bar and the player bar
- feed `translateY 0→−560px`, window `t 0.08→0.98` **constant speed, no easing**
- chip pop: `springAt(t0, damping 13, stiffness 190)` drives scale 0.8→1 (one visible overshoot),
  at the same time moving 28px outward from the phone's side with snappy, opacity jumping to full in 5f; left chip from 37f, right chip from 67f
- After the pop, a `sin` float ±8px (2 cycles/whole film), phased in smoothly over 24f starting 18f after the pop
  : it doesn't start drifting the moment it lands

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Concentric circle layers/size | 4 layers 2240/1760/1280/840px (1080p) | 3 layers don't fill the frame; the outermost must go out of frame, otherwise it reads as a round colour swatch |
| Breathing amplitude | scale 1±0.06, 1.5 cycles/whole film | 0.06 is already the upper limit; at 0.1 it reads as a "pulse animation" rather than water ripples |
| Phase difference | Adjacent layers 1.7 rad | All phases equal = the whole block scaling up and down; only a 1.7 difference gives the illusion of waves rippling out from the centre |
| Phone shadow | Close contact shadow 0 4px 10px + far shadow 0 40px 80px -20px + ambient shadow 0 90px 140px -40px (sand.shadow with hue) | The shadow is the only evidence of the phone "floating on the waves"; remove it and it goes flat |
| Auto-scroll | translateY 0→−560px, t 0.08→0.98 constant speed | Add ease and it instantly reads as "someone swiping"; only constant speed is autoplay |
| chip pop | spring damping 13 / stiffness 190, scale 0.8→1, moving out 28px | The amount of overshoot is the whole texture of "popping out"; damping >20 and it goes flat |
| chip timing | Left 37f / right 67f (1s apart) | Appearing at the same time reads as two labels; only staggering gives the rhythm of "saying them one by one" |
| chip float | ±8px, 2 cycles, phased in over 24f from 18f after the pop | Amplitude over ~12px competes with the concentric circles' breathing |
| chip type size | 36px / weight 600 + 60px accent-colour icon circle | At 1080p chips are text to be read; don't go back to 12–20px sticker sizes |

## Known pitfalls
- chips are positioned against the phone's outer edge with `right: 1920 − PX + CHIP_GAP` / `left: PX + PW + CHIP_GAP`;
  after changing the phone width PW the chips on both sides follow automatically, but confirm the outer edge of long-copy chips is still within the 96px safe margin
- The in-screen feed is placeholder content of fake entries; when swapping in real screenshots in real use the total height must
  exceed "560px + screen height", otherwise it scrolls to the bottom and shows white
- The phone screen is only ~390px wide: keep episode card titles to ~18 characters and metadata `nowrap + ellipsis`, otherwise line wrapping stretches the cards taller
- The concentric circles are solid colours stacked (not stroked rings); the layer order must be appended from largest to smallest,
  get the order backwards and you only see the largest layer
- ACCENT (the default sand's terracotta #c4552d) applies to the in-screen covers/progress bars/play button and the chip icons;
  to switch to the project's brand colour, change only this one variable to reskin

## Reference implementation
demos/effects/radial-ripple-phone-chips/
(RadialRipplePhoneChips.tsx)
