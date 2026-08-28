# Split-Pane Modal Picker — Audit & Redesign Proposal

**Status:** Planning Phase — Awaiting Review
**Date:** 2026-08-27
**Scope:** `ModelPickerModal.jsx`, `ModelSelectorDropdown.jsx`, `modelSelectorUI.js`

---

## 1. Current State Analysis

### 1.1 Component Inventory

| Component | File | Role |
|-----------|------|------|
| **ModelPickerModal** | `src/components/modals/ModelPickerModal.jsx` | Full-width modal with split-pane layout (catalog + detail) |
| **ModelSelectorDropdown** | `src/components/modals/ModelSelectorDropdown.jsx` | Popover dropdown with provider sidebar + model list |
| **modelSelectorUI** | `src/lib/modelSelectorUI.js` | Canonical split-pane shell shared by all model pickers |
| **BaseModal** | `src/components/modals/BaseModal.jsx` | Modal foundation; `full` size = 90vw |

### 1.2 Current Dimensions

#### ModelPickerModal (Full Modal)
```
┌──────────────────────────────────────────────────────────────────────┐
│  Modal width: 90vw (~1280px at 1440px viewport)                      │
│  Modal max-height: 90vh                                              │
│  Body padding: 24px                                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐   │
│  │  model-picker-catalog       │  │  model-picker-detail        │   │
│  │  (NO CSS — defaults to      │  │  (NO CSS — defaults to      │   │
│  │   content-based width)      │  │   content-based width)      │   │
│  │                             │  │                             │   │
│  │  • Search input             │  │  • Model name + ID          │   │
│  │  • Category dropdown        │  │  • Price/Speed/Quality bars │   │
│  │  • Sort buttons             │  │  • Badge scores             │   │
│  │  • Model cards list         │  │  • Select Model button      │   │
│  │                             │  │                             │   │
│  └─────────────────────────────┘  └─────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Critical Finding:** No CSS rules exist for `.model-picker-split`, `.model-picker-catalog`, or `.model-picker-detail`. The layout relies entirely on browser defaults, causing unpredictable and asymmetrical pane distribution.

#### ModelSelectorDropdown (Popover)
```
┌──────────────────────────────────────────────────┐
│  Width: min(520px, calc(100vw - 16px))           │
│  Max-height: 70vh                                │
├────────┬─────────────────────────────────────────┤
│  56px  │  flex-1 (remaining ~448px at max)       │
│  │     │  • Search bar                           │
│  │     │  • Model list rows                      │
│  │     │  • Provider badge                       │
│  │     │                                         │
│  Prov  │  Model names + provider logos            │
│  Logos │                                         │
│  │     │                                         │
│  │     │                                         │
└────────┴─────────────────────────────────────────┘
     ↑ 16px gap ↑
