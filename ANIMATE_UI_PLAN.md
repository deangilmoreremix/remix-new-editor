# Animate-UI Plan — All Studios (Excluding Render & Timeline)

## Scope
Add purposeful motion to every studio in the application using **transform + opacity only**, ease-out curves, reduced-motion fallbacks, and premium material effects (blur, backdrop-filter, clip-path) where smooth. No layout-property animation (`width`, `height`, `margin`, `padding`, `top`, `left`, `right`, `bottom`). No current information is altered — animation classes and utilities are purely additive.

---

## Global Additions

### New CSS Utilities (`styles/globals.css` or a new `styles/animate-ui.css`)
Shared animation tokens and reduced-motion baseline used by every studio:

```css
/* Animation Tokens */
:root {
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
  --duration-fast: 200ms;
  --duration-normal: 350ms;
  --duration-slow: 500ms;
}

/* Reveal / Entrance */
.anim-fade-in-up {
  opacity: 0;
  transform: translate3d(0, 16px, 0);
  animation: fadeInUp var(--duration-normal) var(--ease-out-expo) forwards;
}
@keyframes fadeInUp {
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

.anim-fade-in {
  opacity: 0;
  animation: fadeIn var(--duration-normal) var(--ease-out-quart) forwards;
}
@keyframes fadeIn {
  to { opacity: 1; }
}

.anim-scale-in {
  opacity: 0;
  transform: scale3d(0.96, 0.96, 1);
  animation: scaleIn var(--duration-normal) var(--ease-out-expo) forwards;
}
@keyframes scaleIn {
  to { opacity: 1; transform: scale3d(1, 1, 1); }
}

/* Stagger helper — applied to parent, children animate with delay */
.anim-stagger > * {
  opacity: 0;
  transform: translate3d(0, 12px, 0);
  animation: fadeInUp var(--duration-normal) var(--ease-out-expo) forwards;
}
.anim-stagger > *:nth-child(1) { animation-delay: 0ms; }
.anim-stagger > *:nth-child(2) { animation-delay: 60ms; }
.anim-stagger > *:nth-child(3) { animation-delay: 120ms; }
.anim-stagger > *:nth-child(4) { animation-delay: 180ms; }
.anim-stagger > *:nth-child(5) { animation-delay: 240ms; }
.anim-stagger > *:nth-child(6) { animation-delay: 300ms; }
.anim-stagger > *:nth-child(n+7) { animation-delay: 360ms; }

/* Hover Lift (cards, thumbnails) */
.anim-hover-lift {
  transition: transform var(--duration-fast) var(--ease-out-quart),
              box-shadow var(--duration-fast) var(--ease-out-quart);
}
.anim-hover-lift:hover {
  transform: translate3d(0, -3px, 0);
  box-shadow: 0 8px 30px rgba(0,0,0,0.25);
}

/* Button press feedback */
.anim-press {
  transition: transform var(--duration-fast) var(--ease-out-quart);
}
.anim-press:active {
  transform: scale3d(0.97, 0.97, 1);
}

/* Drawer / Panel slide */
.anim-slide-in-left {
  transform: translate3d(-100%, 0, 0);
  transition: transform var(--duration-normal) var(--ease-out-expo);
}
.anim-slide-in-left.is-open {
  transform: translate3d(0, 0, 0);
}

.anim-slide-in-up {
  transform: translate3d(0, 100%, 0);
  transition: transform var(--duration-normal) var(--ease-out-expo);
}
.anim-slide-in-up.is-open {
  transform: translate3d(0, 0, 0);
}

/* Backdrop fade */
.anim-backdrop {
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out-quart);
}
.anim-backdrop.is-open {
  opacity: 1;
}

/* Dropdown scale + fade */
.anim-dropdown {
  opacity: 0;
  transform: scale3d(0.95, 0.95, 1) translate3d(0, 8px, 0);
  transform-origin: top left;
  transition: opacity var(--duration-fast) var(--ease-out-quart),
              transform var(--duration-fast) var(--ease-out-expo);
  pointer-events: none;
}
.anim-dropdown.is-open {
  opacity: 1;
  transform: scale3d(1, 1, 1) translate3d(0, 0, 0);
  pointer-events: auto;
}

/* Toggle switch smooth */
.anim-toggle {
  transition: background var(--duration-fast) var(--ease-out-quart);
}
.anim-toggle-thumb {
  transition: transform var(--duration-fast) var(--ease-out-expo);
}

/* Skeleton shimmer */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.anim-skeleton {
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

/* Progress bar fill */
.anim-progress-fill {
  transition: width var(--duration-slow) var(--ease-out-expo);
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .anim-fade-in-up,
  .anim-fade-in,
  .anim-scale-in {
    opacity: 1;
    transform: none;
  }
  .anim-stagger > * {
    opacity: 1;
    transform: none;
    animation-delay: 0ms;
  }
}
```

