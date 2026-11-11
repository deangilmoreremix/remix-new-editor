---
name: scan-bracket-sweep
one_liner: A document pops to the centre, L-shaped viewfinder brackets drop onto its four corners, and a scan light band trailing a gradient wake sweeps back and forth over the document 5 times: the document stays still throughout, only the light is reading it
use_when: Process shots of "this content is being parsed/verified"; capability demos for document products; the middle of an upload → analysis chain
length: about 5.0s (150f@30fps)
energy: low-medium (mechanical, restrained, the rhythm entirely in the breathing of the back-and-forth sweeps)
---

## Intent
Let the viewer understand "this thing is being read line by line by a machine". The viewfinder brackets first frame the target (announcing the object
of inspection), then the scan light band travels back and forth through the whole piece (announcing the inspection process). The make-or-break point is that **the document itself is completely still**:
once the document also moves, the viewer can't tell whether it's "being inspected" or "loading".

## Motion core
- Document `seg(0→0.11, outCubic)` pops from scale 0.86 to 1, opacity via `dp*3`
  reaching full brightness early, landing before the scaling finishes: first "it's there", then "it's steady"
- The four 34px L-shaped corner brackets land one after another with `i*0.022` stagger, each taking 0.055,
  coming in diagonally from outside with 8px displacement (overshoot easing, about 8% light overshoot then settling)
- Scan window `t 0.17→0.95` strictly linear, cut into 5 passes, `inOutSine` within each pass
  slow at both ends and fast in the middle, with a complete 12% pause at the end (`local=(raw-pi)/0.88`)
- Light band = 1.2px indigo light core + 10px symmetric soft glow + trailing wake; wake at most 82px, `SCAN .2→0`
  multiply, length stretching and shrinking with scan speed (shrinking to 0 at the end-of-pass pause, so direction reversal doesn't jump); direction flips with `dir`:
  hanging above the band when going down, below it when going up, with the gradient reversing in sync
- Table rows the light core passes over are lit slightly (row base SCAN 9%, Gaussian falloff): the light reads, the document doesn't move
- The whole light band is clipped inside an `overflow:hidden` layer with the same 10px rounded corners as the document,
  fading in `0.16→0.20`, fading out `0.93→0.99`

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Document pop-in | scale 0.86→1, t 0→0.11 outCubic | A starting value below 0.8 becomes "flying in from far away"; the pop-in needs to be small to feel like UI |
| Viewfinder brackets | Arm length 34px, round-cap stroke 1.6px, offset outward −7px; stagger 0.022 / 0.055 each | Four corners appearing at once read as a static border; a 0.022 difference is enough to read "dropping one by one" |
| Scan passes | PASSES=5, window t 0.17→0.95 linear | 3 passes isn't enough to read as "back and forth"; 7+ passes within 5s makes each pass too fast |
| In-pass easing | inOutSine + 12% pause at the end | The pause is the breathing slot of "this pass has been seen"; remove it and it becomes a constant-speed swing back and forth |
| Light band | 1.2px light core + soft glow + ≤82px wake SCAN .2→0 (multiply) | A line too thick (>4px) reads as a mask edge rather than light; a black-grey wake reads as dirt |
| Wake direction | Going down top:−tail / going up top:0, gradient flipped along with it; tail with speed | Flip only one → the wake runs ahead of the motion, reading as "the light sucking backward"; a fixed-length wake jumps wholesale to the other side on reversal |
| Clip layer | Same 10px rounded corners as the document, overflow:hidden | Leaking outside the document is "scanning the frame", not "scanning the document" |

## Known pitfalls
- The light band must be clipped inside the document bbox, with rounded corners matching the document: leak out a little and you lose the semantics of "scanning
  this document"
- The wake's `top` and gradient direction are written in two independent places; when changing scan direction both must be changed together,
  miss one and you get the anti-physical look of "the wake in front"
- The brackets' 34px arm length and −7px outward offset were set for a 300×178 document size; with a real screenshot
  recompute for the new size; an arm length over 1/4 of the short side covers the content
- Two colour variables: INK (brackets + body text) and SCAN (light core + soft glow + wake + row lighting); to reskin change only these two

## Reference implementation
demos/effects/scan-bracket-sweep/
(ScanBracketSweep.tsx)
