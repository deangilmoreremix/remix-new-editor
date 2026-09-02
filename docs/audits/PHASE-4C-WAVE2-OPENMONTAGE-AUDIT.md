# Phase 4C — Wave 2: OpenMontage/Backlot Capability Audit

**Date:** 2026-08-30  
**Branch:** `recovery-forward/openmontage-backlot`  
**Protected Baseline SHA:** `db36da6e2`  
**Historical Source:** `recovery/dropped-openmontage-96c9b419` (`96c9b419ca8b98091e4fa28d4e9f3127cabc8495`)

---

## 1. Executive Summary

OpenMontage/Backlot exists as an **orphaned, unconnected page component** in the current codebase. The file `src/components/OpenMontagePage.js` is not wired into the router, navigation, or any application entry point. Despite this, the file itself has evolved significantly and the current version is the most developed implementation.

**Key Findings:**
- Current OpenMontagePage.js is **1,360 lines** (most developed)
- Historical recovery version is **1,155 lines** (older design)
- Original snapshot was **459 lines**
- Current version is the **last-known-good** state
- Historical version represents an **older stage pipeline design** that was intentionally superseded
- **One confirmed bug**: `renderComposeContent` is referenced but missing from current file
- **No missing capabilities** from historical that should be forward-ported
- **Backend API architecture** is intact (proxied to external OpenMontage FastAPI service)

---

## 2. OpenMontage Commit History

| Commit | Date | Lines | Change Description |
|--------|------|-------|-------------------|
| `bfc8006c3` | 2026-08-23 | 459 | Original snapshot: basic OpenMontage page with stages: brief, research, script, scene_plan, gate, narration, music, compose, render |
| `ff7825399` | 2026-08-26 | 772 | SmartVideo rebranding: major UI expansion, added stage content renderers, library sidebar, scene board, renders card, chat, decision log |
| `1aefcfa13` | 2026-08-24 | 622 | Simplified UI: removed model selectors (video/image), removed apiKeyManager integration, cleaned up stage forms |
| `96c9b419c` | 2026-08-28 | 1,155 | Recovery branch: WIP before main merge. Enhanced stage tracker, storyboard filmstrip, player card, activity log, replay timeline, accessibility improvements |
| `218b9db97` | 2026-08-28 | — | e2e tests for attachment toolbar (not OpenMontage-specific) |
| `98ede443a` | 2026-08-29 | — | AI-VFX fix (not OpenMontage-specific) |
| `95022df5b` | 2026-08-29 | 1,360 | Major redesign: new stage pipeline (research, proposal, script, scene_plan, storyboard, assets, edit, compose, publish), enhanced stage tracker with status text, rich demo state, scene drag-to-reorder, replay controls, keyboard accessibility |
| `db36da6e2` | 2026-08-30 | 1,360 | Wave 1 security fix (no OpenMontage changes) |

**Last-Known-Good OpenMontage SHA:** `db36da6e2` (current develop HEAD)

---

## 3. Current Capability Inventory

### 3.1 Infrastructure
- ✅ Backend proxy via `/openmontage` → external FastAPI service
- ✅ Express router integration (`backend/server.js`)
- ✅ API helper with error handling
- ✅ Production state polling (2s interval)
- ✅ Chat messaging with auto-poll
- ✅ File attachment support
- ✅ Scene drag-to-reorder
- ✅ Keyboard navigation support
- ✅ Accessibility: aria-labels, focus rings, role attributes

### 3.2 Stage Pipeline (Current)
| # | Stage ID | Renderer | Status |
|---|----------|----------|--------|
| 0 | research | `renderResearchContent` | ✅ Present |
| 1 | proposal | `renderProposalContent` | ✅ Present (simple placeholder) |
| 2 | script | `renderScriptContent` | ✅ Present |
| 3 | scene_plan | `renderScenePlanContent` | ✅ Present |
| 4 | storyboard | `renderStoryboardContent` | ✅ Present |
| 5 | assets | `renderAssetsContent` | ✅ Present (simple placeholder) |
| 6 | edit | `renderEditContent` | ✅ Present (simple placeholder) |
| 7 | compose | `renderComposeContent` | ❌ **MISSING - BUG** |
| 8 | publish | `renderPublishContent` | ✅ Present (simple placeholder) |

