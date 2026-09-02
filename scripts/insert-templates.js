import fs from 'fs';

const filePath = 'src/lib/sceneSchema.js';
let content = fs.readFileSync(filePath, 'utf8');

const registryStart = content.indexOf('export class SceneTemplateRegistry');
if (registryStart === -1) {
  console.error('Could not find SceneTemplateRegistry');
  process.exit(1);
}

const beforeRegistry = content.slice(0, registryStart);
const afterRegistry = content.slice(registryStart);

const SHOT = {
  extreme_wide: 'SHOT_TYPES.EXTREME_WIDE', wide: 'SHOT_TYPES.WIDE',
  medium_wide: 'SHOT_TYPES.MEDIUM_WIDE', medium: 'SHOT_TYPES.MEDIUM',
  medium_close_up: 'SHOT_TYPES.MEDIUM_CLOSE_UP', close_up: 'SHOT_TYPES.CLOSE_UP',
  extreme_close_up: 'SHOT_TYPES.EXTREME_CLOSE_UP', insert: 'SHOT_TYPES.INSERT',
  two_shot: 'SHOT_TYPES.TWO_SHOT', over_shoulder: 'SHOT_TYPES.OVER_SHOULDER',
  profile: 'SHOT_TYPES.PROFILE', pov: 'SHOT_TYPES.POV',
  birdseye: 'SHOT_TYPES.BIRDSEYE', low_angle: 'SHOT_TYPES.LOW_ANGLE',
  high_angle: 'SHOT_TYPES.HIGH_ANGLE', dutch_angle: 'SHOT_TYPES.DUTCH_ANGLE',
  tracking: 'SHOT_TYPES.TRACKING', dolly: 'SHOT_TYPES.DOLLY',
  crane: 'SHOT_TYPES.CRANE', steadicam: 'SHOT_TYPES.STEADICAM',
  handheld: 'SHOT_TYPES.HANDHELD', aerial: 'SHOT_TYPES.AERIAL',
  macro: 'SHOT_TYPES.MACRO',
};

const EMOTION = {
  neutral: 'EMOTIONAL_TONES.NEUTRAL', tense: 'EMOTIONAL_TONES.TENSE',
  curious: 'EMOTIONAL_TONES.CURIOUS', mysterious: 'EMOTIONAL_TONES.MYSTERIOUS',
  hopeful: 'EMOTIONAL_TONES.HOPEFUL', joyful: 'EMOTIONAL_TONES.JOYFUL',
  sad: 'EMOTIONAL_TONES.SAD', dark: 'EMOTIONAL_TONES.DARK',
  epic: 'EMOTIONAL_TONES.EPIC', romantic: 'EMOTIONAL_TONES.ROMANTIC',
  urgent: 'EMOTIONAL_TONES.URGENT', inspired: 'EMOTIONAL_TONES.INSPIRATIONAL',
  peaceful: 'EMOTIONAL_TONES.PEACEFUL', nostalgic: 'EMOTIONAL_TONES.NOSTALGIC',
  surreal: 'EMOTIONAL_TONES.SURREAL', triumphant: 'EMOTIONAL_TONES.TRIUMPHANT',
  dangerous: 'EMOTIONAL_TONES.DANGEROUS', surprised: 'EMOTIONAL_TONES.SURPRISE',
  fearful: 'EMOTIONAL_TONES.FEAR', angry: 'EMOTIONAL_TONES.ANGER',
  determined: 'EMOTIONAL_TONES.DETERMINATION', reflective: 'EMOTIONAL_TONES.REFLECTIVE',
  amazed: 'EMOTIONAL_TONES.AMAZED', awe: 'EMOTIONAL_TONES.AWE',
  bittersweet: 'EMOTIONAL_TONES.BITTERSWEET', anticipatory: 'EMOTIONAL_TONES.ANTICIPATORY',
  uplifting: 'EMOTIONAL_TONES.UPLIFTING', adventurous: 'EMOTIONAL_TONES.ADVENTUROUS',
  immersive: 'EMOTIONAL_TONES.IMMERSIVE', analytical: 'EMOTIONAL_TONES.ANALYTICAL',
  shocking: 'EMOTIONAL_TONES.SHOCKING', satisfying: 'EMOTIONAL_TONES.SATISFYING',
  dramatic: 'EMOTIONAL_TONES.DRAMATIC', energetic: 'EMOTIONAL_TONES.ENERGETIC',
  routine: 'EMOTIONAL_TONES.ROUTINE', content: 'EMOTIONAL_TONES.CONTENT',
  grand: 'EMOTIONAL_TONES.GRAND', warm: 'EMOTIONAL_TONES.WARM',
  confrontational: 'EMOTIONAL_TONES.CONFRONTATIONAL', intimate: 'EMOTIONAL_TONES.INTIMATE',
};

