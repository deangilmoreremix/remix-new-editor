# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: studio-screenshots.spec.js >> Studio Screenshot Capture >> captures screenshots for all side menu studios
- Location: tests/e2e/studio-screenshots.spec.js:113:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-studio-back]') to be visible

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - img [ref=e8] [cursor=pointer]
        - navigation [ref=e12]:
          - generic [ref=e13] [cursor=pointer]: Explore
          - generic [ref=e14] [cursor=pointer]: Image
          - generic [ref=e15] [cursor=pointer]: Video
          - generic [ref=e16] [cursor=pointer]: Tools
          - generic [ref=e17] [cursor=pointer]: Storyboard
          - generic [ref=e18] [cursor=pointer]: Edit
          - generic [ref=e19] [cursor=pointer]: Character
          - generic [ref=e20] [cursor=pointer]: Vibe Motion
          - generic [ref=e21] [cursor=pointer]: Cinema Studio
          - generic [ref=e22] [cursor=pointer]: Cinema Template Studio
          - generic [ref=e23] [cursor=pointer]: AI Influencer
          - generic [ref=e24] [cursor=pointer]: Smart Video Viral
          - generic [ref=e25] [cursor=pointer]: Apps
          - generic [ref=e26] [cursor=pointer]: Templates
          - generic [ref=e27] [cursor=pointer]: Assist
          - generic [ref=e28] [cursor=pointer]: Community
          - generic [ref=e29] [cursor=pointer]: Content Library
      - generic [ref=e30]:
        - button "Update API Key" [ref=e31]:
          - img [ref=e32]
        - link "Sign In" [ref=e35] [cursor=pointer]:
          - /url: /signin
  - generic [ref=e36]:
    - complementary [ref=e37]:
      - generic [ref=e38]:
        - generic [ref=e39] [cursor=pointer]:
          - button [ref=e40]:
            - img [ref=e41]
          - generic [ref=e46]: Apps
        - generic [ref=e47] [cursor=pointer]:
          - button [ref=e48]:
            - img [ref=e49]
          - generic [ref=e53]: Image
        - generic [ref=e54] [cursor=pointer]:
          - button [ref=e55]:
            - img [ref=e56]
          - generic [ref=e59]: Video
        - generic [ref=e60] [cursor=pointer]:
          - button [ref=e61]:
            - img [ref=e62]
          - generic [ref=e64]: Cinema Studio
        - generic [ref=e65] [cursor=pointer]:
          - button [ref=e66]:
            - img [ref=e67]
          - generic [ref=e69]: Cinema Template Studio
        - generic [ref=e70] [cursor=pointer]:
          - button [ref=e71]:
            - img [ref=e72]
          - generic [ref=e79]: Storyboard
        - generic [ref=e80] [cursor=pointer]:
          - button [ref=e81]:
            - img [ref=e82]
          - generic [ref=e84]: Effects
        - generic [ref=e85] [cursor=pointer]:
          - button [ref=e86]:
            - img [ref=e87]
          - generic [ref=e90]: Edit
        - generic [ref=e91] [cursor=pointer]:
          - button [ref=e92]:
            - img [ref=e93]
          - generic [ref=e98]: Upscale
        - generic [ref=e99] [cursor=pointer]:
          - button [ref=e100]:
            - img [ref=e101]
          - generic [ref=e105]: Audio
        - generic [ref=e106] [cursor=pointer]:
          - button [ref=e107]:
            - img [ref=e108]
          - generic [ref=e112]: Avatar
        - generic [ref=e113] [cursor=pointer]:
          - button [ref=e114]:
            - img [ref=e115]
          - generic [ref=e119]: Training
        - generic [ref=e120] [cursor=pointer]:
          - button [ref=e121]:
            - img [ref=e122]
          - generic [ref=e125]: Smart Video Academy
        - generic [ref=e126] [cursor=pointer]:
          - button [ref=e127]:
            - img [ref=e128]
          - generic [ref=e132]: Smart Video Viral
        - generic [ref=e133] [cursor=pointer]:
          - button [ref=e134]:
            - img [ref=e135]
          - generic [ref=e138]: Video Tools
        - generic [ref=e139] [cursor=pointer]:
          - button [ref=e140]:
            - img [ref=e141]
          - generic [ref=e143]: Render
        - generic [ref=e144] [cursor=pointer]:
          - button [ref=e145]:
            - img [ref=e146]
          - generic [ref=e150]: Video Agent
        - generic [ref=e151] [cursor=pointer]:
          - button [ref=e152]:
            - img [ref=e153]
          - generic [ref=e156]: Director
        - generic [ref=e157] [cursor=pointer]:
          - button [ref=e158]:
            - img [ref=e159]
          - generic [ref=e164]: Timeline
        - generic [ref=e165] [cursor=pointer]:
          - button [ref=e166]:
            - img [ref=e167]
          - generic [ref=e169]: Chat
        - generic [ref=e170] [cursor=pointer]:
          - button [ref=e171]:
            - img [ref=e172]
          - generic [ref=e175]: Commercial
        - generic [ref=e176] [cursor=pointer]:
          - button [ref=e177]:
            - img [ref=e178]
          - generic [ref=e180]: Templates
        - generic [ref=e181] [cursor=pointer]:
          - button [ref=e182]:
            - img [ref=e183]
          - generic [ref=e186]: Explore
        - generic [ref=e187] [cursor=pointer]:
          - button [ref=e188]:
            - img [ref=e189]
          - generic [ref=e192]: Library
        - generic [ref=e193] [cursor=pointer]:
          - button [ref=e194]:
            - img [ref=e195]
          - generic [ref=e197]: Content
        - generic [ref=e198] [cursor=pointer]:
          - button [ref=e199]:
            - img [ref=e200]
          - generic [ref=e205]: Community
        - generic [ref=e206] [cursor=pointer]:
          - button [ref=e207]:
            - img [ref=e208]
          - generic [ref=e212]: Assist
        - generic [ref=e213] [cursor=pointer]:
          - button [ref=e214]:
            - img [ref=e215]
          - generic [ref=e218]: Commits (0)
        - generic [ref=e219] [cursor=pointer]:
          - button [ref=e220]:
            - img [ref=e221]
          - generic [ref=e224]: AI VFX
        - generic [ref=e225] [cursor=pointer]:
          - button [ref=e226]:
            - img [ref=e227]
          - generic [ref=e230]: Stock Media
      - generic [ref=e232] [cursor=pointer]:
        - button [ref=e233]:
          - img [ref=e234]
        - generic [ref=e237]: Settings
    - main [ref=e238]:
      - generic [ref=e240]:
        - generic [ref=e241]:
          - heading "Apps" [level=1] [ref=e242]
          - paragraph [ref=e243]: All creative tools in one place. Studios, effects, templates, and more.
        - textbox "Search tools and templates..." [ref=e245]
        - generic [ref=e246]:
          - heading "Core Studios 3" [level=2] [ref=e247]:
            - text: Core Studios
            - generic [ref=e248]: "3"
          - generic [ref=e249]:
            - button "Image Studio Image Studio Generate images with 20+ AI models 20+ models" [ref=e250] [cursor=pointer]:
              - img "Image Studio" [ref=e252]
              - generic [ref=e253]:
                - generic [ref=e254]:
                  - img [ref=e256]
                  - generic [ref=e260]:
                    - generic [ref=e261]: Image Studio
                    - generic [ref=e262]: Generate images with 20+ AI models
                - generic [ref=e263]: 20+ models
            - button "Video Studio Video Studio Create AI videos from text and images 15+ models" [ref=e264] [cursor=pointer]:
              - img "Video Studio" [ref=e266]
              - generic [ref=e267]:
                - generic [ref=e268]:
                  - img [ref=e270]
                  - generic [ref=e273]:
                    - generic [ref=e274]: Video Studio
                    - generic [ref=e275]: Create AI videos from text and images
                - generic [ref=e276]: 15+ models
            - button "Cinema Studio Cinema Studio Cinematic shots with camera controls 6 cameras" [ref=e277] [cursor=pointer]:
              - img "Cinema Studio" [ref=e279]
              - generic [ref=e280]:
                - generic [ref=e281]:
                  - img [ref=e283]
                  - generic [ref=e286]:
                    - generic [ref=e287]: Cinema Studio
                    - generic [ref=e288]: Cinematic shots with camera controls
                - generic [ref=e289]: 6 cameras
        - generic [ref=e290]:
          - heading "Tools & Editors 7" [level=2] [ref=e291]:
            - text: Tools & Editors
            - generic [ref=e292]: "7"
          - generic [ref=e293]:
            - button "Storyboard Studio Storyboard Studio Multi-frame generation for sequences Frames" [ref=e294] [cursor=pointer]:
              - img "Storyboard Studio" [ref=e296]
              - generic [ref=e297]:
                - generic [ref=e298]:
                  - img [ref=e300]
                  - generic [ref=e307]:
                    - generic [ref=e308]: Storyboard Studio
                    - generic [ref=e309]: Multi-frame generation for sequences
                - generic [ref=e310]: Frames
            - button "Effects Studio Effects Studio Apply 350+ visual effects 350+ effects" [ref=e311] [cursor=pointer]:
              - img "Effects Studio" [ref=e313]
              - generic [ref=e314]:
                - generic [ref=e315]:
                  - img [ref=e317]
                  - generic [ref=e319]:
                    - generic [ref=e320]: Effects Studio
                    - generic [ref=e321]: Apply 350+ visual effects
                - generic [ref=e322]: 350+ effects
            - button "Edit Studio Edit Studio Remove objects, backgrounds, reframe 9 tools" [ref=e323] [cursor=pointer]:
              - img "Edit Studio" [ref=e325]
              - generic [ref=e326]:
                - generic [ref=e327]:
                  - img [ref=e329]
                  - generic [ref=e332]:
                    - generic [ref=e333]: Edit Studio
                    - generic [ref=e334]: Remove objects, backgrounds, reframe
                - generic [ref=e335]: 9 tools
            - button "Upscale Suite Upscale Suite AI upscale and enhance images 3 methods" [ref=e336] [cursor=pointer]:
              - img "Upscale Suite" [ref=e338]
              - generic [ref=e339]:
                - generic [ref=e340]:
                  - img [ref=e342]
                  - generic [ref=e347]:
                    - generic [ref=e348]: Upscale Suite
                    - generic [ref=e349]: AI upscale and enhance images
                - generic [ref=e350]: 3 methods
            - button "Character Studio Character Studio Consistent character generation Face ID" [ref=e351] [cursor=pointer]:
              - img "Character Studio" [ref=e353]
              - generic [ref=e354]:
                - generic [ref=e355]:
                  - img [ref=e357]
                  - generic [ref=e360]:
                    - generic [ref=e361]: Character Studio
                    - generic [ref=e362]: Consistent character generation
                - generic [ref=e363]: Face ID
            - button "Commercial Studio Commercial Studio Product photography and ads Ads" [ref=e364] [cursor=pointer]:
              - img "Commercial Studio" [ref=e366]
              - generic [ref=e367]:
                - generic [ref=e368]:
                  - img [ref=e370]
                  - generic [ref=e373]:
                    - generic [ref=e374]: Commercial Studio
                    - generic [ref=e375]: Product photography and ads
                - generic [ref=e376]: Ads
            - button "Smart Video Viral Smart Video Viral AI-powered viral video generation Viral" [ref=e377] [cursor=pointer]:
              - img "Smart Video Viral" [ref=e379]
              - generic [ref=e380]:
                - generic [ref=e381]:
                  - img [ref=e383]
                  - generic [ref=e387]:
                    - generic [ref=e388]: Smart Video Viral
                    - generic [ref=e389]: AI-powered viral video generation
                - generic [ref=e390]: Viral
        - generic [ref=e391]:
          - heading "AI Apps 7" [level=2] [ref=e392]:
            - text: AI Apps
            - generic [ref=e393]: "7"
          - generic [ref=e394]:
            - button "Audio Studio Audio Studio Generate music, speech, and sound effects AI Audio" [ref=e395] [cursor=pointer]:
              - img "Audio Studio" [ref=e397]
              - generic [ref=e398]:
                - generic [ref=e399]:
                  - img [ref=e401]
                  - generic [ref=e405]:
                    - generic [ref=e406]: Audio Studio
                    - generic [ref=e407]: Generate music, speech, and sound effects
                - generic [ref=e408]: AI Audio
            - button "Avatar Studio Avatar Studio AI avatars and lip sync video generation AI Avatars" [ref=e409] [cursor=pointer]:
              - img "Avatar Studio" [ref=e411]
              - generic [ref=e412]:
                - generic [ref=e413]:
                  - img [ref=e415]
                  - generic [ref=e418]:
                    - generic [ref=e419]: Avatar Studio
                    - generic [ref=e420]: AI avatars and lip sync video generation
                - generic [ref=e421]: AI Avatars
            - button "Training Studio Training Studio Train custom LoRA models from your images LoRA" [ref=e422] [cursor=pointer]:
              - img "Training Studio" [ref=e424]
              - generic [ref=e425]:
                - generic [ref=e426]:
                  - img [ref=e428]
                  - generic [ref=e432]:
                    - generic [ref=e433]: Training Studio
                    - generic [ref=e434]: Train custom LoRA models from your images
                - generic [ref=e435]: LoRA
            - button "Video Tools Video Tools Upscale, edit, translate, and enhance videos Video Tools" [ref=e436] [cursor=pointer]:
              - img "Video Tools" [ref=e438]
              - generic [ref=e439]:
                - generic [ref=e440]:
                  - img [ref=e442]
                  - generic [ref=e445]:
                    - generic [ref=e446]: Video Tools
                    - generic [ref=e447]: Upscale, edit, translate, and enhance videos
                - generic [ref=e448]: Video Tools
            - button "Chat Studio Chat Studio AI-powered text generation and conversation LLM" [ref=e449] [cursor=pointer]:
              - img "Chat Studio" [ref=e451]
              - generic [ref=e452]:
                - generic [ref=e453]:
                  - img [ref=e455]
                  - generic [ref=e457]:
                    - generic [ref=e458]: Chat Studio
                    - generic [ref=e459]: AI-powered text generation and conversation
                - generic [ref=e460]: LLM
            - button "Lip Sync Animate portraits or sync lips to audio with AI Lip Sync" [ref=e461] [cursor=pointer]:
              - generic [ref=e464]:
                - generic [ref=e465]:
                  - img [ref=e467]
                  - generic [ref=e470]:
                    - generic [ref=e471]: Lip Sync
                    - generic [ref=e472]: Animate portraits or sync lips to audio with AI
                - generic [ref=e473]: Lip Sync
            - button "Video Render Render and export your video projects Export" [ref=e474] [cursor=pointer]:
              - generic [ref=e477]:
                - generic [ref=e478]:
                  - img [ref=e480]
                  - generic [ref=e482]:
                    - generic [ref=e483]: Video Render
                    - generic [ref=e484]: Render and export your video projects
                - generic [ref=e485]: Export
