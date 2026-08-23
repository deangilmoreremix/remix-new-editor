# Studio Demo Documentation

## Purpose

This document defines the demo recording requirements for all 46 studios in the SmartVid application. It is used by the Playwright demo automation framework to generate real usage demonstration videos.

## Framework Current State

### What Works
- Navigates to all 46 studios via `http://localhost:3100/?dev#/{route}`
- Records a `.webm` video per studio under `test-results/videos/`
- Captures screenshots on success and error
- Continues to next studio after failures
- Enterprise layer adds cinematic camera movements and storyboard playback

### What Is Missing
- Real input selectors for prompts, dropdowns, and uploads
- Real action selectors for generate/create/run/submit buttons
- Real result selectors for previews, outputs, downloads
- Studio-specific happy-path flows
- Success validators that confirm actual results were produced

## Documentation Structure

Each studio entry below contains:
- **Route**: The hash route used in the app
- **Studio Name**: Human-readable name
- **Component File**: Source file path
- **Happy Path**: The minimal sequence to show real usage
- **Selectors**: Real selectors extracted from the component DOM
- **Success Indicator**: What proves the studio produced a result
- **Status**: `placeholder` | `partial` | `complete`

## Selector Priority

The framework uses the following selector priority:
1. `data-testid` attributes (most stable)
2. `id` attributes (stable)
3. `aria-label` attributes (semantic, stable)
4. Role-based selectors (`role="button"`, `role="textbox"`, etc.)
5. CSS class selectors (fallback, may change)

## Studios

### Home / Navigation

| Route | Studio Name | Component File | Happy Path | Selectors | Success Indicator | Status |
|-------|-------------|----------------|------------|-----------|-------------------|--------|
| `apps` | Apps Hub | `src/components/AppsHub.js` | Open hub, verify studio cards load | Search input: `input` inside `.w-full.max-w-md.bg-white\\/5`; Studio cards: `.studio-card` or `.bg-\\[\\#111\\]\\/90.backdrop-blur-xl` | Studio cards visible | `partial` |
| `explore` | Explore | `src/components/ExplorePage.js` | Open explore, verify content feed | Template cards: `.bg-\\[\\#111\\]\\/90.backdrop-blur-xl`; Try buttons: `.try-btn` | Content cards visible | `placeholder` |
| `templates` | Templates | `src/components/TemplatesPage.js` | Open templates, verify template list | Search input: `input` inside `.w-full.max-w-md.bg-white\\/5`; Filter chips: `button.px-4.py-2.rounded-full`; Template cards: `.bg-\\[\\#111\\]\\/90.backdrop-blur-xl` | Template grid visible | `placeholder` |
| `library` | Library | `src/components/LibraryPage.js` | Open library, verify media library | Filter buttons: `button.px-4.py-2.rounded-full`; Search input: `input.ml-auto.bg-white\\/5`; Preview overlay: `.previewOverlay` | Media items visible | `placeholder` |
| `content-library` | Content Library | `src/components/ContentLibraryPage.js` | Open content library, verify assets | Upload button: `button.px-4.py-2.rounded-xl`; Pexels browse: `button`; Filter tabs: `button` | Asset grid visible | `placeholder` |
| `community` | Community | `src/components/CommunityPage.js` | Open community, verify posts feed | Community cards: `.bg-\\[\\#111\\]\\/90.backdrop-blur-xl` | Posts visible | `placeholder` |

### Create Studios

