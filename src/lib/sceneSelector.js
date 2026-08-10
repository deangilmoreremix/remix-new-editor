/**
 * SCENE SELECTOR ENGINE
 *
 * Core "AI Director" logic:
 * - chooses a story flow for a template
 * - maps flow steps to scene classes
 * - picks shot sequences for each scene
 * - respects duration budget and pacing
 */

import { getSceneClass, SCENE_CLASSES } from './sceneTaxonomy.js';
import { getFlowById, getFlowsForTemplate } from './sceneFlows.js';
import { PACING_OPTIONS } from './cinematicTemplates.js';
import { sceneTemplateRegistry, createEmptyScene, SHOT_TYPES, CAMERA_MOVEMENTS } from './sceneSchema.js';

const DEFAULT_DURATION_BUDGET = 90; // seconds
const DEFAULT_PACING = PACING_OPTIONS?.MODERATE || { id: 'moderate', beatsPerMinute: 90 };

function pickFlow(template, userInputs = {}) {
  const flows = getFlowsForTemplate(template);
  if (!flows.length) return getFlowById('classic_hero');

  const niche = (userInputs.niche || template.niche || '').toLowerCase();
  const category = (template.category || '').toLowerCase();
  const outputStyle = (template.outputStyle?.id || '').toLowerCase();

  let best = flows[0];
  let bestScore = 0;

  for (const flow of flows) {
    let score = 0;
    const keywords = flow.bestFor || [];
    for (const kw of keywords) {
      if (niche.includes(kw.toLowerCase())) score += 2;
      if (category.includes(kw.toLowerCase())) score += 2;
      if (outputStyle.includes(kw.toLowerCase())) score += 2;
      if (template.name && template.name.toLowerCase().includes(kw.toLowerCase())) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = flow;
    }
  }

  return best;
}

function estimateSceneDuration(scene, pacing = DEFAULT_PACING) {
  const baseBeats = scene.beats?.length || 3;
  const bpm = pacing.beatsPerMinute || 90;
  const secondsPerBeat = 60 / bpm;
  const baseSeconds = baseBeats * secondsPerBeat;

  // Clamp to reasonable bounds
  return Math.max(4, Math.min(20, Math.round(baseSeconds)));
}

function pickShotSequence(scene, availableSeconds) {
  const shots = [];
  const suggested = scene.suggestedShots || [SHOT_TYPES.MEDIUM, SHOT_TYPES.CLOSE_UP, SHOT_TYPES.WIDE];
  const shotCount = Math.max(2, Math.min(6, Math.round(availableSeconds / 3)));

  // If this scene matches a template, use its shot sequence
  const template = sceneTemplateRegistry.get(scene.id);
  const templateShots = template?.shot_sequence;

  if (templateShots && templateShots.length) {
    const totalTemplateDuration = templateShots.reduce((sum, s) => sum + (s.duration || 3), 0);
    const scale = availableSeconds / totalTemplateDuration;

    templateShots.forEach((shotDef, idx) => {
      const duration = Math.max(2, Math.round((shotDef.duration || 3) * scale));
      shots.push({
        type: shotDef.shot_type || suggested[idx % suggested.length],
        duration,
        movement: CAMERA_MOVEMENTS.STATIC,
        order: idx + 1
      });
    });

    return shots;
  }

  for (let i = 0; i < shotCount; i++) {
    const type = suggested[i % suggested.length];
    const duration = Math.max(2, Math.floor(availableSeconds / shotCount));
    shots.push({
      type,
      duration,
      movement: CAMERA_MOVEMENTS.STATIC,
      order: i + 1
    });
  }

  return shots;
}

/**
 * Select scenes for a template generation.
 *
 * @param {Object} template - cinematic template definition
 * @param {Object} userInputs - user-provided inputs (niche, premise, etc.)
 * @param {number} [targetDuration] - desired total duration in seconds
 * @returns {Array} ordered array of scene configs
 */
export function selectScenes(template, userInputs = {}, targetDuration = DEFAULT_DURATION_BUDGET) {
  if (!template) return [];

  const flow = pickFlow(template, userInputs);
  const sceneIds = flow.scenes || [];
  const pacing = userInputs.pacing || DEFAULT_PACING;
  const scenes = [];

  let remaining = targetDuration;
  const sceneCount = sceneIds.length;

  for (let i = 0; i < sceneCount; i++) {
    const sceneId = sceneIds[i];
    const sceneDef = getSceneClass(sceneId);
    if (!sceneDef) continue;

    // Reserve time for end card / CTA
    const isLast = i === sceneCount - 1;
    const reservedForCTA = isLast ? 8 : 0;
    const available = Math.max(4, remaining - reservedForCTA);
    const sceneDuration = isLast
      ? Math.min(available, 10)
      : Math.min(estimateSceneDuration(sceneDef, pacing), available / (sceneCount - i));

    remaining -= sceneDuration;

    // Look up template from registry for richer metadata
    const templateDef = sceneTemplateRegistry.get(sceneDef.id);

    scenes.push(createEmptyScene({
      scene_number: i + 1,
      scene_type: sceneDef.scene_type || SCENE_TYPES.ESTABLISHING,
      scene_subtype: sceneDef.id,
      purpose: {
        story_function: sceneDef.storyPurpose,
        narrative_role: isLast ? 'ending' : 'development',
        description: sceneDef.name
      },
      timing: {
        duration_seconds: sceneDuration,
        start_time: targetDuration - remaining - sceneDuration,
        end_time: targetDuration - remaining,
        pace: pacing.id || 'moderate',
        importance: isLast ? 'high' : 'medium'
      },
      story: {
        act: flow.act || 1,
        sequence: i + 1,
        beat: i + 1,
        previous_scene_id: i > 0 ? scenes[i - 1].scene_id : null,
        next_scene_id: isLast ? null : `scene_${Date.now()}_${i + 2}`,
        story_question: null,
        story_answer: null
      },
      emotion: {
        primary: sceneDef.emotionalTone?.[0] || EMOTIONAL_TONES.NEUTRAL,
        secondary: sceneDef.emotionalTone?.[1] || null,
        intensity: 0.5,
        emotional_arc: 'neutral_to_emotional'
      },
      shots: pickShotSequence(sceneDef, sceneDuration),
      keywords: sceneDef.keywords,
      flowId: flow.id,
      flowName: flow.name
    }));
  }

  return scenes;
}

export { pickFlow, estimateSceneDuration, pickShotSequence };
