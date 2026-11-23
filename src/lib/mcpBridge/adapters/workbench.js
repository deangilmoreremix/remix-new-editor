// Workbench tab tools. The editor lives in a same-origin iframe; edits go through its own validator (applyOps, the one the AI chat uses).
const obj = (properties = {}, required = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const OPS_HELP = 'Edit operations, at most 100 per call. Each is { op: "update_clip" | "set_props" | "add_clip" | "remove_clip" | ..., clipId, ... } exactly as in the Workbench AI chat; call workbench_get_project first for clip ids and card ids. Media URLs the project does not already contain are refused.';

/** @param {{ rpc: { call: (op: string, args?: object) => Promise<any> }, importAssets: (assets: object[], mode: string, name?: string|null) => void }} deps */
export function createWorkbenchTools({ rpc, importAssets }) {
  return [
    { name: 'workbench_get_project', risk: 'read', description: 'The Workbench project: tracks, clips (ids, card, timing, props) and the selected clip.', schema: obj(), run: () => rpc.call('get_project') },
    { name: 'workbench_run_ops', risk: 'write', description: 'Edit the Workbench project with validated operations (undo with workbench_undo).', schema: obj({ ops: { type: 'array', items: { type: 'object' }, maxItems: 100, description: OPS_HELP } }, ['ops']), run: (a) => rpc.call('run_ops', { ops: Array.isArray(a.ops) ? a.ops.slice(0, 100) : [] }) },
    { name: 'workbench_undo', risk: 'write', description: 'Undo the last Workbench edit.', schema: obj(), run: () => rpc.call('undo') },
    { name: 'workbench_redo', risk: 'write', description: 'Redo.', schema: obj(), run: () => rpc.call('redo') },
    {
      name: 'workbench_import_assets', risk: 'write',
      description: 'Add media to the Workbench from public https links. mode "append" adds to the current project; "new" starts a new one.',
      schema: obj({ assets: { type: 'array', maxItems: 20, items: obj({ url: { type: 'string' }, kind: { type: 'string', enum: ['video', 'image', 'audio'] }, name: { type: 'string' } }, ['url']) }, mode: { type: 'string', enum: ['append', 'new'] }, name: { type: 'string' } }, ['assets']),
      run: (a) => {
        const assets = (Array.isArray(a.assets) ? a.assets : []).filter((x) => typeof x?.url === 'string' && /^https:\/\//i.test(x.url)).slice(0, 20)
          .map((x) => ({ url: x.url, kind: ['video', 'image', 'audio'].includes(x.kind) ? x.kind : 'image', name: String(x.name || '').slice(0, 80) || undefined }));
        if (!assets.length) throw new Error('Give at least one https media link.');
        importAssets(assets, a.mode === 'new' ? 'new' : 'append', typeof a.name === 'string' ? a.name.slice(0, 80) : null);
        return { requested: assets.length };
      },
    },
  ];
}

export const WORKBENCH_NOT_EXPOSED = {
  workbench_export: 'Rendering the MP4 runs behind the Export button in the editor and has no call to trigger it from outside.',
  workbench_ai_chat: 'The editor chat needs the user\'s own OpenAI key held in the iframe; use workbench_run_ops with explicit operations instead.',
  workbench_file_upload: 'Uploading a local file needs a file the user picks; import by https link instead.',
};