const SCENE_TYPE = {
  cold_open: 'SCENE_TYPES.COLD_OPEN', hook: 'SCENE_TYPES.HOOK',
  establishing: 'SCENE_TYPES.ESTABLISHING',
  character_introduction: 'SCENE_TYPES.CHARACTER_INTRODUCTION',
  character_reaction: 'SCENE_TYPES.CHARACTER_REACTION',
  dialogue: 'SCENE_TYPES.DIALOGUE', conversation: 'SCENE_TYPES.CONVERSATION',
  pov: 'SCENE_TYPES.POV', action: 'SCENE_TYPES.ACTION',
  discovery: 'SCENE_TYPES.DISCOVERY', investigation: 'SCENE_TYPES.INVESTIGATION',
  reveal: 'SCENE_TYPES.REVEAL', transformation: 'SCENE_TYPES.TRANSFORMATION',
  journey: 'SCENE_TYPES.JOURNEY', montage: 'SCENE_TYPES.MONTAGE',
  conflict: 'SCENE_TYPES.CONFLICT', chase: 'SCENE_TYPES.CHASE',
  escape: 'SCENE_TYPES.ESCAPE', rescue: 'SCENE_TYPES.RESCUE',
  suspense: 'SCENE_TYPES.SUSPENSE', horror: 'SCENE_TYPES.HORROR',
  comedy: 'SCENE_TYPES.COMEDY', emotional: 'SCENE_TYPES.EMOTIONAL',
  flashback: 'SCENE_TYPES.FLASHBACK', dream: 'SCENE_TYPES.DREAM',
  surreal: 'SCENE_TYPES.SURREAL', technology: 'SCENE_TYPES.TECHNOLOGY',
  product: 'SCENE_TYPES.PRODUCT', demonstration: 'SCENE_TYPES.DEMONSTRATION',
  testimonial: 'SCENE_TYPES.TESTIMONIAL', documentary: 'SCENE_TYPES.DOCUMENTARY',
  interview: 'SCENE_TYPES.INTERVIEW', explainer: 'SCENE_TYPES.EXPLAINER',
  visualization: 'SCENE_TYPES.VISUALIZATION',
  time_passage: 'SCENE_TYPES.TIME_PASSAGE',
  scale_reveal: 'SCENE_TYPES.SCALE_REVEAL',
  climax: 'SCENE_TYPES.CLIMAX', resolution: 'SCENE_TYPES.RESOLUTION',
  emotional_ending: 'SCENE_TYPES.EMOTIONAL_ENDING',
  cta: 'SCENE_TYPES.CTA', end_card: 'SCENE_TYPES.END_CARD',
};

function makeTemplate(tid, name, sceneType, duration, shots, emotion, genres, intensity = 0.5, extras = {}) {
  const st = SCENE_TYPE[sceneType] || sceneType;
  const em = EMOTION[emotion] || emotion;
  const shotLines = shots.map(s => {
    const stype = SHOT[s[0]] || s[0];
    const dur = s[1] || 3;
    return `      { shot_type: ${stype}, purpose: '${s[2]}', duration: ${dur} }`;
  }).join(',\n');

  const extraLines = [];
  if (extras.description) extraLines.push(`    description: '${extras.description}',`);
  if (extras.required_fields) extraLines.push(`    required_fields: ${JSON.stringify(extras.required_fields)},`);
  if (extras.story_function) extraLines.push(`    story_function: '${extras.story_function}',`);
  if (extras.narrative_role) extraLines.push(`    narrative_role: '${extras.narrative_role}',`);
  if (extras.pacing) extraLines.push(`    pacing: '${extras.pacing}',`);
  if (extras.keywords) extraLines.push(`    keywords: ${JSON.stringify(extras.keywords)},`);

  return `  ${tid}: {
    id: '${tid}',
    name: '${name}',
    scene_type: ${st},
    default_duration: ${duration},
    shot_sequence: [
${shotLines}
    ],
    emotion: ${em},
    compatible_genres: ${JSON.stringify(genres)},
    intensity: ${intensity},
${extraLines.join('\n')}
  },`;
}

const templates = [];

function add(tid, name, sceneType, duration, shots, emotion, genres, intensity, extras) {
  templates.push(makeTemplate(tid, name, sceneType, duration, shots, emotion, genres, intensity, extras));
}

// Generate all templates here
// (This will be populated by the Python script output)

const newContent = beforeRegistry + templates.join('\n\n') + '\n' + afterRegistry;
fs.writeFileSync(filePath, newContent);
console.log(`Inserted ${templates.length} templates into ${filePath}`);
