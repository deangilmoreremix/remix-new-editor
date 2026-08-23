# Publish to Social — Placement & Design Plan (2026)

**Goal:** Ship a single, consistent "Publish to Social" affordance that appears
**next to the completed output** in every AI image/video studio — never in the
global topbar — and that is **gated on media being generated** (matches the
creation-loop model). This supersedes the misplaced always-on button currently
injected by `studioChrome.js`.

This plan is grounded in the 2026 design principles below and the existing
in-studio result-area patterns already in the codebase.

---

## 1. Design principles (2026 best practice, synthesized)

Three independent sources converge on the same rule set:

1. **TheFinch / "Creation loop"** — A generative-AI UX maps to:
   `Set intent → Provide input → Generate output → Refine → Export or publish`.
   *Publish is the **terminal** step.* It must be near the output, not in the
   global header, and must make "where you are in the loop" obvious.
   Source: `docs/ui-production-workflow-guide`-style guidance; TheFinch 2026.

2. **Novus / "Export as final handoff"** — The workflow is linear
   `upload → customize → export`. At export the user picks a **platform
   preset** (YouTube / TikTok / Instagram) and the correct format follows. The
   user's last action is "getting their video," not "navigating an obstacle."
   Source: Novus Product Blog, May 2026.

3. **Canva / "Share → Configure → Preview → Publish → Post-publish"** —
   Publish is initiated from an entry point near the completed work, then
   platform-specific settings are configured in a modal, then a **preview** is
   shown, then publish, then a post-publish result. The Publish primary action
   is **near the output**, never a competing always-on CTA in chrome.
   Source: Canva Content Publisher design guide.

### Derived rules

| Rule | What it means here |
|------|--------------------|
| Publish is terminal, not global | No "Publish to Social" in `studioChrome` topbar / editor top-actions bar. |
| Action lives on the output | The button renders **inside the result area**, next to Download, after media is generated. |
| Media-gated visibility | Button only exists once a `mediaUrl` is available (resultArea was `hidden`, now visible). |
| Platform-aware | `mediaType` (image vs video) is passed; platforms incompatible with the type are disabled in the modal. |
| One shared component | A single `OutputActionBar` renders identically in every studio. |
| Defer, don't duplicate | Full platform config (accounts, caption, privacy, scheduling) lives in the modal — the in-output button just opens it pre-filled. |

---

## 2. The shared component

Create one reusable component that every generator studio renders inside its
result area:

```
components/common/OutputActionBar.jsx   (or .js for the vanilla studios)
```

Props (input type, per the API-design guidance in-system):

```ts
interface OutputActionBarProps {
  mediaUrl: string;            // required — only rendered when truthy
  mediaType: 'image' | 'video';
  title?: string;
  description?: string;
  tags?: string[];
  externalUserId?: string;     // resolved from session; optional
  onPublished?: (result: { platform: string; url: string }) => void;
}
```

It renders a horizontal group (matching the existing `flex gap-3` two-button
pattern used by `CharacterStudio` / `CommercialStudio`):

```
[ Download ] [ Generate Again ] [ 📡 Publish to Social ]
```

- **Download** — native `<a download>` to the asset (unchanged behavior).
- **Generate Again** — re-triggers generation (unchanged behavior).
- **Publish to Social** — `onClick → openSocialPublish({ mediaUrl, mediaType, ... })`.
  Styled with the established gradient (`from-[#6d5efc] to-[#a855f7]`) so it is
  visually distinct as the terminal, brand accent action.

Visibility rule: the `OutputActionBar` is **only created/inserted once
`result.url` resolves**. The existing `resultArea` is `hidden` until generation
completes, so the button is inherently post-generation — this is the contract.

> This replaces the current ad-hoc inline `<button class="publish-social-btn">`
> markup that each studio writes into `resultArea.innerHTML`. Standardizing on
> one component fixes the per-studio drift and guarantees consistent placement.

---

## 3. Placement by output type

### 3a. Image generators → button in the image result card footer
Studios that emit a single generated image. The button sits in the same
footer row as Download, full-width on mobile.

