<!-- Proposed text for the description of pull request #117 (the current one is out of date). Written for the repo's PR template headings. -->

## Summary

The Template Generator now builds **reusable templates**: pick footage and motion, write a script, choose a transition, style the text, add a voiceover and music, add word-timed captions, then save the template, add it to the timeline, export it as a video, or turn it into a landing page. Saved templates sync across a signed-in user's devices. Every source in the Video step has real previews instead of placeholders.

The generator had stopped using its wizard: a merge had kept an older modal, so the wizard rules and the Pexels/Pixabay code were tested but unused. That is restored, on the new Timeline Studio Editor only.

## Related issue

None.

## Changes

- **Wizard and design**: the upstream's 4 steps (Video, Script, Overlay, Preview) with the original rules (5 clips max, Overlay needs 2+, guarded steps), renamed to **Template Generator**, redesigned on the timeline editor's tokens (glass shell, step rail, sticky footer with a live summary, track lanes on Preview).
- **Save, reuse, sync**: *Save as template*, a *My templates* library (search, use, duplicate, delete), local first. New owner-only table `template_generator_templates` (migration `20261112212041`, already applied): newest edit wins, deletes travel as tombstones, per-user copies, signed-out templates adopted on sign-in.
- **Footage and overlays, all with real previews**: ready-made video templates catalog, Pexels and Pixabay (videos and photos), My media, Upload, AI generate; Animations (HyperFrames + RemotionUI), Motion graphics, End screens and Connect forms (call buttons need the business's own phone number, validated). Stills come from the editor's own renderer (`scripts/generate-template-generator-thumbs.mjs`); 22 motion graphics the sandbox renders as nothing are not offered (`mg-render-blocklist.json`).
- **Scripts**: 120 written niche scripts with business details, an optional AI writer on the user's own key, and a notice when a script still contains an example testimonial.
- **Transitions and text**: the editor's real GL transitions and animated lower-third styles; editable styled text (presets, font, colour, outline, box, entrance) that lands on the timeline as the editor's own Smart Text.
- **Audio**: voiceover (OpenAI on the user's key, or a free on-device voice), three bundled music tracks, a mix with ducking.
- **Background cut-out**: BiRefNet (BG0) first, MODNet as the fallback, on the device.
- **Export**: renders a real MP4 in the browser through the same code as the Export tab.
- **Captions**: 27 caption looks ported from Capite (MIT, credited) added to the editor's own caption styles; word timing on the device from **Whisper WebGPU** (`@remotion/whisper-webgpu`, in a worker, with the editor's built-in Whisper as the automatic fallback) or the native **Whisper.cpp** (`@remotion/install-whisper-cpp`, through `scripts/transcribe-whisper-cpp.mjs` and a localhost-only `scripts/captions-server.mjs` that the panel offers while it answers). A browser Whisper.cpp (WASM) engine is kept but marked experimental. The captions land on the timeline as the editor's own captions, with `.srt` download and an optional "make captions automatically with the voiceover".
- **Add to Video Pages**: a button on the Preview step opens the app's one landing page picker (`openLandingPagePicker`) with the rendered video attached, above the generator window (new optional `zIndex`); "Save as my page" creates the draft.
- **Rename**: the landing-page editor library's name is gone from the code (folders, 49 design ids now `editable-*`, the page-data key `config.editor`, identifiers, the dependency installed as `@page-editor/core`, an npm alias of the same package). No stored data needed converting (the shared `landing_pages` table had no rows). A guard test keeps the old name out.
- **Cleanups**: the raw `#111` surface colour is the `card-bg` theme token in 43 files (the protected Chat file is untouched), so `lint:cinema-hex` passes; guides for the Video Pages and Zack D studios in Ask SmartVideo; design pictures for the plain landing layouts (`scripts/generate-landing-design-previews.mjs`); fixes for pre-existing failing tests; `timeline-editor.tsx` parity budget 240 (develop's own copy had grown past 220).
- Merged `origin/develop` several times; the new editor-name rename was applied to develop's new landing-page files each time.
- Plan and decisions: `plans/template-generator-2026-redesign.md`; how to verify the parts that need keys, sign-in or hardware: `docs/template-generator-verification.md`.

## Testing

- `npx vitest run` over the whole repo on the final head: **883 files, 13,391 tests passed** (63 tests and 1 file skipped, none failing).
- `eslint src` clean; `npm run lint:cinema-hex` and `npm run check:ask-index` pass; `tsc --noEmit` shows only the errors that already exist in `apps/` and `packages/` (22 when last checked); `npm run build` completes.
- Real browser checks (headless Chrome, GPU-less): every wizard step and source, GL transition and lower-third previews, real MP4 export, audio playback, BG0 cut-out on a photo and a video, the Whisper WebGPU package (software adapter) and its fallback, native Whisper.cpp and the local server (health, CORS, a real transcription), the landing design pictures.
- Sync checked against the live database with simulated tokens: two devices (save, pull, edit, delete, no resurrection) and 13 security checks. All test rows were removed.
- **Not verified, needs a real sign-in, keys or hardware:** a real render → Add to Video Pages → "Save as my page" (upload and draft row); the Clerk sign-in and `supabase-token` function end to end (needs `SUPABASE_JWT_SECRET` in Netlify); live Pexels, Pixabay and OpenAI voice with real keys (`scripts/verify-template-generator-keys.mjs`); two-device sync with real sign-ins; cut-out on a real presenter clip on a GPU; Whisper WebGPU speed on a GPU; Whisper.cpp in the browser (needs the cross-origin isolation headers) and the local server called from the live site.

## Notes for reviewers

- The other app that shares the `landing_pages` table must adopt the renamed ids and key (`editable-*`, `config.editor`) before it writes pages.
- The diff includes generated pictures under `public/*/thumbs` and `public/landing-previews`; regenerate with the scripts when catalogs or designs change. The production build also rewrites some tracked thumbnails (`sync-mg-thumbs`); those changes are not committed.
- The `video-pages` and Zack D guides, the help entries and the parity budget are small adjustments to keep develop's own checks green.

## Checklist

- [x] The change is focused on a single logical concern (the Template Generator).
- [x] I ran the relevant tests locally (the whole vitest suite, lint and a production build; `make test-contracts` is for the Python pipeline and not relevant here).
- [x] I updated docs/README if behavior or usage changed (`docs/template-generator-verification.md`, `plans/template-generator-2026-redesign.md`).
- [ ] No unrelated files (build artifacts, local config) are included in the diff. *The diff includes generated still images under `public/`; regenerate with the scripts when catalogs change.*