---

## Studio-by-Studio Animation Plan

### 1. ImageStudio (`src/components/ImageStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner area | Fade + slide-up on mount | `anim-fade-in-up` (already partially used via `animate-fade-in-up`; standardize to shared class) |
| Prompt bar wrapper | Staggered fade-in with delay | `anim-fade-in-up` with `animation-delay` |
| Tools panel (Quick Starters) | Slide down + fade | `anim-slide-in-up is-open` toggled by class |
| Advanced options panel | Slide down + fade | `anim-slide-in-up is-open` |
| Model / AR / Quality dropdowns | Scale + fade | Replace manual `opacity`/`scale` toggling with `anim-dropdown is-open` |
| Control buttons row | Stagger children | Wrap in `anim-stagger` |
| Generate button | Press feedback | `anim-press` |
| Quick starter chips | Hover lift | `anim-hover-lift` |
| Toolbar buttons (GTM, Recipe, Monetize) | Hover lift + press | `anim-hover-lift anim-press` |
| Result image reveal | Fade + scale-in | `anim-scale-in` when result appears |

### 2. AudioStudio (`src/components/AudioStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Model selector wrapper | Fade + slide-up with delay | `anim-fade-in-up` |
| Form card | Fade + slide-up with delay | `anim-fade-in-up` |
| Duration buttons | Stagger fade-in | `anim-stagger` on the button row |
| Schema controls (dynamic) | Stagger children | `anim-stagger` on container |
| Generate button | Press feedback | `anim-press` |
| Loading overlay spinner | Already present (`animate-spin`) — keep, add backdrop fade | `anim-backdrop is-open` on overlay background |
| Result area | Fade + scale-in | `anim-scale-in` when revealed |
| History grid cards | Stagger fade-in | `anim-stagger` on grid |
| Audio editor controls | Slide up + fade | `anim-slide-in-up is-open` |
| Upload dropzone states | Smooth transition between IDLE/UPLOADING/READY | Existing `transition-all` is fine; add `anim-scale-in` on READY state |

### 3. EffectsStudio (`src/components/EffectsStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner / top bar | Fade + slide-up | `anim-fade-in-up` |
| Tab buttons row | Stagger fade-in | `anim-stagger` |
| Effect cards grid | Stagger fade-in on render | `anim-stagger` on `effectsGrid` |
| Effect card hover | Lift + border glow | `anim-hover-lift` |
| Selected effect badge | Fade + scale | `anim-scale-in` |
| Preview / Output split view | Fade in on mount | `anim-fade-in` |
| Advanced controls panel | Slide down + fade | `anim-slide-in-up is-open` |
| Slider rows | Stagger children | `anim-stagger` on advanced controls container |
| Generate / Publish buttons | Press feedback | `anim-press` |
| Output action buttons | Press feedback | `anim-press` |
| Compare toggle | Smooth background transition | Existing `transition-all` is fine |
| Layers list rows | Stagger on add/remove | `anim-stagger` on `layersList` when re-rendered |
| Mobile controls section | Fade + slide-up | `anim-fade-in-up` |

### 4. CinemaStudio (`src/components/CinemaStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Cinema Prompt Builder toggle card | Hover lift | `anim-hover-lift` |
| Builder panel (expand/collapse) | Slide down + fade | `anim-slide-in-up is-open` |
| Chevron icon rotate | Already `transition-transform duration-300` — keep, standardize easing | `transition-transform var(--duration-normal) var(--ease-out-expo)` |
| Form selects / inputs | Stagger fade-in | `anim-stagger` on form groups |
| Advanced controls | Slide down + fade | `anim-slide-in-up is-open` |
| Generate button | Press feedback | `anim-press` |
| Camera builder panel cards | Hover lift | `anim-hover-lift` |
| Inline instructions | Fade + slide-up with delay | `anim-fade-in-up` |

