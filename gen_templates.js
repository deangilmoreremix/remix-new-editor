import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'src/lib/sceneSchema.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the last template and the closing }; of SCENE_TEMPLATES
const closingIndex = content.lastIndexOf('\n};');
const before = content.substring(0, closingIndex);
const after = content.substring(closingIndex);

function addTemplate(obj) {
  const { id, name, scene_type, default_duration, shot_sequence, emotion, compatible_genres, description, scene_subtype, required_fields, story_function, narrative_role, pacing, intensity, keywords } = obj;

  const extras = [];
  if (description) extras.push(`    description: '${description}'`);
  if (scene_subtype) extras.push(`    scene_subtype: '${scene_subtype}'`);
  if (required_fields) extras.push(`    required_fields: ${JSON.stringify(required_fields)}`);
  if (story_function) extras.push(`    story_function: '${story_function}'`);
  if (narrative_role) extras.push(`    narrative_role: '${narrative_role}'`);
  if (pacing) extras.push(`    pacing: '${pacing}'`);
  if (intensity !== undefined) extras.push(`    intensity: ${intensity}`);
  if (keywords) extras.push(`    keywords: ${JSON.stringify(keywords)}`);

  const extrasStr = extras.length > 0 ? ',\n' + extras.join(',\n') : '';

  const shots = shot_sequence.map(s => {
    const dur = s.duration !== undefined ? `, duration: ${s.duration}` : '';
    return `      { shot_type: ${s[0]}, purpose: '${s[1]}'${dur} }`;
  }).join(',\n');

  return `,\n  ${id}: {\n    id: '${id}',\n    name: '${name}',\n    scene_type: ${scene_type},\n    default_duration: ${default_duration},\n    shot_sequence: [\n${shots}\n    ],\n    emotion: ${emotion},\n    compatible_genres: ${JSON.stringify(compatible_genres)}${extrasStr}\n  }`;
}

// ============================================
// SHOT_TYPE / SCENE_TYPE / EMOTION SHORTCUTS
// ============================================
const S = {
  EW: 'SHOT_TYPES.EXTREME_WIDE', W: 'SHOT_TYPES.WIDE', MW: 'SHOT_TYPES.MEDIUM_WIDE',
  M: 'SHOT_TYPES.MEDIUM', MCU: 'SHOT_TYPES.MEDIUM_CLOSE_UP', CU: 'SHOT_TYPES.CLOSE_UP',
  ECU: 'SHOT_TYPES.EXTREME_CLOSE_UP', INS: 'SHOT_TYPES.INSERT', CI: 'SHOT_TYPES.CUT_IN',
  TS: 'SHOT_TYPES.TWO_SHOT', OS: 'SHOT_TYPES.OVER_SHOULDER', PRO: 'SHOT_TYPES.PROFILE',
  POV: 'SHOT_TYPES.POV', BE: 'SHOT_TYPES.BIRDSEYE', LA: 'SHOT_TYPES.LOW_ANGLE',
  HA: 'SHOT_TYPES.HIGH_ANGLE', DA: 'SHOT_TYPES.DUTCH_ANGLE', TR: 'SHOT_TYPES.TRACKING',
  DO: 'SHOT_TYPES.DOLLY', CR: 'SHOT_TYPES.CRANE', ST: 'SHOT_TYPES.STEADICAM',
  HH: 'SHOT_TYPES.HANDHELD', AE: 'SHOT_TYPES.AERIAL', MA: 'SHOT_TYPES.MACRO'
};
const E = {
  EPIC: 'EMOTIONAL_TONES.EPIC', HOPE: 'EMOTIONAL_TONES.HOPEFUL', DARK: 'EMOTIONAL_TONES.DARK',
  MYS: 'EMOTIONAL_TONES.MYSTERIOUS', ROM: 'EMOTIONAL_TONES.ROMANTIC', TENSE: 'EMOTIONAL_TONES.TENSE',
  SAD: 'EMOTIONAL_TONES.SAD', JOY: 'EMOTIONAL_TONES.JOYFUL', INS: 'EMOTIONAL_TONES.INSPIRATIONAL',
  DANG: 'EMOTIONAL_TONES.DANGEROUS', PEACE: 'EMOTIONAL_TONES.PEACEFUL', URG: 'EMOTIONAL_TONES.URGENT',
  NOST: 'EMOTIONAL_TONES.NOSTALGIC', SUR: 'EMOTIONAL_TONES.SURREAL', TRI: 'EMOTIONAL_TONES.TRIUMPHANT',
  CUR: 'EMOTIONAL_TONES.CURIOUS', SUSP: 'EMOTIONAL_TONES.SUSPENSEFUL'
};
const SC = {
  CO: 'SCENE_TYPES.COLD_OPEN', HOOK: 'SCENE_TYPES.HOOK', EST: 'SCENE_TYPES.ESTABLISHING',
  CI: 'SCENE_TYPES.CHARACTER_INTRODUCTION', EI: 'SCENE_TYPES.ENVIRONMENT_INTRODUCTION',
  NW: 'SCENE_TYPES.NORMAL_WORLD', IE: 'SCENE_TYPES.INCITING_EVENT', CR: 'SCENE_TYPES.CHARACTER_REACTION',
  DIA: 'SCENE_TYPES.DIALOGUE', CON: 'SCENE_TYPES.CONVERSATION', MON: 'SCENE_TYPES.MONOLOGUE',
  POV: 'SCENE_TYPES.POV', ACT: 'SCENE_TYPES.ACTION', DIS: 'SCENE_TYPES.DISCOVERY',
  INV: 'SCENE_TYPES.INVESTIGATION', REV: 'SCENE_TYPES.REVEAL', TRA: 'SCENE_TYPES.TRANSFORMATION',
  JOU: 'SCENE_TYPES.JOURNEY', ARR: 'SCENE_TYPES.ARRIVAL', DEP: 'SCENE_TYPES.DEPARTURE',
  MON2: 'SCENE_TYPES.MONTAGE', TRN: 'SCENE_TYPES.TRAINING', ROM: 'SCENE_TYPES.ROMANCE',
  CONFL: 'SCENE_TYPES.CONFLICT', CONF: 'SCENE_TYPES.CONFRONTATION', CHA: 'SCENE_TYPES.CHASE',
  ESC: 'SCENE_TYPES.ESCAPE', RES: 'SCENE_TYPES.RESCUE', SUS: 'SCENE_TYPES.SUSPENSE',
  HOR: 'SCENE_TYPES.HORROR', COM: 'SCENE_TYPES.COMEDY', EMO: 'SCENE_TYPES.EMOTIONAL',
  FLASH: 'SCENE_TYPES.FLASHBACK', DREAM: 'SCENE_TYPES.DREAM', SUR: 'SCENE_TYPES.SURREAL',
  TEC: 'SCENE_TYPES.TECHNOLOGY', PROD: 'SCENE_TYPES.PRODUCT', DEM: 'SCENE_TYPES.DEMONSTRATION',
  TEST: 'SCENE_TYPES.TESTIMONIAL', DOC: 'SCENE_TYPES.DOCUMENTARY', INT: 'SCENE_TYPES.INTERVIEW',
  EXPL: 'SCENE_TYPES.EXPLAINER', VIS: 'SCENE_TYPES.VISUALIZATION', TP: 'SCENE_TYPES.TIME_PASSAGE',
  SR: 'SCENE_TYPES.SCALE_REVEAL', CLI: 'SCENE_TYPES.CLIMAX', RES: 'SCENE_TYPES.RESOLUTION',
  EE: 'SCENE_TYPES.EMOTIONAL_ENDING', CTA: 'SCENE_TYPES.CTA', EC: 'SCENE_TYPES.END_CARD'
};

// Template definition format: [id, name, sceneType, duration, shots, emotion, genres, extras?]
// Shots format: [shotType, purpose, duration?]
const defs = [];

function T(id, name, sceneType, duration, shots, emotion, genres, extras) {
  defs.push({ id, name, scene_type: sceneType, default_duration: duration, shot_sequence: shots, emotion, compatible_genres: genres, ...extras });
}

// ============================================
// 01. Opening/Hook: 20
// ============================================
T('hook_curiosity_gap','Hook - Curiosity Gap',SC.HOOK,5,[[S.W,'visual_setup',2],[S.CU,'question',2],[S.M,'tease',1]],E.CUR,['all'],{description:'Creates an information gap that demands to be filled'});
T('hook_problem_agitation','Hook - Problem Agitation',SC.HOOK,6,[[S.M,'problem_statement',2],[S.CU,'pain_point',2],[S.W,'consequences',2]],E.TENSE,['all']);
T('hook_story_teaser','Hook - Story Teaser',SC.HOOK,5,[[S.W,'scene_setup',1.5],[S.CU,'teaser_moment',2],[S.M,'reaction',1.5]],E.MYS,['all']);
T('hook_contrast','Hook - Contrast',SC.HOOK,4,[[S.W,'expectation',1.5],[S.ECU,'reality',1.5],[S.M,'reaction',1]],E.EPIC,['all']);
T('hook_authority','Hook - Authority',SC.HOOK,5,[[S.LA,'authority_figure',2],[S.M,'statement',2],[S.CU,'proof',1]],E.EPIC,['business','corporate','educational']);
T('hook_urgency','Hook - Urgency',SC.HOOK,4,[[S.INS,'timer',1],[S.M,'urgency',2],[S.CU,'reaction',1]],E.URG,['all']);
T('hook_social_proof','Hook - Social Proof',SC.HOOK,5,[[S.W,'crowd',2],[S.M,'endorsement',2],[S.CU,'testimonial',1]],E.JOY,['business','social','commercial']);
T('hook_dark_secret','Hook - Dark Secret',SC.HOOK,6,[[S.CU,'secret_keeper',2],[S.INS,'evidence',2],[S.M,'revelation',2]],E.DARK,['thriller','mystery','drama']);
T('hook_visual_puzzle','Hook - Visual Puzzle',SC.HOOK,5,[[S.MA,'detail',2],[S.W,'context',2],[S.CU,'connection',1]],E.CUR,['documentary','mystery','educational']);
T('hook_emotional','Hook - Emotional',SC.HOOK,6,[[S.M,'character',2],[S.CU,'emotion',2],[S.W,'impact',2]],E.SAD,['drama','documentary','nonprofit']);
T('hook_humor','Hook - Humor',SC.HOOK,4,[[S.W,'setup',1.5],[S.CU,'punchline',1.5],[S.M,'reaction',1]],E.JOY,['comedy','social','commercial']);
T('hook_shock_value','Hook - Shock Value',SC.HOOK,5,[[S.W,'normal',1.5],[S.ECU,'shock',2],[S.CU,'reaction',1.5]],E.SUSP,['thriller','action','horror']);
T('hook_dream_scenario','Hook - Dream Scenario',SC.HOOK,5,[[S.W,'ideal_world',2],[S.CU,'desire',2],[S.M,'aspiration',1]],E.HOPE,['commercial','business','lifestyle']);
T('hook_fear_appeal','Hook - Fear Appeal',SC.HOOK,5,[[S.W,'danger',2],[S.CU,'fear',2],[S.M,'consequence',1]],E.DANG,['horror','thriller','public_service']);
T('hook_contrarian','Hook - Contrarian',SC.HOOK,5,[[S.M,'challenge',2],[S.CU,'unpopular_opinion',2],[S.W,'evidence',1]],E.MYS,['educational','business','documentary']);
T('hook_before_after','Hook - Before/After',SC.HOOK,6,[[S.W,'before_state',2],[S.CU,'transformation',2],[S.W,'after_state',2]],E.TRI,['commercial','business','fitness']);
T('hook_list_format','Hook - List Format',SC.HOOK,5,[[S.W,'presentation',2],[S.INS,'list_item',2],[S.CU,'emphasis',1]],E.CUR,['educational','business','social']);
T('hook_myth_busting','Hook - Myth Busting',SC.HOOK,5,[[S.W,'myth',2],[S.CU,'bust',2],[S.M,'truth',1]],E.MYS,['educational','documentary','business']);
T('hook_question_loop','Hook - Question Loop',SC.HOOK,5,[[S.M,'question',1.5],[S.CU,'contemplation',2],[S.W,'answer_tease',1.5]],E.CUR,['all']);
T('hook_statistic','Hook - Statistic',SC.HOOK,5,[[S.INS,'statistic',2],[S.W,'impact',2],[S.CU,'reaction',1]],E.URG,['business','documentary','news']);

