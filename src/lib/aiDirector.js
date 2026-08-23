/**
 * AI DIRECTOR PIPELINE
 *
 * High-level pipeline that takes a script/synopsis and automatically
 * generates a complete scene/shot plan.
 */

import {
  SCENE_TYPES,
  SHOT_TYPES,
  CAMERA_MOVEMENTS,
  EMOTIONAL_TONES,
  LIGHTING_STYLES,
  TRANSITION_TYPES,
  sceneTemplateRegistry,
  createEmptyScene,
  createEmptyShot,
  createEmptyCharacter,
  createEmptyEnvironment
} from './sceneSchema.js';

import { selectScenes } from './sceneSelector.js';

import { ContinuityEngine } from './continuityEngine.js';

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xffffffff;
    return (this.seed >>> 0) / 0xffffffff;
  }

  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick(arr) {
    return arr[this.int(0, arr.length - 1)];
  }

  shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function extractKeywords(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);
}

const PREMISE_BEAT_PATTERNS = [
  { keywords: ['introduce', 'meet', 'first', 'new'], beat: 'introduction', sceneType: SCENE_TYPES.CHARACTER_INTRODUCTION },
  { keywords: ['confront', 'fight', 'battle', 'challenge'], beat: 'conflict', sceneType: SCENE_TYPES.CONFRONTATION },
  { keywords: ['discover', 'find', 'reveal', 'secret'], beat: 'discovery', sceneType: SCENE_TYPES.DISCOVERY },
  { keywords: ['journey', 'travel', 'quest', 'adventure'], beat: 'journey', sceneType: SCENE_TYPES.JOURNEY },
  { keywords: ['transform', 'change', 'become', 'evolve'], beat: 'transformation', sceneType: SCENE_TYPES.TRANSFORMATION },
  { keywords: ['climax', 'final', 'ultimate', 'showdown'], beat: 'climax', sceneType: SCENE_TYPES.CLIMAX },
  { keywords: ['resolution', 'ending', 'conclusion', 'resolve'], beat: 'resolution', sceneType: SCENE_TYPES.RESOLUTION },
  { keywords: ['call', 'begin', 'start', 'spark'], beat: 'inciting', sceneType: SCENE_TYPES.INCITING_EVENT }
];

const NICHE_TEMPLATE_MAP = {
  action: ['cold_open_action', 'chase_foot', 'climax_heroic', 'resolution_happy'],
  thriller: ['cold_open_mystery', 'suspense_countdown', 'reveal_slow', 'resolution_emotional'],
  drama: ['character_intro_hero', 'conflict_verbal', 'emotional_goodbye', 'resolution_emotional'],
  romance: ['romance_first_meeting', 'emotional_reunion', 'emotional_goodbye', 'resolution_happy'],
  horror: ['horror_darkness', 'pov_first_person', 'suspense_countdown', 'resolution_emotional'],
  commercial: ['product_hero_reveal', 'product_in_use', 'cta_direct', 'end_card_fade'],
  documentary: ['documentary_interview', 'establishing_wide', 'broll_atmospheric', 'resolution_happy'],
  business: ['montage_business_growth', 'technology_interface', 'testimonial_customer', 'cta_logo'],
  'corporate': ['technology_interface', 'testimonial_customer', 'montage_business_growth', 'end_card_fade'],
  adventure: ['establishing_wide', 'journey_road', 'discovery_location', 'climax_heroic'],
  comedy: ['social_hook', 'dialogue_two_shot', 'montage_transformation', 'resolution_happy'],
  social: ['social_hook', 'hook_visual_shock', 'cta_direct', 'end_card_fade']
};

const ENVIRONMENT_TYPES = {
  interior: ['modern office', 'cozy home', 'industrial warehouse', 'luxury hotel', 'cafe', 'laboratory', 'urban apartment'],
  exterior: ['city street', 'forest', 'beach', 'mountain', 'desert', 'rooftop', 'park', 'highway'],
  abstract: ['minimalist studio', 'gradient void', 'particle space', 'color field']
};

