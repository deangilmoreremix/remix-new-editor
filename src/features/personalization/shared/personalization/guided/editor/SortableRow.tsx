'use client'

import { GripVertical } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { C } from '../tokens'
import { Tip } from './Tip'

/**
 * One row of the layers list with a drag handle. The handle is the only drag activator, so the row
 * itself keeps its normal click-to-select and the eye button keeps working. Keyboard: focus the handle,
 * Space to pick up, arrow keys to move, Space to drop, Esc to cancel (dnd-kit's keyboard sensor).
 */
export function SortableRow({ id, label, children }: { id: string; label: string; children: React.ReactNode }): React.JSX.Element {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      data-testid="layer-row"
      data-layer-id={id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        position: 'relative',
        zIndex: isDragging ? 5 : undefined,
        display: 'flex',
        alignItems: 'stretch',
        gap: 4,
      }}
    >
      <Tip id="layerReorder">
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={`Reorder ${label}`}
        data-testid="layer-drag-handle"
        {...attributes}
        {...listeners}
        style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'grab', padding: '0 2px', touchAction: 'none', display: 'flex', alignItems: 'center' }}
      >
        <GripVertical size={14} />
      </button>
      </Tip>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}
