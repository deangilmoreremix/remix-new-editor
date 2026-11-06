---
name: gauge-readout-moves
one_liner: Two variants of gauge readouts — needle-sweep-selftest, full-arc needle sweep (on ignition self-test the needle flicks across the full arc then drops back to the true value), and tape-scroll-fixed-pointer, scrolling tape with fixed pointer (the needle doesn't move, the scale tape scrolls past + sprint and brake)
use_when: Dashboard opening ceremony / performance metric reveal; A for multi-gauge power-on feel, B for a single metric's big jump
length: A 140f (4.7s) / B 150f (5s)
energy: medium-high (mechanical-ceremony type)
---

## Intent
Turn "reporting a value" into the gauge's bodily action: A is a car ignition self-test — the needles of three side-by-side gauges in a card first "whoosh" across the full arc (270°), the ticks they sweep past light up in sequence, then spring back down to freeze on the true value; the multiple gauges are staggered into a wave, and on the frame they settle the value below each dial pops out — first light up the range, then report the number, a sense of opening oath; B is the grammar of an aircraft airspeed tape — the readout window + pointer pinned to the frame's centre line, a scale tape spanning the full frame height scrolls past behind the window as a whole, first crawling slowly against the old limit, then after an upgrade sprinting (peak ~100px/f), at the end a spring brake with swing-back overshoot; "the world moves, the needle doesn't" — the size of the value becomes visible distance travelled.

## Variants
| Variant | Approach | Use when |
|----|------|------|
| A needle-sweep-selftest | Dial face and outer ring light up → needle outbound 12f ease-out flicks across the full arc (the ticks swept light up in sequence and fall back within 24f) → spring return with ~8° overshoot swing-back lands on the true value; three gauges staggered 4f; on the settle frame the value below the dial pops out with overshoot and the metric name fades in; after everything settles, the self-test pill Running self-test… → Ready to render | Dashboard opening / system-ready ceremony |
| B tape-scroll-fixed-pointer | Full-frame-height scale tape translates: slow crawl pressing against the old limit line → limit line breaks → anticipation pull-back 5 → sprint 22f (peak ~100px/f, vertical motion blur) → spring brake overshoot swing-back to the stop position, the new limit bug stops at the pointer; the readout in the window refreshes in sync | A single metric's big jump (performance doubling / quota increase) |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A sweep amplitude | Full scale 270°, return as soon as it hits the top | Sweeping only to the true value = no self-test ceremony; full arc then drop back is "light up the range first"; ticks swept on the outbound (including the red zone) light up in sequence |
| A overshoot | Drop back with ~8° swing-back (spring damping back-calculated from travel) | Without overshoot it reads as a digital watch; overshoot = the mass of a mechanical needle |
| A stagger | 4f/gauge (left → middle → right) | Sweeping together reads as copy-paste; staggered becomes a wave |
| B sprint speed | 5px/unit, peak ~100px/f (big-jump section) | Too slow reads as a constant-speed crawl and "the world moves" doesn't hold; the longer the tape the faster, and the more it needs vertical motion blur |
| B brake | spring overshoot (overshoots then springs back to the stop position) | The swing-back from the original vocabulary proposal is the source of the "clunk"; a direct stop is a waste |
| True stillness | After stopping, ≥30f fully locked (A's last gauge settles ~66f, B locks to constants at 110f) | Tail drift is the worst sin for pointer-type shots |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final; re-check with real material on first real use
- From the same batch, ring-close-overfill (ring closing with overfill) got "revise and look again" with no follow-up note — ring-progress types are pending a redo; don't rush to merge it in as a third variant
- A's dials are self-drawn SVG (arc ticks + needle); when applying to a real dashboard in real use, prefer a close-up of an existing gauge component on the page, and only build one if there isn't one
- Sound: A one "whoosh" on the needle sweep + a "tick" on settling (one each for the staggered gauges); B a low-frequency rolling sound during the sprint, a dull "clunk" on the brake

## Reference implementation
demos/data/gauge-readout-moves/
(NeedleSweepSelftest.tsx / TapeScrollFixedPointer.tsx)