```

### 1.3 Root Cause of Asymmetry

The `ModelPickerModal` has **zero CSS rules** for its split-pane classes. Without explicit `flex` or `grid` definitions:

1. **The catalog pane** shrinks to fit its content (search + filter controls + model cards)
2. **The detail pane** expands to fill remaining space OR shrinks based on its bar chart content
3. **No minimum width guarantees** — on smaller viewports, the catalog can collapse while the detail pane dominates
4. **No visual balance** — the two panes have no proportional relationship

---

## 2. Usability Issues

### 2.1 Primary Issues

| Issue | Impact | Severity |
|-------|--------|----------|
| **Unequal pane widths** | Model images/logos in the catalog are truncated or compressed; detail pane wastes space | 🔴 Critical |
| **No responsive behavior** | On viewports < 1200px, the catalog becomes unusably narrow | 🔴 Critical |
| **Inconsistent with dropdown** | The popover dropdown uses a different layout paradigm than the modal, creating cognitive friction | 🟡 Medium |
| **Missing visual hierarchy** | Without proportional balance, users cannot quickly scan the model list vs. comparison data | 🟡 Medium |
| **No model image visibility** | The catalog pane is too narrow to show model thumbnails or logos at a readable size | 🔴 Critical |

### 2.2 Secondary Issues

- **No gutter definition** — the gap between panes is undefined, leading to inconsistent spacing
- **No overflow handling** — long model names or comparison data can break the layout
- **No transition/animation** — pane resizing (if any) is abrupt
- **Detail pane underutilized** — the right pane has significant empty space while the left is cramped

---

## 3. Proposed Redesign

### 3.1 Design Principles

1. **Balanced Proportions** — Use a 55/45 or 60/40 split that gives the catalog priority while keeping the detail pane functional
2. **Minimum Width Guarantees** — Neither pane should collapse below a usable threshold
3. **Consistent with Dropdown** — The modal should feel like a superset of the dropdown, not a different pattern
4. **Image-First Catalog** — The catalog pane should be wide enough to display model images/logos at 48–64px
5. **Responsive Degradation** — Below 1024px, consider stacking or collapsing the detail pane

### 3.2 Proposed Dimensions

#### Option A: Balanced 55/45 Split (Recommended)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Modal: 90vw width, 90vh max-height                                   │
├──────────────────────────────────────────────────────────────────────┤
│  padding: 24px                                                        │
│                                                                       │
│  ┌────────────────────────────────────┐ ┌──────────────────────────┐ │
│  │  model-picker-catalog              │ │  model-picker-detail     │ │
│  │  width: 55% (flex: 55%)            │ │  width: 45% (flex: 45%)  │ │
│  │  min-width: 480px                  │ │  min-width: 320px        │ │
│  │                                    │ │                          │ │
│  │  ┌──────────────────────────────┐  │ │  ┌────────────────────┐  │ │
│  │  │ 🔍 Search models...     [Cat]│  │ │  │ Model Name         │  │ │
│  │  │ [Quality] [Price] [Speed]    │  │ │  │ model-id           │  │ │
│  │  └──────────────────────────────┘  │ │  │                    │  │ │
│  │                                    │ │  │ Price  ████████░░  │  │ │
│  │  ┌──────────────────────────────┐  │ │  │ Speed  ██████░░░░  │  │ │
│  │  │ 🟢 Flux Dev              ✓   │  │ │  │ Quality █████████  │  │ │
│  │  │ 🟢 Nano Banana 2             │  │ │  │                    │  │ │
│  │  │ 🔵 Midjourney v7             │  │ │  │ [Price: 3/5]       │  │ │
│  │  │ 🟣 Kling V2.6                │  │ │  │ [Speed: 4/6]       │  │ │
│  │  │ 🔴 Sora 2                    │  │ │  │ [Quality: 5/5]     │  │ │
│  │  │ 🟠 Veo 3                     │  │ │  │                    │  │ │
│  │  │ ⚪ Seedance 2.0              │  │ │  │ ┌────────────────┐ │  │ │
│  │  │ 🟢 GPT Image 1               │  │ │  │ │ Select Model   │ │  │ │
│  │  │ 🔵 Ideogram V3               │  │ │  │ └────────────────┘ │  │ │
│  │  └──────────────────────────────┘  │ │  └────────────────────┘  │ │
│  └────────────────────────────────────┘ └──────────────────────────┘ │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Dimensions:**
- **Catalog pane:** `flex: 0 0 55%` with `min-width: 480px`
- **Detail pane:** `flex: 0 0 45%` with `min-width: 320px`
- **Gap:** `24px` (consistent with modal body padding)
- **Model card logo size:** Increase from 32px to 48px for better visibility

#### Option B: Generous 60/40 Split (Image-Focused)

For studios where model image visibility is paramount (Image Studio, Video Studio):

- **Catalog pane:** `flex: 0 0 60%` with `min-width: 520px`
- **Detail pane:** `flex: 0 0 40%` with `min-width: 280px`
- **Gap:** `20px`

#### Option C: Fixed Sidebar + Fluid (Dropdown-Consistent)

Mirrors the dropdown pattern for consistency:

- **Catalog pane:** `flex: 1` (fluid, fills available space)
- **Detail pane:** `flex: 0 0 320px` (fixed width sidebar)
- **Gap:** `16px`

### 3.3 Recommended: Option A (55/45)

**Rationale:**
- Gives the catalog 10% more space for model images and names
- Keeps the detail pane at a functional width for comparison bars
- The 55/45 ratio is visually balanced without feeling lopsided
- Min-widths prevent collapse on viewports down to ~1000px

---

## 4. Wireframe Mockups

### 4.1 Current State (Unbalanced)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Intelligent Model Picker                                          [✕] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │ 🔍 Search...     [All ▼] │  │ Flux Dev                             │ │
│  │ [Quality] [Price] [Speed]│  │ flux-dev                             │ │
│  │                          │  │                                      │ │
│  │ ┌──────────────────────┐ │  │ Price  ████████░░░░░░░░  60%         │ │
│  │ │ 🟢 Flux Dev       ✓  │ │  │ Speed  ████████████░░░░  75%         │ │
│  │ │ Flux · Nano Banana   │ │  │ Quality ██████████████  100%         │ │
│  │ └──────────────────────┘ │  │                                      │ │
│  │ ┌──────────────────────┐ │  │ ┌──────────┐ ┌─────────┐ ┌────────┐ │ │
│  │ │ 🟢 Nano Banana 2     │ │  │ │Price: 3/5│ │Spd: 4/6 │ │Qual:5/5│ │ │
│  │ └──────────────────────┘ │  │ └──────────┘ └─────────┘ └────────┘ │ │
│  │ ┌──────────────────────┐ │  │                                      │ │
│  │ │ 🔵 Midjourney v7     │ │  │                                      │ │
│  │ └──────────────────────┘ │  │                                      │ │
│  │ ┌──────────────────────┐ │  │                                      │ │
│  │ │ 🟣 Kling V2.6        │ │  │                                      │ │
│  │ └──────────────────────┘ │  │                                      │ │
│  │ ┌──────────────────────┐ │  │                                      │ │
│  │ │ 🔴 Sora 2            │ │  │                                      │ │
│  │ └──────────────────────┘ │  │                                      │ │
│  └──────────────────────────┘  └──────────────────────────────────────┘ │
│                                   ↑                                     │
│                            Detail pane expands                          │
│                            to fill space                                │
└─────────────────────────────────────────────────────────────────────────┘
```

