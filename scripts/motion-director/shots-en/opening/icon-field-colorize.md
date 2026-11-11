---
name: icon-field-colorize
one_liner: A grayscale dot-matrix of small icons surfaces with staggered overlap until it fills the screen, holds a beat, then several bands of brand colour ripple downward extremely fast and flip the whole field: an opening/closing card for "lay out the full feature landscape first, then light up the brand in an instant"
use_when: An opening that lays out the product's capability surface (icons = feature universe) and then hits it with brand colour in one stroke; feature-collection pages, showing ecosystem/integration scale, a lead-in before the title logo
length: Surfacing ~45f staggered + rest ~10f + colour flip 12–45f + final-state rest; whole segment 3–6s (demo 170f: colour flip on the 30f setting + title lockup + final-state hold 1s)
energy: medium (the surfacing is setup; the instant of the colour flip is the only burst)
tags: ui-entrance, outro
---

## Intent
First use grayscale to fully establish "a lot": a hundred-plus small icons float in with staggered overlap and fill the frame, and the grayscale ensures
they read as background texture and don't steal the scene; hold a beat so the viewer realises "it's full", then the brand colour sweeps across the whole field
extremely fast as horizontal-band ripples, and the gray world is lit up in an instant. The make-or-break point is that **the colour flip is not
a hard flip on a single frame**: measured on the source footage, within ~0.5s several colour waves sweep down quickly one after another (blue covers the whole field first,
orange/green/red then cover successively lower row bands), and the final state is layered four-colour horizontal bands; the ripple feel gives "lighting up"
direction and speed, whereas a hard flip only reads as swapping to a different image.

## Motion core
- Icon field: 150–200 small icons in a grid (alternate rows offset by half a cell), 3–4 gray levels
  at random; mulberry32 decides grouping/gray level/shape; the demo puts the icons into keycap-style rounded squares: in the dark field,
  grayscale = dark keycaps that "aren't powered yet" (warm-black base, hairline edge, lit top rim, dark gray glyph),
  colour flip = powered on: the whole block becomes a glowing colour block + dark glyph + same-colour bloom
- Surfacing batches are grouped by distance from the frame centre (75%) + noise, reading as spreading outward from the centre
- Surfacing: fades in over 10 staggered batches (4.4f between batches + ≤3f jitter within a batch), each with a
  0.6→1.06→1 micro-bounce (a single overshoot and settle back) + 10px float up
- Hold a beat (~18f): let "it's full" be read; in the last 10f the whole field dims by 12% as wind-up (an inhale), returning to full when the first wave arrives
- Colour flip: several colour waves advance row by row, ~1.4f row offset + 0.25f slight column tilt + ≤1.5f
  per-icon jitter (a slanted wavefront, not a whole row on the same frame); each wave covers downward from its own starting row,
  and later waves cover lower row bands → final state of multi-colour horizontal bands
- A single icon's flip is 4f: the new colour **fills the keycap top-down via clip** (consistent with the wave direction, no opacity blending) + a 1.22x sine pop;
  once filled, a 5f screen white flash + bloom overshoot, giving the wavefront a "powering on" quality
- Light spill: once a row lights up, the stage behind it gets tinted with a horizontal light band of the same colour (intensity = the proportion of that row already lit), so the whole field genuinely lights up
- Lockup: once the light stabilises, a radial dark scrim rises from the centre (dimming only the centre; light around the edges is kept), and the video-shotcraft wordmark (eyebrow position) + a two-line 132px title "Every shot, / one place." rise word by word; the second line must not exceed the scrim's width, otherwise the letter edges sit on bright keycaps

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Icon count | 170 (17×10 @1080p, cell pitch 108×106, keycap 66px) | <100 doesn't read as a "field"; >250 each one is too small and the flip pop can't be seen |
| Total surfacing length | ~48f (10 batches × 4.4f + 7f fade-in for the last batch) | Too fast reads as a flash; >60f the viewer can't wait for the burst |
| Total colour-flip length | Source footage completes the whole field in ~12f; demo ~30f | The faster, the punchier; only stretch it for tutorial/slow-paced contexts |
| Wave count and colours | 4 waves, a same-family sunrise gradient (gold → amber → orange → coral red) | 1 wave = a single-colour light-up also works; four colours across hues (blue/orange/green/red) read as a rainbow; same-family segments feel more like a brand |
| Row offset | 1.4f/row + 0.25f column tilt | Row offset >3f makes the wave read as a row-by-row scanner; 0 = hard flip |
| Flip pop | 1.22x sine 4f + clip fill | Without the pop the wavefront can't be read; >1.4x the icons fight each other |

## Known pitfalls
- Tuned on hand-drawn simple-line icons in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Don't use an opacity cross-fade for the flip: warm semi-transparent colour over a dark base passes through an olive/mud-gray phase (ruling); wipe it in with clip;
  the white flash must also wait until the new colour fully covers, otherwise a white flash over a semi-transparent stack looks gray
- **The colour flip must not be a hard flip on a single frame**: frame-by-frame checking of the source footage confirmed several ripple waves sweeping fast (bear-app
  25fps dense frames: blue → orange/green/red completes within about 0.5s); a hard flip reads as an image swap with no "lighting up" feel
- Icons need recognisable solid simple shapes (heart/star/lightning/checkmark…); abstract colour blocks can't convey
  the "feature universe" meaning
- Division of labour with theme-switch-moves: that card is the UI's light/dark theme switch; this card
  is a brand-colour light-up of a decorative icon field and carries no interface meaning

## Reference implementation
demos/opening/icon-field-colorize/
(IconFieldColorize.tsx)
Source footage: bear-app.mp4 ≈0.0–3.0s