const EMOTIONAL_TONE_SEQUENCES = {
  action: [EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.URGENT, EMOTIONAL_TONES.EPIC, EMOTIONAL_TONES.TRIUMPHANT],
  thriller: [EMOTIONAL_TONES.MYSTERIOUS, EMOTIONAL_TONES.SUSPENSEFUL, EMOTIONAL_TONES.DARK, EMOTIONAL_TONES.TENSE],
  drama: [EMOTIONAL_TONES.NEUTRAL, EMOTIONAL_TONES.SAD, EMOTIONAL_TONES.HOPEFUL, EMOTIONAL_TONES.JOYFUL],
  romance: [EMOTIONAL_TONES.ROMANTIC, EMOTIONAL_TONES.JOYFUL, EMOTIONAL_TONES.HOPEFUL, EMOTIONAL_TONES.SAD],
  horror: [EMOTIONAL_TONES.DARK, EMOTIONAL_TONES.SUSPENSEFUL, EMOTIONAL_TONES.DARK, EMOTIONAL_TONES.URGENT],
  commercial: [EMOTIONAL_TONES.NEUTRAL, EMOTIONAL_TONES.JOYFUL, EMOTIONAL_TONES.EPIC, EMOTIONAL_TONES.URGENT],
  documentary: [EMOTIONAL_TONES.NEUTRAL, EMOTIONAL_TONES.CURIOUS, EMOTIONAL_TONES.NEUTRAL, EMOTIONAL_TONES.HOPEFUL],
  business: [EMOTIONAL_TONES.NEUTRAL, EMOTIONAL_TONES.CURIOUS, EMOTIONAL_TONES.INSPIRATIONAL, EMOTIONAL_TONES.URGENT],
  adventure: [EMOTIONAL_TONES.HOPEFUL, EMOTIONAL_TONES.CURIOUS, EMOTIONAL_TONES.EPIC, EMOTIONAL_TONES.TRIUMPHANT],
  comedy: [EMOTIONAL_TONES.JOYFUL, EMOTIONAL_TONES.NEUTRAL, EMOTIONAL_TONES.JOYFUL, EMOTIONAL_TONES.TRIUMPHANT]
};

class ScriptAnalyzer {
  analyze(inputs) {
    const { premise = '', niche = '', template = '', aspectRatio = '16:9' } = inputs;
    const seed = hashString(`${premise}|${niche}|${template}`);
    const rng = new SeededRandom(seed);

    const premiseLower = premise.toLowerCase();
    const nicheLower = (niche || '').toLowerCase();

    const storyBeats = [];
    const beatKeywords = extractKeywords(premise);

    for (const pattern of PREMISE_BEAT_PATTERNS) {
      const matched = pattern.keywords.some(kw => premiseLower.includes(kw));
      if (matched) {
        storyBeats.push({
          type: pattern.beat,
          sceneType: pattern.sceneType,
          keywords: pattern.keywords
        });
      }
    }

    if (storyBeats.length === 0) {
      storyBeats.push(
        { type: 'introduction', sceneType: SCENE_TYPES.CHARACTER_INTRODUCTION, keywords: [] },
        { type: 'development', sceneType: SCENE_TYPES.DISCOVERY, keywords: [] },
        { type: 'climax', sceneType: SCENE_TYPES.CLIMAX, keywords: [] },
        { type: 'resolution', sceneType: SCENE_TYPES.RESOLUTION, keywords: [] }
      );
    }

    const characters = this._extractCharacters(premise, niche, rng);
    const keyMoments = this._extractKeyMoments(storyBeats, premise, rng);

    const matchedNiche = Object.keys(NICHE_TEMPLATE_MAP).find(
      n => nicheLower.includes(n)
    ) || nicheLower || 'general';

    return {
      seed,
      rng,
      premise,
      niche: matchedNiche,
      template,
      aspectRatio,
      storyBeats,
      characters,
      keyMoments,
      matchedNiche
    };
  }

