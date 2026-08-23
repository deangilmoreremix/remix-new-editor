# Studio Demo Automation Framework

A comprehensive Playwright-based framework for automated product demonstrations with video recording across multiple studio environments.

## Features

- **Multi-Studio Navigation**: Automatically iterate through configured studio URLs
- **Video Recording**: Built-in Playwright video capture per studio session
- **Resilient Selectors**: Multi-strategy element location with retry logic
- **Feature Validation**: Automated checks to verify UI functionality
- **Reporting**: Detailed HTML/JSON/Markdown reports with screenshots
- **Parallel Execution**: Optional parallel demo runs with concurrency control
- **Network Validation**: Monitor and assert API calls during demos
- **Shadow DOM Support**: Piercing strategies for web components
- **Authentication Handling**: Built-in login flow support

## Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# (Optional) Install FFmpeg for MP4 conversion
brew install ffmpeg  # macOS
# or: npm install ffmpeg-static
```

## Configuration

### 1. Define Your Studios

Edit `STUDIO_CONFIGS` in `studio-demo.ts`:

```typescript
export const STUDIO_CONFIGS: StudioConfig[] = [
  {
    id: 'studio-alpha',
    name: 'Studio Alpha',
    url: 'https://your-app.com/studios/alpha',
    features: [
      {
        name: 'Load Dashboard',
        description: 'Open the main dashboard',
        action: { type: 'waitForSelector', selector: '.dashboard' },
        validate: [
          { type: 'visible', selector: '.dashboard', description: 'Dashboard is visible' }
        ]
      },
      // Add more features...
    ]
  }
];
```

### 2. Configure Playwright

Edit `playwright.config.ts`:

```typescript
export default defineConfig({
  use: {
    baseURL: 'https://your-app.com',
    video: 'on', // Enable video recording
    viewport: { width: 1920, height: 1080 },
  },
});
```

## Usage

### Run All Studios

```bash
npx playwright test
```

### Run with UI Mode

```bash
npx playwright test --ui
```

### Run Single Studio

```bash
TEST_STUDIO_ID=studio-alpha npx playwright test
```

### Convert Videos to MP4

```bash
VIDEO_CONVERT=true npx playwright test
```

### Debug Mode

```bash
npx playwright test --debug
```

## Architecture

```
studio-demo/
├── studio-demo.ts          # Core framework (orchestrator, validators, video)
├── studio-demo.spec.ts     # Test suite entry point
├── playwright.config.ts    # Playwright configuration
└── studios.config.json     # Studio definitions (optional)
```

## Key Components

### StudioDemoOrchestrator
Main execution engine that coordinates navigation, feature interaction, and validation for each studio.

### ElementInteractionEngine
Provides resilient element selection with fallback strategies:
- `data-testid` (preferred)
- `aria-label`
- Role-based selectors
- Custom selectors

### ValidationEngine
Runs post-interaction checks:
- Visibility assertions
- URL validation
- Text content verification
- Attribute checks

### VideoRecorder
Manages video output:
- Unique file naming per studio
- WebM recording (native Playwright)
- Optional FFmpeg conversion to MP4
- Screenshot capture on failure

### NetworkValidator
Monitors API calls during demos and asserts expected requests were made.

## Video Recording Strategy

Playwright's built-in video recording is used by default:

```typescript
const videoRecorder = new VideoRecorder('./test-results/videos');

// Get unique path for a studio
const videoPath = videoRecorder.getVideoPath('studio-alpha');

// Configure context for recording
const contextOptions = videoRecorder.getContextOptions(videoPath);
// { recordVideo: { dir: './test-results/videos', size: { width: 1920, height: 1080 } } }
```

### Post-Processing (Optional)

```bash
# Convert all WebM files to MP4
VIDEO_CONVERT=true npx playwright test
```

Uses FFmpeg:
```bash
ffmpeg -i input.webm -c:v libx264 -preset fast -crf 23 output.mp4
```

## Handling Dynamic UI Elements

The framework uses multiple strategies:

1. **Wait for Stability**: Elements are waited on until they have non-zero dimensions
2. **Selector Fallbacks**: If `data-testid` fails, tries `aria-label`, then role-based
3. **Shadow DOM Piercing**: Supports `>>>` syntax for web components
4. **Auto-Retry**: Failed interactions are retried with alternative selectors

```typescript
// Automatically tries multiple selectors
await interactionEngine.clickWithFallback('submit-button');

// With custom strategies
await interactionEngine.clickWithFallback('submit', {
  customSelectors: ['button[type="submit"]', '#submit-btn']
});
```

## Example: Complete Feature Definition

```typescript
{
  name: 'Create New Project',
  description: 'Demonstrates project creation workflow',
  action: {
    type: 'click',
    selector: '[data-testid="new-project-btn"]',
    options: { delay: 200 }
  },
  waitForSelector: '[data-testid="project-modal"]',
  screenshot: true,
  validate: [
    { type: 'visible', selector: '[data-testid="project-modal"]', description: 'Modal appeared' },
    { type: 'text', selector: 'h2', expected: 'New Project', description: 'Correct modal title' }
  ]
}
```

## Output Structure

```
test-results/
├── videos/
│   ├── studio-demo-studio-alpha-1234567890.webm
│   └── studio-demo-studio-beta-1234567890.webm
├── screenshots/
│   ├── studio-alpha-load-dashboard-1234567890.png
│   └── error-studio-beta-create-project-1234567890.png
├── html-report/
├── demo-report-1234567890.md
└── results.json
```

## Best Practices

1. **Use data-testid attributes**: They're the most stable selectors
2. **Add validation to every feature**: Ensures demos catch regressions
3. **Capture screenshots on failure**: Aids debugging
4. **Keep feature descriptions clear**: They appear in reports
5. **Limit parallelism**: Video recording is resource-intensive
6. **Set appropriate timeouts**: Network-heavy apps need longer waits

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Studio Demos
  run: npx playwright test

- name: Upload Videos
  uses: actions/upload-artifact@v4
  with:
    name: studio-demo-videos
    path: test-results/videos/*.webm

- name: Upload Report
  uses: actions/upload-artifact@v4
  with:
    name: demo-report
    path: test-results/demo-report-*.md
```

## Troubleshooting

### Video Files Not Created
- Ensure `video: 'on'` is set in `playwright.config.ts`
- Check disk space (videos are ~10-50MB each)

### Elements Not Found
- Add `data-testid` attributes to your app
- Increase `defaultTimeout` in `ElementInteractionEngine`
- Use `--debug` mode to inspect selectors

### Videos Corrupted
- Run tests sequentially: `workers: 1` in config
- Ensure sufficient memory (8GB+ recommended)

## Advanced: Custom Actions

```typescript
{
  name: 'Custom Interaction',
  description: 'Any custom logic',
  action: {
    type: 'custom',
    handler: async (page) => {
      // Your custom Playwright code
      await page.evaluate(() => {
        window.dispatchEvent(new Event('custom-event'));
      });
    }
  }
}
```

## Advanced: Network Monitoring

```typescript
const validator = new NetworkValidator(page);
await validator.monitorPatterns(['/api/projects/**', '/api/users/**']);

// ... after interactions ...

validator.assertCalled('/api/projects', 1); // Assert called at least once
```

## License

MIT
