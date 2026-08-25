# Modal Integration Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every modal load, render with correct layout, and wire its output into the editor/timeline — eliminating the two-base-modal split, missing CSS, and the GTM/BaseModal divergence.

**Architecture:** One canonical vanilla `BaseModal` (`src/components/modals/BaseModal.jsx`). All modals are vanilla-JS classes that `extends BaseModal`. `modal-styles.css` (restored, 4,054 lines) holds shared + per-modal layout. The GTM prompt is routed through the same `BaseModal` contract instead of the parallel `uiIntegration.js` overlay manager. Dropped features in the `.js` modal rewrites are restored from the `5c899efe` baselines.

**Tech Stack:** Vite + Vitest (vanilla JS, no React in the editor), vanilla-JS modal classes, CSS-vars design system.

## Key correction (verified before planning)

The earlier "101 disabled handlers" framing was wrong. Rigorous analysis (`awk` over every marker) shows:
- **99 / 101** markers are standalone annotation lines; the code on the next line is **active** (e.g. `addEndScreenToTimeline(result,state)` at `TimelineEditorPage.jsx:1206`, `addVideoToTimeline(result,state)` at `:2806`, `state.projectId = result.projectId` at `:1222`).
- The remaining **2** "matches" are false positives: line 70 is the doc comment *defining* the convention; line 4088's next line is a descriptive `//` comment, not disabled code.
- **Zero** markers disable functionality. `AIVideoCreator.addVideoToTimeline` (the audit's "real stub") is fully wired.

Therefore Task 0 (remove markers) is **cosmetic only**; the real fixes are Tasks 1–5.

## Global Constraints
- Vite resolves `./BaseModal` (no extension) to **`.js` before `.jsx`** — always import the vanilla base as `from './BaseModal.jsx'`.
- Do not re-introduce React into the editor modals; `BaseModal.js` (`class Modal extends Component`) is the legacy React base and must not shadow `BaseModal.jsx`.
- Every modal class must satisfy `instanceof BaseModal` + have `renderBody`/`open`/`close` (guarded by `src/components/modals/modal-integration-test.test.js`).
- Use exact baselines from `git show 5c899efe:src/components/modals/<Name>.jsx` for any feature-restore.

---

### Task 0: Remove the 101 `// DISABLED:` annotation lines (cosmetic)

**Files:**
- Modify: `src/components/TimelineEditorPage.jsx` (101 annotation-only lines)

**Why:** These lines are noise and misled the audit. Removing them proves nothing breaks.

- [ ] **Step 1: Remove standalone `// DISABLED:` annotation lines only**

The regex matches lines that *are* exactly the annotation (possibly trailing whitespace), so the doc comment at line 69 (`// Routines that ... // DISABLED:`) is untouched because it does not *start* with `// DISABLED:`.

```bash
cd /Users/shasheemoore/Downloads/remix-new-editor/.kilo/worktrees/incandescent-cheese
perl -i -ne 'print unless /^\s*\/\/ DISABLED:\s*$/' src/components/TimelineEditorPage.jsx
```

- [ ] **Step 2: Confirm count went to ~0 and no real code was deleted**

```bash
echo "Remaining markers:"; grep -rc "// DISABLED" src/components/TimelineEditorPage.jsx
echo "Sanity: core handlers still present:"
grep -n "addEndScreenToTimeline(result, state)\|addVideoToTimeline(result, state)\|state.projectId = result.projectId" src/components/TimelineEditorPage.jsx | head
```
Expected: marker count `0`; the three handler lines still present.

- [ ] **Step 3: Re-run the integration test + build to prove no behavior change**

```bash
npx vitest run src/components/modals/modal-integration-test.test.js 2>&1 | tail -3
npx vite build 2>&1 | tail -1
```
Expected: `21 passed, 10 skipped`; `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add src/components/TimelineEditorPage.jsx
git commit -m "chore: remove 101 no-op // DISABLED: annotation lines"
```

---

### Task 1: Backfill missing per-modal CSS layout classes

**Files:**
- Modify: `src/components/modals/modal-styles.css` (add missing selectors)
- Read-only: `src/components/modals/*.jsx`, `src/components/*.js`

**Interfaces:**
- Consumes: nothing
- Produces: a `modal-styles.css` where every `className` used by a current modal has a matching rule.

**Finding (agent B):** only the `url-video` family matched the restored CSS; `saveproject-container`, `gtm-prompt-modal`, `connect-modal`, `email-campaign-modal`, `social-publisher`, `template-generator`, etc. are referenced by current modals but **absent** from the restored CSS (the restored CSS predates current class names).

- [ ] **Step 1: Extract every className used by current modals**

```bash
cd /Users/shasheemoore/Downloads/remix-new-editor/.kilo/worktrees/incandescent-cheese
grep -rhoE "class(Name)?=[\"'\`][^\"'\`]+[\"'\`]" src/components/modals/*.jsx src/components/*.js \
  | grep -oE "[\"'\`][^\"'\`]+[\"'\`]" | tr -d "\"'\`" | tr ' ' '\n' | sort -u > /tmp/used_classes.txt
wc -l /tmp/used_classes.txt
```

- [ ] **Step 2: Extract every class selector defined in the restored CSS**

```bash
grep -oE "\.[a-zA-Z][a-zA-Z0-9_-]+" src/components/modals/modal-styles.css | tr -d '.' | sort -u > /tmp/css_classes.txt
```

- [ ] **Step 3: List the gap (used but undefined)**

```bash
comm -23 /tmp/used_classes.txt /tmp/css_classes.txt
```
Expected: a finite list of missing selectors (e.g. `saveproject-container`, `gtm-prompt-modal`, `connect-modal`, `email-campaign-modal`, `social-publisher`, `template-generator`).

- [ ] **Step 4: Add the missing selectors to `modal-styles.css`**

Append a clearly-commented section at the end of `modal-styles.css` defining each missing class with the CSS-var design tokens already used in the file (e.g. `--modal-bg`, spacing scale). Keep each rule minimal but functional (flex container, padding, gap). Do NOT restyle existing rules.

- [ ] **Step 5: Verify build + spot-check one modal in dev**

```bash
npx vite build 2>&1 | tail -1
```
Expected: `✓ built`. (Manual: `npm run dev`, open SaveProject + GTM modals, confirm layout no longer collapses.)

- [ ] **Step 6: Commit**

```bash
git add src/components/modals/modal-styles.css
git commit -m "fix(modal): backfill per-modal CSS classes missing from restored stylesheet"
```

---

### Task 2: Eliminate the BaseModal shadow trap permanently

**Files:**
- Rename: `src/components/modals/BaseModal.js` → `src/components/modals/BaseModal.react.js`
- Modify: the 6 `.js` modals that import it — `CreateProjectModal.js`, `ImageCropperModal.js`, `VoiceModal.js`, `SettingsModal.js`, `TemplatePreviewModal.js`, `ContactImporterModal.js` (change `from './BaseModal.js'` → `from './BaseModal.react.js'`)

**Interfaces:**
- Consumes: nothing
- Produces: no file named `BaseModal.js` exists, so `./BaseModal` can never again resolve to the React base.

**Why:** `BaseModal.js` (`class Modal extends Component`, React) is a different, incompatible base. The 15 `.jsx` modals were crashing because Vite resolved `./BaseModal` to `.js`. Task 0-area fix already pointed them at `.jsx`; this task removes the trap so it cannot recur.

- [ ] **Step 1: Confirm exactly who imports `BaseModal.js`**

```bash
cd /Users/shasheemoore/Downloads/remix-new-editor/.kilo/worktrees/incandescent-cheese
grep -rln "from './BaseModal.js'" src/ | grep -v node_modules
```
Expected: exactly the 6 `.js` modal files above + `modal-integration-test.test.js` (test uses `.jsx`, will not match).

- [ ] **Step 2: Rename the React base and repoint its 6 importers**

```bash
git mv src/components/modals/BaseModal.js src/components/modals/BaseModal.react.js
for f in CreateProjectModal ImageCropperModal VoiceModal SettingsModal TemplatePreviewModal; do
  perl -i -pe "s{from './BaseModal.js'}{from './BaseModal.react.js'}g" "src/components/modals/$f.js"
done
```

- [ ] **Step 3: Confirm the shadow is gone and nothing still imports the old name**

```bash
grep -rln "from './BaseModal.js'" src/ | grep -v node_modules | wc -l   # expect 0
test -f src/components/modals/BaseModal.js && echo "STILL EXISTS" || echo "removed"
```

- [ ] **Step 4: Build + run integration test**

```bash
npx vitest run src/components/modals/modal-integration-test.test.js 2>&1 | tail -3
npx vite build 2>&1 | tail -1
```
Expected: still `21 passed, 10 skipped`; `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/modals
git commit -m "refactor(modal): rename React BaseModal.js to BaseModal.react.js to kill shadow trap"
```

---

### Task 3: Unify the GTM prompt with the BaseModal system

**Files:**
- Read-only: `src/lib/uiIntegration.js` (`openGTMPromptModal`, `EnhancementModalManager`)
- Modify: `src/components/modals/GTMPromptModal.jsx` (ensure it `extends BaseModal` from `./BaseModal.jsx`)
- Modify: `src/lib/uiIntegration.js` (route `openGTMPromptModal` through `new GTMPromptModal({...}).open()` or keep the manager but have it use BaseModal)

**Interfaces:**
- Consumes: `GTMPromptModal` (vanilla `BaseModal` subclass)
- Produces: single modal instantiation contract; GTM modal appears in the same stack as other modals.

**Finding:** `GTMPromptModal` is the only modal invoked via `uiIntegration.js`'s separate overlay manager, bypassing `BaseModal`. It also uses class `gtm-prompt-modal` (from Task 1's gap list).