// ============================================
// 02. Establishing: 25
// ============================================
T('establishing_countryside','Establishing - Countryside',SC.EST,8,[[S.AE,'landscape',3],[S.W,'field',3],[S.M,'structure',2]],E.PEACE,['drama','documentary','romance']);
T('establishing_suburbia','Establishing - Suburbia',SC.EST,6,[[S.TR,'street',2],[S.W,'neighborhood',2],[S.M,'house',2]],E.EPIC,['drama','comedy','horror']);
T('establishing_underwater','Establishing - Underwater',SC.EST,8,[[S.EW,'ocean',3],[S.W,'reef',3],[S.MA,'marine_life',2]],E.MYS,['adventure','documentary','sci-fi']);
T('establishing_forest','Establishing - Forest',SC.EST,7,[[S.AE,'canopy',2],[S.W,'path',2],[S.M,'clearing',3]],E.MYS,['horror','adventure','fantasy']);
T('establishing_school','Establishing - School',SC.EST,6,[[S.W,'exterior',2],[S.TR,'hallway',2],[S.M,'classroom',2]],E.EPIC,['comedy','drama','horror']);
T('establishing_hospital','Establishing - Hospital',SC.EST,6,[[S.W,'exterior',2],[S.M,'lobby',2],[S.CU,'details',2]],E.DARK,['drama','horror','thriller']);
T('establishing_office','Establishing - Office',SC.EST,6,[[S.W,'exterior',2],[S.TR,'lobby',2],[S.M,'workspace',2]],E.EPIC,['business','corporate','comedy']);
T('establishing_warehouse','Establishing - Warehouse',SC.EST,6,[[S.W,'exterior',2],[S.TR,'interior',2],[S.LA,'structure',2]],E.DARK,['action','thriller','horror']);
T('establishing_beach','Establishing - Beach',SC.EST,7,[[S.AE,'coastline',2],[S.W,'shore',3],[S.M,'activity',2]],E.PEACE,['romance','drama','comedy']);
T('establishing_mountain','Establishing - Mountain',SC.EST,8,[[S.AE,'peaks',3],[S.W,'valley',3],[S.M,'climber',2]],E.EPIC,['adventure','documentary','drama']);
T('establishing_space','Establishing - Space',SC.EST,8,[[S.EW,'universe',3],[S.AE,'planet',3],[S.W,'station',2]],E.EPIC,['sci-fi','documentary','adventure']);
T('establishing_desert','Establishing - Desert',SC.EST,7,[[S.AE,'dunes',3],[S.W,'landscape',2],[S.M,'traveler',2]],E.DARK,['adventure','western','sci-fi']);
T('establishing_farm','Establishing - Farm',SC.EST,6,[[S.W,'property',2],[S.M,'barn',2],[S.CU,'animals',2]],E.PEACE,['drama','documentary','family']);
T('establishing_castle','Establishing - Castle',SC.EST,8,[[S.W,'exterior',3],[S.LA,'towers',2],[S.AE,'grounds',3]],E.EPIC,['fantasy','adventure','drama']);
T('establishing_street','Establishing - Street',SC.EST,5,[[S.TR,'movement',2],[S.W,'block',2],[S.M,'activity',1]],E.EPIC,['urban','corporate','thriller']);
T('establishing_school_bell','Establishing - School Bell',SC.EST,5,[[S.W,'exterior',2],[S.M,'students',2],[S.CU,'bell',1]],E.JOY,['comedy','drama','coming_of_age']);
T('establishing_airport','Establishing - Airport',SC.EST,6,[[S.W,'terminal',2],[S.TR,'crowd',2],[S.M,'plane',2]],E.URG,['romance','drama','action']);
T('establishing_train_station','Establishing - Train Station',SC.EST,6,[[S.W,'platform',2],[S.TR,'train',2],[S.M,'passengers',2]],E.NOST,['romance','drama','mystery']);
T('establishing_port','Establishing - Port',SC.EST,6,[[S.W,'harbor',2],[S.TR,'ships',2],[S.M,'activity',2]],E.EPIC,['adventure','mystery','drama']);
T('establishing_park','Establishing - Park',SC.EST,5,[[S.W,'greenery',2],[S.M,'path',2],[S.CU,'details',1]],E.PEACE,['romance','comedy','drama']);
T('establishing_residential','Establishing - Residential',SC.EST,5,[[S.TR,'street',2],[S.W,'homes',2],[S.M,'porch',1]],E.EPIC,['drama','comedy','horror']);
T('establishing_skyscraper','Establishing - Skyscraper',SC.EST,7,[[S.AE,'cityscape',3],[S.W,'building',2],[S.LA,'height',2]],E.EPIC,['corporate','thriller','action']);
T('establishing_ruins','Establishing - Ruins',SC.EST,8,[[S.W,'ruins',3],[S.M,'debris',3],[S.CU,'artifact',2]],E.MYS,['adventure','fantasy','horror']);
T('establishing_bridge','Establishing - Bridge',SC.EST,6,[[S.W,'span',2],[S.TR,'crossing',2],[S.M,'pedestrians',2]],E.EPIC,['romance','drama','thriller']);
T('establishing_library','Establishing - Library',SC.EST,6,[[S.W,'exterior',2],[S.TR,'stacks',2],[S.M,'reading_room',2]],E.MYS,['mystery','drama','horror']);

// ============================================
// 03. Character Introduction: 25
// ============================================
T('char_intro_mentor','Character Introduction - Mentor',SC.CI,8,[[S.W,'environment',2],[S.M,'presence',2],[S.CU,'wisdom',2],[S.M,'action',2]],E.HOPE,['drama','adventure','fantasy']);
T('char_intro_sidekick','Character Introduction - Sidekick',SC.CI,6,[[S.M,'introduction',2],[S.CU,'personality',2],[S.TS,'interaction',2]],E.JOY,['comedy','action','adventure']);
T('char_intro_love_interest','Character Introduction - Love Interest',SC.CI,8,[[S.W,'separate',2],[S.M,'notice',2],[S.CU,'eye_contact',2],[S.M,'approach',2]],E.ROM,['romance','drama','comedy']);
T('char_intro_mentor_wise','Character Introduction - Wise Mentor',SC.CI,8,[[S.LA,'presence',2],[S.MCU,'face',3],[S.CU,'eyes',3]],E.MYS,['fantasy','drama','adventure']);
T('char_intro_rival','Character Introduction - Rival',SC.CI,7,[[S.W,'arena',2],[S.LA,'arrival',2],[S.CU,'challenge',3]],E.TENSE,['sports','action','drama']);
T('char_intro_comic_relief','Character Introduction - Comic Relief',SC.CI,6,[[S.M,'entrance',2],[S.CU,'mishap',2],[S.TS,'reaction',2]],E.JOY,['comedy','adventure','family']);
T('char_intro_mysterious_stranger','Character Introduction - Mysterious Stranger',SC.CI,7,[[S.EW,'shadow',2],[S.M,'reveal',3],[S.CU,'expression',2]],E.MYS,['mystery','thriller','western']);
T('char_intro_authority','Character Introduction - Authority',SC.CI,7,[[S.LA,'power',2],[S.M,'command',3],[S.CU,'determination',2]],E.DARK,['thriller','crime','drama']);
T('char_intro_child','Character Introduction - Child',SC.CI,6,[[S.W,'play',2],[S.M,'innocence',2],[S.CU,'wonder',2]],E.JOY,['family','drama','fantasy']);
T('char_intro_elder','Character Introduction - Elder',SC.CI,7,[[S.CU,'face',3],[S.M,'posture',2],[S.W,'surroundings',2]],E.NOST,['drama','fantasy','historical']);
T('char_intro_scientist','Character Introduction - Scientist',SC.CI,7,[[S.M,'lab',2],[S.CU,'experiment',3],[S.OS,'discovery',2]],E.CUR,['sci-fi','documentary','thriller']);
T('char_intro_athlete','Character Introduction - Athlete',SC.CI,7,[[S.W,'training',2],[S.M,'focus',2],[S.CU,'determination',3]],E.TRI,['sports','drama','documentary']);
T('char_intro_artist','Character Introduction - Artist',SC.CI,7,[[S.M,'studio',2],[S.CU,'creation',3],[S.W,'work',2]],E.INS,['documentary','drama','independent']);
T('char_intro_warrior','Character Introduction - Warrior',SC.CI,8,[[S.LA,'arrival',2],[S.W,'battlefield',3],[S.M,'preparation',3]],E.DANG,['action','fantasy','adventure']);
T('char_intro_detective','Character Introduction - Detective',SC.CI,7,[[S.EW,'shadow',2],[S.M,'investigation',3],[S.CU,'clue',2]],E.MYS,['noir','thriller','mystery']);
T('char_intro_chef','Character Introduction - Chef',SC.CI,7,[[S.M,'kitchen',2],[S.CU,'cooking',3],[S.MA,'plating',2]],E.JOY,['lifestyle','documentary','comedy']);
T('char_intro_musician','Character Introduction - Musician',SC.CI,7,[[S.W,'stage',2],[S.M,'performance',3],[S.CU,'emotion',2]],E.INS,['music','documentary','drama']);
T('char_intro_parent','Character Introduction - Parent',SC.CI,7,[[S.M,'home',2],[S.CU,'care',3],[S.TS,'family',2]],E.HOPE,['drama','family','comedy']);
T('char_intro_student','Character Introduction - Student',SC.CI,6,[[S.M,'campus',2],[S.CU,'studies',2],[S.W,'dreams',2]],E.HOPE,['coming_of_age','comedy','drama']);
T('char_intro_explorer','Character Introduction - Explorer',SC.CI,7,[[S.W,'wilderness',2],[S.M,'gear',2],[S.CU,'determination',3]],E.HOPE,['adventure','documentary','drama']);
T('char_intro_villain_intellectual','Character Introduction - Villain Intellectual',SC.CI,8,[[S.W,'lair',2],[S.M,'plan',3],[S.CU,'calculation',3]],E.DARK,['thriller','spy','sci-fi']);
T('char_intro_hero_ordinary','Character Introduction - Hero Ordinary',SC.CI,7,[[S.M,'routine',3],[S.CU,'longing',2],[S.W,'world',2]],E.EPIC,['drama','comedy','action']);
T('char_intro_antihero','Character Introduction - Antihero',SC.CI,7,[[S.W,'underbelly',2],[S.M,'moral_choice',3],[S.CU,'conflict',2]],E.DARK,['crime','drama','thriller']);
T('char_intro_pilot','Character Introduction - Pilot',SC.CI,7,[[S.W,'cockpit',2],[S.M,'controls',3],[S.CU,'concentration',2]],E.EPIC,['action','drama','adventure']);
T('char_intro_rebel','Character Introduction - Rebel',SC.CI,7,[[S.W,'protest',2],[S.M,'defiance',3],[S.CU,'fire',2]],E.TENSE,['action','drama','sci-fi']);

