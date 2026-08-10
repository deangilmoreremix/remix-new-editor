import { EMOTIONAL_TONES } from './sceneSchema.js';

const ALLOWED_EMOTIONAL_TONES = Object.values(EMOTIONAL_TONES);

const TRANSITION_PRESETS = [
  'cut',
  'dissolve',
  'fade_in',
  'fade_out',
  'fade_to_black',
  'whip_pan',
  'match_cut',
  'light_transition',
  'smoke_transition',
  'water_transition',
  'morph',
  'time_transition'
];

const EMOTIONAL_BRIDGE_MAP = {
  [EMOTIONAL_TONES.NEUTRAL]: [EMOTIONAL_TONES.CURIOUS, EMOTIONAL_TONES.PEACEFUL, EMOTIONAL_TONES.HOPEFUL],
  [EMOTIONAL_TONES.EPIC]: [EMOTIONAL_TONES.TRIUMPHANT, EMOTIONAL_TONES.INSPIRATIONAL, EMOTIONAL_TONES.JOYFUL],
  [EMOTIONAL_TONES.HOPEFUL]: [EMOTIONAL_TONES.INSPIRATIONAL, EMOTIONAL_TONES.JOYFUL, EMOTIONAL_TONES.ROMANTIC],
  [EMOTIONAL_TONES.DARK]: [EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.MYSTERIOUS, EMOTIONAL_TONES.SAD],
  [EMOTIONAL_TONES.MYSTERIOUS]: [EMOTIONAL_TONES.CURIOUS, EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.SUSPENSEFUL],
  [EMOTIONAL_TONES.ROMANTIC]: [EMOTIONAL_TONES.JOYFUL, EMOTIONAL_TONES.NOSTALGIC, EMOTIONAL_TONES.PEACEFUL],
  [EMOTIONAL_TONES.TENSE]: [EMOTIONAL_TONES.SUSPENSEFUL, EMOTIONAL_TONES.URGENT, EMOTIONAL_TONES.DANGEROUS],
  [EMOTIONAL_TONES.SAD]: [EMOTIONAL_TONES.NOSTALGIC, EMOTIONAL_TONES.PEACEFUL, EMOTIONAL_TONES.REFLECTIVE],
  [EMOTIONAL_TONES.JOYFUL]: [EMOTIONAL_TONES.HOPEFUL, EMOTIONAL_TONES.TRIUMPHANT, EMOTIONAL_TONES.INSPIRATIONAL],
  [EMOTIONAL_TONES.INSPIRATIONAL]: [EMOTIONAL_TONES.HOPEFUL, EMOTIONAL_TONES.TRIUMPHANT, EMOTIONAL_TONES.JOYFUL],
  [EMOTIONAL_TONES.DANGEROUS]: [EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.URGENT, EMOTIONAL_TONES.SUSPENSEFUL],
  [EMOTIONAL_TONES.PEACEFUL]: [EMOTIONAL_TONES.HOPEFUL, EMOTIONAL_TONES.NOSTALGIC, EMOTIONAL_TONES.JOYFUL],
  [EMOTIONAL_TONES.URGENT]: [EMOTIONAL_TONES.DANGEROUS, EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.EPIC],
  [EMOTIONAL_TONES.NOSTALGIC]: [EMOTIONAL_TONES.PEACEFUL, EMOTIONAL_TONES.SAD, EMOTIONAL_TONES.ROMANTIC],
  [EMOTIONAL_TONES.SURREAL]: [EMOTIONAL_TONES.MYSTERIOUS, EMOTIONAL_TONES.CURIOUS, EMOTIONAL_TONES.DARK],
  [EMOTIONAL_TONES.TRIUMPHANT]: [EMOTIONAL_TONES.JOYFUL, EMOTIONAL_TONES.INSPIRATIONAL, EMOTIONAL_TONES.EPIC],
  [EMOTIONAL_TONES.CURIOUS]: [EMOTIONAL_TONES.MYSTERIOUS, EMOTIONAL_TONES.SUSPENSEFUL, EMOTIONAL_TONES.URGENT],
  [EMOTIONAL_TONES.SUSPENSEFUL]: [EMOTIONAL_TONES.TENSE, EMOTIONAL_TONES.URGENT, EMOTIONAL_TONES.DANGEROUS]
};

export class EmotionalContinuityEngine {
  constructor(options = {}) {
    this.scenes = new Map();
    this.pacingCurve = [];
    this.validationReport = null;
    this.emotionalBridgeMap = { ...EMOTIONAL_BRIDGE_MAP };
    this.transitionPresets = [...TRANSITION_PRESETS];
    this.maxJarringIntensityDelta = options.maxJarringIntensityDelta ?? 0.5;
  }

  registerScene(sceneIndex, emotionData = {}) {
    const entry = {
      primary: emotionData.primary || emotionData.emotion || EMOTIONAL_TONES.NEUTRAL,
      secondary: emotionData.secondary || emotionData.secondaryEmotion || null,
      intensity: typeof emotionData.intensity === 'number' ? emotionData.intensity : 0.5,
      start: typeof emotionData.start === 'number' ? emotionData.start : (typeof emotionData.intensity === 'number' ? emotionData.intensity : 0.5),
      peak: typeof emotionData.peak === 'number' ? emotionData.peak : (typeof emotionData.intensity === 'number' ? Math.min(1, emotionData.intensity + 0.1) : 0.6),
      end: typeof emotionData.end === 'number' ? emotionData.end : (typeof emotionData.intensity === 'number' ? emotionData.intensity : 0.5),
      transitionIn: emotionData.transitionIn || null,
      transitionOut: emotionData.transitionOut || null,
      duration: typeof emotionData.duration === 'number' ? emotionData.duration : 5
    };

    this.scenes.set(sceneIndex, entry);
    this.validationReport = null;
    this.pacingCurve = [];
    return entry;
  }

