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

// Shot type mappings
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
  if (extras.required_fields) extraLines.push(`    required_fields: JSON.stringify(${JSON.stringify(extras.required_fields)}),`);
  if (extras.story_function) extraLines.push(`    story_function: '${extras.story_function}',`);
  if (extras.narrative_role) extraLines.push(`    narrative_role: '${extras.narrative_role}',`);
  if (extras.pacing) extraLines.push(`    pacing: '${extras.pacing}',`);
  if (extras.keywords) extraLines.push(`    keywords: JSON.stringify(${JSON.stringify(extras.keywords)}),`);

  return `  ${tid}: {
    id: '${tid}',
    name: '${name}',
    scene_type: ${st},
    default_duration: ${duration},
    shot_sequence: [
${shotLines}
    ],
    emotion: ${em},
    compatible_genres: JSON.stringify(${JSON.stringify(genres)}),
    intensity: ${intensity},
${extraLines.join('\n')}
  },`;
}

const templates = [];

function add(tid, name, sceneType, duration, shots, emotion, genres, intensity, extras) {
  templates.push(makeTemplate(tid, name, sceneType, duration, shots, emotion, genres, intensity, extras));
}

// ============================================
// CHARACTER EMOTION (20)
// ============================================
add('emotion_surprise', 'Emotion - Surprise', 'character_reaction', 6, [['medium',2,'normal'],['close_up',2,'trigger'],['extreme_close_up',2,'reaction']], 'surprised', ['all'], 0.5, {description:'Surprise reaction'});
add('emotion_fear', 'Emotion - Fear', 'character_reaction', 8, [['wide',2,'environment'],['medium',2,'trigger'],['close_up',2,'retreat'],['medium',2,'escape']], 'fearful', ['horror','thriller'], 0.5, {description:'Fear reaction'});
add('emotion_anger', 'Emotion - Anger', 'character_reaction', 8, [['medium',2,'trigger'],['close_up',2,'face'],['medium',2,'action'],['wide',2,'impact']], 'angry', ['drama','action'], 0.5, {description:'Anger reaction'});
add('emotion_sadness', 'Emotion - Sadness', 'character_reaction', 8, [['wide',2,'environment'],['medium',2,'character'],['close_up',3,'silence']], 'sad', ['drama','romance'], 0.5, {description:'Sadness reaction'});
add('emotion_joy', 'Emotion - Joy', 'character_reaction', 6, [['medium',2,'discovery'],['close_up',2,'smile'],['medium',2,'interaction']], 'joyful', ['all'], 0.5, {description:'Joy reaction'});
add('emotion_confusion', 'Emotion - Confusion', 'character_reaction', 6, [['medium',2,'event'],['close_up',2,'looks'],['wide',2,'environment']], 'curious', ['drama','comedy'], 0.5, {description:'Confusion reaction'});
add('emotion_determination', 'Emotion - Determination', 'character_reaction', 6, [['medium',2,'failure'],['close_up',2,'pause'],['medium',2,'action']], 'determined', ['all'], 0.5, {description:'Determination moment'});
add('emotion_realization', 'Emotion - Realization', 'character_reaction', 6, [['insert',2,'clue'],['close_up',2,'thinking'],['medium',2,'action']], 'amazed', ['mystery','drama'], 0.5, {description:'Realization moment'});
add('emotion_grief', 'Emotion - Grief', 'character_reaction', 10, [['wide',2,'event'],['medium',2,'silence'],['close_up',3,'reaction'],['medium',3,'memory']], 'sad', ['drama'], 0.5, {description:'Grief moment'});
add('emotion_hope', 'Emotion - Hope', 'character_reaction', 6, [['wide',2,'dark'],['medium',2,'light_appears'],['close_up',2,'character']], 'hopeful', ['drama','adventure'], 0.5, {description:'Hope moment'});
add('emotion_relief', 'Emotion - Relief', 'character_reaction', 5, [['medium',2,'tension'],['close_up',2,'release'],['wide',1,'peace']], 'peaceful', ['drama','comedy'], 0.5, {description:'Relief moment'});
add('emotion_embarrassment', 'Emotion - Embarrassment', 'character_reaction', 5, [['medium',2,'mistake'],['close_up',2,'reaction'],['wide',1,'escape']], 'content', ['comedy'], 0.5, {description:'Embarrassment reaction'});
add('emotion_pride', 'Emotion - Pride', 'character_reaction', 5, [['medium',2,'achievement'],['close_up',2,'smile'],['wide',1,'celebration']], 'triumphant', ['drama','sports'], 0.5, {description:'Pride moment'});
add('emotion_jealousy', 'Emotion - Jealousy', 'character_reaction', 6, [['over_shoulder',2,'witness'],['close_up',2,'reaction'],['medium',2,'concealment']], 'dark', ['drama'], 0.5, {description:'Jealousy reaction'});
add('emotion_love', 'Emotion - Love', 'character_reaction', 6, [['medium',2,'character'],['close_up',2,'eyes'],['medium',2,'connection']], 'romantic', ['romance','drama'], 0.5, {description:'Love moment'});
add('emotion_nostalgia', 'Emotion - Nostalgia', 'character_reaction', 6, [['medium',2,'present'],['close_up',2,'memory'],['wide',2,'past']], 'nostalgic', ['drama','documentary'], 0.5, {description:'Nostalgia moment'});
add('emotion_shock', 'Emotion - Shock', 'character_reaction', 4, [['medium',2,'normal'],['extreme_close_up',2,'shock']], 'shocking', ['all'], 0.5, {description:'Shock reaction'});
add('emotion_disgust', 'Emotion - Disgust', 'character_reaction', 5, [['medium',2,'experience'],['close_up',2,'reaction'],['wide',1,'escape']], 'routine', ['comedy','horror'], 0.5, {description:'Disgust reaction'});
add('emotion_satisfaction', 'Emotion - Satisfaction', 'character_reaction', 5, [['medium',2,'completion'],['close_up',2,'satisfaction'],['wide',1,'result']], 'satisfying', ['all'], 0.5, {description:'Satisfaction moment'});
add('emotion_awe', 'Emotion - Awe', 'character_reaction', 6, [['wide',2,'scene'],['close_up',2,'reaction'],['extreme_wide',2,'scale']], 'awe', ['epic','documentary'], 0.5, {description:'Awe moment'});

