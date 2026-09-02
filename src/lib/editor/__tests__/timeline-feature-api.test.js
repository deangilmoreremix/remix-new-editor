import { TimelineState } from '../TimelineState.js';
import { TimelineFeatureApi } from '../timelineFeatureApi.js';
import { normalizeAsset } from '../assetModel.js';

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

function flatClips(ts) {
  return new TimelineFeatureApi(ts).getTimeline().clips;
}

function flatClipCount(ts) {
  return flatClips(ts).length;
}

function legacyClipCount(ts) {
  return ts.getRawState().project.tracks.reduce((n, t) => n + (t.items ? t.items.length : 0), 0);
}

describe('Timeline Feature API (Phase 0 baseline + Phase 2)', () => {
  test('addAsset stores a normalized asset retrievable by id', () => {
    const ts = freshState();
    const api = new TimelineFeatureApi(ts);
    const id = api.addAsset(normalizeAsset({ type: 'video', name: 'Clip', duration: 8, url: 'x.mp4' }));
    expect(api.getAsset(id)).toBeTruthy();
    expect(api.getAsset(id).name).toBe('Clip');
  });

  test('addVideo creates a video track + clip and links an audio clip', () => {
    const ts = freshState();
    const api = new TimelineFeatureApi(ts);
    const assetId = api.addAsset(normalizeAsset({ type: 'video', name: 'Vid', duration: 8 }));
    const clipId = api.addVideo({ assetId, startTime: 0 });
    const tl = api.getTimeline();
    expect(tl.clips.some((c) => c.id === clipId && c.assetId === assetId)).toBe(true);
    expect(tl.clips.length).toBe(2);
  });

  test('addImage places a single clip on a video track', () => {
    const ts = freshState();
    const api = new TimelineFeatureApi(ts);
    const assetId = api.addAsset(normalizeAsset({ type: 'image', name: 'Img', duration: 5 }));
    api.addImage({ assetId });
    expect(api.getTimeline().clips.length).toBe(1);
  });

  test('addText / addCaption / addLeadForm place clips on typed tracks', () => {
    const ts = freshState();
    const api = new TimelineFeatureApi(ts);
    const tId = api.addText({ text: 'Hello', startTime: 1 });
    const cId = api.addCaption({ text: 'World', startTime: 2 });
    const lId = api.addLeadForm({ fields: ['email'], startTime: 3 });
    expect(tId).toBeTruthy();
    expect(cId).toBeTruthy();
    expect(lId).toBeTruthy();
    expect(flatClipCount(ts)).toBe(3);
  });

  test('removeClip is undoable and redoable', () => {
    const ts = freshState();
    const api = new TimelineFeatureApi(ts);
    const assetId = api.addAsset(normalizeAsset({ type: 'image', name: 'I', duration: 5 }));
    const clipId = api.addImage({ assetId });
    expect(flatClipCount(ts)).toBe(1);

    api.removeClip(clipId);
    expect(flatClipCount(ts)).toBe(0);
    expect(api.canUndo()).toBe(true);

    api.undo();
    expect(flatClipCount(ts)).toBe(1);
    api.redo();
    expect(flatClipCount(ts)).toBe(0);
  });

  test('splitClip increases clip count and is undoable', () => {
    const ts = freshState();
    const api = new TimelineFeatureApi(ts);
    const assetId = api.addAsset(normalizeAsset({ type: 'image', name: 'V', duration: 10 }));
    api.addImage({ assetId, startTime: 0 });

    const clip = api.getTimeline().clips.find((c) => c.assetId === assetId);
    const before = flatClipCount(ts);
    const split = api.splitClip(clip.id, 5);
    expect(split).toBe(true);
    expect(flatClipCount(ts)).toBe(before + 1);

    api.undo();
    expect(flatClipCount(ts)).toBe(before);
  });

  test('updateClip changes a property and is undoable', () => {
    const ts = freshState();
    const api = new TimelineFeatureApi(ts);
    const assetId = api.addAsset(normalizeAsset({ type: 'image', name: 'I', duration: 5 }));
    const clipId = api.addImage({ assetId });
    api.updateClip(clipId, { opacity: 0.5 });
    expect(api.getTimeline().clips.find((c) => c.id === clipId).opacity).toBe(0.5);
    api.undo();
    expect(api.getTimeline().clips.find((c) => c.id === clipId).opacity).toBe(1);
  });

  test('addKeyframe attaches a keyframe to the clip', () => {
    const ts = freshState();
    const api = new TimelineFeatureApi(ts);
    const assetId = api.addAsset(normalizeAsset({ type: 'image', name: 'I', duration: 5 }));
    const clipId = api.addImage({ assetId });
    api.addKeyframe(clipId, { time: 1, property: 'opacity', value: 0.2, easing: 'ease-in' });
    const clip = api.getTimeline().clips.find((c) => c.id === clipId);
    expect(clip.keyframes.length).toBe(1);
    expect(clip.keyframes[0].property).toBe('opacity');
    expect(clip.keyframes[0].easing).toBe('ease-in');
  });

  test('addTransition (fade) registers a transition entry', () => {
    const ts = freshState();
    const api = new TimelineFeatureApi(ts);
    const assetId = api.addAsset(normalizeAsset({ type: 'image', name: 'I', duration: 5 }));
    const clipId = api.addImage({ assetId });
    const trId = api.addTransition(clipId, null, { type: 'fadeToBlack', duration: 1 });
    expect(trId).toBeTruthy();
    expect(api.getTimeline().transitions.length).toBe(1);
  });

  test('addEffect persists through the bridge round-trip', () => {
    const ts = freshState();
    const api = new TimelineFeatureApi(ts);
    const assetId = api.addAsset(normalizeAsset({ type: 'image', name: 'I', duration: 5 }));
    const clipId = api.addImage({ assetId });
    const effId = api.addEffect(clipId, { type: 'blur', params: { amount: 4 } });
    expect(effId).toBeTruthy();

    const flatClip = api.getTimeline().clips.find((c) => c.id === clipId);
    expect(flatClip.effects.length).toBe(1);
    expect(flatClip.effects[0].type).toBe('blur');

    const legacyClip = ts.getRawState().project.tracks
      .flatMap((t) => t.items || [])
      .find((c) => c.id === clipId);
    expect(legacyClip.effects.length).toBe(1);
  });

  test('applyTemplate is a single transactional undo (composite)', () => {
    const ts = freshState();
    const api = new TimelineFeatureApi(ts);
    api.addAsset(normalizeAsset({ type: 'image', name: 'V', duration: 4 }));
    const audId = api.addAsset(normalizeAsset({ type: 'audio', name: 'A', duration: 4 }));
    const imgId = api.getAssets().find((a) => a.type === 'image').id;

    const depthBefore = api.history.undoStack.length;
    const result = api.applyTemplate({
      name: 'Promo',
      tracks: [
        { type: 'video', name: 'Video', clips: [{ assetId: imgId }, { assetId: imgId }] },
        { type: 'audio', name: 'Audio', clips: [{ assetId: audId }, { assetId: audId }] },
      ],
    });
    // The whole template insertion must collapse into ONE transaction entry.
    expect(result.clipIds.length).toBe(4);
    expect(api.history.undoStack.length).toBe(depthBefore + 1);

    // One undo reverts the entire template (back to just the 2 assets, 0 clips).
    api.undo();
    expect(flatClipCount(ts)).toBe(0);
    api.redo();
    expect(flatClipCount(ts)).toBe(4);
  });

  test('preview returns a descriptor reflecting the selected clip', () => {
    const ts = freshState();
    const api = new TimelineFeatureApi(ts);
    const assetId = api.addAsset(normalizeAsset({ type: 'video', name: 'Vid', duration: 8, url: 'x.mp4' }));
    const clipId = api.addVideo({ assetId });
    api.selectClip(clipId);
    const p = api.preview();
    expect(p).toBeTruthy();
    expect(p.id).toBe(clipId);
    expect(p.type).toBe('video');
    expect(p.src).toBe('x.mp4');
  });

  test('save persists a reloadable project (Phase 24 persistence)', () => {
    const storage = memStorage();
    const ts = new TimelineState({ storage, autopersist: false });
    ts.setState({
      project: { ...ts.getRawState().project, tracks: [], assets: [], duration: 0, captions: [], markers: [] },
    });
    const api = new TimelineFeatureApi(ts);
    const assetId = api.addAsset(normalizeAsset({ type: 'video', name: 'Vid', duration: 8, url: 'x.mp4' }));
    api.addVideo({ assetId });

    api.save();
    const raw = storage.getItem('timeline-state');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    const allClips = parsed.project.tracks.flatMap((t) => t.items || t.clips || []);
    expect(allClips.some((c) => c.assetId === assetId)).toBe(true);

    const ts2 = new TimelineState({ storage, autopersist: false });
    const reopenedClips = ts2.getRawState().project.tracks.flatMap((t) => t.items || []);
    expect(reopenedClips.some((c) => c.assetId === assetId)).toBe(true);
  });

  test('legacy clip count mirrors flat-model count (no second state system)', () => {
    const ts = freshState();
    const api = new TimelineFeatureApi(ts);
    const assetId = api.addAsset(normalizeAsset({ type: 'image', name: 'I', duration: 5 }));
    api.addImage({ assetId });
    expect(legacyClipCount(ts)).toBe(flatClipCount(ts));
  });
});
