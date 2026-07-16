// playerAdapter — maps upstream `@/features/video-player` to the repo's existing
// `components/VideoPlayer.jsx`. The ported `timeline-player-sync` service drives
// playback through this contract instead of importing the upstream player.

export interface PlayerHandle {
  play(): void;
  pause(): void;
  seek(time: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  onTimeUpdate(cb: (time: number) => void): () => void;
}

// Bridge to the DOM <video> element rendered by VideoPlayer (id="studio-video").
export function getPlayerHandle(selector = '#studio-video'): PlayerHandle | null {
  const el = document.querySelector(selector) as HTMLVideoElement | null;
  if (!el) return null;
  return {
    play: () => void el.play().catch(() => {}),
    pause: () => el.pause(),
    seek: (t) => {
      el.currentTime = t;
    },
    getCurrentTime: () => el.currentTime,
    getDuration: () => el.duration || 0,
    onTimeUpdate: (cb) => {
      const handler = () => cb(el.currentTime);
      el.addEventListener('timeupdate', handler);
      return () => el.removeEventListener('timeupdate', handler);
    },
  };
}

export interface PlayerAdapter {
  getHandle(): PlayerHandle | null;
  /** Subscribe to external playhead changes (from the player). */
  bind(handle?: PlayerHandle): void;
}

let activeHandle: PlayerHandle | null = null;
const subs = new Set<(time: number) => void>();

export const playerAdapter: PlayerAdapter = {
  getHandle() {
    return activeHandle;
  },
  bind(handle) {
    activeHandle = handle ?? getPlayerHandle();
    if (activeHandle) {
      activeHandle.onTimeUpdate((t) => subs.forEach((cb) => cb(t)));
    }
  },
};

export function onPlayerTimeUpdate(cb: (time: number) => void): () => void {
  subs.add(cb);
  return () => subs.delete(cb);
}