// ============================================
// 04. Character Emotion: 25
// ============================================
T('char_emotion_joy','Character Emotion - Joy',SC.CR,5,[[S.M,'setup',1],[S.CU,'joy',3],[S.W,'celebration',1]],E.JOY,['all']);
T('char_emotion_sorrow','Character Emotion - Sorrow',SC.CR,6,[[S.W,'loss',2],[S.CU,'grief',3],[S.M,'isolation',1]],E.SAD,['drama','romance']);
T('char_emotion_anger','Character Emotion - Anger',SC.CR,5,[[S.M,'provocation',2],[S.CU,'rage',2],[S.W,'eruption',1]],E.DANG,['drama','action','thriller']);
T('char_emotion_fear','Character Emotion - Fear',SC.CR,5,[[S.W,'threat',2],[S.CU,'fear',2],[S.ECU,'sweat',1]],E.SUSP,['horror','thriller']);
T('char_emotion_surprise','Character Emotion - Surprise',SC.CR,4,[[S.M,'anticipation',1],[S.CU,'shock',2],[S.W,'reaction',1]],E.EPIC,['all']);
T('char_emotion_disgust','Character Emotion - Disgust',SC.CR,4,[[S.CU,'reaction',2],[S.M,'revulsion',2]],E.DARK,['horror','comedy','drama']);
T('char_emotion_love','Character Emotion - Love',SC.CR,5,[[S.M,'presence',2],[S.CU,'adoration',2],[S.TS,'connection',1]],E.ROM,['romance','drama']);
T('char_emotion_hope','Character Emotion - Hope',SC.CR,5,[[S.W,'despair',2],[S.CU,'hope',2],[S.M,'uplift',1]],E.HOPE,['drama','adventure','sports']);
T('char_emotion_shame','Character Emotion - Shame',SC.CR,5,[[S.M,'confrontation',2],[S.CU,'shame',2],[S.LA,'humiliation',1]],E.SAD,['drama','comedy']);
T('char_emotion_pride','Character Emotion - Pride',SC.CR,5,[[S.W,'achievement',2],[S.CU,'pride',2],[S.LA,'triumph',1]],E.TRI,['sports','drama','action']);
T('char_emotion_guilt','Character Emotion - Guilt',SC.CR,5,[[S.M,'memory',2],[S.CU,'guilt',2],[S.W,'consequence',1]],E.SAD,['drama','thriller','mystery']);
T('char_emotion_jealousy','Character Emotion - Jealousy',SC.CR,5,[[S.TS,'rivalry',2],[S.CU,'jealousy',2],[S.W,'tension',1]],E.DARK,['drama','thriller','romance']);
T('char_emotion_relief','Character Emotion - Relief',SC.CR,4,[[S.CU,'tension_break',2],[S.M,'exhale',2]],E.PEACE,['all']);
T('char_emotion_confusion','Character Emotion - Confusion',SC.CR,4,[[S.W,'chaos',1.5],[S.CU,'confusion',2.5]],E.MYS,['mystery','comedy','drama']);
T('char_emotion_excitement','Character Emotion - Excitement',SC.CR,4,[[S.M,'anticipation',1.5],[S.CU,'excitement',2.5]],E.JOY,['sports','adventure','comedy']);
T('char_emotion_desperation','Character Emotion - Desperation',SC.CR,5,[[S.W,'despair',2],[S.CU,'plea',2],[S.M,'last_chance',1]],E.DARK,['thriller','drama','horror']);
T('char_emotion_embarrassment','Character Emotion - Embarrassment',SC.CR,4,[[S.M,'situation',2],[S.CU,'embarrassment',2]],E.JOY,['comedy','coming_of_age']);
T('char_emotion_grief','Character Emotion - Grief',SC.CR,6,[[S.W,'loss',2],[S.CU,'tears',3],[S.M,'isolation',1]],E.SAD,['drama','romance']);
T('char_emotion_contempt','Character Emotion - Contempt',SC.CR,4,[[S.PRO,'disdain',2],[S.CU,'sneer',2]],E.DARK,['thriller','drama']);
T('char_emotion_amazement','Character Emotion - Amazement',SC.CR,4,[[S.W,'wonder',1.5],[S.CU,'awe',2.5]],E.EPIC,['adventure','sci-fi','fantasy']);
T('char_emotion_nostalgia','Character Emotion - Nostalgia',SC.CR,5,[[S.M,'memory_trigger',2],[S.CU,'longing',2],[S.W,'past',1]],E.NOST,['drama','romance','documentary']);
T('char_emotion_determination','Character Emotion - Determination',SC.CR,4,[[S.W,'obstacle',1.5],[S.CU,'determination',2.5]],E.TRI,['sports','action','drama']);
T('char_emotion_anxiety','Character Emotion - Anxiety',SC.CR,4,[[S.M,'pressure',2],[S.CU,'anxiety',2]],E.TENSE,['thriller','drama','comedy']);
T('char_emotion_contentment','Character Emotion - Contentment',SC.CR,4,[[S.M,'peace',2],[S.W,'satisfaction',2]],E.PEACE,['drama','romance','lifestyle']);
T('char_emotion_bitterness','Character Emotion - Bitterness',SC.CR,4,[[S.M,'resentment',2],[S.CU,'bitterness',2]],E.DARK,['drama','thriller']);

