// timeline-player-sync — keeps the timeline playhead in lockstep with the
// repo's existing video player (via playerAdapter). Backend-free. Mirrors the
// upstream `timeline-player-sync` contract.

import { playerAdapter, onPlayerTimeUpdate } from '../adapters/playerAdapter';

export interface PlayerSync {
  start(): void;
  stop(): void;
  seek(time: number): void;
}

export function createPlayerSync(onPlayhead: (time: number) => void): PlayerSync {
  let unbind: (() => void) | null = null;
  return {
    start() {
      playerAdapter.bind();
      unbind = onPlayerTimeUpdate(onPlayhead);
    },
    stop() {
      unbind?.();
      unbind = null;
    },
    seek(time) {
      playerAdapter.getHandle()?.seek(time);
    },
  };
}
