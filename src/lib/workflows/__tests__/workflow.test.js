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