| Studio | Result source | Notes |
|--------|---------------|-------|
| `src/components/EditStudio.js` (line ~724) | `result.url` (generateI2I) | Already inline; swap inline markup for `<OutputActionBar>`. |
| `src/components/UpscaleStudio.js` (line ~247) | `result.url` (generateI2I) | Already inline; swap. |
| `src/components/EffectsStudio.js` (image branch) | `result.url` (generateI2I) | Only image result present; remove the promptRow/mobile buttons (§4). |
| `src/components/StoryboardStudio.js` (line ~1329) | `frame.imageUrl` (per-frame) | Keep per-frame, in the frame card footer. |
| `src/components/CharacterStudio.js` (line ~362) | `result.url` (generateI2I) | Uses `flex gap-3` row — drop button in as the third child. |
| `src/components/CommercialStudio.js` (line ~334) | `result.url` (generateI2I) | Same `flex gap=3` row — drop button in. |
| `src/components/AvatarStudio.js` (line ~355) | `result.url` (generateAvatar video) | Currently Download-only — add `OutputActionBar` with `mediaType: 'video'`. |
| `src/components/TemplateStudio.js` (line ~1335) | `result.url` | Add to result card. |

### 3b. Video generators → button in the video deliver strip
Studios that emit a generated video. The button sits in the strip below the
`<video>` player, next to Download.

| Studio | Result source | Notes |
|--------|---------------|-------|
| `src/components/VideoToolsStudio.js` (line ~324) | `result.url` (processVideoTool) | Already inline; swap for `OutputActionBar` with `mediaType: 'video'`. |
| `src/components/EffectsStudio.js` (video branch) | `result.url` (generateI2V) | Wire to resultArea (image branch above). |
| `src/components/AvatarStudio.js` (line ~355) | `result.url` (generateAvatar) | `mediaType: 'video'`. |
| `src/components/SmartVideoViral.js` | studio result | Add after `resultArea` is populated. |
| `src/components/InfluencerStudio.js` (line ~976) | `result.url` | Currently Download-only — add `OutputActionBar`. |

### 3c. Timeline editor → button in the Deliver / Social action set
`TimelineEditorPage.jsx` is a real editor, not a one-shot generator. It already
has a proper in-flow `social` action in its action map (line ~4523:
`social: () => openSocialPublisherModal(state, showToast)`, which passes
`state.lastGeneratedVideo?.src`). Per the 2026 production-guide model, this is
the **Deliver/Export** group. The publish action belongs there — and the
redundant persistent button in `els.topActions` (lines 1851–1862) must be
removed.

---

## 4. What gets removed / changed

### 4.1 The topbar button (root cause of "top of every studio")
**File:** `src/lib/studioChrome.js`
- **Delete** `createStudioSocialPublishButton()` (lines 44–53) and the
  `SOCIAL_PUBLISH_SVG` constant (line 39).
- **Delete** `topbar.appendChild(createStudioSocialPublishButton());` (line 89).
- **Remove** the now-unused `import { openSocialPublish }` (line 10).
- Keep the topbar to **nav only**: menu button, back button, title. This is the
  rule: chrome = navigation, not creation actions.

**Impact:** removes the misplaced button from all 31 `mountStudioChrome()`
callers in one stroke (DirectorPage, InfluencerStudio, SmartVideoViral,
StoryboardPage, ChatStudio, LipSyncStudio, VideoToVideoPage, ImageToImagePage,
AudioStudio, EffectsPage, CharacterPage, AvatarStudio, CinemaPage, FashionStudio,
RenderPage, ProductPhotoStudio, VideoStudio, ContentLibraryPage, InfluencerPage,
VideoWatermarkPage, TrainingStudio, StoryboardStudio, ImageToVideoPage,
TextToVideoPage, TextToImagePage, ImageStudio, UpscalePage, CharacterStudio,
CommercialPage, CommercialStudio, CinemaStudio). Navigation chrome is untouched.

### 4.2 TimelineEditorPage top-actions button (secondary offender)
**File:** `src/components/TimelineEditorPage.jsx`
- **Delete** the persistent button block (lines 1851–1862) — the one with the
  comment "Persistent Social Publish entry point (visible without generated
  media)."
