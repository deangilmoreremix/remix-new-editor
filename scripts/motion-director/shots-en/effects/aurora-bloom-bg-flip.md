---
name: aurora-bloom-bg-flip
one_liner: Purple-orange soft-focus blobs rise from the bottom of a light grey base, then the whole base colour darkens to near-black in about 0.36s and the blobs are pressed into an afterglow; the copy blurs out and changes line, blurring in, in sync, with a gap between lines and no cross-fade
use_when: Narrative turning points ("For many years… → everything changed"); the beat in a brand film where setup is pulled up into the accent; section switches between dark and light colour schemes
length: about 5.2s (156f@30fps)
energy: low to high (the first 2/3 is building up, the instant of darkening is the film's accent)
---

## Intent
Use "base colour inversion" as an accent mark: for the first 56% let the aurora rise slowly while the viewer adjusts to the light base,
then in under 0.4s press the whole frame down to near-black: this one move feels more like
"turning the page" than any zoom/white flash. The copy's line change must land after the inversion, with a gap in between, so the viewer first takes in the frame
change and then reads the new line.

## Motion core
- Three layers of `blur(60px)` blobs rise from the bottom of the frame: main purple `rgba(107,79,224,.85)`
  90%×85%, orange core `rgba(217,122,74,.9)`, white blending edge `rgba(255,255,255,.8)`
- Rise `seg(0.04→0.56, outCubic)`: `translateY 32%→−6%` + `scale 1→1.25`
- Inversion `flip = seg(0.57→0.64, inOutQuad)` (normalised 0.07 ≈ 0.36s):
  base colour `mix([236,236,236] → [10,10,18])`, blob opacity 1→0.4 pressed into an afterglow,
  white blending edge layer `1−flip` simply removed
- The orange core drifts slowly sideways independently `translateX ±8%` (2.2 cycles/whole film), giving relative motion inside
  the blob rather than the whole mass rising and falling
- Line A word by word `blur 0→8px` + fade out (from t 0.40, stagger 0.04, 0.10 each, inQuad);
  line B word by word `outQuint` blur-in (from t 0.70, stagger 0.05, 0.11 each); after landing, within 0.09
  the colour settles from DEEPP purple to white; finalised at t≈0.90, then still for ≈0.5s

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Blob blur/size | blur(60px), main layer 90%×85%, container inset −10% | With blur under 40px you can tell it's a circle, it becomes a "colour ball" not "light" |
| Rise | translateY 32%→−6% + scale 1→1.25, t 0.04→0.56 outCubic | Taking over half the duration is deliberate: the longer the build-up, the more weight the inversion has |
| Inversion duration | t 0.57→0.64 inOutQuad ≈ 0.36s | **Make-or-break point**: stretch it to 1s and it's not an accent but a gradual interlude |
| Base colour | #ececec → #0a0a12 (not pure black) | Pure black makes banding appear at the edges of the afterglow blobs |
| Blob darkening | opacity 1→0.4, white blending edge layer to zero in sync | Without darkening the blobs, the purple-orange overexposes into a blur in the dark field |
| Orange core drift | translateX ±8%, 2.2 cycles/whole film | At 15% amplitude you can tell it's "a ball moving" |
| Line A blur-out | Word by word stagger 0.04, 0.10 each, inQuad, blur→8px | inQuad makes the disappearance accelerate, reading as "swallowed by light" |
| Line B blur-in | Word by word stagger 0.05, 0.11 each outQuint + purple→white within 0.09 | Colour settling slightly after the entrance, turning white only at the instant of landing, is the signal of "finalised" |
| Line change gap | Line A done at t≈0.58 → line B starts 0.70 (≈0.6s with no text) | A cross-fade blurs the two lines together; only the gap reads as "turning the page" |

## Known pitfalls
- The white blending edge layer (blobC) only works on a light base; on inversion it must be removed with `1−flip`,
  otherwise a blob of grey fog remains in the dark field
- DEEPP/PURPLE are this effect's **intrinsic light colours**, not brand colour slots; to swap in project colours
  you must swap the three blob layers + line B text colour together as a set; swapping only the text colour disconnects it from the background
- The demo copy is a video-shotcraft narrative turning point ("Promos took weeks" / "Meet video-shotcraft",
  word count and word length close to the original film's "For many years" / "everything changed"); the per-word
  stagger rhythm depends on word count and word length, so when changing lines re-tune the two intervals 0.04/0.06
- Write the base colour per frame with JS `background` (`mix()` producing a solid colour), don't use a CSS transition,
  otherwise the colour is indeterminate when seeking to an arbitrary frame

## Reference implementation
demos/effects/aurora-bloom-bg-flip/
(AuroraBloomBgFlip.tsx)
