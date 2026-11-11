---
name: research-card-stack-scroll
one_liner: Dark paper cards fly in one every 12 frames along a lower-right axis to stack at the centre, landing with a 1-frame squash; only the top card renders title + authors + abstract fully sharp, while cards below get progressively blurrier and darker with stack depth, showing only the title bar; a horizontal grid in the background moves down in sync as a speed reference
use_when: Conveying scale like "read a huge amount of material / processed vast numbers of documents"; capability shots for research, retrieval and batch-processing products
length: about 4.8s (144f@30fps)
energy: medium-high (constant speed, high frequency; no burst but sustained pressure)
---

## Intent
What we want to say is "quantity", but giving 13 cards at once reads as a wall. So make it a pipeline instead: cards come in one by one, each one is
read (the top card is always the one rendered in full), and once read it sinks into the stack and blurs. What the viewer feels is continuous
throughput, not a static pile. The background grid moving down at the same speed is the speed reference: without it, the stacking would read as
"cards shrinking in place".

## Motion core
- The timeline uses real frame numbers rather than normalised t: internally `F=144`, each card's local time is `e = t*144 - i*12`,
  and all choreography (entrance, stacking, depth) is hard-coded in beats of `PER=12` frames
- The entrance is a short 6-frame action: `seg(clamp((e+6)/6), 0, 1, E.outCubic)`. Note the start is `e=-6`,
  i.e. the card starts flying 6 frames before its own beat arrives, `translateY(-40→0)` + `scale(0.94→1)`
- Landing squash: while `e ∈ [0, 1.6)` the y-axis scale is additionally multiplied by 0.97, squashing for only 1.6 frames: too short to read as
  deformation, it reads only as "slammed in solidly"
- Stack drift: after landing `drift = e/12*30`, each beat moves 30px down and `XOFF=9`px right, forming an axis slightly
  towards the lower right; the presence of this axis makes the 13 cards not a concentric pile but a stack with thickness
- Depth falloff: `depth = min(1, drift/(30*3))`, fully attenuated within three beats, `blur(depth*4)` +
  `brightness(1-depth*0.25)`; further down, `(drift-30*3.2)/(30*1.6)` pulls opacity to 0 for recycling
- A single focus: `focus = floor(f/12)`; only the card with `i === focus` shows the body (author line + 4 abstract
  skeleton lines); the other cards' body is simply `opacity:0`, leaving only the title: there is always exactly one "card being read"
- Background grid: `translateY((f/12*30*S) % 24)`; its offset is derived from the same `GAP=30` as the cards' drift,
  so the grid and the card stack move at exactly the same speed; taking it modulo 24px makes it loop seamlessly

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Beat | PER=12 frames/card, 13 cards | 12f is the lower limit of "tight but legible"; <8f the titles can't be read in time, >20f the sense of scale collapses into a card-by-card showcase |
| Entrance travel | 6 frames (outCubic), lead of -6 frames | Travel is only half the beat → each card has settled before the next one comes; with travel ≥ PER, two cards are in flight at once |
| Entrance offset / scale | `translateY(-40→0)`, `scale 0.94→1` | 40px relative to a 96px card height is small: the card "drops in" rather than "flies in"; the scale difference is only 0.06, any larger reads as a popup |
| Landing squash | 1.6 frames, y-axis ×0.97 | 3% is just perceptible; >6% or duration >3f looks like rubber deformation |
| Stack axis | Each beat y+30px, x+9px | The 9/30 ratio sets the axis slope; with x at zero it becomes a concentric pile straight downward and the sense of thickness disappears |
| Depth falloff | `depth = drift/90`, blur 0→4px, brightness 1→0.75 | Fully attenuated within 90px (3 beats) → there are always only about 3 "half-sharp" cards on screen; lengthening the falloff distance makes the blurry stack below too thick and the frame dirty |
| Recycle window | Fade out from `drift > 96px`, reaching 0 within 48px | Recycling too early shows cards vanishing in the middle of the frame; too late and all 13 are on screen, raising DOM and blur cost |
| Content coordinate system | Logical 420×250, overall `scale(min(W/420, H/250))` | All pixel values are written in the logical coordinate system, so changing canvas size needs no re-layout; card 296×96 and font size 9.5px are logical values |

## Known pitfalls
- Card count and beat are bound: `13 cards × 12 frames = 156 frames > F=144`; the last two cards are still mid-entrance at t=1,
  so the last frame isn't a clean still. For a freeze-frame ending, keep the card count within `F/PER - 1` (≤11 cards at a 12-frame beat)
- `focus = floor(f/12)` can exceed the card count upper bound (at f=144 focus=12, which is exactly the last card); after adding cards
  or changing the beat, make sure focus doesn't point to a non-existent index for long, otherwise you get "no card is sharp"
- All time constants are hard-coded on the assumption of 144 frames (`F=144`, `fr=f/F`). Changing the duration requires changing F as well,
  otherwise the beat stretches with the duration and the tightness of 12 frames is lost
- The titles are 13 realistic placeholder paper titles, with `preprint:24xx` numbers generated from the index; in real use replace them with the project's
  real document titles; the abstract skeleton bar widths generated by `rand(i*5+k)` are deterministic pseudo-random; don't replace with Math.random
- Dark cards (`INK` fill + `#2A2A2A` stroke) on a `#FAFAFA` light background are the precondition for this contrast; if the card colour
  is made lighter, the `brightness(0.75)` depth falloff is almost invisible and you need to use opacity or greyscale falloff instead

## Reference implementation
demos/ui-entrance/research-card-stack-scroll/
(ResearchCardStackScroll.tsx)