// ============================================
// CHARACTER ACTION (25)
// ============================================
add('action_walking', 'Action - Walking', 'action', 8, [['wide',2,'establish'],['tracking',3,'walking'],['medium',2,'character'],['close_up',1,'face']], 'neutral', ['all'], 0.5, {description:'Character walking'});
add('action_running', 'Action - Running', 'action', 8, [['wide',2,'start'],['tracking',3,'running'],['side',2,'motion'],['close_up',1,'effort']], 'urgent', ['action','thriller'], 0.5, {description:'Character running'});
add('action_entering', 'Action - Entering', 'action', 6, [['medium',2,'approach'],['close_up',2,'door'],['wide',2,'interior']], 'curious', ['all'], 0.5, {description:'Character entering space'});
add('action_exiting', 'Action - Exiting', 'action', 6, [['medium',2,'character'],['close_up',2,'door'],['wide',2,'exterior']], 'neutral', ['all'], 0.5, {description:'Character exiting space'});
add('action_sitting', 'Action - Sitting', 'action', 6, [['medium',2,'environment'],['wide',2,'character_sits'],['close_up',2,'reaction']], 'neutral', ['drama','documentary'], 0.5, {description:'Character sitting'});
add('action_standing', 'Action - Standing', 'action', 5, [['low_angle',2,'rise'],['medium',2,'character'],['wide',1,'presence']], 'neutral', ['all'], 0.5, {description:'Character standing'});
add('action_looking', 'Action - Looking', 'action', 5, [['close_up',2,'eyes'],['medium',2,'pov'],['insert',1,'object']], 'curious', ['all'], 0.5, {description:'Character looking at something'});
add('action_searching', 'Action - Searching', 'action', 8, [['wide',2,'search'],['medium',3,'movement'],['close_up',2,'discovery'],['insert',1,'object']], 'curious', ['mystery','adventure'], 0.5, {description:'Character searching'});
add('action_working', 'Action - Working', 'action', 8, [['medium',2,'workspace'],['close_up',2,'hands'],['medium',2,'process'],['wide',2,'result']], 'neutral', ['business','documentary'], 0.5, {description:'Character working'});
add('action_building', 'Action - Building', 'action', 10, [['insert',2,'materials'],['close_up',2,'hands'],['medium',3,'process'],['wide',3,'finished']], 'inspired', ['all'], 0.5, {description:'Character building something'});
add('action_fighting', 'Action - Fighting', 'action', 15, [['wide',2,'confrontation'],['medium',3,'exchange'],['close_up',3,'impact'],['wide',3,'resolution'],['medium',2,'aftermath']], 'dangerous', ['action','thriller'], 0.5, {description:'Fighting sequence'});
add('action_driving', 'Action - Driving', 'action', 10, [['medium',2,'interior'],['wide',3,'motion'],['close_up',2,'reaction'],['wide',3,'destination']], 'urgent', ['action','drama'], 0.5, {description:'Character driving'});
add('action_flying', 'Action - Flying', 'action', 10, [['wide',2,'airport'],['medium',3,'flight'],['close_up',2,'window'],['wide',3,'destination']], 'hopeful', ['adventure','drama'], 0.5, {description:'Character flying'});
add('action_swimming', 'Action - Swimming', 'action', 8, [['wide',2,'water'],['medium',3,'swimming'],['close_up',2,'face'],['wide',1,'emergence']], 'peaceful', ['adventure','documentary'], 0.5, {description:'Character swimming'});
add('action_climbing', 'Action - Climbing', 'action', 10, [['wide',2,'mountain'],['medium',3,'climbing'],['close_up',2,'hands'],['wide',3,'summit']], 'determined', ['adventure','sports'], 0.5, {description:'Character climbing'});
add('action_dancing', 'Action - Dancing', 'action', 8, [['wide',2,'space'],['medium',3,'movement'],['close_up',2,'expression'],['wide',1,'performance']], 'joyful', ['music','romance'], 0.5, {description:'Character dancing'});
add('action_speaking', 'Action - Speaking', 'action', 6, [['close_up',2,'speaker'],['medium',2,'audience'],['wide',2,'impact']], 'neutral', ['all'], 0.5, {description:'Character speaking'});
add('action_teaching', 'Action - Teaching', 'action', 8, [['medium',2,'classroom'],['close_up',2,'explaining'],['wide',2,'students'],['medium',2,'reaction']], 'inspired', ['education','documentary'], 0.5, {description:'Character teaching'});
add('action_healing', 'Action - Healing', 'action', 8, [['medium',2,'patient'],['close_up',2,'care'],['wide',2,'environment'],['medium',2,'recovery']], 'hopeful', ['drama','documentary'], 0.5, {description:'Character healing others'});
add('action_creating', 'Action - Creating', 'action', 10, [['medium',2,'blank'],['close_up',2,'process'],['medium',3,'creation'],['wide',3,'finished']], 'inspired', ['art','documentary'], 0.5, {description:'Character creating art'});
add('action_exploring', 'Action - Exploring', 'action', 10, [['wide',2,'unknown'],['medium',3,'movement'],['close_up',2,'discovery'],['wide',3,'reveal']], 'curious', ['adventure','documentary'], 0.5, {description:'Character exploring'});
add('action_competing', 'Action - Competing', 'action', 10, [['wide',2,'arena'],['medium',3,'competition'],['close_up',2,'focus'],['wide',3,'result']], 'determined', ['sports','drama'], 0.5, {description:'Character competing'});
add('action_performing', 'Action - Performing', 'action', 8, [['medium',2,'backstage'],['close_up',2,'preparation'],['wide',3,'performance'],['medium',1,'reaction']], 'energetic', ['music','performance'], 0.5, {description:'Character performing'});
add('action_cooking', 'Action - Cooking', 'action', 8, [['medium',2,'kitchen'],['close_up',2,'preparation'],['wide',2,'cooking'],['close_up',2,'plating']], 'warm', ['lifestyle','food'], 0.5, {description:'Character cooking'});
add('action_meditating', 'Action - Meditating', 'action', 6, [['wide',2,'environment'],['medium',2,'pose'],['close_up',2,'face'],['wide',1,'peace']], 'peaceful', ['lifestyle','documentary'], 0.5, {description:'Character meditating'});

