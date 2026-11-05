---
name: shot-transitions
one_liner: Three shot-handover styles: push-in white flow, whip-pan (hard-brake version), mask-wipe through-the-window (depth version), chosen by energy drop and seam semantics
use_when: Any junction between two shots (technique card: after the shots are laid out at the storyboard stage, pick one style per seam)
length: n/a (technique card; the frames each style takes are in the parameters table, carved out of the adjacent shots' budgets)
energy: n/a (technique card, doesn't take an energy slot)
---

## Intent
Each shot card in the library only manages its own entrance and ending; there has never been vocabulary for "how to join" shot to shot:
a bare cut at a seam leaks away in one go the cinematic feel built up shot by shot. Widely acclaimed launch films
(Linear Releases/Agent, frame-extracted and reverse-engineered 2026-07-11) never once use a bare cut:
scene changes rely on depth travel, focus relay, or a black-field title card building tension. This card collects three styles:
a white flash covering the cut, a whip pan using blurred frames to change scene, and going through a window into a detail world.

## Variants

| Style | Approach | Seams it suits |
|----|------|----------|
| A push-in white flow flash-cut | The previous shot's camera pushes in, and a layer of white flash straddling the cut point covers the page change | Interaction drill-through, page → page at similar energy (already in the library, absorbed here) |
| B whip-pan (hard-brake version) | The camera whips sideways to the next scene in one beat, the middle section motion-blurred beyond recognition, using the blurred frames to change scene; hard brake before the landing, long-tail slide in | Rapid-fire fast-paced feature sections (the brisk high energy → high energy option); the landing is a shot where "the content must be read" |
| C mask-wipe through-the-window (depth version) | A real element on the page (a card) enlarges into a full-screen window, and the new scene grows out of the window and takes over | Semantic seams: feature overview → that feature's detail ("click open this card and enter its world") |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A flash-cut | `assets/lib/FlashCut.tsx`, from = cut point − 5, 5f on each side | See the type-and-filter card for usage; the white flash only covers hard cuts, it's not a decorative light effect (Q4) |
| B whip-pan hard-brake version | Starting hold ≥20f → first 70% of the distance in 30% of the time (blur segment, peak ~300px/f) → last 30% of the distance ease-out long tail ~48f sliding into place; integrate the displacement from one continuous speed curve (3f start + exponential decay), don't apply separate ease-outs per segment (speed takes off a second time at segment boundaries); apply directional motion blur by instantaneous speed (`SpeedBlur` from `_fixtures/Polish`, sd ≈ 0.085×speed, capped at 64px), active only during the whip; the reference implementation wires the same displacement curve to a mechanical rolling index counter (Nº 02→09) and a ruler that travels with the gallery + a fixed playhead, and after landing the target card lifts to 1.2× for readability | Suits landings on shots where "the content must be read": the long tail gives the viewer's eye a ramp to catch up; a long tail >60f steals the next shot's entrance, err on the short side; size the span for "peak speed ≥300px/f", otherwise the blur isn't thick enough and the scene change shows through; the two scenes are joined on the same horizontal line (page space at the same y); CameraMotionBlur sub-frame accumulation in 8bit turns the whole frame yellowish and the trails become frame-by-frame echoes, don't use it for whips on bright-field UI |
| C through-the-window depth version portal-wipe | The target card first floats up as anticipation (−10px, 1.03×, neighbouring cards dim) → the window enlarges over 40f with bezier(0.7,0,0.3,1) slow then fast, and the new scene inside the window grows from ~0.42 scale to 1 as inverse compensation (same t as the window geometry), while the card face fades out within the first ~28% of travel (opacity 1−t·3.6; any slower and it gets stretched into a full-screen giant-type ghost); **only 2 layers** of parallax inside the window (far background panel factor 0.08 + 2 near cards 0.3, no blur), after going through the window an 8f ease to a stop → still ≥30f to read the new scene clearly; the world inside the window is best the clicked card's cover "growing up" (reference implementation: in the video-shotcraft Workspace, the cobalt waveform cover of the "Premiere Forecast" project card → a view-count forecast world with the same waveform landscape + glass panel + 2 floating metric cards, the curve finishing drawing with t) | Window geometry and the scene inside must be driven in sync; out of sync reads as giving the trick away; layer count/spread is the make-or-break point for readability: the 3-layer + 0.85 spread + blur version was rejected, it passed after being reined in; it must truly stop after going through; parallax that keeps drifting steals the reading of the next shot |

## Known pitfalls
- Mark the transition style per seam already at the storyboard table stage (in the "key motion" column); adding it only at the per-shot stage
  means shifting frames down the whole line: the frames a transition takes are carved from the adjacent shots' budgets, same rule as the hold budget (R3)
- Transitions don't stack: one seam uses only one style; adding a flash white flash during the whip blur or mid-window reads as giving the trick away
- Style B/C parameters were tuned on placeholder material + confirmed on real material, not user
  real-use rulings: single-instance rulings, and when they conflict with a ruling, the ruling takes priority
- Style C's new scene inside the window should semantically be the "detail world" of the clicked element (in real use, take a real detail page
  screenshot); stuffing an unrelated scene in the window breaks the semantics and degrades into a flashy wipe; use a high-resolution texture for the enlarged element (Q2, it is in close-up throughout)
- Style C depth version parameters are a tuning starting point from hand-built placeholder UI (video-shotcraft Workspace / view-count forecast world), not verified on real screenshots;
  reference implementation demos/transition/shot-transitions/PortalWipeV2.tsx

## Reference implementation
Style A: template/src/aifl/Main.tsx flash-cut layer (component `assets/lib/FlashCut.tsx`);
Style B (whip-pan hard-brake version): demos/transition/shot-transitions/WhipBrakeReal.tsx;
Style C (mask-wipe through-the-window depth version): demos/transition/shot-transitions/PortalWipeV2.tsx.
