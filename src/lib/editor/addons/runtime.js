/**
 * Addon playback runtime.
 *
 * Upstream ran pause/loop/skip/form behaviour inside Popcorn's start/end
 * hooks. The live timeline page has no Popcorn — its playback is a timer
 * that advances the playhead — so this runtime is a pure state machine:
 * the page calls `tick(prevSec, nowSec)` each frame and applies the returned
 * actions. Clip options are re-read every tick, so edits made while playing
 * (e.g. trimming a Skip clip) take effect immediately.
 *
 * Actions:
 *   { type: 'seek', time }                       move the playhead
 *   { type: 'pause', clip, resumeAfter? }        stop playback (auto-resume in s)
 *   { type: 'show', overlay, clip?, config? }    show a pause prompt / form
 */
import { getAddon, clipTimeRange, addonOptions } from './registry.js';

const SEEK_TOLERANCE = 0.75; // seconds of drift treated as a user seek

export class AddonRuntime {
  constructor() {
    this.reset();
  }

  reset() {
    this.lastTime = null;
    this.loopCounts = new Map();
    this.firedPauses = new Set();
    this.firedGates = new Set();
    this.listBuilderShown = false;
  }

  /** Mark a gated lead form as completed so it never gates again. */
  markSubmitted(clipId) {
    this.firedGates.add(String(clipId));
  }

  /**
   * A jump the runtime didn't cause (scrub, rewind, stop). Forget loop
   * counts and re-arm pauses/gates that are now ahead of the playhead.
   */
  handleSeek(time, clips, timelineSeconds) {
    this.loopCounts.clear();
    if (time <= 0.05) this.listBuilderShown = false;
    for (const clip of clips) {
      const { start } = clipTimeRange(clip, timelineSeconds);
      if (start >= time) {
        this.firedPauses.delete(String(clip.id));
        if (!clip._submitted) this.firedGates.delete(String(clip.id));
      }
    }
    this.lastTime = time;
  }

  /**
   * @param {number} prev       playhead (s) before this frame
   * @param {number} now        playhead (s) after this frame
   * @param {object} ctx        { clips, timelineSeconds, listBuilder }
   * @returns {Array<object>}   actions, in the order to apply them
   */
  tick(prev, now, { clips = [], timelineSeconds = 60, listBuilder = null } = {}) {
    if (this.lastTime !== null && Math.abs(this.lastTime - prev) > SEEK_TOLERANCE) {
      this.handleSeek(prev, clips, timelineSeconds);
    }
    // List Builder / Personalizer: upstream composed it onto the video at
    // start 0 with interaction locked until the viewer pressed its "Play"
    // button, so it gates playback from the very beginning.
    if (listBuilder?.enabled && !listBuilder._submitted && !this.listBuilderShown && prev <= 0.05) {
      this.listBuilderShown = true;
      this.lastTime = 0;
      return [
        { type: 'seek', time: 0 },
        { type: 'pause', reason: 'list-builder' },
        { type: 'show', overlay: 'list-builder', config: listBuilder },
      ];
    }

    const actions = [];
    const crossed = (t) => prev < t && t <= now;
    const ordered = clips
      .filter((c) => getAddon(c.type)?.behavior)
      .map((c) => ({ clip: c, ...clipTimeRange(c, timelineSeconds) }))
      .sort((a, b) => a.start - b.start);

    let position = now;
    for (const { clip, start, end } of ordered) {
      const behavior = getAddon(clip.type).behavior;
      const id = String(clip.id);
      const opts = addonOptions(clip);

      if (behavior === 'skip' && position >= start && position < end && prev < end) {
        actions.push({ type: 'seek', time: end, clip });
        position = end;
        continue;
      }

      if (behavior === 'loop' && prev < end && end <= position) {
        const limit = Math.max(0, Math.floor(Number(opts.loop) || 0));
        const count = this.loopCounts.get(id) || 0;
        if (limit === 0 || count < limit) {
          this.loopCounts.set(id, count + 1);
          // Pauses inside the looped section fire again on each pass,
          // matching upstream where Popcorn re-ran each event's start().
          for (const other of ordered) {
            if (other.start >= start && other.start < end) this.firedPauses.delete(String(other.clip.id));
          }
          actions.push({ type: 'seek', time: start, clip });
          position = start;
          break; // everything after the loop point is replayed next pass
        }
        continue;
      }

      if (behavior === 'pause' && crossed(start) && !this.firedPauses.has(id)) {
        this.firedPauses.add(id);
        const duration = Math.max(0, Number(opts.duration) || 0);
        actions.push({ type: 'seek', time: start, clip });
        actions.push({ type: 'pause', clip, resumeAfter: duration || undefined });
        if (!duration) actions.push({ type: 'show', overlay: 'pause-continue', clip });
        position = start;
        break;
      }

      if (behavior === 'gate' && crossed(start) && !clip._submitted && !this.firedGates.has(id)) {
        this.firedGates.add(id);
        actions.push({ type: 'seek', time: start, clip });
        actions.push({ type: 'pause', clip });
        actions.push({ type: 'show', overlay: 'lead-form', clip });
        position = start;
        break;
      }
    }


    this.lastTime = position;
    return actions;
  }
}
