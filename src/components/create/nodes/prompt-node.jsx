/**
 * Ported from CineGen: src/components/create/nodes/prompt-node.tsx
 * Original: https://github.com/deangilmoremix/CineGen/blob/main/src/components/create/nodes/prompt-node.tsx
 *
 * Real per-node UI for prompt nodes. Uses a plain textarea; the
 * MentionTextarea/@mention dropdown from CineGen is deferred until
 * Phase 6 delivers the Elements library and state.elements is populated.
 */

import { memo, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { BaseNodeWrapper } from './base-node.jsx';
import { useWorkspace } from '../../lib/workspace/workspace-context.jsx';

export function PromptNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow();
  const { state } = useWorkspace();

  const handleChange = useCallback(
    (e) => {
      updateNodeData(id, { config: { ...data.config, prompt: e.target.value } });
    },
    [id, data.config, updateNodeData],
  );

  return (
    <BaseNodeWrapper nodeType="prompt" selected={!!selected} isRunning={data.result?.status === 'running'}>
      <textarea
        className="nodrag"
        value={String(data.config?.prompt ?? '')}
        onChange={handleChange}
        placeholder="Describe what to generate..."
        rows={5}
        style={{ width: '100%', resize: 'vertical' }}
      />
    </BaseNodeWrapper>
  );
}

export default memo(PromptNode);
