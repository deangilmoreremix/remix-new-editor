# Personalization in the Timeline Editor and the Personalize window

The Personalize window (`mount.jsx` → `PersonalizationModal.tsx`) and the Timeline Editor
(`src/components/TimelineEditorPage.jsx`) are two surfaces over one set of data and rules.
There is no separate "studio" any more: everything the window can do is reachable from the
timeline, and what is edited in one shows up in the other.

## One data model (pure modules in `src/lib/personalization/`, no DOM)
| File | Job |
| --- | --- |
| `assetUrl.js` | The one place that decides which image URL an asset uses (cutout first, durable before `blob:`). |
| `backgroundCutout.js` | Free on-device background removal for a saved image; writes the result as the same asset (id kept, cutout in `url`, old image in `originalUrl`). |
| `prepareImages.js` | Plans and runs the cutout for every contact's logo / photo / product image. |
| `batchExport.js` | Sequential, cancellable, continue-on-failure batch runner and file naming, shared by both export paths. |
| `layerOverlayBridge.js` | Converts the window's `PreviewLayer`s ⇄ timeline overlay clips (images, text, **designs**). |
| `layoutCheck.js` | Layout problems for every overlay (exact rectangles), readability from measured video frames, recommended placement. |
| `readiness.js` | The "Ready to export?" checklist, composed from the editor's existing checks. |
| `brandFromProfile.js` | A contact's brand fields as the window's composition reads them. |

Contacts and their images reach the timeline through `src/lib/editor/personalize/clientSync.js`
(studio clients → contact profiles; the studio's version of an asset wins per id).

## How a design gets from the window onto the timeline
1. The timeline opens the window with `initialLayers` (its tagged overlays) and `onLayersChange`
   (`openPersonalizeWindow` in `TimelineEditorPage.jsx`).
2. On close, edited layers come back; `applyPersonalizeLayers` replaces the tagged clips
   (`clip.bridge = { source: 'personalize-modal', layerId }`) as one undo step.
3. A `design` layer becomes an `overlay-design` clip. `preview/DesignOverlay.tsx` draws the registered
   Remotion design on a transparent background in the clip's box; `remotion/designOverlays.js` loads the
   catalog lazily (preview engine and the sandboxed export runner), like effects.
4. Only the end card stays in the window.

## Where each entry point goes
- Timeline **Personalization** panel / chip / "Personalization Suite" rail item / `VideoPersonalizationHub` /
  `data-modal="personalization"` → `openPersonalization({ studioId: 'timeline' })`.
- **Browse templates** → the same window, opened on the template step (`openTo: 'templates'`).
- The timeline's **AI chat** gets the same functions through `editor.personalization()`
  (`personalizationService()` in `TimelineEditorPage.jsx`; tools in `src/lib/editor/agent/tools.js`).

## Left alone on purpose
The legacy root `components/` tree (`PersonalizeButton`, `PersonalizerActivation`, `VideoPersonalizer`,
`VideoUploader`, `PERSONALIZATION_MODAL`) is not part of the live editor; other legacy files import it, so it
was not removed. `TimelineEditorPage.jsx` is a protected file: change it only together with
`src/test/protected-upload-baseline.test.ts` (checksum and section-5 assertions).
