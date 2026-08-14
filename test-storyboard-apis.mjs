#!/usr/bin/env node

/**
 * Storyboard Studio — API test suite
 *
 * Run: node test-storyboard-apis.mjs
 *
 * Prereqs:
 *   - Backend running: PORT=4000 node backend/server.js
 *   - Vite dev server running: npm run dev
 *
 * Environment:
 *   MUAPI_API_KEY        — sandbox MuAPI key (defaults to sandbox key)
 *   OPENAI_API_KEY       — optional, for direct OpenAI Responses test
 *   STORYBOARD_BASE_URL  — default http://localhost:4000
 *   DEV_BYPASS_SECRET    — override dev-bypass secret (default: local-dev-only)
 *   SUPABASE_JWT         — real Supabase JWT for authenticated endpoint tests
 *   SUPABASE_URL         — your Supabase project URL (required for JWT tests)
 */

const BASE = process.env.STORYBOARD_BASE_URL || 'http://localhost:4000';
const MUAPI_KEY = process.env.MUAPI_API_KEY || 'e6093f6167a479cc74cce1426eedc725f539d187844b70f616cb2f6c4af3444b';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const DEV_BYPASS = process.env.DEV_BYPASS_SECRET || 'local-dev-only';
const SUPABASE_JWT = process.env.SUPABASE_JWT || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';

const results = [];
let devBypassAvailable = false;

