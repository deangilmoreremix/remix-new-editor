---
name: terminal-3d
one_liner: Three terminal windows scattered through 3D space; the camera flies between windows with a sinusoidal pull-out mid-flight, and at each window a typewriter types the command and the results slide out line by line — a spatial narrative flow of command execution
use_when: CLI/workflow demos for developer products: shooting "three commands" as a three-station spatial journey
length: about 8.2s (246f@30fps; three stations dwelling about 2–3s each + two 30f flights)
energy: medium (flight gives movement, typing gives rhythm; overall a steady technical narrative; ends on the single highlight of ● READY)
---

## Intent
Terminal output is by nature "flat scrolling", an anti-cinematic language; this card spatialises it: each command occupies a physical window in space, and the camera visits window by window as if passing through a server room. The pull-out during flight lets the viewer glimpse that "there are more windows" — a sense of the whole workflow.

## Motion core
- Each of the three windows holds a pose (x/y/z/ry, world coordinates in px), and the camera follows the **inverse transform**: `translateZ(-pull) rotateX(tilt) rotateY(view−ry) translate3d(-x,-y,-z)` — write the window pose table and you get the camera path; each station keeps an 8–10° side-view angle (VIEW table) so on landing the window isn't perfectly square-on, readable and with volume
- Windows are laid out at real screen size (1180×620, commands 52px / output 38px monospace), and are rasterised 1:1 when the camera lands — no outer upscaling, so text isn't blurry (Q2)
- Two flights of 30f each (swift asymmetric in-out), with a `sin(π·u^0.85)×1250px` pull-out bulge mid-flight — at the peak the frame shrinks to ~0.6 and all three windows are in frame, "glimpsing the whole"; horizontal directional blur is added by camera screen speed (active only during flight)
- Depth of field: each window computes focus from its distance to the current station → `blur 0–3px + brightness 0.62–1 + opacity 0.72–1`; when pulling out, the depth of field deepens overall (defocus amount narrows with pull), so in the wide view all three windows are still recognisable as terminals
- Spatial anchors: the floor is an SVG perspective grid drawn line by line with a projection formula fully isomorphic to the world (constant line width, no flicker); behind the focused window is a patch of backlight and under it a pool of accent-colour reflection (both projected to screen from the window centre); behind each window stands a 560px outlined step number, which produces parallax with the window during flight
- The three typewriter essentials: the command types character by character (0.75–1.65f per character with deterministic jitter, an extra 0.6f pause on spaces), a block cursor hugs the end of the text (solid while typing / blinking on an 8f half-period once done), and after typing it pauses 2f before Enter; output is terminal-style rapid printing (each line 6f snappy fade-in + 10px left-shift back into place, 4f between lines), and the status slot spins a braille spinner for ~6f before landing as ✓
- Typing start points TYPE_AT `[8, 94, 184]` are all after arriving at the station — no typing during flight, so attention isn't split; the only bloom in the whole video goes to the third window's ● READY as the title (Q4)

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Pull-out bulge | sin(π·u^0.85)×1250px | Remove it and the flight is a "pan" with no "take-off and landing"; <800 only two windows are visible mid-flight and the sense of the whole is lost |
| Flight/dwell | flight 30f, ~60–90f per station | Dwell must fit typing ~20f + output ~20f + reading time ≥14f |
| Side-view angle | 8–10° (VIEW table) | 0° degenerates into a flat screenshot; >18° the monospace text is squashed by perspective and unreadable (Q6) |
| Depth of field | blur ≤3px, ×(1−0.45) when pulled out | Too much defocus and the whole flight is a blur; the spatial relationships don't read |
| Typing rhythm | 0.75–1.65f/char + 0.6f for spaces | Constant-speed character-by-character typing reads as machine playback; >2.5f/char the viewer gets impatient |
| Output printing | 6f snappy, 4f between lines | A terminal "spits out" its output; a slow slide-in (>12f) reads as PowerPoint |
| Window poses | x spacing ~1500px, z −220~+260, ry ±14–28° | The angle differences and front/back staggering are the source of the "scattered in space" feel; all facing straight ahead degenerates into a flat carousel |

## Known pitfalls
- The camera is implemented as an inverse transform; **the window transform, the world transform and the project() for the floor/backlight must be isomorphic in all three places** — to change poses, only change the POSES / VIEW data; if you change the camera chain, change all three places together, otherwise the floor grid and windows will "slide"
- The command/output copy is an illustrative video-shotcraft production flow (shotcraft init / render / export: build the storyboard → render → mix and export); when swapping in a project's real commands, keep the information structure of "short command, 3–5 lines of output"
- The cursor blink is computed by frame modulo (8f half-period), so changing the duration doesn't affect it; keep the contrast of "solid while typing, slow blink while idle"
- The third window's READY line pops in at ~220f; leave at least ~24f of hold after it, otherwise the final frame doesn't settle
- The cursor must hug the characters already typed: don't use opacity 0 placeholders for untyped characters (that pushes the cursor out to hang in the empty space at the end of the line)
- The whole-stack SpeedBlur is a full-screen SVG filter, enabled only during flight segments when speed >0; zero cost in still segments — don't make it always-on

## Reference implementation
demos/camera/terminal-3d/
(Terminal3D.tsx)