// ============================================
// CONVERSATION / DIALOGUE (20)
// ============================================
add('dialogue_two_shot', 'Dialogue - Two Shot', 'dialogue', 15, [['two_shot',3,'establish'],['over_shoulder',3,'character_a'],['over_shoulder',3,'character_b'],['close_up',2,'reaction_a'],['close_up',2,'reaction_b'],['two_shot',2,'resolution']], 'neutral', ['drama','romance','comedy'], 0.5, {description:'Standard dialogue coverage'});
add('dialogue_over_shoulder_a', 'Dialogue - Over Shoulder A', 'dialogue', 10, [['over_shoulder',3,'shoulder_a'],['close_up',3,'dialogue_a'],['medium',2,'reaction'],['over_shoulder',2,'response']], 'neutral', ['all'], 0.5, {description:'Over shoulder A coverage'});
add('dialogue_over_shoulder_b', 'Dialogue - Over Shoulder B', 'dialogue', 10, [['over_shoulder',3,'shoulder_b'],['close_up',3,'dialogue_b'],['medium',2,'reaction'],['over_shoulder',2,'response']], 'neutral', ['all'], 0.5, {description:'Over shoulder B coverage'});
add('dialogue_close_up', 'Dialogue - Close Up', 'dialogue', 8, [['close_up',3,'face'],['medium',2,'dialogue'],['close_up',3,'reaction']], 'neutral', ['drama','romance'], 0.5, {description:'Close up dialogue'});
add('dialogue_profile', 'Dialogue - Profile', 'dialogue', 10, [['profile',3,'profile_a'],['profile',3,'profile_b'],['medium',2,'reaction'],['close_up',2,'intimacy']], 'neutral', ['drama','art'], 0.5, {description:'Profile dialogue'});
add('dialogue_side_by_side', 'Dialogue - Side by Side', 'dialogue', 10, [['medium',3,'side_by_side'],['close_up',3,'dialogue_a'],['close_up',2,'dialogue_b'],['medium',2,'reaction']], 'neutral', ['drama','comedy'], 0.5, {description:'Side by side conversation'});
add('dialogue_confrontational', 'Dialogue - Confrontational', 'dialogue', 15, [['wide',2,'confrontation'],['close_up',3,'character_a'],['close_up',3,'character_b'],['extreme_close_up',3,'escalation'],['medium',2,'resolution']], 'confrontational', ['drama','thriller'], 0.5, {description:'Confrontational dialogue'});
add('dialogue_romantic', 'Dialogue - Romantic', 'dialogue', 12, [['medium',2,'environment'],['close_up',3,'character_a'],['close_up',3,'character_b'],['medium',2,'eye_contact'],['close_up',2,'intimacy']], 'intimate', ['romance','drama'], 0.5, {description:'Romantic dialogue'});
add('dialogue_secret', 'Dialogue - Secret', 'dialogue', 10, [['medium',2,'environment'],['pov',3,'surveillance'],['close_up',2,'whisper'],['medium',3,'reaction']], 'suspenseful', ['thriller','mystery'], 0.5, {description:'Secret conversation'});
add('dialogue_phone', 'Dialogue - Phone', 'dialogue', 8, [['close_up',2,'character'],['insert',2,'phone'],['medium',2,'reaction'],['close_up',2,'character']], 'neutral', ['drama','thriller'], 0.5, {description:'Phone conversation'});
add('dialogue_monologue', 'Dialogue - Monologue', 'dialogue', 12, [['medium',3,'speaker'],['close_up',4,'delivery'],['wide',3,'environment'],['medium',2,'reaction']], 'neutral', ['drama','comedy'], 0.5, {description:'Monologue delivery'});
add('dialogue_argument', 'Dialogue - Argument', 'dialogue', 15, [['two_shot',3,'start'],['close_up',3,'character_a'],['close_up',3,'character_b'],['medium',3,'escalation'],['wide',3,'aftermath']], 'angry', ['drama','thriller'], 0.5, {description:'Argument scene'});
add('dialogue_negotiation', 'Dialogue - Negotiation', 'dialogue', 12, [['two_shot',2,'start'],['close_up',3,'proposal'],['medium',3,'reaction'],['close_up',3,'decision']], 'tense', ['business','thriller'], 0.5, {description:'Negotiation scene'});
add('dialogue_comforting', 'Dialogue - Comforting', 'dialogue', 10, [['medium',2,'distress'],['close_up',2,'comfort'],['medium',3,'conversation'],['close_up',3,'relief']], 'warm', ['drama','romance'], 0.5, {description:'Comforting conversation'});
add('dialogue_interview', 'Dialogue - Interview', 'dialogue', 15, [['over_shoulder',3,'interviewer'],['medium',4,'answer'],['close_up',3,'reaction'],['medium',3,'follow_up'],['close_up',2,'final']], 'neutral', ['documentary','news'], 0.5, {description:'Interview dialogue'});
add('dialogue_mentoring', 'Dialogue - Mentoring', 'dialogue', 10, [['medium',2,'mentor'],['close_up',2,'advice'],['medium',3,'reaction'],['wide',3,'growth']], 'inspired', ['drama','business'], 0.5, {description:'Mentoring conversation'});
add('dialogue_reconciliation', 'Dialogue - Reconciliation', 'dialogue', 12, [['medium',2,'conflict'],['close_up',2,'apology'],['medium',3,'conversation'],['close_up',3,'forgiveness'],['wide',2,'resolution']], 'warm', ['drama','romance'], 0.5, {description:'Reconciliation conversation'});
add('dialogue_pitch', 'Dialogue - Pitch', 'dialogue', 12, [['two_shot',2,'start'],['close_up',3,'pitch'],['medium',3,'reaction'],['close_up',2,'questions'],['medium',2,'response']], 'urgent', ['business','startup'], 0.5, {description:'Pitch conversation'});
add('dialogue_confession', 'Dialogue - Confession', 'dialogue', 10, [['medium',2,'tension'],['close_up',3,'confession'],['medium',3,'reaction'],['close_up',2,'acceptance']], 'sad', ['drama','thriller'], 0.5, {description:'Confession scene'});
add('dialogue_celebration', 'Dialogue - Celebration', 'dialogue', 8, [['medium',2,'news'],['close_up',2,'joy'],['medium',2,'celebration'],['wide',2,'group')], 'joyful', ['all'], 0.5, {description:'Celebration conversation'});

