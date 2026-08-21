# ExampleGallery Design Audit & Redesign Plan

## Current State Audit

### Integration Pattern (All 10 Studios)
Every studio appends the gallery identically:
```js
const galleryAssets = getAssetsForStudio('<studio-id>');
if (galleryAssets.length > 0) {
  const gallery = ExampleGallery({ studioId: '<studio-id>', assets: galleryAssets, maxCards: 20 });
  container.appendChild(gallery);
}
```

**Problems:**
1. **No section wrapper** — Gallery is a bare DOM node dropped at the end of the studio container with no semantic section, no margin, no visual separation from the generate button/results area above.
2. **No section header** — Users have no context for what they're looking at. No "Examples" label, no count, no studio-specific title.
3. **Card sizing is cramped** — Fixed `232px` width, `131px` media height. On a 1440p screen this looks like a cramped thumbnail strip, not a premium example gallery.
4. **Button alignment is broken** — Two buttons (`View Prompt` + `Create This Style`) are in a flex row with `gap: 8px`, but the card body padding is only `12px`, font is `11px`, and button padding is `6px 10px`. Buttons look misaligned and cramped.
5. **"Create This Style" button styling is inconsistent** — It uses `background: #d9ff00; color: #000; border: none` while the studio's primary buttons use `bg-primary text-black` with proper hover states (`hover:shadow-glow`, `active:scale-95`). The gallery CTA looks like an afterthought.
6. **Scroll container has no horizontal padding** — `padding: 20px 0` means cards are flush left/right. Arrow buttons at `left: 8px` and `right: 8px` overlap card edges instead of sitting in a gutter.
7. **No responsive behavior** — Fixed card widths, fixed media heights, no breakpoint adjustments. Mobile experience is untested.
8. **Hover state is subtle** — `translateY(-3px)` and a small glow. The rest of the studio uses more pronounced hover effects on interactive elements.
9. **Badge text is noisy** — `category || tags[0]` often produces labels like "AI VIDEO ADS & UGC" in all-caps, which is too loud for a small badge.
10. **Empty state is bare** — "No examples yet for this studio." is plain text with no icon or visual treatment.

### Design System Context
The app uses a strict dark theme with these tokens:
- `--color-primary: #d9ff00` (neon yellow-green)
- `--bg-app: #050505`
- `--bg-card: #141414`
- `--border-color: #27272a`
- `--text-primary: #ffffff`
- `--text-secondary: #a1a1aa`
- `--text-muted: #52525b`
- `--shadow-glow: 0 0 20px rgba(217, 255, 0, 0.4)`
- `--border-radius-lg: 16px`
- `--border-radius-xl: 24px`

Studios use `bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem]` for panels.

### Comparison: What Good Looks Like in This Codebase
- **SmartVideoViral.js** rail: `gap: 16px`, proper scrollbar styling, `scroll-snap-type: x mandatory`, cards with hover actions that fade in.
- **Minimax landing cards**: Smooth hover transitions, proper image scale on hover, clean badge treatment.
- **Studio panels**: Consistent `bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl` with proper padding.

---

## Redesign Plan

### 1. Section Wrapper
Wrap the entire gallery in a proper studio section:
```html
<section class="gallery-section w-full mt-8 mb-4">
  <header class="flex items-center justify-between mb-4 px-1">
    <div>
      <h2 class="text-sm font-bold text-white uppercase tracking-wider">Example Gallery</h2>
      <p class="text-xs text-muted mt-0.5">Click any card to view the prompt or create in this style</p>
    </div>
    <span class="text-xs text-muted">12 examples</span>
  </header>
  <div class="gallery-rail-wrapper relative">
    <!-- arrows + scroll rail -->
  </div>
</section>
```

