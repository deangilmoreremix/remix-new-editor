---
name: radial-wave
one_liner: A 17×9 dot array lights up in staggered order by Euclidean distance from the wave source; each dot overshoots in scale to 1.5 then falls back to a steady glow; after the first wave finishes sweeping, a second bright-blue pulse contracts inward from the outer ring back to the centre
use_when: The "system powers on" beat of a product/brand opening; also as the establishing shot for data grid, node map, coverage-area type narratives
length: about 3.8s (114f@30fps)
energy: medium-high (one burst at the start; after the wavefront passes it turns into a steady-glow low-energy bed)
---

## Intent
Rewrite the static fact "many dots exist at once" as the dynamic fact "energy spreads from one source to the whole". The viewer
sees not a dot-matrix image but a powering-on: the centre lights first, brightness pushes across like a ripple, and once it has passed the whole array
remains in a steady glow, laying the bed for the content of the next beat. The second, reverse wave is an acknowledgement, telling the viewer this system responds.

## Motion core
- The array is 17×9, 153 dots in total; dots use percentage positioning (`left:(c+0.5)/COLS`), so changing row/column counts doesn't require
  recalculating coordinates; each dot pre-stores a normalised distance `dist = hypot(c-cx, r-cy) / maxD` (maxD = hypot(8,4))
- First wave: `seg(t, dist*0.35, dist*0.35+0.18, E.outCubic)`: the start is delayed linearly by distance (the outermost
  ring is delayed by 0.35), and each dot's own travel is a constant 0.18; the wavefront is "staggered start points", not variable speed
- Each dot's scale is not a simple 0→1 but `w1*(1+0.5*sin(w1*π))`: it swells to about 1.5 midway then settles back to 1;
  the sine envelope makes the overshoot happen in the middle of the travel rather than at landing
- Second wave: `seg(t, 0.62+(1-dist)*0.25, +0.15)` flips the sign of the offset (outer ring moves first), takes
  `sin(w2*π)` as a pure pulse, adding a 0.8 scale increment and a 0.25 opacity increment, leaving no state once it has passed
- At the pulse peak (`pulse2 > 0.3`) it hard-cuts to `#b9f2ff` with a `0 0 12px #7fd8ff` glow: only the second
  wave carries glow; the first wave is the constant colour `#6c8cff` throughout, so visually the two waves never merge into one thing

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Array size | COLS=17 / ROWS=9 (153 dots) | Dot count sets the wavefront's "resolution"; with <8 columns the distance bands are too coarse and the wave reads as three or four concentric rings jumping |
| Wave speed coefficient | `dist*0.35` | This 0.35 is the reciprocal of wave speed: increase it and the wave travels slower with a longer tail; >0.5 the outermost ring has to wait until past the halfway point of the shot to light |
| Per-dot travel | 0.18 (≈21f) | Sets the wavefront's thickness; <0.1 the wavefront is sharp like a scan line, >0.3 the whole field lights almost at once and the sense of spreading disappears |
| Overshoot amplitude | `1+0.5*sin(w1*π)` → peak 1.5 | Coefficient 0.5 is the amount of "one bounce"; remove the sine term and it's a flat 0→1 fade-in, >0.8 the dots bite into each other |
| Second wave | start `0.62+(1-dist)*0.25`, window 0.15, amplitude 0.8 | 0.62 is the breath between the two waves; brought forward below 0.5 it overlaps the first wave's tail and reads as a mess of flickering |
| Steady-glow base | `opacity = 0.25 + w1*0.5 + pulse2*0.25` | 0.25 is the presence of unlit dots; set to 0 and everything outside the wavefront is black, and the array's "scale" can't be conveyed |
| Highlight threshold | `pulse2 > 0.3` colour switch + glow | The lower the threshold, the longer the glowing segment; this is a hard cut, not a gradient; with the threshold near 0 you see an obvious on/off jump |

## Known pitfalls
- The wave source is hard-coded at the geometric centre (`cx=(COLS-1)/2, cy=(ROWS-1)/2`). To start the wave from a corner or a particular "node",
  you must change cx/cy and maxD together, otherwise normalised distances exceed 1 and the outermost ring's start is pushed beyond t=1 and never lights
- The last frame isn't fully still: the centre dot's (dist=0) second-wave window is 0.87→1.02; at t=1 it has only reached 87%,
  and `pulse2≈0.41` is still highlighted. For a loop or a clean ending, compress the second wave's start to within 0.85
- The dot's `width:10px` and `margin:-5px` are a bound pair (centred via the negative margin); changing the dot diameter requires changing
  the margin in sync, otherwise the whole array shifts half a dot diameter to the lower right
- There are only two colour levels (constant `#6c8cff` / peak `#b9f2ff`); to switch to brand colours, change these two plus the glow colour, three places in total;
  the background `#0a0b10` is the precondition for the glow; on a white background this brightness pulse is basically invisible

## Reference implementation
demos/ui-entrance/radial-wave/
(RadialWave.tsx)
