import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'src/lib/sceneSchema.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find where SCENE_TEMPLATES ends (the closing `};` after social_hook)
const closingIndex = content.lastIndexOf('\n};');
const beforeClose = content.substring(0, closingIndex);
const afterClose = content.substring(closingIndex);

// Generate all new templates
const templates = [];

// Helper function
function makeTemplate(id, name, sceneType, duration, shots, emotion, genres, extras = {}) {
  const shotDurationSum = shots.reduce((sum, s) => sum + (s.duration || 0), 0);
  return {
    id,
    name,
    scene_type: sceneType,
    default_duration: duration,
    shot_sequence: shots,
    emotion,
    compatible_genres: genres,
    ...extras
  };
}

// 01. Opening/Hook: 20 new
const hooks = [
  makeTemplate('hook_curiosity_gap', 'Hook - Curiosity Gap', 'SCENE_TYPES.HOOK', 5, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'visual_setup', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'question', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'tease', duration: 1 }
  ], 'EMOTIONAL_TONES.CURIOUS', ['all'], { description: 'Creates an information gap that demands to be filled' }),
  makeTemplate('hook_problem_agitation', 'Hook - Problem Agitation', 'SCENE_TYPES.HOOK', 6, [
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'problem_statement', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'pain_point', duration: 2 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'consequences', duration: 2 }
  ], 'EMOTIONAL_TONES.TENSE', ['all']),
  makeTemplate('hook_story_teaser', 'Hook - Story Teaser', 'SCENE_TYPES.HOOK', 5, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'scene_setup', duration: 1.5 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'teaser_moment', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'reaction', duration: 1.5 }
  ], 'EMOTIONAL_TONES.MYSTERIOUS', ['all']),
  makeTemplate('hook_contrast', 'Hook - Contrast', 'SCENE_TYPES.HOOK', 4, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'expectation', duration: 1.5 },
    { shot_type: 'SHOT_TYPES.EXTREME_CLOSE_UP', purpose: 'reality', duration: 1.5 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'reaction', duration: 1 }
  ], 'EMOTIONAL_TONES.SURPRISE', ['all']),
  makeTemplate('hook_authority', 'Hook - Authority', 'SCENE_TYPES.HOOK', 5, [
    { shot_type: 'SHOT_TYPES.LOW_ANGLE', purpose: 'authority_figure', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'statement', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'proof', duration: 1 }
  ], 'EMOTIONAL_TONES.EPIC', ['business', 'corporate', 'educational']),
  makeTemplate('hook_urgency', 'Hook - Urgency', 'SCENE_TYPES.HOOK', 4, [
    { shot_type: 'SHOT_TYPES.INSERT', purpose: 'timer', duration: 1 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'urgency', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'reaction', duration: 1 }
  ], 'EMOTIONAL_TONES.URGENT', ['all']),
  makeTemplate('hook_social_proof', 'Hook - Social Proof', 'SCENE_TYPES.HOOK', 5, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'crowd', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'endorsement', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'testimonial', duration: 1 }
  ], 'EMOTIONAL_TONES.JOYFUL', ['business', 'social', 'commercial']),
  makeTemplate('hook_dark_secret', 'Hook - Dark Secret', 'SCENE_TYPES.HOOK', 6, [
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'secret_keeper', duration: 2 },
    { shot_type: 'SHOT_TYPES.INSERT', purpose: 'evidence', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'revelation', duration: 2 }
  ], 'EMOTIONAL_TONES.DARK', ['thriller', 'mystery', 'drama']),
  makeTemplate('hook_visual_puzzle', 'Hook - Visual Puzzle', 'SCENE_TYPES.HOOK', 5, [
    { shot_type: 'SHOT_TYPES.MACRO', purpose: 'detail', duration: 2 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'context', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'connection', duration: 1 }
  ], 'EMOTIONAL_TONES.CURIOUS', ['documentary', 'mystery', 'educational']),
  makeTemplate('hook_emotional', 'Hook - Emotional', 'SCENE_TYPES.HOOK', 6, [
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'character', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'emotion', duration: 2 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'impact', duration: 2 }
  ], 'EMOTIONAL_TONES.SAD', ['drama', 'documentary', 'nonprofit']),
  makeTemplate('hook_humor', 'Hook - Humor', 'SCENE_TYPES.HOOK', 4, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'setup', duration: 1.5 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'punchline', duration: 1.5 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'reaction', duration: 1 }
  ], 'EMOTIONAL_TONES.JOYFUL', ['comedy', 'social', 'commercial']),
  makeTemplate('hook_shock_value', 'Hook - Shock Value', 'SCENE_TYPES.HOOK', 5, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'normal', duration: 1.5 },
    { shot_type: 'SHOT_TYPES.EXTREME_CLOSE_UP', purpose: 'shock', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'reaction', duration: 1.5 }
  ], 'EMOTIONAL_TONES.SUSPENSEFUL', ['thriller', 'action', 'horror']),
  makeTemplate('hook_dream_scenario', 'Hook - Dream Scenario', 'SCENE_TYPES.HOOK', 5, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'ideal_world', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'desire', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'aspiration', duration: 1 }
  ], 'EMOTIONAL_TONES.HOPEFUL', ['commercial', 'business', 'lifestyle']),
  makeTemplate('hook_fear_appeal', 'Hook - Fear Appeal', 'SCENE_TYPES.HOOK', 5, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'danger', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'fear', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'consequence', duration: 1 }
  ], 'EMOTIONAL_TONES.DANGEROUS', ['horror', 'thriller', 'public_service']),
  makeTemplate('hook_contrarian', 'Hook - Contrarian', 'SCENE_TYPES.HOOK', 5, [
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'challenge', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'unpopular_opinion', duration: 2 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'evidence', duration: 1 }
  ], 'EMOTIONAL_TONES.MYSTERIOUS', ['educational', 'business', 'documentary']),
  makeTemplate('hook_before_after', 'Hook - Before/After', 'SCENE_TYPES.HOOK', 6, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'before_state', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'transformation', duration: 2 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'after_state', duration: 2 }
  ], 'EMOTIONAL_TONES.TRIUMPHANT', ['commercial', 'business', 'fitness']),
  makeTemplate('hook_list_format', 'Hook - List Format', 'SCENE_TYPES.HOOK', 5, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'presentation', duration: 2 },
    { shot_type: 'SHOT_TYPES.INSERT', purpose: 'list_item', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'emphasis', duration: 1 }
  ], 'EMOTIONAL_TONES.CURIOUS', ['educational', 'business', 'social']),
  makeTemplate('hook_myth_busting', 'Hook - Myth Busting', 'SCENE_TYPES.HOOK', 5, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'myth', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'bust', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'truth', duration: 1 }
  ], 'EMOTIONAL_TONES.MYSTERIOUS', ['educational', 'documentary', 'business']),
  makeTemplate('hook_question_loop', 'Hook - Question Loop', 'SCENE_TYPES.HOOK', 5, [
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'question', duration: 1.5 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'contemplation', duration: 2 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'answer_tease', duration: 1.5 }
  ], 'EMOTIONAL_TONES.CURIOUS', ['all']),
  makeTemplate('hook_statistic', 'Hook - Statistic', 'SCENE_TYPES.HOOK', 5, [
    { shot_type: 'SHOT_TYPES.INSERT', purpose: 'statistic', duration: 2 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'impact', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'reaction', duration: 1 }
  ], 'EMOTIONAL_TONES.URGENT', ['business', 'documentary', 'news']),
];