  _extractCharacters(premise, niche, rng) {
    const characters = [];
    const namePool = ['Alex', 'Jordan', 'Morgan', 'Taylor', 'Casey', 'Riley', 'Quinn', 'Avery'];
    const rolePool = ['protagonist', 'supporting', 'antagonist', 'guide', 'mentor'];
    const shuffledNames = rng.shuffle(namePool);
    const shuffledRoles = rng.shuffle(rolePool);

    const count = rng.int(2, 4);
    const seenRoles = new Set();

    for (let i = 0; i < count; i++) {
      const roleIdx = i < shuffledRoles.length ? i : 0;
      let role = shuffledRoles[roleIdx] || 'supporting';
      while (seenRoles.has(role) && seenRoles.size < rolePool.length) {
        role = rng.pick(rolePool);
      }
      seenRoles.add(role);

      characters.push(createEmptyCharacter({
        name: shuffledNames[i % shuffledNames.length],
        role,
        identity: {
          age: rng.int(22, 55),
          gender: rng.pick(['male', 'female', 'non-binary']),
          ethnicity: rng.pick(['caucasian', 'asian', 'black', 'hispanic', 'mixed']),
          occupation: rng.pick(['professional', 'student', 'artist', 'executive', 'entrepreneur', 'engineer'])
        },
        appearance: {
          height: rng.pick(['average', 'tall', 'short']),
          build: rng.pick(['athletic', 'average', 'slim']),
          hair: rng.pick(['short', 'medium', 'long', 'bald']),
          eyes: rng.pick(['brown', 'blue', 'green', 'hazel']),
          skin: rng.pick(['light', 'medium', 'dark']),
          facial_hair: rng.pick(['none', 'stubble', 'beard', 'mustache'])
        },
        personality: rng.pick(['determined', 'curious', 'resilient', 'empathetic', 'ambitious', 'cautious'], 2),
        emotional_state: rng.pick(['neutral', 'determined', 'anxious', 'hopeful', 'focused']),
        continuity_rules: ['maintain_same_face', 'maintain_same_wardrobe', 'maintain_same_hair', 'maintain_consistent_lighting']
      }));
    }

    return characters;
  }

  _extractKeyMoments(storyBeats, premise, rng) {
    return storyBeats.map((beat, idx) => ({
      order: idx + 1,
      type: beat.type,
      description: `${beat.type.charAt(0).toUpperCase() + beat.type.slice(1)} moment in the narrative`,
      importance: idx === 0 ? 'high' : idx === storyBeats.length - 1 ? 'high' : 'medium'
    }));
  }
}

class StoryArchitect {
  organize(analysis) {
    const { storyBeats, seed, rng } = analysis;
    const acts = [];

    const totalBeats = storyBeats.length;
    const act1Beats = storyBeats.slice(0, Math.max(1, Math.ceil(totalBeats * 0.25)));
    const act2Beats = storyBeats.slice(act1Beats.length, Math.max(act1Beats.length + 1, Math.floor(totalBeats * 0.5)));
    const act3Beats = storyBeats.slice(act1Beats.length + act2Beats.length);

    acts.push(this._createAct(1, 'Act I - Setup', act1Beats, seed, rng));
    acts.push(this._createAct(2, 'Act II - Confrontation', act2Beats, seed + 1, rng));
    acts.push(this._createAct(3, 'Act III - Resolution', act3Beats, seed + 2, rng));

    return {
      acts,
      structure: 'three_act',
      totalBeats
    };
  }

  _createAct(number, name, beats, seed, rng) {
    const sequences = [];
    const seqSize = Math.max(2, Math.min(4, Math.ceil(beats.length / 2)));

    for (let i = 0; i < beats.length; i += seqSize) {
      const seqBeats = beats.slice(i, i + seqSize);
      sequences.push({
        id: generateId('seq'),
        actId: `act_${number}`,
        name: `Sequence ${i / seqSize + 1}`,
        beats: seqBeats,
        sceneCount: seqBeats.length
      });
    }

    return {
      id: `act_${number}`,
      name,
      number,
      sequences,
      beatCount: beats.length
    };
  }
}

