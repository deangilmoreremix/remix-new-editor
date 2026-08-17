import {
  SHOT_TYPES,
  CAMERA_MOVEMENTS,
  LIGHTING_STYLES,
  EMOTIONAL_TONES,
  TRANSITION_TYPES
} from './sceneSchema.js';
import { characterRegistry } from './characterRegistry.js';
import { environmentRegistry } from './environmentRegistry.js';

export class ShotPromptBuilder {
  constructor(options = {}) {
    this.options = {
      model: options.model || 'kling',
      aspectRatio: options.aspectRatio || '16:9',
      resolution: options.resolution || '1080p',
      fps: options.fps || 24,
      ...options
    };
  }

  buildPrompt(shot, scene, characterContext = [], environmentContext = null) {
    const sections = [];

    sections.push(this._buildSystemStyle());
    sections.push(this._buildCharacter(characterContext));
    sections.push(this._buildEnvironment(environmentContext || (scene?.environment ? { id: scene.environment } : null)));
    sections.push(this._buildAction(shot));
    sections.push(this._buildComposition(shot));
    sections.push(this._buildCamera(shot));
    sections.push(this._buildLens(shot));
    sections.push(this._buildLighting(shot, environmentContext));
    sections.push(this._buildEmotion(shot, scene));
    sections.push(this._buildMotion(shot, scene));
    sections.push(this._buildContinuity(scene));
    sections.push(this._buildGenerationConstraints());

    return sections.filter(Boolean).join('\n\n');
  }

  buildNegativePrompt(shot, scene) {
    const parts = [];

    const emotion = shot?.emotion || scene?.emotion || {};
    if (emotion.primary && emotion.primary !== EMOTIONAL_TONES.NEUTRAL) {
      parts.push(`avoid opposite emotional tone to ${emotion.primary}`);
    }

    parts.push(
      'blurry, out of focus, low quality, distorted, deformed, ugly, bad anatomy, ' +
      'watermark, text, logo, UI elements, oversaturated, underexposed, overexposed, ' +
      'noise, grain, artifacts, flickering, jitter, stutter, inconsistent frame rate, ' +
      'duplicate faces, cloned limbs, extra fingers, mutated hands, malformed features'
    );

    if (shot?.shot_type === SHOT_TYPES.WIDE || shot?.shot_type === SHOT_TYPES.EXTREME_WIDE) {
      parts.push('avoid empty or meaningless background');
    }

    if (shot?.subject_action?.action) {
      parts.push('avoid motion blur that obscures subject');
    }

    return parts.join(', ');
  }

  buildCameraDirection(shot) {
    const parts = [];

    parts.push(`SHOT TYPE: ${this._formatShotType(shot?.shot_type || shot?.camera?.position)}`);

    const camera = shot?.camera || {};
    if (camera.position) parts.push(`POSITION: ${camera.position}`);
    if (camera.angle) parts.push(`ANGLE: ${camera.angle}`);
    if (camera.movement && camera.movement !== CAMERA_MOVEMENTS.STATIC) {
      parts.push(`MOVEMENT: ${camera.movement}${camera.movement_speed ? ` at ${camera.movement_speed} speed` : ''}`);
    }

    const lens = shot?.lens || {};
    if (lens.focal_length) parts.push(`FOCAL LENGTH: ${lens.focal_length}`);
    if (lens.lens_type) parts.push(`LENS: ${lens.lens_type}`);
    if (lens.aperture) parts.push(`APERTURE: ${lens.aperture}`);
    if (lens.depth_of_field) parts.push(`DEPTH OF FIELD: ${lens.depth_of_field}`);
    if (lens.bokeh) parts.push(`BOKEH: ${lens.bokeh}`);

    return parts.join('\n');
  }

