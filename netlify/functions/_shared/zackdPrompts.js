/**
 * Zack D studio: prompts, beat-map schema and payload builders.
 *
 * Pure functions only (no I/O), shared by netlify/functions/zackd.js and the
 * browser studio (src/components/studios/ZackDStudio).
 *
 * Adapted from https://github.com/Anil-matcha/zack-d-films-ai-video-generator
 * (MIT License, Copyright (c) 2026 Zack D Director). See NOTICE-zackd.md.
 */

export const ASPECT_RATIO = '9:16';
export const MAX_BEATS = 8;
export const MAX_SHOTS_PER_BEAT = 3;
export const MIN_SHOT_SEC = 2;
export const MAX_SHOT_SEC = 4;

export const CAMERA_MOVES = ['push_in', 'pull_out', 'pan_right', 'pan_left', 'tilt_up', 'tilt_down', 'static'];
export const SHOT_TYPES = ['wide', 'macro', 'macro_cross_section', 'detail'];

/** Models (MuAPI). Primary first, fallback second. */
export const MODELS = {
  // Upstream's fallback id 'flux-dev' 404s on MuAPI; the real endpoint is flux-dev-image.
  image: ['nano-banana-2', 'flux-dev-image'],
  clip: ['veo3.1-fast-image-to-video', 'veo3.1-image-to-video'],
  tts: 'minimax-speech-2.6-turbo',
  captions: 'ai-captions',
};

/** MuAPI AI Captions (Vadoo): language + theme enums, from https://muapi.ai/playground/ai-captions */
export const CAPTION_LANGUAGES = [
  'English', 'English (USA)', 'English (UK)', 'English (Australia)',
  'English (Canada)', 'Japanese', 'Chinese', 'German',
  'Hindi', 'French', 'French (France)', 'French (Canada)',
  'Korean', 'Portuguese (Brazil)', 'Portuguese (Portugal)', 'Portuguese',
  'Spanish (Spain)', 'Spanish (Mexico)', 'Italian', 'Spanish',
  'Indonesian', 'Dutch', 'Turkish', 'Filipino',
  'Polish', 'Swedish', 'Bulgarian', 'Romanian',
  'Arabic (Saudi Arabia)', 'Arabic (UAE)', 'Arabic', 'Czech',
  'Greek', 'Finnish', 'Croatian', 'Malay',
  'Slovak', 'Danish', 'Tamil', 'Telugu',
  'Ukrainian', 'Russian', 'Hungarian', 'Norwegian',
  'Vietnamese',
];
export const CAPTION_THEMES = [
  { value: 'Hormozi_1', label: 'Hormozi 1' },
  { value: 'Hormozi_2', label: 'Hormozi 2' },
  { value: 'Hormozi_3', label: 'Hormozi 3' },
  { value: 'Beast', label: 'Beast' },
  { value: 'Ali', label: 'Ali' },
  { value: 'Noah', label: 'Noah' },
  { value: 'Karl', label: 'Karl' },
  { value: 'Luke', label: 'Luke' },
  { value: 'Devin', label: 'Devin' },
  { value: 'Celine', label: 'Celine' },
  { value: 'Maya', label: 'Maya' },
  { value: 'Ella', label: 'Ella' },
  { value: 'Dan', label: 'Dan' },
  { value: 'David', label: 'David' },
  { value: 'Tracy', label: 'Tracy' },
  { value: 'Umi', label: 'Umi' },
  { value: 'Iman', label: 'Iman' },
  { value: 'William', label: 'William' },
];
export const DEFAULT_CAPTION_LANGUAGE = 'English';
export const DEFAULT_CAPTION_THEME = 'Hormozi_1';

