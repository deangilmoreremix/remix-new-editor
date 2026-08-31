/**
 * Timeline Feature API
 *
 * Phase 2 of the SmartVideo Timeline Studio superset.
 *
 * ONE normalized integration layer for every Timeline tool. All restored and
 * new Timeline features MUST route through this API instead of mutating
 * Timeline state directly. This guarantees:
 *
 *   1. A single source of truth (TimelineState remains authoritative — the API
 *      only ever calls state.setState / state.addClip / etc.).
 *   2. A single undo/redo path (TimelineHistory, transactional).
 *   3. A single asset shape (Unified Asset Model from assetModel.js).
 *   4. No second, competing timeline state system.
 *
 * Implementation strategy (no second state system):
 *   - The canonical Timeline lives in TimelineState (legacy-backed model:
 *     project.tracks[].items).
 *   - For the rich, already-tested pure operations in timeline-operations.js
 *     (which operate on the flat new model: tracks + top-level clips), we
 *     derive a flat Timeline via the bridge (legacyToTimeline), apply the op,
 *     then write the flat Timeline back through the bridge (timelineToLegacy)
 *     into TimelineState. The flat model is a DERIVATION only — it is never
 *     persisted independently.
 *
 * The bridge is the compatibility seam. We keep using it; we do not bypass it.
 */

import {
  legacyToTimeline,
  timelineToLegacy,
  findAssetById,
  getPreviewClipFromTimeline,
} from './timeline-bridge.js';
import * as ops from './timeline-operations.js';
import { normalizeAsset, createTextAsset, createCaptionAsset, createOverlayAsset, createInteractiveAsset } from './assetModel.js';
import { TimelineHistory } from './timelineHistory.js';

export class TimelineFeatureApi {
  /**
   * @param {import('./TimelineState.js').TimelineState} timelineState
   * @param {{ history?: TimelineHistory }} [options]
   */
  constructor(timelineState, options = {}) {
    if (!timelineState) throw new Error('TimelineFeatureApi requires a TimelineState instance');
    this.state = timelineState;
    this.history = options.history || new TimelineHistory(timelineState);
  }

  /* ---------------------------------------------------------------- *
   * Internal derivation helpers (flat model <-> TimelineState)
   * ---------------------------------------------------------------- */

  _read() {
    return legacyToTimeline(this.state.getRawState());
  }

  _write(timeline) {
    const { tracks, transitions, markers } = timelineToLegacy(timeline, { timelineSeconds: timeline.duration });
    const raw = this.state.getRawState();
    this.state.setState({
      project: {
        ...raw.project,
        tracks,
        transitions: transitions || [],
        markers: markers || raw.project.markers || [],
        duration: timeline.duration,
      },
    });
  }

  /**
   * Apply a mutation either as its own history entry, or (when already inside
   * a transaction) directly, so the whole transaction collapses into ONE undo.
   */
  _mutate(label, fn) {
    if (this.history.inTransaction) {
      fn();
      return;
    }
    this.history.execute(label, fn);
  }

  /* ---------------------------------------------------------------- *
   * Assets (Phase 3) — Unified Asset Model
   * ---------------------------------------------------------------- */

  /** Add a normalized asset to the project. Returns the asset id. */
  addAsset(asset) {
    const normalized = normalizeAsset(asset);
    this._mutate('Add Asset', () => {
      const raw = this.state.getRawState();
      const assets = [...(raw.project.assets || []), normalized];
      this.state.setState({ project: { ...raw.project, assets } });
    });
    return normalized.id;
  }

  getAssets() {
    return this.state.getRawState().project.assets || [];
  }

  getAsset(assetId) {
    return findAssetById(this.state.getRawState(), assetId);
  }

  /* ---------------------------------------------------------------- *
   * Track resolution
   * ---------------------------------------------------------------- */

  /**
   * Find or create a track of the given kind/type and return its id.
   * @param {'video'|'audio'} kind
   * @param {string} name - Used to reuse an existing track of that name.
   */
  ensureTrack(kind, name) {
    const tracks = this.state.getRawState().project.tracks;
    const existing = tracks.find((t) => t.type === kind && t.name === name)
      || tracks.find((t) => t.type === kind);
    if (existing) return existing.id;
    return this.state.addTrack({ type: kind, name });
  }

  /* ---------------------------------------------------------------- *
   * Clip insertion (core + typed)
   * ---------------------------------------------------------------- */

  _resolveAssetId(opts) {
    if (opts.assetId) {
      const existing = this.getAsset(opts.assetId);
      if (!existing) throw new Error(`Asset not found: ${opts.assetId}`);
      return opts.assetId;
    }
    if (opts.asset) {
      return this.addAsset(opts.asset);
    }
    const fallback = normalizeAsset({
      type: opts.type || 'video',
      name: opts.name || 'Clip',
      duration: opts.duration ?? 5,
      source: opts.source || 'upload',
      ...(opts.text ? { metadata: { text: opts.text } } : {}),
    });
    return this.addAsset(fallback);
  }

