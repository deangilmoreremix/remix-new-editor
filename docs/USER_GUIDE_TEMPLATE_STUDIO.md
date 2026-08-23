# Template Studio — User Guide

The Template Studio lets you create AI-generated images and videos from pre-defined templates. Each template is configured for a specific model (text-to-image, image-to-image, or image-to-video) and pre-loaded with prompt enhancements.

## Getting Started

1. **Open a template.** Navigate to the Templates page and click any template card.
2. **Fill in the inputs.** Each template has its own input fields (e.g. "Describe your video", "Upload your photo").
3. **Adjust the AI Enhancer.** The AI Enhancer toggle is ON by default. When ON, cinematic/4K keywords are automatically added to your prompt. Toggle OFF if you want a raw prompt.
4. **Click Generate.** The result appears in the preview panel.

## Template Types

Templates come in three flavors:

- **Text-to-Image (t2i):** Generates an image from your text prompt. No image upload required.
- **Image-to-Image (i2i):** Transforms an uploaded image using a text prompt and an effect name (e.g. "Cyberpunk", "Ghibli style").
- **Image-to-Video (i2v):** Generates a video from an uploaded image, a text prompt, and an effect name (e.g. "360 Rotation", "Dolly In").

## Output Tabs

The right panel has four output tabs:

- **Enhanced Prompt:** The final prompt sent to the AI, including all enhancements.
- **Scene Beats:** The story structure or scene breakdown.
- **Voiceover:** A suggested voiceover script for video templates.
- **Negative Prompt:** What to avoid in the generation (e.g. "blurry, low quality").

## Cinematic Wizard

Templates marked as "Cinematic" offer a multi-step wizard for building storyboards:
1. **Configure:** Choose a story structure and visual style.
2. **Scenes:** Write a short prompt for each scene.
3. **Preview:** Review the assembled prompt and storyboard.
4. **Generate:** Run the cinematic pipeline.

## Advanced Controls

Click "Show Advanced Controls" to access:
- Template type, niche, business type, audience, subject, setting, visual style, and CTA.
- Extra instructions for fine-tuning.

## Cancellation

During generation, the Generate button shows "Cancel". Click it to abort the request.

## Troubleshooting

- **"Please enter a longer prompt"** — The prompt is too short (less than 10 characters). Add more detail.
- **"API Request Failed"** — Check your network connection and API key.
- **Placeholder warning** — If you see a red "placeholder" warning, the generation returned an unexpected URL. Try again or contact support.
- **Missing API key** — Click the Settings icon and enter your Muapi key.
