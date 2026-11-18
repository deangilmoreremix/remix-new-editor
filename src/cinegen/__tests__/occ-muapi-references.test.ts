// [remix] Element references on MuAPI image models (found by CineGen's own prompt-elements tests): text-to-image models get a reference port
// and requests carrying references are routed to the model's `-edit` sibling.
import { describe, it, expect, vi } from 'vitest';
import type { Node } from '@xyflow/react';
import type { Element } from '@cinegen/types/elements';
import type { WorkflowNodeData } from '@cinegen/types/workflow';
import { getModelDefinition, ALL_MODELS } from '@cinegen/lib/fal/models';
import { referenceSibling, REFERENCE_PORT_ID } from '@cinegen/lib/muapi/model-catalog';
import { bindPromptMentionsToGraph } from '@cinegen/lib/llm/prompt-elements';

const run = vi.fn(async () => ({ url: 'https://x/y.png', urls: ['https://x/y.png'] }));
vi.mock('../../lib/editor/ai/timelineMuapi.js', () => ({ runTimelineMuapi: (...a: unknown[]) => (run as any)(...a) }));

const peter: Element = { id: 'el-peter', name: 'Peter', type: 'character', description: '', images: [{ id: 'i', url: 'https://x/peter.png', createdAt: '', source: 'upload' }], createdAt: '', updatedAt: '' };

describe('MuAPI image references', () => {
  it('nano-banana-2 (text-to-image) exposes an optional multi-image reference port; its -edit sibling is the target', () => {
    const def = getModelDefinition('nano-banana-2')!;
    const port = def.inputs.find((f) => f.id === REFERENCE_PORT_ID);
    expect(port).toMatchObject({ fieldType: 'port', portType: 'image', multiple: true, required: false });
    expect(referenceSibling(ALL_MODELS, 'nano-banana-2')).toBe('nano-banana-2-edit');
  });
  it('an @mention wires the Element into the model reference port', () => {
    const prompt: Node<WorkflowNodeData> = { id: 'p', type: 'prompt', position: { x: 0, y: 0 }, data: { type: 'prompt', label: 'Prompt', config: { prompt: '@Peter on a roof' } } as never };
    const model: Node<WorkflowNodeData> = { id: 'm', type: 'nano-banana-2', position: { x: 1, y: 0 }, data: { type: 'nano-banana-2', label: 'NB2', config: {} } as never };
    const out = bindPromptMentionsToGraph({ nodes: [prompt, model], edges: [{ id: 'e', source: 'p', sourceHandle: 'text', target: 'm', targetHandle: 'prompt' }] as never, promptNodeIds: ['p'], elements: [peter] });
    const el = out.nodes.find((n) => n.type === 'element');
    expect(el).toBeTruthy();
    expect(out.edges.some((e) => e.source === el!.id && e.target === 'm' && e.targetHandle === REFERENCE_PORT_ID)).toBe(true);
  });
  it('requests with references go to the -edit endpoint; without them to the base model', async () => {
    const { runWorkflow } = await import('@cinegen/lib/cloud/funding');
    await runWorkflow({ nodeType: 'nano-banana-2', nodeId: 'n', inputs: { prompt: 'x', [REFERENCE_PORT_ID]: ['https://x/peter.png'] } } as never);
    expect(run).toHaveBeenLastCalledWith('generate', expect.objectContaining({ model: 'nano-banana-2-edit' }));
    await runWorkflow({ nodeType: 'nano-banana-2', nodeId: 'n', inputs: { prompt: 'x' } } as never);
    expect(run).toHaveBeenLastCalledWith('generate', expect.objectContaining({ model: 'nano-banana-2' }));
  });
});
