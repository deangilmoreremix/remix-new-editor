import { TRANSITION_TYPES } from './sceneSchema.js';

export class TimelineEngine {
  constructor(options = {}) {
    this.defaultTransition = options.defaultTransition || TRANSITION_TYPES.CUT;
    this.defaultTransitionDuration = options.defaultTransitionDuration || 0;
    this.emotionalTransitionDuration = options.emotionalTransitionDuration || 0.5;
    this.actBreakDuration = options.actBreakDuration || 1.0;
    this.customOverrides = new Map();
    this._transitions = [];
  }

  assemble(scenes, totalDuration = null) {
    if (!scenes || scenes.length === 0) {
      return [];
    }

    const calculatedDuration = totalDuration || this.calculateTotalDuration(scenes);
    const timeline = [];
    let currentTime = 0;

    scenes.forEach((scene, index) => {
      const duration = scene.timing?.duration_seconds || 5;
      const sceneDuration = Math.min(duration, calculatedDuration - currentTime);

      let transitionIn = { type: TRANSITION_TYPES.CUT, duration: 0 };
      let transitionOut = { type: TRANSITION_TYPES.CUT, duration: 0 };

      if (index > 0) {
        const prevScene = scenes[index - 1];
        const transitionPair = this.calculateTransitions(prevScene, scene);
        transitionIn = { type: transitionPair.in, duration: this._getTransitionDuration(transitionPair.in) };
      }

      if (index < scenes.length - 1) {
        const transitionPair = this.calculateTransitions(scene, scenes[index + 1]);
        transitionOut = { type: transitionPair.out, duration: this._getTransitionDuration(transitionPair.out) };
      }

      const customIn = this.customOverrides.get(`${scene.scene_id || index}-in`);
      if (customIn) transitionIn = customIn;
      const customOut = this.customOverrides.get(`${scene.scene_id || index}-out`);
      if (customOut) transitionOut = customOut;

      const shots = this._buildShots(scene, currentTime, transitionIn.duration);

      timeline.push({
        sceneId: scene.scene_id || `scene_${index}`,
        sceneNumber: scene.scene_number || index + 1,
        startTime: currentTime,
        endTime: currentTime + sceneDuration + transitionIn.duration,
        duration: sceneDuration,
        transitionIn,
        transitionOut,
        shots
      });

      currentTime += sceneDuration + transitionIn.duration;
    });

    this._transitions = timeline.flatMap(t => [t.transitionIn, t.transitionOut]);
    return timeline;
  }

  calculateTransitions(sceneA, sceneB) {
    if (!sceneA || !sceneB) {
      return { in: TRANSITION_TYPES.CUT, out: TRANSITION_TYPES.CUT };
    }

    const sceneAType = sceneA.scene_type || '';
    const sceneBType = sceneB.scene_type || '';
    const sceneAEmotion = (sceneA.emotion?.primary || '').toLowerCase();
    const sceneBEmotion = (sceneB.emotion?.primary || '').toLowerCase();
    const sceneAPace = (sceneA.timing?.pace || 'normal').toLowerCase();
    const sceneBPace = (sceneB.timing?.pace || 'normal').toLowerCase();

    const emotionalTypes = [
      'emotional', 'romance', 'climax', 'resolution', 'emotional_ending',
      'flashback', 'dream', 'reveal'
    ];
    const isEmotionalA = emotionalTypes.some(t => sceneAType.includes(t));
    const isEmotionalB = emotionalTypes.some(t => sceneBType.includes(t));
    const isEmotionChange = sceneAEmotion !== sceneBEmotion && (isEmotionalA || isEmotionalB);

    if (this._isActBreak(sceneA, sceneB)) {
      return { in: TRANSITION_TYPES.FADE_TO_BLACK, out: TRANSITION_TYPES.FADE_IN };
    }

    const matchResult = this._detectMatchCut(sceneA, sceneB);
    if (matchResult) {
      return { in: TRANSITION_TYPES.MATCH_CUT, out: TRANSITION_TYPES.CUT };
    }

    if (sceneBType === 'flashback' || sceneAType === 'flashback') {
      return { in: TRANSITION_TYPES.DISSOLVE, out: TRANSITION_TYPES.DISSOLVE };
    }

    if (isEmotionChange && (isEmotionalA || isEmotionalB)) {
      return { in: TRANSITION_TYPES.DISSOLVE, out: TRANSITION_TYPES.DISSOLVE };
    }

    const isActionA = sceneAType.includes('action') || sceneAType.includes('chase') || sceneAType.includes('conflict');
    const isActionB = sceneBType.includes('action') || sceneBType.includes('chase') || sceneBType.includes('conflict');
    if (isActionA || isActionB) {
      return { in: TRANSITION_TYPES.WHIP_PAN, out: TRANSITION_TYPES.CUT };
    }

    if (sceneAPace === 'fast' || sceneBPace === 'fast') {
      return { in: TRANSITION_TYPES.CUT, out: TRANSITION_TYPES.CUT };
    }

    if (sceneBType === 'dialogue' || sceneBType === 'conversation') {
      return { in: TRANSITION_TYPES.CUT, out: TRANSITION_TYPES.CUT };
    }

    if (isEmotionalA && isEmotionalB) {
      return { in: TRANSITION_TYPES.DISSOLVE, out: TRANSITION_TYPES.DISSOLVE };
    }

    return { in: TRANSITION_TYPES.CUT, out: TRANSITION_TYPES.CUT };
  }

