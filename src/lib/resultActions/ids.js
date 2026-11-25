/**
 * Small, dependency-free stable ids. They make "Get link" idempotent: the same owner and the same result address
 * always give the same stored file name and the same /watch id, so a second click reuses the first result.
 * Not security tokens (a /watch id is public by design); a collision needs ~2^53 inputs.
 */

/** cyrb53: a fast 53-bit string hash. */
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** 20 lower-case letters and digits from two independent 53-bit hashes (about 100 bits). */
export function stableId(input) {
  const s = String(input ?? '');
  const part = (seed) => cyrb53(s, seed).toString(36).padStart(11, '0').slice(-10);
  return `${part(1)}${part(2)}`;
}

/** Address without its #fragment, so the same file is the same key. */
export const canonicalSource = (url) => String(url || '').split('#')[0];
