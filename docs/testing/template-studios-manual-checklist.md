# Template Studios Manual Testing Checklist

## TemplateStudio (`src/components/TemplateStudio.js`)

### Hero Section
- [ ] Template thumbnail loads correctly
- [ ] Thumbnail fallback icon displays when image fails to load
- [ ] Template name renders as h1
- [ ] Template description renders below name
- [ ] Output type pill shows "Video" or "Image"
- [ ] Category pill shows template category
- [ ] Core use case pill shows when specs are available

### Form Inputs
- [ ] All template inputs render with correct labels
- [ ] Text inputs accept and display user input
- [ ] Textarea inputs accept multi-line input
- [ ] Select dropdowns show all options and allow selection
- [ ] Image upload area shows "Click to upload an image"
- [ ] Image upload shows checkmark after upload
- [ ] Video upload area shows for video templates
- [ ] Pexels button opens stock image picker
- [ ] Pexels button opens stock video picker for video inputs
- [ ] Frame upload shows "Click to add start & end frames"
- [ ] Uploaded image/video clears when clear button is clicked

### Model Selector
- [ ] Model picker button shows current model name and provider logo
- [ ] Clicking model picker opens dropdown
- [ ] Dropdown shows loading state initially
- [ ] Dropdown populates with models after catalog loads
- [ ] Selecting a model updates the trigger button
- [ ] Dropdown closes on second click
- [ ] Dropdown closes on outside click
- [ ] Escape key closes dropdown
- [ ] Model count shows in footer of dropdown
- [ ] Fallback models show when catalog fails to load

### AI Enhancer
- [ ] AI Enhancer toggle switches on/off
- [ ] Toggle knob animates left/right
- [ ] "Show Advanced Controls" button is visible
- [ ] Clicking shows advanced controls grid
- [ ] Advanced controls show template type, niche, business type, audience, subject, setting, visual style, CTA
- [ ] Clicking "Hide Advanced Controls" hides the grid
- [ ] Enhancer buttons on fields append "cinematic style, professional quality, premium aesthetic"
- [ ] Enhancer button shows "Enhanced ✓" briefly after click

### Output Tabs
- [ ] "Enhanced Prompt" tab is active by default
- [ ] Clicking "Scene Beats" shows scene blueprint
- [ ] Clicking "Voiceover" shows voiceover template
- [ ] Clicking "Negative Prompt" shows negative prompt
- [ ] Wand button enhances current prompt with cinematic terms
- [ ] Wand button shows green border flash after enhancement
- [ ] Editing output textarea updates form state
- [ ] Tab content persists when switching tabs

### Generation
- [ ] Generate button is enabled when form is ready
- [ ] Generate button shows spinner and "Generating..." during generation
- [ ] Generate button is disabled during generation
- [ ] Generation result shows in preview area
- [ ] Result area has aria-live="polite" for accessibility
- [ ] Generation failure shows inline error
- [ ] Inline error auto-dismisses after 5 seconds
- [ ] Retry button appears when generation fails and retries remain
- [ ] Retry button increments retry count and re-runs generation
- [ ] Validation error shows when no prompt is entered
- [ ] Validation error shows when image is required but not uploaded (i2v/i2i)
- [ ] Validation error shows when video is required but not uploaded (v2v)
- [ ] Validation error shows when name is required but not entered (effect models)
- [ ] Model incompatibility shows fallback message and adjusts selection

### Thumbnail Modal
- [ ] Thumbnail button opens modal
- [ ] Modal shows thumbnail generation interface
- [ ] Applying thumbnail updates hero image
- [ ] Clearing thumbnail removes custom thumbnail
- [ ] Thumbnail is cached for subsequent visits

### Navigation
- [ ] Back button navigates to templates page
- [ ] Nav header shows all studio links
- [ ] Studio menu button opens drawer
- [ ] Menu button is visible next to back button

### Creative Intelligence
- [ ] Niche tile shows auto-detected or default niche
- [ ] Scene Structure tile shows scene blueprint
- [ ] Cinematic Enrichment tile shows cinematography terms
- [ ] Visual Style tile shows visual style description
- [ ] Enhancer Keywords tile shows keyword list

### Error States
- [ ] "Template not found" shows for invalid template ID
- [ ] Auth modal opens when API key is missing
- [ ] Inline errors show for validation failures
- [ ] Toast notifications show for async operation failures

## CinemaTemplateStudio (`src/components/CinemaTemplateStudio.js`)