class ActGenerator {
  generate(architecture, targetDuration, aspectRatio) {
    const totalDuration = targetDuration || 60;
    const actDurations = [];
    const totalBeats = architecture.acts.reduce((sum, a) => sum + a.beatCount, 0);

    let remaining = totalDuration;
    const acts = architecture.acts.map((act, idx) => {
      const isLast = idx === architecture.acts.length - 1;
      const actDuration = isLast ? remaining : Math.round((act.beatCount / totalBeats) * totalDuration);
      actDurations.push(actDuration);
      remaining -= actDuration;

      return {
        ...act,
        duration: actDuration,
        targetDuration: actDuration
      };
    });

    return {
      acts,
      totalDuration,
      aspectRatio,
      actDurations
    };
  }
}

class SequenceGenerator {
  generate(actResult) {
    const sequences = [];

    for (const act of actResult.acts) {
      const seqDuration = act.duration / act.sequences.length;
      const refinedSequences = act.sequences.map((seq, idx) => {
        const sceneSlots = Math.max(2, Math.min(4, seq.beats.length || 2));
        return {
          ...seq,
          duration: Math.round(seqDuration),
          sceneSlots: Array.from({ length: sceneSlots }, (_, i) => ({
            id: generateId('slot'),
            slotIndex: i,
            beat: seq.beats[i] || null,
            targetDuration: Math.round(seqDuration / sceneSlots)
          }))
        };
      });
      sequences.push(...refinedSequences);
    }

    return { sequences };
  }
}

class SceneEngine {
  map(sequenceResult, analysis, aspectRatio) {
    const { rng, matchedNiche, storyBeats, characters } = analysis;
    const nicheTemplates = NICHE_TEMPLATE_MAP[matchedNiche] || NICHE_TEMPLATE_MAP['commercial'];
    const scenes = [];
    let sceneIdx = 0;

    for (const seq of sequenceResult.sequences) {
      for (const slot of seq.sceneSlots) {
        const templateId = rng.pick(nicheTemplates);
        const template = sceneTemplateRegistry.get(templateId) || sceneTemplateRegistry.get('establishing_wide');
        const fallbackTemplate = template || { id: 'establishing_wide', default_duration: 6, scene_type: SCENE_TYPES.ESTABLISHING, shot_sequence: [] };

        const duration = slot.targetDuration || fallbackTemplate.default_duration || 6;
        const sceneType = slot.beat?.sceneType || fallbackTemplate.scene_type || SCENE_TYPES.ESTABLISHING;

        const sceneCharacters = rng.shuffle([...characters]).slice(0, rng.int(1, Math.min(3, characters.length || 1)));

        const envType = rng.pick(['interior', 'exterior', 'abstract']);
        const envNameList = ENVIRONMENT_TYPES[envType] || ENVIRONMENT_TYPES.interior;
        const environment = createEmptyEnvironment({
          name: rng.pick(envNameList),
          type: envType,
          time: {
            time_of_day: rng.pick(['day', 'night', 'dawn', 'dusk', 'golden_hour']),
            season: 'present',
            era: 'present'
          },
          weather: {
            condition: rng.pick(['clear', 'cloudy', 'rainy', 'misty', 'sunny']),
            intensity: 'light',
            wind: 'none',
            fog: rng.pick(['none', 'light', 'medium'])
          }
        });

        const emotionTone = rng.pick(
          EMOTIONAL_TONE_SEQUENCES[matchedNiche] || EMOTIONAL_TONE_SEQUENCES.business
        );

        const shots = this._generateShots(fallbackTemplate, duration, rng, emotionTone);

        scenes.push({
          id: slot.id,
          actId: seq.actId,
          sequenceId: seq.id,
          templateId: fallbackTemplate.id,
          templateName: fallbackTemplate.name,
          sceneType,
          sceneNumber: ++sceneIdx,
          duration,
          shots,
          characters: sceneCharacters.map(c => c.character_id),
          characterDetails: sceneCharacters,
          environment,
          emotion: {
            primary: emotionTone,
            secondary: rng.pick(Object.values(EMOTIONAL_TONES)),
            intensity: parseFloat(rng.next().toFixed(2)),
            emotional_arc: `${EMOTIONAL_TONES.NEUTRAL}_to_${emotionTone}`
          },
          aspectRatio
        });
      }
    }

    return { scenes };
  }

