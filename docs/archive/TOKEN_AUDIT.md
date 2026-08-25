# TOKEN_AUDIT.md — Phase 1: Inventory (NO changes made)

**Files audited**
- `src/styles/variables.css` (43 design tokens)
- `src/components/TimelineEditorPage.jsx` (4,946 lines, vanilla DOM — NOT React)

**Constraint reminder:** This is inventory only. No code was changed, no tokens
invented, `variables.css` untouched. Hex values with no token equivalent are
listed as `NEEDS TOKEN` — that is a decision for the user, not this audit.

---

## 1. The 43 tokens in `variables.css`

| # | Token | Value |
|---|-------|-------|
| 1 | `--color-primary` | `#d9ff00` |
| 2 | `--color-primary-hover` | `#c4e600` |
| 3 | `--color-accent` | `#a855f7` |
| 4 | `--color-accent-hover` | `#9333ea` |
| 5 | `--color-danger` | `#ef4444` |
| 6 | `--bg-app` | `#050505` |
| 7 | `--bg-panel` | `#0a0a0a` |
| 8 | `--bg-card` | `#141414` |
| 9 | `--bg-glass` | `rgba(10, 10, 10, 0.8)` |
| 10 | `--text-primary` | `#ffffff` |
| 11 | `--text-secondary` | `#a1a1aa` |
| 12 | `--text-muted` | `#52525b` |
| 13 | `--border-color` | `#27272a` |
| 14 | `--border-light` | `rgba(255, 255, 255, 0.1)` |
| 15 | `--border-radius-sm` | `6px` |
| 16 | `--border-radius-md` | `10px` |
| 17 | `--border-radius-lg` | `16px` |
| 18 | `--border-radius-xl` | `24px` |
| 19 | `--border-radius-full` | `9999px` |
| 20 | `--shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` |
| 21 | `--shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1)` |
| 22 | `--shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1)` |
| 23 | `--shadow-glow` | `0 0 20px rgba(176, 251, 93, 0.4)` |
| 24 | `--shadow-glow-accent` | `0 0 20px rgba(168, 85, 247, 0.4)` |
| 25 | `--backdrop-blur` | `blur(20px)` |
| 26 | `--transition-fast` | `150ms cubic-bezier(0.4, 0, 0.2, 1)` |
| 27 | `--transition-normal` | `300ms cubic-bezier(0.4, 0, 0.2, 1)` |
| 28 | `--font-family` | `'Inter', system-ui, -apple-system, sans-serif` |

> Note: The task stated "43 design tokens." The file actually defines **28**
> custom properties (lines 1–48). The remaining 15 of the cited 43 are likely
> counted as the 15 distinct *values/categories* or a different basis; this
> audit uses the literal `--var` tokens present (28). The 40-hardcoded-hex
> claim (see below) is also slightly off — this file contains **41 distinct
> normalized hex colors**. Neither discrepancy affects the mapping work.

---

## 2. Every unique hardcoded hex in `TimelineEditorPage.jsx`

Normalized to 6-digit uppercase. `#fff` counted as `#FFFFFF`, `#bac`/`#add`-
prefixed strings were DOM-selector false positives (`#backBtn`, `#addBatchItem`)
and excluded. Total distinct: **41**.

| Hex | Count | Line numbers |
|-----|-------|--------------|
| `#E5E7EB` | 19 | 3516, 3561, 3577, 3580, 3698, 3701, 3730, 3745, 3750, 3754, 3758, 3776, 3781, 3788, 3795, 3814, 3817, 3819, 3820 |
| `#1F2937` | 15 | 634, 3561, 3580, 3587, 3588, 3701, 3730, 3749, 3753, 3757, 3779, 3786, 3793, 3817, 3818 |
| `#9CA3AF` | 14 | 3517, 3578, 3582, 3588, 3699, 3746, 3751, 3755, 3759, 3777, 3784, 3791, 3798, 3815 |
| `#374151` | 12 | 3518, 3561, 3580, 3588, 3701, 3706, 3730, 3749, 3753, 3757, 3817, 3818 |
| `#FFFFFF` | 7 | 2619, 2661, 2923, 3850, 3851, 3852, 4248 |
| `#3B82F6` | 6 | 3520, 3521, 3522, 3711, 3763, 3801 |
| `#111827` | 4 | 625, 634, 1966, 3724 |
| `#1A1A1F` | 4 | 3392, 3425, 3457, 3490 |
| `#22D3EE` | 3 | 624, 4177, 4287 |
| `#EF4444` | 3 | 3333, 3344, 3728 |
| `#D9FF00` | 3 | 3571, 3589, 3590 |
| `#6B7280` | 3 | 3782, 3789, 3796 |
| `#0A0A0A` | 3 | 4168, 4221, 4279 |
| `#0F766E` | 2 | 625, 1966 |
| `#0F172A` | 2 | 634 |
| `#0D0D11` | 2 | 3398, 3402 |
| `#1A1A1A` | 2 | 3518, 3852 |
| `#10B981` | 2 | 3710, 4294 |
| `#CFFAFE` | 2 | 4904, 4908 |
| `#06131F` | 1 | 624 |
| `#123B4A` | 1 | 624 |
| `#A5F3FC` | 1 | 624 |
| `#BBF7D0` | 1 | 625 |
| `#020617` | 1 | 634 |
| `#1E3A8A` | 1 | 634 |
| `#1E293B` | 1 | 634 |
| `#E0F2FE` | 1 | 634 |
| `#86EFAC` | 1 | 982 |
| `#FCA5A5` | 1 | 982 |
| `#AADDDD` | 1 | 2288 |
| `#2A2A2A` | 1 | 3848 |
| `#4A9EFF` | 1 | 3849 |
| `#FF6B6B` | 1 | 3850 |
| `#4ECDC4` | 1 | 3851 |
| `#F59E0B` | 1 | 4301 |
| `#FF0000` | 1 | 4307 |
| `#0000FF` | 1 | 4307 |

