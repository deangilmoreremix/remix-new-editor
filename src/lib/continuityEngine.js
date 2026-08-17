/**
 * CONTINUITY ENGINE
 *
 * Tracks character, environment, lighting, and color continuity across
 * scenes so the AI director can maintain consistency from scene to scene.
 */

import { EmotionalContinuityEngine } from './emotionalContinuity.js';

export class ContinuityEngine {
  constructor() {
    this.characters = new Map();
    this.environments = new Map();
    this.lighting = new Map();
    this.colorPalette = [];
    this.objectStates = new Map();
    this.emotionalEngine = new EmotionalContinuityEngine();
  }

  registerCharacter(id, description) {
    this.characters.set(id, description);
  }

  getCharacter(id) {
    return this.characters.get(id);
  }

  registerEnvironment(id, description) {
    this.environments.set(id, description);
  }

  getEnvironment(id) {
    return this.environments.get(id);
  }

  registerLighting(id, description) {
    this.lighting.set(id, description);
  }

  getLighting(id) {
    return this.lighting.get(id);
  }

  setColorPalette(colors = []) {
    this.colorPalette = colors.filter(Boolean);
  }

  registerObject(id, state) {
    this.objectStates.set(id, state);
  }

  getObject(id) {
    return this.objectStates.get(id);
  }

  /**
   * Build a continuity hint block for a scene based on previous state.
   */
  buildContinuityNotes(previousScene, currentScene) {
    const notes = [];

    if (!previousScene && !currentScene) return '';

    // Character continuity
    if (previousScene?.id && this.characters.has(previousScene.id)) {
      notes.push(`Character continuity: ${this.characters.get(previousScene.id)}`);
    }

    // Environment continuity
    if (previousScene?.id && this.environments.has(previousScene.id)) {
      notes.push(`Environment continuity: ${this.environments.get(previousScene.id)}`);
    }

    // Lighting continuity
    if (previousScene?.id && this.lighting.has(previousScene.id)) {
      notes.push(`Lighting continuity: ${this.lighting.get(previousScene.id)}`);
    }

    // Color palette
    if (this.colorPalette.length) {
      notes.push(`Color palette: ${this.colorPalette.join(', ')}`);
    }

    // Object continuity
    if (previousScene?.id && this.objectStates.has(previousScene.id)) {
      notes.push(`Object state: ${this.objectStates.get(previousScene.id)}`);
    }

    return notes.length ? `Continuity: ${notes.join('. ')}.` : '';
  }

  /**
   * Extract and register continuity hints from a scene config.
   */
  ingestScene(scene) {
    if (!scene) return;

    if (scene.name) {
      this.registerCharacter(scene.id, `${scene.name} maintains consistent appearance`);
      this.registerEnvironment(scene.id, `${scene.name} environment preserves spatial continuity`);
      this.registerLighting(scene.id, `${scene.name} maintains lighting continuity`);
    }

    if (scene.emotionalTone && scene.emotionalTone.length) {
      const tone = scene.emotionalTone.join(', ');
      if (!this.colorPalette.includes(tone)) {
        this.colorPalette.push(tone);
      }
    }

    if (scene.emotion) {
      this.emotionalEngine.registerScene(scene.scene_number || 0, {
        primary: scene.emotion.primary,
        secondary: scene.emotion.secondary,
        intensity: scene.emotion.intensity,
        start: scene.emotion.start,
        peak: scene.emotion.peak,
        end: scene.emotion.end,
        transitionIn: scene.emotion.transitionIn,
        transitionOut: scene.emotion.transitionOut,
        duration: scene.timing?.duration_seconds
      });
    }
  }

  buildEmotionalContinuityNotes() {
    const validation = this.emotionalEngine.validateArc();
    const arcDescription = this.emotionalEngine.buildEmotionalArcDescription();

    if (!validation.valid) {
      const warnings = validation.suggestions
        .map(s => `${s.reason} Recommended: ${s.recommendedTransition}`)
        .join(' ');
      return `Emotional continuity warning: ${validation.summary} ${warnings}`;
    }

    return arcDescription || '';
  }

  toJSON() {
    return {
      characters: Object.fromEntries(this.characters),
      environments: Object.fromEntries(this.environments),
      lighting: Object.fromEntries(this.lighting),
      colorPalette: this.colorPalette,
      objectStates: Object.fromEntries(this.objectStates),
      emotional: this.emotionalEngine.toJSON()
    };
  }
}
