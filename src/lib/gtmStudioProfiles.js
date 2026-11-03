/**
 * GTM Boost studio profiles.
 *
 * GTM Boost is opened from every studio, but each studio feeds a different
 * kind of model: a text-to-video model wants one flowing shot description,
 * an image model wants a dense still-frame prompt, an avatar wants a spoken
 * script, the audio studio wants a music / voice brief. Previously the modal
 * always produced a video "storybeat" outline and pasted that whole outline
 * into whatever studio opened it.
 *
 * A profile describes, per studio:
 *   - what the final, ready-to-paste prompt must look like (`finalPromptRules`)
 *   - which breakdown sections the model returns (`sections`)
 *   - which enhancement toggles make sense (`enhancements`)
 *   - quick-start angles and copy for the modal
 *   - how a thumbnail made from the prompt is stored (`thumbnail`)
 *
 * `getGtmStudioProfile(appTheme)` resolves any theme key used across the app.
 */

/** Output "kinds" — shared rules for studios that feed the same model type. */
const KINDS = {
  video: {
    kind: 'video',
    kindLabel: 'Video prompt',
    unit: 'video',
    promptLabel: 'Video idea',
    placeholder: 'e.g. A 20s launch teaser for our AI note-taking app aimed at busy founders',
    finalPromptRules: [
      'finalPrompt: ONE flowing paragraph (60–120 words) a text-to-video model can follow directly.',
      'Describe subject, action, setting, camera movement, lens, lighting, mood and pacing in plain sentences.',
      'No labels, no bullet points, no markdown, no scene numbers, no quotation marks around the whole prompt.',
    ],
    sections: ['Hook', 'Scene 1', 'Scene 2', 'Scene 3', 'Camera & lighting', 'Sound', 'Call to action'],
    enhancements: [
      { key: 'openingHook', label: 'Scroll-stopping hook', instruction: 'Open on a strong visual hook in the first 2 seconds.' },
      { key: 'storytellingStructure', label: '3-act story', instruction: 'Use a clear problem → turn → payoff arc.' },
      { key: 'visualElements', label: 'Cinematography', instruction: 'Specify camera movement, lens, lighting and composition.' },
      { key: 'audioElements', label: 'Sound design', instruction: 'Describe music, SFX and voice tone.' },
      { key: 'pacingEditing', label: 'Pacing & edit', instruction: 'Specify pacing, rhythm and cut style.' },
      { key: 'emotionalEngagement', label: 'Emotion', instruction: 'Build an emotional beat the audience feels.' },
      { key: 'ctaIntegration', label: 'Call to action', instruction: 'End on a clear, conversion-focused CTA.' },
    ],
    angles: ['Product launch', 'Customer story', 'Problem → solution', 'Behind the scenes', 'Offer / promo'],
    hasDuration: true,
  },
  image: {
    kind: 'image',
    kindLabel: 'Image prompt',
    unit: 'image',
    promptLabel: 'Image idea',
    placeholder: 'e.g. Hero image for a premium cold-brew coffee brand landing page',
    finalPromptRules: [
      'finalPrompt: ONE dense image-generation prompt (40–90 words) describing a single still frame.',
      'Cover subject, setting, composition, lens/angle, lighting, color palette, materials and art style.',
      'Never mention camera movement, sound, scenes, beats, duration or "video". No labels or markdown.',
      'If on-image text helps conversion, give the exact short text in double quotes and where it sits.',
    ],
    sections: ['Concept', 'Subject', 'Composition', 'Lighting & color', 'Style', 'On-image text'],
    enhancements: [
      { key: 'openingHook', label: 'Stop-the-scroll focal point', instruction: 'Give the frame one unmistakable focal point.' },
      { key: 'visualElements', label: 'Composition & lens', instruction: 'Specify composition, angle and lens.' },
      { key: 'lighting', label: 'Lighting & palette', instruction: 'Specify lighting setup and a deliberate color palette.' },
      { key: 'emotionalEngagement', label: 'Emotion', instruction: 'Make the image evoke a specific feeling in the target buyer.' },
      { key: 'ctaIntegration', label: 'Headline / CTA text', instruction: 'Include short, legible on-image headline or CTA text.' },
    ],
    angles: ['Hero / landing page', 'Social ad', 'Product shot', 'Lifestyle', 'Before / after'],
    hasDuration: false,
  },
  avatar: {
    kind: 'avatar',
    kindLabel: 'Avatar script',
    unit: 'video',
    promptLabel: 'What should the presenter say?',
    placeholder: 'e.g. A 30s intro explaining how our CRM saves sales reps 5 hours a week',
    finalPromptRules: [
      'finalPrompt: the EXACT words the AI presenter will speak (60–150 words), first person, natural spoken rhythm.',
      'Short sentences, contractions, one idea per sentence. End with the call to action.',
      'No stage directions, no brackets, no speaker labels, no emojis, no markdown.',
    ],
    sections: ['Opening line', 'Talking points', 'Proof', 'Delivery & tone', 'Call to action'],
    enhancements: [
      { key: 'openingHook', label: 'Hook in line one', instruction: 'The first sentence must hook the viewer.' },
      { key: 'storytellingStructure', label: 'Problem → solution', instruction: 'Structure as problem, solution, proof.' },
      { key: 'emotionalEngagement', label: 'Empathy', instruction: 'Acknowledge the viewer\'s pain before pitching.' },
      { key: 'ctaIntegration', label: 'Call to action', instruction: 'Close with one clear spoken CTA.' },
    ],
    angles: ['Explainer', 'Sales outreach', 'Onboarding', 'Testimonial-style', 'Announcement'],
    hasDuration: true,
  },
  lipsync: {
    kind: 'lipsync',
    kindLabel: 'Dialogue script',
    unit: 'video',
    promptLabel: 'What should be said?',
    placeholder: 'e.g. A friendly 15s product shout-out for our skincare line',
    finalPromptRules: [
      'finalPrompt: ONLY the spoken dialogue to lip-sync (30–110 words), conversational and easy to pronounce.',
      'No stage directions, brackets, speaker labels, emojis or markdown.',
    ],
    sections: ['Opening line', 'Script', 'Delivery', 'Call to action'],
    enhancements: [
      { key: 'openingHook', label: 'Hook in line one', instruction: 'The first sentence must hook the viewer.' },
      { key: 'emotionalEngagement', label: 'Personality', instruction: 'Give the delivery a distinct, likeable personality.' },
      { key: 'ctaIntegration', label: 'Call to action', instruction: 'Close with one clear spoken CTA.' },
    ],
    angles: ['Shout-out', 'Promo', 'Tutorial line', 'Reaction', 'Announcement'],
    hasDuration: true,
  },
  audio: {
    kind: 'audio',
    kindLabel: 'Audio brief',
    unit: 'track',
    promptLabel: 'Audio idea',
    placeholder: 'e.g. Upbeat 30s background track for a fintech product demo, or a voiceover for our launch',
    finalPromptRules: [
      'finalPrompt: a ready-to-use audio generation prompt (30–90 words).',
      'For music: genre, sub-genre, instruments, tempo in BPM, key/mood, energy curve and vocal style (or "instrumental").',
      'If the base prompt asks for speech or a voiceover, finalPrompt is instead the exact words to be spoken.',
      'No markdown, no labels.',
    ],
    sections: ['Hook', 'Genre & instruments', 'Mood & tempo', 'Voice / lyrics', 'Call to action'],
    enhancements: [
      { key: 'openingHook', label: 'Instant hook', instruction: 'Grab attention in the first 3 seconds.' },
      { key: 'audioElements', label: 'Production detail', instruction: 'Specify instruments, mix and production style.' },
      { key: 'emotionalEngagement', label: 'Emotion', instruction: 'Target one clear emotion for the brand moment.' },
      { key: 'ctaIntegration', label: 'Sonic CTA', instruction: 'Leave room for (or include) a spoken call to action.' },
    ],
    angles: ['Background music', 'Voiceover', 'Jingle / sonic logo', 'Podcast intro', 'Ad spot'],
    hasDuration: true,
  },
  storyboard: {
    kind: 'storyboard',
    kindLabel: 'Storyboard concept',
    unit: 'storyboard',
    promptLabel: 'Story concept',
    placeholder: 'e.g. A 4-frame story showing a remote team discovering our async video tool',
    finalPromptRules: [
      'finalPrompt: a storyboard concept of 3–5 sentences: the story arc, the main character(s), the setting and the visual style.',
      'Write it so it can be split into 4–6 frames. No frame labels, no markdown.',
    ],
    sections: ['Hook', 'Frame 1', 'Frame 2', 'Frame 3', 'Frame 4', 'Visual style', 'Call to action'],
    enhancements: [
      { key: 'openingHook', label: 'Hook frame', instruction: 'Frame 1 must be a visual hook.' },
      { key: 'storytellingStructure', label: 'Story arc', instruction: 'Clear setup, conflict and payoff across frames.' },
      { key: 'visualElements', label: 'Consistent style', instruction: 'Keep characters and style consistent across frames.' },
      { key: 'ctaIntegration', label: 'Call to action', instruction: 'Final frame lands the CTA.' },
    ],
    angles: ['Product journey', 'Customer story', 'Explainer', 'Ad concept', 'Social series'],
    hasDuration: true,
  },
};

