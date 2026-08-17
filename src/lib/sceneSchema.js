/**
 * CINEMATIC SCENE SCHEMAS
 *
 * Formal data structures for the AI Director pipeline:
 * Scene → Shot → Character → Environment → Generation
 */

// ============================================
// MASTER SCENE TYPES
// ============================================

export const SCENE_TYPES = {
  COLD_OPEN: 'cold_open',
  HOOK: 'hook',
  ESTABLISHING: 'establishing',
  CHARACTER_INTRODUCTION: 'character_introduction',
  ENVIRONMENT_INTRODUCTION: 'environment_introduction',
  NORMAL_WORLD: 'normal_world',
  INCITING_EVENT: 'inciting_event',
  CHARACTER_REACTION: 'character_reaction',
  DIALOGUE: 'dialogue',
  CONVERSATION: 'conversation',
  MONOLOGUE: 'monologue',
  POV: 'pov',
  ACTION: 'action',
  DISCOVERY: 'discovery',
  INVESTIGATION: 'investigation',
  REVEAL: 'reveal',
  TRANSFORMATION: 'transformation',
  JOURNEY: 'journey',
  ARRIVAL: 'arrival',
  DEPARTURE: 'departure',
  MONTAGE: 'montage',
  TRAINING: 'training',
  ROMANCE: 'romance',
  CONFLICT: 'conflict',
  CONFRONTATION: 'confrontation',
  CHASE: 'chase',
  ESCAPE: 'escape',
  RESCUE: 'rescue',
  SUSPENSE: 'suspense',
  HORROR: 'horror',
  COMEDY: 'comedy',
  EMOTIONAL: 'emotional',
  FLASHBACK: 'flashback',
  DREAM: 'dream',
  SURREAL: 'surreal',
  TECHNOLOGY: 'technology',
  PRODUCT: 'product',
  DEMONSTRATION: 'demonstration',
  TESTIMONIAL: 'testimonial',
  DOCUMENTARY: 'documentary',
  INTERVIEW: 'interview',
  EXPLAINER: 'explainer',
  VISUALIZATION: 'visualization',
  TIME_PASSAGE: 'time_passage',
  SCALE_REVEAL: 'scale_reveal',
  CLIMAX: 'climax',
  RESOLUTION: 'resolution',
  EMOTIONAL_ENDING: 'emotional_ending',
  CTA: 'cta',
  END_CARD: 'end_card'
};

// ============================================
// SHOT TYPES
// ============================================

export const SHOT_TYPES = {
  EXTREME_WIDE: 'extreme_wide',
  WIDE: 'wide',
  MEDIUM_WIDE: 'medium_wide',
  MEDIUM: 'medium',
  MEDIUM_CLOSE_UP: 'medium_close_up',
  CLOSE_UP: 'close_up',
  EXTREME_CLOSE_UP: 'extreme_close_up',
  INSERT: 'insert',
  CUT_IN: 'cut_in',
  TWO_SHOT: 'two_shot',
  OVER_SHOULDER: 'over_shoulder',
  PROFILE: 'profile',
  POV: 'pov',
  BIRDSEYE: 'birdseye',
  LOW_ANGLE: 'low_angle',
  HIGH_ANGLE: 'high_angle',
  DUTCH_ANGLE: 'dutch_angle',
  TRACKING: 'tracking',
  DOLLY: 'dolly',
  CRANE: 'crane',
  STEADICAM: 'steadicam',
  HANDHELD: 'handheld',
  AERIAL: 'aerial',
  MACRO: 'macro'
};

// ============================================
// CAMERA MOVEMENTS
// ============================================

export const CAMERA_MOVEMENTS = {
  STATIC: 'static',
  PUSH_IN: 'push_in',
  PULL_OUT: 'pull_out',
  PAN_LEFT: 'pan_left',
  PAN_RIGHT: 'pan_right',
  TILT_UP: 'tilt_up',
  TILT_DOWN: 'tilt_down',
  DOLLY_FORWARD: 'dolly_forward',
  DOLLY_BACK: 'dolly_back',
  TRACKING_LEFT: 'tracking_left',
  TRACKING_RIGHT: 'tracking_right',
  ORBIT: 'orbit',
  CRANE_UP: 'crane_up',
  CRANE_DOWN: 'crane_down',
  ZOOM_IN: 'zoom_in',
  ZOOM_OUT: 'zoom_out',
  WHIP_PAN: 'whip_pan',
  HANDHELD: 'handheld',
  FLOATING: 'floating'
};

// ============================================
// LIGHTING STYLES
// ============================================

export const LIGHTING_STYLES = {
  NATURAL: 'natural',
  GOLDEN_HOUR: 'golden_hour',
  BLUE_HOUR: 'blue_hour',
  MOONLIGHT: 'moonlight',
  NEON: 'neon',
  CANDLELIGHT: 'candlelight',
  FIRELIGHT: 'firelight',
  STUDIO: 'studio',
  HARD_LIGHT: 'hard_light',
  SOFT_LIGHT: 'soft_light',
  BACKLIGHT: 'backlight',
  RIM_LIGHT: 'rim_light',
  SILHOUETTE: 'silhouette',
  VOLUMETRIC: 'volumetric',
  HIGH_KEY: 'high_key',
  LOW_KEY: 'low_key'
};

// ============================================
// EMOTIONAL TONES
// ============================================

export const EMOTIONAL_TONES = {
  NEUTRAL: 'neutral',
  TENSE: 'tense',
  CURIOUS: 'curious',
  MYSTERIOUS: 'mysterious',
  HOPEFUL: 'hopeful',
  JOYFUL: 'joyful',
  SAD: 'sad',
  DARK: 'dark',
  EPIC: 'epic',
  ROMANTIC: 'romantic',
  URGENT: 'urgent',
  INSPIRATIONAL: 'inspirational',
  PEACEFUL: 'peaceful',
  NOSTALGIC: 'nostalgic',
  SURREAL: 'surreal',
  TRIUMPHANT: 'triumphant',
  DANGEROUS: 'dangerous',
  SURPRISE: 'surprise',
  FEAR: 'fear',
  ANGER: 'anger',
  DETERMINATION: 'determination',
  REFLECTIVE: 'reflective',
  AMAZED: 'amazed',
  AWE: 'awe',
  BITTERSWEET: 'bittersweet',
  ANTICIPATORY: 'anticipatory',
  UPLIFTING: 'uplifting',
  ADVENTUROUS: 'adventurous',
  IMMERSIVE: 'immersive',
  ANALYTICAL: 'analytical',
  SHOCKING: 'shocking',
  SATISFYING: 'satisfying',
  DRAMATIC: 'dramatic',
  ENERGETIC: 'energetic',
  ROUTINE: 'routine',
  CONTENT: 'content',
  GRAND: 'grand',
  WARM: 'warm',
  CONFRONTATIONAL: 'confrontational',
  INTIMATE: 'intimate'
};

// ============================================
// TRANSITION TYPES
// ============================================

export const TRANSITION_TYPES = {
  CUT: 'cut',
  FADE_IN: 'fade_in',
  FADE_OUT: 'fade_out',
  FADE_TO_BLACK: 'fade_to_black',
  DISSOLVE: 'dissolve',
  WIPE: 'wipe',
  MATCH_CUT: 'match_cut',
  WHIP_PAN: 'whip_pan',
  LIGHT_TRANSITION: 'light_transition',
  SMOKE_TRANSITION: 'smoke_transition',
  WATER_TRANSITION: 'water_transition',
  MORPH: 'morph',
  TIME_TRANSITION: 'time_transition'
};

// ============================================
// SCHEMA BUILDERS
// ============================================

export function createEmptyScene(overrides = {}) {
  return {
    scene_id: overrides.scene_id || `scene_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    scene_number: overrides.scene_number || 1,
    scene_type: overrides.scene_type || SCENE_TYPES.ESTABLISHING,
    scene_subtype: overrides.scene_subtype || null,
    purpose: overrides.purpose || {
      story_function: 'establish_world',
      narrative_role: 'opening',
      description: ''
    },
    timing: overrides.timing || {
      duration_seconds: 5,
      start_time: 0,
      end_time: 5,
      pace: 'normal',
      importance: 'medium'
    },
    story: overrides.story || {
      act: 1,
      sequence: 1,
      beat: 1,
      previous_scene_id: null,
      next_scene_id: null,
      story_question: null,
      story_answer: null
    },
    characters: overrides.characters || [],
    environment: overrides.environment || null,
    visual_style: overrides.visual_style || {
      genre: 'cinematic',
      visual_style: 'premium_cinematic',
      color_palette: 'cinematic',
      contrast: 'medium',
      film_texture: 'subtle_film_grain',
      realism: 'photorealistic',
      aspect_ratio: '16:9'
    },
    emotion: overrides.emotion || {
      primary: EMOTIONAL_TONES.NEUTRAL,
      secondary: null,
      intensity: 0.5,
      emotional_arc: 'neutral_to_mysterious'
    },
    camera: overrides.camera || {
      shot_type: SHOT_TYPES.WIDE,
      camera_position: 'street_level',
      camera_angle: 'eye_level',
      movement: CAMERA_MOVEMENTS.STATIC,
      movement_speed: 'normal',
      stabilization: 'cinematic',
      framing: 'wide'
    },
    lens: overrides.lens || {
      focal_length: '35mm',
      lens_type: 'anamorphic',
      depth_of_field: 'medium',
      aperture: 'f2.8',
      bokeh: 'subtle'
    },
    lighting: overrides.lighting || {
      style: LIGHTING_STYLES.NATURAL,
      key_light: 'ambient',
      fill_light: 'soft',
      rim_light: null,
      practical_lights: [],
      volumetric_light: false
    },
    dialogue: overrides.dialogue || {
      enabled: false,
      speaker: null,
      text: null,
      delivery: null
    },
    narration: overrides.narration || {
      enabled: false,
      text: null,
      voice: null,
      delivery: null
    },
    b_roll: overrides.b_roll || [],
    shots: overrides.shots || [],
    transitions: overrides.transitions || {
      transition_in: { type: TRANSITION_TYPES.CUT, duration: 0 },
      transition_out: { type: TRANSITION_TYPES.CUT, duration: 0 }
    },
    audio: overrides.audio || {
      ambient: [],
      sound_effects: [],
      music: {
        enabled: true,
        style: 'cinematic',
        intensity: 0.3
      }
    },
    assets: overrides.assets || {
      required: [],
      generated: [],
      references: []
    },
    continuity: overrides.continuity || {
      characters: [],
      locations: [],
      props: [],
      wardrobe: [],
      lighting: [],
      color: []
    },
    generation: overrides.generation || {
      model: null,
      image_prompt: null,
      video_prompt: null,
      negative_prompt: null,
      generation_status: 'pending'
    },
    editing: overrides.editing || {
      speed: 1,
      crop: 'none',
      stabilization: false,
      color_grade: 'cinematic',
      effects: []
    },
    metadata: overrides.metadata || {
      created_by: 'ai_director',
      version: 1,
      locked: false,
      approved: false
    }
  };
}

export function createEmptyShot(overrides = {}) {
  return {
    shot_id: overrides.shot_id || `shot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    shot_number: overrides.shot_number || 1,
    purpose: overrides.purpose || 'establish_location',
    duration_seconds: overrides.duration_seconds || 3,
    shot_type: overrides.shot_type || SHOT_TYPES.MEDIUM,
    subject: overrides.subject || {
      type: 'environment',
      description: ''
    },
    composition: overrides.composition || {
      framing: 'medium',
      subject_position: 'center',
      foreground: [],
      midground: [],
      background: []
    },
    camera: overrides.camera || {
      position: 'eye_level',
      angle: 'eye_level',
      movement: CAMERA_MOVEMENTS.STATIC,
      movement_speed: 'normal',
      start_position: null,
      end_position: null
    },
    lens: overrides.lens || {
      focal_length: '50mm',
      lens_type: 'standard',
      aperture: 'f2.8',
      depth_of_field: 'medium'
    },
    lighting: overrides.lighting || {
      style: LIGHTING_STYLES.NATURAL,
      key: 'ambient',
      fill: 'soft',
      rim: null,
      practical: []
    },
    subject_action: overrides.subject_action || {
      action: null,
      motion: 'static'
    },
    emotion: overrides.emotion || {
      primary: EMOTIONAL_TONES.NEUTRAL,
      intensity: 0.5
    },
    visual_effects: overrides.visual_effects || [],
    audio: overrides.audio || {
      dialogue: null,
      sound_effects: [],
      music_intensity: 0.3
    },
    transition: overrides.transition || {
      in: TRANSITION_TYPES.CUT,
      out: TRANSITION_TYPES.CUT
    },
    generation: overrides.generation || {
      image_prompt: '',
      video_prompt: '',
      negative_prompt: '',
      reference_images: [],
      reference_videos: [],
      model: null,
      status: 'pending'
    }
  };
}

