/**
 * Remembers a Play pressed on the watch page BEFORE the player exists.
 *
 * WatchPage renders its markup, then awaits the (lazy) preview-engine module before it wires the buttons, so a press in that
 * window used to be lost (the big-play overlay was visible but dead). captureEarlyPlay() is installed right after the markup
 * and keeps ONE boolean intent: big-play => want playing; control-bar button / Space / k => toggle (as the real handlers do).
 * release(player) runs once when the player is wired: it removes the early listeners (so nothing can fire twice) and starts
 * playback if the intent is "play". Meanwhile the stage carries data-play-pending (the spinner in styles/watch.css).
 */
export function captureEarlyPlay(container) {
  const stage = container.querySelector('[data-stage]');
  const bigplay = container.querySelector('[data-bigplay]');
  const playBtn = container.querySelector('[data-play]');
  let want = false;
  let done = false;
  const show = () => {
    if (stage) { if (want) stage.setAttribute('data-play-pending', '1'); else stage.removeAttribute('data-play-pending'); }
    if (bigplay) bigplay.hidden = want;
    if (playBtn) {
      playBtn.textContent = want ? '❚❚' : '▶';
      playBtn.setAttribute('aria-label', want ? 'Pause' : 'Play');
    }
  };
  const onClick = (e) => {
    if (e.target.closest('[data-bigplay]')) want = true;
    else if (e.target.closest('[data-play]')) want = !want;
    else return;
    show();
  };
  const onKey = (e) => {
    if (e.target.closest('input:not([data-seek]), textarea, select, form, button')) return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); want = !want; show(); }
  };
  container.addEventListener('click', onClick, true);
  container.addEventListener('keydown', onKey, true);
  return {
    get pending() { return want; },
    /** Wire-up finished: hand the remembered intent to the real player (exactly once) and stop listening. */
    release(player) {
      if (done) return false;
      done = true;
      container.removeEventListener('click', onClick, true);
      container.removeEventListener('keydown', onKey, true);
      const go = want;
      want = false;
      show(); // clears the pending state; the player's own onChange takes over the UI
      if (go) player.play();
      return go;
    },
  };
}
