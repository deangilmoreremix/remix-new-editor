# Modal Feature-Parity Audit

Working directory: `/Users/shasheemoore/Downloads/remix-new-editor/.kilo/worktrees/incandescent-cheese`
Baseline: `5c899efe` (all modal baselines were `src/components/modals/*.jsx`).
Scope: RESEARCH ONLY. No files modified.

---

## 1. Enumeration: all current modal files

| File | Lines | Directory |
|------|-------|-----------|
| `OpenAIImageEditorModal.jsx` | 3 | `src/components/modals/` |
| `SubtitleEditorModal.jsx` | 3 | `src/components/modals/` |
| `PersonalizeModal.jsx` | 606 | `src/components/modals/` |
| `TemplateThumbnailModal.jsx` | 971 | `src/components/modals/` |
| `GTMPromptModal.jsx` | 434 | `src/components/modals/` |
| `VideoPersonalizationHub.jsx` | 586 | `src/components/modals/` |
| `AIVideoCreator.jsx` | 220 | `src/components/modals/` |
| `LandingPageBuilder.jsx` | 962 | `src/components/modals/` |
| `LeadGeneratorModal.jsx` | 219 | `src/components/modals/` |
| `AuthModal.js` | 124 | `src/components/` |
| `ImportTimelineModal.jsx` | 40 | `src/components/` (not covered by task glob beyond find scope) |

**Legacy-style `.js` duplicates** (also match modal glob):
- `BaseModal.js` (346), `VoiceModal.js` (443), `ImageCropperModal.js` (486), `CreateProjectModal.js` (417), `TemplatePreviewModal.js` (377), `SettingsModal.js` (669), `ContactImporterModal.js` (187)

---

## 2. Baseline availability (per `git cat-file -e 5c899efe:src/components/modals/<Base>.jsx`)

### HAS_BASELINE (17 modals)

BaseModal, VoiceModal, ImageCropperModal, SettingsModal, TemplatePreviewModal, VideoPlayerModal, UrlVideoModal, TemplateGeneratorModal, SocialPublisherModal, SaveProjectModal, RecorderModal, PreviewMediaModal, PageShotModal, EnhancedRecorderModal, EndScreenModal, EmailCampaignModal, ContactImporterModal, ConnectModal.

### NO_BASELINE (14 modals)

CreateProjectModal, AuthModal, GTMPromptModal, TemplateThumbnailModal, PersonalizeModal, LeadGeneratorModal, OpenAIImageEditorModal, SubtitleEditorModal, VideoPersonalizationHub, LandingPageBuilder, AIVideoCreator.

---

## 3. Feature diffs — modals WITH a baseline

Run-time note: Of the 17 baselines, **16 current `.jsx` files are byte-level identical** (zero `diff` output). The only deviations are:

### 3.1 SettingsModal.jsx — ADDED `data-tooltip` attributes only
- **Before:** buttons had no `data-tooltip`.
- **After:** `data-tooltip="<Tab> settings"`, `"Use dark theme"`, etc., added to nav-item and toggle inputs.
- **Dropped features:** NONE.
- **Net:** cosmetic attributes; no logic/fields removed.

### 3.2 TemplatePreviewModal.jsx — ADDS tooltips; removes console.log stubs
- **Before:** no `data-tooltip`, ended with trailing `console.log('…')` blocks under `renderPreviewPlayback`, `renderTemplateEditor`, and `renderUseTemplate`.
- **After:** `data-tooltip` added to edit/use/mode buttons; trailing `console.log` blocks deleted; export-default line added.
- **Dropped features:** NONE functional. The removed console.logs were diagnostic stubs, not feature logic.

### 3.3 All other 16 `.jsx` modals (BaseModal, VoiceModal, ImageCropperModal, VideoPlayerModal, UrlVideoModal, TemplateGeneratorModal, SocialPublisherModal, SaveProjectModal, RecorderModal, PreviewMediaModal, PageShotModal, EnhancedRecorderModal, EndScreenModal, EmailCampaignModal, ContactImporterModal.jsx, ConnectModal.jsx)
- Baseline vs current: **IDENTICAL** (`diff --stat` reports 0 lines changed).
- No dropped fields, buttons, API routes, store mutations, or callbacks.

---

## 4. NEW modals (no baseline — “review completeness”)