- **Keep** the existing in-flow `social` action (`openSocialPublisherModal`,
  line ~4101, wired at line ~4523 and ~4658) which correctly passes the
  generated video src. This is the terminal Deliver action the plan wants.

### 4.3 EffectsStudio pre-generation buttons (placement violation)
**File:** `src/components/EffectsStudio.js`
- **Delete** the promptRow "Publish to Social" button (lines 389–393) and the
  mobile one (lines 826–830). These live in the **control row**, visible before
  any result exists.
- **Replace** with `OutputActionBar` rendered inside `resultArea` after
  generation (the resultArea is `hidden` until output exists, so the button is
  correctly post-generation). Wire with `mediaType` resolved from the result.

### 4.4 Nav / landing pages (no change needed, confirm exclusion)
The following call `mountStudioChrome` but do **not** generate media — they must
**not** get a publish button:
ContentLibraryPage, CharacterPage, CinemaPage, DirectorPage, ImageToVideoPage,
TextToImagePage, TextToVideoPage, VideoToVideoPage, InfluencerPage,
VideoWatermarkPage, AudioStudio, TrainingStudio, RenderPage, CommercialPage
(landing), CinemaStudio, CharacterStudio (landing branch), and the `*Page`
landing surfaces. They lose nothing by the §4.1 removal and correctly stay clean.

---

## 5. Implementation order

1. **Add** `components/common/OutputActionBar.jsx` (thin wrapper around the
   existing `PublishToSocialButton` + Download + Generate-Again grouping) with
   the visibility gate (render nothing until `mediaUrl`).
2. **Remove** the topbar button from `studioChrome.js` (§4.1) — fixes every
   studio at once.
3. **Remove** the TimelineEditorPage top-actions button (§4.2); rely on the
   in-flow `social` action.
4. **Remove** the EffectsStudio pre-generation buttons (§4.3); render
   `OutputActionBar` in the result area instead.
5. **Migrate** the 4 already-inline studios (EditStudio, UpscaleStudio,
   VideoToolsStudio, StoryboardStudio) from ad-hoc `<button class="publish-social-btn">`
   markup to `<OutputActionBar>` for consistency.
6. **Add** `OutputActionBar` to the Download-only video/image studios that
   currently lack publish (AvatarStudio, InfluencerStudio, CommercialStudio,
   CharacterStudio, TemplateStudio).
7. **Update tests:** `tests/e2e/studio-navigation.spec.js` only asserts
   `[data-studio-back]`, `[data-studio-menu]`, `[data-studio-drawer]` — none
   are affected by the §4.1 removal. Add a light assertion that
   `[data-studio-social-publish]` is **not** present in chrome and that the
   publish button appears in the result area of a generator studio.

---

## 6. Acceptance criteria

- [ ] No `data-studio-social-publish` element is mounted by `studioChrome.js`.
- [ ] No "Publish to Social" text/button exists in `els.topActions` of
      `TimelineEditorPage.jsx`.
- [ ] Every generator studio renders publishing via `OutputActionBar` inside its
      result area, and only after `mediaUrl` is available.
- [ ] The button is never visible before content is generated (resultArea kept
      `hidden` until generation resolves).
- [ ] `openSocialPublish` is always called with a real `mediaUrl` + `mediaType`.
- [ ] E2E navigation test still passes for all studio routes.

---

## 7. Why this design wins (2026 alignment)

- **No pre-generation distraction.** The Finch creation loop ends in "Export or
  publish" — putting publish in chrome makes it look like an alternative to
  generation, confusing intent. Output-side placement makes it unambiguously a
  *deliver* action.
- **No competing primary CTAs.** Canva's rule: the Publish primary action is
  managed near the work, not duplicated in chrome. A single `OutputActionBar`
  avoids the "two publish buttons" problem.
- **Platform-fit is enforced.** `mediaType` is passed to the modal, which greys
  out incompatible destinations (YouTube/TikTok = video only). A chrome-level
  button with no `mediaUrl` cannot do this.
- **Linear, predictable handoff.** Novus: "the user's last action is getting
  their video." The output-side button keeps the eye flow
  generate → see result → Download / Publish, with no hunting to a header.
