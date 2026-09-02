# Reference Model Selector Analysis — Open Generative AI

## Source
- **Repo**: https://github.com/Anil-matcha/Open-Generative-AI
- **Files analyzed**:
  - `packages/studio/src/components/ImageStudio.jsx` (contains `ModelDropdown`)
  - `packages/studio/src/components/VideoStudio.jsx` (contains `ModelDropdown`)
  - `packages/studio/src/components/prompt/PromptComposer.jsx` (popover/trigger styling)
- **Note**: There is **no standalone `ModelSelector.jsx`** file. The model selector is implemented as an inline `ModelDropdown` function component inside each studio component.

---

## 1. Overall UI Pattern & Layout

The model selector is a **split-pane dropdown / popover** anchored to a button in the bottom prompt bar. It is not a sidebar or a full-page component — it is a floating panel that overlays the main gallery.

### Anchor / Trigger
- Located in the bottom `PromptComposer` bar, as the **leftmost control button**.
- Shows a **tiny 16×16 provider logo** (or fallback letter) + the **current model name** + a chevron.
- Active state uses cyan (`#22d3ee`) border and tinted background.
- Clicking toggles the dropdown open/closed.

### Dropdown Panel (Popover)
- Positioned **above** the trigger (`absolute bottom-[calc(100%+12px)]`).
- Uses a dark glassmorphism background: `bg-[#0c0c0f]/95` with `backdrop-blur-2xl` and subtle border.
- **Width**: `w-[calc(100vw-2rem)] md:w-[480px]` (responsive; capped at ~480px on medium+ screens).
- **Height**: `max-h-[60vh]` in ImageStudio, `max-h-[70vh]` in VideoStudio; `min-h-[350px]`.
- Internal layout: **flex row** — fixed-width left sidebar + flexible right pane.

---

## 2. Split-Pane Anatomy

```
┌──────────────────────────────────────────────────────┐
│  [Trigger in prompt bar: logo | Model Name | v]      │
├──────────┬───────────────────────────────────────────┤
│ "All" ★  │  🔍 Search models...                      │
│ [OpenAI] │  Available models                         │
│ [Google] │  ┌─────────────────────────────────────┐  │
│ [Kling]  │  │ 🟢 Flux Dev                         │  │
│ [Byted.] │  │ 🟢 Nano Banana 2                    │  │
│ [BFL]    │  │ 🔵 Midjourney v7                    │  │
│ [Mini.]  │  │ ...                                 │  │
│ [...]    │  └─────────────────────────────────────┘  │
└──────────┴───────────────────────────────────────────┘
```

### Left Sidebar (Provider Tabs)
- **Width**: `w-14` (56px), vertically scrollable if there are many providers.
- **Top entry**: "All Providers" — a star icon inside a `w-8 h-8 rounded-full` button. Selected state uses yellow-400 fill.
- **Provider buttons**: each is a `w-8 h-8 rounded-full` circular button.
  - Displays either:
    1. A **provider logo image** (from `https://cdn.muapi.ai/models/{provider}.png`) rendered as `object-contain` inside the circle, or
    2. A **2-letter text badge** (e.g. `O`, `G`, `BF`, `MJ`, `KL`, `VD`, `MX`, `ID`, `LM`, `AL`, `LE`, `SD`) with a provider-specific color scheme.
  - **Selected state**: tinted background (`bg-{color}-500/10`), colored text, `border-white/25`, `scale-105`, `shadow-md`.
  - **Unselected state**: near-transparent background, low opacity text, subtle border.
- **Logo inversion**: Certain providers have their logos CSS-inverted for visibility on dark backgrounds:
  - `openai`, `blackforest`, `runway`, `ideogram`, `lightricks`, `grok`.

### Right Pane (Search + Model List)
- **Search bar** (top):
  - Full-width, inside a `bg-white/5 rounded-xl` container with a search icon.
  - Placeholder: `"Search models..."`.
  - Filters models in real-time by matching against `m.name` or `m.id` (case-insensitive).
- **Header row**:
  - Left: `"Available models"` label.
  - Right (when a provider is selected): a small badge showing the provider name (e.g. `OpenAI`).
- **Model list** (scrollable, `flex-1`):
  - Each item is a `p-3 hover:bg-white/5 rounded-lg` row.
  - **Left**: provider avatar (32px circle with logo or colored initial).
  - **Center**: model name (bold, white, truncate) + provider name below in tiny text (`text-[9px] text-white/40`), shown only when "All Providers" is active.
  - **Right**: cyan checkmark (`#22d3ee`, strokeWidth=4) for the currently selected model.
  - Active item is automatically scrolled into view on open via `scrollIntoView`.

---

## 3. How Providers Are Displayed

### Provider Logo Map
Logos are served from a CDN and keyed by provider ID:

