// TEST-HARNESS ONLY, and only needed in sandboxes where direct internet egress is blocked (set USE_SANDBOX_EGRESS=1). Never used in production.
// The capture engine's allow-list proxy dials destinations directly (right for Netlify). This patch routes that one dial through
// the sandbox proxy as a CONNECT tunnel. TLS verification is untouched (the browser still validates the site's real certificate).
import net from 'node:net'
import { syncBuiltinESMExports } from 'node:module'
import dns from 'node:dns/promises'
const proxy = new URL(process.env.HTTPS_PROXY)
// The egress proxy's policy is hostname-based; the engine dials the resolved IP. Map each IP back to the host being captured.
const ipToHost = new Map()
for (const h of (process.env.CAPTURE_TARGET_HOSTS || '').split(',').filter(Boolean)) {
  for (const a of await dns.lookup(h, { all: true })) ipToHost.set(a.address, h)
}
const orig = net.connect
net.connect = function patched(...args) {
  const opts = typeof args[0] === 'object' ? args[0] : { port: args[0], host: args[1] }
  const host = ipToHost.get(opts.host) ?? opts.host
  if (!host || host === '127.0.0.1' || host === 'localhost' || host === '::1') return orig.apply(this, args)
  const s = orig({ host: proxy.hostname, port: Number(proxy.port) })
  const emit = s.emit.bind(s)
  let armed = false
  s.emit = (ev, ...a) => {
    if (ev === 'connect' && !armed) {
      armed = true
      s.write(`CONNECT ${host}:${opts.port} HTTP/1.1\r\nHost: ${host}:${opts.port}\r\n\r\n`)
      s.once('data', (d) => {
        const first = d.toString().split('\r\n')[0]
        if (/\s200\s/.test(first)) emit('connect')
        else emit('error', new Error(`sandbox proxy refused CONNECT: ${first}`))
      })
      return true
    }
    return emit(ev, ...a)
  }
  return s
}
syncBuiltinESMExports()
console.log('[sandbox-egress] upstream dials routed through the sandbox proxy')
