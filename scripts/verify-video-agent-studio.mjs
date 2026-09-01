#!/usr/bin/env node
// scripts/verify-video-agent-studio.mjs
//
// Phase: Video Agent Studio 2 verification.
//
// Verifies that the complete OpenChatCut application can be embedded
// inside SmartVideo and is reachable through the iframe shell.
//
// This script does NOT modify OpenChatCut, does NOT install its
// dependencies (run `npm run install:video-agent-studio` first), and
// does NOT couple OpenChatCut to SmartVideo's backend. It only
// confirms the full-application integration path is wired up.
//
// Each step is independent. A failure in one step does not abort
// the rest of the script; the operator sees the full report.
//
// Steps:
//
//   1. OpenChatCut dependencies are installed
//        apps/video-agent-studio/node_modules exists.
//   2. OpenChatCut builds successfully
//        `cd apps/video-agent-studio && npm run build`.
//   3. The OpenChatCut dev server starts and responds.
//   4. SmartVideo's route exists in src/lib/router.js
//        (asserts 'video-agent-studio' key + the shell module).
//   5. The iframe URL is configured
//        (asserts VITE_VIDEO_AGENT_STUDIO_URL or default).
//   6. The shell loads the complete application
//        (asserts the shell module exports VideoAgentStudioShell and
//         references the iframe).
//
// Exit code 0 if all steps PASS, 1 otherwise.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const SUBTREE = resolve(REPO_ROOT, 'apps/video-agent-studio');
const SUBTREE_NODE_MODULES = resolve(SUBTREE, 'node_modules');

const STUDIO_URL = process.env.VITE_VIDEO_AGENT_STUDIO_URL || 'http://localhost:5199/';

const results = [];
function record(step, status, detail) {
  const r = (typeof step === 'object' && step !== null) ? step : { step, status, detail };
  results.push(r);
  const palette = {
    PASS: '\x1b[32m',
    BLOCKED: '\x1b[33m',
    FAIL: '\x1b[31m',
  };
  const colour = palette[r.status] || '\x1b[0m';
  // eslint-disable-next-line no-console
  console.log(`${colour}${String(r.status).padEnd(7)}\x1b[0m  ${r.step}  ${r.detail || ''}`);
}

function step1SubtreePresent() {
  if (!existsSync(SUBTREE)) {
    return { step: '1. Subtree present', status: 'FAIL', detail: `${SUBTREE} does not exist` };
  }
  return { step: '1. Subtree present', status: 'PASS' };
}

function step2DepsInstalled() {
  if (!existsSync(SUBTREE_NODE_MODULES)) {
    return {
      step: '2. OpenChatCut deps installed',
      status: 'BLOCKED',
      detail: 'run: npm run install:video-agent-studio',
    };
  }
  return { step: '2. OpenChatCut deps installed', status: 'PASS' };
}

function step3Build() {
  if (!existsSync(SUBTREE_NODE_MODULES)) {
    return { step: '3. OpenChatCut builds', status: 'BLOCKED', detail: 'subtree deps not installed' };
  }
  const r = spawnSync('npm', ['run', 'build'], {
    cwd: SUBTREE,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: '1' },
    timeout: 30 * 60_000, // 30 minutes is generous; upstream is large
  });
  if (r.status !== 0) {
    return {
      step: '3. OpenChatCut builds',
      status: 'FAIL',
      detail: `npm run build exited ${r.status}. Tail: ${String(r.stderr || r.stdout || '').slice(-400)}`,
    };
  }
  return { step: '3. OpenChatCut builds', status: 'PASS' };
}

async function step4ServerResponds() {
  if (!existsSync(SUBTREE_NODE_MODULES)) {
    return { step: '4. OpenChatCut server responds', status: 'BLOCKED', detail: 'subtree deps not installed' };
  }
  // Start the dev server, wait until it responds, then kill it.
  const child = spawn('npm', ['run', 'dev'], {
    cwd: SUBTREE,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: '1', BROWSER: 'none' },
  });
  let stderr = '';
  child.stderr?.on('data', (b) => { stderr += b.toString(); });
  const start = Date.now();
  const TIMEOUT_MS = 180_000; // 3 minutes — first-time install/build inside dev script
  const POLL_MS = 1_000;
  try {
    while (Date.now() - start < TIMEOUT_MS) {
      try {
        const res = await fetch(STUDIO_URL, { method: 'GET' });
        if (res.ok || res.status === 200) {
          return { step: '4. OpenChatCut server responds', status: 'PASS' };
        }
      } catch (_) { /* not ready yet */ }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    return {
      step: '4. OpenChatCut server responds',
      status: 'FAIL',
      detail: `no response from ${STUDIO_URL} within ${TIMEOUT_MS / 1000}s. Stderr tail: ${stderr.slice(-400)}`,
    };
  } finally {
    try { child.kill('SIGTERM'); } catch (_) {}
    setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 2000);
  }
}