export const UPSTREAM_VOICE = 'male_doc_fast'; // upstream's voice_id; not listed in MuAPI's tables, so offered but not the default
export const TTS_VOICES = [
  'Casual_Guy', UPSTREAM_VOICE, 'Deep_Voice_Man', 'Friendly_Person', 'Patient_Man', 'Determined_Man', 'Decent_Boy',
  'Wise_Woman', 'Calm_Woman', 'Lively_Girl', 'Inspirational_girl', 'Exuberant_Girl', 'Sweet_Girl_2',
];
export const DEFAULT_VOICE = 'Casual_Guy';
export const DEFAULT_TTS_SPEED = 1.1;

/** Offline starter ideas, shown when no trend query/LLM key is used. */
export const SEED_TOPICS = [
  { topic: 'What Happens When You Swallow Gum?', hook: "You've been told gum stays in your stomach for 7 years... is that actually true?", category: 'Medical / Human Body' },
  { topic: 'How Mosquitoes Drink Your Blood', hook: "A mosquito doesn't just suck blood. It leaves six needle-like tools and saliva behind.", category: 'Biology / Insects' },
  { topic: 'Why Your Brain Gets Brain Freeze', hook: 'Eating ice cream too fast tricks your brain into thinking your head is freezing solid.', category: 'Neuroscience' },
  { topic: "What Happens If You Don't Sleep For 3 Days", hook: 'What really happens to your brain and body when you stay awake for three days?', category: 'Health / Sleep' },
];

// ---- Upstream prompt strings ------------------------------------------------------------------------------------------
// Verbatim from scripts/provider.py, character_sheets.py, keyframes.py and clips.py of
// Anil-matcha/zack-d-films-ai-video-generator. __tests__/fixtures/upstream-fixtures.json pins them.
// provider.generate_image prefixes EVERY image prompt (sheets and keyframes) with this:
export const IMAGE_PREFIX = 'Stylized 3D render, Zack D Films visual aesthetic, plasticine clay subsurface scattering: ';
const SHEET_STYLE = 'stylized 3D digital art style, smooth plasticine shader, clean light grey background, octane render, studio lighting, zero shadows.';
const KEYFRAME_STYLE = 'in Zack D 3D stylized animation render style, smooth plasticine shader, dramatic studio key light, vibrant rim lighting, subsurface scattering, macro depth of field.';

/** Looks: "plasticine" IS upstream. The others are our additions (opt-in, off by default). */
export const LOOKS = {
  plasticine: { label: 'Plasticine clay (upstream)', sheetStyle: SHEET_STYLE, keyframeStyle: KEYFRAME_STYLE },
  glass: {
    label: 'Translucent glass',
    sheetStyle: 'stylized 3D digital art style, semi-translucent glossy tissue, clean light grey background, octane render, studio lighting, zero shadows.',
    keyframeStyle: 'in Zack D 3D stylized animation render style, semi-translucent glossy tissue, vibrant magenta and teal rim lighting, bright interior glow, subsurface scattering, macro depth of field.',
  },
  bright: {
    label: 'Bright toy studio',
    sheetStyle: 'stylized 3D digital art style, clean polymer clay shader, clean light grey background, octane render, soft studio lighting, zero shadows.',
    keyframeStyle: 'in Zack D 3D stylized animation render style, clean polymer clay shader, bright high-key studio lighting, saturated colors, macro depth of field.',
  },
};
export const DEFAULT_LOOK = 'plasticine';

/**
 * Optional behaviours. The defaults reproduce upstream: assemble.py keeps every clip's own audio, uses each clip's
 * real length, and never mixes narration or music. Everything else is OUR extension.
 */
export const DEFAULT_EXTRAS = {
  keepClipAudio: true, // upstream: always
  mixVoice: false, // extension: mix generated narration/music into the cut (turns on by itself once they exist)
  trimToPlanned: false, // extension: cut each clip to its planned shot length (2-4 s) instead of its real length
  consistencyBoost: false, // extension: add the character sheet descriptions to the image prompts
};


const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const slug = (v, fallback) => {
  const s = String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
  return s || fallback;
};

