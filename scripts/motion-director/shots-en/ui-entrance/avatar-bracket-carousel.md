---
name: avatar-bracket-carousel
one_liner: Fill-in-the-blank "Your ___ agent" layout. A four-corner focus bracket is pinned in the sentence and stays still while an avatar queue rotates vertically inside it three times on a spring. Entering the bracket an avatar scales up and sharpens; leaving it, the avatar shrinks, fades and blurs by distance. The role label changes in sync, and at each switch the focus bracket breathes by 7%
use_when: Enumerating capabilities as "one slot, many roles"; the core one-sentence shot for team / identity / preset / persona products
length: about 5.2s (156f@30fps)
energy: medium (three evenly spaced switches form a steady metronome; the bracket pulse is the only decorative move)
---

## Intent
"Our agent can be a director, editor, animator and sound designer" laid out as four lines is just a list.
Squeeze it into a single slot in one sentence and it becomes one promise plus four proofs: the sentence stays still, only the person in the slot changes. The four-corner focus bracket is the key to this device
— it takes no part in the rotation, but it nails the viewer's eye to that 92×92 box, so the four changes read as
"the same position" rather than "four avatars floating past".

## Motion core
- The position value `pos` is the sum of three springs: `[0.24, 0.46, 0.68].forEach(s0 => pos +=
  seg(t, s0, s0+0.14, k => E.spring(k, 0.25)))` — not an index jump but a continuous value, so at any
  moment you can compute how far each avatar is from the slot
- Distance drives everything: `d = |k - pos|`, then `scale = max(0.5, 1-d*0.38)`,
  `opacity = max(0, 1-d*0.62)`, `blur = min(3, d*2.4)`, `translateY = (k-pos)*76` —
  all four properties come from a single distance value, so entering/leaving changes are naturally in sync with no separate timing
- The queue is stacked, absolutely positioned on a 0×0 anchor at `slot` (`left:-29px, top:-29px` self-centres);
  vertical displacement comes entirely from `(k-pos)*STEP`; avatars outside the bracket are still rendered, just hidden by opacity and blur
- The entrance is another layer on top of the rotation: `el.style.opacity = op * seg(t, 0.02+k*0.03, 0.12+k*0.03)`
  — the four are staggered by 0.03 and build the queue within the first 0.15; after that this term stays at 1 and the rotation takes full control
- The role label has its own system but shares `pos`: `opacity = max(0, 1-|k-pos|*2.2)`; the falloff slope 2.2 is much steeper than
  the avatars' 0.62 — a label disappears entirely beyond 0.45 slot-distance, so two labels are never on screen at once
- Bracket breathing: `breath = Σ sin(seg(t, s0, s0+0.1) * π)`, take `min(1, breath)`, multiply by 0.07
  and add to scale; the sine envelope makes the pulse peak in the middle of the switch move and return to zero when it ends

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Switch points | 0.24 / 0.46 / 0.68, interval 0.22 (≈34f / 1.14s) | The interval is the time "to read one role"; <0.12 the viewer can't read the label, >0.3 the metronome feel falls apart |
| Switch travel | window 0.14 (≈22f), `E.spring(k, 0.25)` | Travel takes 64% of the interval → about 12f of rest; damping 0.25 gives one clear bounce, lower it and it wobbles twice and interferes with the neighbouring switch |
| Step | STEP=76px (bracket 92px, avatar 58px) | The step must exceed the avatar diameter or neighbours bite into each other; 76/92 means the departing avatar still shows a corner, hinting at the queue's existence |
| Scale falloff | `1 - d*0.38`, floor 0.5 | Shrinks to 0.62 at one slot distance; a steeper slope makes the exit more decisive, but the 0.5 floor is hit sooner and the queue becomes "two sizes" |
| Opacity falloff | `1 - d*0.62` | Fully gone beyond 1.6 slots → about 3 visible on screen at all times; dropping the slope to 0.3 shows all four in the column, weakening the bracket's "lock" meaning |
| Blur falloff | `d*2.4`, cap 3px | Blur is a depth-of-field hint; slope 2.4 gives neighbours about 2.4px; >4px neighbours blur into colour blobs and the queue no longer reads as avatars |
| Label falloff | `1 - d*2.2` | The slope must be significantly larger than the avatars' 0.62 — labels are text, and two half-transparent sentences overlapping are the hardest thing to read |
| Bracket pulse | window 0.1, `sin(·π)` × 0.07 | 7% is the amount for "it clicked in"; >15% the bracket itself becomes the star and steals attention from the avatar change |

## Known pitfalls
- Four avatars for three switches: `pos` ends at 3, exactly the last one. Adding a fifth requires a fourth switch (and
  the last switch must finish before 0.86 to have rest time), otherwise the end of the queue never enters the bracket
- The switch points are a hard-coded array appearing in two places (`pos` accumulation and `breath` accumulation). Changing the beat means changing both;
  missing one causes "bracket pulse and avatar change out of step"
- The gap between the entrance stagger and the first switch is only 0.09 (entrance ends 0.15 → switch 0.24). Adding avatars pushes back
  the entrance end point (`0.12+k*0.03`); at 5 or more the first switch must be moved later
- The avatars are white line icons on neutral grey gradient circles lit from one side (grey levels are only to distinguish queue items); the accent colour is used only on the focus bracket's
  four SVG corner marks (and one dot in the label chip) — after switching to real avatars keep this division of roles; the avatars themselves should not compete for colour
- The focus bracket SVG's four paths and 92×92 viewBox are hard-coded coordinates (`M4,26 L4,4 L26,4`, etc.). Changing the
  bracket size means re-marking the whole set; changing only the container width/height will distort the corner marks when scaled
- The sentence "Your ___ agent" (demo: the video-shotcraft agent crew Director / Editor / Animator / Sound) is centred with flex + gap:22px, and the slot width is fixed at 92px so the sentence does not reflow when
  the avatar changes — but when switching to a Chinese sentence, confirm that changes in character width on either side of the slot don't push the slot off the frame centre

## Reference implementation
demos/ui-entrance/avatar-bracket-carousel/
(AvatarBracketCarousel.tsx)