  _generateShots(template, sceneDuration, rng, emotionTone) {
    const shots = [];
    const templateShots = template.shot_sequence || [];
    const totalTemplateDuration = templateShots.reduce((s, sh) => s + (sh.duration || 3), 0);
    const scale = sceneDuration / Math.max(totalTemplateDuration, sceneDuration);

    const shotDefs = templateShots.length > 0
      ? templateShots
      : [
          { shot_type: SHOT_TYPES.WIDE, purpose: 'establish', duration: 3 },
          { shot_type: SHOT_TYPES.MEDIUM, purpose: 'develop', duration: 3 },
          { shot_type: SHOT_TYPES.CLOSE_UP, purpose: 'emphasize', duration: 2 }
        ];

    shotDefs.forEach((shotDef, idx) => {
      const duration = Math.max(2, Math.round((shotDef.duration || 3) * scale));
      const shot = createEmptyShot({
        shot_number: idx + 1,
        purpose: shotDef.purpose || 'develop_scene',
        duration_seconds: duration,
        shot_type: shotDef.shot_type || SHOT_TYPES.MEDIUM,
        camera: {
          position: rng.pick(['eye_level', 'low_angle', 'high_angle', 'street_level']),
          angle: rng.pick(['eye_level', 'low', 'high']),
          movement: rng.pick(Object.values(CAMERA_MOVEMENTS)),
          movement_speed: rng.pick(['slow', 'normal', 'fast']),
          start_position: null,
          end_position: null
        },
        lens: {
          focal_length: rng.pick(['24mm', '35mm', '50mm', '85mm', '135mm']),
          lens_type: rng.pick(['anamorphic', 'standard', 'telephoto', 'wide']),
          aperture: rng.pick(['f1.4', 'f2.0', 'f2.8', 'f4.0']),
          depth_of_field: rng.pick(['shallow', 'medium', 'deep'])
        },
        lighting: {
          style: rng.pick(Object.values(LIGHTING_STYLES)),
          key: 'ambient',
          fill: 'soft',
          rim: null,
          practical: []
        },
        emotion: {
          primary: emotionTone,
          intensity: parseFloat(rng.next().toFixed(2))
        }
      });
      shots.push(shot);
    });

    return shots;
  }
}

class CharacterEngine {
  maintain(characters, scenes) {
    const registry = new Map();
    const allChars = [...characters];

    for (const char of allChars) {
      registry.set(char.character_id, { ...char });
    }

    for (const scene of scenes) {
      for (const charId of scene.characters) {
        if (!registry.has(charId)) {
          registry.set(charId, createEmptyCharacter({ character_id: charId }));
        }
      }
    }

    return {
      registry: Object.fromEntries(registry),
      characterCount: registry.size,
      continuityNotes: Array.from(registry.values()).map(c => `${c.name || c.character_id}: ${c.continuity_rules?.join(', ') || 'standard_continuity'}`)
    };
  }
}

class EnvironmentEngine {
  select(scenes) {
    const envRegistry = new Map();

    for (const scene of scenes) {
      const env = scene.environment;
      if (!env) continue;

      const existing = envRegistry.get(env.name);
      if (existing) {
        env.continuity_reference = existing.environment_id;
      } else {
        env.continuity_reference = env.environment_id;
        envRegistry.set(env.name, env);
      }
    }

    return {
      environments: Array.from(envRegistry.values()),
      totalUnique: envRegistry.size,
      registry: Object.fromEntries(envRegistry)
    };
  }
}

class ShotEngine {
  generate(scenes, analysis) {
    const allShots = [];
    const shotMap = new Map();

    for (const scene of scenes) {
      const sceneShots = [];
      for (const shot of scene.shots) {
        const enrichedShot = {
          ...shot,
          sceneId: scene.id,
          actId: scene.actId,
          sequenceId: scene.sequenceId,
          templateId: scene.templateId
        };
        sceneShots.push(enrichedShot);
        shotMap.set(shot.shot_id, enrichedShot);
        allShots.push(enrichedShot);
      }
    }

    return { allShots, shotMap, totalShots: allShots.length };
  }
}

