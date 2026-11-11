---
name: lead-word-zoom-assemble
one_liner: The lead word occupies the centre of the frame at 2.3× font size and keeps pushing in 6% during the hold, then a single curve simultaneously "shrinks it back to final size" and "slides the whole line left into place", while each following word is pushed in from 0.5em to the right of its slot; the pivot is pinned horizontally to the lead word's centre and vertically to the baseline (measured at mount), the subline rises in the same time window as the whole line moves up, and after a beat's pause the whole scene crash-zooms in, defocuses and hands off
use_when: An "Introducing" title card for a brand/product name; the second shot of a launch-event-style opener; any one-line claim that needs "first let one word fill the frame, then complete the sentence"
length: about 2.8s (84f@30fps; sentence assembled by f36, move-up and subline f32–46, 26f still, final 12f crash)
energy: medium-high (it opens with frame-filling large text, but there is only one motion throughout, no second impact)
tags: opening
---

## Intent
The easiest mistake with a title card is "the whole sentence fades in at once" — viewers receive 5 words simultaneously and remember none. This card turns
reading order into **physical order**: first give only one word, and make it so large it fills the frame while still pushing towards the viewer, so the viewer
is forced to read it first; then this word retreats to its own size and position within the sentence, and the sentence grows around it. By the time it lands, the viewer
has already read the main word twice.

The real make-or-break point of the feel isn't the scale curve, it's the **pivot**. The lead word travels from "dead centre of the frame" to "the position of the third character
in the line"; if the pivot is taken as the line box's centre, the scale and the left slide each pull the text in different directions, and in the last few frames the baseline visibly jitters.
Pin `transform-origin` horizontally to the lead word's centre and vertically to the baseline, and these two points stay fixed throughout, so the whole line just
"shrinks", with no drift at all.

## Motion core
- **Two scale segments summed into one scale**:
  `scale = interpolate(f, [0,12], [2.3, 2.3·1.06], PUSH_EASE)
         + interpolate(f, [12,24], [0, 1-2.3·1.06], ZOOM_EASE)`.
  The first segment is the push-in during the hold (`cubic-bezier(.25,1,.5,1)`, decelerating and then hanging at the peak), the second is the shrink-back
  (decreasing all the way from the peak to the final size 1). Written as a sum rather than a piecewise condition, there's no velocity break between the two
- **The shrink-back and the left slide share ZOOM_EASE** (`cubic-bezier(.5,0,.05,1)`, heavy ease-in-out, zero rebound):
  `translate = interpolate(f, [12,36], [slideDistance, 0], ZOOM_EASE)`. The two actions must read as
  **one** motion; with separate curves they read as two beats, "shrink first, then slide away"
- **Where the offset comes from**: `slideDistance = lineWidth · (0.5 - leadRatio)`, where `leadRatio` =
  the lead word's centre as a proportion of the whole line. For the lead word to sit at dead centre, the whole line must first be offset right by this much
- **Measured pivot**: at mount, `delayRender` suspends rendering and measures three values — the whole line's `offsetWidth`,
  the lead word's `offsetLeft + offsetWidth/2`, and the baseline. The baseline is read with a **zero-size inline-block ruler**
  (the `offsetTop` of `<span style={{display:'inline-block',width:0,height:0}}>` is the baseline),
  far more accurate than estimates like `lineHeight × 0.8`. After measuring, `continueRender`, and `transform-origin`
  is written as `${leadRatio*100}% ${baseline}px`
- **The following words are pushed in, not faded in**: word i (i≥1) starts at
  `pushStart = 12 + 6 + (i-1)·4`, with `translate` going `0.5em → 0`
  (`cubic-bezier(.22,.8,.36,1)`, fast start, long landing), and opacity finishing its fade in just 2f. The fade-in must be extremely short,
  otherwise the words "emerge" instead of "being slotted in"
- **The space between words must sit outside the inline-block**. If it trails inside the word span it gets clipped by the line box,
  and after landing all the words stick together in a clump (a bug in the upstream original component, fixed here)
- **Three-beat close at the scene level**: f32–46 the whole line `translateY 0→−56px` (outCubic), and the subline in **the same time window**
  fades in + moves up 16px — the space freed by the move-up is filled by the subline in the same frame, with no gap; f46–72 completely still for 26f;
  f72–83 the whole scene `scale 1→1.2` + `blur 0→9px` + `opacity 1→0.45` (ease-in-quad), pushing in and defocusing
  to hand off to the next shot