```

# Test source

```ts
  1   | // tests/e2e/studio-screenshots.spec.js
  2   | //
  3   | // Automated screenshot capture for every studio listed in the side menu.
  4   | //
  5   | // Prerequisites:
  6   | //   1. Start the dev server: npm run dev (serves on http://localhost:3100)
  7   | //   2. Run this test: npx playwright test tests/e2e/studio-screenshots.spec.js
  8   | //
  9   | // Screenshots are saved to ./screenshots/ with one PNG per studio,
  10  | // plus a separate capture of the Settings modal.
  11  | 
  12  | import { test, expect } from '@playwright/test';
  13  | import fs from 'fs';
  14  | import path from 'path';
  15  | 
  16  | const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'screenshots');
  17  | const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100';
  18  | const VIEWPORT = { width: 1440, height: 900 };
  19  | 
  20  | // Side menu items in exact order from src/components/Sidebar.js
  21  | const SIDE_MENU_ITEMS = [
  22  |   { id: 'apps', label: 'Apps', route: 'apps' },
  23  |   { id: 'image', label: 'Image', route: 'image' },
  24  |   { id: 'video', label: 'Video', route: 'video' },
  25  |   { id: 'cinema', label: 'Cinema Studio', route: 'cinema' },
  26  |   { id: 'cinema-template', label: 'Cinema Template Studio', route: 'cinema-template' },
  27  |   { id: 'storyboard', label: 'Storyboard', route: 'storyboard' },
  28  |   { id: 'effects', label: 'Effects', route: 'effects' },
  29  |   { id: 'edit', label: 'Edit', route: 'edit' },
  30  |   { id: 'upscale', label: 'Upscale', route: 'upscale' },
  31  |   { id: 'audio', label: 'Audio', route: 'audio' },
  32  |   { id: 'avatar', label: 'Avatar', route: 'avatar' },
  33  |   { id: 'training', label: 'Training', route: 'training' },
  34  |   { id: 'academy', label: 'Smart Video Academy', route: 'academy' },
  35  |   { id: 'viral', label: 'Smart Video Viral', route: 'viral' },
  36  |   { id: 'videotools', label: 'Video Tools', route: 'videotools' },
  37  |   { id: 'render', label: 'Render', route: 'render' },
  38  |   { id: 'video-agent', label: 'Video Agent', route: 'video-agent' },
  39  |   { id: 'director', label: 'Director', route: 'director' },
  40  |   { id: 'timeline', label: 'Timeline', route: 'timeline' },
  41  |   { id: 'chat', label: 'Chat', route: 'chat' },
  42  |   { id: 'commercial', label: 'Commercial', route: 'commercial' },
  43  |   { id: 'templates', label: 'Templates', route: 'templates' },
  44  |   { id: 'explore', label: 'Explore', route: 'explore' },
  45  |   { id: 'library', label: 'Library', route: 'library' },
  46  |   { id: 'content-library', label: 'Content', route: 'content-library' },
  47  |   { id: 'community', label: 'Community', route: 'community' },
  48  |   { id: 'assist', label: 'Assist', route: 'assist' },
  49  |   { id: 'commits', label: 'Commits (0)', route: 'commits' },
  50  |   { id: 'ai-vfx', label: 'AI VFX', route: 'ai-vfx' },
  51  |   { id: 'pexels-media', label: 'Stock Media', route: 'pexels-media' },
  52  | ];
  53  | 
  54  | async function dismissApiModal(page) {
  55  |   const modalTitle = page.getByText('Welcome — set up your API keys');
  56  |   if (await modalTitle.count() === 0) return;
  57  | 
  58  |   const overlay = page.locator('div.fixed.inset-0').filter({ has: modalTitle });
  59  |   if (await overlay.count() === 0) return;
  60  | 
  61  |   const skipBtn = overlay.getByRole('button', { name: /skip for now/i });
  62  |   if (await skipBtn.count() > 0) {
  63  |     await skipBtn.click();
  64  |     await overlay.waitFor({ state: 'hidden', timeout: 5000 });
  65  |     return;
  66  |   }
  67  | 
  68  |   const closeX = overlay.locator('button').filter({ hasText: '×' });
  69  |   if (await closeX.count() > 0) {
  70  |     await closeX.click();
  71  |     await overlay.waitFor({ state: 'hidden', timeout: 5000 });
  72  |     return;
  73  |   }
  74  | 
  75  |   await overlay.click({ position: { x: 10, y: 10 } });
  76  |   await overlay.waitFor({ state: 'hidden', timeout: 5000 });
  77  | }
  78  | 
  79  | async function dismissStudioDrawer(page) {
  80  |   const drawer = page.locator('[data-studio-drawer]').first();
  81  |   if (await drawer.count() > 0 && await drawer.isVisible()) {
  82  |     await page.keyboard.press('Escape');
  83  |     await drawer.waitFor({ state: 'hidden', timeout: 2000 });
  84  |   }
  85  | }
  86  | 
  87  | async function navigateToStudio(page, route) {
  88  |   await page.goto(`${BASE_URL}/?dev#/${route}`);
> 89  |   await page.waitForSelector('[data-studio-back]', { timeout: 15000 });
      |              ^ TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
  90  |   await page.waitForTimeout(500);
  91  | }
  92  | 
  93  | async function captureScreenshot(page, filename) {
  94  |   await dismissStudioDrawer(page);
  95  |   await dismissApiModal(page);
  96  | 
  97  |   await page.evaluate(() => window.scrollTo(0, 0));
  98  |   await page.waitForTimeout(200);
  99  | 
  100 |   await page.screenshot({
  101 |     path: path.join(SCREENSHOTS_DIR, `${filename}.png`),
  102 |     fullPage: false,
  103 |   });
  104 | }
  105 | 
  106 | test.describe('Studio Screenshot Capture', () => {
  107 |   test.beforeAll(() => {
  108 |     if (!fs.existsSync(SCREENSHOTS_DIR)) {
  109 |       fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  110 |     }
  111 |   });
  112 | 
  113 |   test('captures screenshots for all side menu studios', async ({ page }) => {
  114 |     await page.setViewportSize(VIEWPORT);
  115 | 
  116 |     for (const item of SIDE_MENU_ITEMS) {
  117 |       await navigateToStudio(page, item.route);
  118 |       await captureScreenshot(page, item.id);
  119 |     }
  120 | 
  121 |     await page.goto(`${BASE_URL}/?dev#/image`);
  122 |     await page.waitForTimeout(500);
  123 |     await page.evaluate(() => {
  124 |       window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'settings' } }));
  125 |     });
  126 |     await page.waitForTimeout(500);
  127 |     await captureScreenshot(page, 'settings');
  128 |   });
  129 | });
  130 | 
```