| Route | Studio Name | Component File | Happy Path | Selectors | Success Indicator | Status |
|-------|-------------|----------------|------------|-----------|-------------------|--------|
| `image` | Image Studio | `src/components/ImageStudio.js` | Enter prompt → click generate → wait for result | Prompt textarea: `#prompt-textarea`; Generate button: `button.btn-primary-modern` or `[aria-label="Generate"]`; Result area: `.backdrop-blur-xl` panel after generate | Result image appears | `partial` |
| `video` | Video Studio | `src/components/VideoStudio.js` | Enter prompt → click generate → wait for preview | Prompt textarea: `#v-prompt-textarea`; Generate button: `button.btn-primary-modern`; Result area: `.backdrop-blur-xl` panel | Video preview visible | `partial` |
| `cinema` | Cinema Studio | `src/components/CinemaStudio.js` | Enter prompt → click generate → wait for result | Prompt textarea: `textarea` inside `.bg-black` container; Generate button: `button.btn-primary-modern`; Result area: `.backdrop-blur-xl` panel | Result video visible | `partial` |
| `cinema-template` | Cinema Template Studio | `src/components/CinemaTemplateStudio.js` | Select template → customize → generate → wait for output | Prompt textarea: `textarea`; Generate button: `button.btn-primary-modern`; Preview area: `#previewArea` | Output video visible | `partial` |
| `storyboard` | Storyboard Studio | `src/components/StoryboardStudio.js` | Enter frame description → generate frame → verify frames | Prompt textarea: `textarea[aria-label="Frame description"]`; Generate frame: `button[aria-label="Generate frame"]`; Generate all: `button[aria-label="Generate all frames"]`; Frame grid: `.backdrop-blur-xl` panel | Frame generated | `partial` |
| `effects` | Effects Studio | `src/components/EffectsStudio.js` | Enter effect prompt → apply effect → wait for preview | Prompt textarea: `#fx-prompt-input`; Apply button: `button[aria-label="Apply effect"]`; Seed input: `#seed-input`; Negative prompt: `textarea[aria-label="Negative prompt"]` | Effect preview visible | `partial` |
| `edit` | Edit Studio | `src/components/EditStudio.js` | Upload image → enter prompt → generate → wait for result | Image upload: `input[type="file"]` or upload button; Prompt textarea: `textarea[aria-label="Edit prompt"]`; Generate button: `button.btn-primary-modern` | Result image visible | `partial` |
| `upscale` | Upscale Studio | `src/components/UpscaleStudio.js` | Upload image → select factor → upscale → wait for result | Image upload: `input[type="file"]` or upload button; Factor buttons: `button.flex.gap-2`; Upscale button: `button.btn-primary-modern` | Upscaled image visible | `partial` |
| `character` | Character Studio | `src/components/CharacterStudio.js` | Enter prompt → upload reference → generate → verify avatar | Prompt textarea: `#character-prompt-input`; Reference upload: `input[type="file"]`; Generate button: `button.btn-primary-modern` | Avatar result visible | `partial` |
| `commercial` | Commercial Studio | `src/components/CommercialStudio.js` | Enter prompt → upload product → generate → wait for ad preview | Prompt textarea: `textarea`; Product upload: `input[type="file"]`; Generate button: `button.btn-primary-modern` | Ad preview visible | `partial` |
| `audio` | Audio Studio | `src/components/AudioStudio.js` | Enter script → select voice → generate → wait for audio player | Script textarea: `textarea`; Voice selector: trigger button; Generate button: `button.btn-primary-modern`; Audio player: `.audio-player` or audio element | Audio player visible | `partial` |
| `avatar` | Avatar Studio | `src/components/AvatarStudio.js` | Select model → upload image/audio → generate → verify avatar | Model selector: trigger button; Image upload: `input[type="file"]`; Audio upload: `input[type="file"]`; Generate button: `button.btn-primary-modern` | Avatar video visible | `partial` |
| `training` | Training Studio | `src/components/TrainingStudio.js` | Enter LoRA name → upload images → start training → monitor progress | LoRA name input: `input`; Trigger word input: `input`; Epochs input: `input`; Image upload: `input[type="file"]`; Train button: `button[aria-label="Train LoRA"]` | Training progress visible | `partial` |
| `videotools` | Video Tools Studio | `src/components/VideoToolsStudio.js` | Select tool → upload video → configure → process → wait for output | Video upload: `input[type="file"]`; Prompt textarea: `textarea`; Process button: `button.btn-primary-modern`; Download link: `a[download]` | Output video visible | `partial` |
| `chat` | Chat Studio | `src/components/chat/ChatStudio.jsx` | Enter message → send → wait for AI response → verify message | Chat input: `textarea[aria-label="Message"]`; Send button: `button[aria-label="Send message"]`; Message list: `.chat-messages`; AI response: `.chat-message.ai-response` or last `.chat-message` | AI response visible | `partial` |
| `lipsync` | Lip Sync Studio | `src/components/LipSyncStudio.js` | Select mode → upload video/audio → sync → wait for processed video | Mode toggle: `#imageModeBtn` or `#videoModeBtn`; Video upload: `#imageUploadBtn` or file input; Audio upload: file input; Generate button: `button.btn-primary-modern` | Processed video visible | `partial` |
| `influencer` | Influencer Studio | `src/components/InfluencerStudio.js` | Select style → upload photo → enter prompt → generate → verify output | Style presets: `button`; Prompt textarea: `textarea[aria-label="Influencer prompt"]`; Generate button: `button[aria-label="Generate content"]`; Model picker: `button[aria-label="Open model picker"]` | Output image visible | `partial` |
| `viral` | Smart Video Viral | `src/components/SmartVideoViral.js` | Browse prompts → select → play → verify modal | Prompt cards: `.smart-card`; Rail items: `.viral-rail-item`; Play toggle: `button[aria-label="Play video"]`; Modal: `.viral-modal-panel` | Video modal opens | `partial` |