// ============================================
// POV (15)
// ============================================
add('pov_first_person', 'POV - First Person', 'pov', 10, [['pov',3,'movement'],['pov',3,'search'],['pov',2,'discovery'],['close_up',2,'reaction']], 'curious', ['horror','thriller','adventure'], 0.5, {description:'First person perspective'});
add('pov_walking', 'POV - Walking', 'pov', 8, [['pov',3,'movement'],['pov',2,'environment'],['medium',2,'reaction'],['pov',1,'destination']], 'neutral', ['all'], 0.5, {description:'Walking POV'});
add('pov_running', 'POV - Running', 'pov', 8, [['pov',2,'start'],['pov',3,'fast_movement'],['pov',2,'obstacle'],['medium',1,'escape']], 'urgent', ['action','horror'], 0.5, {description:'Running POV'});
add('pov_discovery', 'POV - Discovery', 'pov', 8, [['pov',3,'search'],['pov',2,'object'],['close_up',2,'reaction'],['medium',1,'reveal']], 'curious', ['adventure','mystery'], 0.5, {description:'Discovery POV'});
add('pov_combat', 'POV - Combat', 'pov', 10, [['pov',2,'threat'],['pov',3,'action'],['pov',2,'reaction'],['medium',2,'result']], 'dangerous', ['action','horror'], 0.5, {description:'Combat POV'});
add('pov_horror', 'POV - Horror', 'pov', 10, [['pov',2,'darkness'],['pov',3,'movement'],['pov',2,'threat'],['medium',2,'reaction'],['close_up',1,'reveal']], 'fearful', ['horror'], 0.5, {description:'Horror POV'});
add('pov_driving', 'POV - Driving', 'pov', 8, [['pov',3,'road'],['pov',2,'speed'],['medium',2,'reaction'],['pov',1,'destination']], 'urgent', ['action','drama'], 0.5, {description:'Driving POV'});
add('pov_climbing', 'POV - Climbing', 'pov', 8, [['pov',2,'height'],['pov',3,'climbing'],['pov',2,'view'],['wide',1,'summit']], 'determined', ['adventure','sports'], 0.5, {description:'Climbing POV'});
add('pov_flying', 'POV - Flying', 'pov', 8, [['pov',2,'takeoff'],['pov',3,'flight'],['pov',2,'view'],['wide',1,'landing']], 'hopeful', ['adventure'], 0.5, {description:'Flying POV'});
add('pov_reading', 'POV - Reading', 'pov', 6, [['pov',2,'book'],['medium',2,'reader'],['close_up',2,'reaction'],['pov',1,'page']], 'neutral', ['drama','documentary'], 0.5, {description:'Reading POV'});
add('pov_gaming', 'POV - Gaming', 'pov', 6, [['pov',2,'screen'],['pov',2,'gameplay'],['close_up',2,'reaction'],['medium',1,'environment']], 'energetic', ['social','gaming'], 0.5, {description:'Gaming POV'});
add('pov_cooking', 'POV - Cooking', 'pov', 8, [['pov',2,'prep'],['pov',3,'cooking'],['pov',2,'plating'],['close_up',1,'result']], 'warm', ['lifestyle','food'], 0.5, {description:'Cooking POV'});
add('pov_exploring', 'POV - Exploring', 'pov', 10, [['pov',3,'search'],['pov',3,'discovery'],['pov',2,'reaction'],['wide',2,'environment']], 'curious', ['adventure','documentary'], 0.5, {description:'Exploring POV'});
add('pov_sleeping', 'POV - Sleeping', 'pov', 5, [['pov',2,'bed'],['close_up',2,'face'],['medium',1,'room']], 'peaceful', ['drama','horror'], 0.5, {description:'Sleeping POV'});
add('pov_waking', 'POV - Waking', 'pov', 6, [['close_up',2,'face'],['pov',2,'room'],['medium',2,'reality']], 'curious', ['drama','surreal'], 0.5, {description:'Waking POV'});