- [ ] **Step 1: Confirm GTMPromptModal already extends BaseModal.jsx**

```bash
cd /Users/shasheemoore/Downloads/remix-new-editor/.kilo/worktrees/incandescent-cheese
head -5 src/components/modals/GTMPromptModal.jsx
grep -n "extends" src/components/modals/GTMPromptModal.jsx
```
Expected: `import { BaseModal } from './BaseModal.jsx';` and `class GTMPromptModal extends BaseModal`.

- [ ] **Step 2: Decide unification approach**
  - Preferred: keep `uiIntegration.js` as the trigger site but call `new GTMPromptModal({ onConfirm }).open()` instead of the bespoke overlay, so it uses the same lifecycle/`destroy()` as every other modal.
  - If the manager does something the modal lacks (e.g. route-scoped teardown), add that capability to `BaseModal` rather than forking.

- [ ] **Step 3: Implement the chosen unification in `uiIntegration.js`** (exact edit depends on Step 2; replace the bespoke open call with the `BaseModal` contract).

- [ ] **Step 4: Verify**

```bash
npx vitest run src/components/modals/modal-integration-test.test.js 2>&1 | tail -3
npx vite build 2>&1 | tail -1
```
Expected: no regression; `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/uiIntegration.js src/components/modals/GTMPromptModal.jsx
git commit -m "refactor(modal): route GTM prompt through BaseModal contract"
```

