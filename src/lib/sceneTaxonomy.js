/**
 * SCENE TAXONOMY
 *
 * Master scene classes for the cinematic AI director.
 * Each entry is a stable vocabulary token used by the scene selector,
 * prompt assembler, and storyboard renderer.
 */

import {
  SCENE_TYPES,
  SHOT_TYPES,
  CAMERA_MOVEMENTS,
  EMOTIONAL_TONES,
  LIGHTING_STYLES,
  createEmptyScene
} from './sceneSchema.js';

// ============================================
// STORY PURPOSE
// ============================================

export const STORY_PURPOSES = {
  HOOK: 'hook',
  INTRODUCTION: 'introduction',
  EXPOSITION: 'exposition',
  DISCOVERY: 'discovery',
  CONFLICT: 'conflict',
  ESCALATION: 'escalation',
  TRANSFORMATION: 'transformation',
  CLIMAX: 'climax',
  RESOLUTION: 'resolution',
  CTA: 'cta'
};

// ============================================
// MASTER SCENE CLASSES
// ============================================

export const SCENE_CLASSES = {
  cold_open: {
    id: 'cold_open',
    name: 'Cold Open',
    scene_type: SCENE_TYPES.COLD_OPEN,
    storyPurpose: STORY_PURPOSES.HOOK,
    beats: ['extreme_event', 'confusion', 'reveal_context'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.MEDIUM],
    emotionalTone: [EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.MYSTERIOUS],
    keywords: [EMOTIONAL_TONES.DRAMATIC, 'middle of action', 'no context', 'start in medias res']
  },
  hook: {
    id: 'hook',
    name: 'Hook',
    storyPurpose: STORY_PURPOSES.HOOK,
    beats: ['unexpected_visual', 'statement', 'story_launch'],
    suggestedShots: [SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.WIDE, CAMERA_MOVEMENTS.PUSH_IN],
    emotionalTone: [EMOTIONAL_TONES.URGENT, EMOTIONAL_TONES.CURIOUS],
    keywords: ['pattern interrupt', 'attention grab', 'first seconds', 'scroll stop']
  },
  establishing: {
    id: 'establishing',
    name: 'Establishing',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['sky_or_environment', 'location', 'characters'],
    suggestedShots: [SHOT_TYPES.WIDE, 'birds_eye', CAMERA_MOVEMENTS.CRANE_DOWN],
    emotionalTone: [EMOTIONAL_TONES.PEACEFUL, EMOTIONAL_TONES.NEUTRAL, EMOTIONAL_TONES.GRAND],
    keywords: ['world building', 'location', 'where and when', 'context']
  },
  character_introduction: {
    id: 'character_introduction',
    name: 'Character Introduction',
    storyPurpose: STORY_PURPOSES.INTRODUCTION,
    beats: ['environment', 'silhouette', 'face', 'action'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.LOW_ANGLE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.NEUTRAL, EMOTIONAL_TONES.CURIOUS, EMOTIONAL_TONES.HOPEFUL],
    keywords: ['meet the character', 'hero', 'protagonist', 'introduce']
  },
  environment_introduction: {
    id: 'environment_introduction',
    name: 'Environment Introduction',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['macro_detail', 'medium_environment', 'wide_environment'],
    suggestedShots: [SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE, CAMERA_MOVEMENTS.CRANE_UP],
    emotionalTone: [EMOTIONAL_TONES.NEUTRAL, EMOTIONAL_TONES.AWE, EMOTIONAL_TONES.MYSTERIOUS],
    keywords: ['world', 'place', 'setting', 'location reveal']
  },
  normal_world: {
    id: 'normal_world',
    name: 'Normal World',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: [EMOTIONAL_TONES.ROUTINE, 'environment', 'character_state'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE, SHOT_TYPES.TRACKING],
    emotionalTone: [EMOTIONAL_TONES.PEACEFUL, EMOTIONAL_TONES.ROUTINE, EMOTIONAL_TONES.CONTENT],
    keywords: ['before', 'status quo', 'everyday', 'baseline']
  },
  inciting_event: {
    id: 'inciting_event',
    name: 'Inciting Event',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['normal_activity', 'disruption', 'event', 'reaction'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.WIDE],
    emotionalTone: [EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.URGENT, EMOTIONAL_TONES.SHOCKING],
    keywords: ['call to adventure', 'disruption', 'change', 'incident']
  },
  character_reaction: {
    id: 'character_reaction',
    name: 'Character Reaction',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['event', 'character_look', 'emotion', 'response'],
    suggestedShots: [SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.OVER_SHOULDER],
    emotionalTone: [EMOTIONAL_TONES.SURPRISE, EMOTIONAL_TONES.FEAR, EMOTIONAL_TONES.DETERMINATION, EMOTIONAL_TONES.ANGER],
    keywords: ['response', 'emotion', 'feeling', 'aftermath']
  },
  dialogue: {
    id: 'dialogue',
    name: 'Dialogue',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['establishing_two_shot', 'character_a', 'character_b', 'reaction_a', 'reaction_b'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.OVER_SHOULDER, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.PROFILE],
    emotionalTone: [EMOTIONAL_TONES.NEUTRAL, EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.WARM, EMOTIONAL_TONES.CONFRONTATIONAL],
    keywords: ['conversation', 'talking', 'speech', 'discussion']
  },
  conversation: {
    id: 'conversation',
    name: 'Conversation',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: [SHOT_TYPES.TWO_SHOT, 'speaker_a', 'speaker_b', 'reaction', SHOT_TYPES.TWO_SHOT],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.OVER_SHOULDER, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.PROFILE],
    emotionalTone: [EMOTIONAL_TONES.NEUTRAL, EMOTIONAL_TONES.WARM, EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.INTIMATE],
    keywords: ['dialogue', 'exchange', 'back and forth', 'talk']
  },
  monologue: {
    id: 'monologue',
    name: 'Monologue',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['character', 'speech', 'reaction_or_cutaway'],
    suggestedShots: [SHOT_TYPES.CLOSE_UP, SHOT_TYPES.MEDIUM, SHOT_TYPES.EXTREME_CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.REFLECTIVE, EMOTIONAL_TONES.DETERMINATION, EMOTIONAL_TONES.SAD, EMOTIONAL_TONES.INSPIRATIONAL],
    keywords: ['speech', 'soliloquy', 'address', 'narration']
  },
  pov: {
    id: SHOT_TYPES.POV,
    name: 'POV',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['character', 'pov_view', 'object_or_event', 'reaction'],
    suggestedShots: [SHOT_TYPES.POV, SHOT_TYPES.OVER_SHOULDER, SHOT_TYPES.CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.IMMERSIVE, EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.CURIOUS, EMOTIONAL_TONES.FEAR],
    keywords: ['first person', 'through eyes', 'perspective', 'see']
  },
  action: {
    id: 'action',
    name: 'Action',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['intent', 'movement', 'execution', 'result'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.TRACKING, SHOT_TYPES.LOW_ANGLE],
    emotionalTone: [EMOTIONAL_TONES.ENERGETIC, EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.URGENT],
    keywords: ['movement', 'physical', 'doing', 'activity']
  },
  discovery: {
    id: 'discovery',
    name: 'Discovery',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['search', 'detail', 'discovery', 'reaction'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.CURIOUS, EMOTIONAL_TONES.SURPRISE, EMOTIONAL_TONES.AMAZED],
    keywords: ['find', 'discover', 'realize', 'uncover', 'reveal']
  },
  investigation: {
    id: 'investigation',
    name: 'Investigation',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['location', 'evidence', 'character', 'clue'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.OVER_SHOULDER],
    emotionalTone: [EMOTIONAL_TONES.CURIOUS, EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.ANALYTICAL],
    keywords: ['detective', 'search', 'examine', 'research', 'clue']
  },
  reveal: {
    id: 'reveal',
    name: 'Reveal',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['setup', 'withhold', 'reveal_moment', 'reaction'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE, SHOT_TYPES.CLOSE_UP, CAMERA_MOVEMENTS.PULL_OUT],
    emotionalTone: ['surprising', EMOTIONAL_TONES.SHOCKING, 'amazing', EMOTIONAL_TONES.SATISFYING],
    keywords: ['reveal', 'discovery', 'twist', 'unexpected', 'show']
  },
  transformation: {
    id: 'transformation',
    name: 'Transformation',
    storyPurpose: STORY_PURPOSES.TRANSFORMATION,
    beats: ['before_state', 'process', 'progress', 'after_state'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, 'montage'],
    emotionalTone: [EMOTIONAL_TONES.INSPIRATIONAL, EMOTIONAL_TONES.HOPEFUL, EMOTIONAL_TONES.DRAMATIC, EMOTIONAL_TONES.UPLIFTING],
    keywords: ['change', 'before after', 'metamorphosis', 'evolution']
  },
  journey: {
    id: 'journey',
    name: 'Journey',
    storyPurpose: STORY_PURPOSES.ESCALATION,
    beats: ['preparation', 'departure', 'travel', 'arrival'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.TRACKING, SHOT_TYPES.MEDIUM, CAMERA_MOVEMENTS.CRANE_UP],
    emotionalTone: [EMOTIONAL_TONES.DETERMINATION, EMOTIONAL_TONES.HOPEFUL, EMOTIONAL_TONES.ADVENTUROUS],
    keywords: ['travel', 'quest', 'path', 'road', 'movement']
  },
  arrival: {
    id: 'arrival',
    name: 'Arrival',
    storyPurpose: STORY_PURPOSES.ESCALATION,
    beats: ['travel', 'destination', 'character_reaction', 'establishing'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, CAMERA_MOVEMENTS.CRANE_UP, CAMERA_MOVEMENTS.PUSH_IN],
    emotionalTone: [EMOTIONAL_TONES.ANTICIPATORY, EMOTIONAL_TONES.AWE, 'relief'],
    keywords: ['reach', 'arrive', 'destination', 'goal']
  },
  departure: {
    id: 'departure',
    name: 'Departure',
    storyPurpose: STORY_PURPOSES.ESCALATION,
    beats: ['character', 'door_or_threshold', 'exterior', SHOT_TYPES.WIDE],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE, SHOT_TYPES.TRACKING, CAMERA_MOVEMENTS.CRANE_UP],
    emotionalTone: [EMOTIONAL_TONES.BITTERSWEET, EMOTIONAL_TONES.DETERMINATION, EMOTIONAL_TONES.ANTICIPATORY],
    keywords: ['leave', 'exit', 'go', 'depart']
  },
  montage: {
    id: 'montage',
    name: 'Montage',
    storyPurpose: STORY_PURPOSES.TRANSFORMATION,
    beats: ['starting_state', 'accelerated_change', 'final_state'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, 'montage'],
    emotionalTone: [EMOTIONAL_TONES.ENERGETIC, EMOTIONAL_TONES.INSPIRATIONAL, EMOTIONAL_TONES.UPLIFTING],
    keywords: ['time compression', 'sequence', 'rapid', 'passage of time']
  },
  training: {
    id: 'training',
    name: 'Training',
    storyPurpose: STORY_PURPOSES.TRANSFORMATION,
    beats: ['failure', 'practice', 'progress', 'mastery'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, 'montage'],
    emotionalTone: [EMOTIONAL_TONES.DETERMINATION, EMOTIONAL_TONES.HOPEFUL, EMOTIONAL_TONES.INSPIRATIONAL],
    keywords: ['learn', 'practice', 'improve', 'skill', 'mastery']
  },
  romance: {
    id: 'romance',
    name: 'Romance',
    storyPurpose: STORY_PURPOSES.TRANSFORMATION,
    beats: ['meeting', 'connection', 'intimacy', 'emotional_moment'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.OVER_SHOULDER, SHOT_TYPES.WIDE],
    emotionalTone: [EMOTIONAL_TONES.WARM, EMOTIONAL_TONES.INTIMATE, EMOTIONAL_TONES.JOYFUL, 'tender'],
    keywords: ['love', 'relationship', 'connection', 'intimacy']
  },
  conflict: {
    id: 'conflict',
    name: 'Conflict',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['tension', 'confrontation', 'escalation', 'turning_point'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, SHOT_TYPES.DUTCH_ANGLE],
    emotionalTone: [EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.ANGER, EMOTIONAL_TONES.DETERMINATION, EMOTIONAL_TONES.FEAR],
    keywords: ['argument', 'fight', 'disagreement', 'struggle']
  },
  confrontation: {
    id: 'confrontation',
    name: 'Confrontation',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['calm', 'trigger', 'argument', 'escalation'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, SHOT_TYPES.EXTREME_CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.ANGER, 'defiant', 'charged'],
    keywords: ['face off', 'showdown', 'argument', 'challenge']
  },
  chase: {
    id: 'chase',
    name: 'Chase',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['threat', 'running', 'pursuer', 'obstacle', 'escape'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.TRACKING, SHOT_TYPES.LOW_ANGLE, SHOT_TYPES.HANDHELD],
    emotionalTone: [EMOTIONAL_TONES.URGENT, EMOTIONAL_TONES.FEAR, EMOTIONAL_TONES.TENSE, 'excited'],
    keywords: ['run', 'pursue', 'escape', 'flee', 'chase']
  },
  escape: {
    id: 'escape',
    name: 'Escape',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['threat', 'movement', 'obstacles', 'exit'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE, SHOT_TYPES.TRACKING, SHOT_TYPES.HANDHELD],
    emotionalTone: [EMOTIONAL_TONES.URGENT, EMOTIONAL_TONES.FEAR, EMOTIONAL_TONES.DETERMINATION],
    keywords: ['flee', 'exit', 'breakout', 'get away']
  },
  rescue: {
    id: 'rescue',
    name: 'Rescue',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['danger', 'arrival', 'intervention', 'escape'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.LOW_ANGLE],
    emotionalTone: [EMOTIONAL_TONES.URGENT, EMOTIONAL_TONES.HOPEFUL, 'heroic'],
    keywords: ['save', 'help', 'intervene', 'protect']
  },
  suspense: {
    id: 'suspense',
    name: 'Suspense',
    storyPurpose: STORY_PURPOSES.ESCALATION,
    beats: ['character', 'environment', 'sound', 'threat'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, SHOT_TYPES.DUTCH_ANGLE],
    emotionalTone: [EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.FEAR, EMOTIONAL_TONES.ANTICIPATORY],
    keywords: ['tension', 'dread', 'waiting', 'impending']
  },
  horror: {
    id: 'horror',
    name: 'Horror',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['atmosphere', 'strange_event', 'character_reaction', 'threat'],
    suggestedShots: [EMOTIONAL_TONES.DARK, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, SHOT_TYPES.DUTCH_ANGLE],
    emotionalTone: [EMOTIONAL_TONES.FEAR, 'terrified', 'unsettled'],
    keywords: ['scary', 'fear', 'monster', EMOTIONAL_TONES.DARK, 'threat']
  },
  comedy: {
    id: 'comedy',
    name: 'Comedy',
    storyPurpose: STORY_PURPOSES.TRANSFORMATION,
    beats: ['setup', 'expectation', 'unexpected_result', 'reaction'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, 'reaction'],
    emotionalTone: ['playful', EMOTIONAL_TONES.SURPRISE, 'amused'],
    keywords: ['funny', 'humor', 'unexpected', 'reaction']
  },
  emotional: {
    id: 'emotional',
    name: 'Emotional',
    storyPurpose: STORY_PURPOSES.RESOLUTION,
    beats: ['moment', 'emotion', 'reaction', 'aftermath'],
    suggestedShots: [SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE],
    emotionalTone: [EMOTIONAL_TONES.SAD, EMOTIONAL_TONES.JOYFUL, EMOTIONAL_TONES.NOSTALGIC, 'tender'],
    keywords: ['feeling', 'emotion', 'heart', 'touching', 'moving']
  },
  flashback: {
    id: 'flashback',
    name: 'Flashback',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['present_trigger', 'transition', 'past', 'return'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, CAMERA_MOVEMENTS.PUSH_IN],
    emotionalTone: [EMOTIONAL_TONES.NOSTALGIC, EMOTIONAL_TONES.REFLECTIVE, EMOTIONAL_TONES.SAD, 'informative'],
    keywords: ['memory', 'past', 'remember', 'flashback']
  },
  dream: {
    id: 'dream',
    name: 'Dream / Surreal',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['normal', 'distortion', EMOTIONAL_TONES.SURREAL, 'awakening'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.DUTCH_ANGLE, CAMERA_MOVEMENTS.PUSH_IN],
    emotionalTone: [EMOTIONAL_TONES.SURREAL, EMOTIONAL_TONES.MYSTERIOUS, 'ethereal'],
    keywords: ['dream', EMOTIONAL_TONES.SURREAL, 'abstract', 'symbolic']
  },
  technology: {
    id: 'technology',
    name: 'Technology',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['interface', 'data', 'result', 'reaction'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.OVER_SHOULDER, SHOT_TYPES.POV],
    emotionalTone: ['futuristic', EMOTIONAL_TONES.ANALYTICAL, 'impressed'],
    keywords: ['tech', 'digital', 'ai', 'interface', 'screen']
  },
  product: {
    id: 'product',
    name: 'Product',
    storyPurpose: STORY_PURPOSES.CTA,
    beats: ['silhouette', 'reveal', 'detail', 'hero_shot'],
    suggestedShots: [SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.WIDE, SHOT_TYPES.LOW_ANGLE],
    emotionalTone: ['desirable', 'premium', 'exciting'],
    keywords: ['product', 'item', 'goods', 'offer', 'solution']
  },
  demonstration: {
    id: 'demonstration',
    name: 'Demonstration',
    storyPurpose: STORY_PURPOSES.CTA,
    beats: ['problem', 'product', 'use', 'result'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.OVER_SHOULDER, SHOT_TYPES.WIDE],
    emotionalTone: ['informative', 'confident', 'satisfied'],
    keywords: ['demo', 'show', 'how to', 'use', 'feature']
  },
  testimonial: {
    id: 'testimonial',
    name: 'Testimonial',
    storyPurpose: STORY_PURPOSES.RESOLUTION,
    beats: ['introduction', 'problem', 'solution', 'result', 'recommendation'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.OVER_SHOULDER, 'b_roll'],
    emotionalTone: ['authentic', 'grateful', 'satisfied', 'trustworthy'],
    keywords: ['customer', 'review', 'story', 'experience', 'proof']
  },
  documentary: {
    id: 'documentary',
    name: 'Documentary',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['location', 'subject', 'interview', 'evidence', 'resolution'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, 'observational'],
    emotionalTone: ['authentic', 'informative', EMOTIONAL_TONES.REFLECTIVE],
    keywords: ['real', 'true story', 'interview', 'observational']
  },
  interview: {
    id: 'interview',
    name: 'Interview',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['environment', 'person', 'question', 'answer', 'reaction'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.OVER_SHOULDER],
    emotionalTone: ['authentic', 'thoughtful', EMOTIONAL_TONES.REFLECTIVE],
    keywords: ['question', 'answer', 'speak', 'talk', 'q&a']
  },
  explainer: {
    id: 'explainer',
    name: 'Explainer',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['problem', 'concept', 'visualization', 'example', 'result'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, 'diagram'],
    emotionalTone: ['informative', 'clear', 'confident'],
    keywords: ['explain', 'teach', 'how it works', 'education']
  },
  visualization: {
    id: 'visualization',
    name: 'Visualization',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['data', 'concept', 'visual', 'result'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.CLOSE_UP, 'diagram', 'animation'],
    emotionalTone: ['informative', 'clear', 'impressive'],
    keywords: ['data viz', 'chart', 'graph', 'abstract', 'diagram']
  },
  time_passage: {
    id: 'time_passage',
    name: 'Time Passage',
    storyPurpose: STORY_PURPOSES.TRANSFORMATION,
    beats: ['starting_state', 'accelerated_change', 'final_state'],
    suggestedShots: [SHOT_TYPES.WIDE, 'time_lapse', 'montage'],
    emotionalTone: [EMOTIONAL_TONES.NOSTALGIC, EMOTIONAL_TONES.INSPIRATIONAL, EMOTIONAL_TONES.REFLECTIVE],
    keywords: ['time lapse', 'passage', 'change', 'duration']
  },
  scale_reveal: {
    id: 'scale_reveal',
    name: 'Scale Reveal',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['tiny_detail', 'camera_pullback', 'massive_object'],
    suggestedShots: [SHOT_TYPES.EXTREME_CLOSE_UP, CAMERA_MOVEMENTS.PULL_OUT, CAMERA_MOVEMENTS.CRANE_UP, SHOT_TYPES.WIDE],
    emotionalTone: [EMOTIONAL_TONES.AWE, EMOTIONAL_TONES.SURPRISE, EMOTIONAL_TONES.INSPIRATIONAL],
    keywords: ['scale', 'massive', 'pull back', 'reveal size']
  },
  climax: {
    id: 'climax',
    name: 'Climax',
    storyPurpose: STORY_PURPOSES.CLIMAX,
    beats: ['tension_peak', 'action', 'outcome', 'reaction'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.LOW_ANGLE, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP],
    emotionalTone: ['intense', EMOTIONAL_TONES.TRIUMPHANT, EMOTIONAL_TONES.DRAMATIC, EMOTIONAL_TONES.URGENT],
    keywords: ['peak', 'final', 'decisive', 'turning point', 'outcome']
  },
  resolution: {
    id: 'resolution',
    name: 'Resolution',
    storyPurpose: STORY_PURPOSES.RESOLUTION,
    beats: ['outcome', 'character_state', 'new_normal'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE, SHOT_TYPES.CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.PEACEFUL, 'satisfied', EMOTIONAL_TONES.REFLECTIVE, EMOTIONAL_TONES.HOPEFUL],
    keywords: ['ending', 'conclusion', 'result', 'aftermath']
  },
  emotional_ending: {
    id: 'emotional_ending',
    name: 'Emotional Ending',
    storyPurpose: STORY_PURPOSES.RESOLUTION,
    beats: ['resolution', SHOT_TYPES.CLOSE_UP, 'silence', SHOT_TYPES.WIDE],
    suggestedShots: [SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.WIDE],
    emotionalTone: [EMOTIONAL_TONES.BITTERSWEET, 'tender', EMOTIONAL_TONES.SAD, EMOTIONAL_TONES.JOYFUL],
    keywords: ['emotional', 'feeling', 'heart', 'final moment']
  },
  cta: {
    id: 'cta',
    name: 'Call to Action',
    storyPurpose: STORY_PURPOSES.CTA,
    beats: ['result', 'offer', 'action', 'urgency'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, 'hero_shot'],
    emotionalTone: [EMOTIONAL_TONES.URGENT, 'confident', 'inspiring'],
    keywords: ['call to action', 'act now', 'buy', 'sign up', 'click']
  },
  end_card: {
    id: 'end_card',
    name: 'End Card',
    storyPurpose: STORY_PURPOSES.CTA,
    beats: ['hero_visual', 'logo', 'cta'],
    suggestedShots: [SHOT_TYPES.WIDE, CAMERA_MOVEMENTS.STATIC, 'logo_reveal'],
    emotionalTone: ['confident', 'premium', 'clear'],
    keywords: ['logo', 'brand', 'final', 'end screen']
  },
  open_ending: {
    id: 'open_ending',
    name: 'Open Ending',
    storyPurpose: STORY_PURPOSES.RESOLUTION,
    beats: ['event', 'character_reaction', 'cut_to_black'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE],
    emotionalTone: [EMOTIONAL_TONES.MYSTERIOUS, 'thoughtful', 'ambiguous'],
    keywords: ['ambiguous', 'open', 'question', 'black']
  },
  twist_ending: {
    id: 'twist_ending',
    name: 'Twist Ending',
    storyPurpose: STORY_PURPOSES.RESOLUTION,
    beats: ['resolution', 'new_information', 'reaction', 'cut'],
    suggestedShots: [SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.WIDE],
    emotionalTone: [EMOTIONAL_TONES.SHOCKING, 'surprising', EMOTIONAL_TONES.DRAMATIC],
    keywords: ['twist', 'surprise', 'reversal', 'shock']
  },
  circular_ending: {
    id: 'circular_ending',
    name: 'Circular Ending',
    storyPurpose: STORY_PURPOSES.RESOLUTION,
    beats: ['ending_scene', 'mirror_opening', 'final_wide'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE, CAMERA_MOVEMENTS.PULL_OUT],
    emotionalTone: [EMOTIONAL_TONES.SATISFYING, 'poignant', 'complete'],
    keywords: ['circle', 'mirror', 'return', 'full circle']
  },
  business_problem: {
    id: 'business_problem',
    name: 'Business Problem',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['business', 'problem', 'frustration', 'opportunity'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE],
    emotionalTone: ['frustrated', 'stressed', EMOTIONAL_TONES.DETERMINATION],
    keywords: ['problem', 'challenge', 'pain point', 'struggle']
  },
  customer_discovery: {
    id: 'customer_discovery',
    name: 'Customer Discovery',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['business', 'customer', 'problem', 'insight'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.OVER_SHOULDER, SHOT_TYPES.CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.CURIOUS, 'empathetic', 'insightful'],
    keywords: ['customer', 'discover', 'insight', 'need']
  },
  product_demo: {
    id: 'product_demo',
    name: 'Product Demo',
    storyPurpose: STORY_PURPOSES.CTA,
    beats: ['problem', 'product', 'demonstration', 'result'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.OVER_SHOULDER, SHOT_TYPES.WIDE],
    emotionalTone: ['informative', 'confident', 'satisfied'],
    keywords: ['demo', 'show', 'how to', 'feature', 'benefit']
  },
  before_after: {
    id: 'before_after',
    name: 'Before / After',
    storyPurpose: STORY_PURPOSES.TRANSFORMATION,
    beats: ['bad_state', 'transformation', 'improved_state'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, 'split_screen'],
    emotionalTone: [EMOTIONAL_TONES.DRAMATIC, EMOTIONAL_TONES.SATISFYING, 'inspiring'],
    keywords: ['before after', 'transformation', 'change', 'result']
  },
  founder_story: {
    id: 'founder_story',
    name: 'Founder Story',
    storyPurpose: STORY_PURPOSES.CLIMAX,
    beats: ['founder', 'struggle', 'breakthrough', 'business'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, SHOT_TYPES.LOW_ANGLE],
    emotionalTone: [EMOTIONAL_TONES.DETERMINATION, EMOTIONAL_TONES.INSPIRATIONAL, 'passionate'],
    keywords: ['founder', 'origin', 'struggle', 'breakthrough', 'startup']
  },
  team_growth: {
    id: 'team_growth',
    name: 'Team Growth',
    storyPurpose: STORY_PURPOSES.TRANSFORMATION,
    beats: ['solo', 'first_hire', 'team', 'company'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.TRACKING, 'montage'],
    emotionalTone: [EMOTIONAL_TONES.INSPIRATIONAL, 'collaborative', EMOTIONAL_TONES.ENERGETIC],
    keywords: ['team', 'growth', 'hiring', 'company', 'scale']
  },
  revenue_growth: {
    id: 'revenue_growth',
    name: 'Revenue Growth',
    storyPurpose: STORY_PURPOSES.TRANSFORMATION,
    beats: ['first_sale', 'customers', 'growth', 'scale'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, 'montage'],
    emotionalTone: ['excited', 'proud', EMOTIONAL_TONES.INSPIRATIONAL],
    keywords: ['revenue', 'sales', 'growth', 'money', 'scale']
  },
  pitch: {
    id: 'pitch',
    name: 'Pitch',
    storyPurpose: STORY_PURPOSES.CLIMAX,
    beats: ['problem', 'solution', 'product', 'market', 'vision'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, SHOT_TYPES.LOW_ANGLE],
    emotionalTone: ['confident', 'inspiring', 'bold'],
    keywords: ['pitch', 'present', 'vision', 'ask', 'opportunity']
  },
  hero_product_reveal: {
    id: 'hero_product_reveal',
    name: 'Hero Product Reveal',
    storyPurpose: STORY_PURPOSES.CTA,
    beats: ['environment', 'silhouette', 'reveal', 'hero_shot'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.LOW_ANGLE],
    emotionalTone: ['desirable', 'premium', 'exciting'],
    keywords: ['product reveal', 'hero shot', 'main product', 'star']
  },
  product_macro: {
    id: 'product_macro',
    name: 'Product Macro',
    storyPurpose: STORY_PURPOSES.CTA,
    beats: ['product', 'texture', 'detail', 'logo'],
    suggestedShots: [SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.MACRO],
    emotionalTone: ['premium', 'detailed', 'desirable'],
    keywords: [SHOT_TYPES.MACRO, 'texture', 'detail', 'close up', 'craftsmanship']
  },
  product_in_use: {
    id: 'product_in_use',
    name: 'Product In Use',
    storyPurpose: STORY_PURPOSES.CTA,
    beats: ['product', 'character', 'interaction', 'result'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.OVER_SHOULDER, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE],
    emotionalTone: ['satisfied', 'happy', 'convenient'],
    keywords: ['using', 'experience', 'lifestyle', 'in action']
  },
  product_transformation: {
    id: 'product_transformation',
    name: 'Product Transformation',
    storyPurpose: STORY_PURPOSES.TRANSFORMATION,
    beats: ['old_state', 'product', 'transformation', 'new_state'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, 'montage'],
    emotionalTone: [EMOTIONAL_TONES.DRAMATIC, EMOTIONAL_TONES.SATISFYING, 'amazing'],
    keywords: ['transform', 'change', 'before after', 'magic']
  },
  product_floating: {
    id: 'product_floating',
    name: 'Product Floating',
    storyPurpose: STORY_PURPOSES.CTA,
    beats: ['environment', 'product_enters', 'slow_motion', 'hero_shot'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.LOW_ANGLE, CAMERA_MOVEMENTS.CRANE_UP],
    emotionalTone: ['magical', 'premium', 'dreamy'],
    keywords: ['floating', 'slow motion', 'dreamy', 'hero']
  },
  product_explosion: {
    id: 'product_explosion',
    name: 'Product Explosion',
    storyPurpose: STORY_PURPOSES.CTA,
    beats: ['object', 'energy', 'transformation', 'product'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.WIDE],
    emotionalTone: [EMOTIONAL_TONES.ENERGETIC, 'exciting', EMOTIONAL_TONES.DRAMATIC],
    keywords: ['explosion', 'energy', 'dynamic', 'impact']
  },
  product_assembly: {
    id: 'product_assembly',
    name: 'Product Assembly',
    storyPurpose: STORY_PURPOSES.TRANSFORMATION,
    beats: ['parts', 'assembly', 'finished_product'],
    suggestedShots: [SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.MEDIUM, 'montage'],
    emotionalTone: [EMOTIONAL_TONES.SATISFYING, 'precise', 'craftsmanship'],
    keywords: ['assembly', 'build', 'parts', 'construction', 'craft']
  },
  product_lifestyle: {
    id: 'product_lifestyle',
    name: 'Product Lifestyle',
    storyPurpose: STORY_PURPOSES.CTA,
    beats: ['environment', 'person', 'product', 'emotional_outcome'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.TRACKING],
    emotionalTone: ['aspirational', 'happy', 'lifestyle'],
    keywords: ['lifestyle', 'living', 'experience', 'emotion']
  },
  finding_object: {
    id: 'finding_object',
    name: 'Finding Object',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['search', 'detail', 'discovery', 'reaction'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.CURIOUS, EMOTIONAL_TONES.SURPRISE, 'satisfied'],
    keywords: ['find', 'discover', 'object', 'search']
  },
  finding_person: {
    id: 'finding_person',
    name: 'Finding Person',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['environment', 'character', 'reveal', 'reaction'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.SURPRISE, 'emotional', 'relieved'],
    keywords: ['find', 'meet', 'reunite', 'discover']
  },
  finding_location: {
    id: 'finding_location',
    name: 'Finding Location',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['travel', 'landscape', 'location_reveal'],
    suggestedShots: [SHOT_TYPES.WIDE, CAMERA_MOVEMENTS.CRANE_UP, SHOT_TYPES.TRACKING],
    emotionalTone: [EMOTIONAL_TONES.AWE, EMOTIONAL_TONES.ANTICIPATORY, EMOTIONAL_TONES.AMAZED],
    keywords: ['find', 'arrive', 'discover', 'location']
  },
  finding_evidence: {
    id: 'finding_evidence',
    name: 'Finding Evidence',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['search', 'clue', SHOT_TYPES.CLOSE_UP, 'realization'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.OVER_SHOULDER],
    emotionalTone: [EMOTIONAL_TONES.CURIOUS, 'realizing', EMOTIONAL_TONES.TENSE],
    keywords: ['clue', 'evidence', 'proof', 'discovery']
  },
  finding_secret_room: {
    id: 'finding_secret_room',
    name: 'Finding Secret Room',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['normal_environment', 'hidden_door', 'entry', 'reveal'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE, SHOT_TYPES.CLOSE_UP, CAMERA_MOVEMENTS.PUSH_IN],
    emotionalTone: [EMOTIONAL_TONES.MYSTERIOUS, EMOTIONAL_TONES.CURIOUS, EMOTIONAL_TONES.AWE],
    keywords: ['secret', 'hidden', 'room', 'discover']
  },
  finding_message: {
    id: 'finding_message',
    name: 'Finding Message',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['object', 'text', 'character_reaction'],
    suggestedShots: [SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.OVER_SHOULDER],
    emotionalTone: [EMOTIONAL_TONES.SURPRISE, EMOTIONAL_TONES.CURIOUS, 'emotional'],
    keywords: ['message', 'text', 'letter', 'note']
  },
  slow_reveal: {
    id: 'slow_reveal',
    name: 'Slow Reveal',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['detail', SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE],
    suggestedShots: [SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE],
    emotionalTone: [EMOTIONAL_TONES.CURIOUS, EMOTIONAL_TONES.DRAMATIC, EMOTIONAL_TONES.SATISFYING],
    keywords: ['reveal', 'slow', 'progressive', 'build']
  },
  reverse_reveal: {
    id: 'reverse_reveal',
    name: 'Reverse Reveal',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: [SHOT_TYPES.WIDE, 'character', 'detail'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, CAMERA_MOVEMENTS.PULL_OUT],
    emotionalTone: ['surprising', 'revealing', EMOTIONAL_TONES.DRAMATIC],
    keywords: ['reveal', 'reverse', 'pull back', 'unveil']
  },
  environment_reveal: {
    id: 'environment_reveal',
    name: 'Environment Reveal',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['character', 'camera_pullback', 'massive_environment'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE, CAMERA_MOVEMENTS.CRANE_UP, CAMERA_MOVEMENTS.PULL_OUT],
    emotionalTone: [EMOTIONAL_TONES.AWE, EMOTIONAL_TONES.SURPRISE, EMOTIONAL_TONES.INSPIRATIONAL],
    keywords: ['reveal', 'environment', 'massive', 'scale']
  },
  threat_reveal: {
    id: 'threat_reveal',
    name: 'Threat Reveal',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['character', SHOT_TYPES.POV, 'threat'],
    suggestedShots: [SHOT_TYPES.CLOSE_UP, SHOT_TYPES.OVER_SHOULDER, SHOT_TYPES.WIDE, SHOT_TYPES.DUTCH_ANGLE],
    emotionalTone: [EMOTIONAL_TONES.FEAR, EMOTIONAL_TONES.TENSE, 'shocked'],
    keywords: ['threat', 'danger', 'reveal', 'menace']
  },
  identity_reveal: {
    id: 'identity_reveal',
    name: 'Identity Reveal',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['anonymous', 'clues', 'face'],
    suggestedShots: ['silhouette', SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP],
    emotionalTone: ['surprising', EMOTIONAL_TONES.DRAMATIC, 'revealing'],
    keywords: ['identity', 'who', 'reveal', 'face']
  },
  truth_reveal: {
    id: 'truth_reveal',
    name: 'Truth Reveal',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['evidence', 'character', 'flashback', 'truth'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.OVER_SHOULDER],
    emotionalTone: [EMOTIONAL_TONES.SHOCKING, 'realizing', EMOTIONAL_TONES.DRAMATIC],
    keywords: ['truth', 'reveal', 'secret', 'realize']
  },
  chase_scene: {
    id: 'chase_scene',
    name: 'Chase Scene',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['threat', 'running', 'pursuer', 'obstacle', 'escape'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.TRACKING, SHOT_TYPES.LOW_ANGLE, SHOT_TYPES.HANDHELD],
    emotionalTone: [EMOTIONAL_TONES.URGENT, EMOTIONAL_TONES.FEAR, EMOTIONAL_TONES.TENSE, 'excited'],
    keywords: ['chase', 'run', 'pursue', 'escape', 'action']
  },
  fight: {
    id: 'fight',
    name: 'Fight',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['confrontation', 'first_strike', 'exchange', 'turning_point', 'winner'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, SHOT_TYPES.LOW_ANGLE],
    emotionalTone: [EMOTIONAL_TONES.TENSE, 'violent', EMOTIONAL_TONES.DETERMINATION, EMOTIONAL_TONES.URGENT],
    keywords: ['fight', 'combat', 'battle', 'strike']
  },
  ambush: {
    id: 'ambush',
    name: 'Ambush',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['normal', 'threat', 'attack', 'reaction', 'counterattack'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.HANDHELD],
    emotionalTone: [EMOTIONAL_TONES.SURPRISE, EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.URGENT],
    keywords: ['ambush', 'surprise', 'attack', 'trap']
  },
  rescue_scene: {
    id: 'rescue_scene',
    name: 'Rescue',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['danger', 'arrival', 'intervention', 'escape'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.LOW_ANGLE],
    emotionalTone: [EMOTIONAL_TONES.URGENT, EMOTIONAL_TONES.HOPEFUL, 'heroic'],
    keywords: ['rescue', 'save', 'help', 'intervene']
  },
  escape_scene: {
    id: 'escape_scene',
    name: 'Escape',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['threat', 'movement', 'obstacles', 'exit'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE, SHOT_TYPES.TRACKING, SHOT_TYPES.HANDHELD],
    emotionalTone: [EMOTIONAL_TONES.URGENT, EMOTIONAL_TONES.FEAR, EMOTIONAL_TONES.DETERMINATION],
    keywords: ['escape', 'flee', 'exit', 'breakout']
  },
  countdown: {
    id: 'countdown',
    name: 'Countdown',
    storyPurpose: STORY_PURPOSES.SUSPENSE,
    beats: ['clock', 'character', 'problem', 'time_running_out'],
    suggestedShots: [SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE],
    emotionalTone: [EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.URGENT, 'desperate'],
    keywords: ['countdown', 'clock', 'time', 'deadline']
  },
  locked_room: {
    id: 'locked_room',
    name: 'Locked Room',
    storyPurpose: STORY_PURPOSES.SUSPENSE,
    beats: ['character', 'door', 'problem', 'escape_attempt'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE],
    emotionalTone: ['trapped', EMOTIONAL_TONES.TENSE, 'desperate'],
    keywords: ['trapped', 'locked', 'escape', 'no exit']
  },
  surveillance: {
    id: 'surveillance',
    name: 'Surveillance',
    storyPurpose: STORY_PURPOSES.SUSPENSE,
    beats: ['camera', 'subject', 'observer', 'discovery'],
    suggestedShots: [SHOT_TYPES.POV, SHOT_TYPES.OVER_SHOULDER, SHOT_TYPES.WIDE, SHOT_TYPES.CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.TENSE, 'paranoid', 'observational'],
    keywords: ['watch', 'observe', 'spy', 'surveillance']
  },
  almost_caught: {
    id: 'almost_caught',
    name: 'Almost Caught',
    storyPurpose: STORY_PURPOSES.SUSPENSE,
    beats: ['action', 'threat_appears', 'hide', 'close_call', 'escape'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.HANDHELD],
    emotionalTone: [EMOTIONAL_TONES.TENSE, 'relieved', EMOTIONAL_TONES.URGENT],
    keywords: ['almost', 'close call', 'narrow escape', 'hide']
  },
  news_breaking: {
    id: 'news_breaking',
    name: 'News Breaking',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['location', 'event', 'people', 'evidence'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.POV],
    emotionalTone: [EMOTIONAL_TONES.URGENT, 'informative', EMOTIONAL_TONES.DRAMATIC],
    keywords: ['news', 'breaking', 'report', 'event']
  },
  sports_pre_game: {
    id: 'sports_pre_game',
    name: 'Sports Pre-Game',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['stadium', 'athlete', 'preparation', 'crowd'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.LOW_ANGLE],
    emotionalTone: [EMOTIONAL_TONES.ANTICIPATORY, EMOTIONAL_TONES.ENERGETIC, 'focused'],
    keywords: ['sports', 'preparation', 'game', 'athlete']
  },
  sports_competition: {
    id: 'sports_competition',
    name: 'Sports Competition',
    storyPurpose: STORY_PURPOSES.CONFLICT,
    beats: ['start', 'action', 'setback', 'comeback', 'finish'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, 'slow_motion'],
    emotionalTone: ['intense', 'exciting', EMOTIONAL_TONES.DETERMINATION],
    keywords: ['competition', 'game', 'match', 'sport']
  },
  food_hero: {
    id: 'food_hero',
    name: 'Food Hero',
    storyPurpose: STORY_PURPOSES.CTA,
    beats: ['ingredient', 'preparation', 'cooking', 'final_dish'],
    suggestedShots: [SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.MEDIUM, 'overhead'],
    emotionalTone: ['appetizing', EMOTIONAL_TONES.WARM, EMOTIONAL_TONES.SATISFYING],
    keywords: ['food', 'cooking', 'dish', 'ingredient']
  },
  fashion: {
    id: 'fashion',
    name: 'Fashion',
    storyPurpose: STORY_PURPOSES.CTA,
    beats: ['environment', 'model', 'clothing_detail', 'movement', 'hero_shot'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, SHOT_TYPES.LOW_ANGLE],
    emotionalTone: ['stylish', 'confident', 'aspirational'],
    keywords: ['fashion', 'model', 'clothing', 'style', 'runway']
  },
  music_performance: {
    id: 'music_performance',
    name: 'Music Performance',
    storyPurpose: STORY_PURPOSES.ESCALATION,
    beats: ['artist', 'performance', SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, SHOT_TYPES.LOW_ANGLE],
    emotionalTone: [EMOTIONAL_TONES.ENERGETIC, 'passionate', EMOTIONAL_TONES.INSPIRATIONAL],
    keywords: ['music', 'performance', 'concert', 'artist']
  },
  title_reveal: {
    id: 'title_reveal',
    name: 'Title Reveal',
    storyPurpose: STORY_PURPOSES.HOOK,
    beats: ['visual', 'title', 'transition'],
    suggestedShots: [SHOT_TYPES.WIDE, CAMERA_MOVEMENTS.STATIC, CAMERA_MOVEMENTS.PUSH_IN],
    emotionalTone: [EMOTIONAL_TONES.DRAMATIC, EMOTIONAL_TONES.EPIC, EMOTIONAL_TONES.MYSTERIOUS],
    keywords: ['title', 'text', 'reveal', 'opening']
  },
  chapter_card: {
    id: 'chapter_card',
    name: 'Chapter Card',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['scene', 'chapter_title', 'new_scene'],
    suggestedShots: [CAMERA_MOVEMENTS.STATIC, SHOT_TYPES.WIDE],
    emotionalTone: ['informative', 'structured'],
    keywords: ['chapter', 'section', 'part', 'division']
  },
  logo_reveal: {
    id: 'logo_reveal',
    name: 'Logo Reveal',
    storyPurpose: STORY_PURPOSES.CTA,
    beats: ['particles', 'formation', 'logo'],
    suggestedShots: [SHOT_TYPES.WIDE, CAMERA_MOVEMENTS.STATIC, CAMERA_MOVEMENTS.PUSH_IN],
    emotionalTone: ['premium', 'confident', 'branded'],
    keywords: ['logo', 'brand', 'reveal', 'identity']
  },
  text_over_video: {
    id: 'text_over_video',
    name: 'Text Over Video',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['b_roll', 'text', 'transition'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP],
    emotionalTone: ['informative', 'stylish', 'clear'],
    keywords: ['text', 'overlay', 'caption', 'message']
  },
  narrator_b_roll: {
    id: 'narrator_b_roll',
    name: 'Narrator + B-Roll',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['voiceover', 'visual_supporting_story'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, 'montage'],
    emotionalTone: ['informative', EMOTIONAL_TONES.IMMERSIVE, 'narrative'],
    keywords: ['voiceover', 'narration', 'b-roll', 'story']
  },
  narrator_character: {
    id: 'narrator_character',
    name: 'Narrator + Character',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['voiceover', 'character_actions'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE],
    emotionalTone: ['narrative', EMOTIONAL_TONES.REFLECTIVE, 'informative'],
    keywords: ['voiceover', 'character', 'narration']
  },
  narrator_environment: {
    id: 'narrator_environment',
    name: 'Narrator + Environment',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['voiceover', 'cinematic_environment'],
    suggestedShots: [SHOT_TYPES.WIDE, CAMERA_MOVEMENTS.CRANE_UP, SHOT_TYPES.TRACKING, 'time_lapse'],
    emotionalTone: [EMOTIONAL_TONES.IMMERSIVE, EMOTIONAL_TONES.EPIC, 'atmospheric'],
    keywords: ['voiceover', 'environment', 'landscape', 'atmosphere']
  },
  narrator_visualization: {
    id: 'narrator_visualization',
    name: 'Narrator + Visualization',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['voiceover', 'abstract_concept', 'visual'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.CLOSE_UP, 'animation', 'diagram'],
    emotionalTone: ['informative', 'abstract', 'conceptual'],
    keywords: ['voiceover', 'visualization', 'abstract', 'concept']
  },
  interview_scene: {
    id: 'interview_scene',
    name: 'Interview Scene',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['environment', 'person', 'question', 'answer', 'reaction'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.OVER_SHOULDER],
    emotionalTone: ['authentic', 'thoughtful', EMOTIONAL_TONES.REFLECTIVE],
    keywords: ['interview', 'q&a', 'speak', 'talk']
  },
  observational: {
    id: 'observational',
    name: 'Observational',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['environment', 'real_activity', 'detail'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.TRACKING],
    emotionalTone: ['authentic', 'quiet', 'observational'],
    keywords: ['observe', 'watch', 'real', 'natural']
  },
  historical: {
    id: 'historical',
    name: 'Historical',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['archive', 'narration', 'reenactment', 'present'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, ' archival'],
    emotionalTone: [EMOTIONAL_TONES.NOSTALGIC, 'informative', EMOTIONAL_TONES.REFLECTIVE],
    keywords: ['history', 'archive', 'past', 'period']
  },
  investigative: {
    id: 'investigative',
    name: 'Investigative',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['question', 'evidence', 'interview', 'discovery'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.OVER_SHOULDER, SHOT_TYPES.WIDE],
    emotionalTone: [EMOTIONAL_TONES.CURIOUS, EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.ANALYTICAL],
    keywords: ['investigate', 'question', 'evidence', 'truth']
  },
  human_story: {
    id: 'human_story',
    name: 'Human Story',
    storyPurpose: STORY_PURPOSES.RESOLUTION,
    beats: ['person', 'environment', 'struggle', 'transformation'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE],
    emotionalTone: ['authentic', 'inspiring', 'emotional'],
    keywords: ['person', 'story', 'struggle', 'transformation']
  },
  goodbye: {
    id: 'goodbye',
    name: 'Goodbye',
    storyPurpose: STORY_PURPOSES.RESOLUTION,
    beats: ['conversation', 'silence', 'departure', 'reaction'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE],
    emotionalTone: [EMOTIONAL_TONES.SAD, EMOTIONAL_TONES.BITTERSWEET, 'tender'],
    keywords: ['goodbye', 'farewell', 'leave', 'depart']
  },
  reunion: {
    id: 'reunion',
    name: 'Reunion',
    storyPurpose: STORY_PURPOSES.RESOLUTION,
    beats: ['recognition', 'approach', 'emotion', 'embrace'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE],
    emotionalTone: [EMOTIONAL_TONES.JOYFUL, 'emotional', EMOTIONAL_TONES.WARM],
    keywords: ['reunion', 'meet again', 'embrace', 'together']
  },
  loss: {
    id: 'loss',
    name: 'Loss',
    storyPurpose: STORY_PURPOSES.RESOLUTION,
    beats: ['event', 'silence', 'reaction', 'memory'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.WIDE],
    emotionalTone: [EMOTIONAL_TONES.SAD, 'grieving', EMOTIONAL_TONES.REFLECTIVE],
    keywords: ['loss', 'grief', 'death', 'sadness']
  },
  sacrifice: {
    id: 'sacrifice',
    name: 'Sacrifice',
    storyPurpose: STORY_PURPOSES.CLIMAX,
    beats: ['problem', 'choice', 'sacrifice', 'consequence'],
    suggestedShots: [SHOT_TYPES.CLOSE_UP, SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE],
    emotionalTone: ['tragic', 'noble', 'emotional'],
    keywords: ['sacrifice', 'give up', 'choice', 'cost']
  },
  forgiveness: {
    id: 'forgiveness',
    name: 'Forgiveness',
    storyPurpose: STORY_PURPOSES.RESOLUTION,
    beats: ['conflict', 'conversation', 'emotion', 'resolution'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.OVER_SHOULDER],
    emotionalTone: ['emotional', 'healing', 'tender'],
    keywords: ['forgive', 'forgiveness', 'reconcile', 'heal']
  },
  victory: {
    id: 'victory',
    name: 'Victory',
    storyPurpose: STORY_PURPOSES.CLIMAX,
    beats: ['challenge', 'success', 'reaction', 'celebration'],
    suggestedShots: [SHOT_TYPES.LOW_ANGLE, SHOT_TYPES.WIDE, SHOT_TYPES.CLOSE_UP, CAMERA_MOVEMENTS.CRANE_UP],
    emotionalTone: [EMOTIONAL_TONES.TRIUMPHANT, EMOTIONAL_TONES.JOYFUL, EMOTIONAL_TONES.ENERGETIC],
    keywords: ['win', 'victory', 'success', 'triumph']
  },
  defeat: {
    id: 'defeat',
    name: 'Defeat',
    storyPurpose: STORY_PURPOSES.RESOLUTION,
    beats: ['attempt', 'failure', 'silence', 'character'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE],
    emotionalTone: [EMOTIONAL_TONES.SAD, EMOTIONAL_TONES.REFLECTIVE, EMOTIONAL_TONES.DETERMINATION],
    keywords: ['lose', 'defeat', 'failure', 'loss']
  },
  training_scene: {
    id: 'training_scene',
    name: 'Training Scene',
    storyPurpose: STORY_PURPOSES.TRANSFORMATION,
    beats: ['failure', 'practice', 'progress', 'mastery'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, 'montage'],
    emotionalTone: [EMOTIONAL_TONES.DETERMINATION, EMOTIONAL_TONES.HOPEFUL, EMOTIONAL_TONES.INSPIRATIONAL],
    keywords: ['train', 'practice', 'learn', 'improve']
  },
  investigation_detective: {
    id: 'investigation_detective',
    name: 'Detective Investigation',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['location', 'evidence', 'character', 'clue'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.CURIOUS, EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.ANALYTICAL],
    keywords: ['detective', 'investigation', 'clue', 'mystery']
  },
  investigation_digital: {
    id: 'investigation_digital',
    name: 'Digital Investigation',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['computer', 'data', 'screens', 'character'],
    suggestedShots: [SHOT_TYPES.OVER_SHOULDER, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.POV],
    emotionalTone: [EMOTIONAL_TONES.ANALYTICAL, 'focused', 'discovering'],
    keywords: ['digital', 'computer', 'data', 'screen']
  },
  investigation_physical: {
    id: 'investigation_physical',
    name: 'Physical Investigation',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['room', 'objects', 'hands', 'discovery'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.EXTREME_CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.CURIOUS, 'methodical', 'discovering'],
    keywords: ['physical', 'search', 'examine', 'hands']
  },
  research_montage: {
    id: 'research_montage',
    name: 'Research Montage',
    storyPurpose: STORY_PURPOSES.TRANSFORMATION,
    beats: ['books', 'screens', 'notes', 'timeline', 'character'],
    suggestedShots: [SHOT_TYPES.CLOSE_UP, SHOT_TYPES.MEDIUM, 'montage'],
    emotionalTone: [EMOTIONAL_TONES.ANALYTICAL, 'focused', EMOTIONAL_TONES.DETERMINATION],
    keywords: ['research', 'study', 'learn', 'investigate']
  },
  connecting_clues: {
    id: 'connecting_clues',
    name: 'Connecting Clues',
    storyPurpose: STORY_PURPOSES.DISCOVERY,
    beats: ['clue_1', 'clue_2', 'clue_3', 'connection'],
    suggestedShots: [SHOT_TYPES.CLOSE_UP, SHOT_TYPES.OVER_SHOULDER, SHOT_TYPES.WIDE],
    emotionalTone: ['realizing', EMOTIONAL_TONES.CURIOUS, 'satisfied'],
    keywords: ['connect', 'clue', 'pattern', 'realize']
  },
  travel_road: {
    id: 'travel_road',
    name: 'Road Journey',
    storyPurpose: STORY_PURPOSES.ESCALATION,
    beats: ['vehicle', 'road', 'landscape', 'character'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.TRACKING, SHOT_TYPES.MEDIUM],
    emotionalTone: [EMOTIONAL_TONES.ADVENTUROUS, EMOTIONAL_TONES.REFLECTIVE, EMOTIONAL_TONES.HOPEFUL],
    keywords: ['road', 'drive', 'travel', 'journey']
  },
  travel_air: {
    id: 'travel_air',
    name: 'Air Travel',
    storyPurpose: STORY_PURPOSES.ESCALATION,
    beats: ['airport', 'plane', 'sky', 'destination'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.POV],
    emotionalTone: [EMOTIONAL_TONES.ANTICIPATORY, 'calm', EMOTIONAL_TONES.ADVENTUROUS],
    keywords: ['fly', 'airport', 'plane', 'travel']
  },
  travel_train: {
    id: 'travel_train',
    name: 'Train Journey',
    storyPurpose: STORY_PURPOSES.ESCALATION,
    beats: ['station', 'train', 'window', 'landscape'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.WIDE, SHOT_TYPES.CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.REFLECTIVE, EMOTIONAL_TONES.NOSTALGIC, EMOTIONAL_TONES.ANTICIPATORY],
    keywords: ['train', 'rail', 'travel', 'journey']
  },
  travel_walking: {
    id: 'travel_walking',
    name: 'Walking Journey',
    storyPurpose: STORY_PURPOSES.ESCALATION,
    beats: ['character', 'environment', 'obstacles', 'destination'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.TRACKING, SHOT_TYPES.MEDIUM, SHOT_TYPES.LOW_ANGLE],
    emotionalTone: [EMOTIONAL_TONES.DETERMINATION, EMOTIONAL_TONES.REFLECTIVE, 'tired'],
    keywords: ['walk', 'hike', 'travel', 'journey']
  },
  expedition: {
    id: 'expedition',
    name: 'Expedition',
    storyPurpose: STORY_PURPOSES.ESCALATION,
    beats: ['preparation', 'departure', 'travel', 'arrival'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, CAMERA_MOVEMENTS.CRANE_UP, SHOT_TYPES.TRACKING],
    emotionalTone: [EMOTIONAL_TONES.DETERMINATION, EMOTIONAL_TONES.ADVENTUROUS, EMOTIONAL_TONES.ANTICIPATORY],
    keywords: ['expedition', 'adventure', 'quest', 'journey']
  },
  social_hook: {
    id: 'social_hook',
    name: 'Social Hook',
    storyPurpose: STORY_PURPOSES.HOOK,
    beats: ['unexpected_visual', 'statement'],
    suggestedShots: [SHOT_TYPES.EXTREME_CLOSE_UP, SHOT_TYPES.WIDE, CAMERA_MOVEMENTS.PUSH_IN],
    emotionalTone: [EMOTIONAL_TONES.URGENT, EMOTIONAL_TONES.CURIOUS, 'surprising'],
    keywords: ['social', 'hook', 'scroll stop', 'pattern interrupt']
  },
  social_talking_head: {
    id: 'social_talking_head',
    name: 'Social Talking Head',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['speaker', 'statement', 'b_roll'],
    suggestedShots: [SHOT_TYPES.CLOSE_UP, SHOT_TYPES.MEDIUM],
    emotionalTone: ['authentic', 'confident', 'conversational'],
    keywords: ['talking head', 'speak', 'direct', 'social']
  },
  social_b_roll: {
    id: 'social_b_roll',
    name: 'Social B-Roll',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['narration', 'supporting_visuals'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, 'montage'],
    emotionalTone: [EMOTIONAL_TONES.IMMERSIVE, 'supportive', 'visual'],
    keywords: ['b-roll', 'supporting', 'visual', 'footage']
  },
  social_proof: {
    id: 'social_proof',
    name: 'Social Proof',
    storyPurpose: STORY_PURPOSES.RESOLUTION,
    beats: ['claim', 'evidence', 'result'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE],
    emotionalTone: ['trustworthy', 'satisfied', 'proven'],
    keywords: ['proof', 'evidence', 'result', 'testimonial']
  },
  social_transformation: {
    id: 'social_transformation',
    name: 'Social Transformation',
    storyPurpose: STORY_PURPOSES.TRANSFORMATION,
    beats: ['before', 'process', 'after'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE, 'montage'],
    emotionalTone: ['inspiring', EMOTIONAL_TONES.SATISFYING, 'amazing'],
    keywords: ['transformation', 'before after', 'change', 'social']
  },
  social_tutorial: {
    id: 'social_tutorial',
    name: 'Social Tutorial',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['problem', 'step_1', 'step_2', 'step_3', 'result'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, 'overhead'],
    emotionalTone: ['helpful', 'clear', 'instructive'],
    keywords: ['tutorial', 'how to', 'steps', 'learn']
  },
  case_study_scene: {
    id: 'case_study_scene',
    name: 'Case Study',
    storyPurpose: STORY_PURPOSES.RESOLUTION,
    beats: ['customer', 'problem', 'solution', 'result'],
    suggestedShots: [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.OVER_SHOULDER],
    emotionalTone: ['informative', 'professional', 'satisfied'],
    keywords: ['case study', 'customer', 'result', 'proof']
  },
  environmental: {
    id: 'environmental',
    name: 'Environmental',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['nature_or_setting', 'movement', 'atmosphere'],
    suggestedShots: [SHOT_TYPES.WIDE, CAMERA_MOVEMENTS.CRANE_UP, 'time_lapse'],
    emotionalTone: [EMOTIONAL_TONES.PEACEFUL, EMOTIONAL_TONES.AWE, 'atmospheric'],
    keywords: ['nature', 'environment', 'landscape', 'atmosphere']
  },
  nature_mountain: {
    id: 'nature_mountain',
    name: 'Mountain',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['landscape', 'mountain', 'character'],
    suggestedShots: [SHOT_TYPES.WIDE, CAMERA_MOVEMENTS.CRANE_UP, SHOT_TYPES.LOW_ANGLE],
    emotionalTone: [EMOTIONAL_TONES.AWE, EMOTIONAL_TONES.PEACEFUL, 'majestic'],
    keywords: ['mountain', 'landscape', 'nature', EMOTIONAL_TONES.EPIC]
  },
  nature_ocean: {
    id: 'nature_ocean',
    name: 'Ocean',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['ocean', 'waves', 'character'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.PEACEFUL, 'powerful', 'serene'],
    keywords: ['ocean', 'sea', 'waves', 'beach']
  },
  nature_forest: {
    id: 'nature_forest',
    name: 'Forest',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['forest', 'light', 'character'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.MYSTERIOUS, EMOTIONAL_TONES.PEACEFUL, 'magical'],
    keywords: ['forest', 'trees', 'woods', 'nature']
  },
  weather_rain: {
    id: 'weather_rain',
    name: 'Rain',
    storyPurpose: STORY_PURPOSES.ATMOSPHERE,
    beats: ['rain', 'environment', 'character'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP],
    emotionalTone: ['melancholic', 'atmospheric', 'moody'],
    keywords: ['rain', 'wet', 'weather', 'atmosphere']
  },
  weather_storm: {
    id: 'weather_storm',
    name: 'Storm',
    storyPurpose: STORY_PURPOSES.ATMOSPHERE,
    beats: ['storm', 'environment', 'character'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.LOW_ANGLE, SHOT_TYPES.CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.DRAMATIC, 'powerful'],
    keywords: ['storm', 'lightning', 'thunder', 'weather']
  },
  weather_snow: {
    id: 'weather_snow',
    name: 'Snow',
    storyPurpose: STORY_PURPOSES.ATMOSPHERE,
    beats: ['snow', 'environment', 'character'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP],
    emotionalTone: [EMOTIONAL_TONES.PEACEFUL, 'cold', 'magical'],
    keywords: ['snow', 'winter', 'cold', 'weather']
  },
  atmospheric_smoke: {
    id: 'atmospheric_smoke',
    name: 'Smoke / Atmosphere',
    storyPurpose: STORY_PURPOSES.ATMOSPHERE,
    beats: ['smoke', 'light', 'movement'],
    suggestedShots: [SHOT_TYPES.WIDE, SHOT_TYPES.CLOSE_UP, 'backlight'],
    emotionalTone: [EMOTIONAL_TONES.MYSTERIOUS, 'atmospheric', 'moody'],
    keywords: ['smoke', 'fog', 'mist', 'atmosphere']
  },
  title_card: {
    id: 'title_card',
    name: 'Title / Chapter Card',
    storyPurpose: STORY_PURPOSES.EXPOSITION,
    beats: ['scene', 'title', 'new_scene'],
    suggestedShots: [CAMERA_MOVEMENTS.STATIC, SHOT_TYPES.WIDE],
    emotionalTone: ['informative', 'structured', EMOTIONAL_TONES.DRAMATIC],
    keywords: ['title', 'chapter', 'section', 'text']
  },
  end_card_scene: {
    id: 'end_card_scene',
    name: 'End Card',
    storyPurpose: STORY_PURPOSES.CTA,
    beats: ['hero_visual', 'logo', 'cta'],
    suggestedShots: [CAMERA_MOVEMENTS.STATIC, SHOT_TYPES.WIDE],
    emotionalTone: ['confident', 'premium', 'clear'],
    keywords: ['end', 'logo', 'brand', 'final']
  }
};

// Convenience: flat list of IDs
export const SCENE_IDS = Object.keys(SCENE_CLASSES);

// Convenience: lookup by ID
export function getSceneClass(id) {
  return SCENE_CLASSES[id] || null;
}

// Convenience: filter by story purpose
export function getScenesByPurpose(purpose) {
  return Object.values(SCENE_CLASSES).filter(s => s.storyPurpose === purpose);
}
