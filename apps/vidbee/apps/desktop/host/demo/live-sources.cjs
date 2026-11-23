// Demo helper (host tool): local HTTP sources so two real downloads show live progress / speed / ETA, like the marketing screenshots.
const http = require('http');
const MiB = 1024 * 1024;
const stream = (res, total, bytesPerSec) => {
  res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': total, 'accept-ranges': 'none' });
  const chunk = Buffer.alloc(bytesPerSec / 10);
  let sent = 0;
  const timer = setInterval(() => { if (sent >= total) { clearInterval(timer); return res.end(); } sent += chunk.length; res.write(chunk); }, 100);
  res.on('close', () => clearInterval(timer));
};
http.createServer((req, res) => {
  if (req.url.startsWith('/design')) return stream(res, 615 * MiB, 8.4 * MiB);   // ~67% after ~49 s
  if (req.url.startsWith('/field')) return stream(res, 400 * MiB, 0.4 * MiB);    // barely started
  res.writeHead(404); res.end();
}).listen(8113);