/** System prompt for the beat-map script generator. */
export function scriptInstructions({ maxBeats = 6 } = {}) {
  const beats = clamp(Math.round(Number(maxBeats) || 6), 3, MAX_BEATS);
  return `You write curiosity-loop scripts for 9:16 stylized 3D animated explainer shorts (Zack D Films style).

Rules:
- Every narration line opens a question the viewer needs answered, then partly answers it and opens the next one (myth-buster loop: hook, mechanism, escalation, twist, resolution).
- Beat 1 is the hook: narration the viewer can hear in 3 seconds or less, "hook": true.
- 4 to ${beats} beats total. Each beat has 5 to 8 seconds of narration (about 14-22 words).
- Each beat has 1 to 2 shots, ${MIN_SHOT_SEC}-${MAX_SHOT_SEC} seconds each. Shot A is an establishing "wide" of the subject; shot B is a "macro_cross_section" or "macro"/"detail" cutaway into the interior or mechanism.
- Alternate camera_move across beats (${CAMERA_MOVES.join(', ')}). Use "static" for the impact moment.
- zoom_impact is true only on the 1-2 shots where the narration lands a key fact.
- scene_description describes only what the camera sees (subject, action, cross-section). No style words, no text overlays.
- character_sheets_required lists 1-3 recurring characters/organs/objects as snake_case ids; each shot's character_refs uses those ids.
- character_sheets entries describe each id in one concrete sentence (colors, clothing, shape) so it can be rendered identically every time.

Return ONLY JSON, no markdown, with this shape:
{"title": string, "beats": [{"narration": string, "title_en": string, "hook": boolean, "shots": [{"type": string, "duration_sec": number, "scene_description": string, "camera_move": string, "character_refs": [string], "zoom_impact": boolean}]}], "character_sheets_required": [string], "character_sheets": {"<id>": string}}`;
}

/** System prompt for trend research (topic ideas). */
export function trendInstructions() {
  return `You suggest curiosity-driven topics for 3D animated explainer shorts: medical, anatomical, biological, scientific or everyday-mechanism questions with a visible inside-the-body or cross-section angle.
Return ONLY JSON: {"topics": [{"topic": string, "hook": string, "category": string}]} with 6 items. "hook" is one sentence that opens a curiosity loop. Do not claim view counts or virality scores.`;
}

/** Strip code fences and parse the first JSON object in LLM text; null if none. */
export function parseJsonLoose(text) {
  const raw = String(text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(raw); } catch { /* fall through */ }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch { /* ignore */ }
  }
  return null;
}

/**
 * Validate and normalize an LLM/edited beat map into the studio's canonical shape.
 * Throws Error('...') with a user-readable message if nothing usable remains.
 */
export function normalizeBeats(input, { topic = '' } = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const rawBeats = Array.isArray(src.beats) ? src.beats.slice(0, MAX_BEATS) : [];
  const descriptions = src.character_sheets && typeof src.character_sheets === 'object' ? src.character_sheets : {};
  const sheetIds = [];
  const addSheet = (id) => { if (id && !sheetIds.includes(id)) sheetIds.push(id); };
  (Array.isArray(src.character_sheets_required) ? src.character_sheets_required : []).forEach((id) => addSheet(slug(id, '')));

  const beats = [];
  rawBeats.forEach((b, bi) => {
    const narration = str(b?.narration, 400);
    if (!narration) return;
    const beatId = `beat_${beats.length + 1}`;
    const shotsIn = Array.isArray(b?.shots) ? b.shots.slice(0, MAX_SHOTS_PER_BEAT) : [];
    const shots = [];
    shotsIn.forEach((s) => {
      const scene = str(s?.scene_description, 400);
      if (!scene) return;
      const refs = (Array.isArray(s?.character_refs) ? s.character_refs : []).map((r) => slug(r, '')).filter(Boolean);
      refs.forEach(addSheet);
      shots.push({
        shot_id: `${beatId}_${String.fromCharCode(97 + shots.length)}`,
        type: SHOT_TYPES.includes(s?.type) ? s.type : (shots.length === 0 ? 'wide' : 'macro_cross_section'),
        duration_sec: clamp(Number(s?.duration_sec) || 3, MIN_SHOT_SEC, MAX_SHOT_SEC),
        scene_description: scene,
        camera_move: CAMERA_MOVES.includes(s?.camera_move) ? s.camera_move : CAMERA_MOVES[(bi + shots.length) % CAMERA_MOVES.length],
        character_refs: refs,
        zoom_impact: s?.zoom_impact === true,
      });
    });
    if (!shots.length) return;
    beats.push({
      beat_id: beatId,
      narration,
      title_en: str(b?.title_en, 60) || `Beat ${beats.length + 1}`,
      hook: beats.length === 0, // only the first beat is the hook
      shots,
    });
  });

  if (!beats.length) throw new Error('The script had no usable beats. Try again or adjust the topic.');

  const sheets = sheetIds.map((id) => ({
    id,
    description: str(descriptions[id], 300) || id.replace(/_/g, ' '),
  }));

  return {
    topic: str(topic || src.topic || src.title, 200),
    title: str(src.title || topic, 120),
    aspect_ratio: ASPECT_RATIO,
    beats,
    character_sheets: sheets,
  };
}