  buildLightingDirection(shot, environment = null) {
    const parts = [];
    const lighting = shot?.lighting || {};

    parts.push(`LIGHTING STYLE: ${this._formatLightingStyle(lighting.style || LIGHTING_STYLES.NATURAL)}`);

    if (lighting.key_light) parts.push(`KEY LIGHT: ${lighting.key_light}`);
    if (lighting.fill_light) parts.push(`FILL LIGHT: ${lighting.fill_light}`);
    if (lighting.rim_light) parts.push(`RIM LIGHT: ${lighting.rim_light}`);
    if (lighting.practical_lights?.length) {
      parts.push(`PRACTICAL LIGHTS: ${lighting.practical_lights.join(', ')}`);
    }
    if (lighting.volumetric_light) parts.push('VOLUMETRIC LIGHT: enabled');

    if (environment?.lighting?.natural) {
      parts.push(`ENVIRONMENT NATURAL LIGHT: ${environment.lighting.natural}`);
    }
    if (environment?.lighting?.artificial?.length) {
      parts.push(`ENVIRONMENT ARTIFICIAL: ${environment.lighting.artificial.join(', ')}`);
    }

    return parts.join('\n');
  }

  buildContinuityNotes(scene, previousScene = null) {
    const parts = [];

    if (previousScene) {
      parts.push('PREVIOUS SCENE CONTINUITY:');
      if (previousScene.characters?.length && scene?.characters?.length) {
        const shared = previousScene.characters.filter(c => scene.characters.includes(c));
        if (shared.length) {
          parts.push(`Characters carried over: ${shared.join(', ')}`);
        }
      }
      if (previousScene.environment && scene?.environment) {
        if (previousScene.environment === scene.environment) {
          parts.push('Same environment maintained');
        }
      }
    }

    parts.push('CURRENT SCENE CONTINUITY:');
    if (scene?.characters?.length) {
      parts.push(`Characters: ${scene.characters.join(', ')}`);
      scene.characters.forEach(charId => {
        const rules = characterRegistry.getContinuityRules(charId);
        if (rules.length) {
          parts.push(`  ${charId}: ${rules.join(', ')}`);
        }
      });
    }
    if (scene?.environment) {
      const envRef = environmentRegistry.getContinuityReference(scene.environment);
      if (envRef) {
        parts.push(`Environment locked: ${environmentRegistry.getEnvironmentSummary(scene.environment)}`);
      }
    }
    if (scene?.continuity?.props?.length) {
      parts.push(`Props state: ${scene.continuity.props.join(', ')}`);
    }
    if (scene?.continuity?.wardrobe?.length) {
      parts.push(`Wardrobe locked: ${scene.continuity.wardrobe.join(', ')}`);
    }

    return parts.join('\n');
  }

  _buildSystemStyle() {
    return 'CINEMATIC PHOTOREALISTIC VIDEO. High production value, professional color grading, filmic texture, ' +
           'natural motion, seamless continuity, broadcast quality, optimized for AI video generation models.';
  }

  _buildCharacter(characterContext = []) {
    if (!characterContext || characterContext.length === 0) return '';

    const parts = ['CHARACTER:'];

    characterContext.forEach(charId => {
      const char = characterRegistry.get(charId);
      if (!char) return;

      const header = `[${char.name || char.character_id}]`;
      const details = [];
      details.push(characterRegistry.getAppearanceSummary(char.character_id));
      details.push(characterRegistry.getWardrobeSummary(char.character_id));

      const nonEmpty = details.filter(Boolean);
      if (nonEmpty.length) {
        parts.push(`${header} ${nonEmpty.join('. ')}`);
      }
    });

    return parts.join('\n');
  }

