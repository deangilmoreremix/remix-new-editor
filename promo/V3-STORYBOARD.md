# V3 Six engine clips: storyboard and honesty record

Six single-shot clips for the landing page's six engine cards (`SixEnginesSection.jsx`), each `V3-<engine>`: 1920x1080 @30fps, 207 frames (6.9 s = 14 beats of the 122 BPM house-vibez grid),
a with-music and a no-music (SFX kept) render each, plus a poster (frame 200). Every clip is ONE shot card (single-shot path) with the engine's name and the landing card's own
one-line description as the on-screen title (112px / 40px, `src/lib/EngineTitle.tsx`; strings copied from SixEnginesSection.jsx, landing copy itself is not changed).
Shots are the same implementations as V1/V2 (see each file's header for what it kept/changed versus its demo), parameterised with props; no new card was implemented except the
single-station cursor tour (`AgentShot.tsx`). SFX per clip in `src/timeline3.ts`, offsets measured like V1/V2.

| engine | frames | card / style-key (demo) | content (all real captures) | apps from the engine card that are shown |
|---|---|---|---|---|
| Create | 207 | wall-reveal-moves / bento-light-up (BentoLightUp.tsx) | 3x2 wall: Image, Video, Cinema, Character, AI Influencer, Product Shot studios, one cell per beat | Image, Video, Cinema Studio, Character, Influencer, Commercial (as Product Shot Studio) |
| Enhance | 207 | camera-moves / multiplane (depth-layer-moves, MultiplaneReal.tsx) | parallax over the hub, 4 real hub cards (Edit, Upscale, Effects, AI VFX), AI VFX lifts | Edit, Upscale, Effects, AI-VFX |
| Produce | 207 | timeline-travel (TimelineTravel.tsx) | the real Backlot board's 8-step rail, fictional project | Backlot only (a local tool, NOT one of the engine card's listed apps: Storyboard, Director, Timeline, Render, Video Tools, Audio had no usable capture) |
| Localize | 207 | tilt-reveal (TiltReveal.tsx) | the Lip Sync Studio page (idle) lifting from flat | Lip Sync only. Dubbing, languages and social formats are NOT shown (no capture); the clip does not demonstrate localization, it only carries the card's description |
| Automate | 207 | cursor-flyover, one station (CursorFlyover.tsx) | the real Video Agent page: cursor flies to the input, click, typing "Make a 15 second teaser for a trail running shoe" (simulated reveal of a real typed capture), pull-back | Video Agent. Nothing is submitted; no agent output is shown. The app page's own text is visible ("Describe an animation and the agent writes, previews and renders it", model label "GPT-6.1 Sol (Low Reasoning)") |
| Scale | 207 | deck-deal-flyin (DeckDealFlyin.tsx) | 9 real Cinema Templates preview images dealt into a grid, chip "TEMPLATE PREVIEWS" | Templates only. Explore, Library, Community, Training not shown (empty states / not captured) |

## Weak spots (said plainly)
- Localize is the thinnest clip: an idle Lip Sync page. It cannot honestly show localization. Consider not using it, or pairing it with the card text only.
- Produce uses Backlot (fictional project, 3 stages visibly pending) rather than the apps the card lists.
- Enhance's near-field blurred pills are decorative names; the Edit/Upscale card images are the app's own pre-composited example art.
- Typing and clicks in Automate are simulated from real captures; the keyboard SFX is foley.

## Seeded / fictional frames
Backlot data is fictional ("The Last Lighthouse"; badge and timestamps hidden). Everything else is real app UI in idle states. No generation/result is shown or implied; no price/credits/counts appear.
Rights: stock imagery, tool/template preview images and faces inside the app have unrecorded provenance (confirm before publishing).