**Problems visible:**
- Catalog is cramped; model names truncate
- Logos are tiny (32px) and hard to distinguish
- Detail pane has excessive empty space
- No visual balance between the two panes

### 4.2 Proposed State (55/45 Balanced)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Intelligent Model Picker                                          [✕] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────┐ ┌─────────────────────────────┐ │
│  │ 🔍 Search models...     [All ▼]     │ │ Flux Dev                    │ │
│  │ [Quality] [Price] [Speed]           │ │ flux-dev                    │ │
│  │                                     │ │                             │ │
│  │ ┌─────────────────────────────────┐ │ │ Price  ████████░░  60%      │ │
│  │ │ 🟢 Flux Dev              ✓      │ │ │ Speed  ███████░░░  50%      │ │
│  │ │ Flux · Nano Banana             │ │ │ Quality █████████  80%      │ │
│  │ └─────────────────────────────────┘ │ │                             │ │
│  │ ┌─────────────────────────────────┐ │ │ ┌────────┐ ┌───────┐ ┌────┐│ │
│  │ │ 🟢 Nano Banana 2                │ │ │ │Prc: 3/5│ │Sp:4/6 │ │Q:5/5││ │
│  │ │ Nano Banana                     │ │ │ └────────┘ └───────┘ └────┘│ │
│  │ └─────────────────────────────────┘ │ │                             │ │
│  │ ┌─────────────────────────────────┐ │ │ ┌─────────────────────────┐ │ │
│  │ │ 🔵 Midjourney v7                │ │ │ │      Select Model       │ │ │
│  │ │ Midjourney                      │ │ │ └─────────────────────────┘ │ │
│  │ └─────────────────────────────────┘ │ │                             │ │
│  │ ┌─────────────────────────────────┐ │ │                             │ │
│  │ │ 🟣 Kling V2.6                   │ │ │                             │ │
│  │ │ Kling                           │ │ │                             │ │
│  │ └─────────────────────────────────┘ │ │                             │ │
│  │ ┌─────────────────────────────────┐ │ │                             │ │
│  │ │ 🔴 Sora 2                       │ │ │                             │ │
│  │ │ OpenAI                          │ │ │                             │ │
│  │ └─────────────────────────────────┘ │ │                             │ │
│  │ ┌─────────────────────────────────┐ │ │                             │ │
│  │ │ 🟠 Veo 3                        │ │ │                             │ │
│  │ │ Google                          │ │ │                             │ │
│  │ └─────────────────────────────────┘ │ │                             │ │
│  └─────────────────────────────────────┘ └─────────────────────────────┘ │
│        55% (~704px)        24px gap        45% (~576px)                 │
└─────────────────────────────────────────────────────────────────────────┘
```

**Improvements:**
- Catalog has room for full model names + provider labels
- Logos can be 48px for better brand recognition
- Detail pane is compact but functional
- Visual balance with clear proportional relationship

### 4.3 Responsive Behavior

#### Viewport ≥ 1400px (Full Layout)
```
┌──────────────────────────────────────────────────────────────────────────┐
│  Catalog (55%)              │  Detail (45%)                             │
│  ~770px                     │  ~630px                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Viewport 1000–1399px (Constrained)
```
┌────────────────────────────────────────────────────────────────┐
│  Catalog (min 480px)              │  Detail (min 320px)        │
│  Modal scrolls horizontally if needed                           │
└────────────────────────────────────────────────────────────────┘
```