### Generate Studios (Landing Pages → Navigate to Studio)

| Route | Studio Name | Component File | Happy Path | Selectors | Success Indicator | Status |
|-------|-------------|----------------|------------|-----------|-------------------|--------|
| `text-to-image` | Text to Image | `src/components/TextToImagePage.js` | Browse models → click Start → navigate to Image Studio | Model cards: `.model-card`; Start button: `.start-btn` or `.cta-btn` | Navigate to `/image` | `partial` |
| `image-to-image` | Image to Image | `src/components/ImageToImagePage.js` | Browse models → click Start → navigate to Edit Studio | Model cards: `.model-card`; Start button: `.start-btn` or `.cta-btn` | Navigate to `/edit` | `partial` |
| `text-to-video` | Text to Video | `src/components/TextToVideoPage.js` | Browse models → click Start → navigate to Video Studio | Model cards: `.model-card`; Start button: `.start-btn` or `.cta-btn` | Navigate to `/video` | `partial` |
| `image-to-video` | Image to Video | `src/components/ImageToVideoPage.js` | Browse models → click Start → navigate to Video Studio | Model cards: `.model-card`; Start button: `.start-btn` or `.cta-btn`; GTM boost: `button[aria-label="GTM Boost prompt enhancer"]` | Navigate to `/video` | `partial` |
| `video-to-video` | Video to Video | `src/components/VideoToVideoPage.js` | Browse info → click CTA → navigate to Video Studio | Model cards: `.model-card`; CTA button: `.cta-btn`; Video picker: `#videoPickerBtn` | Navigate to `/video` | `partial` |
| `video-watermark` | Video Watermark | `src/components/VideoWatermarkPage.js` | Browse tools → click Start → navigate to Video Studio | Tool cards: `.model-card`; Start button: `.start-btn` or `.cta-btn` | Navigate to `/video` | `partial` |

### Page Studios (Landing Pages → Navigate to Studio)