// 05. Character Action: 25
T('char_action_walking','Character Action - Walking',SC.ACT,5,[[S.TR,'walk',2],[S.M,'pace',2],[S.CU,'feet',1]],E.EPIC,['all']);
T('char_action_running','Character Action - Running',SC.ACT,5,[[S.TR,'run',2],[S.M,'effort',2],[S.CU,'face',1]],E.URG,['action','thriller','horror']);
T('char_action_fighting','Character Action - Fighting',SC.ACT,8,[[S.W,'confrontation',2],[S.M,'exchange',3],[S.CU,'impact',3]],E.DANG,['action','thriller']);
T('char_action_dancing','Character Action - Dancing',SC.ACT,6,[[S.W,'movement',2],[S.M,'rhythm',2],[S.CU,'expression',2]],E.JOY,['musical','comedy','romance']);
T('char_action_singing','Character Action - Singing',SC.ACT,6,[[S.M,'performance',2],[S.CU,'emotion',3],[S.W,'audience',1]],E.INS,['musical','drama','comedy']);
T('char_action_writing','Character Action - Writing',SC.ACT,5,[[S.INS,'pen',2],[S.CU,'expression',2],[S.M,'surroundings',1]],E.CUR,['drama','documentary','educational']);
T('char_action_cooking','Character Action - Cooking',SC.ACT,6,[[S.M,'kitchen',2],[S.CU,'preparation',2],[S.MA,'ingredients',2]],E.JOY,['lifestyle','comedy','drama']);
T('char_action_gardening','Character Action - Gardening',SC.ACT,5,[[S.M,'garden',2],[S.CU,'planting',2],[S.W,'growth',1]],E.PEACE,['documentary','lifestyle','drama']);
T('char_action_driving','Character Action - Driving',SC.ACT,5,[[S.M,'vehicle',2],[S.OS,'road',2],[S.CU,'hands',1]],E.TENSE,['action','thriller','drama']);
T('char_action_flying','Character Action - Flying',SC.ACT,6,[[S.AE,'flight',3],[S.M,'pilot',2],[S.CU,'controls',1]],E.EPIC,['action','adventure','sci-fi']);
T('char_action_swimming','Character Action - Swimming',SC.ACT,5,[[S.W,'water',2],[S.M,'stroke',2],[S.EW,'underwater',1]],E.PEACE,['drama','documentary','sports']);
T('char_action_climbing','Character Action - Climbing',SC.ACT,6,[[S.W,'height',2],[S.M,'ascent',2],[S.CU,'grip',2]],E.TENSE,['adventure','sports','thriller']);
T('char_action_reading','Character Action - Reading',SC.ACT,4,[[S.CU,'book',2],[S.M,'reader',2]],E.PEACE,['drama','documentary','educational']);
T('char_action_meditating','Character Action - Meditating',SC.ACT,4,[[S.M,'pose',2],[S.CU,'face',2]],E.PEACE,['documentary','lifestyle','spiritual']);
T('char_action_painting','Character Action - Painting',SC.ACT,5,[[S.M,'canvas',2],[S.CU,'brush',2],[S.W,'art',1]],E.INS,['documentary','drama','art']);
T('char_action_repairing','Character Action - Repairing',SC.ACT,5,[[S.M,'workbench',2],[S.CU,'hands',2],[S.INS,'tools',1]],E.EPIC,['documentary','drama','comedy']);
T('char_action_teaching','Character Action - Teaching',SC.ACT,5,[[S.M,'classroom',2],[S.CU,'instruction',2],[S.TS,'student',1]],E.HOPE,['educational','drama','documentary']);
T('char_action_performing','Character Action - Performing',SC.ACT,6,[[S.W,'stage',2],[S.M,'act',2],[S.CU,'expression',2]],E.EPIC,['musical','drama','comedy']);
T('char_action_hiding','Character Action - Hiding',SC.ACT,5,[[S.W,'danger',2],[S.CU,'concealment',2],[S.M,'relief',1]],E.SUSP,['thriller','horror','action']);
T('char_action_sneaking','Character Action - Sneaking',SC.ACT,5,[[S.HH,'movement',2],[S.CU,'stealth',2],[S.W,'escape',1]],E.TENSE,['thriller','action','horror']);
T('char_action_constructing','Character Action - Constructing',SC.ACT,6,[[S.M,'blueprint',2],[S.CU,'assembly',3],[S.W,'completion',1]],E.TRI,['documentary','drama','sci-fi']);
T('char_action_destroying','Character Action - Destroying',SC.ACT,5,[[S.M,'action',2],[S.CU,'impact',2],[S.W,'ruin',1]],E.DANG,['action','horror','drama']);
T('char_action_negotiating','Character Action - Negotiating',SC.ACT,6,[[S.TS,'tension',2],[S.OS,'arguments',2],[S.CU,'compromise',2]],E.TENSE,['drama','thriller','business']);
T('char_action_saving','Character Action - Saving',SC.ACT,6,[[S.W,'danger',2],[S.M,'rescue',3],[S.CU,'relief',1]],E.TRI,['action','drama','adventure']);
T('char_action_exploring','Character Action - Exploring',SC.ACT,6,[[S.W,'wilderness',2],[S.TR,'movement',2],[S.CU,'discovery',2]],E.CUR,['adventure','documentary','sci-fi']);

// ============================================
// 06. Conversation/Dialogue: 20
// ============================================
T('dialogue_two_shot','Dialogue - Two Shot',SC.DIA,15,[[S.TS,'establish',3],[S.OS,'character_a',3],[S.OS,'character_b',3],[S.CU,'reaction_a',2],[S.CU,'reaction_b',2],[S.TS,'resolution',2]],E.EPIC,['drama','romance','comedy']);
T('conversation_casual','Conversation - Casual',SC.CON,10,[[S.TS,'setup',2],[S.OS,'response',3],[S.CU,'reaction',2],[S.TS,'continuation',3]],E.PEACE,['drama','comedy','romance']);
T('conversation_tense','Conversation - Tense',SC.CON,12,[[S.TS,'tension',3],[S.OS,'accusation',3],[S.CU,'reaction',3],[S.OS,'defense',3]],E.TENSE,['drama','thriller','crime']);
T('conversation_romantic','Conversation - Romantic',SC.CON,10,[[S.TS,'approach',2],[S.OS,'flirtation',3],[S.CU,'smile',2],[S.TS,'connection',3]],E.ROM,['romance','drama','comedy']);
T('conversation_argument','Conversation - Argument',SC.CON,12,[[S.TS,'setup',2],[S.OS,'point_a',3],[S.OS,'point_b',3],[S.CU,'frustration',2],[S.M,'aftermath',2]],E.TENSE,['drama','comedy','family']);
T('monologue_internal','Monologue - Internal',SC.MON,8,[[S.CU,'thought',3],[S.M,'expression',3],[S.W,'context',2]],E.CUR,['drama','documentary','educational']);
T('monologue_audience','Monologue - Audience',SC.MON,10,[[S.TS,'setup',2],[S.CU,'delivery',5],[S.W,'response',3]],E.INS,['drama','comedy','documentary']);
T('dialogue_overlapping','Dialogue - Overlapping',SC.DIA,8,[[S.TS,'chaos',2],[S.OS,'speaker_a',2],[S.OS,'speaker_b',2],[S.CU,'reaction',2]],E.JOY,['comedy','drama','family']);
T('conversation_whisper','Conversation - Whisper',SC.CON,6,[[S.CU,'whisper',3],[S.OS,'listener',3]],E.MYS,['horror','thriller','romance']);
T('dialogue_confrontation','Dialogue - Confrontation',SC.DIA,12,[[S.W,'arena',2],[S.TS,'face_off',3],[S.OS,'accusation',3],[S.CU,'reaction',2],[S.M,'resolution',2]],E.TENSE,['drama','thriller','crime']);
T('conversation_reconciliation','Conversation - Reconciliation',SC.CON,10,[[S.TS,'distance',2],[S.M,'approach',3],[S.OS,'confession',3],[S.TS,'embrace',2]],E.HOPE,['drama','romance','family']);
T('monologue_heroic','Monologue - Heroic',SC.MON,8,[[S.LA,'presence',2],[S.CU,'speech',4],[S.W,'audience',2]],E.EPIC,['action','drama','adventure']);
T('dialogue_subtext','Dialogue - Subtext',SC.DIA,10,[[S.TS,'surface',2],[S.OS,'hint',3],[S.CU,'hidden_meaning',3],[S.M,'realization',2]],E.MYS,['drama','thriller','romance']);
T('conversation_comedy','Conversation - Comedy',SC.CON,8,[[S.TS,'setup',2],[S.OS,'misunderstanding',3],[S.CU,'reaction',3]],E.JOY,['comedy','romance','family']);
T('dialogue_interrogation','Dialogue - Interrogation',SC.DIA,12,[[S.TS,'power',2],[S.OS,'question',3],[S.CU,'answer',3],[S.OS,'follow_up',2],[S.CU,'breakdown',2]],E.TENSE,['thriller','crime','drama']);
T('conversation_business','Conversation - Business',SC.CON,10,[[S.TS,'negotiation',2],[S.OS,'proposal',3],[S.CU,'consideration',3],[S.TS,'agreement',2]],E.EPIC,['business','corporate','drama']);
T('monologue_reflective','Monologue - Reflective',SC.MON,6,[[S.CU,'memory',3],[S.M,'reflection',3]],E.NOST,['drama','documentary','romance']);
T('dialogue_phone','Dialogue - Phone',SC.DIA,8,[[S.CU,'listener',3],[S.INS,'phone',2],[S.CU,'speaker',3]],E.TENSE,['thriller','drama','horror']);
T('conversation_mentoring','Conversation - Mentoring',SC.CON,10,[[S.TS,'guidance',2],[S.OS,'student',3],[S.CU,'realization',3],[S.M,'growth',2]],E.HOPE,['educational','drama','sports']);
T('conversation_farewell','Conversation - Farewell',SC.CON,8,[[S.TS,'departure',2],[S.OS,'goodbye',3],[S.CU,'tears',3]],E.SAD,['drama','romance','war']);

// ============================================
// 07. POV: 15
// ============================================
T('pov_first_person','POV - First Person',SC.POV,10,[[S.POV,'movement',3],[S.POV,'search',3],[S.POV,'discovery',2],[S.CU,'reaction',2]],E.CUR,['horror','thriller','adventure']);
T('pov_observation','POV - Observation',SC.POV,8,[[S.POV,'watch',3],[S.POV,'detail',3],[S.CU,'reaction',2]],E.MYS,['thriller','mystery','documentary']);
T('pov_fear','POV - Fear',SC.POV,8,[[S.POV,'darkness',2],[S.POV,'sound',3],[S.ECU,'sweat',2],[S.W,'threat',1]],E.SUSP,['horror','thriller']);
T('pov_joy','POV - Joy',SC.POV,6,[[S.POV,'run',2],[S.POV,'laugh',2],[S.CU,'smile',2]],E.JOY,['adventure','romance','comedy']);
T('pov_memory','POV - Memory',SC.POV,8,[[S.POV,'flash',2],[S.POV,'detail',3],[S.W,'present',3]],E.NOST,['drama','documentary','mystery']);
T('pov_chase','POV - Chase',SC.POV,10,[[S.POV,'run',3],[S.POV,'obstacle',3],[S.POV,'escape',2],[S.CU,'relief',2]],E.URG,['action','thriller','horror']);
T('pov_discovery','POV - Discovery',SC.POV,8,[[S.POV,'search',3],[S.POV,'find',3],[S.CU,'wonder',2]],E.CUR,['adventure','documentary','mystery']);
T('pov_dream','POV - Dream',SC.POV,8,[[S.POV,'float',3],[S.POV,'surreal',3],[S.CU,'awakening',2]],E.SUR,['drama','fantasy','horror']);
T('pov_competition','POV - Competition',SC.POV,8,[[S.POV,'race',3],[S.POV,'competition',3],[S.CU,'determination',2]],E.TENSE,['sports','action','drama']);
T('pov_nightmare','POV - Nightmare',SC.POV,8,[[S.POV,'darkness',3],[S.POV,'chase',3],[S.CU,'terror',2]],E.DARK,['horror','thriller','fantasy']);
T('pov_romantic','POV - Romantic',SC.POV,6,[[S.POV,'approach',2],[S.POV,'touch',2],[S.CU,'connection',2]],E.ROM,['romance','drama','comedy']);
T('pov_surveillance','POV - Surveillance',SC.POV,8,[[S.POV,'watch',3],[S.POV,'record',3],[S.CU,'discovery',2]],E.MYS,['thriller','spy','mystery']);
T('pov_falling','POV - Falling',SC.POV,5,[[S.POV,'fall',3],[S.CU,'panic',2]],E.DANG, ['horror','thriller','action']);
T('pov_voyage','POV - Voyage',SC.POV,10,[[S.POV,'departure',3],[S.POV,'journey',4],[S.CU,'arrival',3]],E.HOPE,['adventure','documentary','drama']);
T('pov_supernatural','POV - Supernatural',SC.POV,8,[[S.POV,'presence',3],[S.POV,'phenomenon',3],[S.ECU,'reaction',2]],E.MYS,['horror','fantasy','thriller']);

