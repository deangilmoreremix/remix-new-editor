import fs from 'fs';

const filePath = 'src/lib/sceneSchema.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find the registry class start
const registryStart = content.indexOf('export class SceneTemplateRegistry');
if (registryStart === -1) {
  console.error('Could not find SceneTemplateRegistry');
  process.exit(1);
}

const beforeRegistry = content.slice(0, registryStart);
const afterRegistry = content.slice(registryStart);

// Find the last }; before the registry class
const lastCloseBrace = beforeRegistry.lastIndexOf('};');
if (lastCloseBrace === -1) {
  console.error('Could not find closing brace');
  process.exit(1);
}

const beforeTemplatesEnd = beforeRegistry.slice(0, lastCloseBrace);
const templatesEnd = beforeRegistry.slice(lastCloseBrace);

console.log(`Found closing brace at index ${lastCloseBrace}`);
console.log(`Templates end: ${templatesEnd.slice(0, 100)}...`);

// If templatesEnd doesn't start with }; then something is wrong
if (!templatesEnd.startsWith('};')) {
  console.error('Expected }; but got:', templatesEnd.slice(0, 50));
  process.exit(1);
}

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
let count = 0;

function add(tid, name, sceneType, duration, shots, emotion, genres, intensity, extras) {
  if (count >= 500) return;
  templates.push(makeTemplate(tid, name, sceneType, duration, shots, emotion, genres, intensity, extras));
  count++;
}

const emotionShots = [
  [['medium',2,'setup'],['close_up',2,'reaction'],['extreme_close_up',2,'peak']],
  [['wide',2,'context'],['medium',2,'build'],['close_up',3,'emotion']],
  [['close_up',2,'face'],['medium',2,'body'],['wide',2,'environment']],
];
const allEmotions = ['neutral','tense','curious','mysterious','hopeful','joyful','sad','dark','epic','romantic','urgent','inspired','peaceful','nostalgic','surreal','triumphant','dangerous','surprised','fearful','angry','determined','reflective','amazed','awe','bittersweet','anticipatory','uplifting','adventurous','immersive','analytical','shocking','satisfying','dramatic','energetic','routine','content','grand','warm','confrontational','intimate'];

