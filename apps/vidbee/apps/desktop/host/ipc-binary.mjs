// Binary arguments over the JSON IPC bridge (not upstream). `JSON.stringify` turns an ArrayBuffer into `{}` and a typed array
// into an index map, so a saved share image arrived as zero bytes. The browser shim (web-shim.js, `binaryReplacer`) wraps binary values as
// `{ "__vidbeeBinary": "<base64>" }`; this reviver turns them back into Buffers (a Uint8Array) on the server.

/** Use as the second argument of JSON.parse. */
export const reviveBinary = (_key, value) =>
  value && typeof value === 'object' && typeof value.__vidbeeBinary === 'string' ? Buffer.from(value.__vidbeeBinary, 'base64') : value
