---
name: brand-ink-open
one_liner: Ink-line crosshair draws on → wordmark letterpresses in letter by letter → typewriter subtitle → a full second of stillness, then it floats up and dissolves
use_when: Brand opening; any title sequence that "establishes the name first, then goes into the product"
length: about 2.8s (83f)
energy: low (the starting position, leaving room for later shots to climb)
tags: typography
---

## Intent
The first beat delivers the brand memory point: before any product footage appears, the viewer clearly sees and remembers the name. Quiet, paper-and-ink texture, with one complete moment of stillness.

## Motion core
- SVG crosshair strokes draw on (pathLength dashoffset), vertical first then horizontal, and fade out once drawn
- Wordmark letterpresses in letter by letter: scale presses down from large to 1 + blur→0, and a short glint dash in the accent colour (amber in the template film) flashes across beneath the letters
- The kicker subtitle appears character by character typewriter-style, with an accent-colour block cursor blinking periodically
- The lockup holds completely still for a full 1 second, then as a whole floats up + shrinks + fades out, handing off to the dashboard

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Crosshair draw-on | Vertical line 0→9f, horizontal line 8→18f, fade out 24→34f | Must fade out after drawing; a lingering crosshair fights the wordmark for focus |
| Wordmark per letter | Letter i delay=10+i·3, 12f; scale 1.6→1 (origin center bottom) + blur 6px→0 | "opacity + translate/scale + blur→0" is the film-wide entrance trio formula; without blur it looks hard |
| Kicker typewriter | 0.7f/character (starts at 28, done ~43.4), cursor blinks on a 2f cycle, stops blinking at 74f | 0.7f/character only suits small decorative text; interactive body typing needs 3f/character (compare type-and-filter; the user found it too fast and it was reworked) |
| Brand hold | Frames 46→76, a full 1 second | Hard floor: the user called out "extend the hold by 1 second after it appears" in two rounds (R1); shorter than 1s always gets reworked |
| Exit | 7f float up 40px + shrink 12% + fade out | Exit is faster than entrance: the viewer has already read it, dragging it out deflates the moment |

## Sound
Pin transition-soft on the brand landing (pinned at f12 in the template film), and pin whoosh-fast on the brand→dashboard camera move (f78). SFX are pinned beat by beat to frames and managed in a declarative table (S2); timbres use a cinematic vocabulary, not game-UI taps (S1).

## Known pitfalls
- The hold should go to the moment the wordmark lands, not to an ordinary title card/content card (R1). The hold was once mistakenly added to an ordinary content card and quickly rolled back; for "hold" feedback with an ambiguous referent, confirm the target before acting (P3)
- The opening's energy must start low: the film-wide energy curve is low opening → mid-section build → outro peak; a showy opening crushes the later climb (compare Q8's energy-curve requirement)

## Reference implementation
demos/typography/brand-ink-open/BrandInkOpen.tsx (originally the frames 0–83 segment of template/src/aifl/live/SceneOpen.tsx)