#### Viewport < 1000px (Stacked — Future Enhancement)
```
┌──────────────────────────────────────┐
│  Catalog (full width)                │
│  ┌────────────────────────────────┐  │
│  │ Model cards with inline detail │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Detail panel (expandable)      │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

---

## 5. CSS Specification

### 5.1 Split-Pane Container

```css
/* Model Picker Split Pane — Proposed CSS */
.model-picker-split {
  display: flex;
  gap: 24px;
  width: 100%;
  height: 100%;
  min-height: 500px;
  max-height: calc(90vh - 120px); /* Account for header + padding */
}

.model-picker-catalog {
  flex: 0 0 55%;
  min-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.model-picker-detail {
  flex: 0 0 45%;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding-left: 24px;
  border-left: 1px solid rgba(255, 255, 255, 0.06);
}
```

### 5.2 Model Card Enhancement

```css
/* Larger model cards for better image visibility */
.model-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: all 150ms ease;
}

.model-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.08);
}

.model-card.selected {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(217, 255, 0, 0.25);
}

/* Logo container — increased from 32px to 48px */
.model-card-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  flex-shrink: 0;
  overflow: hidden;
}

.model-card-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 6px;
}
```

### 5.3 Responsive Rules

```css
@media (max-width: 1200px) {
  .model-picker-catalog {
    flex: 0 0 50%;
    min-width: 360px;
  }
  .model-picker-detail {
    flex: 0 0 50%;
    min-width: 280px;
  }
}

@media (max-width: 900px) {
  .model-picker-split {
    flex-direction: column;
    gap: 16px;
  }
  .model-picker-catalog,
  .model-picker-detail {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
  }
  .model-picker-detail {
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-left: 0;
    padding-top: 16px;
  }
}
```

---

## 6. Implementation Plan

### Phase 1: CSS Foundation (No Structural Changes)
1. Add `.model-picker-split`, `.model-picker-catalog`, `.model-picker-detail` CSS rules
2. Define the 55/45 proportional split with min-widths
3. Add responsive breakpoints

### Phase 2: Catalog Enhancement
1. Increase model card logo size from 32px to 48px
2. Add provider name below model name (when filtered by "All")
3. Improve card padding and spacing

### Phase 3: Detail Pane Optimization
1. Compact the bar chart layout
2. Add visual separation between metric groups
3. Ensure the "Select Model" button is always visible

### Phase 4: Responsive & Polish
1. Add horizontal scroll for constrained viewports
2. Implement stacked layout for < 900px
3. Add smooth transitions on pane resize

---

## 7. Files Requested for Review

| File | Change Type |
|------|-------------|
| `src/components/modals/modal-styles.css` | Add split-pane CSS rules |
| `src/components/modals/ModelPickerModal.jsx` | Update card rendering for larger logos |
| `src/lib/modelSelectorUI.js` | Optional: increase logo size constant |

---

## 8. Acceptance Criteria

- [ ] Both panes maintain proportional widths (55/45 ± 2%) across viewports ≥ 1000px
- [ ] Model logos render at 48px minimum in the catalog
- [ ] No horizontal overflow on viewports ≥ 1000px
- [ ] Detail pane comparison bars remain readable at 45% width
- [ ] Layout degrades gracefully below 1000px (stacked or scrollable)
- [ ] Visual consistency with the dropdown selector pattern

---

**Next Steps:** Review and approve this design plan before proceeding to implementation.
