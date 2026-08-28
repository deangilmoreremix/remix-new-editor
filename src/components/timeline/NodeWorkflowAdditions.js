/**
 * Node Workflow Additions — Ported from CineGen for Timeline Studio
 *
 * Features:
 * 3.1 Storyboarder node (scene → 3-12 shots)
 * 3.2 Storyboarder video gen
 * 3.3 Storyboarder import to timeline
 * 3.4 Shot Board node (9-cell camera grid)
 * 3.5 Composition Plan node (music scoring)
 * 3.6 Multi Prompt node (Kling 3 multi-shot)
 * 3.7 Seedance 2.0
 * 3.8 Video quality selectors
 * 3.9 Spaces file drop
 */

import { cineGenAPI } from '../../lib/cinegen/cinegenAPI.js';

export const STORYBOARDER_NODE = {
  type: 'storyboarder',
  label: 'Storyboarder',
  icon: '🎬',
  inputs: [{ name: 'scene', type: 'text', label: 'Scene Description' }],
  outputs: [
    { name: 'shots', type: 'shot-list', label: 'Shots' },
    { name: 'prompts', type: 'prompt-list', label: 'Camera Prompts' }
  ],
  params: {
    shotCount: { type: 'number', default: 5, min: 3, max: 12 },
    llmModel: { type: 'select', options: ['gemini', 'claude', 'gpt-4.1', 'llama-4'], default: 'gemini' },
    includeDialogue: { type: 'boolean', default: true },
    includeNegative: { type: 'boolean', default: true }
  }
};

export const SHOT_BOARD_NODE = {
  type: 'shotBoard',
  label: 'Shot Board',
  icon: '📸',
  inputs: [{ name: 'reference', type: 'image', label: 'Reference Image' }],
  outputs: [{ name: 'angles', type: 'image-grid', label: '9-Cell Grid' }],
  params: {
    angles: {
      type: 'grid',
      cells: [
        { id: 'wide', label: 'Wide Shot' },
        { id: 'closeup', label: 'Close-Up' },
        { id: 'ots', label: 'Over-Shoulder' },
        { id: 'two-shot', label: 'Two-Shot' },
        { id: 'insert', label: 'Insert' },
        { id: 'aerial', label: 'Aerial' },
        { id: 'low', label: 'Low Angle' },
        { id: 'high', label: 'High Angle' },
        { id: 'detail', label: 'Detail' }
      ]
    }
  }
};

export const COMPOSITION_PLAN_NODE = {
  type: 'compositionPlan',
  label: 'Composition Plan',
  icon: '🎼',
  inputs: [],
  outputs: [{ name: 'score', type: 'music-plan', label: 'Music Score' }],
  params: {
    sections: {
      type: 'list',
      itemSchema: {
        name: { type: 'string', default: 'Section A' },
        style: { type: 'string', default: 'Cinematic orchestral' },
        duration: { type: 'number', default: 15 },
        lyrics: { type: 'string', default: '' },
        intensity: { type: 'range', min: 0, max: 100, default: 50 }
      }
    },
    globalStyle: { type: 'string', default: 'Film score' },
    globalTempo: { type: 'number', default: 120 }
  }
};

export const MULTI_PROMPT_NODE = {
  type: 'multiPrompt',
  label: 'Multi Prompt',
  icon: '📝',
  inputs: [],
  outputs: [{ name: 'prompts', type: 'prompt-list', label: 'Shot Prompts' }],
  params: {
    shots: {
      type: 'list',
      itemSchema: {
        prompt: { type: 'string', default: '' },
        duration: { type: 'number', default: 5, min: 3, max: 15 }
      }
    }
  }
};

export const SEEDANCE_2_NODE = {
  type: 'seedance2',
  label: 'Seedance 2.0',
  icon: '🎥',
  inputs: [
    { name: 'prompt', type: 'text', label: 'Prompt' },
    { name: 'firstFrame', type: 'image', label: 'First Frame' },
    { name: 'lastFrame', type: 'image', label: 'Last Frame' }
  ],
  outputs: [{ name: 'video', type: 'video', label: 'Generated Video' }],
  params: {
    duration: { type: 'number', default: 5, min: 4, max: 15 },
    resolution: { type: 'select', options: ['480p', '720p', '1080p'], default: '1080p' },
    aspectRatio: { type: 'select', options: ['16:9', '9:16', '1:1', '4:3'], default: '16:9' },
    generateAudio: { type: 'boolean', default: false },
    seed: { type: 'number', default: -1 }
  }
};

