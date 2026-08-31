import { TimelineState } from '../TimelineState.js';
import { TimelineHistory } from '../timelineHistory.js';

function memStorage() {
  const m = {};
  return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: (k) => { delete m[k]; },
  };
}

function freshState() {
  const ts = new TimelineState({ storage: memStorage(), autopersist: false });
  ts.setState({
    project: {
      ...ts.getRawState().project,
      tracks: [],
      assets: [],
      duration: 0,
      captions: [],
      markers: [],
    },
  });
  return ts;
}

function trackCount(ts) {
  return ts.getRawState().project.tracks.length;
}

describe('Timeline History — transactional Undo/Redo (Phase 23)', () => {
  test('execute then undo restores state, redo re-applies', () => {
    const ts = freshState();
    const history = new TimelineHistory(ts);

    history.execute('Add Track', () => {
      ts.addTrack({ type: 'video', name: 'V1' });
    });
    expect(trackCount(ts)).toBe(1);
    expect(history.canUndo()).toBe(true);

    expect(history.undo()).toBe(true);
    expect(trackCount(ts)).toBe(0);

    expect(history.redo()).toBe(true);
    expect(trackCount(ts)).toBe(1);
    expect(history.canRedo()).toBe(false);
  });

  test('composite transaction collapses to ONE undo entry', () => {
    const ts = freshState();
    const history = new TimelineHistory(ts);

    history.beginTransaction('Apply Template');
    ts.addTrack({ type: 'video', name: 'V1' });
    ts.addTrack({ type: 'audio', name: 'A1' });
    ts.addTrack({ type: 'video', name: 'V2' });
    history.commit();

    expect(trackCount(ts)).toBe(3);
    expect(history.undoStack.length).toBe(1);

    history.undo();
    expect(trackCount(ts)).toBe(0);
  });

  test('nested transactions are rejected', () => {
    const ts = freshState();
    const history = new TimelineHistory(ts);
    history.beginTransaction('outer');
    expect(() => history.beginTransaction('inner')).toThrow();
    history.cancelTransaction();
  });

  test('subscribers are notified on undo/redo', () => {
    const ts = freshState();
    const history = new TimelineHistory(ts);
    const seen = [];
    const unsub = history.subscribe((s) => seen.push(s));
    history.execute('Add Track', () => ts.addTrack({ type: 'video', name: 'V1' }));
    history.undo();
    unsub();
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[seen.length - 1].canUndo).toBe(false);
  });

  test('history limits stack size', () => {
    const ts = freshState();
    const history = new TimelineHistory(ts);
    for (let i = 0; i < 250; i++) {
      history.execute(`op ${i}`, () => ts.addTrack({ type: 'video', name: `V${i}` }));
    }
    expect(history.undoStack.length).toBeLessThanOrEqual(history._limit);
  });
});