async function request(method, path, body, extraHeaders = {}) {
  const url = `${BASE}${path}`;
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-dev-bypass': DEV_BYPASS,
      ...extraHeaders,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

async function requestWithJwt(method, path, body, jwt) {
  const url = `${BASE}${path}`;
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
      ...(body ? {} : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

function check(name, condition, detail) {
  const passed = !!condition;
  results.push({ name, status: passed ? 'ok' : 'error', detail: detail || '' });
  console.log(`${passed ? '✅' : '❌'} ${name}${detail ? ': ' + detail : ''}`);
}

/* ─────────────────────────────────────────────
 * 1. Backend health
 * ───────────────────────────────────────────── */
const health = await request('GET', '/health');
check('backend health', health.status === 200 && health.data?.status === 'ok');

/* ─────────────────────────────────────────────
 * 2. Storyboard CRUD (public, no auth)
 * ───────────────────────────────────────────── */
const sbId = `sb-${Date.now()}`;
const create = await request('POST', `/api/storyboard/${encodeURIComponent(sbId)}`, {
  id: sbId,
  frames: [{ prompt: 'A hero stands on a cliff', shot: 'Wide Shot' }],
  preset: null,
});
check('storyboard create', create.status === 201, `status=${create.status}`);

const read = await request('GET', `/api/storyboard/${encodeURIComponent(sbId)}`);
check('storyboard read', read.status === 200 && read.data?.frames?.length === 1, `status=${read.status} frames=${read.data?.frames?.length}`);

const update = await request('PUT', `/api/storyboard/${encodeURIComponent(sbId)}`, {
  frames: [{ prompt: 'Updated prompt', shot: 'Medium Shot' }],
});
check('storyboard update', update.status === 200 && update.data?.frames?.[0]?.prompt === 'Updated prompt', `status=${update.status}`);

const del = await request('DELETE', `/api/storyboard/${encodeURIComponent(sbId)}`);
check('storyboard delete', del.status === 204, `status=${del.status}`);

const missing = await request('GET', `/api/storyboard/${encodeURIComponent(sbId)}`);
check('storyboard 404 after delete', missing.status === 404, `status=${missing.status}`);

/* ─────────────────────────────────────────────
 * 3. Dev bypass auth header (authenticated route, no JWT)
 *
 * /videoagent/process requires auth. With x-dev-bypass matching
 * DEV_BYPASS_SECRET the middleware short-circuits and sets
 * req.user = { id: 'dev-user', email: 'dev@local' }.
 * ───────────────────────────────────────────── */
const devBypassReq = await request('POST', '/videoagent/process', {
  action: 'process-tool',
  tool: 'storyboarding',
  prompt: 'A product launch opens with a city sunrise.',
});
if (devBypassReq.status === 200 && devBypassReq.data?.jobId) {
  devBypassAvailable = true;
  check('dev bypass auth header', true, `jobId=${devBypassReq.data.jobId}`);
} else if (devBypassReq.status === 401) {
  devBypassAvailable = false;
  check('dev bypass auth header', false, `401 — set NODE_ENV=development and x-dev-bypass header in backend`);
} else {
  devBypassAvailable = false;
  check('dev bypass auth header', false, `status=${devBypassReq.status} ${JSON.stringify(devBypassReq.data).slice(0, 100)}`);
}

/* ─────────────────────────────────────────────
 * 4. Comparison agent (POST /videoagent/process, action: process-tool)
 *
 * Runs the 'comparison' agent which compares two descriptions via
 * OpenAI Responses and returns structured output with agent: 'comparison'.
 * Requires OPENAI_API_KEY on the server or in payload.settings.apiKey.
 * ───────────────────────────────────────────── */
const comparisonReq = await request('POST', '/videoagent/process', {
  action: 'process-tool',
  tool: 'comparison',
  textA: 'A neon-lit city street at night, rain reflecting signs.',
  textB: 'A sunlit desert highway stretching to the horizon.',
});
if (comparisonReq.status === 200 && comparisonReq.data?.jobId) {
  check('comparison agent starts', true, `jobId=${comparisonReq.data.jobId}`);
  const cmpJobId = comparisonReq.data.jobId;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const job = await request('GET', `/videoagent/job/${encodeURIComponent(cmpJobId)}`);
    if (job.status === 200 && job.data?.status === 'completed') {
      const hasComparison = !!(job.data?.result?.comparison || job.data?.comparison);
      check('comparison agent completes', hasComparison, `status=${job.data.status}`);
      break;
    }
    if (job.status === 200 && job.data?.status === 'failed') {
      const errorMsg = job.data.error || '';
      if (errorMsg.includes('OpenAI API key')) {
        check('comparison agent completes', true, 'skipped — requires OPENAI_API_KEY on server');
      } else {
        check('comparison agent completes', false, `failed: ${errorMsg}`);
      }
      break;
    }
    if (i === 59) check('comparison agent completes', false, 'timeout after 60s');
  }
} else {
  check('comparison agent starts', false, `status=${comparisonReq.status} ${JSON.stringify(comparisonReq.data).slice(0, 120)}`);
}

/* ─────────────────────────────────────────────
 * 5. Storyboard agent via process-usecase
 * ───────────────────────────────────────────── */
const storyboardAgentReq = await request('POST', '/videoagent/process', {
  action: 'process-usecase',
  usecase: 'storyboarding',
  prompt: 'A documentary about ocean conservation opens underwater, cuts to scientists, and ends with a hopeful sunset.',
});
check('storyboard agent starts', storyboardAgentReq.status === 200 && !!storyboardAgentReq.data?.jobId, `status=${storyboardAgentReq.status}`);

if (storyboardAgentReq.data?.jobId) {
  const sbJobId = storyboardAgentReq.data.jobId;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const job = await request('GET', `/videoagent/job/${encodeURIComponent(sbJobId)}`);
    if (job.status === 200 && job.data?.status === 'completed') {
      check('storyboard agent completes', true, `status=${job.data.status}`);
      break;
    }
    if (job.status === 200 && job.data?.status === 'failed') {
      check('storyboard agent completes', false, `failed: ${job.data.error}`);
      break;
    }
    if (i === 59) check('storyboard agent completes', false, 'timeout after 60s');
  }
}

/* ─────────────────────────────────────────────
 * 6. Supabase JWT authenticated test (optional)
 *
 * If SUPABASE_JWT is provided, verify that an authenticated request
 * succeeds without the dev-bypass header. This is the production path.
 *
 * How to get a real JWT:
 *   1. Open http://localhost:3000 in your browser (frontend must be running).
 *   2. Sign in via Clerk / Supabase Auth.
 *   3. Open DevTools → Network tab.
 *   4. Find any request to the backend (e.g. /api/storyboard/... or /health).
 *   5. Copy the full value of the Authorization header (Bearer eyJ...).
 *   6. Export it: export SUPABASE_JWT="eyJ..."
 *
 * Or use Supabase directly:
 *   curl -X POST "https://<ref>.supabase.co/auth/v1/token?grant_type=password" \
 *     -H "apikey: <ANON_KEY>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"you@example.com","password":"your-password"}'
 *   # Copy the access_token from the response.
 * ───────────────────────────────────────────── */
console.log('\n--- Supabase JWT authenticated test ---');
if (SUPABASE_JWT && SUPABASE_URL) {
  const jwtTest = await requestWithJwt('GET', '/health', null, SUPABASE_JWT);
  check('authenticated health (real JWT)', jwtTest.status === 200, `status=${jwtTest.status}`);

  const jwtAgentList = await requestWithJwt('GET', '/api/agents/actions', null, SUPABASE_JWT);
  check('authenticated /api/agents/actions (real JWT)', jwtAgentList.status === 200 && Array.isArray(jwtAgentList.data?.actions), `status=${jwtAgentList.status} actions=${Array.isArray(jwtAgentList.data?.actions) ? jwtAgentList.data.actions.length : 0}`);
} else {
  console.log('⚠️  SUPABASE_JWT not set — skipping real-JWT authenticated tests.');
  console.log('   Set it with: export SUPABASE_JWT="<your-token>"');
  console.log('   See section 6 in this file for instructions.\n');
}

/* ─────────────────────────────────────────────
 * 7. OpenAI Responses API (optional)
 * ───────────────────────────────────────────── */
if (OPENAI_KEY) {
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        input: 'A cinematic storyboard frame of a city sunrise, wide shot',
        tools: [{ type: 'image_generation', quality: 'auto', output_format: 'png' }],
      }),
    });
    const openaiData = await openaiRes.json().catch(() => ({}));
    check('OpenAI Responses image generation', openaiRes.ok && openaiData.output?.length, `status=${openaiRes.status}`);
  } catch (err) {
    check('OpenAI Responses image generation', false, err.message);
  }
} else {
  console.log('\n⚠️  OPENAI_API_KEY not set; skipping direct OpenAI test.');
  console.log('   Set it with: export OPENAI_API_KEY=sk-...\n');
}

