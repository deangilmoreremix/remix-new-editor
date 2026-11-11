---
name: list-stack-press
one_liner: List cards fly up from the bottom of the frame one by one and stack; each landing press-bounces the whole stack, and a counter ticks up one step in sync
use_when: Feed / radar / inbox shots of the "something new every day" kind; asset lists that emphasise continuous accumulation
length: about 3s (18–88f)
energy: medium
---

## Intent
"The stack has weight": every time a new card lands, the already-settled stack is pressed down and springs back. From the physical feedback the viewer reads "this is something genuinely accumulated". The counter ticking in sync nails down the sense of quantity.

## Motion core
- **Anticipation beat (borrowed from Disney principle 2)**: before the first card rises in, give one passage-level anticipation beat: the counter lights up / resets to zero / micro-scales scale(0.96)→1 4–6f before the first card, drawing the eye to the stacking area, and then the first card enters frame. Do it only once at passage level, not per card
- Cards rise in from below the frame, alternately slightly tilted then levelling out, stacking one by one at an even beat
- Each arrival presses the whole stack down 6px, springing back over 8f (the stackPress pulse, i.e. principle 5's follow-through: the new card's momentum is passed to the whole stack and then damped and dissipated; this stroke is where the "weight" comes from)
- After landing, things settle in drag-hierarchy order (principle 5): the card body stops first → the stack springs back → the highlight bar then grows out (2–4f lag). All three in the same frame reads as a texture swap
- At the end, one glaze light sweep passes over the whole stack
- A screen-space DigitRoll counter rolls one step per landed card; the camera follows the stack downward

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Beat | CUES=[18,30,42,54,66] (12f even spacing), each card flies 22f, bezier(0.45,0.05,0.25,1.12) with overshoot at the end | With few cards (5) even spacing is fine; only large-batch entrances need progressive acceleration (compare deck-deal's R2) |
| Entrance | Rises in from 600px below, alternating ±2° tilt that levels out, scale 1.06→1 | Alternating tilt breaks symmetry; tilting the same way reads as copy-paste |
| Stack press | When the next card arrives the whole stack presses down 6px and springs back over 8f (pulse [cue,cue+4,cue+8]→[0,6,0]) | This is the key stroke for "having weight"; cut it and the stack becomes simple layout |
| Shadow | Two layers of softShadow change with height above the surface: in the air elevation≈56, settled 3 (hugs the surface more when pressed); during flight, add vertical motion blur by speed | Shadow tightening with height is the same language as deck-deal/spotlight |
| Linked highlight | After landing, with a 2–4f lag, on the project-name row (measured from the screenshot at in-card y156–176) grow a highlighter background in the accent colour (amber in the template film) as wide as the project name, multiply-blended under the text (7f grow + 5f fade); the last card is only ~12f from the cut, so compress to 5f grow + 4f fade | The highlight is a secondary action (principles 5/8): it follows after the primary action (landing press-bounce) and doesn't fight it in the same frame; the beats of the final element must be compressed to the remaining frame budget, not copied from earlier ones |
| glaze sweep | 360px wide, rotate 14°, mixBlendMode soft-light; after the last card settles, frames 74→87 sweep from −500 to 2300, clipped inside each card's rounded corners | Only one sweep in the whole shot, sweeping the whole stack, not per card (Q4) |
| Counter (digit-roll technique) | Continuous odometer position pos: each card landing moves pos +1 step along the digit strip, each step rolls and settles in 8f, bezier(0.25,0.8,0.25,1); roll amount = pos·lineH, rolling continuously down a doubled 0-9 strip | Counter out of sync with landing breaks the illusion immediately; **a single-step roll must be shorter than the card-drop interval (12f) and the final step must settle before the shot ends**. The approach of remounting and re-rolling keyed by count rolls from 0 for 22f each time; at a 12f beat the previous roll never finishes and the last frame stops at 4 (PR #40 precedent); digit strip doubled and concatenated + overflow hidden + tabular-nums (without tabular it jitters horizontally) |
| Camera | zoom 1.35→0.86 as one continuous curve following the stack downward (fed frame by frame to PageCam2D, to avoid speed dropping to zero at segmented keyframes) | Front-on camera position (see known pitfalls); the camera only does vertical following |

## Sound
Don't give each landing its own long sound; pin click-camera to the counter settling (pinned at f648 in the template film), and transition-soft to the passage cut-in (f623). If you do give each card a pop, follow S2's three anti-machine-gun tricks.

## Known pitfalls
- Stack/list information shots must be front-on (Q6): when the whole film was given tilted angles, this shot was individually rolled back to front-on; validate stylised camera angles shot by shot, don't apply them globally
- Per-card glint highlight sweeps were rejected twice (Q4); a static accent-colour background bar is enough for the highlight, leave the dynamism to the press-bounce
- This is the same action vocabulary as history-list-stack (the tail section of the document-typewriter-reveal card); one technique only plays the lead once per film (P4); when both are used, one must be demoted to a supporting role
- The anticipation/drag-hierarchy parameters are borrowed from Disney's 12 principles (the distilled version built into the pixel2motion skill), not user precedents: they are default suggestions, not orders; when they conflict with a precedent, the precedent wins
- Anticipation amplitude must clear the naked-eye threshold (deck-deal precedent 2026-07-09: at small amplitude the user felt nothing at all; it only passed after being enlarged 12×); after rendering, self-check "can the wind-up be seen without stepping frame by frame"

## Reference implementation
demos/ui-entrance/list-stack-press/ListStackPress.tsx (formerly template/src/aifl/live/ScenePapers.tsx)
