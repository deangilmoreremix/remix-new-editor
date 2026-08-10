import { muapi } from './muapi.js';
import { openaiService } from './openaiService.js';
import { apiKeyManager } from './apiKeyManager.js';
import { buildNanoBananaPrompt } from './promptUtils.js';

const SHOT_TYPES = ['Wide Shot', 'Medium Shot', 'Close-Up', 'Extreme Close-Up', 'POV', 'Overhead', 'Low Angle'];
const TONE_MAP = {
  dramatic: 'Dramatic',
  cinematic: 'Cinematic',
  upbeat: 'Upbeat',
  luxury: 'Luxury',
  gritty: 'Gritty',
  minimal: 'Minimal',
  emotional: 'Emotional',
  humorous: 'Humorous',
};

function resolveOpenAISize(value) {
  if (!value || value === 'auto') return 'auto';
  const ratios = {
    '16:9': '1536x1024',
    '9:16': '1024x1536',
    '1:1': '1024x1024',
    '4:5': '1024x1280',
  };
  return ratios[value] || 'auto';
}

async function generateFrameImage(prompt, aspectRatio, model, style, lighting, color, customThumbnailUrl) {
  const cinematicPrompt = buildNanoBananaPrompt(prompt, 'Full-Frame Cine Digital', 'Classic Anamorphic', 50, 'f/1.4')
    + (style && style !== 'None' ? `, ${style.toLowerCase()} style` : '')
    + (lighting && lighting !== 'None' ? `, ${lighting.toLowerCase()} lighting` : '')
    + (color && color !== 'None' ? `, ${color.toLowerCase()} color grade` : '');

  if (apiKeyManager.hasOpenAIKey()) {
    try {
      const { images } = await openaiService.generateImageResponses({
        input: cinematicPrompt,
        size: resolveOpenAISize(aspectRatio),
        quality: 'auto',
        outputFormat: 'png',
        customThumbnailUrl: customThumbnailUrl || undefined,
      });
      const img = images?.[0];
      if (img) return img.base64 ? `data:image/png;base64,${img.base64}` : img.url || null;
    } catch (err) {
      if (!apiKeyManager.hasMuapiKey()) throw err;
      console.warn('[StoryboardEngine] OpenAI generation failed, falling back to MuAPI:', err.message);
    }
  }

  const result = await muapi.generateImage({ model, prompt: cinematicPrompt, aspect_ratio: aspectRatio, customThumbnailUrl: customThumbnailUrl || undefined });
  return result?.url || null;
}

export async function generateStoryboardFromIntent(intent, options = {}) {
  const {
    videoType = 'commercial',
    duration = 60,
    aspectRatio = '16:9',
    subject = '',
    premise = '',
    tone = 'dramatic',
    targetAudience = '',
    stylePreset = 'None',
    lightingPreset = 'None',
    colorGrade = 'None',
    cta = '',
    model = 'flux-pro',
    customThumbnailUrl,
  } = intent;

  if (!subject.trim() && !premise.trim()) {
    throw new Error('Please provide a subject or premise for your video.');
  }

  const avgShotDuration = 5;
  const numFrames = Math.max(3, Math.min(12, Math.round(duration / avgShotDuration)));
  const toneLabel = TONE_MAP[tone] || 'Cinematic';
  const basePrompt = `${toneLabel} ${videoType} about ${subject || 'the topic'}${premise ? ': ' + premise : ''}${targetAudience ? ' for ' + targetAudience : ''}${cta ? '. Call to action: ' + cta : ''}`;

  const frames = [];
  for (let i = 0; i < numFrames; i++) {
    const shot = SHOT_TYPES[i % SHOT_TYPES.length];
    const beatLabel = i === 0 ? 'Opening establishing shot' : i === numFrames - 1 ? 'Closing shot' : `Scene beat ${i + 1}`;
    const framePrompt = `${basePrompt}. ${beatLabel}. ${shot} composition. Cinematic storyboard frame.`;

    frames.push({
      prompt: framePrompt,
      narration: i === 0 ? premise || basePrompt : '',
      shot,
      imageUrl: null,
      notes: `Style: ${stylePreset} | Lighting: ${lightingPreset} | Color: ${colorGrade}`,
      referenceImages: [],
    });
  }

  if (options.generateImages !== false) {
    const hasKey = apiKeyManager.hasOpenAIKey() || apiKeyManager.hasMuapiKey();
    if (hasKey) {
      for (let i = 0; i < frames.length; i++) {
        try {
          const url = await generateFrameImage(frames[i].prompt, aspectRatio, model, stylePreset, lightingPreset, colorGrade, customThumbnailUrl);
          if (url) frames[i].imageUrl = url;
        } catch (err) {
          console.warn(`[StoryboardEngine] Frame ${i + 1} generation failed:`, err.message);
        }
      }
    }
  }

  return {
    frames,
    metadata: {
      videoType,
      duration,
      aspectRatio,
      subject,
      premise,
      tone,
      targetAudience,
      stylePreset,
      lightingPreset,
      colorGrade,
      cta,
      generatedAt: new Date().toISOString(),
    },
  };
}