```js
const PROVIDER_LOGOS = {
  openai: "https://cdn.muapi.ai/models/openai.png",
  google: "https://cdn.muapi.ai/models/gemini.png",
  kling: "https://cdn.muapi.ai/models/kling.png",
  alibaba: "https://cdn.muapi.ai/models/alibaba.png",
  bytedance: "https://cdn.muapi.ai/models/bytedance.png",
  blackforest: "https://cdn.muapi.ai/models/bfl.png",
  minimax: "https://cdn.muapi.ai/models/minimax.png",
  suno: "https://cdn.muapi.ai/models/suno.png",
  anthropic: "https://cdn.muapi.ai/models/claude.png",
  meshy: "https://cdn.muapi.ai/models/meshy-3.png",
  tripo3d: "https://cdn.muapi.ai/models/tripo3d.png",
  grok: "https://cdn.muapi.ai/models/xai.png",
  muapi: "https://cdn.muapi.ai/models/muapi.png",
  midjourney: "https://cdn.muapi.ai/models/midjourney.png",
  vidu: "https://cdn.muapi.ai/models/vidu.png",
  runway: "https://cdn.muapi.ai/models/runway.png",
  luma: "https://cdn.muapi.ai/models/luma.png",
  ideogram: "https://cdn.muapi.ai/models/ideogram.png",
  leonardoai: "https://cdn.muapi.ai/models/leonardoai.png",
  hunyuan: "https://cdn.muapi.ai/models/hunyuan.png",
  hidream: "https://cdn.muapi.ai/models/hidream.png",
  lightricks: "https://cdn.muapi.ai/models/lightricks.png",
  pixverse: "https://cdn.muapi.ai/models/pixverse.png",
  reve: "https://cdn.muapi.ai/models/reve.png",
  stability: "https://cdn.muapi.ai/models/stability.png"
};
```

### Text Badge Color Scheme (fallback when no logo is registered)
Each provider has a unique color pair used for the 2-letter badge:

| Provider | Badge Text | Background | Text Color | Border Color |
|---|---|---|---|---|
| grok | xI | orange-500/10 | orange-400 | orange-500/25 |
| openai | O | emerald-500/10 | emerald-400 | emerald-500/25 |
| google | G | blue-500/10 | blue-400 | blue-500/25 |
| blackforest | BF | amber-500/10 | amber-400 | amber-500/25 |
| bytedance | BD | purple-500/10 | purple-400 | purple-500/25 |
| midjourney | MJ | indigo-500/10 | indigo-400 | indigo-500/25 |
| kling | KL | rose-500/10 | rose-400 | rose-500/25 |
| vidu | VD | cyan-500/10 | cyan-400 | cyan-500/25 |
| minimax | MX | pink-500/10 | pink-400 | pink-500/25 |
| ideogram | ID | yellow-500/10 | yellow-400 | yellow-500/25 |
| luma | LM | teal-500/10 | teal-400 | teal-500/25 |
| alibaba | AL | sky-500/10 | sky-400 | sky-500/25 |
| leonardoai | LE | violet-500/10 | violet-400 | violet-500/25 |
| stability | SD | fuchsia-500/10 | fuchsia-400 | fuchsia-500/25 |
| default | first 2 chars upper | primary/10 | primary | primary/25 |

---

## 4. How Model Selection Works

1. **Trigger click** → `dropdownOpen` toggles to `"model"`.
2. `PromptPopover` renders above the prompt bar with a `"Model"` header.
3. `ModelDropdown` receives:
   - `models`: the active model list (`t2iModels` or `i2iModels` for ImageStudio; `t2vModels` / `i2vModels` for VideoStudio).
   - `selectedModel`: currently selected model ID.
   - `onSelect`: callback that updates studio state (aspect ratio, quality, effects, max images, etc.).
   - `onClose`: callback to close the popover.
4. **Provider pre-selection**: On open, the sidebar auto-selects the provider of the currently active model.
5. **Auto-scroll**: The selected model item is scrolled into view via `scrollIntoView({ block: "nearest" })`.
6. **User actions**:
   - Click a **provider tab** → filters the model list to that provider.
   - Type in **search** → further filters by name or ID.
   - Click a **model row** → calls `onSelect(m)` and `onClose()`, which updates the studio state and closes the popover.
7. **State persistence**: Selection, prompt, aspect ratio, quality, etc. are persisted to `localStorage` with a 500ms debounce.

### Dual-Mode Switching (Image / Video Studio)
- The studio tracks an `imageMode` (i2i / i2v) boolean.
- Uploading a reference image automatically switches from t2i → i2i (or t2v → i2v) by finding a sibling model via naming conventions and a hardcoded exceptions map.
- Clearing the reference image switches back to the parent t2i / t2v model.
- The `ModelDropdown` always reflects the *current* model list for the active mode.

---

## 5. Unique Features

### Search + Provider Tab Filtering
- **Dual filter**: Provider tab narrows the list; search further filters within that provider. Selecting "All Providers" shows everything, and search applies across all.
- **Empty state**: `"No models found"` when filters return zero results.