  /**
   * Add a clip to a track. If no trackId is supplied, an appropriate track is
   * auto-selected based on the asset type.
   * @returns {string} primary clip id (linked audio clip id lives in
   *   linkedClipIds when a video clip auto-links its audio).
   */
  addClip(trackId, opts = {}) {
    const assetId = this._resolveAssetId(opts);
    const asset = this.getAsset(assetId);
    const resolvedTrackId = trackId || this.ensureTrack(
      asset.type === 'audio' ? 'audio' : 'video',
      opts.trackName || (asset.type === 'audio' ? 'Audio' : 'Video'),
    );
    const startTime = opts.startTime ?? 0;

    let primaryClipId = null;
    this._mutate('Add Clip', () => {
      const tl = this._read();
      const beforeIds = new Set(tl.clips.map((c) => c.id));
      const next = ops.addClipToTrack(tl, resolvedTrackId, asset, startTime);
      // Identify the clip(s) added by this operation (not present before).
      const added = next.clips.filter((c) => !beforeIds.has(c.id));
      // Primary clip is the one placed on the requested track.
      primaryClipId = added.find((c) => c.trackId === resolvedTrackId)?.id
        || added[0]?.id
        || next.clips[next.clips.length - 1].id;
      this._write(next);
    });
    return primaryClipId;
  }

  addVideo(opts) { return this.addClip(null, { ...opts, type: 'video', trackName: opts.trackName || 'Video' }); }
  addImage(opts) { return this.addClip(null, { ...opts, type: 'image', trackName: opts.trackName || 'Video' }); }
  addAudio(opts) { return this.addClip(null, { ...opts, type: 'audio', trackName: opts.trackName || 'Audio' }); }

  addText(opts = {}) {
    const asset = createTextAsset({ text: opts.text, name: opts.name, duration: opts.duration, style: opts.style });
    return this.addClip(null, { asset, trackName: opts.trackName || 'Text', startTime: opts.startTime });
  }

  addCaption(opts = {}) {
    const asset = createCaptionAsset({ text: opts.text, name: opts.name, duration: opts.duration, style: opts.style });
    return this.addClip(null, { asset, trackName: opts.trackName || 'Caption', startTime: opts.startTime });
  }

  addOverlay(opts = {}) {
    const asset = createOverlayAsset({ kind: opts.kind, name: opts.name, duration: opts.duration, config: opts.config });
    return this.addClip(null, { asset, trackName: opts.trackName || 'Overlay', startTime: opts.startTime });
  }

  addInteractiveElement(opts = {}) {
    const asset = createInteractiveAsset({ name: opts.name, duration: opts.duration, formConfig: opts.formConfig });
    return this.addClip(null, { asset, trackName: opts.trackName || 'Interactive', startTime: opts.startTime });
  }

  addLeadForm(opts = {}) {
    const asset = createInteractiveAsset({
      name: opts.name || 'Lead Form',
      duration: opts.duration || 8,
      formConfig: {
        fields: opts.fields || ['name', 'email'],
        appearanceTime: opts.appearanceTime ?? 0,
        pauseUntilSubmitted: opts.pauseUntilSubmitted ?? false,
        requiredFields: opts.requiredFields || ['email'],
        branding: opts.branding || null,
        cta: opts.cta || null,
        privacyText: opts.privacyText || null,
        successMessage: opts.successMessage || null,
      },
    });
    return this.addClip(null, { asset, trackName: opts.trackName || 'Interactive', startTime: opts.startTime });
  }

  /* ---------------------------------------------------------------- *
   * Transitions / Keyframes / Effects
   * ---------------------------------------------------------------- */

  addTransition(clipAId, clipBId, opts = {}) {
    const transition = {
      id: `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      type: opts.type || 'dissolve',
      duration: opts.duration ?? 1,
      clipAId,
      ...(clipBId ? { clipBId } : {}),
      ...(opts.direction ? { direction: opts.direction } : {}),
      ...(opts.easing ? { easing: opts.easing } : {}),
      ...(opts.parameters ? { parameters: opts.parameters } : {}),
    };
    let added = false;
    this._mutate('Add Transition', () => {
      const tl = this._read();
      const next = ops.addTransition(tl, transition);
      if (next.transitions.length !== tl.transitions.length) {
        added = true;
        this._write(next);
      }
    });
    return added ? transition.id : null;
  }

  addKeyframe(clipId, keyframe) {
    const kf = {
      time: keyframe.time ?? 0,
      property: keyframe.property || 'opacity',
      value: keyframe.value ?? 0,
      ...(keyframe.easing ? { easing: keyframe.easing } : {}),
    };
    this._mutate('Add Keyframe', () => {
      const tl = this._read();
      this._write(ops.addKeyframe(tl, clipId, kf));
    });
  }

  removeKeyframe(clipId, keyframeIndex) {
    this._mutate('Remove Keyframe', () => {
      const tl = this._read();
      this._write(ops.removeKeyframe(tl, clipId, keyframeIndex));
    });
  }

  addEffect(clipId, effect) {
    const eff = {
      id: `ef_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      type: effect.type || 'blur',
      enabled: effect.enabled !== false,
      params: effect.params || {},
      ...(effect.mask ? { mask: effect.mask } : {}),
    };
    this._mutate('Add Effect', () => {
      const tl = this._read();
      this._write({
        ...tl,
        clips: tl.clips.map((c) => (c.id === clipId
          ? { ...c, effects: [...(c.effects || []), eff] }
          : c)),
      });
    });
    return eff.id;
  }

