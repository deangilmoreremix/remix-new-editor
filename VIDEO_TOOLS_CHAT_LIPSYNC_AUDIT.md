# VIDEO_TOOLS_CHAT_LIPSYNC_AUDIT.md
**Sub-Agent 3: Video Tools / Chat Studio / Lip Sync Auditor**
**Baseline Commit:** afad812a22d9f6f470222a99136b7cd651f61a89
**Current HEAD:** 72cdafae
**Date:** 2026-08-11

---

## VIDEO TOOLS

### File: `src/components/VideoToolsStudio.js`
**Historical Lines:** ~230 (baseline)
**Current Lines:** ~230 (HEAD)

### What's Missing from Current vs Historical

| Feature | Historical (baseline) | Current (HEAD) | Status |
|---|---|---|---|
| **Rich Model Selector Dropdown** | Full dropdown with provider sidebar, search bar, model list, provider filtering | Simple button grid (`modelBtns`) | **REMOVED** |
| **Provider Logo Display** | Model button showed provider logo or provider initial badge | Button shows only model name text | **REMOVED** |
| **Model Search** | Search bar in model dropdown to filter models | No search capability | **REMOVED** |
| **Provider Filtering** | Sidebar to filter models by provider (OpenAI, MuAPI, etc.) | No provider filtering | **REMOVED** |
| **Form Visibility per Model** | `updateFormVisibility()` showed/hide prompt based on `hasPrompt` flag | Still present but tied to simpler selector | **DEGRADED** |
| **ProcessFileUpload Pipeline** | `processFileUpload` from `editor/uploadPipeline.js` | Direct `muapi.uploadFile()` call | **CHANGED** |
| **ModelSelectorUI Integration** | Imported `getModelLogoHtml`, `PROVIDER_LOGOS`, `renderProviderSidebar`, `renderSearchBar`, `renderModelList` | All imports removed | **REMOVED** |

### Git Diff Summary
```
-import { getModelLogoHtml, PROVIDER_LOGOS, invertLogos, getProviderStyle, 
-         getAvailableProviders, filterModels, renderProviderSidebar, 
-         renderSearchBar, renderModelList } from '../lib/modelSelectorUI.js';
```
Replaced 100+ lines of rich dropdown with 20-line button grid.

### Current Capabilities
- Model selector: button grid (all models visible)
- Source video upload
- Conditional prompt textarea
- GTM Boost integration
- Thumbnail studio
- Generate → result video with download

### Missing Capabilities
1. **Provider-aware model selection** — cannot filter by provider
2. **Model search** — must scan all model buttons
3. **Provider logo/branding** — no visual provider identification
4. **Advanced model dropdown UX** — no scrollable list with descriptions

---

## CHAT STUDIO

### File: `src/components/ChatStudio.js`
**Historical Lines:** ~330 (baseline)
**Current Lines:** ~304 (HEAD)

### What's Missing from Current vs Historical

| Feature | Historical (baseline) | Current (HEAD) | Status |
|---|---|---|---|
| **Rich Model Selector Dropdown** | Full dropdown with provider sidebar, search bar, model list, provider filtering | Simple button grid (`modelBtns`) | **REMOVED** |
| **Provider Logo Display** | Model trigger showed provider logo or provider initial badge | Button shows only model name text | **REMOVED** |
| **Model Search** | Search bar in model dropdown to filter text models | No search capability | **REMOVED** |
| **Provider Filtering** | Sidebar to filter models by provider | No provider filtering | **REMOVED** |
| **ModelSelectorUI Integration** | Imported `getModelLogoHtml`, `PROVIDER_LOGOS`, `invertLogos`, `getProviderStyle`, `getAvailableProviders`, `filterModels`, `renderProviderSidebar`, `renderSearchBar`, `renderModelList` | All imports removed | **REMOVED** |
| **Dropdown Click-Outside Handling** | `document.addEventListener('click', ...)` for closing dropdown | Not applicable (no dropdown) | **REMOVED** |

### Git Diff Summary
```diff
-import { getModelLogoHtml, PROVIDER_LOGOS, invertLogos, getProviderStyle, 
-         getAvailableProviders, filterModels, renderProviderSidebar, 
-         renderSearchBar, renderModelList } from '../lib/modelSelectorUI.js';
```
Replaced 100+ lines of rich dropdown with 20-line button grid.

### Current Capabilities
- Model selector: button grid (all text models visible)
- Chat message list with empty state
- System prompt input
- User/AI message bubbles
- Advanced options: Temperature, Max Tokens
- Loading indicator (bouncing dots)
- Send on Enter
- Thumbnail studio
- GTM Boost (not currently wired but modal exists)

