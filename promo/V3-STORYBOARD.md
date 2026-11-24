# V3 Six engine clips: storyboard and honesty record (after the independent review)

Six single-shot clips for the landing page's six engine cards (`SixEnginesSection.jsx`), each composition `V3-<engine>`: 1920x1080 @30fps, 192 frames (6.4 s = 13 beats of the 122 BPM
house-vibez grid), a with-music (BGM gain 0.22) and a no-music (SFX kept) render each, plus a poster (frame 185). Every clip is ONE shot card (single-shot path) with the engine's name
and the landing card's own one-line description as the on-screen title (112px / 40px, `src/lib/EngineTitle.tsx`; strings copied from SixEnginesSection.jsx; landing copy itself is not changed).
Shots reuse the V1/V2 implementations through props (each shot file's header lists what it kept/changed versus its demo); the only new grammar is the single-station cursor tour (`AgentShot.tsx`).
SFX per clip: `src/timeline3.ts`; offsets verified with `analysis/verify_sync.py`. Clips do not loop (frame 0 is dark, the end is lit and the music fades): use poster + play-once, or add a fade in the page.

| engine | card / style-key (demo) | content (all real captures) | card-listed apps shown |
|---|---|---|---|
| Create | wall-reveal-moves / bento-light-up (BentoLightUp.tsx) | 3x2 wall of the Image, Video, Cinema, Character, AI Influencer and Product Shot studio banners, one cell per beat | Image, Video, Cinema Studio, Character, Influencer, Commercial (the app calls it Product Shot Studio) |
| Enhance | multiplane / depth-layer-moves (MultiplaneReal.tsx) | parallax over the hub with 4 real hub cards (Edit, Upscale, Effects, AI VFX); AI VFX lifts | Edit, Upscale, Effects, AI-VFX |
| Produce | multiplane / depth-layer-moves (same technique as Enhance, different content) | the 5 real hub cards for Storyboard, Director, Timeline Editor, Video Tools, Audio; Video Tools lifts | Storyboard, Director, Timeline, Video Tools, Audio (Render has no hub card) |
| Localize | quad-split-parallel-scenes (QuadSplitParallelScenes.tsx) | 4 panes: Lip Sync, Avatar, Video Tools, Audio, each with its studio name and the app's own hub description (Video Tools: "...translate..."; Audio: "...speech...") | Lip Sync, Avatar (listed); Video Tools and Audio are related apps, not in this card's list. Dubbing, TikTok, Social Content are NOT shown |
| Automate | cursor-flyover, one station (CursorFlyover.tsx) | real Video Agent page: cursor flies to the input, click, typing "Make a 15 second teaser for a trail running shoe" (simulated reveal of a real typed capture), ends zoomed on the readable prompt | Video Agent |
| Scale | deck-deal-flyin (DeckDealFlyin.tsx) | 9 real Cinema Templates preview images dealt into a grid, chip "TEMPLATE PREVIEWS" | Templates |

## Changes after the independent review (REVIEW-V3.md)
Produce was Backlot (local tool, off-brand, not in the card's list) -> now real hub cards of the apps the card lists. Localize was an idle Lip Sync form -> now four real panes (still no localization is shown).
Automate: title at frame 14 (was 150), no pull-back so the prompt stays readable, the app's third-party model dropdown under the input is blurred out (a decision: it names a model the product owner has not confirmed),
snap re-pinned to typing complete. Create: title clearance (wall lowered) and tighter banner crop. Scale: board shifted right so chip/description are clear. Audio: BGM 0.30 -> 0.22, first cues no longer clamped to frame 0,
SFX levels set so peaks stay below clipping. Length 207 -> 192 frames to cut dead time.

## Weak spots (said plainly)
- Localize still does not demonstrate localization (no dubbing/language capture exists); it shows related studios. Consider using it only as a poster or dropping the card video.
- Dead time remains in several clips (2+ s of near-static end state in Create/Enhance/Produce/Localize); the tilt/quad/hub cards all end in holds.
- The SFX are only a few dB above the BGM at several cues; nothing was auditioned by a person.
- Enhance/Produce use the same technique with different cards; Create's per-cell comet stroke is the card's own (Q4 deviation: one stroke per cell, not a group glint).
- Automate: "15 second" appears in the typed prompt (a typed word, not a product claim); the page also shows "powered by Remotion" at ~9px.
- Image rights: stock imagery, faces, tool and template previews inside the app have unrecorded provenance (text inside some template previews, e.g. film titles, is the app's own art).

## Seeded / fictional frames
No Backlot in V3 any more. Everything shown is real app UI in idle states plus the app's own stock images. Typing/click in Automate are simulated from real captures; nothing is submitted. No generation or result is shown, no price/credits/counts.