### 2. Card Redesign
- **Width**: `240px` (up from 232px)
- **Media height**: `160px` (up from 131px) — gives more visual weight
- **Border radius**: `16px` (matches `--border-radius-lg`)
- **Hover**: `translateY(-4px)` + `border-color: var(--color-primary)` + `box-shadow: var(--shadow-glow)`
- **Image**: Slight scale on hover (`scale(1.03)`) for premium feel
- **Badge**: Smaller, less intrusive. Use `text-[10px]` with `px-2 py-0.5` and `border-primary/40`

### 3. Button Redesign
- **Layout**: Stack vertically instead of side-by-side. This fixes alignment and gives each button proper touch target size.
- **View Prompt**: Secondary style — `bg-white/5 text-secondary border border-white/10 hover:bg-white/10 hover:text-white`
- **Create This Style**: Primary style — `bg-primary text-black font-bold hover:shadow-glow active:scale-95 transition-all`
- **Padding**: `py-2 px-3` with `text-xs font-bold rounded-lg`
- **Gap**: `8px` between stacked buttons

### 4. Scroll Rail Improvements
- **Horizontal padding**: `px-4` on the scroll container so cards don't touch edges
- **Arrow gutter**: Arrows sit in the padding area, not overlapping cards
- **Scrollbar**: Custom styled scrollbar matching `custom-scrollbar` pattern but horizontal: `height: 6px`, thumb `rgba(255,255,255,0.12)`, rounded full
- **Snap**: `scroll-snap-type: x mandatory` with `scroll-snap-align: start`
- **Smooth scroll**: `scroll-behavior: smooth`

### 5. Responsive Behavior
- **Desktop**: 240px cards, 160px media, stacked buttons
- **Tablet (768px-)**: Same card size but reduced padding
- **Mobile (<768px)**: Hide arrow buttons, rely on native scroll, cards remain 240px but with tighter spacing

### 6. Section Header
- Consistent across all studios
- Shows "Example Gallery" as the section title
- Subtitle: "Click any card to view the prompt or create in this style"
- Optional count badge

### 7. Empty State
- Icon + text treatment
- "No examples yet for this studio." with a muted icon
- Consistent with other empty states in the app

### 8. Studio Integration Changes
Instead of:
```js
const gallery = ExampleGallery({ studioId: 'video', assets: galleryAssets, maxCards: 20 });
container.appendChild(gallery);
```

Use:
```js
const gallerySection = createGallerySection({ studioId: 'video', assets: galleryAssets, maxCards: 20 });
container.appendChild(gallerySection);
```

Where `createGallerySection` returns the full `<section>` wrapper with header, rail, and cards.

---

## Implementation Steps

1. **Rewrite `ExampleGallery.js`** as a section-builder that returns a complete `<section>` with header, scroll rail, and cards.
2. **Extract CSS into a dedicated stylesheet** (`src/styles/example-gallery.css`) instead of inline styles for maintainability.
3. **Update all 10 studio integrations** to use `createGallerySection` (or keep the same API but return the wrapper).
4. **Update tests** to match the new DOM structure.
5. **Run build + tests** to verify.

---

## Design Token Mapping

| Token | Value | Usage in Gallery |
|-------|-------|------------------|
| `--color-primary` | `#d9ff00` | CTA button bg, arrow color, active border |
| `--bg-app` | `#050505` | Gallery section bg (transparent, inherits) |
| `--bg-card` | `#141414` | Card background |
| `--border-color` | `#27272a` | Card border, default button border |
| `--text-primary` | `#ffffff` | Card title |
| `--text-secondary` | `#a1a1aa` | Secondary button text, subtitle |
| `--text-muted` | `#52525b` | Empty state, count badge |
| `--shadow-glow` | `0 0 20px rgba(217,255,0,0.4)` | Card hover, CTA hover |
| `--border-radius-lg` | `16px` | Card radius |
| `--border-radius-xl` | `24px` | Section panel radius (if wrapped in panel) |
| `--transition-normal` | `300ms cubic-bezier(0.4,0,0.2,1)` | Hover transitions |
