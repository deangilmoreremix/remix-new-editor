/**
 * Ported from CineGen: src/components/create/nodes/base-node.tsx
 * Original: https://github.com/deangilmoremix/CineGen/blob/main/src/components/create/nodes/base-node.tsx
 *
 * Sub-task 1 port: minimal node wrapper, no per-node UI yet.
 */

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { WorkflowNodeData } from '/src/types/workflow.js';
import { CATEGORY_COLORS, NODE_REGISTRY } from '../../lib/workflows/node-registry.js';

export function BaseNode({ data, selected, nodeType }) {
  const type = data?.type ?? nodeType;
  const label = data?.label ?? NODE_REGISTRY[type]?.label ?? type;
  const categoryColor = CATEGORY_COLORS[type] || 'var(--port-number)';

  return (
    <div
      className="base-node"
      style={{
        border: selected ? '2px solid var(--accent)' : '1px solid rgba(120,115,105,0.25)',
        borderRadius: 8,
        background: 'rgba(28,25,23,0.95)',
        minWidth: 180,
        fontSize: 12,
        color: 'rgba(236,233,225,0.95)',
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid rgba(120,115,105,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: categoryColor,
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 12 }}>{label || type}</span>
      </div>
      <div style={{ padding: '8px 10px', color: 'rgba(236,233,225,0.55)', fontSize: 11 }}>
        {type}
      </div>
    </div>
  );
}

export const BaseNodeWrapper = memo(BaseNode);