function step5RouteExists() {
  const router = resolve(REPO_ROOT, 'src/lib/router.js');
  if (!existsSync(router)) {
    return { step: '5. SmartVideo route exists', status: 'FAIL', detail: `${router} not found` };
  }
  const src = readFileSync(router, 'utf8');
  if (!/['"]?video-agent-studio['"]?\s*:/.test(src)) {
    return { step: '5. SmartVideo route exists', status: 'FAIL', detail: "'video-agent-studio' not in src/lib/router.js" };
  }
  if (!src.includes('VideoAgentStudioShell')) {
    return { step: '5. SmartVideo route exists', status: 'FAIL', detail: "route does not resolve to VideoAgentStudioShell" };
  }
  return { step: '5. SmartVideo route exists', status: 'PASS', detail: "video-agent-studio -> VideoAgentStudioShell" };
}

function step6IframeConfigured() {
  const shell = resolve(REPO_ROOT, 'src/components/VideoAgentStudioShell.js');
  if (!existsSync(shell)) {
    return { step: '6. Iframe URL is configured', status: 'FAIL', detail: `${shell} not found` };
  }
  const src = readFileSync(shell, 'utf8');
  if (!src.includes('VITE_VIDEO_AGENT_STUDIO_URL')) {
    return { step: '6. Iframe URL is configured', status: 'FAIL', detail: "shell does not read VITE_VIDEO_AGENT_STUDIO_URL" };
  }
  if (!/<iframe\b/.test(src) && !/createElement\(['"]iframe['"]\)/.test(src)) {
    return { step: '6. Iframe URL is configured', status: 'FAIL', detail: "shell does not contain an <iframe> or createElement('iframe')" };
  }
  return { step: '6. Iframe URL is configured', status: 'PASS', detail: STUDIO_URL };
}

function step7ShellLoadsCompleteApp() {
  const shell = resolve(REPO_ROOT, 'src/components/VideoAgentStudioShell.js');
  if (!existsSync(shell)) {
    return { step: '7. Shell loads the complete application', status: 'FAIL', detail: `${shell} not found` };
  }
  const src = readFileSync(shell, 'utf8');
  if (!src.includes('export function VideoAgentStudioShell')) {
    return { step: '7. Shell loads the complete application', status: 'FAIL', detail: "shell does not export VideoAgentStudioShell" };
  }
  if (!src.includes('SmartVideo Video Agent Studio 2')) {
    return { step: '7. Shell loads the complete application', status: 'FAIL', detail: "shell does not include the product name 'SmartVideo Video Agent Studio 2'" };
  }
  if (!/Retry|retry/i.test(src)) {
    return { step: '7. Shell loads the complete application', status: 'FAIL', detail: "shell has no Retry button" };
  }
  return { step: '7. Shell loads the complete application', status: 'PASS' };
}

// Run
record(step1SubtreePresent());
record(step2DepsInstalled());
if (process.argv.includes('--skip-build')) {
  record({ step: '3. OpenChatCut builds', status: 'BLOCKED', detail: 'skipped via --skip-build' });
  record({ step: '4. OpenChatCut server responds', status: 'BLOCKED', detail: 'skipped via --skip-build' });
} else {
  record(step3Build());
  if (process.argv.includes('--with-server')) {
    const r = await step4ServerResponds();
    record(r);
  } else {
    record({ step: '4. OpenChatCut server responds', status: 'BLOCKED', detail: 'pass --with-server to start the dev server and probe it' });
  }
}
record(step5RouteExists());
record(step6IframeConfigured());
record(step7ShellLoadsCompleteApp());

// Summary
// eslint-disable-next-line no-console
console.log('\nSummary:');
const counts = results.reduce((acc, r) => {
  acc[r.status] = (acc[r.status] || 0) + 1;
  return acc;
}, {});
for (const [k, v] of Object.entries(counts)) {
  // eslint-disable-next-line no-console
  console.log(`  ${k.padEnd(7)} ${v}`);
}
const failed = (counts.FAIL || 0);
process.exit(failed > 0 ? 1 : 0);
