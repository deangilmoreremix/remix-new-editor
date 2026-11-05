---
name: autolayout-gap-dial
one_liner: A spacing dial drives the layout: a row of link blocks with a selection outline + gap spacing annotations; the badge number ticks frame by frame, the blocks are pushed apart by the parameter in real time and then spring back into place; a visualisation of "parameter-driven layout"
use_when: The "change one number and the interface moves with it" selling-point shot for design-tool/low-code products; the category language of "packaging with design-tool semantics"
length: ~5s (150f: selection entrance + anticipation pull-back 10f + loosen 34f + held-breath hold 20f + spring rebound + landing hold)
---

## Intent
"Change the parameter, the UI changes" is the core promise of design tools, but it's usually shot as a before/after comparison of "click the panel → cut to
the result", with the causality cut out. This card shoots the causality as a continuous shot: the spacing badge's
number ticks frame by frame, the link blocks are pushed apart **on the same frame**, and the measurement line stretches in real time: the number is the reins,
the layout is the horse. The selection outline + 8 handles + spacing annotations are all the native language of design tools, and the viewer recognises at a glance
"this is tweaking parameters in a tool". The return trip deliberately uses an underdamped spring overshoot (squeezing tighter than the starting point
before settling), making the "return to place" a springy ending. Division of labour with type-and-filter:
that one is the search causality of "type content → the list converges", this card is the parameter causality of "turn a value → geometric
re-layout".

## Motion core
- **One parameter, gap, controls everything**: block positions are recomputed from gap (the whole row stays centred), measurement
  line width = gap, the badge is pinned to the gap's centre, the large readout at the top and the dial scale: every element is derived from the same value; locked synchronisation
  is this card's entire persuasive power
- Parameter curve: first an anticipation pull-back 12→6 (10f swift, "pull back and then shoot out"); outbound 6→104 over 34f swift
  (asymmetric in-out: slightly fast start, very soft landing); held-breath hold 20f; return spring(damping 9, stiffness 80,
  mass 1.1) deliberately overshooting below the starting point before settling (the overshoot segment compressed ×0.45: 104→about 7 then back to 12, gap is never negative)
- The readout is the protagonist: a 196px thin tabular value at the top + px unit + a 760px dial scale (the ticks scroll horizontally with gap past a central
  gold needle); while turning, the readout changes from white to measurement gold (with ~6f of afterglow), and fades back to white after release and settling; values are displayed in steps of 2,
  with a scale pulse on each tick of 1+0.06·|sin| × a speed threshold
- Nav blocks get horizontal motion blur by their own speed (block speed = (i−2)·dgap/dt, outer blocks have the longest trails), 0 when still
- The selection outline springs in from 26px outside, the 8 handles pop out with a 1.2f staggered overlap, and the whole row's dimensions show live next to the layer name;
  spacing annotation = dashed extension lines ×2 + measurement line with end ticks + following badge, rising with staggered overlap
- Demo art: graphite dark field, two-colour semantics of selection white + measurement gold (the only thing in colour in the frame is the number being turned);
  the camera pushes in very slowly by 2.5% across the whole segment

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| gap range | 12→104px (source footage 20→24, enlarged in the demo per the ruling) | The source footage's range is almost imperceptible to the eye: perceptibility ruling: if it can't be seen, enlarge it into an extreme version; in real use at least 4–5× travel |
| Anticipation | 12→6, 10f swift | Pulling back before releasing winds up the main action; a pull-back >30% reads as the value jittering |
| Outbound duration | 34f swift | Faster reads as twitching; slower than 60f and the binding between the number ticking and the displacement loosens |
| Held-breath hold | 20f | Let the viewer clearly read the "loosest" frame; <12f the peak can't be read |
| Return spring | damping 9 → overshoots below the starting point before settling (overshoot segment ×0.45, tightest about 7px) | The overshoot is where the "release and rebound" feel comes from; damping ≥13 drops straight in, a waste |
| Number step | Step of 2 + tick scale pulse 0.06 × speed threshold | Ticking by 1 is too fine and reads as a millisecond timer; the step is the granular "dial click" feel |
| Motion blur | Horizontal stdDeviation = min(9, |block speed|×0.5) | Only appears in the turning segment; always-on makes the block text unreadable |
| Annotation geometry | Extension lines 58px, measurement line pinned at block bottom +74px, badge pinned to the gap centre | Annotations must be recomputed live with gap: any single lagging spot gives the game away |
| Block widths | Unequal (252/206/278/268/220, height 120) | Equal widths read as a schematic; only unequal widths look like real navigation |

## Known pitfalls
- Tuned on grayscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- The number and the displacement must share the same source on the same frame: the badge's displayed value and the block coordinates are both derived from the same gap; animate them separately and even 1f apart shatters trust in "parameter-driven"
- The demo's large top readout + dial scale share the same source and frame as the layout; in real use, if the frame already has a real tool panel (an inspector value field), delete the large readout; don't report the number twice
- Same-family extensions: gap is only one dimension; radius/padding/rotation can swap in as the parameter with the same grammar, but turn only one parameter per shot; two or more read as random fiddling
- The selection outline + handles borrow "design-tool semantics" (the native language of figma/framer); use with caution in films for non-design-tool audiences; if they can't read the selection, all that's left is blocks shuffling
- Sound: one very light tick each time the badge ticks a step (dial click), one pop when the rebound lands; tick density follows the step

## Reference implementation
demos/interaction/autolayout-gap-dial/
(AutolayoutGapDial.tsx)
Source footage: framer-ai 4.5–5.5s