---

### Task 4: Restore dropped features in the `.js` modal rewrites

**Files:**
- Modify: `src/components/SettingsModal.js` (restore Video + Keyboard tabs and structured `onConfirm({general,audio,video,export})`)
- Modify: `src/components/ContactImporterModal.js` (restore Google/Outlook sources, 4-step wizard, field-mapping UI, `onConfirm({action:'importComplete',contacts,tags,source})`)
- Read-only baselines: `git show 5c899efe:src/components/modals/SettingsModal.jsx`, `git show 5c899efe:src/components/modals/ContactImporterModal.jsx`

**Interfaces:**
- Consumes: baselines from `5c899efe`
- Produces: `.js` modals whose feature set matches the baselines; callers (`state.settings = ...`, personalization flow) receive the structured payloads.

**Finding (feature-parity audit):** `SettingsModal.js` dropped the Video tab (GPU acceleration, hardware decoding, quality/resolution) and Keyboard tab, and replaced the structured `onConfirm` payload with a bare `localStorage.setItem`. `ContactImporterModal.js` dropped Google/Outlook sources, the 4-step wizard, field-mapping UI, progress animation, and the `onConfirm({action:'importComplete',...})` payload (now a flat `onContactsImported(contacts)`).

- [ ] **Step 1: Capture both baselines**

