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

## Not captured / not verified
- "Open full timeline" button: click timed out, no screenshot (30/43 missing).
- Voice-over recorder: "Could not access the microphone" (headless, expected).
- Anything needing a provider key or sign-in: caption generation, AI video, publish, analytics data, live translation.
- Effect thumbnails in the library modal render as dark placeholders in headless Chromium (WebGL); not confirmed in a real browser.
- Transitions and Multicam sections were not captured on a real cut/in the Inspector with a transition selected.