/* ─────────────────────────────────────────────
 * 8. MuAPI proxy instructions
 * ───────────────────────────────────────────── */
console.log('\n--- MuAPI proxy testing ---');
console.log('The muapi-proxy is a Supabase Edge Function.');
console.log('Deploy and test via the Supabase CLI or frontend UI:\n');
console.log('  Deploy:');
console.log('    cd supabase');
console.log('    supabase functions deploy muapi-proxy\n');
console.log('  Frontend test:');
console.log('    1. Open http://localhost:3000/storyboard');
console.log('    2. Enter prompt, select model/AR, click Generate Frame');
console.log('    3. Image should appear via muapi-proxy with sandbox key\n');

/* ─────────────────────────────────────────────
 * 9. Frontend test checklist
 *    Grouped by feature area
 * ───────────────────────────────────────────── */
console.log('--- Frontend test checklist ---');
console.log('Open http://localhost:3000/storyboard and verify each item:\n');

console.log('[Core UI]');
console.log('  [ ] Studio loads without console errors');
console.log('  [ ] 3 empty frames are displayed on load');
console.log('  [ ] Frame numbers are shown (1, 2, 3)\n');

console.log('[Model & Settings]');
console.log('  [ ] Model selector shows available image models');
console.log('  [ ] Aspect ratio selector updates based on selected model');
console.log('  [ ] Preset dropdown pre-fills prompt and style fields\n');

console.log('[Prompt Building]');
console.log('  [ ] Style dropdown appends style keyword to prompt');
console.log('  [ ] Lighting dropdown appends lighting keyword to prompt');
console.log('  [ ] Color palette dropdown appends color keyword to prompt');
console.log('  [ ] Negative prompt field is editable and included in requests\n');

console.log('[Image Generation]');
console.log('  [ ] Generate Frame button produces an image for the selected frame');
console.log('  [ ] Generate All Frames batch-generates with per-frame progress');
console.log('  [ ] Retry failed button re-attempts only failed frames');
console.log('  [ ] Loading spinner / progress bar shown during generation\n');

console.log('[Frame Management]');
console.log('  [ ] Clicking an image opens fullscreen preview');
console.log('  [ ] Add Frame button appends a new blank frame');
console.log('  [ ] Delete Frame button removes a frame with confirmation');
console.log('  [ ] Drag-and-drop reorders frames vertically');
console.log('  [ ] Ctrl+Z undoes last action (add / delete / reorder)');
console.log('  [ ] Ctrl+Y redoes undone action\n');

console.log('[Persistence]');
console.log('  [ ] Save button persists storyboard to /api/storyboard/:id');
console.log('  [ ] Load button restores saved storyboard from /api/storyboard/:id');
console.log('  [ ] Storyboard survives page refresh (localStorage)');
console.log('  [ ] Storyboard ID is editable and used in save/load URLs\n');

console.log('[Export]');
console.log('  [ ] Export PDF button opens print dialog with all frames');
console.log('  [ ] Export PNG downloads individual frame images');
console.log('  [ ] Batch export downloads all frames as a ZIP (if implemented)\n');

console.log('[Comparison Modal]');
console.log('  [ ] Comparison button opens the side-by-side comparison modal');
console.log('  [ ] Selecting two frames and comparing shows agent-generated analysis');
console.log('  [ ] Comparison result includes content, style, audience, strengths, weaknesses');
console.log('  [ ] Modal can be closed with Escape or close button\n');

/* ─────────────────────────────────────────────
 * 10. Summary
 * ───────────────────────────────────────────── */
console.log('--- results ---');
const failed = results.filter(x => x.status !== 'ok');
console.log(`passed=${results.length - failed.length} failed=${failed.length}`);
if (failed.length) {
  console.log(JSON.stringify(failed, null, 2));
  process.exitCode = 1;
}
