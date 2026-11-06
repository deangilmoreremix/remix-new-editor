---
name: glitch-cycle
one_liner: A single line of fixed-width monospace slots cycles through 4 status phrases; each phrase is fully scrambled at its head and tail by the probability keyframes [1,0,0,0.1,0,0,1], with occasional single-character jitter in the middle, and RGB split plus whole-line displacement layered at the switch instant; the last phrase's probability goes to 0 to guarantee a clean ending
use_when: Status announcements for loading/building/deploying processes; the "system speaking for itself" in a technical opener; an underlay section that needs a machine voice to move time forward
length: about 5.6s (168f@30fps; in the demo each phrase is 38f, and the last one continues to the end of the piece as the closing hold)
energy: medium-high (continuous high-frequency noise pulses, the switch points are the peaks)
---

## Intent
The dumbest way to do status announcements is four lines of text fading in one after another. The carousel compresses them into **one slot**:
each phrase "melts down" and then "solidifies" in scramble at its head and tail, and is almost clean in the middle, twitching only occasionally — what viewers read
is "the system is progressing step by step", not four independent pieces of copy. Scramble density is this card's grammar:
dense = switching, sparse = sitting in this state. The progress bar at the bottom strings the four beats into one timeline,
and the last phrase brings the probability down to 0, so once it lands it's over.

## Motion core
- The slot pre-builds `MAXCH` spans for the longest phrase (`min-width:0.66em` fixed slot width),
  with short phrases padded symmetrically with spaces on both sides (line centred) — **characters are never added or removed, only their content changes**, so the line never reflows
- Equal time segments: `slot = floor(frame / SLOT)`, in-phrase progress `p = (frame - slot·SLOT)/SLOT` (demo SLOT=38f;
  the last phrase runs `KF_LAST` over the same 38f and then stays clean until the end of the piece, leaving ~28f for the close)
- Glitch probability keyframes `KF=[1,0,0,0.1,0,0,1]` interpolated linearly by p: **1.0 fully scrambled at the start,
  0 in the middle, a rebound to 0.1 around p=0.5 (occasional twitching characters), and back to 1.0 at the end to melt into the next phrase**
- The last phrase uses a dedicated `KF_LAST=[1,0,0,0.1,0,0,0]`, with the end probability returned to zero → the frame at t=1 is clean
- Per-character test: a character is replaced with one from the glyph pool only if `rand(i·31 + bucket·17 + slot·97) < g`,
  and hit characters randomly take an accent highlight colour or a dark colour (demo aurora: pink / dark purple); `bucket = floor(frame/2)`,
  i.e. re-rolled every 2 frames
- Whole-line jitter and RGB-split strength are all multiplied by g (values in 480 design coordinates; demo is native 1920 with 104px phrases): `jx = ±g·10`px
  (demo ±g·36), `jy = ±g·4`px (demo ±g·10), `text-shadow` offset `g·3`px on each side (demo pink / ice blue at g·10 each,
  only on when g>0.04) — **one noise-density variable drives character swapping, displacement and dispersion at the same time**, so the three never clash; when g>0.25 the same g
  also drives a horizontal tear band (the line cut into three sections, the middle section shifted sideways, band height re-rolled every 2 frames), and when g>0.45, 3 pixel-block afterimages are layered on too
- Demo layout: a status line above (pulsing dot + RENDERING · project name · render number), thin corner brackets on the slot's four corners, a 1100px progress track below
  filling linearly (laid underneath independently of the four beats, with three four-beat ticks + a glowing head) + `STEP n/4` / percentage (tabular-nums);
  when the last phrase comes clean it gets one soft bloom (the hero gets it once only), and after the progress fills the status changes to RENDERED, the dot turns solid, and an accent-colour signature line rises (video-shotcraft logo + brand name)

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Phrase list | 4 phrases, longest 17 characters (demo `LOCKING BEAT GRID`) | 42f per phrase is the lower limit for "being able to read one state"; with 5+ phrases each is under 34f and viewers only see flashing |
| Probability keyframes | `[1,0,0,0.1,0,0,1]` (6 segments) | That 0.1 in the middle is the evidence of "being alive"; delete it and the phrase is rigid in the middle; raise the 0 segments to 0.3+ and the whole piece smears into malfunction |
| Re-roll frequency | every 2 frames (`floor(frame/2)`) | Changing every frame smears into a grey band; at 4+ frames the scramble is readable as "another word" and doesn't look like noise |
| Jitter amplitude | `x ±g·10` / `y ±g·4`px (480 coordinates; about ×3.6 at native 1920) | x larger than y is key to the horizontal tear (proportional jitter reads as an earthquake); beyond ~2 character widths the whole line jumps out of its slot |
| RGB split | red left, cyan right, `g·3`px each, threshold g>0.04 | This is the ID card of an "electronic glitch"; without the threshold, the 0.1 probability in the middle leaves the characters permanently fringed |
| Slot-width font | SF Mono 26px (480 coordinates; demo native 104px), slot `0.64–0.66em` | Monospace + fixed slot width are a hard requirement; 3px tracking gives the scramble breathing room between characters, crowded together it reads as a block of garbage |
| Progress bar | 150×2px (demo native 1100×4px), accent gradient fill, linear + four-beat ticks | The only linear element, giving the four beats of noise a stable reference; delete it and the carousel doesn't read as "progressing" |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- **When swapping project copy keep the four phrases' character counts close (demo 12–17 characters)**: the slot count is built once for the longest
  phrase, and short phrases are padded on the right with spaces — if one phrase has only 4 characters and another has 30,
  the short one sits alone on the left in 30 cells, the line width is held open by the longest phrase throughout, and the rhythm reads as drifting
- The probability keyframes are 6 equal segments mapped onto in-phrase progress: when the number of phrases changes, each phrase's duration changes too,
  but the keyframe shape doesn't — so the more phrases, the shorter the absolute duration of the two "fully scrambled" segments,
  and the weaker the sense of switching; beyond 5 phrases, widen the 1.0 segments at head and tail
- The last phrase must use `KF_LAST` (ending at 0): using the normal KF leaves t=1 stuck on full scramble,
  which reads as not finished rendering when cutting to the next shot
- Dark backgrounds only: a dark background + cool/vivid noise colours are the foundation of the whole palette (the demo uses aurora deep purple-black + pink / ice-blue split); on a light background the RGB split
  is almost invisible; it also depends heavily on sound — the four switch points are naturally four rhythm points, and in real use it must be scored with
  electronic glitch / switch sounds;
  for scoring discipline see sound-design.md (same sound for the same kind of element; alternate two samples on rapid repeats to avoid a machine-gun feel)

## Reference implementation
demos/typography/glitch-cycle/
(GlitchCycle.tsx)
