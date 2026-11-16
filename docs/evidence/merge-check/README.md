# Timeline editor — merge check screenshots

Captured from the checked-out `HEAD` (identical to `origin/develop`: 0 ahead / 0 behind) by running `vite --port 3100` and
driving `#/timeline` (new CineGen-based editor) and `#/timeline-classic` (previous editor) in headless Chromium at 1600x950.
Test media: two generated 8s VP9 clips. No Supabase / Clerk / provider keys were configured.

| File | What it shows |
|---|---|
| 01-project-manager | Project Manager (entry to the editor) |
| 02..09-tab-* | The eight workspace tabs: Elements, Spaces, Director, Edit, LLM, Export, Leads, Analytics |
| 10, 11 | Edit tab with a clip on V1; Inspector closed / open |
| 12-inspector-scroll-01..05 | Whole clip Inspector, scrolled (single clip) |
| 20-left-library-tab | Left panel Library: Animations / Effects / Transitions / Looks / Overlays & forms / Sounds, with counts |
| 21-browse-library-modal | Effects (33), LUTs & looks (16), Transitions (16), Extensions (0) |
| 22-sound-effects-library | Sound effects library (38) |
| 23-stock-media-popup | AI & stock media (Pexels / Pixabay / AI videos) |
| 24-add-to-timeline-menu | "Add to timeline": 681 items (Animations 406, Motion graphics 232, Overlays & forms 10, End screens & connect forms 13, Template videos 539) |
| 25-smart-speech, 26-template-generator, 27-personalization | Smart Speech, 9-step Template Generator, Personalization Suite |
| 40, 41-inspector-two-tracks-* | Two overlapping clips: Layout and Multicam sections appear in the Inspector |
| 42-follow-subject-dialog | Follow subject (motion tracking) dialog |
| 44-dual-viewer, 45-blade-tool-active | Dual viewer; Blade tool |
| 46, 47, 48 | Add to timeline > Overlays & forms / End screens & connect forms / Template videos |
| 60, 61, 62 | After step 1: no stray `=======`; Library "Template videos"; Add window opens on Template videos |
| 70-library-animations-pictures .. 73-library-effects | Library side panel with pictures: animations, overlays/forms/end screens, template video posters, effects |
| 74-library-search-all-categories | One search showing grouped picture results from several categories, each with "See all" |
| 75-click-card-opens-modal-on-item | Clicking a card opens the big Add window with that item found |
| 80-template-video-in-clip | A template video added from the Library: real filmstrip frames in the clip, real waveform in its audio clip, real frame in the viewer |
| 81-everything-added-in-timeline | Template video, sound, lead form, CTA and animation added: pictures in the Overlays lane, frames and waveforms in the tracks |
| 82-sound-on-its-own-track | The + on a template video adds it directly; a sound added over its audio goes on a new audio track (A2) |
| 83, 84, 85 | New blank project: the Start your video screen; Pick a template video opens the Add window on that tab; Make a video for me opens the Template Generator |
| 87, 88 | Library Favorites (★) and Recent strips; the same after a page reload |
| 89, 90 | Inspector in groups (Basics / Look / Position and motion / Captions / Analyze), full height, with Find a setting |
| 91, 92, 93 | New Publish tab: Share & Leads (unchanged) and Social with picture cards; clicking a card opens the existing Publish to Social window with the video's public link |
| 94 | Publish > Contacts: imported CSV (bad and duplicate rows skipped), chips with counts, search, download, remove; landing-page source reports it needs sign-in while the others still show |
| 95 | Publish > Email: connect MailerLite, choose who, video link, add to MailerLite; Send stays blocked with a plain reason until each step is done; says no email is sent |
| 96-social-window-1..4 | The Publish to Social window restyled to match the Personalize this demo window (black panels, lime accent, 22px shell, icon-tile header, pill step tabs, lime Publish button); all publishing logic unchanged |
| 97-100 | The Publish tab pages (Share & Leads, Social, Contacts, Email) in the lime accent, matching the Personalize and Publish to Social windows; the rest of the editor stays cyan |

## Not captured / not verified
- "Open full timeline" button: click timed out, no screenshot (30/43 missing).
- Voice-over recorder: "Could not access the microphone" (headless, expected).
- Anything needing a provider key or sign-in: caption generation, AI video, publish, analytics data, live translation.
- Effect thumbnails in the library modal render as dark placeholders in headless Chromium (WebGL); not confirmed in a real browser.
- Transitions and Multicam sections were not captured on a real cut/in the Inspector with a transition selected.
- Social publishing to the real networks, MailerLite connect/send, and Landing-page/Lead contacts need sign-in, provider keys and Supabase, which this environment does not have. Those paths are covered by unit tests with mocked clients and by the gate/error states above, not by a real send.
- Kit: sending a contact list to Kit is not built (the sync function omits it). New leads from video forms can already go to Kit via the form's own settings.
