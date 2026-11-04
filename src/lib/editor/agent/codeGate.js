/**
 * Static gate for AI-written Remotion animation code (create_animation).
 *
 * The code only ever runs inside a sandboxed, opaque-origin iframe (the
 * export runner and the animation preview frame), which already denies it
 * the editor's cookies, storage and DOM. This gate is the second layer: it
 * rejects code that tries to reach browser APIs, the network or the
 * JavaScript escape hatches, so mistakes and prompt-injected code fail
 * early with a clear message the agent can fix.
 */
export const MAX_CODE_BYTES = 20 * 1024;

const BLOCKED = [
  [/\bimport\b\s*[\s({*'"]/, 'import statements are not allowed — everything you need is already in scope'],
  [/\bimport\s*\(/, 'dynamic import() is not allowed'],
  [/\brequire\s*\(/, 'require() is not allowed'],
  [/\beval\b/, 'eval is not allowed'],
  [/\bFunction\b/, 'the Function constructor is not allowed'],
  [/\bconstructor\b/, '"constructor" access is not allowed'],
  [/__proto__|\bprototype\b|\bgetPrototypeOf\b|\bsetPrototypeOf\b|\bdefineProperty\b|\bReflect\b|\bProxy\b/, 'prototype manipulation is not allowed'],
  // Globals are matched as identifiers only: `rect.top` and `{ top: 10 }` are fine.
  [/(?<![.\w$])(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|RTCPeerConnection)\b(?!\s*:)/, 'network access is not allowed'],
  [/(?<![.\w$])(window|document|globalThis|self|parent|top|opener|frames|navigator|location|history)\b(?!\s*:)/, 'browser globals are not allowed'],
  [/(?<![.\w$])(localStorage|sessionStorage|indexedDB|caches|cookie|cookieStore)\b(?!\s*:)/, 'storage access is not allowed'],
  [/\b(postMessage|importScripts|Worker|SharedWorker|ServiceWorker|BroadcastChannel|MessageChannel)\b/, 'messaging and workers are not allowed'],
  [/\b(setTimeout|setInterval|requestAnimationFrame|queueMicrotask)\b/, 'timers are not allowed — animate with useCurrentFrame()'],
  [/\bMath\.random\b/, "Math.random() is not deterministic — use random('seed')"],
  [/\bdangerouslySetInnerHTML\b|\binnerHTML\b|\bouterHTML\b|\binsertAdjacentHTML\b/, 'raw HTML injection is not allowed'],
  [/\bwith\s*\(/, 'with statements are not allowed'],
  [/\bdebugger\b/, 'debugger is not allowed'],
  [/\bstaticFile\b/, 'staticFile is not available — pass media URLs in props'],
];

/** Remove comments and string/template contents so they can't hide or trigger matches. */
function stripLiterals(code) {
  let out = '';
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    const d = code[i + 1];
    if (c === '/' && d === '/') { while (i < n && code[i] !== '\n') i += 1; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i += 1; i += 2; continue; }
    if (c === '"' || c === "'") {
      const q = c; out += q; i += 1;
      while (i < n && code[i] !== q && code[i] !== '\n') { if (code[i] === '\\') i += 1; i += 1; }
      out += q; i += 1; continue;
    }
    if (c === '`') {
      // Keep ${…} expressions (they are code), drop the literal text.
      out += '`'; i += 1;
      while (i < n && code[i] !== '`') {
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === '$' && code[i + 1] === '{') {
          let depth = 1; i += 2; out += '${';
          while (i < n && depth) { if (code[i] === '{') depth += 1; else if (code[i] === '}') depth -= 1; if (depth) out += code[i]; i += 1; }
          out += '}';
          continue;
        }
        i += 1;
      }
      out += '`'; i += 1; continue;
    }
    out += c; i += 1;
  }
  return out;
}

/**
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function checkAnimationCode(code) {
  const errors = [];
  const src = String(code ?? '');
  if (!src.trim()) errors.push('The code is empty');
  if (new TextEncoder().encode(src).length > MAX_CODE_BYTES) errors.push(`The code is larger than ${MAX_CODE_BYTES / 1024} KB`);
  const bare = stripLiterals(src);
  // Bracket access with a computed key can reach anything (e.g. x['const'+'ructor']).
  if (/\[\s*[^\]\d\s'"`-][^\]]*\+[^\]]*\]/.test(bare) && /['"`]\s*\+|\+\s*['"`]/.test(bare)) {
    errors.push('computed property names built from strings are not allowed');
  }
  BLOCKED.forEach(([re, msg]) => { if (re.test(bare) && !errors.includes(msg)) errors.push(msg); });
  if (!/\bfunction\s+Animation\b|\b(const|let|var)\s+Animation\s*=/.test(bare)) {
    errors.push('Define the component as `function Animation({ props }) { … }`');
  }
  return { ok: errors.length === 0, errors };
}

/** Strip a leading `export default` / `export` the model may add out of habit. */
export const normalizeAnimationCode = (code) => String(code ?? '')
  .replace(/^\s*export\s+default\s+(?=function|class)/m, '')
  .replace(/^\s*export\s+(?=(function|const|let|var)\b)/gm, '');
