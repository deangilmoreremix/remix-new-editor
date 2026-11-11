/**
 * Engagement-explorer preview: shows the saved project thumbnail until played,
 * then mounts the SAME interactive player the hosted page uses (over the
 * published snapshot) so a click on a section really seeks to its timestamp.
 * The owner's preview never records analytics (no analytics client is created).
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

export async function defaultCreatePlayer(host, project) {
  await import('../../../../../styles/watch.css');
  const [{ createInteractivePlayer }, { createPreviewEngine }] = await Promise.all([
    import('../../publish/interactivePlayer.js'),
    import('../../remotion/previewEngine.jsx'),
  ]);
  host.innerHTML = '<div class="watch-frame" data-frame><div class="watch-stage" data-stage></div></div>';
  const frame = host.querySelector('[data-frame]');
  const player = createInteractivePlayer({
    project, stage: host.querySelector('[data-stage]'), frame, createEngine: createPreviewEngine, fps: 30,
    onLead: async () => ({ stored: false }), // previewing must never submit a lead
    onChange() {},
  });
  frame.style.aspectRatio = `${player.model.width} / ${player.model.height}`;
  frame.style.height = '100%';
  frame.style.width = 'auto';
  frame.style.margin = '0 auto';
  return player;
}

const LivePreview = forwardRef(function LivePreview({ project, snapshot, thumbnailUrl, createPlayer = defaultCreatePlayer }, ref) {
  const host = useRef(null);
  const player = useRef(null);
  const starting = useRef(null);
  const [state, setState] = useState('idle'); // idle | loading | ready | error
  const [message, setMessage] = useState('');

  const ensure = useCallback(async () => {
    if (player.current) return player.current;
    if (starting.current) return starting.current;
    setState('loading');
    starting.current = (async () => {
      try {
        const p = await createPlayer(host.current, snapshot);
        player.current = p;
        setState('ready');
        return p;
      } catch (err) {
        setMessage(err?.message || 'The preview could not be loaded');
        setState('error');
        return null;
      } finally { starting.current = null; }
    })();
    return starting.current;
  }, [createPlayer, snapshot]);

  useImperativeHandle(ref, () => ({
    /** Seek to a position in milliseconds and play from there. */
    async seekTo(ms) {
      const p = await ensure();
      if (!p) return false;
      p.seek(Math.max(0, ms) / 1000);
      p.play();
      host.current?.closest('.sv-video-preview')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      return true;
    },
    get player() { return player.current; },
  }), [ensure]);

  useEffect(() => () => { try { player.current?.destroy(); } catch { /* already gone */ } player.current = null; }, [snapshot]);

  return (
    <>
      <div ref={host} className="sv-live-preview-host" hidden={state !== 'ready'} />
      {state !== 'ready' && (thumbnailUrl
        ? <img src={thumbnailUrl} alt={`${project.projectName} video thumbnail`} />
        : <div className="sv-video-placeholder">Video preview<br /><small>No thumbnail saved for this project yet</small></div>)}
      {state !== 'ready' && (
        <button type="button" className="sv-preview-play" onClick={() => ensure().then((p) => p?.play())} aria-label={state === 'loading' ? 'Loading preview' : 'Play preview'} disabled={state === 'loading'}>
          {state === 'loading' ? '…' : '▶'}
        </button>
      )}
      {state === 'error' && <p className="sv-hint" role="alert" style={{ position: 'absolute', bottom: 8, left: 12, right: 12, margin: 0 }}>{message}</p>}
    </>
  );
});
export default LivePreview;