  buildPacingCurve(totalDuration) {
    if (!this.scenes.size) return [];

    const sceneIndices = Array.from(this.scenes.keys()).sort((a, b) => a - b);
    const totalSceneDuration = sceneIndices.reduce((sum, idx) => sum + (this.scenes.get(idx).duration || 5), 0);
    const scale = totalDuration > 0 && totalSceneDuration > 0 ? totalDuration / totalSceneDuration : 1;

    let elapsed = 0;
    this.pacingCurve = sceneIndices.map((sceneIndex) => {
      const scene = this.scenes.get(sceneIndex);
      const duration = (scene.duration || 5) * scale;
      const timestamp = elapsed;

      elapsed += duration;

      return {
        sceneIndex,
        emotion: scene.primary,
        intensity: scene.intensity,
        timestamp: Math.round(timestamp * 100) / 100
      };
    });

    return this.pacingCurve;
  }

  validateArc() {
    const sceneIndices = Array.from(this.scenes.keys()).sort((a, b) => a - b);
    const issues = [];
    const suggestions = [];

    for (let i = 0; i < sceneIndices.length; i++) {
      const currentIdx = sceneIndices[i];
      const current = this.scenes.get(currentIdx);

      if (i === 0) continue;

      const prevIdx = sceneIndices[i - 1];
      const previous = this.scenes.get(prevIdx);
      const intensityDelta = Math.abs(current.intensity - previous.intensity);

      if (intensityDelta > this.maxJarringIntensityDelta && !current.transitionIn && !previous.transitionOut) {
        issues.push({
          type: 'jarring_transition',
          fromIndex: prevIdx,
          toIndex: currentIdx,
          fromEmotion: previous.primary,
          toEmotion: current.primary,
          intensityDelta,
          message: `Jarring emotional jump from ${previous.primary} (${previous.intensity}) to ${current.primary} (${current.intensity}) without transition.`
        });

        const hint = this.getTransitionHint(prevIdx, currentIdx);
        suggestions.push({
          fromIndex: prevIdx,
          toIndex: currentIdx,
          recommendedTransition: hint?.transition || 'dissolve',
          bridgingEmotion: hint?.bridgeEmotion || null,
          reason: hint?.reason || 'Smooth the intensity delta with a transitional device.'
        });
      }
    }

    this.validationReport = {
      valid: issues.length === 0,
      sceneCount: sceneIndices.length,
      issues,
      suggestions,
      summary: issues.length === 0
        ? 'Emotional arc is continuous with no jarring transitions.'
        : `${issues.length} jarring transition(s) detected. See suggestions for bridging.`
    };

    return this.validationReport;
  }

  getTransitionHint(fromIndex, toIndex) {
    const fromScene = this.scenes.get(fromIndex);
    const toScene = this.scenes.get(toIndex);

    if (!fromScene || !toScene) {
      return null;
    }

    const fromEmotion = fromScene.primary;
    const toEmotion = toScene.primary;
    const intensityDelta = Math.abs(toScene.intensity - fromScene.intensity);

    const isJarring = intensityDelta > this.maxJarringIntensityDelta;

    if (!isJarring) {
      return {
        transition: 'cut',
        bridgeEmotion: null,
        reason: 'Emotions are compatible enough for a direct cut.'
      };
    }

    const bridges = this.emotionalBridgeMap[fromEmotion] || [];
    const toBridges = this.emotionalBridgeMap[toEmotion] || [];
    const bestBridge = bridges.find(b => toBridges.includes(b) || b === toEmotion) || bridges[0] || EMOTIONAL_TONES.NEUTRAL;

    const recommendedTransition = bestBridge === toEmotion ? 'match_cut' : 'dissolve';

    return {
      transition: recommendedTransition,
      bridgeEmotion: bestBridge,
      reason: `Bridge from ${fromEmotion} to ${bestBridge} before landing on ${toEmotion} to smooth the ${intensityDelta.toFixed(2)} intensity delta.`
    };
  }

  buildEmotionalArcDescription() {
    const sceneIndices = Array.from(this.scenes.keys()).sort((a, b) => a - b);
    if (!sceneIndices.length) return '';

    const parts = sceneIndices.map((idx) => {
      const scene = this.scenes.get(idx);
      const start = Math.round(scene.start * 100);
      const peak = Math.round(scene.peak * 100);
      const end = Math.round(scene.end * 100);
      const secondary = scene.secondary ? ` with secondary ${scene.secondary}` : '';
      return `${scene.primary}${secondary} (${start}% -> ${peak}% -> ${end}%)`;
    });

    return `Emotional arc: ${parts.join(' -> ')}.`;
  }

  toJSON() {
    return {
      scenes: Object.fromEntries(
        Array.from(this.scenes.entries()).map(([k, v]) => [k, { ...v }])
      ),
      pacingCurve: [...this.pacingCurve],
      validationReport: this.validationReport ? { ...this.validationReport } : null,
      emotionalArcDescription: this.buildEmotionalArcDescription()
    };
  }
}

export { ALLOWED_EMOTIONAL_TONES, TRANSITION_PRESETS, EMOTIONAL_BRIDGE_MAP };