/**
 * Theme key → studio. `thumbnailStudioId` must match the key each studio uses
 * with saveCustomThumbnailToCache() so a GTM-made thumbnail lands on it.
 */
const STUDIOS = {
  'video-studio': { kind: 'video', studioName: 'Video Studio', thumbnailStudioId: 'video-studio', aspectRatio: '16:9' },
  'text-to-video': { kind: 'video', studioName: 'Text to Video', thumbnailStudioId: 'video-studio', aspectRatio: '16:9' },
  'image-to-video': { kind: 'video', studioName: 'Image to Video', thumbnailStudioId: 'video-studio', aspectRatio: '16:9' },
  'video-to-video': { kind: 'video', studioName: 'Video to Video', thumbnailStudioId: 'video-studio', aspectRatio: '16:9' },
  'cinema-studio': { kind: 'video', studioName: 'Cinema Studio', thumbnailStudioId: 'cinema-studio', aspectRatio: '16:9' },
  'cinema-template-studio': { kind: 'video', studioName: 'Cinema Template Studio', thumbnailStudioId: null, aspectRatio: '16:9' },
  'template-studio': { kind: 'video', studioName: 'Template Studio', thumbnailStudioId: null, aspectRatio: '16:9' },
  'video-tools-studio': { kind: 'video', studioName: 'Video Tools Studio', thumbnailStudioId: 'videotools-studio', aspectRatio: '16:9' },
  'effects-studio': { kind: 'video', studioName: 'Vibe Motion', thumbnailStudioId: 'effects-studio', aspectRatio: '16:9' },
  'timeline-editor': { kind: 'video', studioName: 'Timeline Editor', thumbnailStudioId: null, aspectRatio: '16:9' },
  'image-studio': { kind: 'image', studioName: 'Image Studio', thumbnailStudioId: 'image-studio', aspectRatio: '1:1' },
  'text-to-image': { kind: 'image', studioName: 'Text to Image', thumbnailStudioId: 'image-studio', aspectRatio: '1:1' },
  'image-to-image': { kind: 'image', studioName: 'Image Edit', thumbnailStudioId: 'image-studio', aspectRatio: '1:1' },
  'character-studio': { kind: 'image', studioName: 'Character Studio', thumbnailStudioId: 'character-studio', aspectRatio: '1:1' },
  'influencer-studio': { kind: 'image', studioName: 'AI Influencer Studio', thumbnailStudioId: 'influencer-studio', aspectRatio: '1:1' },
  'avatar-studio': { kind: 'avatar', studioName: 'Avatar Studio', thumbnailStudioId: 'avatar-studio', aspectRatio: '16:9' },
  'lip-sync-studio': { kind: 'lipsync', studioName: 'Lip Sync Studio', thumbnailStudioId: 'lipsync-studio', aspectRatio: '16:9' },
  'audio-studio': { kind: 'audio', studioName: 'Audio Studio', thumbnailStudioId: 'audio-studio', aspectRatio: '1:1' },
  'storyboard-studio': { kind: 'storyboard', studioName: 'Storyboard Studio', thumbnailStudioId: 'storyboard-studio', aspectRatio: '16:9' },
  'storyboard-frame': { kind: 'image', studioName: 'Storyboard frame', thumbnailStudioId: 'storyboard-studio', aspectRatio: '16:9' },
};

