---
name: neon-frame-forerun
one_liner: A strongly perspective right-angled neon frame races in from the left edge, drawn from both ends, and takes shape first; the page inside the frame goes from dark to bright, while in-frame components/text drop from 3D space above with matching-shape soft shadows in staggered overlap, finishing their landing in sync with the page lighting up; the background neon cluster (in the demo, a deep echo tunnel of same-shape frames) goes out at the end to give way
use_when: Giving a UI panel an "entrance ceremony" in a dark-field brand film (frame arrives first, content lands after); a feature area's first appearance; opening of a neon/cyber-toned passage
length: frame race-draw ~0.7s + light-up & drop-in ~2.7s + background extinguish and settle ~1s; whole passage 4–4.7s (demo 140f)
energy: medium-high (three layers of action stacked, but all serving the same entrance)
tags: effects
---

## Intent
Set up the frame first, then fill in the flesh: the neon wireframe races around from both ends like runway lights to mark out the position, announcing
"something is going to appear here"; while the page inside the frame goes from dark to bright, components drop from the air with shadows,
landing in place, and the viewer sees the interface being "placed" into the frame. The three layers of action (frame race-draw / page light-up /
component drop-in) must **interlock in sync**: the drop-in progress advances in step with the light-up progress and finishes slightly later,
and the frame light eventually merges into the panel glow. The background neon tube cluster goes out at the end, handing brightness over to the lead to complete the settle.

## Motion core
- Neon frame: a strongly perspective right-angled frame; from the midpoint of the left edge, two white-hot light heads race off separately up and down (20f, swift: fast start,
  braking and colliding at the midpoint of the right edge with a flash); the tube uses four stacked stroke layers for glow (wide soft halo / medium halo / colour core / white-hot core),
  no blur filter, cheap and sharp; once formed, the core line recedes to a hairline and the frame light merges into the panel's rim glow
- Page light-up: only after the frame closes does the page float up out of black (16–30f), then go from dark to bright (24–84f smooth),
  while a layer of cool-purple dark overlay retreats from the left edge to the right, reading as "the neon lights up the page"
- Component drop-in: **true 3D hovering**: the panel and components are all in preserve-3d, components at translateZ 120–170px,
  casting same-shape silhouette soft shadows on the panel (the higher, the bigger, blurrier and fainter, offset to the lower right); brightness uses brightness on leaf nodes,
  never filter/opacity on a 3D parent (it flattens the 3D). Each piece takes 24f accelerating fall + soft landing,
  landing points 54→104f staggered in order "sidebar top to bottom → main area top to bottom" (dense first, then sparse), finishing ~20f after the light-up
- Background: 5 echo layers of the same frame in depth (translateZ receding, each layer enlarged) form a neon tunnel;
  after the frame closes they "strike" layer by layer from near to far (the deterministic flicker of fluorescent tube ignition); at the end the middle goes out first, both ends later (94–118f)
- Camera: rotateY −30° → −12° (0–96f EASE.out long deceleration), with an extremely slow further 1.5° turn during the hold

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Frame race-draw | 20f, two ends racing towards each other (swift) | Single-head drawing reads as drawing a picture; >30f the viewer can't wait for the content |
| Hover height | translateZ 120–170px, shadow tightening with height | Precedent: height too small + starting too early = shadow imperceptible (v3 round-1 rework enlarged 1.7x and delayed) |
| Drop-in window | 24f per piece; landing points 54→104f, finishing ~20f after the light-up | Drop-in finishing before the light-up = furniture landing in a dark room; lagging too much reads as two separate scenes |
| Staggered overlap | Offset start points, falls overlapping in parallel (EASE.out distribution, dense first then sparse) | Serial waiting was rejected (general precedent for drop rhythm) |
| Background extinguish | Middle out, ends last; each layer 6f flicker-out, 7f between layers | Without extinguishing, the lead doesn't stand out; all out in the same frame reads as a power cut |
| Drop-in granularity | Card/row level (brand, 4 nav items, greeting, 3 stat cards, 4 task rows) | The finer the granularity, the more expensive; the fewer the elements, the bigger and more readable each one |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Hovering drop-in = the core signature of the clickup language (a validated taste signal); this card
  shares the FloatWrap pattern with graze-face-tour: an imperceptible shadow is as good as not doing it
- Division of labour with brand-frame-snap: that card is a beat scene of a brand frame clicking into
  position; this card is an entrance ceremony of frame-first + content drop-in, where the frame is only the prologue
- Note on a derived direction: the viewing-angle rotation variant (camera rotating in an arc left→right + simultaneous drop-in)
  was once rejected as "change it and let's look again" (requiring all components to drop in simultaneously), and has been folded into the neon-frame-orbit-drop card

## Reference implementation
demos/ui-entrance/neon-frame-forerun/
(NeonFrameForerun.tsx)
Source footage: clickup-30.mp4