```bash
cd /Users/shasheemoore/Downloads/remix-new-editor/.kilo/worktrees/incandescent-cheese
git show 5c899efe:src/components/modals/SettingsModal.jsx > /tmp/SettingsModal.baseline.jsx
git show 5c899efe:src/components/modals/ContactImporterModal.jsx > /tmp/ContactImporterModal.baseline.jsx
```

- [ ] **Step 2: Restore `SettingsModal.js`**
  - Re-add Video + Keyboard tab markup and their state wiring.
  - Replace the bare `localStorage.setItem('video-editor-settings', …)` with the structured `onConfirm({ general, audio, video, export })` the editor expects (grep callers for what shape they read).

- [ ] **Step 3: Restore `ContactImporterModal.js`**
  - Re-add Google/Outlook source buttons, the 4-step wizard shell, field-mapping UI with required-badges + tag chips, and progress animation.
  - Emit `onConfirm({ action:'importComplete', contacts, tags, source })` instead of the flat callback.

- [ ] **Step 4: Verify callers still compile**

```bash
grep -rn "new SettingsModal\|new ContactImporterModal\|onContactsImported\|onConfirm" src/components/TimelineEditorPage.jsx src/lib | head
npx vite build 2>&1 | tail -1
```
Expected: callers reference the restored shapes; `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsModal.js src/components/ContactImporterModal.js
git commit -m "fix(modal): restore Video/Keyboard tabs + structured payload in SettingsModal; restore wizard in ContactImporterModal"
```

---

### Task 5: Decide scope of the 3-line stub modals

**Files:**
- Read-only: `src/components/modals/OpenAIImageEditorModal.jsx`, `src/components/modals/SubtitleEditorModal.jsx` (both ~3-line shells returning `null`)

**Interfaces:**
- Consumes: nothing
- Produces: either a real implementation or an explicit "intentionally minimal" decision recorded in `plans/modal-feature-parity-audit.md`.

**Finding:** these are real NEW modals (no `5c899efe` baseline) but currently return `null` — they open and immediately close with nothing rendered. They are referenced by openers in `TimelineEditorPage.jsx`.

- [ ] **Step 1: Confirm they are shells**

```bash
cd /Users/shasheemoore/Downloads/remix-new-editor/.kilo/worktrees/incandescent-cheese
wc -l src/components/modals/OpenAIImageEditorModal.jsx src/components/modals/SubtitleEditorModal.jsx
```

- [ ] **Step 2: Decide per modal**
  - If the feature is in-scope, implement `renderBody()` against the same `BaseModal` contract (mirror a sibling like `ImageCropperModal.js` for structure).
  - If out-of-scope, keep the shell but update the opener to show a "coming soon" toast instead of `new X().open()`, so users aren't shown an empty modal.

- [ ] **Step 3: Implement or guard, then verify**

```bash
npx vite build 2>&1 | tail -1
```
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add src/components/modals/OpenAIImageEditorModal.jsx src/components/modals/SubtitleEditorModal.jsx
git commit -m "fix(modal): implement or guard OpenAIImageEditor / SubtitleEditor stubs"
```

---

## Self-Review Notes
- Task 0 is provably no-op (verified handlers survive) — safe cleanup.
- Tasks 1, 2, 3, 4 each touch different files (`modal-styles.css`, `BaseModal*`, `uiIntegration.js`, `.js` modals) → independent, safe to parallelize per the dispatching-parallel-agents split, EXCEPT Task 2's rename must land before Task 3/4 reference `BaseModal` (they already use `.jsx`, so no hard dependency; order is for clarity).
- The integration test (21 pass / 10 skip) is the shared gate run after every task.
- 10 skipped modals = 6 `.js` modals on the React base (post-Task-2 renamed) + 4 function-component modals (`AuthModal`, `ImportTimelineModal`, `OpenAIImageEditorModal`, `SubtitleEditorModal`). The 4 function components are expected skips, not failures.
