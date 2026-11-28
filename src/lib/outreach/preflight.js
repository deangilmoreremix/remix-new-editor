// src/lib/outreach/preflight.js
//
// One checklist before recording (requirement 8). It only reads what the browser already knows: it never opens the camera
// or microphone and never shows a permission prompt. Each item is 'ok', 'warn' (you can still record) or 'fail' (recording
// will not work), with one sentence on what to do.

// Less free space than this and a long recording may not save (about 3 minutes of 1080p at a high bitrate).
export const MIN_FREE_BYTES = 200 * 1048576;

const CODECS = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

/**
 * @param {object} [env]  window-like object (default: globalThis) for tests
 * @param {{ permissions?: object, devices?: {kind:string}[], storageEstimate?: {quota:number, usage:number}|null, battery?: {level:number, charging:boolean}|null }} [known]
 *   Facts already looked up (see lookupFacts); items whose fact is missing say "could not be checked".
 * @returns {{ id:string, label:string, status:'ok'|'warn'|'fail', advice:string }[]}
 */
export function preflight(env = globalThis, known = {}) {
  const nav = env.navigator || {};
  const out = [];
  const add = (id, label, status, advice = '') => out.push({ id, label, status, advice });

  add('secure', 'Secure page', env.isSecureContext === false ? 'fail' : 'ok', env.isSecureContext === false ? 'Open this page over https: the browser blocks the camera on other pages.' : '');
  const canCapture = typeof nav.mediaDevices?.getUserMedia === 'function';
  add('capture', 'Camera and microphone support', canCapture ? 'ok' : 'fail', canCapture ? '' : 'This browser cannot record from a camera. Try Chrome, Edge, Firefox or Safari.');
  const recorder = typeof env.MediaRecorder === 'function' || (env.MediaRecorder && typeof env.MediaRecorder.isTypeSupported === 'function');
  const type = recorder && typeof env.MediaRecorder.isTypeSupported === 'function' ? CODECS.find((c) => env.MediaRecorder.isTypeSupported(c)) : recorder ? 'unknown' : null;
  add('recorder', 'Video format', type ? 'ok' : 'fail', type ? '' : 'This browser cannot save a recording.');

  const perm = known.permissions || {};
  for (const [id, label] of [['camera', 'Camera permission'], ['microphone', 'Microphone permission']]) {
    const s = perm[id];
    if (s === 'granted') add(id, label, 'ok');
    else if (s === 'denied') add(id, label, 'fail', `Allow the ${id} for this site in your browser's address bar settings, then reload.`);
    else if (s === 'prompt') add(id, label, 'ok', 'The browser will ask when you start. Choose Allow.');
    else add(id, label, 'warn', 'The browser does not say before you start. You will be asked when you press record.');
  }
  if (Array.isArray(known.devices)) {
    const cams = known.devices.filter((d) => d.kind === 'videoinput').length;
    const mics = known.devices.filter((d) => d.kind === 'audioinput').length;
    add('devices', 'Camera and microphone found', cams && mics ? 'ok' : 'fail', cams && mics ? '' : `${cams ? '' : 'No camera found. '}${mics ? '' : 'No microphone found. '}Plug one in or check it is not used by another app.`.trim());
  } else add('devices', 'Camera and microphone found', 'warn', 'Could not be checked before you start.');

  const est = known.storageEstimate;
  if (est && est.quota > 0) {
    const free = est.quota - (est.usage || 0);
    const mb = Math.round(free / 1048576);
    add('storage', 'Space for the recording', free < MIN_FREE_BYTES ? 'warn' : 'ok', free < MIN_FREE_BYTES ? `Only about ${mb} MB is free for this site. Long recordings may not save: free some space first.` : '');
  } else add('storage', 'Space for the recording', 'warn', 'The browser does not say how much space is free.');

  const b = known.battery;
  if (b && b.level <= 0.15 && !b.charging) add('battery', 'Battery', 'warn', 'The battery is low. Plug in before a long recording.');
  else if (b) add('battery', 'Battery', 'ok');

  add('online', 'Connection', nav.onLine === false ? 'warn' : 'ok', nav.onLine === false ? 'You are offline. You can record, but uploading waits until you are back online.' : '');
  return out;
}

/** Summary line: counts and the worst status. */
export function summarizePreflight(items) {
  const count = { ok: 0, warn: 0, fail: 0 };
  items.forEach((i) => { count[i.status] += 1; });
  return { ...count, status: count.fail ? 'fail' : count.warn ? 'warn' : 'ok', ready: count.fail === 0 };
}

/** Look up the facts that need a promise. Never prompts; any lookup the browser refuses is simply left out. */
export async function lookupFacts(env = globalThis) {
  const nav = env.navigator || {};
  const facts = {};
  const permissions = {};
  for (const [id, name] of [['camera', 'camera'], ['microphone', 'microphone']]) {
    try { permissions[id] = (await nav.permissions.query({ name })).state; } catch { /* some browsers do not support querying this */ }
  }
  facts.permissions = permissions;
  try { facts.devices = (await nav.mediaDevices.enumerateDevices()).map((d) => ({ kind: d.kind })); } catch { /* unavailable */ }
  try { facts.storageEstimate = await nav.storage.estimate(); } catch { /* unavailable */ }
  try { const b = await nav.getBattery(); facts.battery = { level: b.level, charging: b.charging }; } catch { /* unavailable (most non-Chromium browsers) */ }
  return facts;
}