// ============================================
// 08. Object/Product: 30
// ============================================
T('product_hero_reveal','Product - Hero Reveal',SC.PROD,8,[[S.W,'environment',2],[S.INS,'silhouette',2],[S.W,'reveal',2],[S.CU,'hero_shot',2]],E.EPIC,['commercial','product','luxury']);
T('product_macro','Product - Macro',SC.PROD,6,[[S.MA,'texture',2],[S.ECU,'detail',2],[S.CU,'logo',2]],E.EPIC,['commercial','product']);
T('product_in_use','Product - In Use',SC.PROD,10,[[S.M,'character',2],[S.CU,'product',2],[S.M,'interaction',3],[S.CU,'result',3]],E.JOY,['commercial','lifestyle']);
T('product_unboxing','Product - Unboxing',SC.PROD,8,[[S.CU,'box',2],[S.INS,'open',3],[S.CU,'reveal',3]],E.CUR,['commercial','social','unboxing']);
T('product_comparison','Product - Comparison',SC.PROD,10,[[S.CU,'product_a',2],[S.CU,'product_b',2],[S.W,'side_by_side',3],[S.CU,'winner',3]],E.EPIC,['commercial','tech','business']);
T('product_lifestyle','Product - Lifestyle',SC.PROD,8,[[S.W,'lifestyle',3],[S.M,'interaction',3],[S.CU,'product',2]],E.JOY,['commercial','fashion','lifestyle']);
T('product_technical','Product - Technical',SC.PROD,10,[[S.CU,'component',3],[S.INS,'specs',3],[S.W,'system',4]],E.CUR,['tech','business','industrial']);
T('product_timeline','Product - Timeline',SC.PROD,12,[[S.INS,'past',3],[S.M,'present',4],[S.W,'future',5]],E.INS, ['commercial','business','tech']);
T('product_testimonial_usage','Product - Testimonial Usage',SC.PROD,10,[[S.M,'user',3],[S.CU,'product',3],[S.M,'result',4]],E.JOY,['business','commercial','social']);
T('product_detail','Product - Detail',SC.PROD,6,[[S.MA,'texture',2],[S.ECU,'detail',2],[S.CU,'craftsmanship',2]],E.EPIC,['luxury','commercial','craft']);
T('product_dramatic_reveal','Product - Dramatic Reveal',SC.PROD,8,[[S.W,'shadow',2],[S.TR,'approach',3],[S.W,'reveal',3]],E.EPIC,['commercial','luxury','automotive']);
T('product_user_journey','Product - User Journey',SC.PROD,15,[[S.M,'problem',3],[S.CU,'discovery',3],[S.M,'first_use',3],[S.CU,'benefit',3],[S.W,'success',3]],E.HOPE,['business','startup','commercial']);
T('product_nature','Product - Nature',SC.PROD,8,[[S.AE,'landscape',3],[S.M,'placement',3],[S.CU,'product',2]],E.PEACE,['outdoor','lifestyle','eco']);
T('product_slow_motion','Product - Slow Motion',SC.PROD,6,[[S.CU,'product',3],[S.ECU,'impact',2],[S.W,'result',1]],E.EPIC,['commercial','sports','automotive']);
T('product_360','Product - 360',SC.PROD,8,[[S.TR,'rotation',3],[S.CU,'feature_a',2],[S.CU,'feature_b',3]],E.EPIC,['commercial','tech','ecommerce']);
T('product_before_after','Product - Before/After',SC.PROD,8,[[S.M,'before',3],[S.CU,'transformation',3],[S.W,'result',2]],E.TRI,['beauty','fitness','home']);
T('product_hero_shot','Product - Hero Shot',SC.PROD,5,[[S.W,'environment',2],[S.CU,'product',3]],E.EPIC,['commercial','luxury','fashion']);
T('product_packaging','Product - Packaging',SC.PROD,5,[[S.INS,'box',2],[S.CU,'design',2],[S.W,'unbox',1]],E.JOY,['ecommerce','commercial','gift']);
T('product_feature','Product - Feature Highlight',SC.PROD,6,[[S.CU,'feature',3],[S.W,'benefit',3]],E.INS, ['tech','business','commercial']);
T('product_close_up','Product - Close-Up',SC.PROD,4,[[S.ECU,'detail',2],[S.CU,'craftsmanship',2]],E.EPIC,['luxury','craft','jewelry']);
T('product_lifestyle_family','Product - Lifestyle Family',SC.PROD,8,[[S.W,'family',3],[S.M,'gathering',3],[S.CU,'product',2]],E.JOY,['family','lifestyle','food']);
T('product_tech_demo','Product - Tech Demo',SC.PROD,10,[[S.CU,'interface',3],[S.INS,'screen',3],[S.M,'reaction',4]],E.CUR,['tech','business','startup']);
T('product_heroic','Product - Heroic',SC.PROD,8,[[S.LA,'product',2],[S.W,'environment',3],[S.CU,'impact',3]],E.EPIC,['automotive','luxury','commercial']);
T('product_environmental','Product - Environmental',SC.PROD,8,[[S.AE,'nature',3],[S.M,'placement',3],[S.CU,'product',2]],E.PEACE,['eco','outdoor','sustainable']);
T('product_storytelling','Product - Storytelling',SC.PROD,10,[[S.M,'character',3],[S.CU,'product',3],[S.W,'journey',4]],E.INS, ['brand','documentary','commercial']);
T('product_particle','Product - Particle',SC.PROD,6,[[S.MA,'particle',2],[S.CU,'detail',2],[S.W,'impact',2]],E.EPIC,['tech','beauty','sports']);
T('product_transparent','Product - Transparent',SC.PROD,6,[[S.CU,'structure',3],[S.INS,'inside',3]],E.CUR,['tech','industrial','design']);
T('product_urban','Product - Urban',SC.PROD,8,[[S.W,'city',3],[S.TR,'movement',3],[S.CU,'product',2]],E.EPIC,['streetwear','automotive','tech']);
T('product_micro','Product - Micro',SC.PROD,5,[[S.MA,'micro_detail',3],[S.CU,'reveal',2]],E.CUR,['tech','science','industrial']);
T('product_cinematic','Product - Cinematic',SC.PROD,10,[[S.W,'drama',3],[S.M,'interaction',3],[S.CU,'product',2],[S.W,'impact',2]],E.EPIC,['automotive','luxury','film']);

// ============================================
// 09. Discovery: 20
// ============================================
T('discovery_object','Discovery - Object',SC.DIS,10,[[S.W,'search',2],[S.M,'movement',2],[S.INS,'object_detail',2],[S.CU,'hand_picks_up',2],[S.ECU,'object_reveal',1],[S.CU,'reaction',1]],E.CUR,['mystery','thriller','adventure']);
T('discovery_location','Discovery - Location',SC.DIS,10,[[S.W,'travel',2],[S.TR,'approach',3],[S.W,'location_reveal',3],[S.CU,'character_reaction',2]],E.MYS,['adventure','fantasy','sci-fi']);
T('discovery_truth','Discovery - Truth',SC.DIS,10,[[S.M,'investigation',3],[S.CU,'evidence',3],[S.W,'realization',4]],E.MYS,['mystery','thriller','drama']);
T('discovery_secret','Discovery - Secret',SC.DIS,10,[[S.W,'normal',2],[S.INS,'hidden',3],[S.CU,'revelation',3],[S.M,'consequence',2]],E.MYS,['mystery','thriller','drama']);
T('discovery_entrance','Discovery - Entrance',SC.DIS,8,[[S.W,'wall',2],[S.M,'search',2],[S.CU,'opening',2],[S.W,'inside',2]],E.CUR,['adventure','horror','fantasy']);
T('discovery_treasure','Discovery - Treasure',SC.DIS,10,[[S.W,'search',2],[S.INS,'sparkle',2],[S.CU,'pickup',3],[S.W,'reaction',3]],E.TRI,['adventure','fantasy','family']);
T('discovery_creature','Discovery - Creature',SC.DIS,10,[[S.W,'wilderness',2],[S.INS,'track',3],[S.CU,'creature',3],[S.W,'reaction',2]],E.MYS,['adventure','documentary','sci-fi']);
T('discovery_map','Discovery - Map',SC.DIS,8,[[S.INS,'map',3],[S.CU,'examination',3],[S.W,'journey',2]],E.CUR,['adventure','mystery','family']);
T('discovery_artifact','Discovery - Artifact',SC.DIS,10,[[S.W,'ruins',2],[S.M,'excavation',3],[S.CU,'artifact',3],[S.ECU,'inscription',2]],E.MYS,['adventure','documentary','fantasy']);
T('discovery_evidence','Discovery - Evidence',SC.DIS,8,[[S.W,'crime',2],[S.INS,'clue',3],[S.CU,'revelation',3]],E.TENSE,['thriller','crime','mystery']);
T('discovery_ability','Discovery - Ability',SC.DIS,10,[[S.M,'ordinary',3],[S.CU,'manifestation',3],[S.W,'realization',4]],E.INS, ['fantasy','sci-fi','superhero']);
T('discovery_message','Discovery - Message',SC.DIS,6,[[S.INS,'letter',2],[S.CU,'reading',2],[S.M,'reaction',2]],E.MYS,['mystery','romance','drama']);
T('discovery_passage','Discovery - Passage',SC.DIS,8,[[S.W,'dead_end',2],[S.M,'search',2],[S.CU,'hidden_door',2],[S.W,'new_world',2]],E.CUR,['adventure','horror','fantasy']);
T('discovery_power','Discovery - Power',SC.DIS,10,[[S.W,'weakness',3],[S.CU,'source',3],[S.M,'transformation',4]],E.EPIC,['fantasy','sci-fi','action']);
T('discovery_identity','Discovery - Identity',SC.DIS,10,[[S.M,'search',3],[S.INS,'clue',3],[S.CU,'realization',4]],E.MYS,['mystery','drama','thriller']);
T('discovery_potion','Discovery - Potion',SC.DIS,6,[[S.INS,'ingredient',2],[S.CU,'mixing',2],[S.W,'effect',2]],E.MYS,['fantasy','adventure','horror']);
T('discovery_signal','Discovery - Signal',SC.DIS,6,[[S.W,'noise',2],[S.CU,'receiver',2],[S.M,'trace',2]],E.CUR,['sci-fi','thriller','documentary']);
T('discovery_ally','Discovery - Ally',SC.DIS,8,[[S.W,'enemy',2],[S.M,'crisis',3],[S.CU,'help',3]],E.HOPE,['action','adventure','drama']);
T('discovery_trap','Discovery - Trap',SC.DIS,6,[[S.W,'path',2],[S.INS,'mechanism',2],[S.CU,'realization',2]],E.DANG,['adventure','horror','thriller']);
T('discovery_truth_family','Discovery - Family Truth',SC.DIS,10,[[S.M,'family',3],[S.CU,'revelation',4],[S.W,'impact',3]],E.SAD,['drama','mystery','family']);