| Route | Studio Name | Component File | Happy Path | Selectors | Success Indicator | Status |
|-------|-------------|----------------|------------|-----------|-------------------|--------|
| `character-page` | Character Page | `src/components/CharacterPage.js` | Browse models → click Start → navigate to Character Studio | Model cards: `.model-card`; Start button: `.start-btn` or `.cta-btn` | Navigate to `/character` | `partial` |
| `effects-page` | Effects Page | `src/components/EffectsPage.js` | Browse effects → click Start → navigate to Effects Studio | Effect tabs: `button`; Effect cards: `.effect-card`; Start button: `.start-btn` or `.cta-btn` | Navigate to `/effects` | `partial` |
| `storyboard-page` | Storyboard Page | `src/components/StoryboardPage.js` | Browse prompts → click Start → navigate to Storyboard Studio | Prompt cards: `.prompt-card`; Start button: `.start-btn` or `.cta-btn` | Navigate to `/storyboard` | `partial` |
| `influencer-page` | Influencer Page | `src/components/InfluencerPage.js` | Browse styles → click Start → navigate to Influencer Studio | Style chips: `button`; Format cards: `.format-card`; Start button: `.start-btn` or `.cta-btn` | Navigate to `/influencer` | `partial` |
| `commercial-page` | Commercial Page | `src/components/CommercialPage.js` | Browse presets → click Start → navigate to Commercial Studio | Scene chips: `button`; Format cards: `.format-card`; Start button: `.start-btn` or `.cta-btn` | Navigate to `/commercial` | `partial` |
| `upscale-page` | Upscale Page | `src/components/UpscalePage.js` | Browse methods → click Start → navigate to Upscale Studio | Method cards: `.method-card`; Factor cards: `.factor-card`; Start button: `.start-btn` or `.cta-btn` | Navigate to `/upscale` | `partial` |

### Tools / Utilities

| Route | Studio Name | Component File | Happy Path | Selectors | Success Indicator | Status |
|-------|-------------|----------------|------------|-----------|-------------------|--------|
| `video-agent` | Video Agent | `src/components/VideoAgentPage.js` | Upload video → select agent → run → wait for results | Agent cards: `.agent-btn[data-agent]`; Suggestion chips: `.agent-suggestion-chip`; Results panel: `#results-panel` | Results panel populated | `partial` |
| `director` | Director | `src/components/DirectorPage.js` | Select category → enter command → send → wait for response | Category filter: `#category-filter`; Command input: `#command-input`; Send button: `#send-command-btn`; Agent cards: `.agent-btn[data-agent]`; Chat messages: `#chat-messages` | AI response visible | `complete` |
| `ai-vfx` | AI VFX | `src/components/AIVFXPage.js` | Load page → verify iframe loads | Iframe: `iframe[src*="/ai-vfx/"]` | Iframe visible | `partial` |
| `render` | Render | `src/components/RenderPage.js` | Open page → verify action tiles and result area | Action tiles: `.action-btn` or `button.w-full.p-3`; Result preview: `#result-preview` | Result preview area visible | `placeholder` |
| `timeline` | Timeline Editor | `src/components/TimelineEditorPage.jsx` | Upload media → verify timeline loads | File input: `#uploadInput` or `[data-testid="file-input"]`; Timeline container: `#timeline-container` or `[data-testid="timeline-container"]`; Play button: `#tbPlay`; Tracks: `[data-testid="timeline-track"]` | Timeline container visible | `complete` |
| `assist` | Assist | `src/components/AssistPage.js` | Enter prompt → verify enhanced output | Base textarea: `textarea.w-full.bg-white\\/5`; Copy button: `button.px-5.py-2.5.bg-white\\/10`; Output area: `.bg-white\\/5.border` | Output area populated | `partial` |
| `pexels-media` | Stock Media | Browser/Iframe | Open page → search media → verify results | Search input: `input`; Media results: `.media-result` or grid items | Media grid visible | `placeholder` |
| `academy` | Academy | `src/components/academy/AcademyPage.jsx` | Navigate academy → verify tracks/lessons load | Track cards: `.rounded-2xl.border`; Lesson content: `.lesson-content` | Academy content visible | `placeholder` |
| `studios/product-photo-studio` | Product Photo Studio | `src/components/studios/ProductPhotoStudio.jsx` | Open page → verify placeholder | Placeholder card: `.rounded-2xl.border.border-white\\/10.bg-white\\/\\[0\\.03\\]` | Placeholder visible | `placeholder` |
| `studios/fashion-studio` | Fashion Studio | `src/components/studios/FashionStudio.jsx` | Open page → verify placeholder | Placeholder card: `.rounded-2xl.border.border-white\\/10.bg-white\\/\\[0\\.03\\]` | Placeholder visible | `placeholder` |

