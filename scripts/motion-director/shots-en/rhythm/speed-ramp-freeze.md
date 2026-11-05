---
name: speed-ramp-freeze
one_liner: A rhythm technique of non-linear frame-number remapping — freeze-and-annotate (flow → freeze with circled annotation → thaw)
use_when: In a card flow / long lateral move, "stopping" on one key point to show it; tutorial explainers, review contexts
length: Freeze-and-annotate 158f total (≈5.3s, freeze section 67f ≥45f)
energy: medium-high (the speed contrast itself is the energy beat)
---

## Intent
Constant-speed flow reads as PowerPoint (R2); fast flow throughout leaves the audience unable to catch the key point (R3). Freeze-and-annotate simply stops in the middle of a movement — circles the key point with a marker, then moves on. The technical root is frame-number remap (slope = rate); the meaning is "pause the lesson and highlight the key point".

## Motion core
- The source animation is constant-speed; output frames non-linearly remap source frames (slope = rate): flow section slope 1 (26px/source frame) → freeze section slope 0 → thaw section smootherstep; **blur is linked to rate** — directional blur by actual post-remap velocity (Polish SpeedBlur, no filter applied when |v|<8px/f), the freeze section renders clean; CameraMotionBlur multi-sampling tints the page texture, so this card doesn't use it
- Freeze section slope = 0 (instant switch, no ease-in — the freeze must be crisp); the freeze frame gives a "pause pressed" signal: 3f shutter white flash, full-frame viewfinder corners pop in, the timecode switches from a running LIVE to PAUSED and stops; an accent-colour marker superellipse circles the target in one 10f stroke (stroke-dashoffset, 1.08 loops, open at the pen lift) + arrow shaft 6f + arrowhead 3f to drive the point home, feTurbulence (scale≈6) gives hand-drawn jitter, followed by a line of 68px bold annotation + hand-drawn underline + signature; the thaw section smootherstep (ease-in start) covers one card in 22f, average slope >1 to compensate the duration, ink fades out over 8f, but a comment pin is left at the target card's corner and exits with the card
- The target card is aligned to screen centre and "picked up" (lifted + scaled up 3–5% + deeper shadow), other cards dim / desaturate; at a card width of 600px the 2x card texture is downsampled, so any card chosen is sharp (the object of gaze/annotation must be sharp and centred)

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Freeze duration | ≥45f | Too short and the gaze doesn't hold (R3: rather slow than fast) |
| Thaw compensation | smootherstep, one card in 22f (average slope >1) | Thaw too slow and the whole film drags; no compensation and the time the freeze ate reads as dead air |
| Annotation stroke | Drawn in 10f + jitter scale 6 | Too slow looks like a loading animation; no jitter looks like mechanical annotation |
| Pause signal | 3f shutter white flash + viewfinder corners + timecode PAUSED | Without a signal the audience can't tell "freeze" from "stutter" |

## Known pitfalls
- SFX frames are pinned to **output frames**, not source frames (the on-screen action happens on the output timeline); foley slot: a marker scratching sound for the freeze (S4) — not added when this card was promoted; add it in real use
- At most 2 freeze-and-annotates per 30s film (restraint principle)
- Parameters were tuned on placeholder material when promoted, not final; re-check after first real use

## Reference implementation
demos/rhythm/speed-ramp-freeze/
(FreezeAnnotateReal.tsx)