const categories = [
  { prefix: 'character_emotion', sceneType: 'character_reaction', count: 40, duration: [4,10], genres: ['all'] },
  { prefix: 'character_action', sceneType: 'action', count: 40, duration: [5,12], genres: ['all'] },
  { prefix: 'dialogue_scene', sceneType: 'dialogue', count: 30, duration: [8,15], genres: ['all'] },
  { prefix: 'pov_scene', sceneType: 'pov', count: 25, duration: [6,12], genres: ['all'] },
  { prefix: 'discovery_scene', sceneType: 'discovery', count: 30, duration: [6,12], genres: ['all'] },
  { prefix: 'reveal_scene', sceneType: 'reveal', count: 25, duration: [5,10], genres: ['all'] },
  { prefix: 'investigation_scene', sceneType: 'investigation', count: 20, duration: [8,15], genres: ['all'] },
  { prefix: 'travel_scene', sceneType: 'journey', count: 25, duration: [8,15], genres: ['all'] },
  { prefix: 'montage_scene', sceneType: 'montage', count: 25, duration: [8,20], genres: ['all'] },
  { prefix: 'conflict_scene', sceneType: 'conflict', count: 25, duration: [8,20], genres: ['all'] },
  { prefix: 'chase_scene', sceneType: 'chase', count: 20, duration: [10,25], genres: ['action','thriller'] },
  { prefix: 'suspense_scene', sceneType: 'suspense', count: 20, duration: [8,15], genres: ['all'] },
  { prefix: 'horror_scene', sceneType: 'horror', count: 20, duration: [8,15], genres: ['horror','thriller'] },
  { prefix: 'romance_scene', sceneType: 'emotional', count: 25, duration: [6,12], genres: ['romance','drama'] },
  { prefix: 'flashback_scene', sceneType: 'flashback', count: 20, duration: [6,12], genres: ['all'] },
  { prefix: 'technology_scene', sceneType: 'technology', count: 20, duration: [6,12], genres: ['tech','business'] },
  { prefix: 'business_scene', sceneType: 'demonstration', count: 25, duration: [6,15], genres: ['business','corporate'] },
  { prefix: 'commercial_scene', sceneType: 'product', count: 30, duration: [5,12], genres: ['commercial','all'] },
  { prefix: 'social_scene', sceneType: 'explainer', count: 25, duration: [4,10], genres: ['social','marketing'] },
  { prefix: 'documentary_scene', sceneType: 'documentary', count: 25, duration: [8,20], genres: ['documentary','all'] },
  { prefix: 'testimonial_scene', sceneType: 'testimonial', count: 20, duration: [8,15], genres: ['business','commercial'] },
  { prefix: 'environment_scene', sceneType: 'establishing', count: 25, duration: [5,10], genres: ['all'] },
  { prefix: 'transition_scene', sceneType: 'dream', count: 20, duration: [3,8], genres: ['all'] },
  { prefix: 'timelapse_scene', sceneType: 'time_passage', count: 15, duration: [5,10], genres: ['all'] },
  { prefix: 'scale_scene', sceneType: 'scale_reveal', count: 15, duration: [5,10], genres: ['all'] },
  { prefix: 'epic_scene', sceneType: 'climax', count: 20, duration: [10,20], genres: ['action','adventure'] },
  { prefix: 'comedy_scene', sceneType: 'comedy', count: 20, duration: [5,10], genres: ['comedy','all'] },
  { prefix: 'explainer_scene', sceneType: 'explainer', count: 20, duration: [8,15], genres: ['education','business'] },
  { prefix: 'narrator_scene', sceneType: 'interview', count: 20, duration: [8,15], genres: ['documentary','all'] },
  { prefix: 'sports_scene', sceneType: 'action', count: 15, duration: [8,15], genres: ['sports','documentary'] },
  { prefix: 'food_scene', sceneType: 'demonstration', count: 15, duration: [6,12], genres: ['lifestyle','food'] },
  { prefix: 'fashion_scene', sceneType: 'product', count: 15, duration: [5,10], genres: ['fashion','commercial'] },
  { prefix: 'music_scene', sceneType: 'montage', count: 15, duration: [5,10], genres: ['music','performance'] },
  { prefix: 'title_scene', sceneType: 'hook', count: 15, duration: [3,8], genres: ['all'] },
  { prefix: 'ending_scene', sceneType: 'resolution', count: 20, duration: [5,10], genres: ['all'] },
  { prefix: 'cta_scene', sceneType: 'cta', count: 15, duration: [4,8], genres: ['commercial','all'] },
];

for (const cat of categories) {
  if (count >= 500) break;
  for (let i = 1; i <= cat.count && count < 500; i++) {
    const emotion = allEmotions[Math.floor(Math.random() * allEmotions.length)];
    const duration = cat.duration[0] + Math.floor(Math.random() * (cat.duration[1] - cat.duration[0]));
    const shots = emotionShots[Math.floor(Math.random() * emotionShots.length)];
    const tid = `${cat.prefix}_${i}`;
    const name = `${cat.prefix.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} ${i}`;
    add(tid, name, cat.sceneType, duration, shots, emotion, cat.genres, 0.5, {});
  }
}

// Insert templates BEFORE the closing }; of SCENE_TEMPLATES
// Add a comma after the last existing template, then add new templates
const newContent = beforeTemplatesEnd + ',\n\n' + templates.join('\n\n') + '\n' + templatesEnd + afterRegistry;
fs.writeFileSync(filePath, newContent);
console.log(`Total templates generated: ${count}`);
console.log(`File size: ${newContent.length} bytes`);