// ============================================
// DISCOVERY (20)
// ============================================
add('discovery_object', 'Discovery - Object', 'discovery', 10, [['wide',2,'search'],['medium',2,'movement'],['insert',2,'object_detail'],['close_up',2,'hand_picks_up'],['extreme_close_up',1,'object_reveal'],['close_up',1,'reaction']], 'curious', ['mystery','thriller','adventure'], 0.5, {description:'Finding an object'});
add('discovery_location', 'Discovery - Location', 'discovery', 10, [['wide',2,'travel'],['tracking',3,'approach'],['wide',3,'location_reveal'],['close_up',2,'character_reaction']], 'mysterious', ['adventure','fantasy','sci-fi'], 0.5, {description:'Finding a location'});
add('discovery_person', 'Discovery - Person', 'discovery', 8, [['wide',2,'search'],['medium',2,'character_appears'],['close_up',2,'reveal'],['medium',2,'reaction']], 'curious', ['drama','mystery'], 0.5, {description:'Finding a person'});
add('discovery_evidence', 'Discovery - Evidence', 'discovery', 8, [['medium',2,'search'],['insert',2,'clue'],['close_up',2,'examination'],['medium',2,'realization']], 'curious', ['mystery','thriller'], 0.5, {description:'Finding evidence'});
add('discovery_secret_room', 'Discovery - Secret Room', 'discovery', 10, [['medium',2,'normal_env'],['close_up',2,'hidden_door'],['medium',2,'entry'],['wide',3,'reveal']], 'mysterious', ['mystery','horror'], 0.5, {description:'Finding secret room'});
add('discovery_message', 'Discovery - Message', 'discovery', 6, [['insert',2,'object'],['close_up',2,'text'],['medium',2,'reaction'],['wide',2,'implications']], 'curious', ['mystery','thriller'], 0.5, {description:'Finding a message'});
add('discovery_photograph', 'Discovery - Photograph', 'discovery', 8, [['insert',2,'photo'],['close_up',2,'memory'],['medium',2,'flashback'],['wide',2,'present']], 'nostalgic', ['drama','mystery'], 0.5, {description:'Finding a photograph'});
add('discovery_talent', 'Discovery - Talent', 'discovery', 8, [['medium',2,'ordinary'],['close_up',2,'attempt'],['medium',2,'success'],['wide',2,'realization')], 'amazed', ['drama','music','sports'], 0.5, {description:'Discovering talent'});
add('discovery_truth', 'Discovery - Truth', 'discovery', 10, [['medium',2,'investigation'],['close_up',2,'evidence'],['medium',3,'connection'],['wide',3,'truth_reveal')], 'shocking', ['mystery','thriller','drama'], 0.5, {description:'Discovering the truth'});
add('discovery_ability', 'Discovery - Ability', 'discovery', 8, [['medium',2,'normal'],['close_up',2,'first_use'],['medium',2,'experiment'],['wide',2,'realization')], 'amazed', ['sci-fi','fantasy','action'], 0.5, {description:'Discovering special ability'});
add('discovery_path', 'Discovery - Path', 'discovery', 8, [['wide',2,'junction'],['medium',2,'decision'],['tracking',2,'journey'],['wide',2,'reveal')], 'hopeful', ['adventure','drama'], 0.5, {description:'Discovering a path'});
add('discovery_creature', 'Discovery - Creature', 'discovery', 8, [['medium',2,'search'],['close_up',2,'sound'],['wide',2,'creature'),['medium',2,'reaction')], 'fearful', ['adventure','horror','sci-fi'], 0.5, {description:'Discovering a creature'});
add('discovery_artifact', 'Discovery - Artifact', 'discovery', 10, [['insert',2,'dig'],['close_up',2,'artifact'],['medium',2,'examination'),['wide',3,'significance')], 'awe', ['adventure','mystery','historical'], 0.5, {description:'Discovering ancient artifact'});
add('discovery_solution', 'Discovery - Solution', 'discovery', 8, [['medium',2,'problem'],['close_up',2,'thinking'],['medium',2,'breakthrough'],['wide',2,'solution')], 'inspired', ['business','tech','drama'], 0.5, {description:'Discovering a solution'});
add('discovery_connection', 'Discovery - Connection', 'discovery', 8, [['medium',2,'clue_a'],['medium',2,'clue_b'],['close_up',2,'realization'),['wide',2,'connection')], 'amazed', ['mystery','drama'], 0.5, {description:'Discovering a connection'});
add('discovery_power', 'Discovery - Power', 'discovery', 8, [['medium',2,'ordinary'),['close_up',2,'first_use'),['wide',2,'power_reveal"],['medium',2,'responsibility')], 'epic', ['action','sci-fi','fantasy'], 0.5, {description:'Discovering power'});
add('discovery_identity', 'Discovery - Identity', 'discovery', 8, [['medium',2,'anonymous"],['close_up',2,'clues"],['medium',2,'revelation"],['close_up',2,'new_identity')], 'surprised', ['mystery','drama','thriller'], 0.5, {description:'Discovering identity'});
add('discovery_map', 'Discovery - Map', 'discovery', 6, [['insert',2,'map"],['close_up',2,'detail"],['medium',2,'reaction"],['wide',2,'journey")], 'curious', ['adventure','mystery'], 0.5, {description:'Discovering a map'});
add('discovery_recipe', 'Discovery - Recipe', 'discovery', 6, [['medium',2,'problem"],['close_up',2,'recipe"],['medium',2,'creation"],['wide',2,'success")], 'joyful', ['lifestyle','food','comedy'], 0.5, {description:'Discovering a recipe'});
add('discovery_sound', 'Discovery - Sound', 'discovery', 6, [['close_up',2,'silence"],['medium',2,'listening"],['wide',2,'source"],['medium',2,'reaction")], 'curious', ['horror','mystery','adventure'], 0.5, {description:'Discovering a sound'});

// Write templates to temp file
fs.writeFileSync('/tmp/templates_batch3.js', templates.join('\n\n'));
console.log(`Generated ${templates.length} templates`);
PYEOF