- **Texture (demo)**: within 6f of entering, the lead word carries an 8px→0 defocus; during the shrink-back, a momentary defocus by scale velocity (≤3.5px, zero once settled);
  the background is a low-contrast mesh of an indigo key light + a touch of warm afterglow + grain + vignette
- **Accent word**: an exact match on one word swaps it to the accent colour (in the demo it's the brand name `video-shotcraft`). The moment the brand word is pushed into place it carries
  its own highlight, no need for a second action

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Lead word starting multiplier | initialScale 2.3 | 2.3 lets the lead word overflow the frame horizontally just a little (reads as "too big to fit"); <1.8 it's just "slightly bigger text" and the impact disappears |
| Push-in | pushScale 1.06, filling the 12f hold | 6% is the minimum perceptible amount for "still coming towards the viewer"; >1.15 reads as a reverse bounce during the shrink-back |
| hold | 12f | How long the lead word has the frame to itself; <8f viewers can't finish reading a long word, >20f the sentence's rhythm collapses |
| Shrink-back | 12f, ZOOM_EASE | Same curve as the left slide; giving the shrink-back its own faster curve makes the line "finish shrinking, then slide", breaking into two beats |
| Left slide | assembleDuration 24f | Twice as long as the shrink-back: the font size has already landed while the position is still travelling, and this "gliding tail" is where the cinematic feel comes from |
| Following-word delay | wordDelay 6f (after the shrink-back starts) | Release the following words only once the lead word starts shrinking back; release them on the same frame and they crowd together so you can't see who's moving |
| Staggered overlap between words | wordStagger 4f | 4f reads as "pushed in one after another"; 0 and the whole suffix enters together, back to "the whole sentence fades in" |
| Per-word push-in | wordDuration 12f, wordPush 0.5em | 0.5em is "just from outside the slot"; >1em reads as flying in from off-frame, clashing with the lead word's converging direction |
| Word fade-in | wordFade 2f | Deliberately extremely short. >6f and the words read as "emerging", and the mechanical feel of being pushed in disappears |
| Size/weight/tracking | 96px / 600 / −0.03em | Negative tracking is what keeps it from falling apart at 2.3× magnification; large text with positive tracking reads as a "slogan banner" |
| Move-up + subline | f34–50, −56px, subline in the same window | The two must share the window: moving up first and then showing the subline adds an empty beat |
| Still | 22f | Readable time after landing; below 15f viewers don't have time to read the subline |
| crash | final 12f, scale→1.2, blur→9px | This is the **first half** of a transition; its motivation must match the first frame of the next shot; looking "unfinished" when played on its own is normal |

## Known pitfalls
- **Get the pivot wrong and the baseline jitters**. `transform-origin` must be the pair "lead word centre % + baseline px".
  Taking the line box centre (default `50% 50%`) makes the scale and the left slide pull against each other, and in the last few frames the baseline visibly jumps
- Don't estimate the baseline. Rules of thumb like `lineHeight × 0.8` are off by a few pixels across fonts, which becomes
  a dozen-plus pixels of jitter once magnified 2.3×. The `offsetTop` of a zero-size inline-block ruler is the only reliable reading
- During `delayRender` the whole line is `opacity: 0` — it **must** be. Otherwise the first frame, before the pivot is measured, flashes
  misplaced large text, which in the finished film is one dirty frame
- The layout is measured at mount, so **the result varies with the fonts of the render environment**: when cross-platform font fallback differs, the whole line's width
  drifts as a whole (and the lead word's proportion changes with it). If that matters, hard-code the three measured values as constants
- `scale` / `translate` use the individual CSS properties (not the `transform` shorthand). Mixing them lets one
  be overridden; if you merge them into `transform` you must guarantee the `translate → scale` order yourself
- A space between words placed inside the word span gets clipped by the line box (see above). This bug is not obvious at small sizes; at 96px
  all the words visibly stick together
- The lead word must be a **short word**. Something around 10 characters like "Introducing" is just right; when the lead word exceeds 14 characters the 2.3×
  magnification overflows both sides of the frame and viewers can't read the end of the word
- Give the accent colour to only one word. With two coloured words viewers don't know which to remember, and the highlight on being pushed into place becomes a
  "coloured title", erasing the meaning of the action
- The final crash is the first half of a transition, not a close. Used alone as an ending it feels "cut off" — to close, swap the
  crash for a still hold or a fade-out

## Reference implementation
demos/typography/lead-word-zoom-assemble/
(LeadWordZoomAssemble.tsx)
