---
name: white-flash-logo-simplify-cut
one_liner: A colourful wordmark with a liquid-metal texture sits still with flowing light; after a wind-up a white-flash overexposure bursts from the centre of the type, and as the exposure falls back the same position already holds the flat version of the wordmark: one white flash completes a texture dimensional reduction
use_when: Closing a brand section (lavish performance → clean final look); the transition beat where the mood switches from showing off to a formal announcement
length: about 4s (120f@30fps; performance 0–34f · wind-up 34–46f · white rush 44–54f · exposure falls back 54–76f · lock 72–96f · hold until 120f)
energy: medium-high (a single pulse-like accent, with still scenes before and after)
---

## Intent
First give plenty of lavishness (iridescent liquid metal flowing over the type, one diagonal highlight sweeping across), then use a single white flash to "purify" it into a flat monochrome wordmark: what the viewer reads is "the performance is over, this is its official image". The dimensional reduction is rhetoric: cutting from sensory texture to rational recognition. Both versions have the same type size and position, reading as "the same wordmark has been purified", not a swapped image.

## Motion core
- Liquid layer (the demo wordmark is the video-shotcraft wordmark "video-shotcraft", wordmark font 190px weight 700, all lowercase, centre y=500): one span stacks four background layers, all `background-clip:text`:
  ① iridescent base colour `background-size:300%` flowing slowly 1.1% per frame ② vertical volume (bright top, dark bottom) ③ chrome reflection band at the type's waist ④ diagonal highlight
  sweeping across once at 6–34f (Q4: only once, only on the hero, clipped into the letterforms); a same-colour bloom under the type (blur 38px) + flipped floor reflection (0.22, fading mask); the whole frame slowly pushes in 1→1.035 over 0–44f
- Wind-up 34–46f (EASE.exit, faster and faster): wordmark brightness 1→1.7, bloom strengthens; a horizontal anamorphic flare stretches out from the centre of the type (wide soft halo + 4px thin bright core, the core fading at both ends)
- White rush 44–50f: a radial white blob fills the full screen from the centre of the type (radius 80→1580px, quadratic ease-in, visibly swallowing the wordmark over the last 3 frames); 50–54f pure white hold (breathing slot), with the scene change at 50f while fully white
- Exposure falls back 54–76f: white layer 1→0 (quint-out, fast then slow, like eyes adapting to strong light); the flat wordmark underneath is already in place and only does a 1.03→1 focus tighten
- Lock: a 96px amber short line draws out from the middle at 72–86f, the Frame Chisel logo mark above the wordmark strokes on at 74–96f (the viewfinder frame unveils first, then the amber slanted cut slides in), the brand short phrase "Frame motion. Craft the shot." rises word by word (from 78f); 96–120f very slow push-in 1→1.01

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| White rush window | 44–50f radial fill (t² ease-in) + 50–54f pure white | The white rush must "fast-forward"; a uniform whole-screen fade-in reads as a soft edit cut, only bursting from the centre of the type reads as "the type glowing to overexposure" |
| Wind-up | 34–46f, brightness ×1.7 + horizontal flare | Cut the wind-up and the white flash has no warning, like a dropped frame; adding box-shadow to the flare core brings a dark ring (tested) |
| Exposure falls back | 54–76f, white layer recedes with quint-out | Replacing the fall-back with a fade-in of the flat wordmark creates a second action of "a word floating up out of a white background"; the fall-back makes the wordmark "always be there" |
| Flat entrance | 1.03→1 (snappy, 52–78f) | >1.06 reads as the wordmark popping out; also fading in stacks with the fall-back into two reveals |
| Wordmark size | Liquid / flat both 190px, same centre (size pressed by frame width for a 15-character wordmark; a 4-letter short word can go to 300px) | If the two versions differ in position or size, it reads as a skin swap rather than the same person |
| Brand constants | `PAPER` / `FLAT_INK` / `FLAT_ACCENT` (defined at the top of the block; the demo has already absorbed them as video-shotcraft's editing paper / set ink / lens amber) | Swap in the project's brand colours and the absorption is done; the liquid layer's iridescence is usually kept (it's "performance", not brand); the logo mark only appears in the flat segment and never gets the liquid texture (brand guidelines forbid gradients/glow) |

## Known pitfalls
- The scene change happens on the fully white 50f frame (rendering either the dark field or the paper, one or the other); the white layer must not recede before 50f, otherwise both scenes are visible at once
- `WORD` = `BRAND.name` (15 characters); changing the word requires adjusting font size `FS` in sync; the liquid layer / bloom / reflection / flat layer share `wordStyle` and `wordText` in four places
- With +0.03em letter-spacing on the wordmark, the two crossbars of "ft" just touch, and at large type sizes the seam shows a bright anti-aliasing line: the demo resets letter-spacing after f to zero so the two strokes overlap
- An SFX on the white rush is mandatory (impact/whoosh-bright type); a silent white flash reads as dropped frames in the footage
- The highlight must be clipped into the letterforms (background-clip:text): made as a radial light spot laid over the type, it spills outside the letterforms and smears into white fog on a black background (Q4 light spill)
- The base colour of the second half is bright paper: if the next shot is a dark field, join it with another transition, or reuse this card's ending with a straight cut

## Reference implementation
demos/transition/white-flash-logo-simplify-cut/
(WhiteFlashLogoSimplifyCut.tsx)