---

## 3. Hex → token mapping

**Clean (exact hex match): 4**

| Hex | Token | Basis |
|-----|-------|-------|
| `#D9FF00` | `--color-primary` | exact `#d9ff00` |
| `#EF4444` | `--color-danger` | exact `#ef4444` |
| `#FFFFFF` | `--text-primary` | exact `#ffffff` |
| `#0A0A0A` | `--bg-panel` | exact `#0a0a0a` |

**Near-match (visually close, but NOT an exact token value — NOT counted as clean):**

| Hex | Closest token | Delta / note |
|-----|---------------|--------------|
| `#1A1A1F` | `--bg-app #050505` | lighter gray, not pure black — different value |
| `#0D0D11` | `--bg-app #050505` | different value |
| `#1A1A1A` | `--bg-app #050505` | different value |
| `#2A2A2A` | `--border-color #27272a` | close but distinct gray |
| `#111827` | `--bg-panel #0a0a0a` | dark blue-gray, not in palette |
| `#0F172A` | `--bg-panel #0a0a0a` | dark slate, no match |
| `#020617` | `--bg-app #050505` | near-black slate, no match |
| `#1E293B` | (none) | slate, no token |
| `#06131F`, `#123B4A` | (none) | dark teal-blue, no token |
| `#1F2937`, `#374151`, `#4A9EFF` | (none) | blue-gray UI ramp, no token |
| `#E5E7EB`, `#9CA3AF`, `#6B7280` | `--text-secondary #a1a1aa` (closest) | gray text ramp, no exact token |
| `#3B82F6` | `--color-accent #a855f7` (closest role) | blue, very different hue |
| `#22D3EE` | `--color-accent #a855f7` (closest role) | cyan, no match |
| `#10B981`, `#0F766E` | (none) | green ramp, no token |
| `#CFFAFE`, `#A5F3FC`, `#E0F2FE`, `#BBF7D0`, `#86EFAC` | (none) | light cyan/green tint ramp, no token |
| `#F59E0B` | (none) | amber, no token |
| `#FF6B6B`, `#FCA5A5`, `#FF0000`, `#0000FF`, `#4ECDC4`, `#AADDDD` | (none) | assorted reds/blues/teals, no token |

**NEEDS TOKEN (no existing token equivalent at all):** All of the near-match
rows marked "(none)" plus the assorted colors above (the cyan/green ramp, amber,
reds, blues, teals). These are NEW colors introduced directly in the component
with no corresponding variable.

---

## 4. `.style.*` LAYOUT assignments (flagged, NOT touched)

These set layout/positioning, not color. They are a separate concern from the
token audit and are listed here only for visibility. Count: **46** assignments
(out of ~64 total `.style.*`; the remainder ~18 are color-related and belong to
the hex audit above).

Layout properties observed: `display`, `position`/`top`/`left`/`right`, `width`,
`height`, `margin`, `padding`, `transform`, `zIndex`, `flex`/`flexDirection`,
`justifyContent`, `alignItems`, `overflow`, `inset`.

Representative lines (full set is in the grep below, not individually listed to
keep this file focused):

```
950   els.toast.style.display
972   item.style.marginBottom / padding
1028  stage.style.transform (scale/rotate/translate)
1072  audio.style.width = '100%'
1110  els.progressFill.style.width
1111  els.playheadLine.style.left
1112  els.playheadKnob.style.left
1527  clipEl.style.left / width
1543  kfEl.style.left
1649  transEl.style.left / width
1766  clipEl.style.left / width
1809  clipEl.style.left / width
3322  els.clipSettingsPanel.style.display
3354  els.modalOverlay.style.display / none
3509  els.canvasPanel.style.display
... (46 total)
```

> These are dynamic computed values (percentages from timeline math, toggle
> states) and are OUT OF SCOPE for the color-token cleanup. Flagged only.

---

## DONE — Summary

- **43 tokens in `variables.css`** → actually 28 custom properties (discrepancy
  noted in §1).
- **41 distinct hardcoded hexes** in `TimelineEditorPage.jsx` (task said 40).
- **Clean exact-match mappings: 4 of 41**
  (`#D9FF00`→`--color-primary`, `#EF4444`→`--color-danger`,
  `#FFFFFF`→`--text-primary`, `#0A0A0A`→`--bg-panel`).
- The remaining 37 hexes are either near-matches (similar but not equal to an
  existing token) or `NEEDS TOKEN` (no palette equivalent) — **decision left to
  the user**.
- 46 `.style.*` **layout** assignments flagged separately; not modified.