## Implementation Notes

### Selector Strategy
The framework uses the following selector priority:
1. `data-testid` attributes (preferred, most stable)
2. `id` attributes (stable)
3. `aria-label` attributes (semantic, stable)
4. Role-based selectors (`role="button"`, `role="textbox"`, etc.)
5. CSS class selectors (fallback, may change)

### Adding a New Studio Demo Flow

1. Open `tests/studio-demo/studio-demo.ts`
2. Find the studio in `STUDIO_ROUTES` or add it
3. Update the generated `features` array for that studio with real actions

Example for Image Studio:
```typescript
{
  id: 'studio-image',
  name: 'Image Studio',
  url: 'http://localhost:3100/?dev#/image',
  expectedTitle: 'SmartVid',
  features: [
    {
      name: 'Load Image Studio',
      description: 'Navigate to image studio and verify it loads',
      action: { type: 'waitForSelector', selector: '#prompt-textarea', state: 'visible' },
      validate: [
        { type: 'visible', selector: '#prompt-textarea', description: 'Prompt input is visible' }
      ]
    },
    {
      name: 'Enter Prompt',
      description: 'Type a demo prompt into the image generator',
      action: {
        type: 'fill',
        selector: '#prompt-textarea',
        value: 'A beautiful sunset over the ocean'
      },
      validate: [
        { type: 'visible', selector: '#prompt-textarea', description: 'Prompt input filled' }
      ]
    },
    {
      name: 'Generate Image',
      description: 'Click generate and wait for result',
      action: {
        type: 'click',
        selector: 'button.btn-primary-modern',
        options: { timeout: 30000 }
      },
      validate: [
        { type: 'visible', selector: '.backdrop-blur-xl', description: 'Result area visible' }
      ]
    }
  ]
}
```

### Testing Selectors

Before adding a selector to the framework, verify it in the browser:
```bash
# Open the app
cd /Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor
npm run dev

# Or use Playwright debug mode
cd tests/studio-demo
npx playwright test --debug
```

### Video Recording

- Each studio records a `.webm` file to `test-results/videos/`
- Videos are named: `studio-demo-{studio-id}-{timestamp}.webm`
- Enterprise tests may also produce files in `test-results/cinematic/`
- Convert to MP4 with: `VIDEO_CONVERT=true npx playwright test`

## Current Placeholder Selectors in Code

The following files still contain placeholder selectors that need real values:

| File | Lines | Placeholder | Needed |
|------|-------|-------------|--------|
| `studio-demo.ts` | 89-128 | Generic `body`/`main` waits | Real feature actions and validators per studio |
| `enterprise/enterprise-demo.spec.ts` | 31-56 | `example.com`, generic selectors | Real studio URLs and selectors |
| `enterprise/enterprise-demo.spec.ts` | 366-401 | `h1`, `p` close-ups | Real feature selectors |
| `README.md` | 42, 65 | `your-app.com` | Real app URLs |

## Next Steps

1. **Identify priority studios**: Choose 3-5 studios to implement first (recommended: `image`, `video`, `cinema`, `chat`, `timeline`)
2. **Extract selectors**: Inspect the app DOM for each priority studio using the inventory above
3. **Define happy paths**: Document the minimal usage flow for each
4. **Update STUDIO_ROUTES**: Replace generic waits with real actions and validators
5. **Run and verify**: Execute the demo suite and review videos
6. **Iterate**: Add remaining studios once the pattern is established

## Appendix: Full Studio Route List

```
apps
explore
templates
library
content-library
community
image
video
cinema
cinema-template
storyboard
effects
edit
upscale
character
commercial
audio
avatar
training
videotools
chat
lipsync
influencer
viral
video-agent
director
ai-vfx
render
timeline
assist
pexels-media
academy
text-to-image
image-to-image
text-to-video
image-to-video
video-to-video
video-watermark
character-page
effects-page
storyboard-page
influencer-page
commercial-page
upscale-page
studios/product-photo-studio
studios/fashion-studio
```

Total: 46 studios
