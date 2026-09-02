/**
 * Ported from CineGen: src/components/create/nodes/asset-output-node.tsx
 * Original: https://github.com/deangilmoremix/CineGen/blob/main/src/components/create/nodes/asset-output-node.tsx
 *
 * Real per-node UI for asset output nodes: name input, result thumbnail,
 * and a send-to-edit action button.
 */

import { memo, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { BaseNodeWrapper } from './base-node.jsx';

export function AssetOutputNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow();
  const name = String(data.config?.name ?? 'Untitled');
  const url = data.result?.url;

  const handleNameChange = useCallback(
    (e) => {
      updateNodeData(id, { config: { ...data.config, name: e.target.value } });
    },
    [id, data.config, updateNodeData],
  );

  return (
    <BaseNodeWrapper nodeType="assetOutput" selected={!!selected} isRunning={data.result?.status === 'running'}>
      <label className="cinegen-node__label">Asset Name</label>
      <input
        type="text"
        className="nodrag"
        value={name}
        onChange={handleNameChange}
        style={{ width: '100%' }}
      />

      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="cinegen-node__thumbnail" />
      )}

      <button type="button" className="cinegen-node__send-btn nodrag">
        Send to Edit
      </button>
    </BaseNodeWrapper>
  );
}

export default memo(AssetOutputNode);