const DEFAULT_THEME = 'timeline-editor';

/**
 * Resolve the GTM profile for a studio theme key. Unknown keys fall back to
 * the generic video profile so GTM Boost always opens.
 *
 * `outputType` lets multi-format studios (Template / Cinema Template) shape
 * the result for the template actually being edited ('image' | 'video' | 'audio').
 * @param {string} appTheme
 * @param {{ outputType?: string }} [options]
 */
export function getGtmStudioProfile(appTheme, { outputType } = {}) {
  const studio = STUDIOS[appTheme] || STUDIOS[DEFAULT_THEME];
  const kindKey = (outputType && KINDS[outputType] && ['image', 'video', 'audio'].includes(outputType))
    ? outputType
    : studio.kind;
  const kind = KINDS[kindKey] || KINDS.video;
  return {
    ...kind,
    theme: STUDIOS[appTheme] ? appTheme : DEFAULT_THEME,
    studioName: studio.studioName,
    thumbnail: {
      studioId: studio.thumbnailStudioId,
      aspectRatio: studio.aspectRatio,
      outputType: kind.unit === 'track' ? 'audio' : (kind.kind === 'image' ? 'image' : 'video'),
    },
  };
}

/** Every theme key that has a dedicated profile (used by tests). */
export function getGtmStudioThemes() {
  return Object.keys(STUDIOS);
}

/** Default on/off state for a profile's enhancement toggles. */
export function defaultEnhancements(profile) {
  return Object.fromEntries((profile?.enhancements || []).map((e) => [e.key, true]));
}

/**
 * Studio-agnostic Structured Outputs schema. `sections` carries the
 * studio-specific breakdown; `finalPrompt` is what gets applied.
 */
