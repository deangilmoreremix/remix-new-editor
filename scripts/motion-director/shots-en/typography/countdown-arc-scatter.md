---
name: countdown-arc-scatter
one_liner: On a paper dial, 9 equal-sized numbers are laid out tangentially along a large arc; the whole dial sweeps 96°, decelerates and stops hard, the "5" stops at the top of the arc and immediately translates into place as the title's first character, the other numbers dissipate in place with blur, and the title fades in word by word out of blur with the last word turning to the accent colour
use_when: Countdown / time-promise copy ("5 min to install"); a data-reveal beat; short light-background shots that want a "gauge" vocabulary
length: about 3.3s (100f@30fps: sweep ~30f + landing 20f + title forms a sentence + hold 22f; can be compressed to a 33f single beat at the shortest)
energy: high (a 96° large sweep compressed into ~20 frames, pure impact)
---

## Intent
"Installed in 5 minutes" written as a static title card is something nobody believes. Sweeping a dial puts that number inside a
**range**: 45, 35, 28, 22, 17, 10 sweep past and it stops at 5 — what the viewer sees is
"from a lot down to very little", so the number argues for itself. After stopping, the "5" doesn't disappear but **translates into the title's
first character**; a single element completes the identity switch from gauge to copy, and that is the most valuable move in this card.

## Motion core
- Arc layout: the 9 numbers hang on the same centre (the demo is drawn natively at 1920×1080: centre (960,1150), R=700, arc top y=450),
  `ang = (i-6)·24`°, position `x = cx + sin·R`, `y = cy - cos·R`, and each also gets `rotate(position angle)` — **tangential layout**,
  the numbers tilt with the arc as if engraved on the dial face; numbers 112px Helvetica bold tabular, equal size and equal weight
- Whole-dial sweep: first a 5f reverse wind-up +3° (anticipation), then one physics spring 99°→0° (damping 12 / stiffness 60,
  ~24f overshoots past 0° by about 2°, ~34f settled) — "decelerate to a hard stop + one needle rebound" is all of the force of "arriving"
- Fade in/out at both ends of the arc: `op = clamp((70 - |pa|)/22)`; position angles beyond ±70° go to zero, fading in from ±48° —
  **no mask; opacity is computed from the angle**, so the numbers "rotate into view"
- The "5" at `i=6` is designed to have angle 0 (stops exactly at the arc top after the sweep), and takes off 2f before the rebound settles: a 20f asymmetric in-out (EASE.swift)
  translation into the title's first-character slot, with the same curve driving a 112→150px scale-up and rotating back upright. The title's first slot is a fixed-width 0.6em empty space,
  and the flying "5" also uses a centred box of the same width, so the landing point aligns strictly with the slot centre and no element swap is needed
- The other 8 numbers defocus and fade out in place over 28→44f (`blur(out·6)`, **no travel** — travel would compete with the "5"'s translation), starting
  4f before the "5" takes off to clear the way first; during the fast part of the sweep each number gets directional motion blur by tangential velocity (zero once still)
- Dial layering: inside the numbers, a ring of fine ticks rotating with the dial at the same speed (one every 4°, longer at number positions); an accent-colour needle hangs on `rot·0.35`
  and follows the rotation — **a 0.35× differential speed**; two rotation speeds create the "dial + needle" layering; outside, a static hairline arc + an accent-colour reading mark at the top,
  which remain on the poster at 35% after the dial dissipates (the title looks as if it was read off the gauge)
- The three title words each get `blur((1-p)·10)` + fade-in + 0.12em rise, windows 42–56 / 46–60 / 50–66f (overlap = one sentence);
  the last word interpolates from ink colour to the accent colour (vermilion in the demo) over 64–76f — the only colour event in the piece; below, a mono 34px command line adds one product fact (in the demo the real video-shotcraft install command `npx skills add Vincentwei1021/video-shotcraft`; top right is the video-shotcraft wordmark)

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Number sequence | `[45,35,28,22,17,10,5,4,3]`, 24° spacing | Decreasing with unequal steps (45→35→28…) is what makes it look like a real range; an arithmetic sequence reads as a ruler; "5" must be at position i=6 (6 sweep past before it, 2 reserved after) |
| Arc radius | R=700px, centre below the frame (arc top y≈450) | Radius determines the arc's curvature: <R/3 of the frame width and the numbers crowd into a small circle; when the arc is nearly straight the dial feel disappears; the whole visible arc should span 60–70% of the frame |
| Sweep | wind-up +3° 5f → spring 99°→0° (damping 12 / stiffness 60, ~2° overshoot) | Overshoot >4° reads as a spring toy; an inOut ease-to-stop with no overshoot lacks the crispness of a gauge |
| Visible angle window | `(70-|pa|)/22` (fully transparent beyond ±70°) | 22 is the transition width (about one slot); increase to 40 and the numbers drift in and out half-transparent, muddy; set 0 and they just hard-cut into existence |
| "5" landing | 32→52f (20f, EASE.swift), 112→150px, rotates upright in sync | The landing follows immediately on the sweep stop with no rest in between — leave one and it breaks into two actions; the landing point must be the title's first-character slot (the fixed slot width guarantees alignment) |
| Others fade out | 28→44f + `blur(out·6)` | The fade-out starts **before** the "5" takes off, clearing the way first; blur makes the dispersal look like defocus rather than vanishing |
| Tick differential | needle `rot·0.35`; title word windows overlap by about 10f, `blur (1-p)·10`px | The differential is the source of the "dial vs needle" layering; 1.0 (same speed) reads as one flat texture rotating; overlapping word windows make "one sentence", queueing reads as three words each making their own entrance |
| Last-word tint | 64→76f → accent colour | The only colour event in the piece; landing on the last word makes it the sentence's landing point |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- **33f is the extreme compression** (motion-lab original: sweep 17f, "5" landing 6f, the three word fade-ins about 5f each), with information density far above the readable limit;
  the demo has been stretched to 100f. When changing the duration again, scale every time window **by the same ratio** (the proportions have been tuned) — don't stretch only the sweep
- **Re-estimate the title width when swapping copy**: the demo uses `TITLE_EM` (the full-line em width estimated from character widths) to centre the title, and the "5"'s landing point
  is derived from the fixed 0.6em first slot — when the copy changes, only change `WORDS` and `TITLE_EM` and the landing point aligns automatically, but the whole-line centring must be re-estimated
- Dial numbers must be **equal size, equal weight** (demo 112px/700): mixed sizes read as data visualisation,
  not a dial sweeping past
- The angle design of the "5" (i=6 → ang=0) is the foundation of this card: if you change the sequence length or which number
  is the hero, the hero's `ang` must still compute to exactly 0, otherwise it won't be at the arc top when the sweep stops
- Light background first: warm-white paper + ink numbers + a single accent colour is where this card's cleanliness comes from; a dark-background version
  needs the whole palette reworked (and the blur used for the fade-out goes greyish on dark backgrounds)
- Sound: the sweep stop and the landing are two tightly linked rhythm points (only a few frames apart);
  score them with two short sounds of different timbre (a mechanical stop for the sweep, a light settle for the landing); the same sound fired twice
  blurs into one; for scoring discipline see sound-design.md

## Reference implementation
demos/typography/countdown-arc-scatter/
(CountdownArcScatter.tsx)
