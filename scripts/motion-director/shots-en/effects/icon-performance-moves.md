---
name: icon-performance-moves
one_liner: Icon performance: attention-bounce (an icon bounces repeatedly with increasing height + squashes on landing + the camera is drawn in)
use_when: Half-screen icon close-up sections; introducing a new feature
length: 156f (5.2s)
energy: building-up lead-in
tags: interaction
---

## Intent
The first entries in the library's icon animation category: the icon is a performer the camera shoots up close, not a
micro-interaction in a UI corner. attention-bounce is macOS Dock vocabulary: the video-shotcraft
app icon in the Dock jumps in place 4 times, each higher than the last (0.35→1.2× icon height), squashing on every landing
(last jump 1.2x wide 0.8x tall) + ripple splash dots; neighbouring icons gradually go out of focus, and on the highest jump the camera gently pushes
in 8% toward it (drawn in); after it settles the "New in Shotcraft" feature panel springs open: cutting "user attention"
into the narrative.

## Approach
| Style | Approach | Use when |
|----|------|------|
| A attention-bounce | Projectile bounces (duration ∝ √height) increasing + in-air speed stretch + 2f squash on landing + ripple splash dots, neighbours rack-focus out of focus, on the peak jump the camera pushes in to scale 1.08, settling triggers a badge + the panel springs open | Introducing a new feature: "look at me" → the camera looks at it → it opens a panel |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Icon size | 360–400px tall (half-screen close-up; demo icon 360) | Nobody notices a small corner icon performing: the performer must take centre stage |
| Increasing bounces | 4 jumps 0.35→0.6→0.85→1.2× icon height, airborne 14/18/22/26f (∝ √height) | Jumps of equal height read as loading; only increasing height is "shouting louder and louder"; duration not changing with height reads as weightless |
| Landing squash | 2f contact, squash amount increasing 0.1→0.2 (last jump 1.2x wide 0.8x tall), last jump settles with a damped cosine | No squash = no weight |
| Camera push-in | Last jump 72–90f smooth push 8%; neighbours defocus to 7px and desaturate 30% over 30–96f | The camera move acts out the viewer's perspective of "being drawn in" |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- bell-swing-alert (bell swing) from the same batch was eliminated without comment: whether hanging-pivot swing icon
  performances suit is doubtful; for new icon performances prefer bounce/burst types
- The first version went out of frame (the last jump's apex poked out the top); compute the bounce height and the top margin in pixels first
  (demo: ground 960, icon 360, last jump apex 168px, about 119px after the 8% push-in)
- Sound: one "duk" per landing with rising pitch, a light "ding" as the panel pops out

## Reference implementation
demos/effects/icon-performance-moves/
(AttentionBounce.tsx)