| Modal | File | Notes |
|-------|------|-------|
| `AuthModal` | `src/components/AuthModal.js` | 124-line function factory rendering Muapi API key prompt; no baseline. |
| `CreateProjectModal` | `src/components/modals/CreateProjectModal.js` | 417-line legacy rewrite; no baseline. |
| `GTMPromptModal` | `src/components/modals/GTMPromptModal.jsx` | 434 lines, new. |
| `TemplateThumbnailModal` | `src/components/modals/TemplateThumbnailModal.jsx` | 971 lines (full thumbnail studio); no baseline. |
| `PersonalizeModal` | `src/components/modals/PersonalizeModal.jsx` | 606 lines (Maigret/GitHub/website crawl + OpenAI enrichment); no baseline. |
| `LeadGeneratorModal` | `src/components/modals/LeadGeneratorModal.jsx` | 219 lines. |
| `VideoPersonalizationHub` | `src/components/modals/VideoPersonalizationHub.jsx` | 586 lines. |
| `LandingPageBuilder` | `src/components/modals/LandingPageBuilder.jsx` | 962 lines. |
| `AIVideoCreator` | `src/components/modals/AIVideoCreator.jsx` | 220 lines. |

---

## 5. STUB verification (opaque 3-line shells)

| Modal | File | Verdict |
|-------|------|---------|
| `OpenAIImageEditorModal` | `src/components/modals/OpenAIImageEditorModal.jsx` | **SHELL STUB** — 3 lines. `export default function OpenAIImageEditorModal() { return null; }`. No `BaseModal` subclass, no renderBody, no props, no network. |
| `SubtitleEditorModal` | `src/components/modals/SubtitleEditorModal.jsx` | **SHELL STUB** — 3 lines. `export default function SubtitleEditorModal() { return null; }`. Same pattern. |
| `PersonalizeModal` | `src/components/modals/PersonalizeModal.jsx` | **NOT A STUB** — 606-line `class PersonalizeModal extends BaseModal` with real renderBody, Maigret/GitHub/website crawl, `/api/personalizer/scan` and `/api/personalizer/generate`, localStorage contact+profile persistence, token-chip insertion. |
| `TemplateThumbnailModal` | `src/components/modals/TemplateThumbnailModal.jsx` | **NOT A STUB** — 971-line `class TemplateThumbnailModal extends BaseModal`. Full 4-step (brief → generate → refine → saved), ejector arm for enhancements, ThumbnailService calls, mask-canvas inpaint, sidebar presets / aspect-ratio / quality / style / background. |

---

## 6. Duplicate module files

### 6.1 BaseModal
- **`src/components/modals/BaseModal.jsx`** (807 lines) — imported explicitly by: `GTMPromptModal.jsx`, `PersonalizeModal.jsx`, `VideoPersonalizationHub.jsx`, `LeadGeneratorModal.jsx`, `LandingPageBuilder.jsx`, `AIVideoCreator.jsx`, `TemplateThumbnailModal.jsx`. Also referenced as `./BaseModal.jsx` and `./BaseModal` by other modal classes.
- **`src/components/modals/BaseModal.js`** (346 lines) — imported by: `SettingsModal.js`, `VoiceModal.js`, `TemplatePreviewModal.js`, `ImageCropperModal.js`, `CreateProjectModal.js`. Extends `Component` from `../base/Component.js`, not a `BaseModal.jsx` subclass.
- **Verdict:** Both are **canonical and in-use** for separate code families. The `.jsx` base feeds all modern modals; the `.js` base feeds the legacy `.js` modal variants.

### 6.2 SettingsModal
- **`src/components/modals/SettingsModal.jsx`** (471 lines) — imported in `src/components/TimelineEditorPage.jsx` (`import { SettingsModal } from './modals/SettingsModal.jsx'`) and in `src/lib/enhancedModalManager.js` as `'../components/modals/SettingsModal.jsx'`.
- **`src/components/modals/SettingsModal.js`** (669 lines) — imported in `src/main.js` via `import('./components/SettingsModal.js')` (line 197) and `import('./components/modals/SettingsModal.js')` (line 305).
- **`src/components/SettingsModal.js`** — file exists in a different path; the grep for `SettingsModal` matches it because `main.js` also references it.
- **Verdict:** Both `.jsx` and `.js` variants are **actively imported** and are **functionally divergent** (see §7 for details). The `.jsx` is the timeline-editor canonical entry; the `.js` (both modals/ and components/ paths) are `main.js` entry-point variants. They are NOT aliases — they are different implementations.

