---
name: dataviz-landscape-open
one_liner: Dark-field tributary line-bundle landscape opening: many flow lines converge into a main trunk, fictional ID labels float on the lines, the camera flies over slowly with heavy depth of field
use_when: Brand-level abstract opening (the "data universe" metaphor), followed by a bright-field product segment or wordmark; division of labour with glow-flyline-moves: that card is a connecting-line narrative between cards within a section, this card is a full-frame landscape for openings only
length: 5–8s (opening atmosphere segment, ≤1 per film; demo 180f)
energy: starts low and rises gently (the starting position, leaving room to climb later)
tags: data, camera
---

## Intent
A brand-level opening category proven by the Linear Releases launch film opening: shoot the data world behind the product
as a **dark-field landscape**. Tributary line bundles converge from deep in the frame into one main trunk (the metaphor "countless workflows
converge into one product"), and the sense of reality comes from three things: ① fictional issue/task ID labels
float on the lines (the demo uses video-shotcraft shot numbers + camera-move names: each tributary is one shot, converging into one finished film) (the viewer recognises "this is the kind of thing I see every day"); ② heavy depth of field: a large out-of-focus near layer
flows past, the mid-ground labels are sharp and readable, the far layer fades out; three layers of depth make flat SVG read as space;
③ the camera flies over slowly and steadily: this is an atmosphere segment, not a showing-off segment; the sense of speed is left to the later shots.
Compliance basis for hand-built UI: a non-replica scene (this image does not exist on the page), so per core principle 1
(revised) it goes through the quality + clarity-of-expression threshold.

## Action phases
| Phase | Frame range (@30fps reference, demo 180f) | Content |
|------|------|------|
| 1 Growth | f0–70 | The main trunk draws on from near to far racing toward the vanishing point (36f out-cubic, with a glowing pen-tip dot); tributaries grow in from off-frame on both sides with a 4–6f staggered overlap and merge tangentially |
| 2 Flyover | f0–180 | The camera flies forward low along the river channel + drifts sideways gently (overlapping the growth phase); labels stand up f44–96 with non-uniform staggered overlap; on the lines that have finished growing, bright pulses flow toward the convergence point |
| 3 Handoff | f104–180 | Labels stop being added; a burst of accent-colour light brightens at the vanishing point, a line of large headline drops from the sky; the camera bezier-decelerates to a gentle stop, hold ≥30f |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Bundle size | 8–14 tributaries merging into 1 main trunk (demo has 11, including 1 near-ground tributary that skims past the lens) | More than ~16 reads as a screensaver/tech template; the main trunk must be unique (the landscape version of the single-protagonist principle) |
| Landscape projection | Lines are drawn on a true perspective ground plane: pinhole projection `sx = 960 + F·(X−camX)/Z'`, `sy = horizon + F·camH/Z'`, F 1100, camera height 220, horizon at 0.39 frame height | With flat SVG panning you have to hand-fake three layers of parallax; with true projection, near-large/far-small, parallax and convergence all come for free |
| Convergence topology | Tributaries merge into the trunk tangentially via bezier (tangent at merge point = trunk tangent); the trunk runs so the vanishing point lands in the right 1/3 of the frame | Perpendicular intersections read as a circuit diagram, not a river system; a centred vanishing point makes a dead composition |
| Depth of field | Layered segment by segment by projected depth: Z' <~1000 goes into the blur layer (blur 11px, line width ×1.3), mid-ground sharp, Z' >2600 starts to fog and fade; line width = world line width·F/Z' | Without a defocused near layer it reads as a wireframe; without fog in the far layer everything piles into a bright clump at the horizon |
| Camera flyover | Forward 950 world units / 180f, bezier(0.3,0.3,0.55,1): already flying at the start, decelerating to a gentle stop at the end; plus a gentle lateral drift −140→110 | Too fast and it becomes a chase shot (that's crash-zoom's job); pushing forward only, without lateral drift, gives weak near/far shear |
| Line drawing | Each line is sampled at equal arc-length intervals and drawn segment by segment (per-segment width/opacity), **butt line caps** | Round caps overlap a ring at every joint on a semi-transparent line, so the whole line reads as a string of beads |
| Sense of flow | After growth completes, narrow-peak bright pulses drift slowly along the lines toward the convergence point, visible only in the mid and far ground (up close one segment is very long on screen and per-segment brightness reads as stair steps) | With no flowing element after the growth phase, the second half degrades into a "route map flyover" instead of a "data flow" |
| Labels | 5–9 in the mid-ground (demo 6): accent-colour square pin landing on the line + short post + monospace ID pill, scaled by perspective 1500/Z' (clamped 0.7–1.7); far ones drawn first, near ones last | **The post's world height must be far below the camera height**: when post height ≈ camera height, all labels project onto the horizon and crowd into a row; positions must be checked by projecting frame by frame so that neither the start nor the end overlap |
| Growth rhythm | Main trunk goes first at 30–40f out-cubic, each tributary staggered 3–6f | Everything growing on the same frame reads as a loading animation |
| Ending | ≥15f before the handoff frame, labels stop being added and the camera decelerates without slamming the brakes; title (eyebrow + two lines at 108px) rises word by word | A hard stop in an atmosphere segment is a visible jolt (same origin as the glow-orb convergence ruling) |

## Known pitfalls
- Borrowed from: the Linear Releases opening (evolution round #3 breakdown #7), a single sample
  ; parameters are given as ranges, not dogma; re-check with real material on first real use
- Don't use alongside glow-flyline-moves in adjacent sections: both cards are "dark-field glowing lines";
  back to back they read as the film only knowing one trick; when both are needed in the same film, separate them by ≥2 bright-field shots
- The cost of entering/leaving a dark field is the same as for the glow cards: when cutting to a bright-field product segment, cushion it with the hidden-cut family from shot-transitions;
  don't hard-cut between dark and light
- Lines at pure white full brightness smear into a spider web: pull brightness apart by layer (see the parameters table); the mid-ground is the protagonist layer;
  give the trunk/tributaries 1–2px of subtle glow (soft glow) to press out a "glowing line" atmosphere; with no glow at all it reads as a wireframe (within the Q4 single-point light-effect allowance)
- Label text must be ≥18px equivalent at the target frame size, otherwise "readable" degrades into decorative noise (same origin as Q6)
- Sound: lay down a riser/low-frequency pad bed; don't hit a point for each label appearing (batches aren't sounded one by one,
  same origin as S2); hand the single whoosh/impact at the handoff frame to the next shot

## Reference implementation
demos/opening/dataviz-landscape-open/
(DatavizLandscapeOpen.tsx)
