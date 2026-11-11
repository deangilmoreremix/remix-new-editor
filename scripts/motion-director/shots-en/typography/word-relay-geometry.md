---
name: word-relay-geometry
one_liner: Three benefit words, each with its own dedicated set of geometry in a relay — a large dashed circle rotating and decelerating + a comet arc racing around → three solid-line circles trim-growing one after another, then drawing together to lock tight → a chrome metal sheen sweeps across, and a beat later it resolves into pure white; the old word shrinks to 0.86 and fades out, the new word is revealed stroke→fill
use_when: Three-point benefit statements (faster/better/stronger); brand-values passages; a mid-film push that needs "one word, one world"
length: about 6.0s (180f@30fps: three segments of ≈60f each, overlapping 6f between segments)
energy: medium-high (a three-beat push + geometry in motion throughout + background particles, no still frames)
---

## Intent
A three-point benefit statement is most easily made as three title cards with hard cuts. The relay approach gives each word a set of
**geometry that belongs only to it**: the dashed circle is "spinning" (fast), three interlocking circles drawing together are "meshing with each other" (tight / better),
the metal sweep is "hard material" (strong) — the geometry itself argues the case for the adjective. The third word
gets an upgraded treatment (sheen sweep + resolving to white), because it is the conclusion. Background dust, a shared stage light and a three-segment progress bar
at the bottom stitch the three beats into one continuous space; otherwise it's still three cards.

## Motion core
(demo version: graphite dark-field cinematic title card, word list Faster / Tighter / Stronger, native 1920×1080 coordinates)
- The three segments are scheduled by frame: Faster 2→62, Tighter 56→122, Stronger 116→180; each segment enters over 14f (snappy,
  `scale 1.06→1` + 10px de-blur) and exits over 10f (strong exit ease-in, `scale 1→0.86` + 12px defocus);
  the 6f handover overlap is a baton pass rather than a hard cut; the last segment has no exit, holding 22f after resolving to white
- Each word has three text layers (230px/800, static font Helvetica Neue): the `outline` layer `-webkit-text-stroke:2px`
  + transparent fill, the `fill` layer pure white — **the stroke arrives first, the fill is revealed after**; all three layers share `padding: 0.08em 0.1em 0.28em`,
  otherwise mask / background-clip only paint inside the box, cropping the descender of g and the right edge of the last character and exposing the stroke layer underneath
- For the first two words, the fill wipes in horizontally with a ±7% soft-edge `mask-image` (starting 10f after the entrance, 18f, swift), and the stroke layer's opacity
  simultaneously drops to 0.2, leaving a little ghosting
- Faster's geometry: a large dashed circle (r=400, `dash 10 16`) + an outer 120-segment tick ring (r=452, slowly counter-rotating);
  on entrance it grows snappily from 0.4 to 1 over 22f, while spinning an extra 160° and braking to a stop (flywheel feel), then rotates slowly at a constant rate and never stops; a 16-segment
  fading white comet arc races along r=400 at 7.5°/frame — "fast" is read from the relative rotation speeds of the two layers + the comet's speed difference
- Tighter's geometry: three solid-line circles (r=218) with `pathLength=1` + dashoffset trim growth, the stroke starting around each circle's own centre
  `rotate(-90 cx 0)`, delays 0/6/12f, 22f each (out), a glowing dot at the pen tip that goes out once the circle is complete; from 92f the spacing between the three circles
  draws together 340→300 over 14f (swift); on settling the circle lines brighten once, and the four intersection points light up as diamond rivet light dots (popping out with overshoot)
  — "tight" is a visible drawing-together action
- Stronger has no geometry: from 120f, stroke → a vertical chrome gradient (bright top — dark waist — bright bottom); over 124→148f a narrow white band with a warm champagne tint
  (`100deg`, `background-size:300%`) sweeps from left to right; over 146→158f it resolves into pure white + one bloom pulse,
  a horizontal light band at its foot snaps open from 0.2 width, and the stage key light brightens on the same beat — the upgraded treatment reserved for the conclusion word