// ============================================
// 10. Reveal: 20
// ============================================
T('reveal_slow','Reveal - Slow',SC.REV,8,[[S.INS,'detail',2],[S.M,'medium',3],[S.W,'wide_reveal',3]],E.EPIC,['all']);
T('reveal_environment','Reveal - Environment',SC.REV,10,[[S.CU,'character',2],[S.M,'movement',3],[S.W,'environment_pullback',5]],E.EPIC,['epic','sci-fi','fantasy','documentary']);
T('reveal_identity','Reveal - Identity',SC.REV,8,[[S.M,'disguise',3],[S.CU,'removal',3],[S.W,'reaction',2]],E.MYS,['thriller','mystery','drama']);
T('reveal_body','Reveal - Body',SC.REV,8,[[S.INS,'discovery',3],[S.CU,'victim',3],[S.W,'crime_scene',2]],E.DARK,['horror','thriller','mystery']);
T('reveal_monster','Reveal - Monster',SC.REV,8,[[S.W,'darkness',2],[S.CU,'eyes',2],[S.W,'full_reveal',4]],E.DARK,['horror','sci-fi','fantasy']);
T('reveal_plan','Reveal - Plan',SC.REV,10,[[S.M,'setup',3],[S.INS,'diagram',3],[S.W,'execution',4]],E.MYS,['thriller','heist','spy']);
T('reveal_truth','Reveal - Truth',SC.REV,10,[[S.W,'lie',3],[S.CU,'evidence',3],[S.M,'acceptance',4]],E.SAD,['drama','mystery','thriller']);
T('reveal_secret_room','Reveal - Secret Room',SC.REV,8,[[S.W,'wall',2],[S.M,'search',2],[S.CU,'entrance',2],[S.W,'inside',2]],E.MYS,['mystery','horror','adventure']);
T('reveal_parentage','Reveal - Parentage',SC.REV,10,[[S.M,'investigation',3],[S.CU,'document',3],[S.W,'realization',4]],E.SAD,['drama','mystery','family']);
T('reveal_villain','Reveal - Villain',SC.REV,8,[[S.TS,'suspicion',3],[S.CU,'revelation',3],[S.W,'confrontation',2]],E.DARK,['thriller','mystery','crime']);
T('reveal_hero','Reveal - Hero',SC.REV,8,[[S.W,'doubt',3],[S.CU,'courage',3],[S.LA,'triumph',2]],E.TRI,['action','adventure','drama']);
T('reveal_magic','Reveal - Magic',SC.REV,8,[[S.M,'ordinary',2],[S.CU,'spark',3],[S.W,'transformation',3]],E.SUR,['fantasy','adventure','family']);
T('reveal_evidence','Reveal - Evidence',SC.REV,6,[[S.INS,'clue',2],[S.CU,'examination',2],[S.W,'connection',2]],E.MYS,['thriller','crime','mystery']);
T('reveal_future','Reveal - Future',SC.REV,10,[[S.M,'present',3],[S.W,'vision',4],[S.CU,'reaction',3]],E.EPIC,['sci-fi','fantasy','drama']);
T('reveal_weapon','Reveal - Weapon',SC.REV,6,[[S.W,'threat',2],[S.INS,'weapon',2],[S.CU,'power',2]],E.DANG,['action','thriller','sci-fi']);
T('reveal_ally','Reveal - Ally',SC.REV,6,[[S.W,'battle',2],[S.M,'arrival',2],[S.CU,'recognition',2]],E.TRI,['action','adventure','fantasy']);
T('reveal_betrayal','Reveal - Betrayal',SC.REV,8,[[S.TS,'trust',3],[S.CU,'reveal',3],[S.W,'consequence',2]],E.DARK,['thriller','drama','crime']);
T('reveal_power_source','Reveal - Power Source',SC.REV,8,[[S.W,'weakness',3],[S.INS,'source',3],[S.CU,'understanding',2]],E.CUR,['sci-fi','fantasy','action']);
T('reveal_dream','Reveal - Dream',SC.REV,8,[[S.M,'sleep',2],[S.W,'dreamscape',3],[S.CU,'awakening',3]],E.SUR,['drama','fantasy','horror']);
T('reveal_finale','Reveal - Finale',SC.REV,10,[[S.W,'setup',3],[S.M,'execution',3],[S.CU,'reaction',4]],E.EPIC,['action','drama','thriller']);

// ============================================
// 11. Investigation: 15
// ============================================
T('investigation_crime_scene','Investigation - Crime Scene',SC.INV,10,[[S.W,'scene',2],[S.TR,'examination',3],[S.CU,'clue',3],[S.INS,'evidence',2]],E.TENSE,['thriller','crime','mystery']);
T('investigation_interview','Investigation - Interview',SC.INV,12,[[S.TS,'setup',2],[S.OS,'question',3],[S.CU,'answer',3],[S.OS,'follow_up',2],[S.CU,'reaction',2]],E.MYS,['thriller','crime','documentary']);
T('investigation_search','Investigation - Search',SC.INV,8,[[S.W,'area',2],[S.TR,'movement',3],[S.INS,'discovery',3]],E.TENSE,['thriller','mystery','adventure']);
T('investigation_analysis','Investigation - Analysis',SC.INV,10,[[S.M,'data',3],[S.CU,'evidence',3],[S.W,'connection',4]],E.CUR,['thriller','crime','sci-fi']);
T('investigation_surveillance','Investigation - Surveillance',SC.INV,10,[[S.W,'target',2],[S.TR,'watch',3],[S.CU,'evidence',3],[S.M,'escape',2]],E.TENSE,['spy','thriller','crime']);
T('investigation_forensics','Investigation - Forensics',SC.INV,10,[[S.CU,'lab',3],[S.INS,'evidence',3],[S.M,'analysis',4]],E.MYS,['crime','thriller','mystery']);
T('investigation_stakeout','Investigation - Stakeout',SC.INV,12,[[S.W,'vantage',3],[S.CU,'patience',3],[S.TR,'movement',3],[S.M,'action',3]],E.TENSE,['crime','thriller','spy']);
T('investigation_reconstruction','Investigation - Reconstruction',SC.INV,10,[[S.W,'scene',2],[S.M,'replay',4],[S.CU,'insight',4]],E.MYS,['thriller','crime','mystery']);
T('investigation_online','Investigation - Online',SC.INV,8,[[S.INS,'screen',3],[S.CU,'discovery',3],[S.W,'implication',2]],E.TENSE,['thriller','crime','tech']);
T('investigation_witness','Investigation - Witness',SC.INV,10,[[S.TS,'interview',3],[S.CU,'testimony',3],[S.M,'reaction',4]],E.MYS,['crime','drama','mystery']);
T('investigation_undercover','Investigation - Undercover',SC.INV,12,[[S.W,'infiltration',3],[S.M,'gathering',4],[S.CU,'risk',3],[S.TR,'escape',2]],E.TENSE,['spy','crime','thriller']);
T('investigation_evidence_room','Investigation - Evidence Room',SC.INV,8,[[S.W,'room',2],[S.TR,'search',3],[S.INS,'item',3]],E.MYS,['crime','thriller','mystery']);
T('investigation_alibi','Investigation - Alibi',SC.INV,8,[[S.TS,'question',2],[S.CU,'lie',3],[S.M,'breakdown',3]],E.TENSE,['crime','thriller','drama']);
T('investigation_puzzle','Investigation - Puzzle',SC.INV,10,[[S.INS,'piece',3],[S.M,'connection',3],[S.W,'solution',4]],E.CUR,['mystery','thriller','documentary']);
T('investigation_conclusion','Investigation - Conclusion',SC.INV,10,[[S.W,'evidence',3],[S.M,'realization',3],[S.CU,'solution',4]],E.TRI, ['crime','mystery','thriller']);