### 5. ChatStudio (`src/components/ChatStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Model selector dropdown | Scale + fade | `anim-dropdown is-open` |
| Chat container | Fade + slide-up | `anim-fade-in-up` |
| Empty state icon | Fade in | `anim-fade-in` |
| Input area card | Fade + slide-up with delay | `anim-fade-in-up` |
| Message bubbles (new messages) | Fade + scale-in | `anim-scale-in` appended when message added |
| Send button | Press feedback | `anim-press` |
| System prompt row | Fade in with stagger | `anim-stagger` |
| Loading / generating state | Backdrop fade + spinner | `anim-backdrop is-open` on overlay |

### 6. SmartVideoStudio (`src/components/studios/SmartVideoStudio/`)
React-based studio with its own CSS file (`src/styles/smartVideoStudio.css`).

| Element | Animation | Class / Approach |
|---|---|---|
| Header (sticky) | Fade in on mount | `anim-fade-in` |
| ModeRail tabs | Stagger fade-in | `anim-stagger` |
| Model selector card | Fade + slide-up | `anim-fade-in-up` |
| DynamicModelForm fields | Stagger children | `anim-stagger` on form groups |
| GenerationsPanel cards | Stagger fade-in | `anim-stagger` on jobs list |
| Job status transitions | Fade + scale-in for new jobs | `anim-scale-in` |
| Generate button | Press feedback | `anim-press` |
| Loading states | Shimmer skeleton + spinner | `anim-skeleton` + existing `animate-spin` |
| Header nav links | Hover color transition (already present) — standardize easing | `transition-color var(--duration-fast) var(--ease-out-quart)` |

### 7. VideoStudio (`src/components/VideoStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Prompt bar wrapper | Fade + slide-up with delay | `anim-fade-in-up` |
| Control buttons row (model, AR, duration, etc.) | Stagger fade-in | `anim-stagger` |
| Dropdowns (model, AR, duration, quality) | Scale + fade | `anim-dropdown is-open` |
| Advanced options panel | Slide down + fade | `anim-slide-in-up is-open` |
| Tools panel | Slide down + fade | `anim-slide-in-up is-open` |
| Generate button | Press feedback | `anim-press` |
| Result preview | Fade + scale-in | `anim-scale-in` when revealed |
| Progress bar | Eased fill | `anim-progress-fill` |
| History thumbnails | Stagger fade-in | `anim-stagger` |
| Upload picker trigger | Hover lift | `anim-hover-lift` |

### 8. LipSyncStudio (`src/components/LipSyncStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Mode toggle buttons | Stagger fade-in | `anim-stagger` |
| Upload buttons (Image/Video/Audio) | Stagger fade-in + hover lift | `anim-stagger` + `anim-hover-lift` |
| Upload ready state | Scale-in pop | `anim-scale-in` when state changes to READY |
| Prompt textarea | Fade in with delay | `anim-fade-in` |
| Advanced controls | Slide down + fade | `anim-slide-in-up is-open` |
| Generate button | Press feedback | `anim-press` |
| Result video | Fade + scale-in | `anim-scale-in` |
| Loading overlay | Backdrop fade | `anim-backdrop is-open` |

### 9. BrandStudio (`src/components/BrandStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero heading | Fade + slide-up | `anim-fade-in-up` |
| URL input form | Fade + slide-up with delay | `anim-fade-in-up` |
| Recent brands grid cards | Stagger fade-in | `anim-stagger` on grid |
| Brand card hover | Lift + border glow | `anim-hover-lift` |
| Submit button | Press feedback | `anim-press` |
| Loading overlay | Backdrop fade + spinner | `anim-backdrop is-open` |
| Error message | Fade + slide-in from top | `anim-fade-in-up` |

### 10. CharacterStudio (`src/components/CharacterStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Form card | Fade + slide-up with delay | `anim-fade-in-up` |
| Model selector dropdown | Scale + fade | `anim-dropdown is-open` |
| Upload picker | Hover lift | `anim-hover-lift` |
| Advanced controls | Slide down + fade | `anim-slide-in-up is-open` |
| Generate button | Press feedback | `anim-press` |
| Result image | Fade + scale-in | `anim-scale-in` |
| History grid | Stagger fade-in | `anim-stagger` |