  _buildEnvironment(environmentCtx) {
    if (!environmentCtx) return '';

    const envId = environmentCtx.id || environmentCtx.environment_id;
    const env = environmentRegistry.get(envId);
    if (!env) return '';

    const parts = ['ENVIRONMENT:'];
    parts.push(environmentRegistry.getEnvironmentSummary(envId));

    if (env.weather?.condition && env.weather.condition !== 'clear') {
      parts.push(`Weather: ${env.weather.condition}${env.weather.intensity && env.weather.intensity !== 'light' ? ` (${env.weather.intensity})` : ''}`);
      if (env.weather.wind && env.weather.wind !== 'none') parts.push(`Wind: ${env.weather.wind}`);
      if (env.weather.fog && env.weather.fog !== 'none') parts.push(`Fog: ${env.weather.fog}`);
    }

    if (env.architecture?.materials?.length) {
      parts.push(`Materials: ${env.architecture.materials.join(', ')}`);
    }

    if (env.background_activity?.length) {
      parts.push(`Background activity: ${env.background_activity.join(', ')}`);
    }

    return parts.join('\n');
  }

  _buildAction(shot) {
    if (!shot) return '';
    const action = shot.subject_action?.action || shot.subject?.description;
    if (!action) return '';
    return `ACTION:\nSubject ${action}.${shot.subject_action?.motion && shot.subject_action.motion !== 'static' ? ` Motion: ${shot.subject_action.motion}.` : ''}`;
  }

  _buildComposition(shot) {
    if (!shot || !shot.composition) return '';
    const c = shot.composition;
    const parts = ['COMPOSITION:'];
    if (c.framing) parts.push(`Framing: ${c.framing}`);
    if (c.subject_position) parts.push(`Subject position: ${c.subject_position}`);
    if (c.foreground?.length) parts.push(`Foreground: ${c.foreground.join(', ')}`);
    if (c.midground?.length) parts.push(`Midground: ${c.midground.join(', ')}`);
    if (c.background?.length) parts.push(`Background: ${c.background.join(', ')}`);
    return parts.join('\n');
  }

  _buildCamera(shot) {
    if (!shot) return '';
    const parts = ['CAMERA:'];
    parts.push(this._formatShotType(shot.shot_type || shot.camera?.position));

    const camera = shot.camera || {};
    if (camera.position) parts.push(`Position: ${camera.position}`);
    if (camera.angle) parts.push(`Angle: ${camera.angle}`);
    if (camera.movement && camera.movement !== CAMERA_MOVEMENTS.STATIC) {
      parts.push(`Movement: ${camera.movement}`);
      if (camera.movement_speed) parts.push(`Movement speed: ${camera.movement_speed}`);
    }
    if (camera.start_position) parts.push(`Start position: ${camera.start_position}`);
    if (camera.end_position) parts.push(`End position: ${camera.end_position}`);

    return parts.join('\n');
  }

  _buildLens(shot) {
    if (!shot || !shot.lens) return '';
    const l = shot.lens;
    const parts = ['LENS:'];
    if (l.focal_length) parts.push(`Focal length: ${l.focal_length}`);
    if (l.lens_type) parts.push(`Lens type: ${l.lens_type}`);
    if (l.aperture) parts.push(`Aperture: ${l.aperture}`);
    if (l.depth_of_field) parts.push(`Depth of field: ${l.depth_of_field}`);
    if (l.bokeh) parts.push(`Bokeh: ${l.bokeh}`);
    return parts.join('\n');
  }

  _buildLighting(shot, environment = null) {
    if (!shot) return '';
    const lighting = shot.lighting || {};
    const parts = ['LIGHTING:'];

    parts.push(`Style: ${this._formatLightingStyle(lighting.style || LIGHTING_STYLES.NATURAL)}`);

    if (lighting.key_light) parts.push(`Key light: ${lighting.key_light}`);
    if (lighting.fill_light) parts.push(`Fill light: ${lighting.fill_light}`);
    if (lighting.rim_light) parts.push(`Rim light: ${lighting.rim_light}`);
    if (lighting.practical_lights?.length) parts.push(`Practical lights: ${lighting.practical_lights.join(', ')}`);
    if (lighting.volumetric_light) parts.push('Volumetric light: enabled');

    if (environment?.lighting?.natural) {
      parts.push(`Natural: ${environment.lighting.natural}`);
    }
    if (environment?.lighting?.artificial?.length) {
      parts.push(`Artificial: ${environment.lighting.artificial.join(', ')}`);
    }

    return parts.join('\n');
  }

