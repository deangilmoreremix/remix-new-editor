---
name: crash-zoom-punch
one_liner: A one-beat crash zoom from the wide shot to a target close-up (6f), with one of two landings — overshoot-and-rebound (elasticity) or slam-stop with screen shake (weight)
use_when: The "call-out" shot in a feature section — pins the viewer's gaze onto the target card/module in a single beat; use the slam-stop for the emphasis level
length: about 0.5s of action + holds before and after (action 6–11f, ≥30f pre-hold to establish the wide shot, ≥45f post-hold to read the close-up)
energy: high (instantaneous impact, not sustained high energy)
tags: effects
---

## Intent
A slow push-in (spotlight-hero-card) says "please look"; a crash zoom says "look at THIS!" — within one beat
it slams from the wide shot into the close-up, and the eye has no choice. The landing texture comes in two variants: the rebound is elasticity
("look at this"), the slam-stop with shake is weight ("this is the one"); choose by emphasis level.

## Motion core
- zoom 6f ease-in hard acceleration (e.g. 1→2.6), with cx/cy converging on the target centre with the same ease-in
- Rebound variant: after the zoom overshoots, it pulls back 3–6% over 5f (2.6→2.45)
- Slam-stop variant: from the arrival frame the camera shakes at high frequency + exponential decay (amp 14px, τ≈1.8f, settled within 6f),
  no rebound
- Motion blur **covers only the crash-zoom segment** (the slam-stop shake segment stays as a sharp shake): the demo uses hand-written time sampling
  (shutter ≈200°, sub-frames layered with equal-weight opacity 1/(i+1), sub-frame count adapting to this frame's displacement,
  capped at 40); sampling is set by "echo spacing ≤ text height" (Round A ruling); `<CameraMotionBlur>`
  also works, but its semi-transparent overlay layers turn the base colour grey-yellow on near-still frames. The page's small text in CrashZoomReal is only ~14px,
  so the echo spacing is pushed down to ≤6px (cap 44 layers), and on high-speed frames each layer additionally gets ≤4px of micro-blur based on spacing, smearing the discrete echoes into a continuous streak
- 6–8f before the crash zoom there is a ~3–4% anticipation pull-back (step back, then charge); the wide-shot hold segment gets a ~2–3% very slow creep
- Staging of the rebound-variant demo (CrashZoomReal): a browser window on a warm-black ember stage (leaning back 11°, orange backlight +
  floor reflection); before the crash zoom, four orange corner brackets converge from 150px outside to lock onto the target card (calling it out in the wide shot first), and the crash zoom uses the same curve to pull the lean-back
  upright; on the arrival frame there is one warm exposure flash (exponential decay ~8f), the surroundings are darkened by 86% + a rim light on the target card; once the rebound settles the camera smoothly
  moves left 320px to shift the card to the left side, and a set of large readouts lands in the right column (232px number + caption); the final frame is a complete poster
- Staging of the slam-stop-variant demo (CrashImpactReal): a lime dark-field "tactical HUD" — the real page cropped into a front-on monitor screen, the stage covered with a faint grid;
  a fluorescent viewfinder scans and jumps cells in the wide shot (card1 → card5 → card4, 8f snappy each), tightens and locks over 28f and shows a LOCK tag before the crash zoom
  (0.76→2.35, sub-frame spacing ≤8px, cap 36); the arrival frame is the "impact frame" — outside the card 1f fluorescent → 1f afterglow → near-black (the only full-frame impact in the whole video),
  and two fluorescent shockwave rings expand outward from the card edge; the card does not lift or glow (it lands solid). After the shake settles, a scan line sweeps across the card face once, and the HUD readouts in the left and right columns
  (TARGET / OWNER / STATE and a 250px monospace 「P0」) land with staggered overlap; the 126f tail segment holds for 42f

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Crash zoom duration | 6f (4–8f) | >10f reads as an ordinary push-in and the impact is gone |
| Target zoom | 2.4–2.8 | Compose the end frame so the target card fills 60–75% of the frame |
| Rebound amplitude | 3–6% of the zoom | Too large reads as a spring toy |
| Shake envelope | 14px·e^(−t/1.8) | Amplitude must clear the visible threshold (perceptibility ruling); >20px reads as a glitch |

## Known pitfalls
- The end point must be a high-resolution texture slot (card4-hires level) — after the crash zoom it is in close-up the whole time,
  and a low-magnification screenshot blurs the text (Q2); process the end point first with Q2's high-resolution rasterisation technique
- Don't mix the two variants: a shake after a rebound gives it away; at most 2 crash zooms per video (in the spirit of P4's technique de-duplication)
- Parameters were tuned on placeholder material before being promoted; they are not final for real use — re-check after the first real use

## Reference implementation
demos/camera/crash-zoom-punch/
(CrashImpactReal.tsx / CrashZoomReal.tsx)
