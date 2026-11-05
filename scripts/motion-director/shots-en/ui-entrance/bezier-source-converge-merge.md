---
name: bezier-source-converge-merge
one_liner: Four source nodes on the left each have a thin Bezier curve to the same convergence point on the right. The curves first draw on left to right with staggered overlap; the nodes slide along their own curves toward the convergence point, accelerating and shrinking in three stages until they vanish; accent-colour data packets slide along the paths throughout. Once the merge is complete, the curves wipe away in reverse from the left end, leaving only the brand mark (demo: the video-shotcraft Frame Chisel mark on a porcelain-white disc)
use_when: The core mechanism shot for "multi-source integration / unified access / data aggregation"; explanatory passages for integration, aggregation and single-entry-point products
length: about 5.6s (168f@30fps)
energy: medium (a long, slow-advancing shot kept alive by the sliding data packets; the moment of absorption is the only small peak)
---

## Intent
"We unified four sources" is an abstract statement. This motion turns it into a visible physical process: first establish four independent
channels (draw-on means "connected"), then have the four sources actually travel along the channels into the same point and get sucked in (shrinking
to 0 means "absorbed"), and finally erase the channels leaving only the brand mark ("now there is only one"). Each of the three narrative stages has a clear
start and end, so the viewer can read cause and effect without narration.

## Motion core
- Path geometry: each `d = "M -22,y L 74,y C 186,y 214,120 332,120"` — starts outside the frame at -22,
  74 is where the source node rests, then a cubic Bezier bends toward the convergence point (332,120). The four differ only in starting y
  (36/92/148/204), so their curvatures naturally differ, as do their angles of entry
- Draw-on uses `stroke-dasharray = len` + `dashoffset = len*(1-draw)`, `seg(t, 0.04+i*0.045,
  +0.17, E.outQuad)` — the 0.045 stagger makes the four lines look connected one after another rather than lighting up together
- Nodes are positioned with `getPointAtLength`: x=74 is exactly the end of the straight segment, so the path fraction is calibrated directly as
  `f0 = 96/len` (the original 40-step scan wasn't precise enough and the four nodes wouldn't line up in a column); at runtime `frac = f0 + (1-f0)*conv`, `conv = seg(t, 0.34, 0.74, E.inOutCubic)` —
  the nodes travel **along the real curve**, not by interpolating between two points
- Three-stage shrink: while `conv < 0.75` 44→15px (slow slimming), when `conv ≥ 0.75` 15→0px (dropping it all in the last
  1/4 of the travel) — the rate of size change in the second stage is more than 4× the first, and that is the accelerating "sucked in" feel;
  the font size shrinks in sync via `size*0.26`, so the label never detaches from the node
- Data packets: `pkCycle = (seg(t, 0.1, 0.74, E.linear)*2) % 1` runs two whole cycles, each path adding
  an `i*0.13` phase offset; opacity uses `1 - |cycle-0.5|*0.6` so a packet is brightest mid-path and faint at both ends —
  avoiding packets appearing out of nowhere at the start
- Erase: `erase = seg(t, 0.78, 0.9, E.outQuad)` pushes dashoffset negative (`-erase*len`),
  so the dash retreats from the **start** end, opposite to the draw-on direction, reading as "channels withdrawn"
- Logo: `seg(t, 0.16, 0.26)` fades in and scales from 0.7 to 1; at the merge moment (0.7→0.78 outBack +12%,
  0.78→0.86 outQuad back down) it does one receiving pulse; the end `endCap` caption fades in after 0.84

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Number of sources | 4 (y=36/92/148/204, spacing 56) | 4 is the sweet spot where curvature differences are clear without tangling; >6 and the middle Beziers nearly overlap, entry angles indistinguishable |
| Draw-on | start `0.04+i*0.045`, window 0.17, outQuad | A 0.045 stagger is about 7f; setting it to zero reads as four lines brushed on together, losing the "connected one by one" meaning |
| Convergence window | 0.34→0.74 (inOutCubic) | Takes 40% of the clip and is the main passage; the slow start of inOut is "starting up", the slow finish is "arriving"; switch to linear and it immediately becomes a constant-speed conveyor belt |
| Three-stage shrink | 44→15px (first 75%) → 0 (last 25%) | The later the 0.75 turning point, the more sudden the suck-in; moving it to 0.5 becomes "shrinking all the way" and the absorption beat disappears |
| Packet cycles | 2 whole cycles (0.1→0.74 linear) | Must be whole cycles, otherwise packets stop mid-path on the last frame; increasing to 4 reads as a hurried data flow and overlaps nodes more easily |
| Packet phase offset | `i*0.13` | Staggers the four paths' packets so they don't line up and merge at the same time; 0 shows four packets entering in neat formation, like a convoy departure |
| Erase | 0.78→0.9, negative dashoffset | Done in 12f; the erase must come after all nodes have vanished (conv ends at 0.74, nodes finish fading before 0.92), otherwise the lines go first and nodes hang in mid-air |
| Logo pulse | outBack +12% (0.7→0.78) → settle (0.78→0.86) | 12% is the "received it" magnitude; >25% steals attention from the convergence itself |

## Known pitfalls
- `getTotalLength` / `getPointAtLength` only work after the SVG is attached to the document and laid out;
  the code does it in a first-frame `prime()` guarded by a `ready` flag — when ported to Remotion the first frame may not get the
  length (fallback is `|| 380`). The safe approach is to compute after `useEffect`/layout, or precompute a
  constant table, otherwise the first frame shows a misaligned jump
- `f0` is calibrated directly from the straight segment length 96 (`96/len`). The old version used a 40-step linear scan with precision of only 1/40, so node rest positions
  drifted from 74 and the four nodes didn't line up in a column — after changing the path (especially the straight segment length) update this calibration too
- Node opacity only starts fading after `conv > 0.92`, while conv reaches 1 at t=0.74, so nodes vanish by shrinking to 0
  rather than by fading. This is deliberate (being sucked in should not fade out), but if you move the three-stage
  turning point later you'll see nodes suddenly disappear while still having size
- The nodes are porcelain-white placeholder circles with grey line icons (demo: four asset types — page screenshot / shot card / code / sound; grey levels only distinguish the four paths); in production they can be replaced with real source
  logos; keep the accent colour for the data packets and ripples only, don't colour the nodes, or the visual subject at the convergence point is stolen. The mark at the convergence point should sit on an opaque
  disc — curve endpoints and data packets all land at the centre of the convergence point, and an open-shaped mark (such as the Frame Chisel viewfinder) placed directly there will show line ends through its gaps
- The convergence point (332,120), the SVG viewport 440×240 and `overflow:visible` are a bound set of coordinates. Changing the canvas
  aspect ratio means re-marking all of them; the path start at -22 relies on `overflow:visible` to show the section outside the frame
- The caption "From screenshot to showreel" (video-shotcraft tagline) appears after 0.84 — if paired with voice-over, its
  appearance should align with the spoken line landing rather than an animation node

## Reference implementation
demos/ui-entrance/bezier-source-converge-merge/
(BezierSourceConvergeMerge.tsx)