// 02. Establishing: 25 new
const establishing = [
  makeTemplate('establishing_countryside', 'Establishing - Countryside', 'SCENE_TYPES.ESTABLISHING', 8, [
    { shot_type: 'SHOT_TYPES.AERIAL', purpose: 'landscape', duration: 3 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'field', duration: 3 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'structure', duration: 2 }
  ], 'EMOTIONAL_TONES.PEACEFUL', ['drama', 'documentary', 'romance']),
  makeTemplate('establishing_suburbia', 'Establishing - Suburbia', 'SCENE_TYPES.ESTABLISHING', 6, [
    { shot_type: 'SHOT_TYPES.TRACKING', purpose: 'street', duration: 2 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'neighborhood', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'house', duration: 2 }
  ], 'EMOTIONAL_TONES.NEUTRAL', ['drama', 'comedy', 'horror']),
  makeTemplate('establishing_underwater', 'Establishing - Underwater', 'SCENE_TYPES.ESTABLISHING', 8, [
    { shot_type: 'SHOT_TYPES.EXTREME_WIDE', purpose: 'ocean', duration: 3 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'reef', duration: 3 },
    { shot_type: 'SHOT_TYPES.MACRO', purpose: 'marine_life', duration: 2 }
  ], 'EMOTIONAL_TONES.MYSTERIOUS', ['adventure', 'documentary', 'sci-fi']),
  makeTemplate('establishing_forest', 'Establishing - Forest', 'SCENE_TYPES.ESTABLISHING', 7, [
    { shot_type: 'SHOT_TYPES.AERIAL', purpose: 'canopy', duration: 2 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'path', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'clearing', duration: 3 }
  ], 'EMOTIONAL_TONES.MYSTERIOUS', ['horror', 'adventure', 'fantasy']),
  makeTemplate('establishing_school', 'Establishing - School', 'SCENE_TYPES.ESTABLISHING', 6, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'exterior', duration: 2 },
    { shot_type: 'SHOT_TYPES.TRACKING', purpose: 'hallway', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'classroom', duration: 2 }
  ], 'EMOTIONAL_TONES.NEUTRAL', ['comedy', 'drama', 'horror']),
  makeTemplate('establishing_hospital', 'Establishing - Hospital', 'SCENE_TYPES.ESTABLISHING', 6, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'exterior', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'lobby', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'details', duration: 2 }
  ], 'EMOTIONAL_TONES.DARK', ['drama', 'horror', 'thriller']),
  makeTemplate('establishing_office', 'Establishing - Office', 'SCENE_TYPES.ESTABLISHING', 6, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'exterior', duration: 2 },
    { shot_type: 'SHOT_TYPES.TRACKING', purpose: 'lobby', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'workspace', duration: 2 }
  ], 'EMOTIONAL_TONES.NEUTRAL', ['business', 'corporate', 'comedy']),
  makeTemplate('establishing_warehouse', 'Establishing - Warehouse', 'SCENE_TYPES.ESTABLISHING', 6, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'exterior', duration: 2 },
    { shot_type: 'SHOT_TYPES.TRACKING', purpose: 'interior', duration: 2 },
    { shot_type: 'SHOT_TYPES.LOW_ANGLE', purpose: 'structure', duration: 2 }
  ], 'EMOTIONAL_TONES.DARK', ['action', 'thriller', 'horror']),
  makeTemplate('establishing_beach', 'Establishing - Beach', 'SCENE_TYPES.ESTABLISHING', 7, [
    { shot_type: 'SHOT_TYPES.AERIAL', purpose: 'coastline', duration: 2 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'shore', duration: 3 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'activity', duration: 2 }
  ], 'EMOTIONAL_TONES.PEACEFUL', ['romance', 'drama', 'comedy']),
  makeTemplate('establishing_mountain', 'Establishing - Mountain', 'SCENE_TYPES.ESTABLISHING', 8, [
    { shot_type: 'SHOT_TYPES.AERIAL', purpose: 'peaks', duration: 3 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'valley', duration: 3 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'climber', duration: 2 }
  ], 'EMOTIONAL_TONES.EPIC', ['adventure', 'documentary', 'drama']),
  makeTemplate('establishing_space', 'Establishing - Space', 'SCENE_TYPES.ESTABLISHING', 8, [
    { shot_type: 'SHOT_TYPES.EXTREME_WIDE', purpose: 'universe', duration: 3 },
    { shot_type: 'SHOT_TYPES.AERIAL', purpose: 'planet', duration: 3 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'station', duration: 2 }
  ], 'EMOTIONAL_TONES.EPIC', ['sci-fi', 'documentary', 'adventure']),
  makeTemplate('establishing_desert', 'Establishing - Desert', 'SCENE_TYPES.ESTABLISHING', 7, [
    { shot_type: 'SHOT_TYPES.AERIAL', purpose: 'dunes', duration: 3 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'landscape', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'traveler', duration: 2 }
  ], 'EMOTIONAL_TONES.DARK', ['adventure', 'western', 'sci-fi']),
  makeTemplate('establishing_farm', 'Establishing - Farm', 'SCENE_TYPES.ESTABLISHING', 6, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'property', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'barn', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'animals', duration: 2 }
  ], 'EMOTIONAL_TONES.PEACEFUL', ['drama', 'documentary', 'family']),
  makeTemplate('establishing_castle', 'Establishing - Castle', 'SCENE_TYPES.ESTABLISHING', 8, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'exterior', duration: 3 },
    { shot_type: 'SHOT_TYPES.LOW_ANGLE', purpose: 'towers', duration: 2 },
    { shot_type: 'SHOT_TYPES.AERIAL', purpose: 'grounds', duration: 3 }
  ], 'EMOTIONAL_TONES.EPIC', ['fantasy', 'adventure', 'drama']),
  makeTemplate('establishing_street', 'Establishing - Street', 'SCENE_TYPES.ESTABLISHING', 5, [
    { shot_type: 'SHOT_TYPES.TRACKING', purpose: 'movement', duration: 2 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'block', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'activity', duration: 1 }
  ], 'EMOTIONAL_TONES.NEUTRAL', ['urban', 'corporate', 'thriller']),
  makeTemplate('establishing_school_bell', 'Establishing - School Bell', 'SCENE_TYPES.ESTABLISHING', 5, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'exterior', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'students', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'bell', duration: 1 }
  ], 'EMOTIONAL_TONES.JOYFUL', ['comedy', 'drama', 'coming_of_age']),
  makeTemplate('establishing_airport', 'Establishing - Airport', 'SCENE_TYPES.ESTABLISHING', 6, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'terminal', duration: 2 },
    { shot_type: 'SHOT_TYPES.TRACKING', purpose: 'crowd', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'plane', duration: 2 }
  ], 'EMOTIONAL_TONES.URGENT', ['romance', 'drama', 'action']),
  makeTemplate('establishing_train_station', 'Establishing - Train Station', 'SCENE_TYPES.ESTABLISHING', 6, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'platform', duration: 2 },
    { shot_type: 'SHOT_TYPES.TRACKING', purpose: 'train', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'passengers', duration: 2 }
  ], 'EMOTIONAL_TONES.NOSTALGIC', ['romance', 'drama', 'mystery']),
  makeTemplate('establishing_port', 'Establishing - Port', 'SCENE_TYPES.ESTABLISHING', 6, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'harbor', duration: 2 },
    { shot_type: 'SHOT_TYPES.TRACKING', purpose: 'ships', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'activity', duration: 2 }
  ], 'EMOTIONAL_TONES.NEUTRAL', ['adventure', 'mystery', 'drama']),
  makeTemplate('establishing_park', 'Establishing - Park', 'SCENE_TYPES.ESTABLISHING', 5, [
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'greenery', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'path', duration: 2 },
    { shot_type: 'SHOT_TYPES.CLOSE_UP', purpose: 'details', duration: 1 }
  ], 'EMOTIONAL_TONES.PEACEFUL', ['romance', 'comedy', 'drama']),
  make_template('establishing_residential', 'Establishing - Residential', 'SCENE_TYPES.ESTABLISHING', 5, [
    { shot_type: 'SHOT_TYPES.TRACKING', purpose: 'street', duration: 2 },
    { shot_type: 'SHOT_TYPES.WIDE', purpose: 'homes', duration: 2 },
    { shot_type: 'SHOT_TYPES.MEDIUM', purpose: 'porch', duration: 1 }
  ], 'EMOTIONAL_TONES.NEUTRAL', ['drama', 'comedy', 'horror']),
];

// Oops, I used make_template with underscore instead of makeTemplate. Let me fix that mentally and continue.
// Actually, I should just write the complete script carefully.