// ============================================
// 12. Travel/Journey: 15
// ============================================
T('journey_road','Journey - Road',SC.JOU,15,[[S.W,'vehicle',3],[S.TR,'road',4],[S.W,'landscape',4],[S.CU,'character',4]],E.HOPE,['adventure','drama','road']);
T('journey_train','Journey - Train',SC.JOU,10,[[S.W,'station',2],[S.TR,'tracks',3],[S.M,'passenger',3],[S.W,'destination',2]],E.NOST,['drama','romance','mystery']);
T('journey_air','Journey - Air',SC.JOU,10,[[S.W,'airport',2],[S.AE,'flight',4],[S.M,'passenger',2],[S.W,'arrival',2]],E.EPIC,['adventure','drama','action']);
T('journey_sea','Journey - Sea',SC.JOU,12,[[S.W,'harbor',2],[S.AE,'ocean',4],[S.M,'ship',3],[S.W,'horizon',3]],E.HOPE,['adventure','documentary','drama']);
T('journey_foot','Journey - Foot',SC.JOU,10,[[S.W,'path',2],[S.TR,'walking',3],[S.M,'traveler',3],[S.W,'destination',2]],E.HOPE,['adventure','drama','spiritual']);
T('journey_cycle','Journey - Cycle',SC.JOU,8,[[S.W,'landscape',2],[S.TR,'riding',3],[S.CU,'cyclist',3]],E.PEACE,['documentary','sports','adventure']);
T('journey_caravan','Journey - Caravan',SC.JOU,12,[[S.W,'convoy',3],[S.TR,'desert',4],[S.M,'travelers',3],[S.W,'oasis',2]],E.EPIC,['adventure','western','sci-fi']);
T('journey_space','Journey - Space',SC.JOU,12,[[S.EW,'launch',3],[S.AE,'travel',4],[S.M,'crew',3],[S.W,'destination',2]],E.EPIC,['sci-fi','adventure','documentary']);
T('journey_river','Journey - River',SC.JOU,8,[[S.W,'source',2],[S.TR,'flow',3],[S.M,'boat',3]],E.PEACE,['adventure','documentary','drama']);
T('journey_metaphorical','Journey - Metaphorical',SC.JOU,10,[[S.W,'start',2],[S.TR,'struggle',3],[S.M,'transformation',3],[S.W,'arrival',2]],E.INS, ['drama','documentary','educational']);
T('journey_return','Journey - Return',SC.JOU,10,[[S.W,'departure',2],[S.TR,'travel',4],[S.CU,'homecoming',4]],E.NOST,['drama','romance','war']);
T('journey_exile','Journey - Exile',SC.JOU,12,[[S.W,'home',2],[S.TR,'departure',4],[S.M,'wilderness',3],[S.W,'new_home',3]],E.SAD,['drama','historical','war']);
T('journey_quest','Journey - Quest',SC.JOU,12,[[S.W,'call',2],[S.TR,'travel',4],[S.M,'trials',3],[S.W,'goal',3]],E.HOPE,['fantasy','adventure','action']);
T('journey_immigration','Journey - Immigration',SC.JOU,12,[[S.W,'home',2],[S.TR,'travel',4],[S.M,'arrival',3],[S.CU,'hope',3]],E.HOPE,['drama','documentary','historical']);
T('journey_spiritual','Journey - Spiritual',SC.JOU,10,[[S.W,'desert',2],[S.TR,'pilgrimage',3],[S.M,'revelation',3],[S.W,'peace',2]],E.PEACE,['documentary','drama','spiritual']);

// ============================================
// 13. Montage: 20
// ============================================
T('montage_training','Montage - Training',SC.MON2,20,[[S.W,'failure',3],[S.M,'practice',4],[S.CU,'progress',4],[S.W,'mastery',4],[S.EW,'achievement',3]],E.INS,['sports','business','personal']);
T('montage_transformation','Montage - Transformation',SC.MON2,15,[[S.M,'before',3],[S.CU,'process',4],[S.M,'progress',4],[S.W,'after',4]],E.INS,['commercial','personal','business']);
T('montage_workday','Montage - Workday',SC.MON2,15,[[S.W,'commute',3],[S.M,'work',4],[S.CU,'focus',4],[S.W,'evening',4]],E.EPIC,['business','corporate','documentary']);
T('montage_relationship','Montage - Relationship',SC.MON2,15,[[S.TS,'meeting',3],[S.M,'dating',4],[S.CU,'intimacy',4],[S.W,'commitment',4]],E.ROM,['romance','drama','comedy']);
T('montage_sport','Montage - Sport',SC.MON2,20,[[S.W,'training',4],[S.M,'practice',4],[S.CU,'focus',4],[S.W,'competition',4],[S.EW,'victory',4]],E.TRI,['sports','documentary','drama']);
T('montage_creative','Montage - Creative',SC.MON2,15,[[S.M,'idea',3],[S.CU,'sketch',3],[S.M,'creation',4],[S.W,'masterpiece',5]],E.INS,['documentary','art','educational']);
T('montage_city_life','Montage - City Life',SC.MON2,15,[[S.W,'skyline',3],[S.TR,'streets',4],[S.M,'people',4],[S.CU,'moments',4]],E.EPIC,['documentary','corporate','urban']);
T('montage_growth','Montage - Growth',SC.MON2,15,[[S.M,'seed',3],[S.CU,'sprout',3],[S.M,'growth',4],[S.W,'maturity',5]],E.INS, ['documentary','business','nature']);
T('montage_destruction','Montage - Destruction',SC.MON2,12,[[S.W,'order',3],[S.M,'chaos',3],[S.CU,'impact',3],[S.W,'ruin',3]],E.DANG,['action','war','disaster']);
T('montage_celebration','Montage - Celebration',SC.MON2,12,[[S.W,'gathering',3],[S.M,'party',3],[S.CU,'joy',3],[S.W,'community',3]],E.JOY,['drama','comedy','family']);
T('montage_war','Montage - War',SC.MON2,20,[[S.W,'training',4],[S.M,'battle',4],[S.CU,'loss',4],[S.W,'memorial',4],[S.EW,'peace',4]],E.DARK,['war','drama','action']);
T('montage_education','Montage - Education',SC.MON2,15,[[S.W,'class',3],[S.M,'study',4],[S.CU,'learning',4],[S.W,'graduation',4]],E.INS, ['documentary','educational','drama']);
T('montage_construction','Montage - Construction',SC.MON2,12,[[S.W,'blueprint',3],[S.M,'building',4],[S.CU,'detail',3],[S.W,'completion',2]],E.TRI, ['documentary','business','industrial']);
T('montage_medical','Montage - Medical',SC.MON2,15,[[S.W,'hospital',3],[S.M,'surgery',4],[S.CU,'recovery',4],[S.W,'healing',4]],E.INS, ['documentary','drama','medical']);
T('montage_technology','Montage - Technology',SC.MON2,15,[[S.INS,'chip',3],[S.M,'assembly',4],[S.CU,'innovation',4],[S.W,'future',4]],E.INS, ['tech','sci-fi','documentary']);
T('montage_social_media','Montage - Social Media',SC.MON2,12,[[S.INS,'phone',3],[S.CU,'notification',3],[S.M,'post',3],[S.W,'viral',3]],E.JOY,['social','comedy','documentary']);
T('montage_business_growth','Montage - Business Growth',SC.MON2,15,[[S.INS,'idea',2],[S.M,'first_customer',3],[S.W,'team',3],[S.CU,'revenue',3],[S.EW,'scale',4]],E.INS,['business','corporate','startup']);
T('montage_hero_journey','Montage - Hero Journey',SC.MON2,20,[[S.W,'call',3],[S.M,'trials',4],[S.CU,'growth',4],[S.W,'return',4],[S.EW,'transformation',5]],E.EPIC,['fantasy','adventure','action']);
T('montage_crime','Montage - Crime',SC.MON2,12,[[S.W,'plan',3],[S.M,'execution',4],[S.CU,'tension',3],[S.W,'consequence',2]],E.DANG,['crime','thriller','noir']);
T('montage_family','Montage - Family',SC.MON2,12,[[S.W,'home',3],[S.M,'moments',4],[S.CU,'love',3],[S.W,'generations',2]],E.JOY,['family','drama','comedy']);

// ============================================
// 14. Conflict: 20
// ============================================
T('conflict_verbal','Conflict - Verbal',SC.CONFL,15,[[S.TS,'establish',3],[S.OS,'character_a',3],[S.OS,'character_b',3],[S.CU,'reaction_a',2],[S.CU,'reaction_b',2],[S.ECU,'escalation',2]],E.TENSE,['drama','thriller','corporate']);
T('conflict_physical','Conflict - Physical',SC.CONFL,20,[[S.W,'confrontation',3],[S.M,'first_strike',3],[S.CU,'exchange',4],[S.LA,'turning_point',3],[S.W,'winner',3],[S.CU,'reaction',2],[S.M,'aftermath',2]],E.DANG,['action','thriller']);
T('conflict_internal','Conflict - Internal',SC.CONFL,12,[[S.M,'doubt',3],[S.CU,'struggle',4],[S.W,'choice',5]],E.TENSE,['drama','psychological','indie']);
T('conflict_social','Conflict - Social',SC.CONFL,12,[[S.W,'gathering',2],[S.M,'tension',3],[S.TS,'confrontation',4],[S.CU,'reaction',3]],E.TENSE,['drama','comedy','coming_of_age']);
T('conflict_business','Conflict - Business',SC.CONFL,12,[[S.TS,'negotiation',3],[S.OS,'demand',3],[S.CU,'pressure',3],[S.M,'resolution',3]],E.TENSE,['business','corporate','drama']);
T('conflict_family','Conflict - Family',SC.CONFL,15,[[S.TS,'gathering',3],[S.OS,'accusation',3],[S.CU,'hurt',3],[S.M,'silence',3],[S.W,'consequence',3]],E.DARK,['drama','family','comedy']);
T('conflict_ideological','Conflict - Ideological',SC.CONFL,12,[[S.W,'crowd',2],[S.M,'speech',3],[S.TS,'debate',4],[S.CU,'conviction',3]],E.TENSE,['drama','historical','political']);
T('conflict_romantic','Conflict - Romantic',SC.CONFL,10,[[S.TS,'tension',2],[S.OS,'argument',3],[S.CU,'hurt',3],[S.M,'distance',2]],E.TENSE,['romance','drama','comedy']);
T('conflict_sibling','Conflict - Sibling',SC.CONFL,12,[[S.TS,'rivalry',3],[S.OS,'competition',3],[S.CU,'resentment',3],[S.M,'realization',3]],E.TENSE,['drama','comedy','family']);
T('conflict_moral','Conflict - Moral',SC.CONFL,12,[[S.M,'dilemma',4],[S.CU,'choice',4],[S.W,'consequence',4]],E.DARK,['drama','thriller','war']);
T('conflict_authority','Conflict - Authority',SC.CONFL,12,[[S.LA,'authority',2],[S.M,'defiance',3],[S.CU,'rebellion',4],[S.W,'resolution',3]],E.TENSE,['drama','action','historical']);
T('conflict_legal','Conflict - Legal',SC.CONFL,12,[[S.W,'courtroom',2],[S.TS,'argument',4],[S.OS,'judgment',3],[S.CU,'verdict',3]],E.TENSE,['drama','thriller','legal']);
T('confract_environmental','Conflict - Environmental',SC.CONFL,12,[[S.AE,'nature',3],[S.W,'destruction',3],[S.CU,'protest',3],[S.M,'resolution',3]],E.DANG,['documentary','drama','action']);
T('conflict_war','Conflict - War',SC.CONFL,20,[[S.W,'battlefield',4],[S.M,'combat',4],[S.CU,'sacrifice',4],[S.W,'cost',4],[S.EW,'resolution',4]],E.DANG,['war','action','drama']);
T('conflict_political','Conflict - Political',SC.CONFL,12,[[S.W,'capitol',2],[S.M,'debate',4],[S.OS,'power',3],[S.CU,'decision',3]],E.TENSE,['political','drama','thriller']);
T('conflict_spiritual','Conflict - Spiritual',SC.CONFL,10,[[S.M,'faith',3],[S.CU,'doubt',3],[S.W,'answer',4]],E.MYS,['drama','fantasy','religious']);
T('conflict_technological','Conflict - Technological',SC.CONFL,10,[[S.CU,'interface',3],[S.M,'malfunction',3],[S.W,'solution',4]],E.TENSE,['sci-fi','thriller','tech']);
T('conflict_identity','Conflict - Identity',SC.CONFL,10,[[S.M,'discovery',3],[S.CU,'revelation',3],[S.W,'acceptance',4]],E.DARK,['drama','coming_of_age','mystery']);
T('conflict_time','Conflict - Time',SC.CONFL,10,[[S.W,'deadline',2],[S.TR,'countdown',4],[S.CU,'decision',4]],E.URG,['thriller','sci-fi','action']);
T('conflict_survival','Conflict - Survival',SC.CONFL,12,[[S.W,'wilderness',3],[S.M,'struggle',4],[S.CU,'hope',3],[S.W,'rescue',2]],E.DANG,['adventure','drama','survival']);

