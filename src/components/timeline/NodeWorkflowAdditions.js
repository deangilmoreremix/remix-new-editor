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

    // Generate shots from scene description
    for (let i = 0; i < shotCount; i++) {
      shots.push({
        number: i + 1,
        cameraPrompt: this._generateCameraPrompt(sceneDescription, i, shotCount),
        dialogue: options.includeDialogue ? this._generateDialogue(sceneDescription, i) : '',
        negativePrompt: options.includeNegative ? 'blurry, distorted, low quality' : '',
        duration: 5,
        size: this._getShotSize(i, shotCount),
        angle: this._getShotAngle(i)
      });
    }

    return {
      shots,
      totalDuration: shots.reduce((sum, s) => sum + s.duration, 0)
    };
  }

  _generateCameraPrompt(scene, index, total) {
    const sizes = ['Wide establishing shot', 'Medium shot', 'Close-Up', 'Over-the-shoulder', 'Insert'];
    const size = sizes[index % sizes.length];
    return `${size} — ${scene.substring(0, 50)}...`;
  }

  _generateDialogue(scene, index) {
    return index === 0 ? `"${scene.substring(0, 30)}..."` : '';
  }

  _getShotSize(index, total) {
    const sizes = ['WS', 'MS', 'CU', 'OTS', 'MCU'];
    return sizes[index % sizes.length];
  }

  _getShotAngle(index) {
    const angles = ['eye', 'low', 'high', 'OTS', 'POV'];
    return angles[index % angles.length];
  }

  // === 3.2 Storyboarder Video Gen ===
  async generateStoryboardVideo(shot, model = 'seedance-2') {
    if (this.callbacks.generateVideo) {
      return this.callbacks.generateVideo({
        prompt: shot.cameraPrompt,
        duration: shot.duration,
        model
      });
    }
    return { success: false, error: 'Video generation not configured' };
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
      imageUrl: null
    }));

    return {
      grid,
      cellsTotal: 9,
      referenceImage
    };
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
    if (this.callbacks.generateVideo) {
      return this.callbacks.generateVideo({
        ...params,
        model: 'seedance-2'
      });
    }
    return { success: false, error: 'Video generation not configured' };
  }

  // === 3.8 Video Quality Selectors ===
  getQualityOptions(modelId) {
    return VIDEO_QUALITY_PRESETS[modelId] || null;
  }

  // === 3.9 Spaces File Drop ===
  handleFileDrop(files, position) {
    const nodes = [];
    Array.from(files).forEach((file, i) => {
      nodes.push({
        type: 'fileUpload',
        position: {
          x: position.x + (i * 20),
          y: position.y + (i * 20)
        },
        data: {
          fileName: name,
          fileType: file.type,
          fileSize: file.size
        }
      });
    });
    return nodes;
  }
}

export default NodeWorkflowAdditions;