### 3.3 Helper Functions
- ✅ `escapeHtml` - XSS prevention
- ✅ `getStatusStyle` - Status badge styling
- ✅ `getStageStatusText` - Dynamic stage status labels
- ✅ `formatCredits` - Credit formatting

### 3.4 UI Components
- ✅ Backlot-style header with project title, pipeline label, style label, generation spend
- ✅ Enhanced stage tracker with numbered circles, completion checkmarks, status text
- ✅ Creative gate banner (approval prompt)
- ✅ Replay timeline scrubber with play/pause, click-to-seek, keyboard controls
- ✅ Library sidebar with project cards
- ✅ Storyboard filmstrip with scene cards
- ✅ Player/render card with playback controls
- ✅ Decision log panel
- ✅ Activity log panel
- ✅ Production chat panel
- ✅ Scene drag-to-reorder
- ✅ File attachment button

### 3.5 State Management
- ✅ Rich initial demo state (5 scenes, chat messages, decision log, activity log, script)
- ✅ Production submission with validation
- ✅ Approval/revise workflow
- ✅ Polling with stop on completion/failure/cancellation
- ✅ UI refresh on state changes

---

## 4. Historical Recovery Capability Inventory

### 4.1 Stage Pipeline (Historical)
| # | Stage ID | Renderer | Notes |
|---|----------|----------|-------|
| 0 | brief | `renderBriefContent` | Detailed form with prompt, audience, duration, pipeline, profile, assets, key messages |
| 1 | research | `renderResearchContent` | Similar to current |
| 2 | script | `renderScriptContent` | Similar to current but with B-roll and VO line counts |
| 3 | scene_plan | `renderScenePlanContent` | Similar to current |
| 4 | gate | `renderGateContent` | Approval gate with credit breakdown, approve/revise buttons |
| 5 | narration | `renderNarrationContent` | Voice selection, waveform visualization, line-by-line notes |
| 6 | music | `renderMusicContent` | Music selection with beat markers, BPM, energy |
| 7 | compose | `renderComposeContent` | Brand check validation |
| 8 | render | `renderRenderContent` | Render formats list, provenance report |

### 4.2 Helper Functions
- ✅ `escapeHtml` - Same as current
- ✅ `getStatusStyle` - Same as current
- ✅ `formatCredits` - Same as current
- ❌ `getStageStatusText` - **MISSING from historical**

### 4.3 UI Components
- ✅ Hero section with branding
- ✅ Simpler stage tracker (button-based, not numbered circles)
- ✅ Library sidebar with assets
- ✅ Scene board with `renderSceneCards`
- ✅ Renders list with `renderRenders`
- ✅ Provenance report section
- ✅ Production chat panel
- ✅ Decision log panel
- ❌ No replay timeline
- ❌ No storyboard filmstrip
- ❌ No player card
- ❌ No activity log
- ❌ No scene drag-to-reorder (basic drag support exists but simpler)

### 4.4 State Management
- ✅ Empty initial state (not pre-populated)
- ✅ Production submission with model selectors (removed in current)
- ✅ API key collection from apiKeyManager (removed in current)
- ✅ Approval/revise workflow
- ✅ Chat polling with `chatPollTimer` (removed in current)

---

## 5. Three-Way Capability Matrix

