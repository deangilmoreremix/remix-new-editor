---
name: text-as-mask
one_liner: Text as a video mask: extra-bold large title letters are cut out of a porcelain-white stage, revealing a slowly panning dark live product panel inside; at the end, after a breath in, the letterforms rush in exponentially, magnifying 46× to overflow, and the image inside takes over the full screen
use_when: An opening or chapter card that combines a brand word/slogan with product footage in one; the letters are the door, the product is inside the door
length: 165f (entrance 18f + in-letter drift 78f + breath in 8f + rush-in takeover 24f + landing/hold 37f)
energy: medium-high (the drift segment is calm, the takeover segment is a single burst)
tags: typography
---

## Intent
Title and product footage fighting for the screen is an old problem: text first then footage is slow, text over footage is cramped. This approach makes
the two one body: the letterforms are the mask, the product only shows through the strokes, and the viewer reads the word and the quality of the footage
at the same time; at the end the letterforms swell open and overflow the frame, and the product naturally takes over the full screen: "walking from the brand word into the product"
told in one shot, doubling as a chapter transition (same family as transition-travel A, letter-counter fly-through:
there the camera drills into the letter's counter, here the letterforms swell open themselves; in the former the camera moves, in the latter the door moves).

## Motion core
- Bright-field stage (porcelain cool white + key light + vignette) + SVG white-text-on-black data-URI handed to CSS `mask-image`, with the mask layer wrapping the product footage;
  beneath the letterforms sits a blurred drop shadow of the same letterforms with a hue (also via a data-URI image), so the letters look like windows "dug" into the stage
- The content in the windows needs large blocks of saturated colour and bright lines: the demo is a video-shotcraft dark render board (cobalt→cyan streaming area chart flowing continuously left, a rendered-frames counter, a breathing render-queue bar chart; the eyebrow is the video-shotcraft wordmark, the subtitle From one prompt to a finished launch film.),
  during the drift the panel moves up 110px so the bright line passes right through the letters' waistline and the area gradient fills the lower half of the letters: a white card/light UI showing through white-background letters reads as ordinary text
- Entrance: the mask wipes up from the baseline (clip-path bottom edge retracting, 16f) + 1.04→1 settle; eyebrow letterspacing tightens, subtitle rises
- In-letter drift: product layer scale 1.32 + translateX +150→-150 (f18–96, bezier(0.3,0,0.7,1) gentle at both ends):
  the letterforms are still and the content flows; the illusion of "a world outside the window" is the technique itself
- Breath in: f96–104 letters 1→0.965 (swift), eyebrow/subtitle exit ease-in: the anticipation before a big move
- Rush-in 24f (f104–128): mask wrapper `scale(0.965→46)`, interpolated in log space by t^1.8
  (`S = s0·(46/s0)^(t^1.8)`, the per-frame magnification ratio keeps growing = rushing faster and faster);
  **transform-origin must be pinned inside a solid stroke** (the demo uses the centre line of the L's vertical stroke, 1236,546): pinned in the hollow of a letter's counter, what shows after magnification is the background colour;
  during the rush-in the wrapper also translates `(960−Ox, 540−Oy)·t`, pulling the vertical stroke back to the frame's centre line (otherwise the right-offset vertical stroke only covers the left edge at 30×)
- Inverse compensation on the content layer: wrap a layer of `scale(1/S) translate(−d)` (same origin) to cancel out the wrapper's magnification and translation, so the product footage
  isn't distorted by the mask geometry; at the same time the panel goes 1.32→1 and the drift returns to zero (expo-out, f104–132, converging 4f later than the rush-in = follow-through)
- Takeover safety net: stack another unmasked full-screen layer sharing the same translate/scale transform, which fades in only after the vertical stroke has already filled the full screen (t^1.8 ∈ [0.86, 0.95], S≈24×)
  ; fading in earlier lays a semi-transparent gray veil over the bright base
- Ending: f132–165 full-screen panel hold, with the streaming chart still flowing slowly (the product is alive, not a dead frame)
## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Font size/weight | 470px / 900 (system-ui Black, letterspacing −22) | The strokes are the viewport: a thin weight means stuffing the product through a crack in the door; the text width takes ~72% of the frame |
| Drift speed | ~3.8px/f (300px/78f) | Faster and the footage inside the letters can't be read; choose the drift direction along the axis where the image is information-dense |
| Breath in | 8f, 1→0.965 | A rush-in without a breath in reads as "suddenly swelling"; >0.94 reads as the letters shrinking to exit |
| Magnification | 46× (matched by vertical stroke width/frame ratio: an 88px vertical stroke needs ≥24× to fill) | Too little and letter-edge ghosts are still visible on the takeover frame |
| Rush-in curve | Log space t^1.8, 24f | Linear in log = constant-speed rush-in; exponent >2.5 barely moves in the first half, then swells violently in the last 3f |
| Ending | Hold ≥30f after takeover | R1; on the frame where takeover completes the product should land in the standard composition |
## Known pitfalls
- The demo uses a video-shotcraft render board designed for the shot (Render throughput, with the brand logo in the sidebar): when swapping in real screenshots in real use, first check whether what shows through the strokes is large blocks of colour and bright lines;
  light pages must first be darkened or switched to a dark theme, otherwise the letters don't read as "windows"
- Don't give the letterforms an outline highlight: the glyphs of variable fonts like system-ui are built from overlapping contours, and an outline draws internal contour lines such as A's crossbar/apex
- The product footage showing through the letters is stared at in close-up the whole time: real material must first go through
  the high-resolution rasterisation technique from aesthetic guideline Q2, otherwise a low-magnification screenshot smears into a blur inside the strokes
- After changing the word/font, the hand-derived origin values are guaranteed to break: after rendering, look at the magnification direction, and if the hole isn't centred, fine-tune
  the origin (same as the counter-centre drift pitfall of transition-travel A, letter-counter fly-through)
- Don't use alongside transition-travel A, letter-counter fly-through, in the same film: both are "a world growing out of the letters",
  and the viewer reads it as the same trick used twice (P4)
- The transforms of the mask layer and the content layer must be driven separately (wrapper magnifies / content compensates inversely);
  combined in one layer, the product swells together with the letterforms into a 26× ruined shot

## Reference implementation
demos/opening/text-as-mask/
(TextAsMask.tsx)
