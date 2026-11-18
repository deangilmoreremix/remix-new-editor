// Trusted host page: creates the sandboxed iframe and talks to it with postMessage only.
const f = document.createElement('iframe');
f.setAttribute('sandbox', 'allow-scripts'); // no allow-same-origin => opaque origin
f.src = '/sandbox-runner.html'; f.style.cssText = 'width:1px;height:1px;position:fixed;left:0;top:0;border:0';
document.body.appendChild(f);
const pending = new Map(); let n = 0;
const ready = new Promise((res) => window.addEventListener('message', (e) => { if (e.source === f.contentWindow && e.data?.type === 'ready') res(); }));
window.addEventListener('message', (e) => { if (e.source !== f.contentWindow) return; const p = pending.get(e.data?.id); if (p) { pending.delete(e.data.id); p(e.data); } });
const call = async (msg) => { await ready; const id = ++n; return new Promise((res) => { pending.set(id, res); f.contentWindow.postMessage({ id, ...msg }, '*'); setTimeout(() => { if (pending.delete(id)) res({ ok: false, error: 'timeout' }); }, 240000); }); };
window.__sandbox = { call, hostOrigin: location.origin, hostCookie: (document.cookie = 'host_secret=1; path=/', 'host_secret=1') };
