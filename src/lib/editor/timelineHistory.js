/**
 * Timeline History — transactional Undo / Redo
 *
 * Phase 23 of the SmartVideo Timeline Studio superset.
 *
 * Every Timeline mutation MUST be reversible. This module provides a command
 * history backed by the authoritative TimelineState. It uses a snapshot model:
 * before a mutation (or transaction) the relevant slice of state is captured,
 * and after the mutation the new slice is captured. Undo restores the `before`
 * snapshot; Redo restores the `after` snapshot.
 *
 * Composite operations (e.g. ApplyTemplate inserting 18 elements) are wrapped
 * in a single transaction, so ONE Undo reverts the entire insertion and ONE
 * Redo restores it. This satisfies the transactional-undo requirement.
 *
 * The history never bypasses TimelineState: it only ever calls
 * `state.setState(...)`, so persistence and subscriber notification continue to
 * happen exactly as they would for a direct edit.
 */

export class TimelineHistory {
  /**
   * @param {import('./TimelineState.js').TimelineState} timelineState
   */
  constructor(timelineState) {
    if (!timelineState) throw new Error('TimelineHistory requires a TimelineState instance');
    this.state = timelineState;
    this.undoStack = [];
    this.redoStack = [];
    this.subscribers = new Set();
    this._transaction = null;
    this._limit = 200;
  }

  /**
   * Snapshot the authoritative, persistable slice of timeline state.
   * We intentionally exclude mutable Set fields from the snapshot to avoid
   * serialization edge cases in TimelineState; the project tree is the source
   * of truth for undo/redo.
   */
  _snapshot() {
    const raw = this.state.getRawState();
    return JSON.parse(JSON.stringify({
      project: raw.project,
      selectedClipId: raw.selectedClipId,
      playheadPercent: raw.playheadPercent,
      timelineSeconds: raw.timelineSeconds,
    }));
  }

  _restore(snap) {
    this.state.setState({
      project: snap.project,
      selectedClipId: snap.selectedClipId ?? null,
      playheadPercent: snap.playheadPercent ?? 0,
      timelineSeconds: snap.timelineSeconds ?? 0,
    });
  }

  _push(entry) {
    this.undoStack.push(entry);
    if (this.undoStack.length > this._limit) this.undoStack.shift();
    this.redoStack.length = 0;
    this._notify();
  }

  /**
   * Run a single undoable mutation.
   * @param {string} label - Human-readable label (for UI/debugging)
   * @param {() => void} mutator - Performs the TimelineState mutation(s)
   */
  execute(label, mutator) {
    const before = this._snapshot();
    mutator();
    const after = this._snapshot();
    this._push({ label, before, after });
  }

  /**
   * Begin a composite transaction. All subsequent TimelineState mutations are
   * grouped into one history entry. Call commit() to finalize, or
   * cancelTransaction() to abort (no history entry is recorded, but the
   * mutations already performed remain — callers should undo their own work
   * if they want to roll back mid-transaction).
   * @param {string} label
   */
  beginTransaction(label) {
    if (this._transaction) {
      throw new Error('Nested transactions are not supported');
    }
    this._transaction = { label, before: this._snapshot() };
  }

  /**
   * Finalize the current transaction, recording a single history entry that
   * captures every mutation performed since beginTransaction().
   * @returns {boolean} true if an entry was committed
   */
  commit() {
    if (!this._transaction) return false;
    const after = this._snapshot();
    const { label, before } = this._transaction;
    this._transaction = null;
    this._push({ label, before, after });
    return true;
  }

  cancelTransaction() {
    this._transaction = null;
  }

  get inTransaction() {
    return this._transaction !== null;
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    const entry = this.undoStack.pop();
    this._restore(entry.before);
    this.redoStack.push(entry);
    this._notify();
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    const entry = this.redoStack.pop();
    this._restore(entry.after);
    this.undoStack.push(entry);
    this._notify();
    return true;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  /** Most recent undo label, useful for UI tooltips. */
  get undoLabel() {
    return this.undoStack.length ? this.undoStack[this.undoStack.length - 1].label : null;
  }

  get redoLabel() {
    return this.redoStack.length ? this.redoStack[this.redoStack.length - 1].label : null;
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this._notify();
  }

  subscribe(callback) {
    if (typeof callback !== 'function') throw new Error('callback must be a function');
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  _notify() {
    const snapshot = { canUndo: this.canUndo(), canRedo: this.canRedo(), undoLabel: this.undoLabel, redoLabel: this.redoLabel };
    this.subscribers.forEach((cb) => {
      try { cb(snapshot); } catch (e) { console.error('[TimelineHistory] subscriber error', e); }
    });
  }
}