### Missing Capabilities
1. **Provider-aware model selection** — cannot filter by provider
2. **Model search** — must scan all model buttons
3. **Provider logo/branding** — no visual provider identification
4. **Conversation persistence** — messages lost on refresh
5. **Conversation management** — no rename/delete/export
6. **Stop generation** — no cancel button during generation
7. **Markdown/code rendering** — plain text only
8. **Copy message** — no per-message copy button

---

## LIP SYNC

### File: `src/components/LipSyncStudio.js`
**Historical Lines:** ~848 (baseline)
**Current Lines:** ~848 (HEAD)

### What's Missing from Current vs Historical

| Feature | Historical (baseline) | Current (HEAD) | Status |
|---|---|---|---|
| **Provider Logo in Model Button** | Model button showed provider logo icon via `updateModelBtnIcon()` | Model button shows only text label, no logo | **REMOVED** |
| **Provider Sidebar in Dropdown** | Dropdown had provider sidebar for filtering | Dropdown has flat list, no provider sidebar | **REMOVED** |
| **ModelSearch/Filter** | Search bar and provider filter in dropdown | No search, no provider filter | **REMOVED** |
| **selectedProvider State** | `selectedProvider = 'all'` state variable | Removed | **REMOVED** |
| **updateModelBtnIcon()** | Function to update provider logo in model button | Function removed, logo element removed from HTML | **REMOVED** |
| **ModelSelectorUI Integration** | Imported `PROVIDER_LOGOS`, `invertLogos`, `getProviderStyle`, `getAvailableProviders`, `filterModels`, `renderProviderSidebar`, `renderSearchBar`, `renderModelList` | All imports removed | **REMOVED** |
| **processFileUpload Pipeline** | `processFileUpload` from `editor/uploadPipeline.js` | Direct `muapi.uploadFile()` call | **CHANGED** |

### Git Diff Summary
```diff
-import { processFileUpload } from '../lib/editor/uploadPipeline.js';
-import { PROVIDER_LOGOS, invertLogos, getProviderStyle, getAvailableProviders, 
-         filterModels, renderProviderSidebar, renderSearchBar, renderModelList } 
-    from '../lib/modelSelectorUI.js';
-    let selectedProvider = 'all';
```
Removed provider-aware model selection infrastructure.

### Current Capabilities
- Mode toggle: Portrait Image / Video
- Image upload (image mode) with icon/spinner/ready states
- Video upload (video mode) with icon/spinner/ready states
- Audio upload with icon/spinner/ready states
- Optional prompt textarea
- GTM Boost integration
- Model selector dropdown (flat list, no provider sidebar)
- Resolution selector dropdown
- Generate button with loading state
- Canvas area with result video
- History sidebar (localStorage, 30 entries)
- Download, Regenerate, New controls
- Pending job resumption
- Personalize trigger

### Missing Capabilities
1. **Provider logo in model selector** — no visual provider identification
2. **Provider sidebar/filtering** — cannot filter lip sync models by provider
3. **Model search** — must scan all models in dropdown
4. **Audio waveform preview** — no waveform visualization
5. **Lip sync timing adjustment** — no phoneme-level editing
6. **Multiple voice selection** — only audio upload, no voice library
7. **Background replacement** — no portrait background controls
8. **Expression controls** — limited to text prompt only

---

## CROSS-CUTTING FINDINGS

### Common Regression Across All 3 Studios
All three studios had their **rich ModelSelectorDropdown** (with provider sidebar, search, and provider logos) replaced with a **simple button grid** between baseline and HEAD. This represents a significant UX degradation:

- **Before (baseline):** Professional dropdown with provider branding, search, and filtering
- **After (HEAD):** Flat button grid showing all model names without provider context

### Files Modified
1. `src/components/VideoToolsStudio.js` — model selector simplified
2. `src/components/ChatStudio.js` — model selector simplified
3. `src/components/LipSyncStudio.js` — model selector simplified, provider imports removed

### Impact
- **Discoverability:** Users can no longer filter/search models by provider
- **Brand Trust:** Provider logos (OpenAI, MuAPI, etc.) no longer visible
- **Scalability:** As model count grows, button grid becomes unwieldy
- **Consistency:** Other studios (Image, Video, Cinema) still use rich dropdown; these three are now inconsistent

### Recommendations
1. Restore `ModelSelectorDropdown` component for all three studios
2. Re-introduce provider sidebar with logos
3. Add search/filter capability
4. Maintain button grid as fallback for small model counts
5. Ensure `updateModelBtnIcon()` is restored for LipSyncStudio

---

*End of Audit Report*
