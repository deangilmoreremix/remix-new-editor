// src/lib/recorder/permissions.js
//
// Clear help when the camera or microphone is blocked (Permissions API). Firefox and Safari don't
// support querying 'camera'/'microphone' everywhere; then the state is 'unknown' and nothing changes.

export async function permissionState(name, nav = globalThis.navigator) {
  try {
    const status = await nav?.permissions?.query?.({ name });
    return status?.state || 'unknown';
  } catch { return 'unknown'; }
}

/** { camera, microphone }: 'granted' | 'denied' | 'prompt' | 'unknown'. */
export async function mediaPermissions(nav = globalThis.navigator) {
  const [camera, microphone] = await Promise.all([permissionState('camera', nav), permissionState('microphone', nav)]);
  return { camera, microphone };
}

/** Call `onChange` when either permission changes (e.g. the user clicks Allow). Returns a stop function. */
export async function watchMediaPermissions(onChange, nav = globalThis.navigator) {
  const subs = [];
  for (const name of ['camera', 'microphone']) {
    try {
      const status = await nav?.permissions?.query?.({ name });
      if (!status?.addEventListener) continue;
      const fn = () => onChange(name, status.state);
      status.addEventListener('change', fn);
      subs.push(() => status.removeEventListener('change', fn));
    } catch { /* not supported */ }
  }
  return () => subs.forEach((s) => s());
}

const HOW_TO_ALLOW = 'Click the camera or lock icon at the left of the address bar, set Camera and Microphone to Allow, then try again.';

/**
 * What to tell the user. `need` lists what this action uses (['camera'], ['camera','microphone']…),
 * `perms` comes from mediaPermissions(), `err` is the getUserMedia error, if any.
 */
export function permissionMessage({ need = ['camera', 'microphone'], perms = {}, err = null, host = globalThis.location?.host || 'this site' } = {}) {
  const label = (n) => (n === 'camera' ? 'Camera' : 'Microphone');
  const blocked = need.filter((n) => perms[n] === 'denied');
  if (blocked.length) return `${blocked.map(label).join(' and ')} ${blocked.length > 1 ? 'are' : 'is'} blocked for ${host}. ${HOW_TO_ALLOW}`;
  const name = err?.name || '';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return need.includes('camera') ? 'No camera was found. Plug one in, or choose Screen or Audio only.' : 'No microphone was found. Plug one in and try again.';
  }
  if (name === 'NotReadableError') return 'Your camera or microphone is being used by another app. Close it (Zoom, Teams, FaceTime…) and try again.';
  if (name === 'NotAllowedError' || name === 'SecurityError') return `Access was not allowed. ${HOW_TO_ALLOW}`;
  return '';
}

/** Shown before the browser's own prompt appears. */
export function promptHint(perms = {}, need = ['camera', 'microphone']) {
  return need.some((n) => perms[n] === 'prompt') ? 'Your browser will ask for access. Choose Allow.' : '';
}
