/**
 * Timeline playback controller.
 */

export function createPlaybackController(state, renderer) {
  return {
    play: () => play(state, renderer),
    pause: () => pause(state, renderer),
    stop: () => stop(state, renderer),
    seek: (position) => seek(state, renderer, position),
    setPlaybackRate: (rate) => setPlaybackRate(state, rate),
  };
}

export function play(state, renderer) {
  if (state.playing) return;
  state.playing = true;
  if (typeof state.setPlaying === 'function') state.setPlaying(true);
}

export function pause(state, renderer) {
  if (!state.playing) return;
  state.playing = false;
  if (typeof state.setPlaying === 'function') state.setPlaying(false);
}

export function stop(state, renderer) {
  state.playing = false;
  state.playheadPosition = 0;
  if (typeof state.setPlaying === 'function') state.setPlaying(false);
  if (typeof state.updatePlayhead === 'function') state.updatePlayhead(0);
}

export function seek(state, renderer, position) {
  state.playheadPosition = Math.max(0, position);
  if (typeof state.updatePlayhead === 'function') state.updatePlayhead(state.playheadPosition);
  if (typeof renderer?.updatePlayhead === 'function') renderer.updatePlayhead(state.playheadPosition);
}

export function setPlaybackRate(state, rate) {
  const clamped = Math.max(0.25, Math.min(rate, 4));
  state.playbackRate = clamped;
}
