/**
 * Remotion preview engine for the timeline editor.
 *
 * Mounts an @remotion/player <Player> rendering TimelineComposition into a
 * host element and exposes a small imperative API the vanilla-DOM editor
 * page uses: play / pause / seek / update(model) / destroy, plus frame
 * callbacks so the Player becomes the editor's playhead clock.
 *
 * Remotion is used under its Free License (individuals and companies of up
 * to 3 people): https://remotion.dev/license
 */
import React, { forwardRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import { TimelineComposition } from './TimelineComposition.jsx';

const PlayerHost = forwardRef(function PlayerHost({ model }, ref) {
  return (
    <Player
      ref={ref}
      component={TimelineComposition}
      inputProps={{ model }}
      durationInFrames={Math.max(1, model.durationInFrames)}
      fps={model.fps}
      compositionWidth={model.width}
      compositionHeight={model.height}
      style={{ width: '100%', height: '100%' }}
      controls={false}
      clickToPlay={false}
      doubleClickToFullscreen={false}
      spaceKeyToPlayOrPause={false}
      acknowledgeRemotionLicense
      errorFallback={({ error }) => (
        <div style={{ color: '#f87171', font: '12px system-ui', padding: 12 }}>Preview error: {String(error?.message || error)}</div>
      )}
    />
  );
});

/**
 * @param {HTMLElement} host
 * @param {object} opts { model, onFrame(frame), onPlay(), onPause(), onEnded(), onError(err) }
 */
export function createPreviewEngine(host, { model, onFrame, onPlay, onPause, onEnded, onError } = {}) {
  const root = createRoot(host);
  let player = null;
  let current = model;
  let detach = () => {};

  const bind = (ref) => {
    if (!ref || ref === player) return;
    detach();
    player = ref;
    const handlers = {
      frameupdate: (e) => onFrame?.(e.detail.frame),
      seeked: (e) => onFrame?.(e.detail.frame),
      play: () => onPlay?.(),
      pause: () => onPause?.(),
      ended: () => onEnded?.(),
      error: (e) => onError?.(e.detail?.error),
    };
    Object.entries(handlers).forEach(([ev, fn]) => player.addEventListener(ev, fn));
    detach = () => Object.entries(handlers).forEach(([ev, fn]) => player?.removeEventListener(ev, fn));
  };

  const render = () => root.render(<PlayerHost ref={bind} model={current} />);
  render();

  return {
    get model() { return current; },
    update(nextModel) {
      current = nextModel;
      render();
    },
    play() { player?.play(); },
    pause() { player?.pause(); },
    isPlaying() { return !!player?.isPlaying(); },
    seekToFrame(frame) {
      if (!player) return;
      const f = Math.max(0, Math.min(current.durationInFrames - 1, Math.round(frame)));
      if (player.getCurrentFrame() !== f) player.seekTo(f);
    },
    getFrame() { return player ? player.getCurrentFrame() : 0; },
    destroy() {
      detach();
      root.unmount();
      player = null;
    },
  };
}