class PromptEngine {
  build(shots, scenes, analysis) {
    const { premise, niche, matchedNiche } = analysis;
    const prompts = [];
    const sceneMap = new Map(scenes.map(s => [s.id, s]));

    for (const shot of shots) {
      const scene = sceneMap.get(shot.sceneId);
      if (!scene) continue;

      const shotTypeLabel = shot.shot_type?.replace(/_/g, ' ') || 'medium shot';
      const emotionLabel = shot.emotion?.primary || EMOTIONAL_TONES.NEUTRAL;
      const lightingLabel = shot.lighting?.style?.replace(/_/g, ' ') || 'natural lighting';
      const lensLabel = shot.lens?.focal_length || '50mm';

      const positivePrompt = [
        `Cinematic ${shotTypeLabel}, ${emotionLabel} mood, ${lightingLabel}, ${lensLabel} lens, anamorphic`,
        niche ? `${niche} style, ${niche} aesthetic` : 'premium cinematic style',
        `Scene: ${scene.templateName || scene.sceneType}, ${scene.environment?.name || 'studio'}`,
        `Photorealistic, 8k, high detail, professional color grading, ${analysis.aspectRatio || '16:9'} aspect ratio`,
        premise ? `Context: ${premise.slice(0, 200)}` : ''
      ].filter(Boolean).join('. ');

      const negativePrompt = [
        'blurry, low quality, distorted, watermark, text, logo, bad anatomy',
        'oversaturated, overexposed, underexposed, lens flare artifacts',
        'duplicate, extra limbs, mutated hands, poorly rendered face'
      ].join(', ');

      const model = shot.generation?.model || 'flux-dev';

      prompts.push({
        shotId: shot.shot_id,
        sceneId: scene.id,
        prompt: positivePrompt,
        negative_prompt: negativePrompt,
        model,
        metadata: {
          niche: matchedNiche,
          sceneType: scene.sceneType,
          emotion: emotionLabel,
          lighting: lightingLabel
        }
      });
    }

    return { prompts };
  }
}

class EmotionalContinuityEngine {
  validate(scenes) {
    if (!scenes || scenes.length === 0) {
      return { valid: true, issues: [], emotionalArc: [] };
    }

    const issues = [];
    const arc = [];
    let prevTone = null;

    for (const scene of scenes) {
      const tone = scene.emotion?.primary || EMOTIONAL_TONES.NEUTRAL;
      arc.push({ sceneId: scene.id, tone, intensity: scene.emotion?.intensity || 0.5 });

      if (prevTone && tone === prevTone && arc.filter(a => a.tone === tone).length > 2) {
        issues.push({
          type: 'repetition',
          sceneId: scene.id,
          message: `Emotional tone "${tone}" repeated too many times consecutively`
        });
      }
      prevTone = tone;
    }

    return {
      valid: issues.length === 0,
      issues,
      emotionalArc: arc,
      recommendedTransitions: this._suggestTransitions(arc)
    };
  }

  _suggestTransitions(arc) {
    const transitions = [];
    for (let i = 1; i < arc.length; i++) {
      const from = arc[i - 1].tone;
      const to = arc[i].tone;
      if (from !== to) {
        transitions.push({
          fromSceneId: arc[i - 1].sceneId,
          toSceneId: arc[i].sceneId,
          from: from,
          to: to,
          suggestedTransition: this._pickTransition(from, to)
        });
      }
    }
    return transitions;
  }

  _pickTransition(from, to) {
    const dramatic = [EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.DARK, EMOTIONAL_TONES.URGENT];
    const soft = [EMOTIONAL_TONES.SAD, EMOTIONAL_TONES.NEUTRAL, EMOTIONAL_TONES.HOPEFUL];
    if (dramatic.includes(from) || dramatic.includes(to)) return TRANSITION_TYPES.WHIP_PAN;
    if (soft.includes(from) || soft.includes(to)) return TRANSITION_TYPES.DISSOLVE;
    return TRANSITION_TYPES.CUT;
  }
}

