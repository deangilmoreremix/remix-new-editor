import { describe, it, expect } from 'vitest';
import { NODE_REGISTRY } from '../node-registry.js';

describe('Node Registry', () => {
  it('exposes prompt node definition', () => {
    const node = NODE_REGISTRY.prompt;
    expect(node).toBeDefined();
    expect(node.type).toBe('prompt');
    expect(node.label).toBe('Prompt');
    expect(node.category).toBe('utility');
    expect(node.inputs).toEqual([]);
    expect(node.outputs).toEqual([{ id: 'text', type: 'text', label: 'text' }]);
    expect(node.defaultData).toEqual({ prompt: '' });
  });

  it('exposes multiPrompt node definition', () => {
    const node = NODE_REGISTRY.multiPrompt;
    expect(node).toBeDefined();
    expect(node.type).toBe('multiPrompt');
    expect(node.outputs).toEqual([{ id: 'multi_prompt', type: 'multi_prompt', label: 'multi_prompt' }]);
    expect(node.defaultData.shots).toBeInstanceOf(Array);
  });

  it('exposes assetOutput node definition', () => {
    const node = NODE_REGISTRY.assetOutput;
    expect(node).toBeDefined();
    expect(node.type).toBe('assetOutput');
    expect(node.inputs).toEqual(
      expect.arrayContaining([
        { id: 'image', type: 'image', label: 'image' },
        { id: 'video', type: 'video', label: 'video' },
      ])
    );
  });

  it('exposes element node definition', () => {
    const node = NODE_REGISTRY.element;
    expect(node).toBeDefined();
    expect(node.type).toBe('element');
    expect(node.outputs).toEqual([{ id: 'element', type: 'image', label: 'element' }]);
  });

  it('exposes compositionPlan node definition', () => {
    const node = NODE_REGISTRY.compositionPlan;
    expect(node).toBeDefined();
    expect(node.type).toBe('compositionPlan');
    expect(node.outputs).toEqual([{ id: 'composition_plan', type: 'composition_plan', label: 'plan' }]);
    expect(node.defaultData.sections).toBeInstanceOf(Array);
  });

  it('exposes musicPrompt node definition', () => {
    const node = NODE_REGISTRY.musicPrompt;
    expect(node).toBeDefined();
    expect(node.type).toBe('musicPrompt');
    expect(node.inputs).toEqual(
      expect.arrayContaining([
        { id: 'video', type: 'video', label: 'video' },
      ])
    );
  });

  it('all required node types are present', () => {
    const requiredTypes = [
      'prompt',
      'multiPrompt',
      'assetOutput',
      'element',
      'compositionPlan',
      'musicPrompt',
      'filePicker',
      'shotBoard',
      'storyboarder',
    ];
    for (const type of requiredTypes) {
      expect(NODE_REGISTRY[type]).toBeDefined();
    }
  });
});