// ============================================
// 15. Chase: 15
// ============================================
T('chase_foot','Chase - Foot',SC.CHA,20,[[S.W,'threat',3],[S.TR,'running',5],[S.CU,'pursuer',3],[S.M,'obstacle',3],[S.W,'escape',3],[S.CU,'reaction',3]],E.URG,['action','thriller']);
T('chase_vehicle','Chase - Vehicle',SC.CHA,25,[[S.W,'pursuit',5],[S.TR,'close_call',5],[S.AE,'overview',3],[S.M,'escape',5],[S.CU,'reaction',3],[S.W,'safety',4]],E.URG,['action','thriller']);
T('chase_horse','Chase - Horse',SC.CHA,20,[[S.W,'start',3],[S.TR,'gallop',5],[S.M,'terrain',4],[S.CU,'rider',3],[S.W,'escape',5]],E.URG,['western','adventure','action']);
T('chase_aerial','Chase - Aerial',SC.CHA,20,[[S.AE,'pursuit',4],[S.TR,'maneuver',5],[S.CU,'pilot',4],[S.W,'escape',7]],E.URG,['action','sci-fi','adventure']);
T('chase_water','Chase - Water',SC.CHA,15,[[S.W,'boat',3],[S.TR,'chase',5],[S.M,'wave',4],[S.CU,'pursuer',3]],E.URG,['action','adventure','thriller']);
T('chase_space','Chase - Space',SC.CHA,20,[[S.EW,'pursuit',4],[S.AE,'dogfight',6],[S.CU,'pilot',4],[S.W,'escape',6]],E.URG,['sci-fi','action','adventure']);
T('chase_stealth','Chase - Stealth',SC.CHA,15,[[S.W,'hide',2],[S.HH,'movement',4],[S.CU,'concealment',3],[S.M,'escape',3],[S.W,'safety',3]],E.TENSE,['thriller','horror','action']);
T('chase_crowd','Chase - Crowd',SC.CHA,15,[[S.W,'crowd',3],[S.TR,'weaving',4],[S.CU,'panic',3],[S.M,'escape',5]],E.URG,['action','thriller','disaster']);
T('chase_rooftop','Chase - Rooftop',SC.CHA,15,[[S.W,'height',2],[S.TR,'sprinting',4],[S.M,'jump',3],[S.CU,'danger',3],[S.W,'safety',3]],E.DANG,['action','thriller','spy']);
T('chase_fantasy','Chase - Fantasy',SC.CHA,20,[[S.W,'realm',3],[S.TR,'flight',5],[S.CU,'creature',4],[S.W,'portal',4],[S.M,'escape',4]],E.URG,['fantasy','adventure','action']);
T('chase_underwater','Chase - Underwater',SC.CHA,15,[[S.W,'ocean',2],[S.TR,'swim',5],[S.M,'current',3],[S.CU,'diver',3],[S.W,'surface',2]],E.DANG,['action','adventure','thriller']);
T('chase_train','Chase - Train',SC.CHA,15,[[S.W,'train',3],[S.TR,'roof',4],[S.M,'action',4],[S.CU,'danger',2],[S.W,'jump',2]],E.URG,['action','thriller','adventure']);
T('chase_forest','Chase - Forest',SC.CHA,15,[[S.W,'forest',2],[S.TR,'sprint',4],[S.CU,'branches',3],[S.M,'escape',3],[S.W,'clearing',3]],E.TENSE,['horror','adventure','thriller']);
T('chase_martial_arts','Chase - Martial Arts',SC.CHA,15,[[S.W,'arena',2],[S.TR,'movement',5],[S.CU,'strike',3],[S.M,'defense',3],[S.W,'victory',2]],E.DANG,['action','martial_arts','thriller']);
T('chase_dog','Chase - Dog',SC.CHA,10,[[S.W,'start',2],[S.TR,'run',4],[S.CU,'determination',2],[S.W,'catch',2]],E.URG,['comedy','adventure','family']);

// ============================================
// 16. Action: 20
// ============================================
T('action_heroic','Action - Heroic',SC.ACT,20,[[S.W,'danger',3],[S.M,'charge',4],[S.CU,'determination',4],[S.W,'victory',4],[S.EW,'triumph',5]],E.TRI,['action','adventure','drama']);
T('action_explosion','Action - Explosion',SC.ACT,10,[[S.W,'setup',2],[S.CU,'spark',2],[S.W,'explosion',3],[S.M,'impact',3]],E.DANG,['action','thriller','war']);
T('action_gunfight','Action - Gunfight',SC.ACT,20,[[S.W,'showdown',3],[S.CU,'draw',3],[S.M,'fire',5],[S.W,'cover',4],[S.CU,'victory',5]],E.DANG,['action','western','thriller']);
T('action_superhero','Action - Superhero',SC.ACT,20,[[S.W,'city',3],[S.M,'power',4],[S.CU,'impact',4],[S.W,'victory',4],[S.EW,'save',5]],E.EPIC,['superhero','action','sci-fi']);
T('action_car_stunt','Action - Car Stunt',SC.ACT,15,[[S.W,'road',2],[S.M,'vehicle',4],[S.CU,'driver',3],[S.W,'jump',3],[S.CU,'landing',3]],E.DANG,['action','automotive','thriller']);
T('action_hand_to_hand','Action - Hand to Hand',SC.ACT,15,[[S.W,'arena',2],[S.M,'clash',4],[S.CU,'impact',4],[S.W,'winner',3],[S.CU,'defeat',2]],E.DANG,['action','martial_arts','thriller']);
T('action_rescue','Action - Rescue',SC.ACT,15,[[S.W,'danger',3],[S.M,'approach',4],[S.CU,'grab',3],[S.W,'escape',5]],E.TRI,['action','drama','adventure']);
T('action_defense','Action - Defense',SC.ACT,12,[[S.W,'threat',3],[S.M,'block',3],[S.CU,'counter',3],[S.W,'safety',3]],E.TENSE,['action','thriller','war']);
T('action_infiltration','Action - Infiltration',SC.ACT,15,[[S.W,'perimeter',2],[S.M,'sneak',4],[S.CU,'tension',4],[S.W,'inside',3],[S.M,'objective',2]],E.TENSE,['spy','action','thriller']);
T('action_military','Action - Military',SC.ACT,20,[[S.W,'formation',3],[S.M,'advance',4],[S.CU,'fire',4],[S.W,'tactical',4],[S.EW,'victory',5]],E.EPIC,['war','action','drama']);
T('action_survival','Action - Survival',SC.ACT,15,[[S.W,'wilderness',3],[S.M,'struggle',4],[S.CU,'resource',4],[S.W,'rescue',4]],E.TENSE,['adventure','survival','drama']);
T('action_sports','Action - Sports',SC.ACT,12,[[S.W,'competition',3],[S.M,'play',4],[S.CU,'moment',3],[S.W,'result',2]],E.TRI,['sports','documentary','drama']);
T('action_escape','Action - Escape',SC.ACT,12,[[S.W,'captivity',3],[S.M,'plan',3],[S.CU,'breakout',3],[S.W,'freedom',3]],E.URG,['action','thriller','prison']);
T('action_heist','Action - Heist',SC.ACT,20,[[S.W,'plan',3],[S.M,'execution',5],[S.CU,'tension',4],[S.W,'escape',4],[S.EW,'victory',4]],E.TENSE,['heist','action','thriller']);
T('action_parkour','Action - Parkour',SC.ACT,10,[[S.W,'city',2],[S.TR,'movement',4],[S.CU,'flow',2],[S.W,'landing',2]],E.URG,['action','sports','urban']);
T('action_ninja','Action - Ninja',SC.ACT,15,[[S.W,'rooftop',2],[S.TR,'stealth',4],[S.CU,'strike',4],[S.W,'escape',3],[S.M,'victory',2]],E.DANG,['action','martial_arts','adventure']);
T('action_disaster','Action - Disaster',SC.ACT,15,[[S.W,'calm',2],[S.M,'chaos',4],[S.CU,'survival',4],[S.W,'rescue',3],[S.EW,'relief',2]],E.DANG,['disaster','action','drama']);
T('action_competition','Action - Competition',SC.ACT,12,[[S.W,'arena',2],[S.M,'match',4],[S.CU,'climax',3],[S.W,'victory',3]],E.TENSE,['sports','action','drama']);
T('action_hijack','Action - Hijack',SC.ACT,15,[[S.W,'vehicle',2],[S.M,'takeover',4],[S.CU,'tension',4],[S.W,'resolution',3],[S.CU,'justice',2]],E.DANG,['action','thriller','crime']);
T('action_last_stand','Action - Last Stand',SC.ACT,15,[[S.W,'position',3],[S.M,'defense',4],[S.CU,'determination',4],[S.W,'reinforcement',4]],E.DANG,['action','war','western']);

// ... This is still going to be very long. Let me just write the complete file in one go by generating everything in the script.