### 6.3 ContactImporterModal
- **`src/components/modals/ContactImporterModal.jsx`** (354 lines) — imported by `TimelineEditorPage.jsx` (`import { ContactImporterModal } from './modals/ContactImporterModal.jsx'`) and `enhancedModalManager.js`. **Canonical multi-source importer** (Google, Outlook, CSV, field mapping).
- **`src/components/ContactImporterModal.js`** (187 lines) — imported by `src/components/PersonalizePage.js` (`import ContactImporterModal from './ContactImporterModal.js'`). **Personalization-page simplified variant** (CSV-only upload + preview).
- **Verdict:** Both are **in-use**, but they are **separate, divergent implementations**. The `.jsx` is canonical for the timeline/editor workflows. The `.js` is a personalization-page replacement.

### 6.4 TemplatePreviewModal
- **`src/components/modals/TemplatePreviewModal.jsx`** (207 lines) — imported by `TimelineEditorPage.jsx` and `enhancedModalManager.js`. **Canonical**.
- **`src/components/modals/TemplatePreviewModal.js`** (377 lines) — imported internally only by itself (`import BaseModal from './BaseModal.js'`). No external callers in `src/`. **UNUSED dead code.**
- **Verdict:** `.jsx` is canonical; `.js` is an **orphaned legacy rewrite** not wired into any entry point.

---

## 7. Feature drops in new `.js` rewrites

### 7.1 SettingsModal.js (NEW — no baseline)
Compared to the canonical `SettingsModal.jsx`:

**Dropped UI/fields:**
- **Video tab** — GPU Acceleration toggle, Hardware Decoding toggle, Preview Quality, Render Quality, Default Resolution (1080p / 4K / 720p / vertical / square).
- **Keyboard tab** — Keyboard Shortcuts display + “Reset to Defaults” action.
- `data-tooltip` attributes (subtle UX drop).

**Dropped behavior / callbacks:**
- **`onConfirm({ action: 'settingsSaved', general, audio, video, export })`** structured callback — replaced with `localStorage.setItem('video-editor-settings', …)` and no structured payload on confirm.

**Added/kept fields:**
- Added tabs: **Appearance** (theme, font-size, showGrid, snapToGrid, gridSize), **Account** (notifications, usage-reports, data-collection, export-history), **Advanced** (experimental, debug-mode, cache-size, max-undo-steps).
- Added actions via local .js only: **Export Settings** (JSON download), **Import Settings** (JSON file input), **Reset to Defaults** (with confirm), **Clear Application Cache**, **Export Debug Logs**.

**Verdict:** Functionally divergent; not a 1:1 rewrite. The .js covers application-wide settings with persistence; the .jsx covers per-project editor preferences with a callback-driven relay.

### 7.2 ContactImporterModal.js (NEW — no baseline)
Compared to the canonical `ContactImporterModal.jsx`:

**Dropped features:**
- **Import sources:** Google Contacts, Outlook — replaced by CSV-only upload.
- **Multi-step wizard:** 4 steps (Source → Map Fields → Review → Importing) → reduced to 2 steps (Upload → Preview).
- **Field mapping UI:** `<select>` dropdowns mapping CSV headers to contact properties + “Required” badges, plus “Add Tags” input with tag chips.
- **Progress animation:** animated importing step with circular progress indicator.
- **`onConfirm({ action: 'importComplete', contacts, tags, source })`** structured payload — replaced with `this.onContactsImported(this.contacts)` returning a flat contacts array.
- **Contacts/variables preview table:** the 5-contact preview list rendered in the .js is much sparser than the baseline Review step.

**Kept:** file-input with CSV parsing, basic contact preview.

### 7.3 TemplatePreviewModal.js (NEW — no baseline)
Compared to the canonical `TemplatePreviewModal.jsx`:

**Dropped features:**
- **View toggle:** Grid / Detail view buttons.
- **Category filter:** `<select id="category-filter">` filter.
- **Template detail panel:** full template-scene list with thumbnails (“Scenes” preview).
- **Selection + Apply flow:** preview/select/Apply to Template with `onConfirm(this.selectedTemplate)`.

### 7.4 BaseModal.js (NEW — no baseline)
Compared to the canonical `BaseModal.jsx`:

**Dropped features:**
- **`showFooter` option** — `.jsx` supports `showFooter: true/false`; `.js` always renders footer.
- **`footerContent` option** — `.jsx` allows custom footer HTML; `.js` forces `renderFooter()` override.
- **Built-in error/loading states** — `.jsx` provides `this.setLoading(loading)` and `this.setError(error, message)` with auto-render of spinner / “Try Again / Dismiss” error rendering; `.js` has no error/loading state helpers.
- **`removeEventListeners()`** — `.jsx` cleans up bound `keydown`/close/confirm/cancel listeners before focus restore; `.js` does not.
- **Promise-based `static alert / confirm / prompt`** — `.jsx` has these; `.js` has a `static alert/confirm/prompt` but they are simplistic (no Promise, no input id).