### Dynamic Provider Discovery
- Providers are **not hardcoded** in the dropdown; they are derived dynamically from the `models` array passed in:
  ```js
  const availableProviders = [];
  const seenProviders = new Set();
  models.forEach(m => {
    const pId = m.provider || 'muapi';
    const pName = m.provider_name || 'Muapi';
    if (!seenProviders.has(pId)) {
      seenProviders.add(pId);
      availableProviders.push({ id: pId, name: pName });
    }
  });
  ```
- This means adding a new provider to `models.js` automatically surfaces it in the selector without touching the UI component.

### Provider-Specific Initials / Colors
- Even providers without registered logos get a deterministic 2-letter badge with a matching color scheme (defined in `getProviderStyle`).
- This ensures visual consistency even for unknown/fallback providers.

### Logo Inversion
- Logos for dark-background-friendly providers are CSS-inverted (`filter: invert(1)`) so white-on-transparent logos remain visible.

### VideoStudio Extras
- VideoStudio’s `ModelDropdown` splits the list into two sections:
  - **Video models** (main list)
  - **Video Tools** (v2v models, shown with an orange header separator)
- v2v items have a slightly different row style (`rounded-2xl` vs `rounded-lg`) and an orange helper text hint.

### Smart Control Adaptation
- When a model is selected, the studio adapts its visible controls (aspect ratio, duration, resolution, quality, mode, effect) based on the model’s declared `inputs` schema.
- The model selector is just one part of a broader "smart controls" system.

---

## 6. Screenshots / UI Descriptions in README

- The README contains **no embedded app screenshots** of the model selector or studio UI.
- It includes:
  - A YouTube video thumbnail (`maxresdefault.jpg`) linking to a demo video.
  - Repo badges (MuAPI powered, Awesome Generative AI Apps).
- The README describes the UI in prose: *"sleek, modern interface"*, *"dark glassmorphism UI"*, *"Responsive Design — Works seamlessly on desktop and mobile with dark glassmorphism UI"*.
- The only visual assets in the repo are marketing thumbnails (`thumbnail.png`, `thumbnail-ai-v2-1920x1080.png`, `video-27-minimax-hailuo-h3-guide-v3.png`), none of which show the model selector.

---

## 7. Technical Implementation Notes

| Aspect | Detail |
|---|---|
| **Component type** | `function ModelDropdown(...)` — not a separate file, inlined in each studio |
| **State** | `search`, `selectedProvider` (derived from current model on mount) |
| **Trigger** | Button inside `PromptControls` (bottom bar) |
| **Popover** | `PromptPopover` with `absolute bottom-[calc(100%+12px)]` positioning |
| **Scrolling** | Custom scrollbar class `custom-scrollbar` on sidebar and model list |
| **Accessibility** | Uses `title` attributes on buttons; no ARIA roles in dropdown itself |
| **Persistence** | Studio state (including selected model) saved to `localStorage` with 500ms debounce |
| **Styling** | Tailwind CSS v3 utility classes, dark theme (`#0c0c0f`, `#18181c`, `#0f0f12`) |
| **Accent color** | Cyan `#22d3ee` used for active states, checkmarks, borders, generate button |
| **Font sizing** | Extremely small: `text-[9px]`, `text-[10px]`, `text-xs` for dense information |

---

## 8. Summary of Key Design Decisions

1. **Split-pane provider + list** — Provider tabs on the far left let users narrow by brand without typing, which is critical when there are 400+ models.
2. **Circular logo chips** — A consistent 32px / 56px sidebar vocabulary makes provider recognition fast.
3. **Search-first** — Search is the primary discovery mechanism; provider tabs are a secondary filter.
4. **Popover, not modal** — The selector floats above the prompt bar and does not block the gallery; this keeps the generation history visible.
5. **Inline in studio** — No shared `ModelSelector` component; each studio owns its dropdown, allowing per-studio variations (e.g. VideoStudio’s "Video Tools" section).
6. **CDN-hosted logos** — Provider logos are external assets, not bundled, keeping the repo lightweight.
7. **Dark glassmorphism** — Matches the overall studio aesthetic: translucent panels, subtle white borders, heavy backdrop blur.

---

## 9. Relevant File Paths in Repo

- `packages/studio/src/components/ImageStudio.jsx` — `ModelDropdown` (lines ~553–822), trigger wiring (lines ~1506–1551)
- `packages/studio/src/components/VideoStudio.jsx` — `ModelDropdown` (lines ~60–220+ in raw file)
- `packages/studio/src/components/prompt/PromptComposer.jsx` — `PromptPopover`, `promptControlClassName`, trigger styling
- `packages/studio/src/models.js` — model definitions (`t2iModels`, `i2iModels`, `t2vModels`, `i2vModels`, `v2vModels`)

---

*Analysis generated: 2026-08-05*
