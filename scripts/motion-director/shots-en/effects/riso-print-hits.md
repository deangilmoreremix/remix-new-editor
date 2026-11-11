---
name: riso-print-hits
one_liner: Misregistration impact frame: riso-misregistration-hit single shot: the instant a title crash-stops it splits into two-colour riso plates, shakes twice and "snaps" into register
use_when: Hit emphasis for titles/cards, the paper-and-ink aesthetic version of a "glitch flash"; a single-shot climax used 1–2 times per film
length: 4s (120f, single shot)
energy: high
tags: typography
---

## Intent
The RGB chromatic aberration glitch flash (part of impact-feedback style C) is phosphor-screen language, clashing with a paper-and-ink
tone. This card provides a print-version substitute: the element splits into two monochrome riso plates (demo: fluorescent pink × blue;
a multiply ink feel rather than a screen phosphor feel, the two plates stacking into dark ink when in register),
like a risograph whose plates are out of alignment, shaking a few times and then
"snapping" into register: the same impact, with the medium imagination switched entirely to ink on paper. Single shot:
split plates at the crash-stop instant, oscillating decay, hard cut into register, stamping one hit. The demo is a video-shotcraft
two-colour riso promo poster ("CRAFT IT / LOUD." + three columns of selling points, with the monochrome Frame Chisel logo mark at the centre of a round stamp).

## Approach
| Style | Approach | Use when |
|----|------|------|
| misregistration-hit single shot | The title crashes in and stops over 8f, splits into two plates offset in opposite directions by ~40px, after 44f of decaying oscillation hard-cuts into register + scale pulse + an "ON REGISTER" round stamp comes down | A hit stamp used 1–2 times per film; the arrival instant of titles/big type |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Two plates | Two riso inks: fluorescent pink #ff4fa3 + blue #1f5fc4 (stacking into deep purple when in register). `mix-blend-mode: multiply` over recycled paper (#f3eee2 + static paper fibres/ink grain), displaced in opposite directions; in register = both plates returning to zero and coinciding | The ghosting from multiply is exactly "ink out of alignment"; screen blending instantly turns into a phosphor glitch; choose complementary hues for the two plates, ideally stacking to near-black in register; don't use pure grey (reads as a shadow) |
| Offset envelope | `offset = A·cos(2πt/18)·exp(-t/60)`, A=(20,8)px, the two plates opposite (300px title); hard cut to zero at frame 72 | Make-or-break point: registering is a **hard-cut jump**, not a gradual convergence: only snapping to zero with ~11px residual left after decay gives the "snap"; a purely gradual convergence can't read as the register beat |
| Crash-in | 8f Easing.in(cubic) crashing in from out of frame and stopping, splitting the plates on the hit frame | The split must be on the same frame as the crash stop: 2f late and it reads as two things |
| Register pulse | On the zeroing frame 4f scale 1.03→1; on the same frame the round stamp comes down scale 1.5→1; on the hit frame a 1.2% whole-page jolt falling back over 10f | The stamp beat; without it registering has no weight |
| Scope | Misregistration only on the title; the background (sun / imprint / info bar) stays in register | The whole frame splitting reads as a glitch rather than print |
| Ending | True stillness ≥40f after registering | R1 |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- **Offset amplitude perceptibility ruling (real renders in this batch)**: the glossary's original ±5px on a 1920-wide frame
  at normal speed is almost invisible to the naked eye: only from 16px per plate/32px total separation is it perceptible (200–300px big titles at 20px/40px);
  when the amplitude is in doubt make an extreme version to show the user (perceptibility first)
- This card overlaps semantically with impact-feedback C (negative impact frame): use this card for paper-and-ink tone films,
  style C for game/anime tones, don't use both in one film (P4)
- Mixing offset directions, one horizontal one vertical (mostly x, a little y), looks more like misaligned plates; purely horizontal reads as
  shaking left and right
- With 300px big type and −0.045em negative letter-spacing, crossbars of adjacent letterforms may just touch (e.g. the top bars of F→T in CRAFT),
  the anti-aliasing on both sides stacking into a hairline bright slit: tighten the preceding letter alone by another ~0.01em so the two strokes overlap

## Reference implementation
demos/effects/riso-print-hits/
(RisoMisregistrationHit.tsx)