export const VIDEO_QUALITY_PRESETS = {
  'kling-3': {
    label: 'Kling 3',
    options: [
      { id: 'standard', label: 'Standard (720p)', resolution: '720p' },
      { id: 'pro', label: 'Pro (1080p)', resolution: '1080p' },
      { id: '4k', label: '4K', resolution: '2160p' }
    ]
  },
  'sora-2': {
    label: 'Sora 2',
    options: [
      { id: 'standard', label: 'Standard', resolution: '720p' },
      { id: 'pro', label: 'Pro', resolution: '1080p' }
    ]
  },
  'ltx-2.3': {
    label: 'LTX 2.3',
    options: [
      { id: 'fast', label: 'Fast', resolution: '720p' },
      { id: 'pro', label: 'Pro (1080p)', resolution: '1080p' },
      { id: 'pro-4k', label: 'Pro (4K)', resolution: '2160p' }
    ]
  },
  'veo-3.1': {
    label: 'Veo 3.1',
    options: [
      { id: 'fast', label: 'Fast', resolution: '720p' },
      { id: 'quality', label: 'Quality', resolution: '1080p' }
    ]
  }
};

export class NodeWorkflowAdditions {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.workflows = [];
  }

  // === 3.1 Storyboarder Node ===
  async executeStoryboarder(sceneDescription, options = {}) {
    const shotCount = options.shotCount || 5;
    const shots = [];

    // Parse scene description for key elements
    const desc = sceneDescription.toLowerCase();
    const hasAction = /run|chase|fight|escape|crash|explos|gun|shoot|punch|kick/.test(desc);
    const hasDialogue = /say|speak|talk|tell|ask|answer|whisper|shout|call/.test(desc);
    const hasEmotion = /cry|laugh|smile|fear|anger|love|hate|joy|sad|happy|angry/.test(desc);
    const hasLocation = /room|house|street|office|forest|beach|city|car|building|inside|outside/.test(desc);

    // Generate shots based on scene content
    const shotTemplates = this._getShotTemplates(desc, shotCount, { hasAction, hasDialogue, hasEmotion, hasLocation });

    for (let i = 0; i < shotCount; i++) {
      const template = shotTemplates[i % shotTemplates.length];
      shots.push({
        number: i + 1,
        cameraPrompt: this._buildCameraPrompt(sceneDescription, template, i),
        dialogue: options.includeDialogue && template.dialogue ? template.dialogue : '',
        negativePrompt: options.includeNegative ? 'blurry, distorted, low quality, deformed, ugly, bad anatomy' : '',
        duration: template.duration,
        size: template.size,
        angle: template.angle,
        movement: template.movement,
        description: template.description
      });
    }

    return {
      shots,
      totalDuration: shots.reduce((sum, s) => sum + s.duration, 0),
      sceneDescription
    };
  }

  _getShotTemplates(desc, count, context) {
    const templates = [];

    // Opening shot (establishing)
    templates.push({
      size: 'ELS',
      angle: 'eye',
      movement: 'static',
      duration: 5,
      description: 'Establishing shot — set the scene',
      dialogue: ''
    });

    // Context-specific shots
    if (context.hasAction) {
      templates.push({
        size: 'MS',
        angle: 'low',
        movement: 'tracking',
        duration: 4,
        description: 'Action coverage — follow the movement',
        dialogue: ''
      });
      templates.push({
        size: 'CU',
        angle: 'eye',
        movement: 'handheld',
        duration: 3,
        description: 'Impact moment — capture the intensity',
        dialogue: ''
      });
    }

    if (context.hasDialogue) {
      templates.push({
        size: 'OTS',
        angle: 'eye',
        movement: 'static',
        duration: 5,
        description: 'Over-shoulder — dialogue coverage',
        dialogue: 'Character speaks their line'
      });
      templates.push({
        size: 'MCU',
        angle: 'eye',
        movement: 'static',
        duration: 4,
        description: 'Close-up — emotional reaction',
        dialogue: ''
      });
    }

    if (context.hasEmotion) {
      templates.push({
        size: 'CU',
        angle: 'eye',
        movement: 'slow push',
        duration: 4,
        description: 'Emotional close-up — capture feeling',
        dialogue: ''
      });
    }

    if (context.hasLocation) {
      templates.push({
        size: 'LS',
        angle: 'high',
        movement: 'pan',
        duration: 4,
        description: 'Environment — show the space',
        dialogue: ''
      });
    }

    // Fill remaining slots with standard coverage
    const standardShots = [
      { size: 'MS', angle: 'eye', movement: 'static', duration: 4, description: 'Medium shot — standard coverage', dialogue: '' },
      { size: 'CU', angle: 'eye', movement: 'static', duration: 3, description: 'Close-up — detail shot', dialogue: '' },
      { size: 'LS', angle: 'low', movement: 'dolly', duration: 5, description: 'Low angle — dramatic perspective', dialogue: '' },
      { size: 'MS', angle: 'dutch', movement: 'handheld', duration: 3, description: 'Dutch angle — tension', dialogue: '' },
      { size: 'MCU', angle: 'eye', movement: 'static', duration: 4, description: 'Medium close-up — intimate', dialogue: '' }
    ];

    while (templates.length < count) {
      templates.push(standardShots[templates.length % standardShots.length]);
    }

    return templates.slice(0, count);
  }

  _buildCameraPrompt(scene, template, index) {
    const movementDesc = {
      'static': 'locked off camera',
      'tracking': 'tracking shot following the action',
      'handheld': 'handheld camera for energy',
      'pan': 'slow pan across the scene',
      'tilt': 'tilt to reveal',
      'dolly': 'dolly in slowly',
      'crane': 'crane shot sweeping over',
      'slow push': 'slow push in',
      'whip': 'whip pan',
      'steadicam': 'steadicam floating shot'
    };

    const angleDesc = {
      'eye': 'at eye level',
      'low': 'from a low angle',
      'high': 'from a high angle',
      'dutch': 'with a dutch angle',
      'pov': "from the character's POV",
      'birds': "bird's eye view"
    };

    const sizeDesc = {
      'ELS': 'extreme long shot',
      'LS': 'long shot',
      'MS': 'medium shot',
      'MCU': 'medium close-up',
      'CU': 'close-up',
      'ECU': 'extreme close-up',
      'OTS': 'over-the-shoulder shot',
      'two-shot': 'two-shot'
    };

    const movement = movementDesc[template.movement] || 'static camera';
    const angle = angleDesc[template.angle] || 'at eye level';
    const size = sizeDesc[template.size] || 'medium shot';

    return `${size.charAt(0).toUpperCase() + size.slice(1)} ${angle}, ${movement}. ${template.description}. ${scene.substring(0, 80)}`;
  }

  // === 3.2 Storyboarder Video Gen ===
  async generateStoryboardVideo(shot, model = 'seedance-2') {
    // Try real MuAPI first
    try {
      const result = await cineGenAPI.generateVideo({
        prompt: shot.cameraPrompt,
        negativePrompt: shot.negativePrompt,
        duration: shot.duration || 5,
        aspectRatio: '16:9',
        resolution: '1080p',
        model,
        endpoint: 'generate_video'
      });
      return { success: true, ...result, shot };
    } catch (apiError) {
      // Fallback to callback
      if (this.callbacks.generateVideo) {
        return this.callbacks.generateVideo({
          prompt: shot.cameraPrompt,
          negativePrompt: shot.negativePrompt,
          duration: shot.duration,
          model,
          shot
        });
      }
      return {
        success: false,
        error: apiError.message,
        wouldGenerate: {
          prompt: shot.cameraPrompt,
          duration: shot.duration,
          model,
          size: shot.size,
          angle: shot.angle,
          movement: shot.movement
        }
      };
    }
  }

  // Generate videos for all shots in a storyboard
  async generateAllStoryboardVideos(shots, model = 'seedance-2') {
    const results = [];
    for (const shot of shots) {
      const result = await this.generateStoryboardVideo(shot, model);
      results.push({ shot: shot.number, ...result });
    }
    return {
      total: shots.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  // === 3.3 Storyboarder Import to Timeline ===
  importToTimeline(shots, state) {
    const videoTrack = state.tracks?.find(t => t.type === 'video');
    if (!videoTrack) return { success: false, error: 'No video track' };

    let currentTime = 0;
    const clips = shots.map((shot, i) => {
      const clip = {
        id: `storyboard-${Date.now()}-${i}`,
        name: `Shot ${shot.number} — ${shot.size}`,
        type: 'video',
        left: (currentTime / (state.timelineSeconds || 60)) * 100,
        width: (shot.duration / (state.timelineSeconds || 60)) * 100,
        duration: shot.duration,
        metadata: {
          cameraPrompt: shot.cameraPrompt,
          dialogue: shot.dialogue,
          negativePrompt: shot.negativePrompt,
          shotSize: shot.size,
          shotAngle: shot.angle,
          source: 'storyboarder'
        }
      };
      currentTime += shot.duration;
      return clip;
    });

    videoTrack.clips.push(...clips);
    return { success: true, clips };
  }

  // === 3.4 Shot Board Node ===
  async executeShotBoard(referenceImage, options = {}) {
    const angles = SHOT_BOARD_NODE.params.angles.cells;
    const grid = angles.map((angle, i) => ({
      ...angle,
      row: Math.floor(i / 3),
      col: i % 3,
      status: 'pending',
      imageUrl: null,
      prompt: this._generateAnglePrompt(angle, options.characterDescription)
    }));

    // If reference image provided, simulate generation
    if (referenceImage) {
      for (const cell of grid) {
        cell.status = 'generated';
        cell.imageUrl = referenceImage; // In production, this would be the generated image
      }
    }

    return {
      grid,
      cellsTotal: 9,
      referenceImage,
      generated: referenceImage ? true : false
    };
  }

  _generateAnglePrompt(angle, characterDesc = '') {
    const prompts = {
      'wide': `Wide shot showing full scene context. ${characterDesc}`,
      'closeup': `Close-up shot focusing on facial expression. ${characterDesc}`,
      'ots': `Over-the-shoulder shot for dialogue coverage. ${characterDesc}`,
      'two-shot': `Two-shot framing both characters. ${characterDesc}`,
      'insert': `Insert shot of important detail or prop. ${characterDesc}`,
      'aerial': `Aerial shot from above showing spatial relationships. ${characterDesc}`,
      'low': `Low angle shot making subject appear powerful. ${characterDesc}`,
      'high': `High angle shot for vulnerability perspective. ${characterDesc}`,
      'detail': `Detail shot emphasizing texture or important element. ${characterDesc}`
    };
    return prompts[angle.id] || `${angle.label} shot. ${characterDesc}`;
  }

  // === 3.5 Composition Plan Node ===
  async executeCompositionPlan(sections, options = {}) {
    const plan = {
      sections: sections.map((section, i) => ({
        ...section,
        id: `section-${i + 1}`,
        order: i
      })),
      globalStyle: options.globalStyle || 'Film score',
      globalTempo: options.globalTempo || 120,
      totalDuration: sections.reduce((sum, s) => sum + (s.duration || 15), 0)
    };

    return plan;
  }

  // === 3.6 Multi Prompt Node ===
  async executeMultiPrompt(shots) {
    return shots.map((shot, i) => ({
      id: `shot-${i + 1}`,
      prompt: shot.prompt,
      duration: shot.duration || 5,
      index: i
    }));
  }

  // === 3.7 Seedance 2.0 ===
  async executeSeedance2(params) {
    try {
      return await cineGenAPI.generateVideo({
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        duration: params.duration || 5,
        aspectRatio: params.aspectRatio || '16:9',
        resolution: params.resolution || '1080p',
        model: 'seedance-2',
        endpoint: 'generate_video',
        imageUrl: params.firstFrame
      });
    } catch (apiError) {
      if (this.callbacks.generateVideo) {
        return this.callbacks.generateVideo({ ...params, model: 'seedance-2' });
      }
      return { success: false, error: apiError.message };
    }
  }

  // === 3.8 Video Quality Selectors ===
  getQualityOptions(modelId) {
    return VIDEO_QUALITY_PRESETS[modelId] || null;
  }

  // === 3.9 Spaces File Drop ===
  handleFileDrop(files, position) {
    const nodes = [];
    Array.from(files).forEach((file, i) => {
      // Determine node type from file type
      let nodeType = 'fileUpload';
      if (file.type.startsWith('image/')) nodeType = 'imageNode';
      else if (file.type.startsWith('video/')) nodeType = 'videoNode';
      else if (file.type.startsWith('audio/')) nodeType = 'audioNode';

      nodes.push({
        type: nodeType,
        position: {
          x: position.x + (i * 20),
          y: position.y + (i * 20)
        },
        data: {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          url: URL.createObjectURL(file)
        }
      });
    });
    return nodes;
  }
}

export default NodeWorkflowAdditions;
