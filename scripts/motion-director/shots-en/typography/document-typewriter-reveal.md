---
name: document-typewriter-reveal
one_liner: A full page of genuinely typeset document window floating in a dark field "writes" itself behind a cursor, the sidebar follows, history entries drop one by one into their track, and the camera pulls back from an oblique close-up of the title all the way to the full window
use_when: Feature shots for documents/reports/notes; the beat with the highest information density
length: 150f (about 5s, including the history-list-stack tail and the tagline hold)
energy: low-medium (highest information density; keep the rhythm steady so viewers can read)
tags: ui-entrance
---

## Intent
Viewers will read every word on screen — this shot's entire persuasiveness rests on "the document is real". The typewriter-style writing turns a static page into "a document being written", and the sidebar history entries dropping in add the temporal depth of "continuous output".

## Motion core
- Content blocks write in pairs on the beat: a page-colour mask anchored right narrows left→right, with an accent-colour caret riding the reveal front
- Person @-mentions grow an accent-colour background after the wipe completes
- The left and right columns enter as background-colour patches retract top→bottom, with an accent-colour thin line on the inner edge growing with the reveal and then fading
- Tail (history-list-stack): 6 history entries drop one by one from above into the sidebar track, each with a pop
- The camera pulls from an oblique close-up of the title to the full window (both columns must be in frame), then tilts down slightly and moves up to free the bottom for a single tagline, with only a very slow push-in; the page is an application window floating in a dark field (rounded corners, bright edge, backlight, long drop shadow), not full-screen

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Writing beat | 20 blocks in pairs, pair g cue = 8 + g·4.4, 9f wipe per block, the last pair finishes ~57f (ahead of the 64f full-window settle) | Writing block by block blows the budget — "check blocks × beat against the budget first" is this card's core arithmetic: compute first, then write |
| Writing technique | background mask width 100%→0, bezier(0.4,0,0.6,1), mask colour taken from the measured colour of the textured paper, overcovering on the right (title 120px — the measured block width is shorter than the bold text's actual width, otherwise the last word leaks out); accent-colour caret 3px (a one-step-darker aurora purple + a soft glow in the same colour), follows only the newest block and rides only within the actual text width, fading out 2f after writing finishes; 8f before the first block starts, the pen tip blinks on standby at the title's start | Multiple carets at once breaks the illusion immediately; there is always exactly one "pen tip" |
| li bullets | mask overcovers 28px to the left (::marker sits ~22px left of the text) | Without overcovering, the bullets leak early — every typographic detail baked into the screenshot texture needs to be checked like this |
| @-mention | starting 4f after the wipe completes, grows an accent background over 8f (aurora purple 0.4), `mix-blend-mode: multiply` (the background sits above the textured text; normal blending would wash out the names); skip titles that are not person names | Highlighting later than the writing reads as "the key point being marked"; appearing on the same frame reads as a sticker |
| Two-column entrance | left column cue 54 / right column cue 62, background patch retracts top→bottom over 10f + a 2px accent line on the inner edge grows with the reveal, fading over 24f | The columns are offset in rhythm from the body; entering together they compete for attention |
| History entries drop in | 6 entries, cue = 66 + i·5 (after the sidebar wipe completes at 64f), each drops over 9f; start −48px, bezier(0.2,1.15,0.3,1) light bounce, in-air shadow `0 12·air px 24·air px` | The entry geometry sits tight under the existing entries baked into the texture, aligned to the line height — DOM-redrawn entries must align strictly with the live entries in the texture |
| Stage | aurora dark field: a ring of accent-colour backlight behind the window (page space translateZ −40, following the window's perspective), a 0 0 0 1.5px bright edge all round + a 70px long drop shadow, a highlight along the top edge; closing tagline 84px in two parts (second part in accent colour) left-aligned to the window's left edge | Warm-white paper placed in a cool dark field looks like a lamp — stage and window must share the same light direction; the backlight must not overpower the paper |
| Camera | a custom 3D window camera (layout-level CSS zoom, Q2), unrolled frame by frame along a monotone cubic Hermite spline: f0 zoom 1.42 / rotY −18° / rotX 8° (the window's top-left corner and the stage light enter frame together) → f26 1.24 → f64 full window 0.86 → f104 0.74 + rotX 9° + move up 78px (bottom freed for the tagline) → f150 0.746 | Opening too close (>1.6x) leaves only paper on screen, neither the dark field nor the window edges visible, and it reads as the original flat page; at full window both columns must be in frame (Q10) |

## Sound
In the writing section pin keyboard.mp3 trimmed to ~50f (8→57f) to cover the writing (foley exactly as long as the action, S4); the 6 history-entry pops fire one every 5f, volume stepping down 0.40→0.25 for distance attenuation (S2).

## Known pitfalls
- Mock content must be publication grade: the product's native typography, text filling the page, the sidebar fully in shot (Q10) — a lazy "texture + tagline" grade document means redoing the whole shot
- Data compliance: real customer/member names must never appear in mock content (Q1)
- When the source page is a live data source (collaborative documents), a full re-capture wipes out finalised textures — use the incremental script to refresh only a single key on a single page
- The accent-colour examples (caret / @-mention / inner-edge line) are amber in the template film; when adapting to a new brand, switch them all to the target brand's accent colour

## Reference implementation
demos/ui-entrance/document-typewriter-reveal/DocumentTypewriterReveal.tsx (originally template/src/aifl/live/SceneWbr.tsx; for the typing sound effect see the SFX table in template/src/aifl/Main.tsx; in the template film this shot carries a weekly-report document scene)