  /* ---------------------------------------------------------------- *
   * Clip editing
   * ---------------------------------------------------------------- */

  updateClip(clipId, updates) {
    this._mutate('Update Clip', () => {
      const tl = this._read();
      this._write(ops.updateClipProperties(tl, clipId, updates));
    });
  }

  removeClip(clipId) {
    let removed = false;
    this._mutate('Remove Clip', () => {
      const tl = this._read();
      const next = ops.removeClip(tl, clipId);
      if (next.clips.length !== tl.clips.length) {
        removed = true;
        this._write(next);
      }
    });
    return removed;
  }

  moveClip(clipId, newTrackId, newStartTime) {
    this._mutate('Move Clip', () => {
      const tl = this._read();
      this._write(ops.moveClip(tl, clipId, newTrackId, newStartTime));
    });
  }

  splitClip(clipId, splitTime) {
    let didSplit = false;
    this._mutate('Split Clip', () => {
      const tl = this._read();
      const next = ops.splitClip(tl, clipId, splitTime);
      if (next.clips.length !== tl.clips.length) {
        didSplit = true;
        this._write(next);
      }
    });
    return didSplit;
  }

  trimClip(clipId, trimStart, trimEnd, startTime) {
    this._mutate('Trim Clip', () => {
      const tl = this._read();
      this._write(ops.trimClip(tl, clipId, trimStart, trimEnd, startTime));
    });
  }

  /* ---------------------------------------------------------------- *
   * Selection / Playback / Preview
   * ---------------------------------------------------------------- */

  selectClip(clipId) {
    this.state.setState({ selectedClipId: clipId ?? null });
  }

  getSelectedClipId() {
    return this.state.getRawState().selectedClipId;
  }

  seek(percent) {
    this.state.updatePlayhead(percent);
  }

  getPlayheadPercent() {
    return this.state.getRawState().playheadPercent;
  }

  /**
   * Resolve a preview descriptor for the current selection. Preview always
   * reflects Timeline state (never a disconnected feature-specific copy).
   */
  preview() {
    const tl = this._read();
    const selectedClipId = this.getSelectedClipId();
    return getPreviewClipFromTimeline(tl, selectedClipId, this.state.getRawState());
  }

  /** Flat Timeline view for consumers (read-only derivation). */
  getTimeline() {
    return this._read();
  }

  /* ---------------------------------------------------------------- *
   * Undo / Redo (Phase 23)
   * ---------------------------------------------------------------- */

  undo() { return this.history.undo(); }
  redo() { return this.history.redo(); }
  canUndo() { return this.history.canUndo(); }
  canRedo() { return this.history.canRedo(); }

  /* ---------------------------------------------------------------- *
   * Persistence (Phase 24)
   * ---------------------------------------------------------------- */

  save() { this.state.persist(); }
  persist() { this.state.persist(); }

  /* ---------------------------------------------------------------- *
   * Composite: Apply Template (Phase 12)
   * One Undo reverts the entire template insertion.
   * ---------------------------------------------------------------- */

  /**
   * @param {Object} template - { name, tracks: [{ type, name, clips: [{ assetId|asset, type, name, startTime, duration, text? }] }] }
   * @returns {{ trackIds: string[], clipIds: string[] }}
   */
  applyTemplate(template) {
    const trackIds = [];
    const clipIds = [];
    this.history.beginTransaction(`Apply Template: ${template.name || 'Template'}`);
    try {
      for (const trackDef of template.tracks || []) {
        const kind = trackDef.type === 'audio' ? 'audio' : 'video';
        const trackId = this.ensureTrack(kind, trackDef.name || (kind === 'audio' ? 'Audio' : 'Video'));
        trackIds.push(trackId);
        let cursor = 0;
        for (const clipDef of trackDef.clips || []) {
          const startTime = typeof clipDef.startTime === 'number' ? clipDef.startTime : cursor;
          const id = this.addClip(trackId, {
            assetId: clipDef.assetId,
            asset: clipDef.asset,
            type: clipDef.type,
            name: clipDef.name,
            duration: clipDef.duration,
            text: clipDef.text,
            startTime,
          });
          if (id) clipIds.push(id);
          cursor = startTime + (clipDef.duration || 5);
        }
      }
    } finally {
      this.history.commit();
    }
    return { trackIds, clipIds };
  }

  /* ---------------------------------------------------------------- *
   * Subscription pass-through (so UI can observe either layer)
   * ---------------------------------------------------------------- */

  subscribe(callback) {
    return this.state.subscribe(callback);
  }
}
