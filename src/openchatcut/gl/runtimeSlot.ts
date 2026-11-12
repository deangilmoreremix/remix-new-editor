// SPDX-License-Identifier: AGPL-3.0-or-later — OpenChatCut (apps/video-agent-studio), vendored with [remix] edits only where marked.
export interface DisposableRuntime {
  dispose: () => void;
}

export interface RuntimeSlot<T extends DisposableRuntime> {
  current: T | null;
}

export function ensureRuntimeSlot<T extends DisposableRuntime>(
  slot: RuntimeSlot<T>,
  create: () => T,
): T {
  if (!slot.current) slot.current = create();
  return slot.current;
}

export function disposeRuntimeSlot<T extends DisposableRuntime>(slot: RuntimeSlot<T>): void {
  const runtime = slot.current;
  slot.current = null;
  runtime?.dispose();
}