- A 40px sub-sentence under the word gives product evidence (rise, word by word; the demo uses three promotional lines for video-shotcraft), a mono count "01 / 03" at top left,
  the Frame Chisel logo mark + the lowercase video-shotcraft wordmark at top right, and a three-segment progress bar at the bottom (label-level texture);
  the camera pushes in very slowly 1→1.025 smooth throughout (no shake)

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Three segment timings | ≈60f each, 6f overlap | About 2s per word is the lower limit for "reading the word + watching the geometry"; an overlap <3f reads as a hard cut, >12f and two words fight on screen |
| Entrance/exit windows | in 14f snappy / out 10f exit | Exits being shorter than entrances is right (an exit should be decisive); using an out curve for the exit reads as "reluctant to leave" |
| outline→fill | 18f swift, ±7% soft edge, outline kept at 0.2 | Keeping a little stroke as ghosting is the source of the texture; drop it to 0 and the word goes flat; a window >30f wipes in as slowly as a loading bar |
| Dashed circle | r=400, `dash 10 16`, scale 0.4→1, an extra 160° spin on entrance then braking | The braking is the first evidence of "fast"; a scale start >0.7 and there's no "growing out" |
| Comet arc | 7.5°/frame, 16 fading segments | Only 8× or more faster than the ring reads as a "speed difference"; <8 segments and the tail breaks into a dashed line |
| Trim growth | delay 6f/circle, 22f each | The phase difference is key to "interlocking one after another"; growing simultaneously reads as three independent circles |
| Drawing together | spacing 340→300 (14f swift) + intersection rivets | A draw-together <20px and the action can't be seen; >60px and the three circles squash into a lump |
| Sheen sweep | `100deg`, `background-size:300%`, 24f smooth | 300% ensures the white band only covers a small section of the word width (= a metal highlight); the chrome base layer can't be omitted, otherwise before the sweep it's a block of grey text |
| Resolve to white | 12f + bloom pulse + light band at the foot | This moment is the only "conclusion" treatment in the whole piece; delete it and the three words are at the same level, and the third point has nowhere to land |
| Font size & colours | word 230px/800, sub-sentence 40px, geometry `rgba(236,238,244,.42)`, graphite dark field | Geometry one step darker than the text is the hierarchy; geometry brighter than the text steals the lead |

## Known pitfalls
- Tuned on placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use.
- **The three words must be three points in the same syntax (in the demo they are all comparative single words, 6–8 letters)**:
  the segments are of equal length, and when word lengths differ a lot — since the geometry (circle radius, spacing) is all hard-coded coordinates —
  long words will punch out of the dashed circle or press onto the interlocking circles — when changing the word list, adjust r and the draw-together spacing to match
- `-webkit-text-stroke` is a prefixed property: only Chromium/WebKit have it; in Firefox the stroke layer
  is simply transparent (the word disappears). Remotion renders on Chromium so no problem, but watch out in preview environments
- The `pathLength=1` normalisation used for SVG trim is not fully supported for `<circle>` in some older browser versions;
  the degraded behaviour is the circle drawn completely in one go (losing the growth feel) — when porting, first verify one frame on the target
  renderer
- The exit trim is "entrance trim minus the exit seg", a direct subtraction: if the two windows are too close
  (segment length <40f), it starts retracting before it has finished growing, and only a small section of the circle is drawn
- The sheen layer and the fill layer are two stacked DOM elements: switching relies on an opacity crossfade; if the `white` window
  and the `sh` window are tuned with insufficient overlap, there will be 1–2 frames where both layers are semi-transparent (the word looks grey)
- The third word's upgraded treatment can only be given once: if all three words in the film get the sheen there's no sense of conclusion
  (the P4 spirit of de-duplicating techniques); for sound, the three entrances are three rhythm points, and the third word's resolve to white deserves
  its own accent; see sound-design.md for the scoring discipline

## Reference implementation
demos/typography/word-relay-geometry/
(WordRelayGeometry.tsx)
