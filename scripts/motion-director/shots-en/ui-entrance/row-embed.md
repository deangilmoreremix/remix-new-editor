---
name: row-embed
one_liner: Content rows descend from the air like cards, level out via rotateX, and at the moment of embedding a seam of accent colour lights up along the bottom edge
use_when: Detail-page/list shots of "structured data growing into the page"; batch entrance of row-level content
length: about 2s (12–68f)
energy: medium
---

## Intent
Rows on a detail page are not "displayed" but "grow in": each row descends from the air and embeds seamlessly into the page layout; the accent-coloured seam at the moment of embedding is the visual foley of a "click" snapping into place.

## Motion core
- Rows fly in one by one from above on an accelerating beat (at the end they slam into the slot with speed + vertical motion blur), rotateX levels out from an upward angle, and scale slightly overshoots then press-rebounds
- The row positions are first covered by a patch of the page's real background colour + an extremely faint dashed slot box as placeholders; after landing the patch disappears so the texture shows through; the slot's contact shadow tightens and solidifies as the row approaches
- At the moment of embedding, a 2px accent-colour seam on the row's bottom edge spreads from the centre to both sides and then fades out
- At the same time the camera slowly tilts down and pushes in slightly; the rain of rows and the camera move run in parallel; the framing is filled by the page throughout

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Beat | cue = 12/22/31/39/46 (intervals decreasing 10→7), flight 12f, the last row lands at 58f, the accent seam finishes at 66f ≤ shot budget of 68f | First work out "when the last row lands", then set the cue intervals: beat × row count must fit the budget (the same core arithmetic as the document-typewriter-reveal card) |
| Flight pose | `perspective(900px) translateY(−120·air) rotateX(16°·air)`, progress easing bezier(.5,0,.8,.75) (still has speed at the end), scale 1.06→0.995 then a 4f press-bounce back to 1 | rotateX levelling out is the key read of "embedding"; a pure vertical drop reads as a sticker |
| Flying body | backgroundImage takes the full-page screenshot, backgroundPosition negative offset crops out that row | Texture crops don't redraw content (Q1): redrawn rows have a visible difference in font rendering from the page |
| Empty-slot patch | The row position is first covered by a patch of the page's real background colour #f9f6f1 (sampled pixel by pixel; a whiter colour reads as one big whiteboard) + a 20% dashed slot box, disappearing 2f after landing | Without the patch the rows baked into the texture show through first, and the fly-in becomes "ghosting" |
| Embed flash | A 2px accent-colour seam on the bottom edge (feathered at both ends) spreads from the centre to both sides in 5f (Easing.out cubic), fades out over 8f, with a 7px glow | The seam only on the bottom edge, flashing only once; flashing on all four edges reads as a selection box |
| Camera | cy 500→740, zoom 1.12→1.25, 68f eased tilt down + slight push | Camera move running in parallel with the rain of rows creates a "growing while you watch" feeling; if the camera waits for the rows to finish before moving, the shot drags; at both start and end the page must fill the frame; showing beyond the top or bottom of the page is a blank dead zone |

## Sound
Pin transition-soft to the passage cut-in (pinned at f475 in the template film); don't give each row landing its own sound: with many rows at even intervals, a pop per row becomes machine-gun-like; the on-screen accent seam as "visual foley" is enough (S2 negative self-check).

## Known pitfalls
- The fly-in end point must be a real slot in the page layout, embedding on landing (Q9): it needs to "fly in from the air and embed into the dashboard"; hovering above without landing looks fake
- Light effects such as the accent seam must be clipped within the rounded-corner bounds of the host element (Q4 precedent); light spilling past rounded corners is a typical source of cheapness

## Reference implementation
demos/ui-entrance/row-embed/RowEmbed.tsx (formerly template/src/aifl/live/SceneDetail.tsx)
