# ExampleGallery — YouMind-Inspired Redesign Plan

## Reference
- https://youmind.com/prompts/video

## Core Design Patterns to Adopt

### 1. Layout
- **Grid, not horizontal rail**: YouMind uses a responsive grid of prompt cards. This is scannable, works on all screen sizes, and avoids cramped horizontal scrolling.
- **Card anatomy**: Thumbnail → title → author → tags → actions
- **Section header**: Clean title + count + optional subtitle
- **Filter tabs**: Horizontal filter chips above the grid

### 2. Card Design
- **Thumbnail**: Dominant, ~16:9 aspect ratio, rounded corners
- **Title**: 1-2 lines, bold, clear hierarchy
- **Author**: Small, muted, with optional avatar/icon
- **Tags**: Small pills with subtle borders, not loud badges
- **Hover**: Subtle lift + border color change + shadow

### 3. Color & Typography
- Clean dark background
- White text for titles, muted for secondary
- Accent color for interactive elements
- Consistent border radius (12-16px)

### 4. Interactions
- Hover reveals or emphasizes actions
- Smooth transitions
- No jarring movements

## Our Implementation Plan

### Phase 1: Grid Layout
- Replace horizontal scroll rail with CSS Grid
- Responsive: 4 columns desktop, 2 tablet, 1 mobile
- Keep section wrapper with header

### Phase 2: Card Redesign
- Larger thumbnails (16:9 ratio)
- Title + optional subtitle
- Author/source line
- Tag pills instead of loud badges
- Actions: icon buttons or text links

### Phase 3: Filter Bar
- Horizontal scrollable filter chips
- Extract unique tags from filtered assets
- Active state with accent color

### Phase 4: Polish
- Smooth hover transitions
- Loading states for images
- Empty state with illustration
- Consistent spacing

## Files to Change
1. `src/styles/example-gallery.css` — Complete rewrite with grid layout
2. `src/components/studios/ExampleGallery.js` — Rewrite for grid cards
3. `src/test/example-gallery.test.js` — Update assertions for new DOM
