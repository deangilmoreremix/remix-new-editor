// Demo helper (host tool): OpenAI-compatible stand-in so the real AI runner renders a result. The text is placeholder content.
const http = require('http');
const BULLETS = `# Research review bottlenecks
- Alex often remembers an insight but not which of six recordings contained it.
- Quotes are currently split across video files, a notes document, and a spreadsheet.
- Manual scrubbing causes relevant evidence to appear after the decision meeting.
- Copying timestamps and rebuilding context by hand is the point where the workflow breaks down.

# Evidence required for every finding
- Searchable transcript text with the surrounding sentences visible.
- A verified speaker name and an exact timestamp for every selected quote.
- One-click navigation from a transcript result back to the original audio or video.
- Corrections that apply consistently everywhere the same person speaks.

# Collaboration needs
- Research wants a Markdown brief with themes, objections, and supporting quotes.
- Design needs enough context to distinguish a real pattern from an isolated comment.
- Support needs speaker-aware excerpts and subtitle files for internal training.`;
http.createServer((q, r) => {
  let b = ''; q.on('data', (d) => (b += d)); q.on('end', () => {
    if ((q.url || '').endsWith('/models')) { r.setHeader('content-type', 'application/json'); return r.end(JSON.stringify({ data: [{ id: 'demo-model' }] })); }
    let body = {}; try { body = JSON.parse(b || '{}'); } catch { /* ignore */ }
    const text = JSON.stringify(body.messages ?? '');
    const reply = /bullet/i.test(text) ? BULLETS : '## Summary\n- Placeholder reply from the demo provider.';
    if (body.stream) {
      r.writeHead(200, { 'content-type': 'text/event-stream' });
      const chunk = (delta, fin) => `data: ${JSON.stringify({ id: 'c', object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta, finish_reason: fin ?? null }] })}\n\n`;
      r.write(chunk({ role: 'assistant', content: '' }));
      for (const p of reply.match(/[\s\S]{1,40}/g)) r.write(chunk({ content: p }));
      r.write(chunk({}, 'stop')); r.end('data: [DONE]\n\n');
    } else { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ id: 'x', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }] })); }
  });
}).listen(8112);