### 11. UpscaleStudio (`src/components/UpscaleStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Method selector dropdown | Scale + fade | `anim-dropdown is-open` |
| Factor buttons row | Stagger fade-in | `anim-stagger` |
| Form card | Fade + slide-up with delay | `anim-fade-in-up` |
| Upload picker | Hover lift | `anim-hover-lift` |
| Generate button | Press feedback | `anim-press` |
| Result preview | Fade + scale-in | `anim-scale-in` |
| Loading overlay | Backdrop fade | `anim-backdrop is-open` |

### 12. VideoToolsStudio (`src/components/VideoToolsStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Model selector dropdown | Scale + fade | `anim-dropdown is-open` |
| Form card | Fade + slide-up with delay | `anim-fade-in-up` |
| Dynamic controls | Stagger children | `anim-stagger` |
| Upload picker | Hover lift | `anim-hover-lift` |
| Generate button | Press feedback | `anim-press` |
| Result area | Fade + scale-in | `anim-scale-in` |
| Loading overlay | Backdrop fade + spinner | `anim-backdrop is-open` |

### 13. StoryboardStudio (`src/components/StoryboardStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Shot type preset chips | Stagger fade-in | `anim-stagger` |
| Frame cards / storyboard grid | Stagger fade-in | `anim-stagger` |
| Frame card hover | Lift + shadow | `anim-hover-lift` |
| Selected frame indicator | Fade + scale | `anim-scale-in` |
| Advanced controls | Slide down + fade | `anim-slide-in-up is-open` |
| Generate button | Press feedback | `anim-press` |
| Progress overlay | Backdrop fade | `anim-backdrop is-open` |

### 14. EditStudio (`src/components/EditStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Tool cards grid (Remove Object, Background Remover, etc.) | Stagger fade-in + hover lift | `anim-stagger` + `anim-hover-lift` |
| Selected tool highlight | Fade + scale | `anim-scale-in` |
| Upload area | Hover border glow + lift | `anim-hover-lift` |
| Generate / Apply button | Press feedback | `anim-press` |
| Result preview | Fade + scale-in | `anim-scale-in` |
| Loading overlay | Backdrop fade | `anim-backdrop is-open` |

### 15. TemplateStudio (`src/components/TemplateStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero / header | Fade + slide-up | `anim-fade-in-up` |
| Template cards grid | Stagger fade-in + hover lift | `anim-stagger` + `anim-hover-lift` |
| Category filter chips | Stagger fade-in | `anim-stagger` |
| Selected template ring | Fade + scale | `anim-scale-in` |
| Use Template button | Press feedback | `anim-press` |

### 16. InfluencerStudio (`src/components/InfluencerStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Influencer cards / avatars | Stagger fade-in + hover lift | `anim-stagger` + `anim-hover-lift` |
| Selected influencer indicator | Fade + scale | `anim-scale-in` |
| Generate button | Press feedback | `anim-press` |
| Result preview | Fade + scale-in | `anim-scale-in` |

### 17. LeadFinderStudio (`src/components/LeadFinderStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Search input | Fade in with delay | `anim-fade-in` |
| Results list rows | Stagger fade-in | `anim-stagger` |
| Result row hover | Lift + background shift | `anim-hover-lift` |
| Loading spinner | Already present — add backdrop fade | `anim-backdrop is-open` |

### 18. OpenThornStudio (`src/components/OpenThornStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Content panels | Fade + slide-up with stagger | `anim-fade-in-up` with delays |
| Action buttons | Press feedback | `anim-press` |
| Dropdowns / modals | Scale + fade | `anim-dropdown is-open` |

### 19. CommercialStudio (`src/components/CommercialStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Ad format cards | Stagger fade-in + hover lift | `anim-stagger` + `anim-hover-lift` |
| Selected format highlight | Fade + scale | `anim-scale-in` |
| Generate button | Press feedback | `anim-press` |

### 20. PhotoStudioPage (`src/components/PhotoStudioPage.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Photo tool cards | Stagger fade-in + hover lift | `anim-stagger` + `anim-hover-lift` |
| Upload area | Hover lift | `anim-hover-lift` |
| Generate button | Press feedback | `anim-press` |
| Result preview | Fade + scale-in | `anim-scale-in` |