### Browse View
- [ ] Header shows "CINEMATIC TEMPLATES" title
- [ ] Template count displays in header
- [ ] Studio logo displays in header
- [ ] Favorites button shows count when favorites exist
- [ ] Recent button shows count when recent templates exist
- [ ] Custom button shows "My Templates" label
- [ ] Template cards render in grid layout
- [ ] Template cards show thumbnail with fallback icon
- [ ] Template cards show title
- [ ] Template cards show favorite button (heart icon)
- [ ] Template cards show thumbnail button
- [ ] Favorite button toggles between heart and broken heart
- [ ] Thumbnail button opens thumbnail modal
- [ ] Cards have hover effect (background lightens)
- [ ] Cards have border and rounded corners

### Filter Tabs
- [ ] Favorites filter shows only favorited templates
- [ ] Recent filter shows recently used templates
- [ ] Custom filter shows user-created templates
- [ ] Active filter has primary background color
- [ ] Active filter has bold text
- [ ] Switching filters re-renders grid
- [ ] Clear filter button appears when filter is active
- [ ] Clear filter button navigates back to all templates

### Empty States
- [ ] Empty state shows when no favorites exist
- [ ] Empty state shows heart icon
- [ ] Empty state shows "No favorites yet" message
- [ ] Empty state shows "Click the heart on any template to save it here."
- [ ] Empty state shows "Browse All Templates" button
- [ ] Empty state shows when no recent templates exist
- [ ] Empty state shows when no custom templates exist

### Scene Builder
- [ ] Scene builder renders scenes in list
- [ ] Add Scene button creates new scene
- [ ] New scene gets auto-incremented scene number
- [ ] New scene has default beat text
- [ ] New scene has default duration
- [ ] New scene has default shot
- [ ] Delete button removes scene
- [ ] Move up/down buttons reorder scenes
- [ ] Scene timeline re-renders after changes
- [ ] Scene editor opens on edit button click
- [ ] Scene editor shows shot configuration
- [ ] Scene editor saves changes
- [ ] Error toast shows if scene add fails
- [ ] Error toast shows if scene delete fails
- [ ] Error toast shows if scene move fails

### Model Selector
- [ ] Model selector shows for video templates
- [ ] Model selector shows loading state
- [ ] Model selector populates with available models
- [ ] Selecting model updates generation params
- [ ] Model selector closes on outside click
- [ ] Model selector closes on Escape key

### Generation
- [ ] Generate button validates required fields
- [ ] Generate button shows spinner during generation
- [ ] Generation result shows in output area
- [ ] Video intent resets after generation
- [ ] Generation history saves successful generations
- [ ] Error toast shows on generation failure

### Storyboard Integration
- [ ] Storyboard banner shows when storyboard is loaded
- [ ] Storyboard shows project name and frame count
- [ ] Clear button removes storyboard
- [ ] "Storyboard applied to template" toast shows on apply
- [ ] Scenes populate from storyboard frames
- [ ] Scene numbers map from storyboard frame numbers

### Navigation
- [ ] Back button navigates to previous view
- [ ] Studio menu button opens all-studios drawer
- [ ] Menu button appears next to back button in all views

## Cross-Browser / Responsive
- [ ] Layout works on desktop (1920x1080)
- [ ] Layout works on laptop (1366x768)
- [ ] Layout works on tablet (768x1024)
- [ ] Touch targets are at least 44x44px
- [ ] Text is readable at all screen sizes
- [ ] No horizontal scroll on any viewport
- [ ] Dropdowns and modals work on mobile

## Accessibility
- [ ] All buttons have aria-labels
- [ ] Model selector has aria-haspopup and aria-expanded
- [ ] Result area has role="status" and aria-live="polite"
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA standards

## Performance
- [ ] Initial render completes in < 2 seconds
- [ ] Model catalog loads in < 5 seconds
- [ ] Dropdown opens in < 100ms
- [ ] Tab switching is instant
- [ ] No layout shift during loading
- [ ] Memory usage stays stable during extended use

## Network / Offline
- [ ] Graceful degradation when model catalog is unreachable
- [ ] Fallback models display when catalog fails
- [ ] Retry works after network recovery
- [ ] Offline state shows appropriate message

## Edge Cases
- [ ] Very long template names truncate correctly
- [ ] Very long prompts handle gracefully
- [ ] Empty template list shows empty state
- [ ] Rapid clicking doesn't break state
- [ ] Concurrent generations are blocked
- [ ] Browser back button works correctly
- [ ] Page refresh preserves state where appropriate
