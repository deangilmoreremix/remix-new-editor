// batch-operations-service — apply an action across many selected clips
// (ported from upstream `batch-operations-service.ts`). Returns the events an
// XState machine should receive.

import type { Clip } from '../types/timeline';

export type BatchOp =
  | { type: 'mute' }
  | { type: 'unmute' }
  | { type: 'lock' }
  | { type: 'unlock' }
  | { type: 'nudge'; delta: number }
  | { type: 'delete' };

export function planBatch(clips: Clip[], op: BatchOp): { id: string; patch: Partial<Clip> }[] {
  return clips.map((c) => {
    switch (op.type) {
      case 'mute':
        return { id: c.id, patch: { muted: true } };
      case 'unmute':
        return { id: c.id, patch: { muted: false } };
      case 'lock':
        return { id: c.id, patch: { locked: true } };
      case 'unlock':
        return { id: c.id, patch: { locked: false } };
      case 'nudge':
        return { id: c.id, patch: { start: Math.max(0, c.start + op.delta) } };
      default:
        return { id: c.id, patch: {} };
    }
  });
}