### 21. CinemaTemplateStudio (`src/components/CinemaTemplateStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Template cards | Stagger fade-in + hover lift | `anim-stagger` + `anim-hover-lift` |
| Selected template border | Fade + scale glow | `anim-scale-in` |
| Use Template button | Press feedback | `anim-press` |

### 22. AvatarStudio (`src/components/AvatarStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Avatar selection grid | Stagger fade-in + hover lift | `anim-stagger` + `anim-hover-lift` |
| Selected avatar ring | Fade + scale | `anim-scale-in` |
| Voice selector dropdown | Scale + fade | `anim-dropdown is-open` |
| Generate button | Press feedback | `anim-press` |
| Result video preview | Fade + scale-in | `anim-scale-in` |

### 23. TrainingStudio (`src/components/TrainingStudio.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero banner | Fade + slide-up | `anim-fade-in-up` |
| Training dataset cards | Stagger fade-in + hover lift | `anim-stagger` + `anim-hover-lift` |
| Progress steps indicator | Fade + scale-in per step | `anim-scale-in` as steps complete |
| Upload area | Hover lift | `anim-hover-lift` |
| Start Training button | Press feedback | `anim-press` |
| Loading overlay | Backdrop fade + shimmer | `anim-backdrop is-open` + `anim-skeleton` |

### 24. VideoAgentStudioShell (`src/components/VideoAgentStudioShell.js`)
| Element | Animation | Class / Approach |
|---|---|---|
| Shell layout | Fade in | `anim-fade-in` |
| Nested studio iframe/panel | Fade + scale-in on load | `anim-scale-in` |
| Navigation tabs | Stagger fade-in | `anim-stagger` |
| Tab active indicator | Smooth slide | `transition: transform var(--duration-normal) var(--ease-out-expo)` |

### 25. FashionStudio (`src/components/studios/FashionStudio.jsx`)
| Element | Animation | Class / Approach |
|---|---|---|
| Hero / header | Fade + slide-up | `anim-fade-in-up` |
| Product cards grid | Stagger fade-in + hover lift | `anim-stagger` + `anim-hover-lift` |
| Size / color selector chips | Stagger fade-in | `anim-stagger` |
| Selected option highlight | Fade + scale | `anim-scale-in` |
| Generate button | Press feedback | `anim-press` |

### 26. ProductPhotoStudio (`src/components/studios/ProductPhotoStudio.jsx`)
*Note: Currently a placeholder/coming-soon screen.*
| Element | Animation | Class / Approach |
|---|---|---|
| Header text | Fade + slide-up | `anim-fade-in-up` |
| Info card | Fade + scale-in with delay | `anim-scale-in` |
| Placeholder icon | Fade in with delay | `anim-fade-in` |

---

## Shared Component Patterns (Cross-Studio)

These patterns appear in multiple studios and should be animated consistently:

### Dropdowns / Model Selectors
Replace manual opacity/scale class toggling with `anim-dropdown is-open`.
Affected studios: ImageStudio, AudioStudio, CinemaStudio, ChatStudio, CharacterStudio, UpscaleStudio, VideoToolsStudio, LipSyncStudio, VideoStudio.

### Drawers / Panels
Replace manual transform toggling with `anim-slide-in-left is-open` or `anim-slide-in-up is-open`.
Affected: `studio-drawer__panel` in `src/styles/studio.css`, plus any expandable advanced-controls panels.

### Loading Overlays
Add `anim-backdrop is-open` to the backdrop and keep the existing spinner.
Affected: AudioStudio, ImageStudio, VideoStudio, LipSyncStudio, BrandStudio, EditStudio, etc.

### Generation History Grids
Wrap in `anim-stagger` for staggered card entrance.
Affected: AudioStudio (`createHistoryGrid`), ImageStudio, VideoStudio.

### Button Press Feedback
Add `anim-press` class to all primary/secondary action buttons that currently lack active-scale feedback.

### Card Hover Lift
Add `anim-hover-lift` to all clickable cards (templates, effects, tools, brands, frames) that currently only change background/border on hover.

---

## Files to Modify