| Capability | Current Develop | Last Known Good | Historical Recovery | Final Decision |
|------------|-----------------|-----------------|---------------------|----------------|
| **Stage Pipeline** | research→proposal→script→scene_plan→storyboard→assets→edit→compose→publish | Same as current | brief→research→script→scene_plan→gate→narration→music→compose→render | **CURRENT_AND_COMPLETE** - Different but intentional redesign |
| **Stage: research** | ✅ Detailed | ✅ | ✅ Similar | **CURRENT_AND_COMPLETE** |
| **Stage: proposal** | ✅ Placeholder | ✅ | ❌ Not in historical | **CURRENT_AND_COMPLETE** |
| **Stage: script** | ✅ Detailed | ✅ | ✅ Similar | **CURRENT_AND_COMPLETE** |
| **Stage: scene_plan** | ✅ Detailed | ✅ | ✅ Similar | **CURRENT_AND_COMPLETE** |
| **Stage: storyboard** | ✅ Filmstrip | ✅ | ❌ Not in historical | **CURRENT_AND_COMPLETE** |
| **Stage: assets** | ✅ Placeholder | ✅ | ❌ Not in historical | **CURRENT_AND_COMPLETE** |
| **Stage: edit** | ✅ Placeholder | ✅ | ❌ Not in historical | **CURRENT_AND_COMPLETE** |
| **Stage: compose** | ❌ **MISSING** | ✅ (had function) | ✅ Present | **COMMITTED_PREVIOUSLY_BUT_LOST** - Must restore |
| **Stage: publish** | ✅ Placeholder | ✅ | ❌ Not in historical | **CURRENT_AND_COMPLETE** |
| **Stage: brief** | ❌ Not in current | ❌ Not in current | ✅ Present | **OBSOLETE** - Replaced by proposal |
| **Stage: gate** | ❌ Not in current | ❌ Not in current | ✅ Present | **OBSOLETE** - Replaced by storyboard/assets |
| **Stage: narration** | ❌ Not in current | ❌ Not in current | ✅ Present | **OBSOLETE** - Replaced by edit |
| **Stage: music** | ❌ Not in current | ❌ Not in current | ✅ Present | **OBSOLETE** - Replaced by publish |
| **Stage: render** | ❌ Not in current | ❌ Not in current | ✅ Present | **OBSOLETE** - Replaced by publish |
| **escapeHtml** | ✅ Present | ✅ | ✅ Same | **CURRENT_AND_COMPLETE** |
| **getStatusStyle** | ✅ Present | ✅ | ✅ Same | **CURRENT_AND_COMPLETE** |
| **getStageStatusText** | ✅ Present | ✅ | ❌ Missing | **CURRENT_AND_COMPLETE** |
| **formatCredits** | ✅ Present | ✅ | ✅ Same | **CURRENT_AND_COMPLETE** |
| **Stage tracker** | ✅ Enhanced (numbered circles, status text) | ✅ | ✅ Button-based | **CURRENT_IMPLEMENTATION_IS_BETTER** |
| **Storyboard rendering** | ✅ Filmstrip | ✅ | ✅ Scene cards | **CURRENT_IMPLEMENTATION_IS_BETTER** |
| **Player/Render card** | ✅ Present | ✅ | ❌ Missing | **CURRENT_AND_COMPLETE** |
| **Activity log** | ✅ Present | ✅ | ❌ Missing | **CURRENT_AND_COMPLETE** |
| **Replay timeline** | ✅ Present | ✅ | ❌ Missing | **CURRENT_AND_COMPLETE** |
| **Accessibility** | ✅ ARIA labels, focus rings, keyboard | ✅ | ❌ Missing | **CURRENT_AND_COMPLETE** |
| **Scene drag-to-reorder** | ✅ Present | ✅ | ✅ Basic | **CURRENT_AND_COMPLETE** |
| **Provenance report** | ❌ Missing | ❌ Missing | ✅ Present | **HISTORICAL_ONLY_VALID** - Backend dependent |
| **Chat status indicator** | ❌ Missing | ❌ Missing | ✅ Present | **HISTORICAL_ONLY_VALID** - Minor UI enhancement |
| **Model selectors** | ❌ Removed | ❌ Removed | ✅ Present | **OBSOLETE** - Intentionally removed |
| **API key collection** | ❌ Removed | ❌ Removed | ✅ Present | **OBSOLETE** - Security hardening removed client-side keys |

---

## 6. Lost Committed Upgrades

| Capability | Added At | Lost At | Current Missing? | Confidence | Action |
|------------|----------|---------|------------------|------------|--------|
| `renderComposeContent` | `bfc8006c3` | Between `1aefcfa13` and `95022df5b` | **YES** | **HIGH** | **RESTORE** |