  addTransition(transitionType, duration, sceneId = null) {
    const key = sceneId ? `${sceneId}-in` : `global-${Date.now()}`;
    this.customOverrides.set(key, { type: transitionType, duration });
    return { type: transitionType, duration };
  }

  exportForEditor() {
    return JSON.stringify({
      format: 'timeline-engine-v1',
      exportedAt: new Date().toISOString(),
      transitions: this._transitions,
      customOverrides: Array.from(this.customOverrides.entries()),
      supportedTypes: Object.values(TRANSITION_TYPES)
    }, null, 2);
  }

  calculateTotalDuration(scenes) {
    if (!scenes || scenes.length === 0) return 0;

    let total = 0;
    scenes.forEach((scene, index) => {
      const duration = scene.timing?.duration_seconds || 5;
      let transitionDuration = 0;

      if (index > 0) {
        const prevScene = scenes[index - 1];
        const transitionPair = this.calculateTransitions(prevScene, scene);
        transitionDuration = this._getTransitionDuration(transitionPair.in);
      }

      total += duration + transitionDuration;
    });

    return total;
  }

  _buildShots(scene, startTime, transitionOffset = 0) {
    if (!scene?.shots || scene.shots.length === 0) {
      return [{
        shotId: `${scene?.scene_id || 'scene'}_shot_1`,
        startTime: startTime + transitionOffset,
        endTime: startTime + transitionOffset + (scene?.timing?.duration_seconds || 5),
        duration: scene?.timing?.duration_seconds || 5
      }];
    }

    let shotTime = startTime + transitionOffset;
    return scene.shots.map((shot, i) => {
      const duration = shot.duration_seconds || 3;
      const shotStart = shotTime;
      const shotEnd = shotTime + duration;
      shotTime = shotEnd;
      return {
        shotId: shot.shot_id || `${scene.scene_id || 'scene'}_shot_${i + 1}`,
        startTime: shotStart,
        endTime: shotEnd,
        duration
      };
    });
  }

  _detectMatchCut(sceneA, sceneB) {
    const shapeA = this._inferSubjectShape(sceneA);
    const shapeB = this._inferSubjectShape(sceneB);
    if (shapeA && shapeB && shapeA === shapeB) return true;

    const actionA = sceneA.shots?.some(s => s.subject_action?.action) || false;
    const actionB = sceneB.shots?.some(s => s.subject_action?.action) || false;
    if (actionA && actionB && sceneA.scene_type === sceneB.scene_type) return true;

    const environmentA = sceneA.environment;
    const environmentB = sceneB.environment;
    if (environmentA && environmentB && environmentA === environmentB) {
      const shotA = sceneA.camera?.shot_type;
      const shotB = sceneB.camera?.shot_type;
      if (shotA && shotB && shotA !== shotB) return true;
    }

    return false;
  }

  _inferSubjectShape(scene) {
    const shotType = scene?.camera?.shot_type || scene?.shots?.[0]?.shot_type;
    if (!shotType) return null;

    if ([
      'close_up', 'extreme_close_up', 'medium_close_up',
      'profile', 'over_shoulder', 'pov'
    ].includes(shotType)) return 'close';

    if (['wide', 'medium_wide', 'extreme_wide', 'medium'].includes(shotType)) return 'wide';

    if (['birdseye', 'low_angle', 'high_angle', 'dutch_angle'].includes(shotType)) return 'angle';

    return null;
  }

  _isActBreak(sceneA, sceneB) {
    const actA = sceneA?.story?.act;
    const actB = sceneB?.story?.act;
    if (actA != null && actB != null && actA !== actB) return true;

    const typesA = sceneA?.scene_type || '';
    const typesB = sceneB?.scene_type || '';

    if (
      (typesA.includes('climax') || typesA.includes('resolution')) &&
      (typesB.includes('cold_open') || typesB.includes('hook') || typesB.includes('establishing'))
    ) {
      return true;
    }

    return false;
  }

  _getTransitionDuration(transitionType) {
    if (!transitionType) return 0;
    const type = String(transitionType).toLowerCase();

    if (type === TRANSITION_TYPES.CUT || type === TRANSITION_TYPES.MATCH_CUT) return 0;
    if (type === TRANSITION_TYPES.WHIP_PAN) return 0.2;
    if (type === TRANSITION_TYPES.FADE_TO_BLACK || type === TRANSITION_TYPES.FADE_IN) {
      return this.actBreakDuration;
    }
    if (type === TRANSITION_TYPES.DISSOLVE) return this.emotionalTransitionDuration;
    if (type === TRANSITION_TYPES.FADE_IN) return this.actBreakDuration;

    return 0.5;
  }
}

export const timelineEngine = new TimelineEngine();
