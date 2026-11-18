#!/usr/bin/env node
/**
 * Checks the keyed parts of the Template Generator against the real services, using the app's OWN server handlers
 * (the same code the Netlify functions run), so a pass here means the deployed functions will work with the same keys.
 *
 *   PEXELS_API_KEY=… PIXABAY_API_KEY=… OPENAI_API_KEY=… node scripts/verify-template-generator-keys.mjs [--out=./verify-out]
 *
 * Each check runs only when its key is set (the others print SKIP). Keys are read from the environment and never printed.
 *  - Pexels videos + photos  (netlify/functions/pexels.js)
 *  - Pixabay videos + images (netlify/functions/pixabay.js)
 *  - OpenAI voiceover        (netlify/functions/agent-audio.js `handle`, the part after the Clerk sign-in check): saves a real mp3 you can play
 * Exit code 1 if any check that ran failed.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** True when the bytes look like an mp3 (an ID3 tag or an MPEG frame sync) and are big enough to be real speech. */
export function looksLikeMp3(buf) {
  if (!buf || buf.length < 2000) return false;
  const id3 = buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33;
  const sync = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
  return id3 || sync;
}

export const dataUrlToBuffer = (url) => Buffer.from(String(url).split(',')[1] || '', 'base64');

/** One line per check: PASS / FAIL / SKIP. */
export function summarize(results) {
  const lines = results.map((r) => `${r.status.padEnd(4)}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const ran = results.filter((r) => r.status !== 'SKIP').length;
  return { text: lines.join('\n'), failed, ran };
}

const get = (handler, name, route, query) => handler({ httpMethod: 'GET', path: `/api/${name}/${route}`, queryStringParameters: query, headers: {} });
const parse = (res) => { try { return JSON.parse(res.body); } catch { return null; } };

export async function runChecks({ env = process.env, outDir = null, handlers = null } = {}) {
  const h = handlers || {
    pexels: (await import('../netlify/functions/pexels.js')).handler,
    pixabay: (await import('../netlify/functions/pixabay.js')).handler,
    audio: (await import('../netlify/functions/agent-audio.js')).handle,
  };
  const results = [];
  const add = (name, status, detail = '') => results.push({ name, status, detail });
  const guard = async (name, fn) => { try { await fn(); } catch (e) { add(name, 'FAIL', String(e?.message || e).slice(0, 160)); } };

  if (!env.PEXELS_API_KEY) { add('Pexels videos and photos', 'SKIP', 'set PEXELS_API_KEY'); } else {
    process.env.PEXELS_API_KEY = env.PEXELS_API_KEY;
    await guard('Pexels videos', async () => {
      const res = await get(h.pexels, 'pexels', 'videos/search', { query: 'restaurant kitchen', per_page: '3' });
      const body = parse(res);
      const n = body?.videos?.length || 0;
      const files = body?.videos?.[0]?.video_files?.length || 0;
      if (res.statusCode === 200 && n > 0 && files > 0) add('Pexels videos', 'PASS', `${n} results, playable files listed`); else add('Pexels videos', 'FAIL', `HTTP ${res.statusCode}`);
    });
    await guard('Pexels photos', async () => {
      const res = await get(h.pexels, 'pexels', 'photos/search', { query: 'restaurant', per_page: '3' });
      const n = parse(res)?.photos?.length || 0;
      if (res.statusCode === 200 && n > 0) add('Pexels photos', 'PASS', `${n} results`); else add('Pexels photos', 'FAIL', `HTTP ${res.statusCode}`);
    });
  }

  if (!env.PIXABAY_API_KEY) { add('Pixabay videos and images', 'SKIP', 'set PIXABAY_API_KEY'); } else {
    process.env.PIXABAY_API_KEY = env.PIXABAY_API_KEY;
    await guard('Pixabay videos', async () => {
      const res = await get(h.pixabay, 'pixabay', 'videos/search', { query: 'restaurant', per_page: '3' });
      const n = parse(res)?.hits?.length || 0;
      if (res.statusCode === 200 && n > 0) add('Pixabay videos', 'PASS', `${n} results`); else add('Pixabay videos', 'FAIL', `HTTP ${res.statusCode}`);
    });
    await guard('Pixabay images', async () => {
      const res = await get(h.pixabay, 'pixabay', 'images/search', { query: 'restaurant', per_page: '3' });
      const n = parse(res)?.hits?.length || 0;
      if (res.statusCode === 200 && n > 0) add('Pixabay images', 'PASS', `${n} results`); else add('Pixabay images', 'FAIL', `HTTP ${res.statusCode}`);
    });
  }

  if (!env.OPENAI_API_KEY) { add('OpenAI voiceover', 'SKIP', 'set OPENAI_API_KEY'); } else {
    await guard('OpenAI voiceover', async () => {
      const res = await h.audio({ action: 'submit', kind: 'tts', provider: 'openai', text: 'Welcome to our restaurant. Come in tonight and book your table.', voice: 'marin', speed: 1, instructions: 'Warm and welcoming' }, 'verify-script', { keys: { openai: env.OPENAI_API_KEY } });
      const body = parse(res);
      if (res.statusCode !== 200 || !body?.url) { add('OpenAI voiceover', 'FAIL', `HTTP ${res.statusCode} ${body?.error?.code || ''}`.trim()); return; }
      const buf = dataUrlToBuffer(body.url);
      if (!looksLikeMp3(buf)) { add('OpenAI voiceover', 'FAIL', 'the reply is not an mp3'); return; }
      let where = '';
      if (outDir) { await mkdir(outDir, { recursive: true }); where = join(outDir, 'voiceover-check.mp3'); await writeFile(where, buf); }
      add('OpenAI voiceover', 'PASS', `${Math.round(buf.length / 1024)} KB mp3${where ? `, saved to ${where}` : ''}`);
    });
  }
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outArg = process.argv.find((a) => a.startsWith('--out='));
  const results = await runChecks({ outDir: outArg ? outArg.slice(6) : './verify-out' });
  const { text, failed, ran } = summarize(results);
  console.log(`\nTemplate Generator key checks\n${text}\n`);
  if (!ran) console.log('Nothing ran: set at least one of PEXELS_API_KEY, PIXABAY_API_KEY, OPENAI_API_KEY.');
  process.exit(failed ? 1 : 0);
}