**Evidence:**
- `renderComposeContent` is referenced in `getStageContentHTML()` at line 630
- Function definition is missing from current file
- Historical recovery branch has the function at line 808
- This would cause a `ReferenceError` at runtime if compose stage is accessed

---

## 7. Backend Support Audit

| Capability | UI Exists | Backend Exists | API Route Exists | Production Functional? |
|------------|-----------|----------------|------------------|------------------------|
| Production submission | ✅ | ✅ (proxied) | `/api/productions` via proxy | ⚠️ Depends on external FastAPI |
| Production polling | ✅ | ✅ (proxied) | `/api/productions/:id` via proxy | ⚠️ Depends on external FastAPI |
| Chat messaging | ✅ | ✅ (proxied) | `/api/productions/:id/chat` via proxy | ⚠️ Depends on external FastAPI |
| Approval workflow | ✅ | ✅ (proxied) | `/api/productions/:id/approve` via proxy | ⚠️ Depends on external FastAPI |
| OpenMontage proxy | ✅ | ✅ | `/openmontage/*` | ✅ Implemented |

**Note:** All OpenMontage APIs are proxied to an external FastAPI service. The backend does not implement these routes directly. The proxy is functional but requires the external service to be running.

---

## 8. Routing and Navigation Audit

| Item | Status | Notes |
|------|--------|-------|
| Router entry (`router.js`) | ❌ **MISSING** | No `openmontage` or `backlot` route in `pageLoaders` |
| Navigation entry | ❌ **MISSING** | Not in `ROUTE_MAP` or any navigation component |
| Direct URL access | ❌ **MISSING** | Cannot navigate to OpenMontage via URL |
| Browser refresh | ❌ **MISSING** | Page would not reload correctly |

**Critical Finding:** OpenMontagePage.js is **completely orphaned**. It exists in the codebase but is not accessible to users through any route or navigation mechanism.

---

## 9. Security and Accessibility Audit

### 9.1 Security
- ✅ `escapeHtml` used throughout for XSS prevention
- ✅ No client-side API key collection (removed in `1aefcfa13`)
- ✅ Server-side proxy for all API calls
- ✅ Clerk authentication via `requireEntitlement()`

### 9.2 Accessibility
- ✅ ARIA labels on buttons (`aria-label`)
- ✅ ARIA live regions (`aria-live="off"`)
- ✅ Role attributes (`role="slider"`)
- ✅ Keyboard navigation support (timeline scrubber)
- ✅ Focus rings on interactive elements
- ✅ Screen reader text for status indicators

---

## 10. Forward-Port Plan

### Priority 1: Restore Lost Committed Upgrade
**Bug Fix:** Restore `renderComposeContent` function

This is a HIGH-confidence committed capability that was accidentally removed. The function is referenced but undefined, causing a runtime error when users navigate to the compose stage.

**Implementation:** Add `renderComposeContent` function from historical recovery, adapted to current styling patterns.

### Priority 2: Consider Router Wiring (Out of Scope)
OpenMontage is currently orphaned. Wiring it into the router would be a new feature addition, not a forward-port from historical. This requires product decision and is **NOT part of this wave**.

### Priority 3: No Additional Historical Ports Needed
The historical stage pipeline (brief, gate, narration, music, render) represents an **older design** that was intentionally replaced by the current pipeline (proposal, storyboard, assets, edit, publish). Restoring historical stages would be a **regression**.

---

## 11. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `renderComposeContent` missing causes crash | **HIGH** | Medium | Restore function |
| OpenMontage unreachable due to missing router entry | **HIGH** | High (but pre-existing) | Product decision needed |
| Historical stage pipeline confusion | Medium | Low | Document that current is intentional redesign |
| Backend service not running | Medium | High | External dependency, out of scope |

---

## 12. Recommendations

1. **IMMEDIATE:** Restore `renderComposeContent` to fix runtime crash
2. **SHORT-TERM:** Product decision on whether to wire OpenMontage into router
3. **LONG-TERM:** Consider whether the current stage pipeline (with simple placeholders) should be enhanced with richer content, but this is new development, not historical recovery

---

*Audit completed. No further historical forward-ports recommended for Wave 2.*
