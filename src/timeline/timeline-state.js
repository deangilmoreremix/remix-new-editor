/**
 * Timeline state/data model utilities.
 */

export function createProject(overrides = {}) {
  return {
    id: overrides.id || 'project',
    fps: overrides.fps || 30,
    duration: overrides.duration || 60,
    aspectRatio: overrides.aspectRatio || '16:9',
    tracks: overrides.tracks || [],
    assets: overrides.assets || [],
    markers: overrides.markers || [],
    captions: overrides.captions || [],
    effects: overrides.effects || []
  };
}

export function createTrack(overrides = {}) {
  return {
    id: overrides.id || 'track',
    type: overrides.type || 'video',
    name: overrides.name || 'Track',
    locked: overrides.locked || false,
    muted: overrides.muted || false,
    items: overrides.items || []
  };
}

export function createItem(overrides = {}) {
  return {
    id: overrides.id || 'item',
    assetId: overrides.assetId || 'asset',
    type: overrides.type || 'video',
    start: overrides.start || 0,
    end: overrides.end || 0,
    sourceStart: overrides.sourceStart ?? overrides.start ?? 0,
    sourceEnd: overrides.sourceEnd ?? overrides.end ?? 0,
    lane: overrides.lane ?? 0,
    x: overrides.x ?? 0,
    width: overrides.width ?? 100,
    trimIn: overrides.trimIn ?? 0,
    trimOut: overrides.trimOut ?? 0,
    volume: overrides.volume ?? 1,
    playbackRate: overrides.playbackRate ?? 1,
    effects: overrides.effects || []
  };
}

export function validateProject(project) {
  if (!project || typeof project !== 'object') throw new Error('Invalid project');
  if (!project.id) throw new Error('Project missing id');
  if (!project.fps || !project.duration || !project.aspectRatio) throw new Error('Project missing required fields');
  return true;
}

export function validateTrack(track) {
  if (!track || typeof track !== 'object') throw new Error('Invalid track');
  const validTypes = ['video', 'audio', 'text', 'captions', 'effects'];
  if (!validTypes.includes(track.type)) throw new Error('Invalid track type');
  return true;
}

export function validateItem(item) {
  if (!item || typeof item !== 'object') throw new Error('Invalid item');
  if (typeof item.start !== 'number' || typeof item.end !== 'number') throw new Error('Invalid item timing');
  if (item.end < item.start) throw new Error('Item end must be >= start');
  return true;
}
