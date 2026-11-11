---
name: chart-live-moves
one_liner: Three variants of living charts — oscilloscope-stream (the curve's right end writes in real time + a sudden spike), unit-dot-swarm-regroup (a dot swarm migrates in three acts and gathers into a number), axis-rescale-shock (a new value bursts out of the chart frame, forcing the y-axis to rescale)
use_when: Data storytelling passages; respectively telling "real-time", "every number is a person", "growth that doesn't fit"
length: 165–192f each (5.5–6.4s)
energy: medium-high (data is the plot)
---

## Intent
A chart is not an illustration, it's the plot. The shared premise of all three variants (a tested precedent): **it must be a real chart context** — real axis labels / real data / real copy; greyscale placeholder bars can't test the expressive power of data storytelling.
A oscilloscope-stream: the curve's write point is pinned to the right end bobbing up and down, old data flows out to the left, and midway there's one sudden spike (amplitude 2.2×, the readout jumps bigger and turns accent colour) — "real-time" without saying it, and there's an event too;
B dot-swarm regroup: 320 dots (each dot ≈40 renders) scattered → gather into three clusters (floating real labels Promo/Launch film/Explainer) → line up into columns (real axis labels) → gather into the dot-matrix big number "12,847" — the same batch of dots; the audience can follow one particular dot and watch it fall into line;
C axis blowout: the line climbs normally, the new value breaks through the chart's ceiling rule and bursts out 226px (an accent-colour thick line pushes into the title area, crashing into the top-right KPI number), pauses half a beat, the y-axis rescales with a "whoosh" (old ticks fly out / new ticks slide in / grid densifies / the old line flattens into a horizon), the new value drops back + pops its real value label — using "the axes can't contain it" to perform growth.

## Variants
| Variant | Core action | Use when |
|----|----------|------|
| A oscilloscope-stream | Sample window pans 8px/f + Gaussian-pulse spike (with precursor/aftershocks) + brake to true stillness + after braking, a slow push toward the spike | Monitoring/real-time products: a "living" system |
| B unit-dot-swarm-regroup | Three-act spring staggered migration (stiffness 150, damping 13, stagger 8f), clusters packed tightly in a sunflower spiral, final act dot matrix spelling out a number | User count/composition stories: "each dot is a person" |
| C axis-rescale-shock | Bursts 226px out past the ceiling (rule breach + debris) + three-way linked rescale (ticks change / grid densifies / old line flattens) + 10px shake | Growth-curve highlight: "off the charts" made literal |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Real context | Real title / real axis labels / real units / real readouts | **Prerequisite for entry into the library**: the greyscale versions of all three were cut; after switching to real context, all passed |
| Lead colour | Accent colour marks the event/lead (demo: A coral-red spike, B cobalt-blue Launch film cluster, C terracotta blowout segment) | All grey doesn't read "where the key point is" |
| A flow speed | 8px/f | 5.5 is already perceptible, 8 is clearer; the waveform is a pure function, no randomness |
| B dot count/dot diameter | 320 / 20px diameter (stretched into capsules by velocity during migration, capped at +20px) | Too few dots can't spell a number, too small and individuals can't be seen; over-stretching smears into a blob |
| C burst amount | 226px beyond the ceiling rule | The 80px version wasn't "explosive" enough; really pushing into the title area is what gives the accident feel |
| Closing | All three variants need ≥36f of true stillness | Tail drift in a data chart reads as not finished playing |

## Known pitfalls
- The demo was tuned with video-shotcraft's illustrative render data (A deep-blue oscilloscope screen · render farm fps, B porcelain-white infographic · render volume by film type, C sand-coloured Swiss poster · monthly render volume); the values are illustrative — the parameters are a starting point, not final; re-check with real material on first real use
- All three variants' readouts / ticks / labels are sized for the finished film (≥32px, main readouts 120–176px); charts fill the frame rather than shrinking into a card
- The three variants are three independent techniques, not a package — when using two or more in the same film, each ≤1 time and in separate passages
- A's spike event and C's rescale may happen only once; repetition is cheap
- B's final-act number glyphs must be hand-calculated in advance (dot count = number of glyph positions, used fully to be neat; the reference implementation uses equal-arc-length sampling of a single-line skeleton with two rows along the normal, exactly 320 dots with no overlap)
- Division of labour with dataviz-landscape-open (abstract data-landscape opening): that is opening atmosphere; these three variants are concrete data arguments within a passage
- Sound: A one warning tick on the spike; B one whoosh per migration act; C one riser on bursting out of the frame, one "crash" on the rescale

## Reference implementation
demos/data/chart-live-moves/
(AxisRescaleShockV2.tsx / OscilloscopeStreamV2.tsx / UnitDotSwarmRegroupV2.tsx)
