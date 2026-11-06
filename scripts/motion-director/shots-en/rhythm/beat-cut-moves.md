---
name: beat-cut-moves
one_liner: The hard cut as a percussion instrument — paparazzi-flash freeze: three white flashes, each hard-cutting to a different crop of the same frame (wide → card → close-up); the shutter aftershock settles and it holds on the close-up to close
use_when: Highlight passages where the "cut" itself is played as a drumbeat; awards-photo-burst ceremony, crowning a key piece of information
length: 140f total ≈4.7s (30f live footage + three flashes + 70f hold)
energy: high
tags: transition
---

## Intent
The library's rhythm vocabulary has only ever handled the rate "within a single movement" (speed-ramp-freeze freezes and thaws within the same take) and "how long to hold after landing" (the R-series breathing precedents); there was no word for **how the cut points between multiple shots are arranged**. This card fills that gap: the hard cut uses no transition at all, and the intervals between cut points are themselves the score — three white flashes, intervals tightening (22f→18f), read as a shutter burst (A). It does not conflict with the R series: R governs the hold after landing, this card governs cut-point arrangement, and the cut string must be followed by a sufficient hold to give the breath back. Note this is a deliberate exception — the rhythm-preference precedent is one-directional "slow down"; the harder the hard-cut string cuts, the longer the hold after it must be compared to normal.

## Variants
| Variant | Approach | Use when |
|----|------|------|
| A paparazzi-flash freeze | Three white flashes each hard-cut to a different crop of the same material (wide → card close-up → "Take 1" close-up); before each flash a focus frame locks onto the next crop; the shutter aftershock settles; the third flash holds on the close-up to close (demo: video-shotcraft's "Shot of the Year" medal card, backdrop is a tiled video-shotcraft logo / wordmark) | Ceremonial highlight moments: awards photo burst, crowning a key number / key line |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Three flash cut points | 30/52/70 (intervals tightening 22f→18f); before the flashes, 30f of slow push-in on "live footage" (small flashes from other cameras on the backdrop) to set off the post-flash freeze | What precedes the flashes must be alive; with dead material throughout, three flashes don't read as "freeze" |
| White flash layer | Each flash opacity 0.95→0 with a 4f ease-out decay; on flash frames, ±2px seed-hashed full-screen shake | Starting at 0.95 is what gives the flashbulb pop; decay >6f becomes a soft-light transition and loses the shutter feel |
| Shutter aftershock | Cut-in view scale 1.03→1 over 6f ease-out + −16px settle to zero | The aftershock is "jolted a bit by being photographed"; without it the three flashes read as slideshow page turns |
| Three crops | Same frame, change the CSS zoom focus: 1.0 wide / 1.6 card / 2.8 close-up ("Take 1") | Moving progressively closer has narrative direction; out of order (close-up → wide → close-up) reads as an editing mistake; don't let crop edges slice through half a line of text |
| Focus preparation | 8f before the next flash, the focus frame shrinks from 1.3× to the next crop's extent (projected in screen coordinates), turning champagne colour to lock 3f before the flash | This is the "ready beat": the audience knows in advance where the next shot will be, so the flash feels like a shutter being pressed |
| Final close | After the third flash, hold the close-up for 70f, with only an extremely slow 1→1.015 push-in + HUD "SAVED" fading in | Three flashes are a heavy hit; the hold must be more than twice the usual; the freeze is a photo — add no in-frame motion |

## Known pitfalls
- **Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final; re-check with real material on first real use**
- **Strongly sound-dependent** technique: cut points must be pinned to beats in the audio track, one shutter click per flash; a silent version is just the image jumping around randomly; pin frames per sound-design.md §4.5 relative to the shot start, not to absolute frames
- The three crops must be "progressive closing-in on the same frame", not three unrelated images — the audience must always recognise who this is throughout the flash burst; don't use this variant with material spanning products/scenes
- At most 1 cut string per film (P4 restraint principle): this is the loudest hit in the film; if it appears a second time, the first was wasted
- The rhythm-preference precedent is one-directional "slow down"; this card is a deliberate exception — the post-cut hold (70f) is a floor, not a suggestion; err on the side of more
- A true hard cut = when the frame falls in an interval, render the corresponding view, with no transition frames at all; slip in a 2f cross-dissolve and it's no longer a hard cut — the beat feel immediately blurs

## Reference implementation
demos/rhythm/beat-cut-moves/
(PaparazziFlash.tsx)