export function createEmptyCharacter(overrides = {}) {
  return {
    character_id: overrides.character_id || `char_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: overrides.name || 'Character',
    role: overrides.role || 'supporting',
    identity: overrides.identity || {
      age: null,
      gender: null,
      ethnicity: null,
      occupation: null
    },
    appearance: overrides.appearance || {
      height: null,
      build: null,
      hair: null,
      eyes: null,
      skin: null,
      facial_hair: null
    },
    wardrobe: overrides.wardrobe || {
      primary: {},
      secondary: {}
    },
    personality: overrides.personality || [],
    emotional_state: overrides.emotional_state || 'neutral',
    current_action: overrides.current_action || null,
    reference_assets: overrides.reference_assets || {
      face_reference: null,
      full_body_reference: null,
      character_sheet: null
    },
    continuity_rules: overrides.continuity_rules || [
      'maintain_same_face',
      'maintain_same_wardrobe',
      'maintain_same_hair'
    ]
  };
}

export function createEmptyEnvironment(overrides = {}) {
  return {
    environment_id: overrides.environment_id || `env_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: overrides.name || 'Environment',
    type: overrides.type || 'interior',
    location: overrides.location || null,
    time: overrides.time || {
      time_of_day: 'day',
      season: 'present',
      era: 'present'
    },
    weather: overrides.weather || {
      condition: 'clear',
      intensity: 'light',
      wind: 'none',
      fog: 'none'
    },
    architecture: overrides.architecture || {
      style: 'modern',
      condition: 'normal',
      materials: []
    },
    lighting: overrides.lighting || {
      natural: 'daylight',
      artificial: []
    },
    color_palette: overrides.color_palette || [],
    background_activity: overrides.background_activity || [],
    continuity_reference: overrides.continuity_reference || null
  };
}

// ============================================
// SCENE TEMPLATES
// ============================================

