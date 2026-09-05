/**
 * Ported from CineGen: src/components/create/nodes/multi-prompt-node.tsx
 * Original: https://github.com/deangilmoremix/CineGen/blob/main/src/components/create/nodes/multi-prompt-node.tsx
 *
 * Real per-node UI for multi-prompt / shot-prompt nodes: multiple shot
 * rows, each with a duration selector and prompt textarea, plus add/remove.
 *
 * shotPrompt is an alias for multiPrompt in the node registry; both map
 * to this component in nodeTypes (see index.js).
 *
 * MentionTextarea is deferred (same as prompt-node) until Phase 6 wires
 * state.elements into workspace state.
 */

import { memo, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { BaseNodeWrapper } from './base-node.jsx';
import { useWorkspace } from '../../lib/workspace/workspace-context.jsx';

const DURATION_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export function MultiPromptNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow();
  const { state } = useWorkspace();
  const shots = Array.isArray(data.config?.shots) ? data.config.shots : [{ prompt: '', duration: 5 }];

  const updateShots = useCallback(
    (newShots) => {
      updateNodeData(id, { config: { ...data.config, shots: newShots } });
    },
    [id, data.config, updateNodeData],
  );

  const handlePromptChange = useCallback(
    (index, value) => {
      const newShots = shots.map((s, i) => (i === index ? { ...s, prompt: value } : s));
      updateShots(newShots);
    },
    [shots, updateShots],
  );

  const handleDurationChange = useCallback(
    (index, value) => {
      const newShots = shots.map((s, i) => (i === index ? { ...s, duration: Number(value) } : s));
      updateShots(newShots);
    },
    [shots, updateShots],
  );

  const addShot = useCallback(() => {
    updateShots([...shots, { prompt: '', duration: 5 }]);
  }, [shots, updateShots]);

  const removeShot = useCallback(
    (index) => {
      if (shots.length <= 1) return;
      updateShots(shots.filter((_, i) => i !== index));
    },
    [shots, updateShots],
  );

  return (
    <BaseNodeWrapper nodeType="multiPrompt" selected={!!selected}>
      <div className="multi-prompt-node__shots">
        {shots.map((shot, i) => (
          <div key={i} className="multi-prompt-node__shot">
            <div className="multi-prompt-node__shot-header">
              <span className="multi-prompt-node__shot-label">Shot {i + 1}</span>
              <div className="multi-prompt-node__shot-controls">
                <select
                  className="multi-prompt-node__duration nodrag nowheel"
                  value={shot.duration}
                  onChange={(e) => handleDurationChange(i, e.target.value)}
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}s</option>
                  ))}
                </select>
                {shots.length > 1 && (
                  <button
                    type="button"
                    className="multi-prompt-node__remove-btn nodrag"
                    onClick={() => removeShot(i)}
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>
            <textarea
              className="multi-prompt-node__textarea nodrag nowheel"
              value={shot.prompt}
              onChange={(e) => handlePromptChange(i, e.target.value)}
              placeholder={`Describe shot ${i + 1}...`}
              rows={3}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        className="multi-prompt-node__add-btn nodrag"
        onClick={addShot}
      >
        + Add Shot
      </button>
    </BaseNodeWrapper>
  );
}

export default memo(MultiPromptNode);
