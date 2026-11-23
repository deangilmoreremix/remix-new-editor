# Storyboard (Phase 2) - DRAFT FOR APPROVAL

Mode: Ink Press template route (named in the brief). Only the shot structure, motion grammar and timing are inherited from Ink Press. Its paper/amber/serif skin is replaced by the product's own dark look. 1920x1080 @ 30fps (D is 1080x1920). All timings are seconds; frames = s x 30.

## Ground rules this storyboard obeys
1. **Real footage only.** Every frame comes from `video/captures/` (live smartvid.app, signed out) or from the small keyless recordings listed in "Top-ups". No generated results are shown or implied, because none were captured.
2. **No claims.** No model count, no price, no "N apps" number. Reason: the brief says 33 apps, the landing code (`ALL_APPS`) has 31, and model count and pricing are unconfirmed. Copy only names what the UI visibly shows.
3. **Copy is draft.** On-screen text is limited to the wordmark `smartvid.app`, the site's own line "Every creative tool, one place." (visible in the Apps hub capture), and the studio names. Nothing else will be added after approval.
4. **Look.** Dark, accent = the app's lime (hex to be sampled from computed styles in Phase 3; please confirm or give your own). Logo: the app's stack mark from the sidebar unless you give a path.
5. **Music.** Only the 5 bundled BGM tracks (`bgm-tech-house`, `cat-walk`, `g-eazy-nba-type`, `house-vibez`, `tonight-hiphop`) and bundled SFX. Provisional pick: `bgm-tech-house` for A and B, `house-vibez` for D. BPM and beat grid are measured in Phase 3 before cuts are locked, so the "beat" column below says what lands on a beat, not which beat. Each render ships twice: with BGM and without (SFX kept), per the skill.

## Usable captures (from CAPTURE_REPORT.md)
Usable: 01, 02, 04, 05a, 05b, 06a, 07a, 08a, 08b, 09a, 09b, 10a, 10b, 11a (Workbench), 12a, 13, 15b.
Weak: 03 (model picker closed), 07b upscale, 11b timeline (empty), 15a library (empty).
Unusable: 11c render (empty shell), 12b commercial and 14a/14b chat/assist (wrong pages), 15c stock (wrong page), 16 agency (no route), Backlot (not captured).