class ContinuityEngineValidator {
  validate(scenes, continuityData) {
    const issues = [];
    const seenLocations = new Map();
    const seenWardrobes = new Map();

    for (const scene of scenes) {
      const loc = scene.environment?.name;
      if (loc) {
        const prev = seenLocations.get(loc);
        if (prev && prev !== scene.id) {
          issues.push({
            type: 'location_continuity',
            sceneId: scene.id,
            message: `Location "${loc}" reused - ensure visual continuity`
          });
        }
        seenLocations.set(loc, scene.id);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      continuityData: continuityData || {}
    };
  }
}

class TimelineEngine {
  assemble(scenes, totalDuration) {
    let currentTime = 0;
    const timeline = [];

    for (const scene of scenes) {
      const startTime = currentTime;
      const endTime = currentTime + scene.duration;

      const sceneShots = scene.shots || [];
      let shotTime = startTime;

      const shotTimeline = sceneShots.map(shot => {
        const shotStart = shotTime;
        const shotEnd = shotTime + shot.duration_seconds;
        shotTime = shotEnd;
        return {
          ...shot,
          startTime: shotStart,
          endTime: shotEnd
        };
      });

      const prevScene = timeline[timeline.length - 1];
      const transition = prevScene
        ? this._selectTransition(prevScene.emotion?.primary, scene.emotion?.primary)
        : { type: TRANSITION_TYPES.FADE_IN, duration: 0.5 };

      timeline.push({
        sceneId: scene.id,
        actId: scene.actId,
        sequenceId: scene.sequenceId,
        sceneNumber: scene.sceneNumber,
        sceneType: scene.sceneType,
        templateId: scene.templateId,
        startTime,
        endTime,
        duration: scene.duration,
        shots: shotTimeline,
        emotion: scene.emotion,
        environment: scene.environment,
        characters: scene.characters,
        transition
      });

      currentTime = endTime;
    }

    return {
      timeline,
      totalDuration: currentTime,
      sceneCount: timeline.length
    };
  }

  _selectTransition(fromEmotion, toEmotion) {
    if (!fromEmotion) return { type: TRANSITION_TYPES.CUT, duration: 0 };
    const highEnergy = [EMOTIONAL_TONES.URGENT, EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.EPIC];
    if (highEnergy.includes(fromEmotion) || highEnergy.includes(toEmotion)) {
      return { type: TRANSITION_TYPES.WHIP_PAN, duration: 0.3 };
    }
    if (fromEmotion === EMOTIONAL_TONES.SAD || toEmotion === EMOTIONAL_TONES.SAD) {
      return { type: TRANSITION_TYPES.DISSOLVE, duration: 1.0 };
    }
    return { type: TRANSITION_TYPES.CUT, duration: 0 };
  }
}

export class AIDirector {
  constructor(options = {}) {
    this.options = {
      targetDuration: options.targetDuration || 60,
      aspectRatio: options.aspectRatio || '16:9',
      pacing: options.pacing || 'moderate'
    };

    this.scriptAnalyzer = new ScriptAnalyzer();
    this.storyArchitect = new StoryArchitect();
    this.actGenerator = new ActGenerator();
    this.sequenceGenerator = new SequenceGenerator();
    this.sceneEngine = new SceneEngine();
    this.characterEngine = new CharacterEngine();
    this.environmentEngine = new EnvironmentEngine();
    this.shotEngine = new ShotEngine();
    this.promptEngine = new PromptEngine();
    this.emotionalContinuityEngine = new EmotionalContinuityEngine();
    this.continuityEngine = new ContinuityEngine();
    this.continuityValidator = new ContinuityEngineValidator();
    this.timelineEngine = new TimelineEngine();
  }