---

## 8. Summary (concise modal-by-modal list)

- **BaseModal.jsx** — status: BASELINE identical — no change to fields/actions/API/store/callback vs 5c899efe.
- **BaseModal.js** — status: NEW — dropped `showFooter`/`footerContent`, error/loading states, `removeEventListeners` cleanup. Legacy base for `.js` modal family only.
- **VoiceModal.jsx** — status: BASELINE identical.
- **VoiceModal.js** — status: NEW (no baseline).
- **ImageCropperModal.jsx** — status: BASELINE identical.
- **ImageCropperModal.js** — status: NEW (no baseline).
- **CreateProjectModal.js** — status: NEW (no baseline).
- **AuthModal.js** — status: NEW (no baseline) — simple API-key prompt factory.
- **SettingsModal.jsx** — status: BASELINE + minor `data-tooltip` additions — no functional drop.
- **SettingsModal.js** — status: NEW — drops Video tab (GPU/hardware-decode/quality/resolution), Keyboard tab (shortcuts), structured `onConfirm` payload (replaces with `localStorage` setItem). Adds Appearance/Account/Advanced tabs + Import/Export/Reset/Clear Cache/Export Logs.
- **VideoPlayerModal.jsx** — status: BASELINE identical.
- **UrlVideoModal.jsx** — status: BASELINE identical.
- **TemplatePreviewModal.jsx** — status: BASELINE minor — adds `data-tooltip` to buttons; removes obsolete console.log stubs. No functional drop.
- **TemplatePreviewModal.js** — status: NEW + **UNUSED** — drops view-toggle (grid/detail), category filter, template detail/scenes panel, selection confirmation flow. No external imports point to this file.
- **TemplateGeneratorModal.jsx** — status: BASELINE identical.
- **SocialPublisherModal.jsx** — status: BASELINE identical.
- **SaveProjectModal.jsx** — status: BASELINE identical.
- **RecorderModal.jsx** — status: BASELINE identical.
- **PreviewMediaModal.jsx** — status: BASELINE identical.
- **PageShotModal.jsx** — status: BASELINE identical.
- **EnhancedRecorderModal.jsx** — status: BASELINE identical.
- **EndScreenModal.jsx** — status: BASELINE identical.
- **EmailCampaignModal.jsx** — status: BASELINE identical.
- **ContactImporterModal.jsx** — status: BASELINE identical (current file = baseline). Canonical multi-source wizard with progress, field mapping, tags, `onConfirm({ action, contacts, tags, source })`.
- **ContactImporterModal.js** — status: NEW — drops Google/Outlook sources, 4-step wizard, field-mapping, progress animation, tags UI, structured `onConfirm`. Reduces to CSV upload + preview.
- **ConnectModal.jsx** — status: BASELINE identical.
- **GTMPromptModal.jsx** — status: NEW (no baseline).
- **TemplateThumbnailModal.jsx** — status: NEW but FULL IMPLEMENTATION (971 lines) — NOT a stub; full thumbnail studio.
- **PersonalizeModal.jsx** — status: NEW but FULL IMPLEMENTATION (606 lines) — NOT a stub; has Maigret/GitHub/website crawl, OpenAI enrichment, token-chip insertion.
- **LeadGeneratorModal.jsx** — status: NEW (no baseline).
- **OpenAIImageEditorModal.jsx** — status: **STUB** — shell, 3 lines, returns null.
- **SubtitleEditorModal.jsx** — status: **STUB** — shell, 3 lines, returns null.
- **VideoPersonalizationHub.jsx** — status: NEW (no baseline).
- **LandingPageBuilder.jsx** — status: NEW (no baseline).
- **AIVideoCreator.jsx** — status: NEW (no baseline).
- **ImportTimelineModal.jsx** — status: NEW (no baseline) — 40-line function factory.

---

## 9. Per-pair canonical/un-use verdict

| Pair | Canonical | In-use | Unused/orphaned |
|------|-----------|--------|-----------------|
| BaseModal | `.jsx` | Modern `.jsx` modal family | `.js` is legacy base (still wired) |
| SettingsModal | `.jsx` (timeline editor) + `.js` (main.js) | Both wired; **functionally divergent** | neither |
| ContactImporterModal | `.jsx` (modals/) | TimelineEditorPage + modal manager | `.js` (components/) is personalization-page variant (still wired but separate behavior) |
| TemplatePreviewModal | `.jsx` | TimelineEditorPage + modal manager | `.js` **is unused** (no external caller in `src/`) |