describe('Workflow Execution Engine', () => {
  it('resolveInputs extracts values from connected edges', async () => {
    const { resolveInputs } = await import('../execute.js');
    const portDefs = [{ id: 'text', type: 'text', label: 'text' }];
    const edges = [
      { source: 'node-1', sourceHandle: 'text', target: 'node-2', targetHandle: 'text' },
    ];
    const results = new Map([
      ['node-1', { text: 'hello world' }],
    ]);

    const inputs = resolveInputs(portDefs, edges, 'node-2', results);
    expect(inputs.text).toBe('hello world');
  });

  it('resolveInputs returns empty object when no edges connected', async () => {
    const { resolveInputs } = await import('../execute.js');
    const portDefs = [{ id: 'text', type: 'text', label: 'text' }];
    const edges = [];
    const results = new Map();

    const inputs = resolveInputs(portDefs, edges, 'node-2', results);
    expect(inputs).toEqual({});
  });

  it('resolveInputs ignores edges with missing source result', async () => {
    const { resolveInputs } = await import('../execute.js');
    const portDefs = [{ id: 'text', type: 'text', label: 'text' }];
    const edges = [
      { source: 'node-1', sourceHandle: 'text', target: 'node-2', targetHandle: 'text' },
    ];
    const results = new Map();

    const inputs = resolveInputs(portDefs, edges, 'node-2', results);
    expect(inputs).toEqual({});
  });

  it('resolveUtilityOutputs returns prompt text for prompt nodes', async () => {
    const { resolveUtilityOutputs } = await import('../execute.js');
    const outputs = [{ id: 'text', type: 'text', label: 'text' }];
    const data = { config: { prompt: 'a cinematic sunset' } };

    const result = resolveUtilityOutputs('prompt', outputs, data, {});
    expect(result.text).toBe('a cinematic sunset');
  });

  it('resolveUtilityOutputs returns shots for multiPrompt nodes', async () => {
    const { resolveUtilityOutputs } = await import('../execute.js');
    const outputs = [{ id: 'multi_prompt', type: 'multi_prompt', label: 'multi_prompt' }];
    const data = { config: { shots: [{ prompt: 'shot 1', duration: 5 }] } };

    const result = resolveUtilityOutputs('multiPrompt', outputs, data, {});
    expect(result.multi_prompt).toEqual([{ prompt: 'shot 1', duration: 5 }]);
  });

  it('resolveUtilityOutputs returns composition plan data', async () => {
    const { resolveUtilityOutputs } = await import('../execute.js');
    const outputs = [{ id: 'composition_plan', type: 'composition_plan', label: 'plan' }];
    const sections = [{ name: 'intro', positiveStyles: '', negativeStyles: '', durationMs: 15000, lines: '' }];
    const data = {
      config: {
        positiveGlobalStyles: 'warm',
        negativeGlobalStyles: 'dark',
        sections,
      },
    };

    const result = resolveUtilityOutputs('compositionPlan', outputs, data, {});
    expect(result.composition_plan).toEqual({
      positiveGlobalStyles: 'warm',
      negativeGlobalStyles: 'dark',
      sections,
    });
  });

  it('resolveUtilityOutputs returns music prompt for musicPrompt nodes', async () => {
    const { resolveUtilityOutputs } = await import('../execute.js');
    const outputs = [{ id: 'text', type: 'text', label: 'prompt' }];
    const data = { config: { generatedPrompt: 'upbeat electronic track' } };

    const result = resolveUtilityOutputs('musicPrompt', outputs, data, {});
    expect(result.text).toBe('upbeat electronic track');
  });

  it('resolveUtilityOutputs returns empty string when musicPrompt has no generatedPrompt', async () => {
    const { resolveUtilityOutputs } = await import('../execute.js');
    const outputs = [{ id: 'text', type: 'text', label: 'prompt' }];
    const data = { config: {} };

    const result = resolveUtilityOutputs('musicPrompt', outputs, data, {});
    expect(result.text).toBe('');
  });
});

describe('Timeline Bridge', () => {
  it('addClipToTrack is importable from timeline-operations', async () => {
    const { addClipToTrack } = await import('../../editor/timeline-operations.js');
    expect(typeof addClipToTrack).toBe('function');
  });

  it('addClipToTrack creates a valid clip on the correct track', async () => {
    const { addClipToTrack } = await import('../../editor/timeline-operations.js');
    const timeline = {
      id: 'timeline-1',
      name: 'Test Timeline',
      tracks: [
        { id: 'track-1', kind: 'video', clips: [] },
      ],
      clips: [],
    };

    const asset = {
      id: 'asset-1',
      name: 'Test Clip',
      type: 'video',
      url: 'https://example.com/video.mp4',
      duration: 5000,
    };

    const result = addClipToTrack(timeline, 'track-1', asset, 0);
    // Video on video track creates both video and linked audio clip
    expect(result.clips.length).toBeGreaterThanOrEqual(1);
    const videoClip = result.clips[0];
    expect(videoClip.name).toBe('Test Clip');
    expect(videoClip.startTime).toBe(0);
    expect(videoClip.duration).toBe(5000);
  });

  it('addClipToTrack places clip at correct start time', async () => {
    const { addClipToTrack } = await import('../../editor/timeline-operations.js');
    const timeline = {
      id: 'timeline-1',
      name: 'Test Timeline',
      tracks: [
        { id: 'track-1', kind: 'video', clips: [] },
      ],
      clips: [],
    };

    const asset = {
      id: 'asset-2',
      name: 'Test Clip 2',
      type: 'video',
      url: 'https://example.com/video2.mp4',
      duration: 3000,
    };

    const result = addClipToTrack(timeline, 'track-1', asset, 10000);
    const videoClip = result.clips[0];
    expect(videoClip).toBeDefined();
    expect(videoClip.startTime).toBe(10000);
    expect(videoClip.duration).toBe(3000);
  });
});
