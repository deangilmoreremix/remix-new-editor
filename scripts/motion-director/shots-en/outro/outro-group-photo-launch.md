---
name: outro-group-photo-launch
one_liner: Elements from the whole film fly in from all directions to surround the wordmark for a group photo; a crane-down camera + stage lighting + gold dust make it a launch-event finale
use_when: outro / brand closing; a "family photo" final shot for a multi-feature product
length: About 4.8s (145f)
energy: peak (the highest point of the whole film)
---

## Intent
Call back one representative element from each feature shown for a group photo, with the wordmark making the grand final entrance — the last thing the audience remembers before leaving is "these things all belong to the same product". The production level must be launch-event grade: energy pushed to the highest of the whole film.

## Motion core
- 9 page elements (nav/cards/content strips/search box/stats bar/doc header) fly in from all sides with rotation; during flight, directional motion blur by velocity; on landing they settle firmly (contact shadow tightens + 1.5% light press, no individual glow, Q4)
- The wordmark (demo: video-shotcraft logo + wordmark, with the eyebrow being the brand short line) enters letter by letter in letterpress; everyone "steps back a row" to make way for the lead; the rule grows out, extension lines shoot out
- Crane camera: the group-photo layer as a whole rotateX 4°→0 + scale settles down, then a slow push-in
- Launch-event atmosphere trio: an opening light band sweeping across, stage light behind the wordmark, gold dust drifting upward
- Background page blurred into depth of field

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Elements flying in | 9 element cues starting at 4, one every 3f, each flying 12f; start offset ±360–500px; render order = cue order, later arrivals stack on top | Every feature already shown must have a representative element (Q8 self-check item); the audience will notice whoever is missing |
| Fly-in easing | bezier(0.34,1.4,0.44,1) | The lesson named in a code comment: the old bezier(0.25,0.9,0.3,1) "never crossed 1" and had no real overshoot — for the landing to bounce, y1 must be >1 |
| Flight pose | In flight rot×2 → settled rot (within ±5°), scale ×1.12→1; directional motion blur by screen velocity (0.3×px/frame, capped at 22); on landing cue+9→16f contact shadow tightens + 1.5% light press | Keep settled angles within ±5° — the group photo should be neat but not rigid |
| Step back a row | When the wordmark enters, 42–50f everyone opacity −12%, saturate −8% | When the lead enters the supporting cast must make way; if they don't, the wordmark can't hold its own against 9 elements |
| Crane camera | `perspective(1400px) rotateX(4°→0) scale(1.06→1)` settles over the first 40f, then slow push-in +0.035 (in-out from zero velocity starting at 36f, joining the crane without a jolt) | The crane amplitude is this small (4°) and already reads enough as "camera settling"; larger causes dizziness (speculative) |
| Atmosphere trio | Light band 2–14f (600px-wide overlay, peak opacity 0.12); stage light 42→50→58f 0→0.5→0.25; gold dust 20 particles 2.4–4.2px with warm halo, opacity 0.35–0.7 with slight twinkle + 6 out-of-focus foreground bokeh spots, all parameters deterministically derived from index | Particle/light-effect parameters must be deterministically derived (hard rule: renders must be reproducible); more than 30 gold dust particles starts to look like snow (speculative) |
| Wordmark | Demo is the video-shotcraft logo + all-lowercase wordmark (brand typeface 118px): logo presses first at 38f, letters delay=42+i·1.8, 8f, the same letterpress; rule grows out 58→70f, 190px extension lines at both ends shoot out over 8f and fade over 6f; letter-spacing breathes 62–66f; background page blur 0→14 within 24f; after settling, sign-off hold 30f | Hold the settled wordmark for a full 1 second (R1 settled ruling); the outro has no explainer caption to stay clean (C1 exception) |

## Sound
Fixed three-beat phrase: riser-cine leads into the assembly (pinned at f945 in the template film) → impact-deep-whoosh pinned to the wordmark stamp (f980, vol 0.55, the film's peak) → sparkle accents the rule (f1005). This is the only passage phrase never changed since the template film was finalised (S2; see sound-design 4.3 for details).

## Known pitfalls
- First drafts of the closing are almost always too conservative (Q8: quiet signature → group photo → launch event, three levels of escalation) — from the first draft give it the spec of "looks like a product launch" with full crane/stage lighting/particles
- Structure before effects: first have the "fly in from all sides for a group photo" structure, then escalate the atmosphere; stacking effects directly has no skeleton
- Check the outro tagline against the copy under the wordmark for duplication (P4 dedupe precedent); the same sentence appears only once in the whole film

## Reference implementation
demos/outro/outro-group-photo-launch/OutroGroupPhotoLaunch.tsx (originally template/src/aifl/live/SceneOutroLive.tsx; for the 30f sign-off hold duration see the timeline in template/src/aifl/Main.tsx)