## A. Hero loop - 18.0s, 16:9
| # | Time | Dur | Shot / capture | Recipe | On-screen copy | Beat |
|---|---|---|---|---|---|---|
| A1 | 0.0-2.8 | 2.8 | Brand open (no capture) | brand-ink-open | `smartvid.app` | Wordmark presses on first beat; 1s hold |
| A2 | 2.8-7.5 | 4.7 | 01 Video Studio, prompt composer as the protagonist | spotlight-hero-card | none | Light locks on composer on a beat; settle on the next |
| A3 | 7.5-11.3 | 3.8 | 02 Apps hub | wall-reveal-moves (A, bento light-up) | "Every creative tool, one place." (site's own line) | Tiles light up on beats |
| A4 | 11.3-14.7 | 3.4 | 03 Video Studio model/controls row | cursor-flyover | none | One camera push on a beat |
| A5 | 14.7-18.0 | 3.3 | Lockup (no capture) | logo-shrink-wordmark-lockup | `smartvid.app` | Hold >= 1s, then dissolve to A1 for a seamless loop |

Change: picker-carousel-feature-cycle -> cursor-flyover for A4. Reason: the model picker was never opened and a carousel would have to be rebuilt UI, which breaks "real frames only".

## B. Feature reel - 57.6s, 16:9
| # | Time | Dur | Shot / capture | Recipe | On-screen copy | Beat |
|---|---|---|---|---|---|---|
| B1 | 0.0-5.0 | 5.0 | 04 Image Studio, composer + example gallery | cursor-flyover into composer, then card-stack on gallery tiles | "Image" | Stack lands on beat |
| B2 | 5.0-10.5 | 5.5 | 05a Cinema + 05b Director | cursor-flyover (2.75s each) | "Cinema" / "Director" | Cut between them on a beat |
| B3 | 10.5-15.5 | 5.0 | 06a Storyboard | timeline-travel | "Storyboard" | Travel ends on a beat |
| B4 | 15.5-17.3 | 1.8 | Breathing card (no capture) | paper-title-card, re-skinned dark | "Edit. Animate. Finish." (draft) | Quiet; no cut on beat |
| B5 | 17.3-23.3 | 6.0 | 07a Edit Studio before/after tiles | before-after-slider-scrub | "Edit" | Scrub hits mid-point on a beat |
| B6 | 23.3-27.8 | 4.5 | 08a/08b Character + Influencer portrait grids | deck-deal-flyin | "Character" / "Influencer" | Cards land on beats |
| B7 | 27.8-32.8 | 5.0 | 09a Avatar, 09b Lip Sync, 08b, 08a as four panes | quad-split-parallel-scenes | "Avatar. Lip sync." | All four panes settle on one beat |
| B8 | 32.8-37.8 | 5.0 | 10a AI-VFX + 10b Effects template walls | light-play-moves | "AI-VFX. Effects." | Light sweep on beat |
| B9 | 37.8-39.6 | 1.8 | Breathing card (no capture) | paper-title-card | "From idea to timeline." (draft) | Quiet |
| B10 | 39.6-45.1 | 5.5 | 11a Workbench with its demo timeline | timeline-travel + row-embed | "Workbench" | Playhead stop on beat |
| B11 | 45.1-49.6 | 4.5 | 12a Templates grid | carousel-3d | "Templates" | One rotation step per beat |
| B12 | 49.6-54.1 | 4.5 | 13 Video Agent prompt screen | cursor-flyover | "Video Agent" | Push on a beat |
| B13 | 54.1-57.6 | 3.5 | Lockup (no capture) | ui-to-brand-morph + logo-shrink-wordmark-lockup | `smartvid.app` | Impact on beat, 1s+ hold |

Changes and why:
- Shot 4: type-and-filter dropped. It needs a result to filter. Replaced by cursor-flyover + card-stack on the real example gallery.
- Shot 8: no one-character-across-scenes capture exists. The shot only shows the real portrait grids and says "Character", not a story.
- Shot 9: no 3-language clip or Dubbing capture exists. Copy says only "Avatar. Lip sync."
- Shot 10: impact-feedback dropped (nothing is "applied" to a clip). light-play-moves only.
- Shot 11: collab-cursor and canvas-materialize dropped. The demo timeline is static. timeline-travel + row-embed use only what is on screen. Render is not shown (superseded by Workbench).
- Shot 13: research-card-stack-scroll dropped (no result cards). cursor-flyover on the prompt screen.
- Shot 6: Backlot, 8-step pipeline, script gate and cost counter are not captured, so none appear.
- Two breathing cards added per the skill's pacing rule. They are copy-only and need your OK.

## C. Per-feature clips - 7.0s each (range 6-10s), 16:9
One clip per usable shot, same recipe as in A/B, extended to 7s with a 1s end hold. Names are `clip-<shot>-<name>.mp4`.
| Clip | Capture | Recipe | Copy |
|---|---|---|---|
| C01 Video | 01 | spotlight-hero-card | "Video" |
| C02 Apps | 02 | wall-reveal-moves | "Every creative tool, one place." |
| C03 Models | 03 | cursor-flyover | "Video" (no count) |
| C04 Image | 04 | cursor-flyover + card-stack | "Image" |
| C05 Cinema/Director | 05a, 05b | cursor-flyover | "Cinema" / "Director" |
| C06 Storyboard | 06a | timeline-travel | "Storyboard" |
| C07 Edit | 07a | before-after-slider-scrub | "Edit" |
| C08 Character/Influencer | 08a, 08b | deck-deal-flyin | "Character" / "Influencer" |
| C09 Avatar/Lip Sync | 09a, 09b | quad-split-parallel-scenes | "Avatar. Lip sync." |
| C10 VFX/Effects | 10a, 10b | light-play-moves | "AI-VFX. Effects." |
| C11 Workbench | 11a | timeline-travel + row-embed | "Workbench" |
| C12 Templates | 12a | carousel-3d | "Templates" |
| C13 Video Agent | 13 | cursor-flyover | "Video Agent" |
| C15 Community | 15b | wall-reveal-moves | "Community" |
**Not produced:** C14 Chat/Assist (no real capture), C16 Agency (no route), Commercial, Stock, Library, Render/Dubbing (empty or wrong pages). Landing cards for those keep their thumbnails.

## D. Social cut - 20.0s, 9:16 (1080x1920)
| # | Time | Dur | Shot | Recipe | Copy | Beat |
|---|---|---|---|---|---|---|
| D1 | 0.0-5.0 | 5.0 | 01 Video Studio composer, punched in | spotlight-hero-card | `smartvid.app` | Light lock on beat |
| D2 | 5.0-10.0 | 5.0 | 07a Edit before/after | before-after-slider-scrub | "Edit" | Scrub on beat |
| D3 | 10.0-15.0 | 5.0 | 09a/09b Avatar + Lip Sync (stacked) | quad-split-parallel-scenes (2 panes) | "Avatar. Lip sync." | Panes settle on beat |
| D4 | 15.0-20.0 | 5.0 | 06a Storyboard, then lockup | timeline-travel + logo lockup | "Storyboard" / `smartvid.app` | Lockup hit on last beat |
Note: captures are 16:9. 9:16 needs region punch-ins, so the 2x full-page recapture below is required to avoid soft or edge-cropped UI.

## Top-ups (small, real, keyless) - needs your OK
- Recapture shots 1, 4, 5, 7, 9, 13 at 2x (3840x2160) plus element cut-outs and `layout.json`, as the template method requires. The current 1x PNGs are too soft for punch-ins.
- Short Playwright recordings of typing into the Video Studio and Image Studio prompt boxes (no submit), and opening the model picker and Image advanced panel. These are real UI interaction, with no results.
- 1080x1920 viewport captures for D.

## Open items before Phase 3
1. Approve or edit this storyboard, including the draft copy lines.
2. Accent color (lime sampled from the app, or your hex) and logo path.
3. Max file size per deliverable.
4. Model count and pricing wording stay out until you confirm them.
5. Keys/login are still missing, so no result footage can be added. If they arrive, shots 1, 4, 5, 7, 9, 10 and 13 should be re-planned around real results.
