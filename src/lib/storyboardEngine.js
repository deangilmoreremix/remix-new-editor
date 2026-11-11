import { muapi } from './muapi.js';
import { openaiService } from './openaiService.js';
import { apiKeyManager } from './apiKeyManager.js';
import { t2iModels } from './models.js';

export const SHOT_TYPES = ['Wide Shot', 'Medium Shot', 'Close-Up', 'Extreme Close-Up', 'POV', 'Overhead', 'Low Angle'];
export const CAMERA_MOVEMENTS = ['Static', 'Pan Left', 'Pan Right', 'Tilt Up', 'Tilt Down', 'Dolly In', 'Dolly Out', 'Tracking', 'Handheld', 'Crane / Drone', 'Zoom In', 'Orbit'];
export const MIN_FRAMES = 3;
export const MAX_FRAMES = 12;

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

// Story beats used when no LLM is available. Each beat has its own purpose, a
// matching shot and camera move, so the frames read as a story arc instead of
// the same sentence repeated.
const BEATS = [
  { beat: 'Hook', shot: 'Wide Shot', move: 'Crane / Drone', note: 'Grab attention and establish the world.', text: (c) => `Opening hook: a striking wide establishing view that introduces ${c.subject}.` },
  { beat: 'Setup', shot: 'Medium Shot', move: 'Dolly In', note: 'Introduce who or what this is about.', text: (c) => `Introduce the main subject of ${c.subject} in its everyday setting.` },
  { beat: 'Problem', shot: 'Close-Up', move: 'Handheld', note: 'Show the tension or need.', text: (c) => `The tension or need that makes ${c.subject} matter${c.audience ? ` to ${c.audience}` : ''}.` },
  { beat: 'Turn', shot: 'Low Angle', move: 'Tilt Up', note: 'The moment things change.', text: (c) => `The turning point: ${c.subject} changes the situation.` },
  { beat: 'Detail', shot: 'Extreme Close-Up', move: 'Static', note: 'Show craft and detail.', text: (c) => `A detail shot that shows the quality and craft of ${c.subject}.` },
  { beat: 'Action', shot: 'Medium Shot', move: 'Tracking', note: 'Show it in motion.', text: (c) => `${c.subject} in action, with clear movement through the frame.` },
  { beat: 'Experience', shot: 'POV', move: 'Handheld', note: 'Put the viewer inside it.', text: (c) => `First-person view of what it feels like to experience ${c.subject}.` },
  { beat: 'Scale', shot: 'Overhead', move: 'Crane / Drone', note: 'Reveal the bigger picture.', text: (c) => `An overhead view that reveals the scale and context of ${c.subject}.` },
  { beat: 'Payoff', shot: 'Medium Shot', move: 'Dolly Out', note: 'Deliver the result.', text: (c) => `The payoff: the result of ${c.subject} delivered with emotional clarity.` },
];

export function resolveOpenAISize(value) {
  if (!value || value === 'auto') return 'auto';
  const ratios = {
    '16:9': '1536x1024',
    '9:16': '1024x1536',
    '1:1': '1024x1024',
    '4:5': '1024x1536',
  };
  return ratios[value] || 'auto';
}

/** Clamp a requested frame count into the supported 3-12 range. */
export function clampFrameCount(value, fallback = 6) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(MIN_FRAMES, Math.min(MAX_FRAMES, n));
}

/** Default number of frames for a total duration (about one frame per 5s). */
export function frameCountForDuration(duration) {
  return clampFrameCount(Number(duration) / 5);
}

/** Split `total` seconds over `count` frames, in whole seconds, summing to total. */
export function distributeDurations(total, count) {
  const safeTotal = Math.max(count, Math.round(Number(total) || count * 3));
  const base = Math.floor(safeTotal / count);
  let remainder = safeTotal - base * count;
  return Array.from({ length: count }, () => base + (remainder-- > 0 ? 1 : 0));
}

