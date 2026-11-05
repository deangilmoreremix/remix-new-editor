---
name: picker-carousel-feature-cycle
one_liner: A mobile-style vertical picker: the focus pill stays still and the content passes through it, each item snaps in with a clear outQuint deceleration and then comes to a complete stop, opacity/font size/gray level are layered by distance from the centre, and on landing the pill does a very light scaleY breath
use_when: List shots that read out feature names/scenario names one by one; interaction demos of "pick one"; showcasing picker-type controls in mobile products
length: about 3.6s (108f@30fps)
energy: medium (each snap is a beat; 5 beats advancing at an even pace)
---

## Intent
Make the physicality of "choosing" tangible: the focus frame is fixed, and it's the content that scrolls and gets snapped in.
After each item stops it must **be genuinely still for a few frames**: continuous scrolling reads as a loading animation; only the pause reads as
"this item has been selected". Distance falloff (opacity + font size + gray level, three channels falling off together) is the only means of keeping
the viewer's eye locked on the middle row the whole time.

## Motion core
- Viewport 300×170px (5 rows × rowH 34), the focus pill fixed at the 3rd row position
  (`top: rowH*2`), white background + 1px `#E3E3E6` outline + `0 2px 8px rgba(0,0,0,.06)`
- The whole run `t 0.05→0.95` is cut evenly into STEPS=5 steps; displacement within a step is
  `outQuint(min(1, local/(1−HOLD)))`, with the tail segment of HOLD=5/14 completely still
  (each step ≈0.65s = moving ≈0.42s + still ≈0.23s)
- The whole list is `translateY(rowH*2 − pos*rowH)`: it's the content that moves, the pill has zero displacement
- Distance falloff (`d = |i − pos|`) in three segments: opacity 1→0.55 when `d≤1`,
  0.55→0.18 when `1<d≤2`; fontSize 17→14px (by `d/2`);
  color uses INK when `d<0.5`, MID when `d<1.5`, and `#B9B9BE` further out
- In-row icon opacity `max(0, 1 − d*1.6)`: only the focus row's icon is visible
- After landing the pill breathes once with `scaleY 1 + sin(min(1, land/0.6)·π)*0.06`
  (`land` is >0 only within the HOLD segment, i.e. it only breathes once the snap is complete)
- An alpha fade mask over 26% at the top and bottom of the viewport (`mask-image` transparent→opaque), so items entering and leaving fade naturally

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Row height/visible rows | rowH 34px × 5 rows, focus on the 3rd row | The number of visible rows must be odd, otherwise the focus row isn't in the visual centre |
| Steps | STEPS=5, window t 0.05→0.95 even | 5 beats is the comfortable limit for 3.6s; with 7 beats each is squeezed to 0.46s and can't be read |
| HOLD | 5/14 ≈ 0.357 (the tail of each step is still ≈0.23s) | **Make-or-break point**: set HOLD to zero and it becomes constant scrolling, losing the "snap" meaning entirely |
| Snap easing | outQuint (applied to local/(1−HOLD)) | outQuint's sharp deceleration is the feel of "being caught by a magnet"; outCubic is too soft |
| opacity falloff | 1 → 0.55 (d≤1) → 0.18 (d≤2) | Keeping adjacent rows at 0.55 lets the viewer sense "there's more content above and below"; drop to 0.3 and it's isolated |
| fontSize falloff | 17→14px, by min(1, d/2) | The font-size difference is a second layer of depth; opacity alone looks flat |
| Icon visibility | max(0, 1 − d·1.6) | Only the focus row carries an icon, an extra marker of "the current item" |
| Pill breath | scaleY 1→1.06→1, completed within 0.6·HOLD after landing | 0.06 is already the limit; any larger and it reads as the pill moving by itself, stealing the content's scene |

## Known pitfalls
- The pill must be a **fixed layer with zero `translateY` displacement**, and the `scaleY` breath must not carry
  displacement either, otherwise the focus frame drifts and the meaning of "content passing through the focus" is instantly lost
- Writing distance falloff on `fontSize` triggers per-frame reflow (row height is fixed so the layout doesn't jump);
  if row height is changed to auto it will jitter; rowH must be hard-coded
- Do the fade with an alpha mask via `mask-image`; don't stack paper-coloured blocks: once the background is a gradient/has light spots, a colour-block mask exposes rectangular boundary bands
- The 24×24 square app icon on the outer left (dark base + the reversed-out video-shotcraft logo) is positioned relative to the frame centre with
  `margin:-12px 0 0 -186px`; if you change the viewport width you must change the 186px as well
- ITEMS are video-shotcraft's 7 feature names ("Shot recipe cards" etc.); when swapping in other feature names,
  changes in text length affect how centred it feels: if a single line exceeds 300px, shrink the font size rather than wrapping

## Reference implementation
demos/interaction/picker-carousel-feature-cycle/
(PickerCarouselFeatureCycle.tsx)
