// Motion Director tab tools: the studio's own deterministic agent (interpretAgentCommand), its op applier and store actions.
const obj = (properties = {}, required = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const short = (v, n = 200) => (typeof v === 'string' ? v.slice(0, n) : v);

/** @param {{ getState: () => any, interpretAgentCommand: Function, applyAgentOps: Function, cards?: object, requestExport: () => void }} deps */
export function createMotionDirectorTools({ getState, interpretAgentCommand, applyAgentOps, cards, requestExport }) {
  const summary = () => {
    const s = getState();
    const p = s.project || {};
    return {
      name: p.name, fps: p.fps, width: p.width, height: p.height, background: p.background, selectedClipId: s.selectedClipId ?? null,
      tracks: (p.tracks || []).map((t) => ({ id: t.id, name: t.name, clips: (t.clips || []).map((c) => ({ id: c.id, cardId: c.cardId, label: c.label, start: c.start, duration: c.duration, props: Object.fromEntries(Object.entries(c.props || {}).filter(([, v]) => typeof v !== 'object' || v === null).map(([k, v]) => [k, short(v)])) })) })),
    };
  };
  const clipExists = (id) => (getState().project?.tracks || []).some((t) => (t.clips || []).some((c) => c.id === id));
  const apply = (ops, reply) => { if (ops.length) applyAgentOps(ops); return { applied: ops.length, reply }; };
  return [
    { name: 'motion_director_get_project', risk: 'read', description: 'The Motion Director project: size, tracks, clips and their simple properties.', schema: obj(), run: summary },
    {
      name: 'motion_director_command', risk: 'write',
      description: 'Give the studio agent a plain-English edit ("make the title red", "add a caption", "background black"). Same interpreter as the in-app chat; applied: 0 means it did not understand.',
      schema: obj({ text: { type: 'string', maxLength: 500 } }, ['text']),
      run: (a) => { const s = getState(); const r = interpretAgentCommand(String(a.text || '').slice(0, 500), { project: s.project, selectedClipId: s.selectedClipId, cards }); return apply(r.ops, r.reply); },
    },
    {
      name: 'motion_director_set_clip_props', risk: 'write', description: 'Change a clip\'s properties (text, colors, sizes) by id.',
      schema: obj({ clip_id: { type: 'string' }, props: { type: 'object' } }, ['clip_id', 'props']),
      run: (a) => { if (!clipExists(a.clip_id)) throw new Error('No such clip.'); return apply([{ kind: 'updateClipProps', clipId: a.clip_id, props: a.props || {}, label: 'MCP edit' }], 'Updated the clip.'); },
    },
    {
      name: 'motion_director_add_clip', risk: 'write', description: 'Add a motion card as a clip (card ids appear in motion_director_get_project).',
      schema: obj({ card_id: { type: 'string' }, track_id: { type: 'string' }, at: { type: 'number' }, props: { type: 'object' } }, ['card_id']),
      run: (a) => { if (cards && !Object.hasOwn(cards, a.card_id)) throw new Error('Unknown card.'); return apply([{ kind: 'addClip', cardId: a.card_id, trackId: a.track_id, at: a.at, props: a.props, label: 'MCP add' }], 'Added the clip.'); },
    },
    {
      name: 'motion_director_remove_clip', risk: 'write', description: 'Remove a clip (undoable with motion_director_undo).',
      schema: obj({ clip_id: { type: 'string' } }, ['clip_id']),
      run: (a) => { if (!clipExists(a.clip_id)) throw new Error('No such clip.'); return apply([{ kind: 'removeClip', clipId: a.clip_id, label: 'MCP remove' }], 'Removed the clip.'); },
    },
    { name: 'motion_director_set_background', risk: 'write', description: 'Set the background color (hex).', schema: obj({ color: { type: 'string', pattern: '^#[0-9a-fA-F]{3,8}$' } }, ['color']), run: (a) => { if (!/^#[0-9a-fA-F]{3,8}$/.test(String(a.color))) throw new Error('Use a hex color like #000000.'); return apply([{ kind: 'setBackground', color: a.color, label: 'MCP background' }], 'Background set.'); } },
    { name: 'motion_director_undo', risk: 'write', description: 'Undo the last edit.', schema: obj(), run: () => { getState().undo(); return { ok: true }; } },
    { name: 'motion_director_redo', risk: 'write', description: 'Redo.', schema: obj(), run: () => { getState().redo(); return { ok: true }; } },
    { name: 'motion_director_render', risk: 'write', description: 'Start the MP4 render in this browser tab (the studio\'s own export; it saves like the Export button does). Returns when started, not when finished.', schema: obj(), run: () => { requestExport(); return { started: true }; } },
  ];
}

export const MOTION_DIRECTOR_NOT_EXPOSED = {
  film_director_chat: 'The multi-step film pipeline (plan, pictures, music, review) is driven from the chat panel and has no single call to run it.',
  timeline_dragging: 'Drag, resize and trim gestures on the timeline have no programmatic surface; edits go through clip properties and the command interpreter.',
  render_progress: 'The render reports progress inside the Export button only; motion_director_render starts it and the user sees the result there.',
};