export const SCENE_TEMPLATES = {
  cold_open_action: {
    id: 'cold_open_action',
    name: 'Cold Open - Action',
    scene_type: SCENE_TYPES.COLD_OPEN,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.EXTREME_WIDE, purpose: 'establish_event', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'character_motion', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context_reveal', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ['action', 'thriller', 'drama']
  },
  cold_open_mystery: {
    id: 'cold_open_mystery',
    name: 'Cold Open - Mystery',
    scene_type: SCENE_TYPES.COLD_OPEN,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.INSERT, purpose: 'mysterious_object', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'character_reaction', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ['mystery', 'thriller', 'drama']
  },

  hook_visual_shock: {
    id: 'hook_visual_shock',
    name: 'Hook - Visual Shock',
    scene_type: SCENE_TYPES.HOOK,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'beautiful_setup', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'shock_event', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 1 }
    ],
    emotion: EMOTIONAL_TONES.SURPRISE,
    compatible_genres: ['all']
  },
  hook_question: {
    id: 'hook_question',
    name: 'Hook - Question',
    scene_type: SCENE_TYPES.HOOK,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'visual_setup', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'character', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'question_statement', duration: 1 }
    ],
    emotion: EMOTIONAL_TONES.CURIOUS,
    compatible_genres: ['all']
  },

  establishing_wide: {
    id: 'establishing_wide',
    name: 'Establishing - Wide',
    scene_type: SCENE_TYPES.ESTABLISHING,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.EXTREME_WIDE, purpose: 'environment', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'location', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ['all']
  },
  establishing_city: {
    id: 'establishing_city',
    name: 'Establishing - City',
    scene_type: SCENE_TYPES.ESTABLISHING,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.AERIAL, purpose: 'skyline', duration: 3 },
      { shot_type: SHOT_TYPES.TRACKING, purpose: 'streets', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'building', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ['urban', 'corporate', 'thriller']
  },
  establishing_interior: {
    id: 'establishing_interior',
    name: 'Establishing - Interior',
    scene_type: SCENE_TYPES.ESTABLISHING,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'exterior', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'entrance', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'room', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ['all']
  },

  character_intro_hero: {
    id: 'character_intro_hero',
    name: 'Character Introduction - Hero',
    scene_type: SCENE_TYPES.CHARACTER_INTRODUCTION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 },
      { shot_type: SHOT_TYPES.SILHOUETTE, purpose: 'silhouette', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM_CLOSE_UP, purpose: 'face_reveal', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'action', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.HOPEFUL,
    compatible_genres: ['drama', 'action', 'adventure']
  },
  character_intro_villain: {
    id: 'character_intro_villain',
    name: 'Character Introduction - Villain',
    scene_type: SCENE_TYPES.CHARACTER_INTRODUCTION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment_tension', duration: 2 },
      { shot_type: SHOT_TYPES.LOW_ANGLE, purpose: 'partial_reveal', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'character', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'threat', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DARK,
    compatible_genres: ['thriller', 'horror', 'action']
  },

  discovery_object: {
    id: 'discovery_object',
    name: 'Discovery - Object',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'search', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'movement', duration: 2 },
      { shot_type: SHOT_TYPES.INSERT, purpose: 'object_detail', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'hand_picks_up', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'object_reveal', duration: 1 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 1 }
    ],
    emotion: EMOTIONAL_TONES.CURIOUS,
    compatible_genres: ['mystery', 'thriller', 'adventure']
  },
  discovery_location: {
    id: 'discovery_location',
    name: 'Discovery - Location',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'travel', duration: 2 },
      { shot_type: SHOT_TYPES.TRACKING, purpose: 'approach', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'location_reveal', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'character_reaction', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ['adventure', 'fantasy', 'sci-fi']
  },

  reveal_slow: {
    id: 'reveal_slow',
    name: 'Reveal - Slow',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.INSERT, purpose: 'detail', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'medium', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'wide_reveal', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.SURPRISE,
    compatible_genres: ['all']
  },
  reveal_environment: {
    id: 'reveal_environment',
    name: 'Reveal - Environment',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'character', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'movement', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment_pullback', duration: 5 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ['epic', 'sci-fi', 'fantasy', 'documentary']
  },

  conflict_verbal: {
    id: 'conflict_verbal',
    name: 'Conflict - Verbal',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 15,
    shot_sequence: [
      { shot_type: SHOT_TYPES.TWO_SHOT, purpose: 'establish', duration: 3 },
      { shot_type: SHOT_TYPES.OVER_SHOULDER, purpose: 'character_a', duration: 3 },
      { shot_type: SHOT_TYPES.OVER_SHOULDER, purpose: 'character_b', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction_a', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction_b', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'escalation', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ['drama', 'thriller', 'corporate']
  },
  conflict_physical: {
    id: 'conflict_physical',
    name: 'Conflict - Physical',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 20,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'confrontation', duration: 3 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'first_strike', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'exchange', duration: 4 },
      { shot_type: SHOT_TYPES.LOW_ANGLE, purpose: 'turning_point', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'winner', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'aftermath', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DANGEROUS,
    compatible_genres: ['action', 'thriller']
  },

  chase_foot: {
    id: 'chase_foot',
    name: 'Chase - Foot',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 20,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'threat', duration: 3 },
      { shot_type: SHOT_TYPES.TRACKING, purpose: 'running', duration: 5 },
      { shot_type: SHOT_TYPES.SIDE, purpose: 'pursuer', duration: 3 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'obstacle', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'escape', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ['action', 'thriller']
  },
  chase_vehicle: {
    id: 'chase_vehicle',
    name: 'Chase - Vehicle',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 25,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'pursuit', duration: 5 },
      { shot_type: SHOT_TYPES.TRACKING, purpose: 'close_call', duration: 5 },
      { shot_type: SHOT_TYPES.AERIAL, purpose: 'overview', duration: 3 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'escape', duration: 5 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'safety', duration: 4 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ['action', 'thriller']
  },

  climax_heroic: {
    id: 'climax_heroic',
    name: 'Climax - Heroic',
    scene_type: SCENE_TYPES.CLIMAX,
    default_duration: 20,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 3 },
      { shot_type: SHOT_TYPES.LOW_ANGLE, purpose: 'hero', duration: 3 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'movement', duration: 4 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'determination', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'final_attempt', duration: 4 },
      { shot_type: SHOT_TYPES.EXTREME_WIDE, purpose: 'victory', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ['action', 'adventure', 'drama']
  },

  resolution_happy: {
    id: 'resolution_happy',
    name: 'Resolution - Happy',
    scene_type: SCENE_TYPES.RESOLUTION,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'resolution', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'character', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'wide', duration: 4 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ['all']
  },
  resolution_emotional: {
    id: 'resolution_emotional',
    name: 'Resolution - Emotional',
    scene_type: SCENE_TYPES.RESOLUTION,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'resolution', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'silence', duration: 3 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'reaction', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'wide', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.SAD,
    compatible_genres: ['drama', 'romance']
  },

  product_hero_reveal: {
    id: 'product_hero_reveal',
    name: 'Product - Hero Reveal',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 },
      { shot_type: SHOT_TYPES.INSERT, purpose: 'silhouette', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'reveal', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'hero_shot', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ['commercial', 'product', 'luxury']
  },
  product_macro: {
    id: 'product_macro',
    name: 'Product - Macro',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MACRO, purpose: 'texture', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'detail', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'logo', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ['commercial', 'product']
  },
  product_in_use: {
    id: 'product_in_use',
    name: 'Product - In Use',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'product', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'interaction', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'result', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'benefit', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ['commercial', 'lifestyle']
  },

  montage_training: {
    id: 'montage_training',
    name: 'Montage - Training',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 20,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'failure', duration: 3 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'practice', duration: 4 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'progress', duration: 4 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'mastery', duration: 4 },
      { shot_type: SHOT_TYPES.EXTREME_WIDE, purpose: 'achievement', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.INSPIRATIONAL,
    compatible_genres: ['sports', 'business', 'personal']
  },
  montage_transformation: {
    id: 'montage_transformation',
    name: 'Montage - Transformation',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 15,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'before', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'process', duration: 4 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'progress', duration: 4 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'after', duration: 4 }
    ],
    emotion: EMOTIONAL_TONES.INSPIRATIONAL,
    compatible_genres: ['commercial', 'personal', 'business']
  },

  emotional_goodbye: {
    id: 'emotional_goodbye',
    name: 'Emotional - Goodbye',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'conversation', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'silence', duration: 3 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'departure', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'reaction', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.SAD,
    compatible_genres: ['drama', 'romance']
  },
  emotional_reunion: {
    id: 'emotional_reunion',
    name: 'Emotional - Reunion',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'arrival', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'recognition', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'approach', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'embrace', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ['drama', 'romance', 'family']
  },

  cta_direct: {
    id: 'cta_direct',
    name: 'CTA - Direct',
    scene_type: SCENE_TYPES.CTA,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'result', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'character', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'offer', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_WIDE, purpose: 'cta', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ['commercial', 'direct_response']
  },
  cta_logo: {
    id: 'cta_logo',
    name: 'CTA - Logo Reveal',
    scene_type: SCENE_TYPES.CTA,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'hero_visual', duration: 2 },
      { shot_type: SHOT_TYPES.INSERT, purpose: 'logo_formation', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'cta_text', duration: 1 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ['commercial', 'brand', 'corporate']
  },

  end_card_fade: {
    id: 'end_card_fade',
    name: 'End Card - Fade',
    scene_type: SCENE_TYPES.END_CARD,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'hero_visual', duration: 2 },
      { shot_type: SHOT_TYPES.FADE_TO_BLACK, purpose: 'fade', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ['all']
  },

  dialogue_two_shot: {
    id: 'dialogue_two_shot',
    name: 'Dialogue - Two Shot',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 15,
    shot_sequence: [
      { shot_type: SHOT_TYPES.TWO_SHOT, purpose: 'establish', duration: 3 },
      { shot_type: SHOT_TYPES.OVER_SHOULDER, purpose: 'character_a', duration: 3 },
      { shot_type: SHOT_TYPES.OVER_SHOULDER, purpose: 'character_b', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction_a', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction_b', duration: 2 },
      { shot_type: SHOT_TYPES.TWO_SHOT, purpose: 'resolution', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ['drama', 'romance', 'comedy']
  },

  pov_first_person: {
    id: 'pov_first_person',
    name: 'POV - First Person',
    scene_type: SCENE_TYPES.POV,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.POV, purpose: 'movement', duration: 3 },
      { shot_type: SHOT_TYPES.POV, purpose: 'search', duration: 3 },
      { shot_type: SHOT_TYPES.POV, purpose: 'discovery', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CURIOUS,
    compatible_genres: ['horror', 'thriller', 'adventure']
  },

  montage_business_growth: {
    id: 'montage_business_growth',
    name: 'Montage - Business Growth',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 15,
    shot_sequence: [
      { shot_type: SHOT_TYPES.INSERT, purpose: 'idea', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'first_customer', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'team', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'revenue', duration: 3 },
      { shot_type: SHOT_TYPES.EXTREME_WIDE, purpose: 'scale', duration: 4 }
    ],
    emotion: EMOTIONAL_TONES.INSPIRATIONAL,
    compatible_genres: ['business', 'corporate', 'startup']
  },

  suspense_countdown: {
    id: 'suspense_countdown',
    name: 'Suspense - Countdown',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 15,
    shot_sequence: [
      { shot_type: SHOT_TYPES.INSERT, purpose: 'clock', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'character', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'problem', duration: 3 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'time_running', duration: 4 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'tension', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ['thriller', 'action', 'horror']
  },

  horror_darkness: {
    id: 'horror_darkness',
    name: 'Horror - Darkness',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.EXTREME_WIDE, purpose: 'darkness', duration: 2 },
      { shot_type: SHOT_TYPES.POV, purpose: 'movement', duration: 3 },
      { shot_type: SHOT_TYPES.INSERT, purpose: 'detail', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'monster', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'reaction', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DARK,
    compatible_genres: ['horror', 'thriller']
  },

  romance_first_meeting: {
    id: 'romance_first_meeting',
    name: 'Romance - First Meeting',
    scene_type: SCENE_TYPES.ROMANCE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'separate_characters', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'notice', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'eye_contact', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'approach', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'smile', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ['romance', 'drama']
  },

  flashback_memory: {
    id: 'flashback_memory',
    name: 'Flashback - Memory',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'present_trigger', duration: 2 },
      { shot_type: SHOT_TYPES.DISSOLVE, purpose: 'transition', duration: 1 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'past', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'memory', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'return', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NOSTALGIC,
    compatible_genres: ['drama', 'mystery', 'romance']
  },

  journey_road: {
    id: 'journey_road',
    name: 'Journey - Road',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 15,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'vehicle', duration: 3 },
      { shot_type: SHOT_TYPES.TRACKING, purpose: 'road', duration: 4 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'landscape', duration: 4 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'character', duration: 4 }
    ],
    emotion: EMOTIONAL_TONES.HOPEFUL,
    compatible_genres: ['adventure', 'drama', 'road']
  },

  time_lapse_sunrise: {
    id: 'time_lapse_sunrise',
    name: 'Time Passage - Sunrise',
    scene_type: SCENE_TYPES.TIME_PASSAGE,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'night', duration: 2 },
      { shot_type: SHOT_TYPES.TIME_LAPSE, purpose: 'sunrise', duration: 4 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'character', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.HOPEFUL,
    compatible_genres: ['all']
  },

  scale_reveal_micro_to_macro: {
    id: 'scale_reveal_micro_to_macro',
    name: 'Scale Reveal - Micro to Macro',
    scene_type: SCENE_TYPES.SCALE_REVEAL,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MACRO, purpose: 'tiny_detail', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'object', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'environment', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'massive_world', duration: 4 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ['epic', 'sci-fi', 'documentary']
  },

  documentary_interview: {
    id: 'documentary_interview',
    name: 'Documentary - Interview',
    scene_type: SCENE_TYPES.INTERVIEW,
    default_duration: 20,
    shot_sequence: [
      { shot_type: SHOT_TYPES.OVER_SHOULDER, purpose: 'environment', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'question', duration: 3 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'answer', duration: 5 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 3 },
      { shot_type: SHOT_TYPES.OVER_SHOULDER, purpose: 'follow_up', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'final_thought', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ['documentary', 'interview', 'testimonial']
  },

  testimonial_customer: {
    id: 'testimonial_customer',
    name: 'Testimonial - Customer',
    scene_type: SCENE_TYPES.TESTIMONIAL,
    default_duration: 20,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'introduction', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'problem', duration: 3 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'solution', duration: 4 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'transformation', duration: 4 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'recommendation', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'result', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ['business', 'commercial', 'corporate']
  },

  broll_atmospheric: {
    id: 'broll_atmospheric',
    name: 'B-Roll - Atmospheric',
    scene_type: SCENE_TYPES.ESTABLISHING,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MACRO, purpose: 'detail', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'atmosphere', duration: 3 },
      { shot_type: SHOT_TYPES.TRACKING, purpose: 'movement', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ['all']
  },

  technology_interface: {
    id: 'technology_interface',
    name: 'Technology - Interface',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'character', duration: 2 },
      { shot_type: SHOT_TYPES.INSERT, purpose: 'interface', duration: 3 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'data', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'reaction', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CURIOUS,
    compatible_genres: ['tech', 'corporate', 'business']
  },

  social_hook: {
    id: 'social_hook',
    name: 'Social - Hook',
    scene_type: SCENE_TYPES.HOOK,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'unexpected', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'statement', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'proof', duration: 1 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ['social', 'marketing']
  }
,

  character_emotion_1: {
    id: 'character_emotion_1',
    name: 'Character Emotion 1',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ENERGETIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_2: {
    id: 'character_emotion_2',
    name: 'Character Emotion 2',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_3: {
    id: 'character_emotion_3',
    name: 'Character Emotion 3',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.PEACEFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_4: {
    id: 'character_emotion_4',
    name: 'Character Emotion 4',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.SATISFYING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_5: {
    id: 'character_emotion_5',
    name: 'Character Emotion 5',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.REFLECTIVE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_6: {
    id: 'character_emotion_6',
    name: 'Character Emotion 6',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_7: {
    id: 'character_emotion_7',
    name: 'Character Emotion 7',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DARK,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_8: {
    id: 'character_emotion_8',
    name: 'Character Emotion 8',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_9: {
    id: 'character_emotion_9',
    name: 'Character Emotion 9',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_10: {
    id: 'character_emotion_10',
    name: 'Character Emotion 10',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONTENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_11: {
    id: 'character_emotion_11',
    name: 'Character Emotion 11',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.AWE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_12: {
    id: 'character_emotion_12',
    name: 'Character Emotion 12',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.IMMERSIVE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_13: {
    id: 'character_emotion_13',
    name: 'Character Emotion 13',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CURIOUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_14: {
    id: 'character_emotion_14',
    name: 'Character Emotion 14',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SAD,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_15: {
    id: 'character_emotion_15',
    name: 'Character Emotion 15',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TRIUMPHANT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_16: {
    id: 'character_emotion_16',
    name: 'Character Emotion 16',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DETERMINATION,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_17: {
    id: 'character_emotion_17',
    name: 'Character Emotion 17',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.BITTERSWEET,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_18: {
    id: 'character_emotion_18',
    name: 'Character Emotion 18',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_19: {
    id: 'character_emotion_19',
    name: 'Character Emotion 19',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_20: {
    id: 'character_emotion_20',
    name: 'Character Emotion 20',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DARK,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_21: {
    id: 'character_emotion_21',
    name: 'Character Emotion 21',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.AWE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_22: {
    id: 'character_emotion_22',
    name: 'Character Emotion 22',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.HOPEFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_23: {
    id: 'character_emotion_23',
    name: 'Character Emotion 23',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_24: {
    id: 'character_emotion_24',
    name: 'Character Emotion 24',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DETERMINATION,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_25: {
    id: 'character_emotion_25',
    name: 'Character Emotion 25',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.GRAND,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_26: {
    id: 'character_emotion_26',
    name: 'Character Emotion 26',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_27: {
    id: 'character_emotion_27',
    name: 'Character Emotion 27',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.AMAZED,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_28: {
    id: 'character_emotion_28',
    name: 'Character Emotion 28',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_29: {
    id: 'character_emotion_29',
    name: 'Character Emotion 29',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NOSTALGIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_30: {
    id: 'character_emotion_30',
    name: 'Character Emotion 30',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_31: {
    id: 'character_emotion_31',
    name: 'Character Emotion 31',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.IMMERSIVE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_32: {
    id: 'character_emotion_32',
    name: 'Character Emotion 32',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONFRONTATIONAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_33: {
    id: 'character_emotion_33',
    name: 'Character Emotion 33',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.WARM,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_34: {
    id: 'character_emotion_34',
    name: 'Character Emotion 34',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.FEAR,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_35: {
    id: 'character_emotion_35',
    name: 'Character Emotion 35',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DETERMINATION,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_36: {
    id: 'character_emotion_36',
    name: 'Character Emotion 36',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.NOSTALGIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_37: {
    id: 'character_emotion_37',
    name: 'Character Emotion 37',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TRIUMPHANT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_38: {
    id: 'character_emotion_38',
    name: 'Character Emotion 38',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SAD,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_39: {
    id: 'character_emotion_39',
    name: 'Character Emotion 39',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_emotion_40: {
    id: 'character_emotion_40',
    name: 'Character Emotion 40',
    scene_type: SCENE_TYPES.CHARACTER_REACTION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.WARM,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_1: {
    id: 'character_action_1',
    name: 'Character Action 1',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANGER,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_2: {
    id: 'character_action_2',
    name: 'Character Action 2',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.AWE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_3: {
    id: 'character_action_3',
    name: 'Character Action 3',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ENERGETIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_4: {
    id: 'character_action_4',
    name: 'Character Action 4',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.UPLIFTING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_5: {
    id: 'character_action_5',
    name: 'Character Action 5',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_6: {
    id: 'character_action_6',
    name: 'Character Action 6',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.AWE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_7: {
    id: 'character_action_7',
    name: 'Character Action 7',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_8: {
    id: 'character_action_8',
    name: 'Character Action 8',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.IMMERSIVE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_9: {
    id: 'character_action_9',
    name: 'Character Action 9',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.TRIUMPHANT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_10: {
    id: 'character_action_10',
    name: 'Character Action 10',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_11: {
    id: 'character_action_11',
    name: 'Character Action 11',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_12: {
    id: 'character_action_12',
    name: 'Character Action 12',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TRIUMPHANT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_13: {
    id: 'character_action_13',
    name: 'Character Action 13',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONTENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_14: {
    id: 'character_action_14',
    name: 'Character Action 14',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.UPLIFTING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_15: {
    id: 'character_action_15',
    name: 'Character Action 15',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_16: {
    id: 'character_action_16',
    name: 'Character Action 16',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ENERGETIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_17: {
    id: 'character_action_17',
    name: 'Character Action 17',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ADVENTUROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_18: {
    id: 'character_action_18',
    name: 'Character Action 18',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_19: {
    id: 'character_action_19',
    name: 'Character Action 19',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_20: {
    id: 'character_action_20',
    name: 'Character Action 20',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TRIUMPHANT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_21: {
    id: 'character_action_21',
    name: 'Character Action 21',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SAD,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_22: {
    id: 'character_action_22',
    name: 'Character Action 22',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.WARM,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_23: {
    id: 'character_action_23',
    name: 'Character Action 23',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DANGEROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_24: {
    id: 'character_action_24',
    name: 'Character Action 24',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.AMAZED,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_25: {
    id: 'character_action_25',
    name: 'Character Action 25',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.UPLIFTING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_26: {
    id: 'character_action_26',
    name: 'Character Action 26',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.SHOCKING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_27: {
    id: 'character_action_27',
    name: 'Character Action 27',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_28: {
    id: 'character_action_28',
    name: 'Character Action 28',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_29: {
    id: 'character_action_29',
    name: 'Character Action 29',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONTENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_30: {
    id: 'character_action_30',
    name: 'Character Action 30',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_31: {
    id: 'character_action_31',
    name: 'Character Action 31',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ROUTINE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_32: {
    id: 'character_action_32',
    name: 'Character Action 32',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.SURPRISE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_33: {
    id: 'character_action_33',
    name: 'Character Action 33',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_34: {
    id: 'character_action_34',
    name: 'Character Action 34',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SURPRISE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_35: {
    id: 'character_action_35',
    name: 'Character Action 35',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ENERGETIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_36: {
    id: 'character_action_36',
    name: 'Character Action 36',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.INTIMATE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_37: {
    id: 'character_action_37',
    name: 'Character Action 37',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANGER,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_38: {
    id: 'character_action_38',
    name: 'Character Action 38',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SURPRISE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_39: {
    id: 'character_action_39',
    name: 'Character Action 39',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  character_action_40: {
    id: 'character_action_40',
    name: 'Character Action 40',
    scene_type: SCENE_TYPES.ACTION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SURPRISE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_1: {
    id: 'dialogue_scene_1',
    name: 'Dialogue Scene 1',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.INTIMATE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_2: {
    id: 'dialogue_scene_2',
    name: 'Dialogue Scene 2',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_3: {
    id: 'dialogue_scene_3',
    name: 'Dialogue Scene 3',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ENERGETIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_4: {
    id: 'dialogue_scene_4',
    name: 'Dialogue Scene 4',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONFRONTATIONAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_5: {
    id: 'dialogue_scene_5',
    name: 'Dialogue Scene 5',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.FEAR,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_6: {
    id: 'dialogue_scene_6',
    name: 'Dialogue Scene 6',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONTENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_7: {
    id: 'dialogue_scene_7',
    name: 'Dialogue Scene 7',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_8: {
    id: 'dialogue_scene_8',
    name: 'Dialogue Scene 8',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.FEAR,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_9: {
    id: 'dialogue_scene_9',
    name: 'Dialogue Scene 9',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_10: {
    id: 'dialogue_scene_10',
    name: 'Dialogue Scene 10',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_11: {
    id: 'dialogue_scene_11',
    name: 'Dialogue Scene 11',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_12: {
    id: 'dialogue_scene_12',
    name: 'Dialogue Scene 12',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.HOPEFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_13: {
    id: 'dialogue_scene_13',
    name: 'Dialogue Scene 13',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ADVENTUROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_14: {
    id: 'dialogue_scene_14',
    name: 'Dialogue Scene 14',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.HOPEFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_15: {
    id: 'dialogue_scene_15',
    name: 'Dialogue Scene 15',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.REFLECTIVE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_16: {
    id: 'dialogue_scene_16',
    name: 'Dialogue Scene 16',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONFRONTATIONAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_17: {
    id: 'dialogue_scene_17',
    name: 'Dialogue Scene 17',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DETERMINATION,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_18: {
    id: 'dialogue_scene_18',
    name: 'Dialogue Scene 18',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CURIOUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_19: {
    id: 'dialogue_scene_19',
    name: 'Dialogue Scene 19',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_20: {
    id: 'dialogue_scene_20',
    name: 'Dialogue Scene 20',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_21: {
    id: 'dialogue_scene_21',
    name: 'Dialogue Scene 21',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.PEACEFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_22: {
    id: 'dialogue_scene_22',
    name: 'Dialogue Scene 22',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANGER,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_23: {
    id: 'dialogue_scene_23',
    name: 'Dialogue Scene 23',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_24: {
    id: 'dialogue_scene_24',
    name: 'Dialogue Scene 24',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_25: {
    id: 'dialogue_scene_25',
    name: 'Dialogue Scene 25',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SAD,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_26: {
    id: 'dialogue_scene_26',
    name: 'Dialogue Scene 26',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.AWE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_27: {
    id: 'dialogue_scene_27',
    name: 'Dialogue Scene 27',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.BITTERSWEET,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_28: {
    id: 'dialogue_scene_28',
    name: 'Dialogue Scene 28',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.GRAND,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_29: {
    id: 'dialogue_scene_29',
    name: 'Dialogue Scene 29',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  dialogue_scene_30: {
    id: 'dialogue_scene_30',
    name: 'Dialogue Scene 30',
    scene_type: SCENE_TYPES.DIALOGUE,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.BITTERSWEET,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_1: {
    id: 'pov_scene_1',
    name: 'Pov Scene 1',
    scene_type: SCENE_TYPES.POV,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONFRONTATIONAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_2: {
    id: 'pov_scene_2',
    name: 'Pov Scene 2',
    scene_type: SCENE_TYPES.POV,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_3: {
    id: 'pov_scene_3',
    name: 'Pov Scene 3',
    scene_type: SCENE_TYPES.POV,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_4: {
    id: 'pov_scene_4',
    name: 'Pov Scene 4',
    scene_type: SCENE_TYPES.POV,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_5: {
    id: 'pov_scene_5',
    name: 'Pov Scene 5',
    scene_type: SCENE_TYPES.POV,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ENERGETIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_6: {
    id: 'pov_scene_6',
    name: 'Pov Scene 6',
    scene_type: SCENE_TYPES.POV,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_7: {
    id: 'pov_scene_7',
    name: 'Pov Scene 7',
    scene_type: SCENE_TYPES.POV,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONFRONTATIONAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_8: {
    id: 'pov_scene_8',
    name: 'Pov Scene 8',
    scene_type: SCENE_TYPES.POV,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_9: {
    id: 'pov_scene_9',
    name: 'Pov Scene 9',
    scene_type: SCENE_TYPES.POV,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_10: {
    id: 'pov_scene_10',
    name: 'Pov Scene 10',
    scene_type: SCENE_TYPES.POV,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.INTIMATE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_11: {
    id: 'pov_scene_11',
    name: 'Pov Scene 11',
    scene_type: SCENE_TYPES.POV,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ROUTINE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_12: {
    id: 'pov_scene_12',
    name: 'Pov Scene 12',
    scene_type: SCENE_TYPES.POV,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_13: {
    id: 'pov_scene_13',
    name: 'Pov Scene 13',
    scene_type: SCENE_TYPES.POV,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DANGEROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_14: {
    id: 'pov_scene_14',
    name: 'Pov Scene 14',
    scene_type: SCENE_TYPES.POV,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.FEAR,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_15: {
    id: 'pov_scene_15',
    name: 'Pov Scene 15',
    scene_type: SCENE_TYPES.POV,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SAD,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_16: {
    id: 'pov_scene_16',
    name: 'Pov Scene 16',
    scene_type: SCENE_TYPES.POV,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_17: {
    id: 'pov_scene_17',
    name: 'Pov Scene 17',
    scene_type: SCENE_TYPES.POV,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_18: {
    id: 'pov_scene_18',
    name: 'Pov Scene 18',
    scene_type: SCENE_TYPES.POV,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NOSTALGIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_19: {
    id: 'pov_scene_19',
    name: 'Pov Scene 19',
    scene_type: SCENE_TYPES.POV,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_20: {
    id: 'pov_scene_20',
    name: 'Pov Scene 20',
    scene_type: SCENE_TYPES.POV,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.SHOCKING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_21: {
    id: 'pov_scene_21',
    name: 'Pov Scene 21',
    scene_type: SCENE_TYPES.POV,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_22: {
    id: 'pov_scene_22',
    name: 'Pov Scene 22',
    scene_type: SCENE_TYPES.POV,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_23: {
    id: 'pov_scene_23',
    name: 'Pov Scene 23',
    scene_type: SCENE_TYPES.POV,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_24: {
    id: 'pov_scene_24',
    name: 'Pov Scene 24',
    scene_type: SCENE_TYPES.POV,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.REFLECTIVE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  pov_scene_25: {
    id: 'pov_scene_25',
    name: 'Pov Scene 25',
    scene_type: SCENE_TYPES.POV,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONTENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_1: {
    id: 'discovery_scene_1',
    name: 'Discovery Scene 1',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.UPLIFTING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_2: {
    id: 'discovery_scene_2',
    name: 'Discovery Scene 2',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_3: {
    id: 'discovery_scene_3',
    name: 'Discovery Scene 3',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_4: {
    id: 'discovery_scene_4',
    name: 'Discovery Scene 4',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SAD,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_5: {
    id: 'discovery_scene_5',
    name: 'Discovery Scene 5',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.INSPIRATIONAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_6: {
    id: 'discovery_scene_6',
    name: 'Discovery Scene 6',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_7: {
    id: 'discovery_scene_7',
    name: 'Discovery Scene 7',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DARK,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_8: {
    id: 'discovery_scene_8',
    name: 'Discovery Scene 8',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DETERMINATION,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_9: {
    id: 'discovery_scene_9',
    name: 'Discovery Scene 9',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_10: {
    id: 'discovery_scene_10',
    name: 'Discovery Scene 10',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_11: {
    id: 'discovery_scene_11',
    name: 'Discovery Scene 11',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_12: {
    id: 'discovery_scene_12',
    name: 'Discovery Scene 12',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.INSPIRATIONAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_13: {
    id: 'discovery_scene_13',
    name: 'Discovery Scene 13',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_14: {
    id: 'discovery_scene_14',
    name: 'Discovery Scene 14',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_15: {
    id: 'discovery_scene_15',
    name: 'Discovery Scene 15',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.INTIMATE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_16: {
    id: 'discovery_scene_16',
    name: 'Discovery Scene 16',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ENERGETIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_17: {
    id: 'discovery_scene_17',
    name: 'Discovery Scene 17',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.GRAND,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_18: {
    id: 'discovery_scene_18',
    name: 'Discovery Scene 18',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SHOCKING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_19: {
    id: 'discovery_scene_19',
    name: 'Discovery Scene 19',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SURREAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_20: {
    id: 'discovery_scene_20',
    name: 'Discovery Scene 20',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_21: {
    id: 'discovery_scene_21',
    name: 'Discovery Scene 21',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.HOPEFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_22: {
    id: 'discovery_scene_22',
    name: 'Discovery Scene 22',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SATISFYING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_23: {
    id: 'discovery_scene_23',
    name: 'Discovery Scene 23',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CONTENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_24: {
    id: 'discovery_scene_24',
    name: 'Discovery Scene 24',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ADVENTUROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_25: {
    id: 'discovery_scene_25',
    name: 'Discovery Scene 25',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.INSPIRATIONAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_26: {
    id: 'discovery_scene_26',
    name: 'Discovery Scene 26',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.WARM,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_27: {
    id: 'discovery_scene_27',
    name: 'Discovery Scene 27',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SHOCKING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_28: {
    id: 'discovery_scene_28',
    name: 'Discovery Scene 28',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ADVENTUROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_29: {
    id: 'discovery_scene_29',
    name: 'Discovery Scene 29',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.REFLECTIVE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  discovery_scene_30: {
    id: 'discovery_scene_30',
    name: 'Discovery Scene 30',
    scene_type: SCENE_TYPES.DISCOVERY,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ADVENTUROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_1: {
    id: 'reveal_scene_1',
    name: 'Reveal Scene 1',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.WARM,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_2: {
    id: 'reveal_scene_2',
    name: 'Reveal Scene 2',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.PEACEFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_3: {
    id: 'reveal_scene_3',
    name: 'Reveal Scene 3',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.AMAZED,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_4: {
    id: 'reveal_scene_4',
    name: 'Reveal Scene 4',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_5: {
    id: 'reveal_scene_5',
    name: 'Reveal Scene 5',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.AWE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_6: {
    id: 'reveal_scene_6',
    name: 'Reveal Scene 6',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_7: {
    id: 'reveal_scene_7',
    name: 'Reveal Scene 7',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_8: {
    id: 'reveal_scene_8',
    name: 'Reveal Scene 8',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_9: {
    id: 'reveal_scene_9',
    name: 'Reveal Scene 9',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_10: {
    id: 'reveal_scene_10',
    name: 'Reveal Scene 10',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROUTINE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_11: {
    id: 'reveal_scene_11',
    name: 'Reveal Scene 11',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.NOSTALGIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_12: {
    id: 'reveal_scene_12',
    name: 'Reveal Scene 12',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.HOPEFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_13: {
    id: 'reveal_scene_13',
    name: 'Reveal Scene 13',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DANGEROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_14: {
    id: 'reveal_scene_14',
    name: 'Reveal Scene 14',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.REFLECTIVE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_15: {
    id: 'reveal_scene_15',
    name: 'Reveal Scene 15',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_16: {
    id: 'reveal_scene_16',
    name: 'Reveal Scene 16',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.REFLECTIVE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_17: {
    id: 'reveal_scene_17',
    name: 'Reveal Scene 17',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.SURREAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_18: {
    id: 'reveal_scene_18',
    name: 'Reveal Scene 18',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NOSTALGIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_19: {
    id: 'reveal_scene_19',
    name: 'Reveal Scene 19',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANGER,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_20: {
    id: 'reveal_scene_20',
    name: 'Reveal Scene 20',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_21: {
    id: 'reveal_scene_21',
    name: 'Reveal Scene 21',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_22: {
    id: 'reveal_scene_22',
    name: 'Reveal Scene 22',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.AWE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_23: {
    id: 'reveal_scene_23',
    name: 'Reveal Scene 23',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.AWE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_24: {
    id: 'reveal_scene_24',
    name: 'Reveal Scene 24',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  reveal_scene_25: {
    id: 'reveal_scene_25',
    name: 'Reveal Scene 25',
    scene_type: SCENE_TYPES.REVEAL,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_1: {
    id: 'investigation_scene_1',
    name: 'Investigation Scene 1',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.PEACEFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_2: {
    id: 'investigation_scene_2',
    name: 'Investigation Scene 2',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.UPLIFTING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_3: {
    id: 'investigation_scene_3',
    name: 'Investigation Scene 3',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DARK,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_4: {
    id: 'investigation_scene_4',
    name: 'Investigation Scene 4',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.BITTERSWEET,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_5: {
    id: 'investigation_scene_5',
    name: 'Investigation Scene 5',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.AWE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_6: {
    id: 'investigation_scene_6',
    name: 'Investigation Scene 6',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_7: {
    id: 'investigation_scene_7',
    name: 'Investigation Scene 7',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CURIOUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_8: {
    id: 'investigation_scene_8',
    name: 'Investigation Scene 8',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.INSPIRATIONAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_9: {
    id: 'investigation_scene_9',
    name: 'Investigation Scene 9',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DANGEROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_10: {
    id: 'investigation_scene_10',
    name: 'Investigation Scene 10',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.HOPEFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_11: {
    id: 'investigation_scene_11',
    name: 'Investigation Scene 11',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CURIOUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_12: {
    id: 'investigation_scene_12',
    name: 'Investigation Scene 12',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_13: {
    id: 'investigation_scene_13',
    name: 'Investigation Scene 13',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SURREAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_14: {
    id: 'investigation_scene_14',
    name: 'Investigation Scene 14',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ADVENTUROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_15: {
    id: 'investigation_scene_15',
    name: 'Investigation Scene 15',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_16: {
    id: 'investigation_scene_16',
    name: 'Investigation Scene 16',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.BITTERSWEET,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_17: {
    id: 'investigation_scene_17',
    name: 'Investigation Scene 17',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.IMMERSIVE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_18: {
    id: 'investigation_scene_18',
    name: 'Investigation Scene 18',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_19: {
    id: 'investigation_scene_19',
    name: 'Investigation Scene 19',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.REFLECTIVE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  investigation_scene_20: {
    id: 'investigation_scene_20',
    name: 'Investigation Scene 20',
    scene_type: SCENE_TYPES.INVESTIGATION,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.PEACEFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_1: {
    id: 'travel_scene_1',
    name: 'Travel Scene 1',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ADVENTUROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_2: {
    id: 'travel_scene_2',
    name: 'Travel Scene 2',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.GRAND,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_3: {
    id: 'travel_scene_3',
    name: 'Travel Scene 3',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ENERGETIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_4: {
    id: 'travel_scene_4',
    name: 'Travel Scene 4',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.FEAR,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_5: {
    id: 'travel_scene_5',
    name: 'Travel Scene 5',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_6: {
    id: 'travel_scene_6',
    name: 'Travel Scene 6',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ROUTINE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_7: {
    id: 'travel_scene_7',
    name: 'Travel Scene 7',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_8: {
    id: 'travel_scene_8',
    name: 'Travel Scene 8',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.INTIMATE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_9: {
    id: 'travel_scene_9',
    name: 'Travel Scene 9',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.BITTERSWEET,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_10: {
    id: 'travel_scene_10',
    name: 'Travel Scene 10',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.INTIMATE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_11: {
    id: 'travel_scene_11',
    name: 'Travel Scene 11',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.UPLIFTING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_12: {
    id: 'travel_scene_12',
    name: 'Travel Scene 12',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.WARM,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_13: {
    id: 'travel_scene_13',
    name: 'Travel Scene 13',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.IMMERSIVE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_14: {
    id: 'travel_scene_14',
    name: 'Travel Scene 14',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CONTENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_15: {
    id: 'travel_scene_15',
    name: 'Travel Scene 15',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ADVENTUROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_16: {
    id: 'travel_scene_16',
    name: 'Travel Scene 16',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NOSTALGIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_17: {
    id: 'travel_scene_17',
    name: 'Travel Scene 17',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DARK,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_18: {
    id: 'travel_scene_18',
    name: 'Travel Scene 18',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.SURPRISE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_19: {
    id: 'travel_scene_19',
    name: 'Travel Scene 19',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_20: {
    id: 'travel_scene_20',
    name: 'Travel Scene 20',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_21: {
    id: 'travel_scene_21',
    name: 'Travel Scene 21',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.SAD,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_22: {
    id: 'travel_scene_22',
    name: 'Travel Scene 22',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_23: {
    id: 'travel_scene_23',
    name: 'Travel Scene 23',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_24: {
    id: 'travel_scene_24',
    name: 'Travel Scene 24',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.INSPIRATIONAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  travel_scene_25: {
    id: 'travel_scene_25',
    name: 'Travel Scene 25',
    scene_type: SCENE_TYPES.JOURNEY,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ENERGETIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_1: {
    id: 'montage_scene_1',
    name: 'Montage Scene 1',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 16,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_2: {
    id: 'montage_scene_2',
    name: 'Montage Scene 2',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.INTIMATE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_3: {
    id: 'montage_scene_3',
    name: 'Montage Scene 3',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.WARM,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_4: {
    id: 'montage_scene_4',
    name: 'Montage Scene 4',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_5: {
    id: 'montage_scene_5',
    name: 'Montage Scene 5',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 15,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.BITTERSWEET,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_6: {
    id: 'montage_scene_6',
    name: 'Montage Scene 6',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DETERMINATION,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_7: {
    id: 'montage_scene_7',
    name: 'Montage Scene 7',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CONFRONTATIONAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_8: {
    id: 'montage_scene_8',
    name: 'Montage Scene 8',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SURREAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_9: {
    id: 'montage_scene_9',
    name: 'Montage Scene 9',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.WARM,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_10: {
    id: 'montage_scene_10',
    name: 'Montage Scene 10',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 16,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CONFRONTATIONAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_11: {
    id: 'montage_scene_11',
    name: 'Montage Scene 11',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANGER,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_12: {
    id: 'montage_scene_12',
    name: 'Montage Scene 12',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ENERGETIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_13: {
    id: 'montage_scene_13',
    name: 'Montage Scene 13',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 18,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ADVENTUROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_14: {
    id: 'montage_scene_14',
    name: 'Montage Scene 14',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.PEACEFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_15: {
    id: 'montage_scene_15',
    name: 'Montage Scene 15',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 16,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TRIUMPHANT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_16: {
    id: 'montage_scene_16',
    name: 'Montage Scene 16',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.UPLIFTING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_17: {
    id: 'montage_scene_17',
    name: 'Montage Scene 17',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 16,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_18: {
    id: 'montage_scene_18',
    name: 'Montage Scene 18',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANGER,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_19: {
    id: 'montage_scene_19',
    name: 'Montage Scene 19',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SAD,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_20: {
    id: 'montage_scene_20',
    name: 'Montage Scene 20',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_21: {
    id: 'montage_scene_21',
    name: 'Montage Scene 21',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.SHOCKING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_22: {
    id: 'montage_scene_22',
    name: 'Montage Scene 22',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.AMAZED,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_23: {
    id: 'montage_scene_23',
    name: 'Montage Scene 23',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 18,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_24: {
    id: 'montage_scene_24',
    name: 'Montage Scene 24',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DETERMINATION,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  montage_scene_25: {
    id: 'montage_scene_25',
    name: 'Montage Scene 25',
    scene_type: SCENE_TYPES.MONTAGE,
    default_duration: 16,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SAD,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_1: {
    id: 'conflict_scene_1',
    name: 'Conflict Scene 1',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.HOPEFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_2: {
    id: 'conflict_scene_2',
    name: 'Conflict Scene 2',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_3: {
    id: 'conflict_scene_3',
    name: 'Conflict Scene 3',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANGER,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_4: {
    id: 'conflict_scene_4',
    name: 'Conflict Scene 4',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 15,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.BITTERSWEET,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_5: {
    id: 'conflict_scene_5',
    name: 'Conflict Scene 5',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SHOCKING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_6: {
    id: 'conflict_scene_6',
    name: 'Conflict Scene 6',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SATISFYING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_7: {
    id: 'conflict_scene_7',
    name: 'Conflict Scene 7',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.HOPEFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_8: {
    id: 'conflict_scene_8',
    name: 'Conflict Scene 8',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONTENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_9: {
    id: 'conflict_scene_9',
    name: 'Conflict Scene 9',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ROUTINE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_10: {
    id: 'conflict_scene_10',
    name: 'Conflict Scene 10',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 16,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_11: {
    id: 'conflict_scene_11',
    name: 'Conflict Scene 11',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.WARM,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_12: {
    id: 'conflict_scene_12',
    name: 'Conflict Scene 12',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.AMAZED,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_13: {
    id: 'conflict_scene_13',
    name: 'Conflict Scene 13',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 19,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.TRIUMPHANT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_14: {
    id: 'conflict_scene_14',
    name: 'Conflict Scene 14',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 18,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ADVENTUROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_15: {
    id: 'conflict_scene_15',
    name: 'Conflict Scene 15',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 17,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ADVENTUROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_16: {
    id: 'conflict_scene_16',
    name: 'Conflict Scene 16',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.UPLIFTING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_17: {
    id: 'conflict_scene_17',
    name: 'Conflict Scene 17',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_18: {
    id: 'conflict_scene_18',
    name: 'Conflict Scene 18',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROUTINE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_19: {
    id: 'conflict_scene_19',
    name: 'Conflict Scene 19',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 17,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.INSPIRATIONAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_20: {
    id: 'conflict_scene_20',
    name: 'Conflict Scene 20',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.SAD,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_21: {
    id: 'conflict_scene_21',
    name: 'Conflict Scene 21',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DETERMINATION,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_22: {
    id: 'conflict_scene_22',
    name: 'Conflict Scene 22',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 18,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROUTINE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_23: {
    id: 'conflict_scene_23',
    name: 'Conflict Scene 23',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.PEACEFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_24: {
    id: 'conflict_scene_24',
    name: 'Conflict Scene 24',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONFRONTATIONAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  conflict_scene_25: {
    id: 'conflict_scene_25',
    name: 'Conflict Scene 25',
    scene_type: SCENE_TYPES.CONFLICT,
    default_duration: 15,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.IMMERSIVE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  chase_scene_1: {
    id: 'chase_scene_1',
    name: 'Chase Scene 1',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_2: {
    id: 'chase_scene_2',
    name: 'Chase Scene 2',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DARK,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_3: {
    id: 'chase_scene_3',
    name: 'Chase Scene 3',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 20,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.NOSTALGIC,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_4: {
    id: 'chase_scene_4',
    name: 'Chase Scene 4',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 23,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_5: {
    id: 'chase_scene_5',
    name: 'Chase Scene 5',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 18,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONFRONTATIONAL,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_6: {
    id: 'chase_scene_6',
    name: 'Chase Scene 6',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 17,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.PEACEFUL,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_7: {
    id: 'chase_scene_7',
    name: 'Chase Scene 7',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 20,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.GRAND,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_8: {
    id: 'chase_scene_8',
    name: 'Chase Scene 8',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 15,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_9: {
    id: 'chase_scene_9',
    name: 'Chase Scene 9',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 23,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_10: {
    id: 'chase_scene_10',
    name: 'Chase Scene 10',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 17,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_11: {
    id: 'chase_scene_11',
    name: 'Chase Scene 11',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 17,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_12: {
    id: 'chase_scene_12',
    name: 'Chase Scene 12',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 15,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.PEACEFUL,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_13: {
    id: 'chase_scene_13',
    name: 'Chase Scene 13',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 24,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_14: {
    id: 'chase_scene_14',
    name: 'Chase Scene 14',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 18,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.HOPEFUL,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_15: {
    id: 'chase_scene_15',
    name: 'Chase Scene 15',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 16,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.GRAND,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_16: {
    id: 'chase_scene_16',
    name: 'Chase Scene 16',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.TRIUMPHANT,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_17: {
    id: 'chase_scene_17',
    name: 'Chase Scene 17',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.UPLIFTING,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_18: {
    id: 'chase_scene_18',
    name: 'Chase Scene 18',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.TRIUMPHANT,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_19: {
    id: 'chase_scene_19',
    name: 'Chase Scene 19',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 23,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  chase_scene_20: {
    id: 'chase_scene_20',
    name: 'Chase Scene 20',
    scene_type: SCENE_TYPES.CHASE,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ADVENTUROUS,
    compatible_genres: ["action","thriller"],
    intensity: 0.5,

  },

  suspense_scene_1: {
    id: 'suspense_scene_1',
    name: 'Suspense Scene 1',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_2: {
    id: 'suspense_scene_2',
    name: 'Suspense Scene 2',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.SAD,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_3: {
    id: 'suspense_scene_3',
    name: 'Suspense Scene 3',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.AMAZED,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_4: {
    id: 'suspense_scene_4',
    name: 'Suspense Scene 4',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SURREAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_5: {
    id: 'suspense_scene_5',
    name: 'Suspense Scene 5',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROUTINE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_6: {
    id: 'suspense_scene_6',
    name: 'Suspense Scene 6',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_7: {
    id: 'suspense_scene_7',
    name: 'Suspense Scene 7',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.UPLIFTING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_8: {
    id: 'suspense_scene_8',
    name: 'Suspense Scene 8',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_9: {
    id: 'suspense_scene_9',
    name: 'Suspense Scene 9',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROUTINE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_10: {
    id: 'suspense_scene_10',
    name: 'Suspense Scene 10',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.TRIUMPHANT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_11: {
    id: 'suspense_scene_11',
    name: 'Suspense Scene 11',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.INTIMATE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_12: {
    id: 'suspense_scene_12',
    name: 'Suspense Scene 12',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.GRAND,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_13: {
    id: 'suspense_scene_13',
    name: 'Suspense Scene 13',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANGER,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_14: {
    id: 'suspense_scene_14',
    name: 'Suspense Scene 14',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_15: {
    id: 'suspense_scene_15',
    name: 'Suspense Scene 15',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DANGEROUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_16: {
    id: 'suspense_scene_16',
    name: 'Suspense Scene 16',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.FEAR,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_17: {
    id: 'suspense_scene_17',
    name: 'Suspense Scene 17',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CONTENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_18: {
    id: 'suspense_scene_18',
    name: 'Suspense Scene 18',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SATISFYING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_19: {
    id: 'suspense_scene_19',
    name: 'Suspense Scene 19',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SURPRISE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  suspense_scene_20: {
    id: 'suspense_scene_20',
    name: 'Suspense Scene 20',
    scene_type: SCENE_TYPES.SUSPENSE,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SATISFYING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  horror_scene_1: {
    id: 'horror_scene_1',
    name: 'Horror Scene 1',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_2: {
    id: 'horror_scene_2',
    name: 'Horror Scene 2',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_3: {
    id: 'horror_scene_3',
    name: 'Horror Scene 3',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.IMMERSIVE,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_4: {
    id: 'horror_scene_4',
    name: 'Horror Scene 4',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_5: {
    id: 'horror_scene_5',
    name: 'Horror Scene 5',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DARK,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_6: {
    id: 'horror_scene_6',
    name: 'Horror Scene 6',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.UPLIFTING,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_7: {
    id: 'horror_scene_7',
    name: 'Horror Scene 7',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.REFLECTIVE,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_8: {
    id: 'horror_scene_8',
    name: 'Horror Scene 8',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.AWE,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_9: {
    id: 'horror_scene_9',
    name: 'Horror Scene 9',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_10: {
    id: 'horror_scene_10',
    name: 'Horror Scene 10',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CURIOUS,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_11: {
    id: 'horror_scene_11',
    name: 'Horror Scene 11',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_12: {
    id: 'horror_scene_12',
    name: 'Horror Scene 12',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_13: {
    id: 'horror_scene_13',
    name: 'Horror Scene 13',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_14: {
    id: 'horror_scene_14',
    name: 'Horror Scene 14',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CONTENT,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_15: {
    id: 'horror_scene_15',
    name: 'Horror Scene 15',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.INSPIRATIONAL,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_16: {
    id: 'horror_scene_16',
    name: 'Horror Scene 16',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.WARM,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_17: {
    id: 'horror_scene_17',
    name: 'Horror Scene 17',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.REFLECTIVE,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_18: {
    id: 'horror_scene_18',
    name: 'Horror Scene 18',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CURIOUS,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_19: {
    id: 'horror_scene_19',
    name: 'Horror Scene 19',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.HOPEFUL,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  horror_scene_20: {
    id: 'horror_scene_20',
    name: 'Horror Scene 20',
    scene_type: SCENE_TYPES.HORROR,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["horror","thriller"],
    intensity: 0.5,

  },

  romance_scene_1: {
    id: 'romance_scene_1',
    name: 'Romance Scene 1',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_2: {
    id: 'romance_scene_2',
    name: 'Romance Scene 2',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.SURPRISE,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_3: {
    id: 'romance_scene_3',
    name: 'Romance Scene 3',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.HOPEFUL,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_4: {
    id: 'romance_scene_4',
    name: 'Romance Scene 4',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_5: {
    id: 'romance_scene_5',
    name: 'Romance Scene 5',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SURREAL,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_6: {
    id: 'romance_scene_6',
    name: 'Romance Scene 6',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.INTIMATE,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_7: {
    id: 'romance_scene_7',
    name: 'Romance Scene 7',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANGER,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_8: {
    id: 'romance_scene_8',
    name: 'Romance Scene 8',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.IMMERSIVE,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_9: {
    id: 'romance_scene_9',
    name: 'Romance Scene 9',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NOSTALGIC,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_10: {
    id: 'romance_scene_10',
    name: 'Romance Scene 10',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CONFRONTATIONAL,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_11: {
    id: 'romance_scene_11',
    name: 'Romance Scene 11',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_12: {
    id: 'romance_scene_12',
    name: 'Romance Scene 12',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ROUTINE,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_13: {
    id: 'romance_scene_13',
    name: 'Romance Scene 13',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.IMMERSIVE,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_14: {
    id: 'romance_scene_14',
    name: 'Romance Scene 14',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NOSTALGIC,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_15: {
    id: 'romance_scene_15',
    name: 'Romance Scene 15',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DARK,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_16: {
    id: 'romance_scene_16',
    name: 'Romance Scene 16',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CONFRONTATIONAL,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_17: {
    id: 'romance_scene_17',
    name: 'Romance Scene 17',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_18: {
    id: 'romance_scene_18',
    name: 'Romance Scene 18',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.FEAR,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_19: {
    id: 'romance_scene_19',
    name: 'Romance Scene 19',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ROUTINE,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_20: {
    id: 'romance_scene_20',
    name: 'Romance Scene 20',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DARK,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_21: {
    id: 'romance_scene_21',
    name: 'Romance Scene 21',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_22: {
    id: 'romance_scene_22',
    name: 'Romance Scene 22',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SURPRISE,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_23: {
    id: 'romance_scene_23',
    name: 'Romance Scene 23',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DETERMINATION,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_24: {
    id: 'romance_scene_24',
    name: 'Romance Scene 24',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  romance_scene_25: {
    id: 'romance_scene_25',
    name: 'Romance Scene 25',
    scene_type: SCENE_TYPES.EMOTIONAL,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ADVENTUROUS,
    compatible_genres: ["romance","drama"],
    intensity: 0.5,

  },

  flashback_scene_1: {
    id: 'flashback_scene_1',
    name: 'Flashback Scene 1',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_2: {
    id: 'flashback_scene_2',
    name: 'Flashback Scene 2',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_3: {
    id: 'flashback_scene_3',
    name: 'Flashback Scene 3',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONFRONTATIONAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_4: {
    id: 'flashback_scene_4',
    name: 'Flashback Scene 4',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_5: {
    id: 'flashback_scene_5',
    name: 'Flashback Scene 5',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CURIOUS,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_6: {
    id: 'flashback_scene_6',
    name: 'Flashback Scene 6',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SAD,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_7: {
    id: 'flashback_scene_7',
    name: 'Flashback Scene 7',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.BITTERSWEET,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_8: {
    id: 'flashback_scene_8',
    name: 'Flashback Scene 8',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ENERGETIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_9: {
    id: 'flashback_scene_9',
    name: 'Flashback Scene 9',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.UPLIFTING,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_10: {
    id: 'flashback_scene_10',
    name: 'Flashback Scene 10',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SURREAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_11: {
    id: 'flashback_scene_11',
    name: 'Flashback Scene 11',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROUTINE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_12: {
    id: 'flashback_scene_12',
    name: 'Flashback Scene 12',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_13: {
    id: 'flashback_scene_13',
    name: 'Flashback Scene 13',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_14: {
    id: 'flashback_scene_14',
    name: 'Flashback Scene 14',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.TRIUMPHANT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_15: {
    id: 'flashback_scene_15',
    name: 'Flashback Scene 15',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.IMMERSIVE,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_16: {
    id: 'flashback_scene_16',
    name: 'Flashback Scene 16',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.WARM,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_17: {
    id: 'flashback_scene_17',
    name: 'Flashback Scene 17',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.NOSTALGIC,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_18: {
    id: 'flashback_scene_18',
    name: 'Flashback Scene 18',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.FEAR,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_19: {
    id: 'flashback_scene_19',
    name: 'Flashback Scene 19',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DETERMINATION,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  flashback_scene_20: {
    id: 'flashback_scene_20',
    name: 'Flashback Scene 20',
    scene_type: SCENE_TYPES.FLASHBACK,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ["all"],
    intensity: 0.5,

  },

  technology_scene_1: {
    id: 'technology_scene_1',
    name: 'Technology Scene 1',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_2: {
    id: 'technology_scene_2',
    name: 'Technology Scene 2',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.REFLECTIVE,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_3: {
    id: 'technology_scene_3',
    name: 'Technology Scene 3',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CONTENT,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_4: {
    id: 'technology_scene_4',
    name: 'Technology Scene 4',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SURPRISE,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_5: {
    id: 'technology_scene_5',
    name: 'Technology Scene 5',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_6: {
    id: 'technology_scene_6',
    name: 'Technology Scene 6',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANGER,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_7: {
    id: 'technology_scene_7',
    name: 'Technology Scene 7',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DANGEROUS,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_8: {
    id: 'technology_scene_8',
    name: 'Technology Scene 8',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_9: {
    id: 'technology_scene_9',
    name: 'Technology Scene 9',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.HOPEFUL,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_10: {
    id: 'technology_scene_10',
    name: 'Technology Scene 10',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DANGEROUS,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_11: {
    id: 'technology_scene_11',
    name: 'Technology Scene 11',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.SHOCKING,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_12: {
    id: 'technology_scene_12',
    name: 'Technology Scene 12',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.UPLIFTING,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_13: {
    id: 'technology_scene_13',
    name: 'Technology Scene 13',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_14: {
    id: 'technology_scene_14',
    name: 'Technology Scene 14',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROUTINE,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_15: {
    id: 'technology_scene_15',
    name: 'Technology Scene 15',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CONTENT,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_16: {
    id: 'technology_scene_16',
    name: 'Technology Scene 16',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.AWE,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_17: {
    id: 'technology_scene_17',
    name: 'Technology Scene 17',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ENERGETIC,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_18: {
    id: 'technology_scene_18',
    name: 'Technology Scene 18',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NEUTRAL,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_19: {
    id: 'technology_scene_19',
    name: 'Technology Scene 19',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANGER,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  technology_scene_20: {
    id: 'technology_scene_20',
    name: 'Technology Scene 20',
    scene_type: SCENE_TYPES.TECHNOLOGY,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.JOYFUL,
    compatible_genres: ["tech","business"],
    intensity: 0.5,

  },

  business_scene_1: {
    id: 'business_scene_1',
    name: 'Business Scene 1',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONFRONTATIONAL,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_2: {
    id: 'business_scene_2',
    name: 'Business Scene 2',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_3: {
    id: 'business_scene_3',
    name: 'Business Scene 3',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_4: {
    id: 'business_scene_4',
    name: 'Business Scene 4',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_5: {
    id: 'business_scene_5',
    name: 'Business Scene 5',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.GRAND,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_6: {
    id: 'business_scene_6',
    name: 'Business Scene 6',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_7: {
    id: 'business_scene_7',
    name: 'Business Scene 7',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_8: {
    id: 'business_scene_8',
    name: 'Business Scene 8',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ENERGETIC,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_9: {
    id: 'business_scene_9',
    name: 'Business Scene 9',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_10: {
    id: 'business_scene_10',
    name: 'Business Scene 10',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_11: {
    id: 'business_scene_11',
    name: 'Business Scene 11',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_12: {
    id: 'business_scene_12',
    name: 'Business Scene 12',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.NOSTALGIC,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_13: {
    id: 'business_scene_13',
    name: 'Business Scene 13',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SATISFYING,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_14: {
    id: 'business_scene_14',
    name: 'Business Scene 14',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DARK,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_15: {
    id: 'business_scene_15',
    name: 'Business Scene 15',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DANGEROUS,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_16: {
    id: 'business_scene_16',
    name: 'Business Scene 16',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_17: {
    id: 'business_scene_17',
    name: 'Business Scene 17',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_18: {
    id: 'business_scene_18',
    name: 'Business Scene 18',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.GRAND,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_19: {
    id: 'business_scene_19',
    name: 'Business Scene 19',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_20: {
    id: 'business_scene_20',
    name: 'Business Scene 20',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ENERGETIC,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_21: {
    id: 'business_scene_21',
    name: 'Business Scene 21',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.AMAZED,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_22: {
    id: 'business_scene_22',
    name: 'Business Scene 22',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 13,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SATISFYING,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_23: {
    id: 'business_scene_23',
    name: 'Business Scene 23',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DETERMINATION,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_24: {
    id: 'business_scene_24',
    name: 'Business Scene 24',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CURIOUS,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  business_scene_25: {
    id: 'business_scene_25',
    name: 'Business Scene 25',
    scene_type: SCENE_TYPES.DEMONSTRATION,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["business","corporate"],
    intensity: 0.5,

  },

  commercial_scene_1: {
    id: 'commercial_scene_1',
    name: 'Commercial Scene 1',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DANGEROUS,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_2: {
    id: 'commercial_scene_2',
    name: 'Commercial Scene 2',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONFRONTATIONAL,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_3: {
    id: 'commercial_scene_3',
    name: 'Commercial Scene 3',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ADVENTUROUS,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_4: {
    id: 'commercial_scene_4',
    name: 'Commercial Scene 4',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.CONTENT,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_5: {
    id: 'commercial_scene_5',
    name: 'Commercial Scene 5',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.FEAR,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_6: {
    id: 'commercial_scene_6',
    name: 'Commercial Scene 6',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.FEAR,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_7: {
    id: 'commercial_scene_7',
    name: 'Commercial Scene 7',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SHOCKING,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_8: {
    id: 'commercial_scene_8',
    name: 'Commercial Scene 8',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROUTINE,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_9: {
    id: 'commercial_scene_9',
    name: 'Commercial Scene 9',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_10: {
    id: 'commercial_scene_10',
    name: 'Commercial Scene 10',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SAD,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_11: {
    id: 'commercial_scene_11',
    name: 'Commercial Scene 11',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANGER,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_12: {
    id: 'commercial_scene_12',
    name: 'Commercial Scene 12',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_13: {
    id: 'commercial_scene_13',
    name: 'Commercial Scene 13',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_14: {
    id: 'commercial_scene_14',
    name: 'Commercial Scene 14',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.INSPIRATIONAL,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_15: {
    id: 'commercial_scene_15',
    name: 'Commercial Scene 15',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DANGEROUS,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_16: {
    id: 'commercial_scene_16',
    name: 'Commercial Scene 16',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_17: {
    id: 'commercial_scene_17',
    name: 'Commercial Scene 17',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_18: {
    id: 'commercial_scene_18',
    name: 'Commercial Scene 18',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_19: {
    id: 'commercial_scene_19',
    name: 'Commercial Scene 19',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_20: {
    id: 'commercial_scene_20',
    name: 'Commercial Scene 20',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DARK,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_21: {
    id: 'commercial_scene_21',
    name: 'Commercial Scene 21',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONFRONTATIONAL,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_22: {
    id: 'commercial_scene_22',
    name: 'Commercial Scene 22',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.DARK,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_23: {
    id: 'commercial_scene_23',
    name: 'Commercial Scene 23',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.BITTERSWEET,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_24: {
    id: 'commercial_scene_24',
    name: 'Commercial Scene 24',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_25: {
    id: 'commercial_scene_25',
    name: 'Commercial Scene 25',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.IMMERSIVE,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_26: {
    id: 'commercial_scene_26',
    name: 'Commercial Scene 26',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ADVENTUROUS,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_27: {
    id: 'commercial_scene_27',
    name: 'Commercial Scene 27',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.CONTENT,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_28: {
    id: 'commercial_scene_28',
    name: 'Commercial Scene 28',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_29: {
    id: 'commercial_scene_29',
    name: 'Commercial Scene 29',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 10,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.INSPIRATIONAL,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  commercial_scene_30: {
    id: 'commercial_scene_30',
    name: 'Commercial Scene 30',
    scene_type: SCENE_TYPES.PRODUCT,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.WARM,
    compatible_genres: ["commercial","all"],
    intensity: 0.5,

  },

  social_scene_1: {
    id: 'social_scene_1',
    name: 'Social Scene 1',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.IMMERSIVE,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_2: {
    id: 'social_scene_2',
    name: 'Social Scene 2',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NOSTALGIC,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_3: {
    id: 'social_scene_3',
    name: 'Social Scene 3',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SURPRISE,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_4: {
    id: 'social_scene_4',
    name: 'Social Scene 4',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.EPIC,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_5: {
    id: 'social_scene_5',
    name: 'Social Scene 5',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_6: {
    id: 'social_scene_6',
    name: 'Social Scene 6',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NOSTALGIC,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_7: {
    id: 'social_scene_7',
    name: 'Social Scene 7',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.UPLIFTING,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_8: {
    id: 'social_scene_8',
    name: 'Social Scene 8',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TRIUMPHANT,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_9: {
    id: 'social_scene_9',
    name: 'Social Scene 9',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TRIUMPHANT,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_10: {
    id: 'social_scene_10',
    name: 'Social Scene 10',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.REFLECTIVE,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_11: {
    id: 'social_scene_11',
    name: 'Social Scene 11',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 5,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.NOSTALGIC,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_12: {
    id: 'social_scene_12',
    name: 'Social Scene 12',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DARK,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_13: {
    id: 'social_scene_13',
    name: 'Social Scene 13',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_14: {
    id: 'social_scene_14',
    name: 'Social Scene 14',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_15: {
    id: 'social_scene_15',
    name: 'Social Scene 15',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_16: {
    id: 'social_scene_16',
    name: 'Social Scene 16',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.FEAR,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_17: {
    id: 'social_scene_17',
    name: 'Social Scene 17',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 6,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANALYTICAL,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_18: {
    id: 'social_scene_18',
    name: 'Social Scene 18',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.INTIMATE,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_19: {
    id: 'social_scene_19',
    name: 'Social Scene 19',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_20: {
    id: 'social_scene_20',
    name: 'Social Scene 20',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SURREAL,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_21: {
    id: 'social_scene_21',
    name: 'Social Scene 21',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 8,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.MYSTERIOUS,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_22: {
    id: 'social_scene_22',
    name: 'Social Scene 22',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.IMMERSIVE,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_23: {
    id: 'social_scene_23',
    name: 'Social Scene 23',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 7,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.INTIMATE,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_24: {
    id: 'social_scene_24',
    name: 'Social Scene 24',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 9,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.GRAND,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  social_scene_25: {
    id: 'social_scene_25',
    name: 'Social Scene 25',
    scene_type: SCENE_TYPES.EXPLAINER,
    default_duration: 4,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.TENSE,
    compatible_genres: ["social","marketing"],
    intensity: 0.5,

  },

  documentary_scene_1: {
    id: 'documentary_scene_1',
    name: 'Documentary Scene 1',
    scene_type: SCENE_TYPES.DOCUMENTARY,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROMANTIC,
    compatible_genres: ["documentary","all"],
    intensity: 0.5,

  },

  documentary_scene_2: {
    id: 'documentary_scene_2',
    name: 'Documentary Scene 2',
    scene_type: SCENE_TYPES.DOCUMENTARY,
    default_duration: 18,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.AWE,
    compatible_genres: ["documentary","all"],
    intensity: 0.5,

  },

  documentary_scene_3: {
    id: 'documentary_scene_3',
    name: 'Documentary Scene 3',
    scene_type: SCENE_TYPES.DOCUMENTARY,
    default_duration: 19,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ROUTINE,
    compatible_genres: ["documentary","all"],
    intensity: 0.5,

  },

  documentary_scene_4: {
    id: 'documentary_scene_4',
    name: 'Documentary Scene 4',
    scene_type: SCENE_TYPES.DOCUMENTARY,
    default_duration: 14,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.ANTICIPATORY,
    compatible_genres: ["documentary","all"],
    intensity: 0.5,

  },

  documentary_scene_5: {
    id: 'documentary_scene_5',
    name: 'Documentary Scene 5',
    scene_type: SCENE_TYPES.DOCUMENTARY,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.BITTERSWEET,
    compatible_genres: ["documentary","all"],
    intensity: 0.5,

  },

  documentary_scene_6: {
    id: 'documentary_scene_6',
    name: 'Documentary Scene 6',
    scene_type: SCENE_TYPES.DOCUMENTARY,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.DRAMATIC,
    compatible_genres: ["documentary","all"],
    intensity: 0.5,

  },

  documentary_scene_7: {
    id: 'documentary_scene_7',
    name: 'Documentary Scene 7',
    scene_type: SCENE_TYPES.DOCUMENTARY,
    default_duration: 19,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.GRAND,
    compatible_genres: ["documentary","all"],
    intensity: 0.5,

  },

  documentary_scene_8: {
    id: 'documentary_scene_8',
    name: 'Documentary Scene 8',
    scene_type: SCENE_TYPES.DOCUMENTARY,
    default_duration: 19,
    shot_sequence: [
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'setup', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'reaction', duration: 2 },
      { shot_type: SHOT_TYPES.EXTREME_CLOSE_UP, purpose: 'peak', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.SURREAL,
    compatible_genres: ["documentary","all"],
    intensity: 0.5,

  },

  documentary_scene_9: {
    id: 'documentary_scene_9',
    name: 'Documentary Scene 9',
    scene_type: SCENE_TYPES.DOCUMENTARY,
    default_duration: 11,
    shot_sequence: [
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'face', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'body', duration: 2 },
      { shot_type: SHOT_TYPES.WIDE, purpose: 'environment', duration: 2 }
    ],
    emotion: EMOTIONAL_TONES.URGENT,
    compatible_genres: ["documentary","all"],
    intensity: 0.5,

  },

  documentary_scene_10: {
    id: 'documentary_scene_10',
    name: 'Documentary Scene 10',
    scene_type: SCENE_TYPES.DOCUMENTARY,
    default_duration: 12,
    shot_sequence: [
      { shot_type: SHOT_TYPES.WIDE, purpose: 'context', duration: 2 },
      { shot_type: SHOT_TYPES.MEDIUM, purpose: 'build', duration: 2 },
      { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emotion', duration: 3 }
    ],
    emotion: EMOTIONAL_TONES.ANGER,
    compatible_genres: ["documentary","all"],
    intensity: 0.5,

  },
};

// ============================================
// SCENE TEMPLATE REGISTRY
// ============================================

export class SceneTemplateRegistry {
  constructor() {
    this.templates = new Map(Object.entries(SCENE_TEMPLATES));
  }

  get(id) {
    return this.templates.get(id);
  }

  getAll() {
    return Array.from(this.templates.values());
  }

  getByType(sceneType) {
    return this.getAll().filter(t => t.scene_type === sceneType);
  }

  getByEmotion(emotion) {
    return this.getAll().filter(t => t.emotion === emotion);
  }

  getByGenre(genre) {
    return this.getAll().filter(t =>
      t.compatible_genres.includes('all') || t.compatible_genres.includes(genre)
    );
  }

  getByDuration(maxDuration) {
    return this.getAll().filter(t => t.default_duration <= maxDuration);
  }

  register(template) {
    this.templates.set(template.id, template);
  }
}

export const sceneTemplateRegistry = new SceneTemplateRegistry();
