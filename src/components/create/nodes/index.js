/**
 * Ported from CineGen: src/components/create/nodes/index.ts
 * Original: https://github.com/deangilmoreremix/CineGen/blob/main/src/components/create/nodes/index.ts
 *
 * Sub-task 1 port: bare node types - each renders type + label only.
 */

import { BaseNode } from './base-node.jsx';
import { PromptNode } from './prompt-node.jsx';
import { AssetOutputNode } from './asset-output-node.jsx';
import { MultiPromptNode } from './multi-prompt-node.jsx';
import { CompositionPlanNode } from './composition-plan-node.jsx';
import { MusicPromptNode } from './music-prompt-node.jsx';
import { ElementNode } from './element-node.jsx';
import { FilePickerNode } from './file-picker-node.jsx';
import { ShotBoardNode } from './shot-board-node.jsx';
import { StoryboarderNode } from './storyboarder-node.jsx';
import { GroupNode } from './group-node.jsx';
import { ModelNode } from './model-node.jsx';
import { getAllModelNodeTypes } from '../../lib/fal/models.js';
import { NODE_REGISTRY } from '../../lib/workflows/node-registry.js';

const allModelKeys = new Set(getAllModelNodeTypes());
for (const key of Object.keys(NODE_REGISTRY)) {
  if (!allModelKeys.has(key) && NODE_REGISTRY[key]?.isModel) {
    allModelKeys.add(key);
  }
}

const modelEntries = Array.from(allModelKeys).reduce((acc, nodeType) => {
  acc[nodeType] = ModelNode;
  return acc;
}, {});

export const nodeTypes = {
  group: GroupNode,
  prompt: PromptNode,
  assetOutput: AssetOutputNode,
  multiPrompt: MultiPromptNode,
  shotPrompt: MultiPromptNode,
  compositionPlan: CompositionPlanNode,
  musicPrompt: MusicPromptNode,
  element: ElementNode,
  filePicker: FilePickerNode,
  shotBoard: ShotBoardNode,
  storyboarder: StoryboarderNode,
  ...modelEntries,
};

export { BaseNode } from './base-node.jsx';
