// appStateAdapter — maps the upstream `@/domains/app-state` contract to this
// repo's reality. Upstream expected a Rust/Tauri backend sync; we sync via the
// existing MCP WebSocket (get_timeline_state) and persist locally via idb-keyval.
// This keeps the ported `version-control-integration` and `timeline-player-sync`
// services working without backend changes.

import { mcpClient } from './mcpClient';
import { loadTimelineSnapshot, saveTimelineSnapshot } from './tauriShim';
import type { TimelineState } from '../types/timeline';

export interface AppStateAdapter {
  loadBackendState(): Promise<Partial<TimelineState> | null>;
  pushPlayhead(time: number): Promise<void>;
  persistLocal(key: string, state: TimelineState): Promise<void>;
  loadLocal(key: string): Promise<TimelineState | undefined>;
}

export const appStateAdapter: AppStateAdapter = {
  async loadBackendState() {
    try {
      const s = await mcpClient.getTimelineState();
      return {
        duration: s.duration,
        currentTime: s.playhead,
      } as Partial<TimelineState>;
    } catch {
      return null;
    }
  },
  async pushPlayhead(time: number) {
    await mcpClient.command('set_playhead', { time });
  },
  async persistLocal(key, state) {
    await saveTimelineSnapshot(`app:${key}`, state);
  },
  async loadLocal(key) {
    return loadTimelineSnapshot<TimelineState>(`app:${key}`);
  },
};