  async generateFromScript(inputs = {}) {
    const {
      premise = '',
      niche = '',
      template = '',
      targetDuration,
      aspectRatio
    } = inputs;

    const resolvedDuration = targetDuration || this.options.targetDuration;
    const resolvedAspectRatio = aspectRatio || this.options.aspectRatio;

    const analysis = this.scriptAnalyzer.analyze({
      premise,
      niche,
      template,
      aspectRatio: resolvedAspectRatio
    });

    const architecture = this.storyArchitect.organize(analysis);
    const actResult = this.actGenerator.generate(architecture, resolvedDuration, resolvedAspectRatio);
    const sequenceResult = this.sequenceGenerator.generate(actResult);
    const sceneResult = this.sceneEngine.map(sequenceResult, analysis, resolvedAspectRatio);

    const charResult = this.characterEngine.maintain(analysis.characters, sceneResult.scenes);
    const envResult = this.environmentEngine.select(sceneResult.scenes);
    const shotResult = this.shotEngine.generate(sceneResult.scenes, analysis);
    const promptResult = this.promptEngine.build(shotResult.allShots, sceneResult.scenes, analysis);

    const emotionalContinuity = this.emotionalContinuityEngine.validate(sceneResult.scenes);
    const continuityValidation = this.continuityValidator.validate(sceneResult.scenes, charResult);

    const continuityData = {
      ...this.continuityEngine.toJSON(),
      emotional: emotionalContinuity,
      validation: continuityValidation,
      characterNotes: charResult.continuityNotes
    };

    const timelineResult = this.timelineEngine.assemble(sceneResult.scenes, resolvedDuration);

    return {
      project: {
        id: generateId('proj'),
        title: premise.slice(0, 60) || 'Untitled Project',
        synopsis: premise,
        totalDuration: timelineResult.totalDuration,
        aspectRatio: resolvedAspectRatio,
        niche: analysis.matchedNiche,
        template: template || 'auto_selected'
      },
      acts: actResult.acts.map(act => ({
        id: act.id,
        name: act.name,
        number: act.number,
        duration: act.duration,
        sequences: act.sequences.map(seq => ({
          id: seq.id,
          name: seq.name,
          sceneCount: seq.sceneSlots?.length || seq.sceneCount || 0,
          beats: seq.beats
        }))
      })),
      scenes: sceneResult.scenes.map(scene => ({
        id: scene.id,
        actId: scene.actId,
        sequenceId: scene.sequenceId,
        templateId: scene.templateId,
        templateName: scene.templateName,
        sceneType: scene.sceneType,
        sceneNumber: scene.sceneNumber,
        duration: scene.duration,
        shots: scene.shots.map(s => ({
          shot_id: s.shot_id,
          shot_number: s.shot_number,
          shot_type: s.shot_type,
          purpose: s.purpose,
          duration_seconds: s.duration_seconds,
          camera: s.camera,
          lens: s.lens,
          lighting: s.lighting,
          emotion: s.emotion
        })),
        characters: scene.characters,
        characterDetails: scene.characterDetails,
        environment: scene.environment,
        emotion: scene.emotion,
        aspectRatio: scene.aspectRatio
      })),
      timeline: timelineResult.timeline.map(t => ({
        sceneId: t.sceneId,
        actId: t.actId,
        sequenceId: t.sequenceId,
        sceneNumber: t.sceneNumber,
        sceneType: t.sceneType,
        templateId: t.templateId,
        startTime: t.startTime,
        endTime: t.endTime,
        duration: t.duration,
        shots: t.shots.map(s => ({
          shot_id: s.shot_id,
          shot_type: s.shot_type,
          startTime: s.startTime,
          endTime: s.endTime,
          duration_seconds: s.duration_seconds,
          camera: s.camera,
          lens: s.lens,
          lighting: s.lighting
        })),
        emotion: t.emotion,
        environment: t.environment,
        characters: t.characters,
        transition: t.transition
      })),
      prompts: promptResult.prompts,
      continuity: continuityData,
      meta: {
        seed: analysis.seed,
        totalScenes: sceneResult.scenes.length,
        totalShots: shotResult.totalShots,
        totalDuration: timelineResult.totalDuration,
        characterCount: charResult.characterCount,
        environmentCount: envResult.totalUnique,
        generatedAt: new Date().toISOString()
      }
    };
  }
}

export async function generateCinematicVideo(inputs = {}) {
  const director = new AIDirector({
    targetDuration: inputs.targetDuration || 60,
    aspectRatio: inputs.aspectRatio || '16:9'
  });
  return director.generateFromScript(inputs);
}

export default AIDirector;