/** Build the shared look suffix (style, lighting, grade) used on every frame. */
export function buildLookSuffix({ style, lighting, color } = {}) {
  return (style && style !== 'None' ? `, ${style.toLowerCase()} style` : '')
    + (lighting && lighting !== 'None' ? `, ${lighting.toLowerCase()} lighting` : '')
    + (color && color !== 'None' ? `, ${color.toLowerCase()} color grade` : '');
}

/**
 * Create a frame object. This is the single frame shape used across the studio,
 * the saved project and the Template Studio hand-off (it carries both the
 * `shot`/`prompt` names used by the studio and the `shotType`/`description`
 * names the template scene builder reads).
 */
export function createFrame(partial = {}) {
  const shot = partial.shot || partial.shotType || 'Wide Shot';
  const prompt = partial.prompt ?? partial.description ?? '';
  return {
    id: partial.id || `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    sceneNumber: partial.sceneNumber || 1,
    shotNumber: partial.shotNumber || 1,
    shot,
    shotType: shot,
    cameraMovement: partial.cameraMovement || 'Static',
    duration: Math.max(1, Math.round(Number(partial.duration) || 3)),
    prompt,
    description: prompt,
    narration: partial.narration || '',
    notes: partial.notes || '',
    imageUrl: partial.imageUrl || null,
    referenceImages: Array.isArray(partial.referenceImages) ? partial.referenceImages : [],
    enhancedPrompt: partial.enhancedPrompt || undefined,
    status: partial.status || (partial.imageUrl ? 'done' : 'idle'),
  };
}

/** Keep the template-facing aliases in step with the studio's field names. */
export function syncFrameAliases(frame) {
  frame.shotType = frame.shot;
  frame.description = frame.prompt;
  return frame;
}

/** Renumber scene/shot numbers after any reorder, add or delete. Scenes group consecutive frames. */
export function renumberFrames(frames) {
  let scene = 0;
  let shot = 0;
  let lastScene = null;
  frames.forEach((f) => {
    const key = f.sceneNumber ?? 1;
    if (key !== lastScene) {
      scene += 1;
      shot = 0;
      lastScene = key;
    }
    shot += 1;
    f.sceneNumber = scene;
    f.shotNumber = shot;
  });
  return frames;
}

export function totalDuration(frames) {
  return frames.reduce((sum, f) => sum + (Number(f.duration) || 0), 0);
}

function buildContext(intent) {
  return {
    subject: (intent.subject || '').trim() || (intent.premise || '').trim() || 'the topic',
    audience: (intent.targetAudience || '').trim(),
    bible: (intent.storyBible || '').trim(),
  };
}

/** Template-based storyboard used when no AI text model is available. */
export function buildFallbackFrames(intent, count) {
  const ctx = buildContext(intent);
  const premise = (intent.premise || '').trim();
  const cta = (intent.cta || '').trim();
  const durations = distributeDurations(intent.duration || count * 4, count);

  return Array.from({ length: count }, (_, i) => {
    const isLast = i === count - 1 && count > 2;
    // Spread the middle beats across the frame count; always open with the hook and close on the payoff.
    const beat = i === 0
      ? BEATS[0]
      : isLast
        ? BEATS[BEATS.length - 1]
        : BEATS[1 + Math.floor(((i - 1) / Math.max(1, count - 2)) * (BEATS.length - 2))];
    let text = beat.text(ctx);
    if (isLast && cta) text += ` End on the call to action: ${cta}.`;
    return createFrame({
      sceneNumber: 1,
      shotNumber: i + 1,
      shot: beat.shot,
      cameraMovement: beat.move,
      duration: durations[i],
      prompt: text,
      narration: i === 0 ? (premise || '') : '',
      notes: `${beat.beat}: ${beat.note}`,
    });
  });
}

function extractJson(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(cleaned); } catch { /* try to find the object below */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return null;
}

function matchOption(value, options, fallback) {
  if (!value) return fallback;
  const v = String(value).trim().toLowerCase();
  return options.find((o) => o.toLowerCase() === v)
    || options.find((o) => v.includes(o.toLowerCase()) || o.toLowerCase().includes(v))
    || fallback;
}

/**
 * Turn the AI's JSON answer into frames. Returns null when the answer is not
 * usable so the caller can fall back to the template storyboard.
 */
export function parseStoryboardResponse(text, intent, count) {
  const data = extractJson(text);
  const list = Array.isArray(data) ? data : data?.frames || data?.shots;
  if (!Array.isArray(list) || list.length === 0) return null;

  const trimmed = list.slice(0, MAX_FRAMES);
  const frames = trimmed.map((raw, i) => createFrame({
    sceneNumber: Number(raw.scene ?? raw.sceneNumber) || 1,
    shot: matchOption(raw.shot ?? raw.shotType, SHOT_TYPES, SHOT_TYPES[i % SHOT_TYPES.length]),
    cameraMovement: matchOption(raw.camera ?? raw.cameraMovement, CAMERA_MOVEMENTS, 'Static'),
    duration: Number(raw.duration) || undefined,
    prompt: String(raw.visual ?? raw.prompt ?? raw.description ?? '').trim(),
    narration: String(raw.narration ?? raw.voiceover ?? '').trim(),
    notes: String(raw.notes ?? raw.beat ?? '').trim(),
  })).filter((f) => f.prompt);

  if (!frames.length) return null;

  // Honor the requested total duration even if the model's numbers drift.
  const wanted = Math.round(Number(intent.duration) || 0);
  if (wanted && totalDuration(frames) !== wanted && frames.every((f) => f.duration > 0)) {
    const sum = totalDuration(frames);
    const scaled = frames.map((f) => Math.max(1, Math.round((f.duration / sum) * wanted)));
    const drift = wanted - scaled.reduce((a, b) => a + b, 0);
    scaled[scaled.length - 1] = Math.max(1, scaled[scaled.length - 1] + drift);
    frames.forEach((f, i) => { f.duration = scaled[i]; });
  }
  void count;
  return renumberFrames(frames);
}

function buildStoryPrompt(intent, count) {
  const tone = TONE_MAP[intent.tone] || 'Cinematic';
  const lines = [
    `Plan a ${intent.duration || 60} second ${intent.videoType || 'commercial'} as exactly ${count} storyboard frames.`,
    `Subject: ${intent.subject || '(not given)'}`,
    `Premise: ${intent.premise || '(not given)'}`,
    `Tone: ${tone}`,
    intent.targetAudience ? `Audience: ${intent.targetAudience}` : '',
    intent.cta ? `Call to action (use it in the final frame): ${intent.cta}` : '',
    intent.storyBible ? `Characters / setting / look to keep consistent in every frame: ${intent.storyBible}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

const STORY_SYSTEM_PROMPT = `You are a film storyboard artist. Reply with JSON only, no prose, in this exact shape:
{"frames":[{"scene":1,"shot":"Wide Shot","camera":"Dolly In","duration":4,"visual":"what the frame shows, written as an image prompt","narration":"voice-over line or empty","notes":"story beat"}]}
Rules: "shot" must be one of ${SHOT_TYPES.join(', ')}. "camera" must be one of ${CAMERA_MOVEMENTS.join(', ')}. "duration" is whole seconds and all durations must add up to the requested total. Give the frames a clear arc (hook, build, payoff). Each "visual" is concrete and self-contained: subject, setting, action, composition. Keep any named characters and settings identical from frame to frame.`;

/**
 * Generate the frames (without images) for a video intent. Uses the user's
 * OpenAI key when present, and otherwise (or when the answer is unusable) the
 * template storyboard. `source` on the result says which one was used.
 */
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
    storyBible = '',
    model = t2iModels[0]?.id,
    customThumbnailUrl,
  } = intent;

  if (!subject.trim() && !premise.trim()) {
    throw new Error('Please provide a subject or premise for your video.');
  }

  const count = clampFrameCount(intent.frameCount ?? frameCountForDuration(duration));
  const normalized = { ...intent, duration, subject, premise, tone, targetAudience, cta, storyBible, videoType };

  let frames = null;
  let source = 'template';
  if (apiKeyManager.hasOpenAIKey() && typeof openaiService.generateText === 'function') {
    try {
      const text = await openaiService.generateText({
        system: STORY_SYSTEM_PROMPT,
        prompt: buildStoryPrompt(normalized, count),
        json: true,
        maxTokens: 2500,
      });
      frames = parseStoryboardResponse(text, normalized, count);
      if (frames) source = 'ai';
    } catch (err) {
      console.warn('[StoryboardEngine] AI storyboard failed, using template:', err.message);
    }
  }
  if (!frames) frames = renumberFrames(buildFallbackFrames(normalized, count));

  if (options.generateImages) {
    const hasKey = apiKeyManager.hasOpenAIKey() || apiKeyManager.hasMuapiKey();
    if (hasKey) {
      for (const frame of frames) {
        try {
          const url = await generateFrameImage(
            buildFramePrompt(frame, { storyBible }),
            aspectRatio, model, stylePreset, lightingPreset, colorGrade, customThumbnailUrl,
          );
          if (url) { frame.imageUrl = url; frame.status = 'done'; }
        } catch (err) {
          console.warn('[StoryboardEngine] Frame generation failed:', err.message);
        }
      }
    }
  }

  return {
    frames,
    source,
    metadata: {
      videoType,
      duration,
      frameCount: frames.length,
      aspectRatio,
      subject,
      premise,
      tone,
      targetAudience,
      stylePreset,
      lightingPreset,
      colorGrade,
      cta,
      storyBible,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * The prompt sent to the image model for one frame: story bible first (so the
 * characters and setting stay the same), then the shot, the camera and the scene.
 */
export function buildFramePrompt(frame, { storyBible = '' } = {}) {
  const scene = frame.enhancedPrompt || frame.prompt || '';
  const camera = frame.cameraMovement && frame.cameraMovement !== 'Static' ? `, ${frame.cameraMovement.toLowerCase()} camera` : '';
  const bible = storyBible && storyBible.trim() ? ` Keep consistent: ${storyBible.trim()}.` : '';
  return `${frame.shot} cinematic storyboard frame: ${scene}${camera}.${bible} Professional cinematography.`;
}

/**
 * Generate one frame image. `extras` carries the settings from the Generation
 * settings panel: negativePrompt, seed, guidanceScale, steps and referenceImages.
 */
export async function generateFrameImage(prompt, aspectRatio, model, style, lighting, color, customThumbnailUrl, extras = {}) {
  const { negativePrompt, seed, guidanceScale, steps, referenceImages, signal } = extras;
  const enhancedPrompt = prompt + buildLookSuffix({ style, lighting, color });

  if (apiKeyManager.hasOpenAIKey()) {
    try {
      const { images } = await openaiService.generateImageResponses({
        input: negativePrompt ? `${enhancedPrompt}. Avoid: ${negativePrompt}` : enhancedPrompt,
        size: resolveOpenAISize(aspectRatio),
        quality: 'auto',
        outputFormat: 'png',
        customThumbnailUrl: customThumbnailUrl || undefined,
        signal,
      });
      const img = images?.[0];
      if (img) return img.base64 ? `data:image/png;base64,${img.base64}` : img.url || null;
    } catch (err) {
      if (!apiKeyManager.hasMuapiKey()) throw err;
      console.warn('[StoryboardEngine] OpenAI generation failed, falling back to MuAPI:', err.message);
    }
  }

  const params = {
    model,
    prompt: enhancedPrompt,
    aspect_ratio: aspectRatio,
    customThumbnailUrl: customThumbnailUrl || undefined,
  };
  if (negativePrompt) params.negative_prompt = negativePrompt;
  if (Number.isFinite(seed) && seed >= 0) params.seed = seed;
  if (Number.isFinite(guidanceScale)) params.guidance_scale = guidanceScale;
  if (Number.isFinite(steps)) params.steps = steps;
  const refs = (referenceImages || []).map((r) => r?.url).filter(Boolean);
  if (refs.length) params.reference_images = refs;
  const result = await muapi.generateImage(params, signal);
  return result?.url || null;
}