  _buildEmotion(shot, scene) {
    const emotion = shot?.emotion || scene?.emotion || {};
    if (!emotion.primary) return '';

    const parts = ['EMOTION:'];
    parts.push(`Primary: ${emotion.primary}`);
    if (emotion.secondary) parts.push(`Secondary: ${emotion.secondary}`);
    if (typeof emotion.intensity === 'number') {
      parts.push(`Intensity: ${Math.round(emotion.intensity * 100)}%`);
    }
    if (emotion.emotional_arc) parts.push(`Arc: ${emotion.emotional_arc}`);

    return parts.join('\n');
  }

  _buildMotion(shot, scene) {
    const camera = shot?.camera || {};
    const action = shot?.subject_action?.action;
    const motion = shot?.subject_action?.motion;

    if (!camera.movement || camera.movement === CAMERA_MOVEMENTS.STATIC) {
      if (!motion || motion === 'static') return '';
    }

    const parts = ['MOTION:'];
    if (camera.movement && camera.movement !== CAMERA_MOVEMENTS.STATIC) {
      parts.push(`Camera ${camera.movement}${camera.movement_speed ? ` at ${camera.movement_speed} speed` : ''}${camera.start_position && camera.end_position ? ` from ${camera.start_position} to ${camera.end_position}` : ''}`);
    }
    if (action) parts.push(`Subject: ${action}`);
    if (motion && motion !== 'static') parts.push(`Motion quality: ${motion}`);

    return parts.join('\n');
  }

  _buildContinuity(scene) {
    if (!scene) return '';
    const parts = ['CONTINUITY:'];
    const c = scene.continuity || {};

    if (scene.characters?.length) {
      parts.push(`Characters: ${scene.characters.join(', ')}`);
    }
    if (scene.environment) {
      const envSummary = environmentRegistry.getEnvironmentSummary(scene.environment);
      if (envSummary) parts.push(`Environment: ${envSummary}`);
    }
    if (c.props?.length) parts.push(`Props: ${c.props.join(', ')}`);
    if (c.wardrobe?.length) parts.push(`Wardrobe: ${c.wardrobe.join(', ')}`);
    if (c.lighting?.length) parts.push(`Lighting continuity: ${c.lighting.join(', ')}`);
    if (c.color?.length) parts.push(`Color continuity: ${c.color.join(', ')}`);

    return parts.join('\n');
  }

  _buildGenerationConstraints() {
    const parts = ['GENERATION CONSTRAINTS:'];
    parts.push(`Aspect ratio: ${this.options.aspectRatio}`);
    parts.push(`Resolution: ${this.options.resolution}`);
    parts.push(`FPS: ${this.options.fps}`);
    parts.push(`Model notes: optimized for ${this.options.model} video generation`);

    if (this.options.model === 'kling') {
      parts.push('Kling-specific: maintain strong subject focus, smooth motion, consistent character identity');
    } else if (this.options.model === 'runway') {
      parts.push('Runway-specific: prioritize motion coherence, avoid rapid scene changes within shot');
    } else if (this.options.model === 'pika') {
      parts.push('Pika-specific: emphasize cinematic framing, clean subject separation, natural motion physics');
    }

    return parts.join('\n');
  }

  _formatShotType(shotType) {
    if (!shotType) return 'unknown';
    return shotType.replace(/_/g, ' ').toUpperCase();
  }

  _formatLightingStyle(style) {
    if (!style) return 'natural';
    return style.replace(/_/g, ' ').toUpperCase();
  }
}

export const shotPromptBuilder = new ShotPromptBuilder();
