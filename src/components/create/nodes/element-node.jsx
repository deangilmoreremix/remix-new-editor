/**
 * Ported from CineGen: src/components/create/nodes/element-node.tsx
 * Original: https://github.com/deangilmoremix/CineGen/blob/main/src/components/create/nodes/element-node.tsx
 *
 * Real per-node UI for element nodes. This node selects an element from
 * the workspace's element library.
 *
 * PHASE 6 DEPENDENCY: state.elements is not yet populated in our port.
 * CineGen's workspace-shell.tsx manages an elements array; our
 * workspace-context.jsx does not yet include it. Once Phase 6 adds the
 * Elements library and wires it into workspace state, this dropdown will
 * populate automatically because it reads from state.elements.
 *
 * Until then, the dropdown will show only "Select element..." with no
 * options. This is an intentional, tracked integration point — not a
 * shortcut.
 */

import { memo, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { BaseNodeWrapper } from './base-node.jsx';
import { useWorkspace } from '../../lib/workspace/workspace-context.jsx';

export function ElementNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow();
  const { state } = useWorkspace();

  const elementId = String(data.config?.elementId ?? '');
  const elements = Array.isArray(state.elements) ? state.elements : [];
  const selectedElement = elements.find((el) => el.id === elementId);
  const thumbnail = selectedElement?.images?.[0]?.url;

  const handleChange = useCallback(
    (e) => {
      updateNodeData(id, { config: { ...data.config, elementId: e.target.value } });
    },
    [id, data.config, updateNodeData],
  );

  return (
    <BaseNodeWrapper nodeType="element" selected={!!selected}>
      <div className="element-node__body">
        <select
          className="element-node__select nodrag nowheel"
          value={elementId}
          onChange={handleChange}
        >
          <option value="">Select element...</option>
          {elements.map((el) => (
            <option key={el.id} value={el.id}>
              {el.name} ({el.type})
            </option>
          ))}
        </select>
        {selectedElement && thumbnail && (
          <div className="element-node__preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnail} alt={selectedElement.name} className="element-node__thumbnail" />
            <span className="element-node__info">
              {selectedElement.name} &middot; {selectedElement.images?.length ?? 0} imgs
            </span>
          </div>
        )}
      </div>
    </BaseNodeWrapper>
  );
}

export default memo(ElementNode);
