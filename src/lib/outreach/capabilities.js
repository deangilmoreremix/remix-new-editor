// src/lib/outreach/capabilities.js
//
// What this browser can do for Video Outreach (requirement 48). Pure feature detection: nothing is requested,
// no permission prompt is shown and nothing is downloaded. "permission" means the feature exists but needs the
// user's OK when it is first used; "unknown" means the browser can't say without asking.

const has = (v) => v !== undefined && v !== null;

/**
 * @param {object} [env] window-like object (default: globalThis), for tests
 * @returns {{ id:string, group:string, label:string, status:'supported'|'unavailable'|'permission'|'unknown', detail:string }[]}
 */
export function detectCapabilities(env = globalThis) {
  const nav = env.navigator || {};
  const md = nav.mediaDevices || {};
  const items = [];
  const add = (id, group, label, status, detail = '') => items.push({ id, group, label, status, detail });
  const yes = (ok, perm = false) => (ok ? (perm ? 'permission' : 'supported') : 'unavailable');

  add('secure', 'Basics', 'Secure page (https)', yes(env.isSecureContext !== false), env.isSecureContext === false ? 'Recording, push and the clipboard need https.' : '');
  add('camera', 'Recording', 'Camera and microphone', yes(typeof md.getUserMedia === 'function', true), 'Asks for permission when you start.');
  add('screen', 'Recording', 'Screen recording', yes(typeof md.getDisplayMedia === 'function', true), 'Mostly desktop browsers; not on most phones.');
  add('recorder', 'Recording', 'MediaRecorder', yes(has(env.MediaRecorder)));
  add('pip', 'Recording', 'Floating window (Picture-in-Picture)', yes(has(env.documentPictureInPicture) || (env.document && env.document.pictureInPictureEnabled === true)), 'Chromium browsers.');
  add('webcodecs', 'Media', 'WebCodecs (fast MP4 export)', yes(has(env.VideoEncoder) && has(env.VideoDecoder)), 'Without it, exports use the slower path or WebM.');
  add('audioworklet', 'Media', 'AudioWorklet (live audio processing)', yes(has(env.AudioWorklet) || has(env.AudioContext?.prototype?.audioWorklet) || (has(env.AudioContext) && 'audioWorklet' in (env.AudioContext.prototype || {}))));
  add('webgpu', 'On-device AI', 'WebGPU (faster local models)', yes(has(nav.gpu)), 'Without it, local models use WebAssembly and run slower.');
  add('wasm', 'On-device AI', 'WebAssembly', yes(typeof env.WebAssembly === 'object'));
  add('workers', 'On-device AI', 'Web Workers', yes(has(env.Worker)));
  add('clipboard', 'Sharing', 'Copy to clipboard', yes(has(nav.clipboard) && typeof nav.clipboard.writeText === 'function'));
  add('clipboardRich', 'Sharing', 'Copy images and rich text', yes(has(nav.clipboard) && typeof nav.clipboard.write === 'function' && has(env.ClipboardItem)));
  add('share', 'Sharing', 'Share sheet (Web Share)', yes(typeof nav.share === 'function'), 'Mainly phones and Safari; files are not always accepted.');
  add('push', 'Notifications', 'Browser notifications (Push)', yes(has(nav.serviceWorker) && has(env.PushManager) && has(env.Notification), true), 'On iPhone it works only for an app added to the Home Screen.');
  add('indexeddb', 'Storage', 'IndexedDB (offline drafts)', yes(has(env.indexedDB)));
  add('opfs', 'Storage', 'Private file storage (OPFS)', yes(typeof nav.storage?.getDirectory === 'function'));
  add('locks', 'Storage', 'Multi-tab protection (Web Locks)', yes(has(nav.locks)), 'Without it you only get a "changed in another tab" notice.');
  add('broadcast', 'Storage', 'Tab messages (BroadcastChannel)', yes(has(env.BroadcastChannel)));
  add('memory', 'Device', 'Device memory', has(nav.deviceMemory) ? 'supported' : 'unknown', has(nav.deviceMemory) ? `About ${nav.deviceMemory} GB` : 'This browser does not say.');
  return items;
}

/** Counts by status, for a one-line summary. */
export function summarizeCapabilities(items) {
  const out = { supported: 0, permission: 0, unavailable: 0, unknown: 0 };
  for (const i of items) out[i.status] = (out[i.status] || 0) + 1;
  return out;
}