export const narrationText = (map) => (map?.beats || []).map((b) => b.narration).filter(Boolean).join(' ');
export const allShots = (map) => (map?.beats || []).flatMap((b) => b.shots.map((s) => ({ ...s, beat_id: b.beat_id })));
export const totalDuration = (map) => allShots(map).reduce((n, s) => n + s.duration_sec, 0);

const lookOf = (look) => LOOKS[look] || LOOKS[DEFAULT_LOOK];

/** Orthographic turnaround sheet prompt (character_sheets.py + provider prefix). Aspect: 16:9. */
export function characterSheetPrompt(sheet, { look = DEFAULT_LOOK, boost = false } = {}) {
  const name = String(sheet?.id || 'character').replace(/_/g, ' ');
  const label = boost && sheet?.description ? `${name} (${String(sheet.description).slice(0, 300)})` : name;
  return `${IMAGE_PREFIX}Orthographic 3D character turnaround sheet, front view, side profile view, and 3/4 angle view of ${label}, ${lookOf(look).sheetStyle}`;
}

/** Keyframe prompt (keyframes.py + provider prefix). Aspect: the beat map's (9:16). */
export function keyframePrompt(shot, sheets = [], { look = DEFAULT_LOOK, boost = false } = {}) {
  let p = `${shot.scene_description}, ${lookOf(look).keyframeStyle}`;
  const refs = shot.character_refs || [];
  if (refs.length) p += ` Anchored on character sheet refs: ${refs.join(', ')}.`;
  if (boost) {
    const byId = Object.fromEntries((sheets || []).map((x) => [x.id, x]));
    const details = refs.map((id) => byId[id]?.description && `${id.replace(/_/g, ' ')}: ${byId[id].description}`).filter(Boolean);
    if (details.length) p += ` Keep these consistent: ${details.join('; ')}.`;
  }
  return IMAGE_PREFIX + p;
}

/** Veo prompt (provider.animate_image wrapping clips.py's motion prompt); camera_move is used raw (e.g. push_in). */
export function clipPrompt(shot) {
  return `Smooth 3D animation, camera movement ${shot.camera_move || 'push_in'}. Smooth 3D motion, ${shot.scene_description}`;
}

/** Narration TTS payload (provider.clone_voice_and_tts: text, voice_id, speed 1.1). `prompt` is kept for MuAPI compatibility. */
export function ttsPayload({ text, voice, speed } = {}) {
  const v = TTS_VOICES.includes(voice) ? voice : DEFAULT_VOICE;
  const t = String(text || '').trim();
  const sp = clamp(Number(speed) || DEFAULT_TTS_SPEED, 0.5, 2);
  return { prompt: t, text: t, voice_id: v, voice: v, speed: sp };
}