| File | Changes |
|---|---|
| `styles/globals.css` | Add animation token variables, keyframes, utility classes, reduced-motion baseline |
| `styles/studio.css` | Update drawer panel/backdrop transitions to use shared utilities |
| `styles/components.css` | Add animation utilities for landing-page components (if studios share these) |
| `styles/smartVideoStudio.css` | Add SmartVideo-specific animation utilities + reduced-motion baseline |
| `src/components/ImageStudio.js` | Add animation classes to hero, prompt bar, panels, dropdowns, buttons |
| `src/components/AudioStudio.js` | Add animation classes to form, history grid, result area, loading overlay |
| `src/components/EffectsStudio.js` | Add animation classes to tabs, effect cards, advanced controls, layers |
| `src/components/CinemaStudio.js` | Add animation classes to hero, builder panel, forms, buttons |
| `src/components/ChatStudio.js` | Add animation classes to hero, dropdown, messages, input area |
| `src/components/VideoStudio.js` | Add animation classes to hero, prompt bar, controls, dropdowns, result |
| `src/components/LipSyncStudio.js` | Add animation classes to hero, upload buttons, panels, result |
| `src/components/BrandStudio.js` | Add animation classes to hero, form, brand cards |
| `src/components/CharacterStudio.js` | Add animation classes to hero, form, dropdown, result |
| `src/components/UpscaleStudio.js` | Add animation classes to hero, dropdown, form, result |
| `src/components/VideoToolsStudio.js` | Add animation classes to hero, form, dynamic controls, result |
| `src/components/StoryboardStudio.js` | Add animation classes to hero, frame cards, panels |
| `src/components/EditStudio.js` | Add animation classes to hero, tool cards, upload area, result |
| `src/components/TemplateStudio.js` | Add animation classes to hero, template cards, filters |
| `src/components/InfluencerStudio.js` | Add animation classes to hero, influencer cards |
| `src/components/LeadFinderStudio.js` | Add animation classes to hero, results list |
| `src/components/OpenThornStudio.js` | Add animation classes to hero, panels, buttons |
| `src/components/CommercialStudio.js` | Add animation classes to hero, format cards |
| `src/components/PhotoStudioPage.js` | Add animation classes to hero, tool cards |
| `src/components/CinemaTemplateStudio.js` | Add animation classes to hero, template cards |
| `src/components/AvatarStudio.js` | Add animation classes to hero, avatar grid, voice selector |
| `src/components/TrainingStudio.js` | Add animation classes to hero, dataset cards, progress steps |
| `src/components/VideoAgentStudioShell.js` | Add animation classes to shell layout, nested panels |
| `src/components/studios/FashionStudio.jsx` | Add animation classes to hero, product cards, selectors |
| `src/components/studios/ProductPhotoStudio.jsx` | Add animation classes to placeholder header and card |
| `src/components/studios/SmartVideoStudio/SmartVideoStudio.tsx` | Add animation classes to React components (header, tabs, forms, jobs) |
| `src/components/studios/SmartVideoStudio/svStudio/outputRenderer.ts` | Add animation classes to output rendering |

---

## Technical Constraints (Enforced)

1. **No layout properties animated** — only `transform: translate3d(...) scale3d(...)` and `opacity`.
2. **Easing** — `cubic-bezier(0.16, 1, 0.3, 1)` (expo ease-out) or `cubic-bezier(0.25, 1, 0.5, 1)` (quart ease-out).
3. **GPU compositing** — `will-change: transform, opacity` only during active animation; remove after completion.
4. **Reveal safety** — animations enhance visible defaults; they never gate content visibility. Fallback is instant display.
5. **Reduced motion** — every animated element has a `@media (prefers-reduced-motion: reduce)` fallback that disables animation and shows content instantly.
6. **No new JS animation libraries** — use CSS animations/transitions only. No GSAP, no Framer Motion, no WAAPI unless already present.

---

## Summary

- **26 studios** receive animation enhancements (Render Studio and Timeline Studio excluded).
- **1 shared CSS utility file** (or additions to `globals.css`) provides all tokens, keyframes, and utility classes.
- **2 shared CSS files** (`studio.css`, `smartVideoStudio.css`) get drawer/panel transition updates.
- **~28 component files** get additive animation class names.
- **Zero functional changes** — all changes are CSS class additions and animation-delay/style tweaks.
- **Reduced-motion baseline** included globally.

Awaiting your approval before implementing.