export const GTM_STUDIO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    finalPrompt: { type: 'string' },
    angle: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['label', 'content'],
      },
    },
    cta: { type: 'string' },
    estimatedDurationSec: { type: 'integer' },
  },
  required: ['finalPrompt', 'angle', 'sections', 'cta', 'estimatedDurationSec'],
};

/**
 * Normalize any GTM result into the studio shape. Accepts the current schema
 * and the legacy video schema (hook / storybeat_1..3 / visualDirection /
 * audioDirection / cta) still returned by the edge-function fallback.
 * @returns {{finalPrompt: string, angle: string, sections: Array<{label: string, content: string}>, cta: string, estimatedDurationSec: number}|null}
 */
export function normalizeGtmResult(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.finalPrompt === 'string') {
    return {
      finalPrompt: raw.finalPrompt.trim(),
      angle: raw.angle || '',
      sections: Array.isArray(raw.sections)
        ? raw.sections.filter((s) => s && s.content).map((s) => ({ label: String(s.label || ''), content: String(s.content) }))
        : [],
      cta: raw.cta || '',
      estimatedDurationSec: Number.isFinite(raw.estimatedDurationSec) ? raw.estimatedDurationSec : 0,
    };
  }
  const legacy = [
    ['Hook', raw.hook],
    ['Scene 1', raw.storybeat_1],
    ['Scene 2', raw.storybeat_2],
    ['Scene 3', raw.storybeat_3],
    ['Camera & lighting', raw.visualDirection],
    ['Sound', raw.audioDirection],
  ].filter(([, v]) => v);
  if (legacy.length === 0 && !raw.cta) return null;
  const finalPrompt = [raw.hook, raw.storybeat_1, raw.storybeat_2, raw.storybeat_3, raw.visualDirection]
    .filter(Boolean)
    .join(' ')
    .trim();
  return {
    finalPrompt,
    angle: raw.hook || '',
    sections: legacy.map(([label, content]) => ({ label, content: String(content) })),
    cta: raw.cta || '',
    estimatedDurationSec: Number.isFinite(raw.estimatedDurationSec) ? raw.estimatedDurationSec : 0,
  };
}

/**
 * Offline fallback used when no OpenAI key / edge function is available:
 * builds a concise prompt in the right shape for the studio instead of the
 * long GTM framework dump (which is unusable as an image/audio prompt).
 */
export function buildLocalStudioPrompt(profile, params = {}, labels = {}) {
  const base = String(params.basePrompt || '').trim().replace(/\s+/g, ' ');
  const audience = [labels.role, labels.industry && `in ${labels.industry}`].filter(Boolean).join(' ');
  const style = labels.tonality ? `${labels.tonality} tone` : '';
  const angle = params.angle ? `${params.angle}: ` : '';
  const forWho = audience ? ` for ${audience}` : '';

  let finalPrompt;
  switch (profile.kind) {
    case 'image':
      finalPrompt = `${angle}${base}${forWho}. Single striking focal point, clean composition with clear negative space, professional commercial photography, soft directional key light, cohesive brand color palette, high detail, sharp focus${style ? `, ${style}` : ''}.`;
      break;
    case 'avatar':
    case 'lipsync':
      // Spoken script: keep the user's own message, framed for the listener.
      finalPrompt = `${base}${forWho ? ` If you're ${audience.replace(/^(an?|the) /i, '')}, this is for you.` : ''} Want to see it in action? Try it today.`;
      break;
    case 'audio':
      finalPrompt = `${angle}${base}${forWho}. Modern, polished production, clear hook in the first 3 seconds, steady 100–120 BPM groove, warm low end, bright top, builds energy toward the end${style ? `, ${style}` : ''}.`;
      break;
    case 'storyboard':
      finalPrompt = `${angle}${base}${forWho}. Open on a visual hook that shows the problem, follow the main character as they discover the solution, show the moment it works, and end on the result with a clear call to action. Consistent characters and a cohesive visual style across every frame.`;
      break;
    default:
      finalPrompt = `${angle}${base}${forWho}. Open on a bold visual hook, then a smooth dolly-in on the subject as the story turns from problem to payoff; cinematic lighting, shallow depth of field, confident pacing with quick cuts, ending on a clear call to action${style ? `, ${style}` : ''}.`;
  }

  return {
    finalPrompt: finalPrompt.replace(/\s+/g, ' ').replace(/\.\./g, '.').trim(),
    angle: params.angle || '',
    sections: [],
    cta: '',
    estimatedDurationSec: profile.hasDuration ? 30 : 0,
  };
}

export const GTM_GOALS = [
  { value: 'lead-gen', label: 'Leads' },
  { value: 'awareness', label: 'Awareness' },
  { value: 'education', label: 'Education' },
  { value: 'demo', label: 'Product demo' },
];

export default getGtmStudioProfile;
