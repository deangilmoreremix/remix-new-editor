#!/usr/bin/env node

import { spawn, execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const SYNC_MARKER_FILE = join(REPO_ROOT, '.last-upstream-sync');
const TEMP_DIR = '/tmp/sync-upstream';
const UPSTREAM_REMOTE = 'upstream-muapi';
const UPSTREAM_URL = 'https://github.com/Anil-matcha/Open-Generative-AI.git';
const UPSTREAM_BRANCH = 'main';
const MIN_NODE_MAJOR = 18;

let options = {
  dryRun: false,
  force: false,
  skipTests: false,
  createPr: false,
  verbose: false,
  quiet: false,
  branch: null,
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const prefix = { info: '[INFO]', warn: '[WARN]', error: '[ERROR]', debug: '[DEBUG]', success: '[OK]' };
  if (options.quiet && (level === 'info' || level === 'debug')) return;
  if (level === 'debug' && !options.verbose) return;
  const line = `${prefix[level] || '[????]'} ${message}`;
  if (level === 'error') console.error(line);
  else console.log(line);
}

function execCommand(command, { capture = false, ignoreFailure = false, env } = {}) {
  if (options.dryRun && !capture) {
    log('info', `[dry-run] Would execute: ${command}`);
    return '';
  }
  try {
    const result = execSync(command, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: capture ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
    return result?.trim() || '';
  } catch (err) {
    if (ignoreFailure) return '';
    const stderr = err.stderr?.toString() || err.message;
    throw new Error(`Command failed: ${command}\n${stderr}`);
  }
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function parseArgs(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--dry-run': options.dryRun = true; break;
      case '--force': options.force = true; break;
      case '--skip-tests': options.skipTests = true; break;
      case '--create-pr': options.createPr = true; break;
      case '--verbose': options.verbose = true; break;
      case '--quiet': options.quiet = true; break;
      case '--branch':
        options.branch = argv[++i];
        if (!options.branch) throw new Error('--branch requires a value');
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
}

function cleanup() {
  try {
    if (existsSync(TEMP_DIR)) {
      execSync(`rm -rf ${TEMP_DIR}`);
    }
  } catch {
    // best effort cleanup
  }
}

function validateNodeVersion() {
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < MIN_NODE_MAJOR) {
    throw new Error(`Node.js ${MIN_NODE_MAJOR}+ required, found ${process.versions.node}`);
  }
  log('debug', `Node.js version: ${process.versions.node} (OK)`);
}

function validateGitClean() {
  const status = execCommand('git status --porcelain', { capture: true });
  if (status.length > 0) {
    throw new Error('Working tree is not clean. Commit or stash changes before syncing.');
  }
  log('debug', 'Working tree is clean');
}

function validateUpstreamRemote() {
  const remotes = execCommand('git remote', { capture: true });
  if (!remotes.split('\n').includes(UPSTREAM_REMOTE)) {
    throw new Error(`Remote '${UPSTREAM_REMOTE}' not found. Add it with: git remote add ${UPSTREAM_REMOTE} ${UPSTREAM_URL}`);
  }
  log('debug', `Remote '${UPSTREAM_REMOTE}' exists`);
}

async function preflightChecks() {
  log('info', 'Running pre-flight checks...');
  validateNodeVersion();
  validateGitClean();
  validateUpstreamRemote();
  log('success', 'Pre-flight checks passed');
}

async function fetchUpstream() {
  log('info', `Fetching ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}...`);
  execCommand(`git fetch ${UPSTREAM_REMOTE} ${UPSTREAM_BRANCH}`);
  log('success', 'Fetch complete');
}

function getLastSyncHash() {
  if (!existsSync(SYNC_MARKER_FILE)) return null;
  return readFileSync(SYNC_MARKER_FILE, 'utf-8').trim();
}

function getCurrentUpstreamHash() {
  return execCommand(`git rev-parse ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}`, { capture: true });
}

async function checkForUpdates() {
  const lastHash = getLastSyncHash();
  const currentHash = getCurrentUpstreamHash();
  log('debug', `Last sync hash: ${lastHash || 'none'}`);
  log('debug', `Current upstream hash: ${currentHash}`);
  if (!options.force && lastHash === currentHash) {
    log('info', 'No upstream changes detected. Use --force to sync anyway.');
    return false;
  }
  return { lastHash, currentHash };
}

function runCatalogSync() {
  log('info', 'Running catalog sync...');
  const scriptPath = join(REPO_ROOT, 'scripts', 'muapi-catalog-sync.mjs');
  if (!existsSync(scriptPath)) {
    throw new Error(`Catalog sync script not found: ${scriptPath}`);
  }
  execCommand(`node ${scriptPath} --source upstream --verbose`);
  log('success', 'Catalog sync complete');
}

function runHealthCheck() {
  log('info', 'Running health check...');
  const scriptPath = join(REPO_ROOT, 'scripts', 'muapi-health-mjs');
  if (!existsSync(scriptPath)) {
    throw new Error(`Health check script not found: ${scriptPath}`);
  }
  const reportPath = join(TEMP_DIR, 'sync-report.json');
  mkdirSync(TEMP_DIR, { recursive: true });
  execCommand(`node ${scriptPath} --full-report --output ${reportPath}`);
  log('success', 'Health check complete');
  return reportPath;
}

function verifyOutputs() {
  log('info', 'Verifying outputs...');
  const studioDir = join(REPO_ROOT, 'packages', 'studio', 'src');
  if (!existsSync(studioDir)) {
    throw new Error(`Studio directory not found: ${studioDir}`);
  }
  const entries = readdirSync(studioDir);
  if (entries.length === 0) {
    throw new Error('Studio directory is empty — sync produced no output');
  }
  let modelCount = 0;
  for (const entry of entries) {
    const fullPath = join(studioDir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      const subEntries = readdirSync(fullPath);
      modelCount += subEntries.filter((f) => f.endsWith('.json') || f.endsWith('.ts')).length;
    } else if (entry.endsWith('.json') || entry.endsWith('.ts')) {
      modelCount++;
    }
  }
  log('debug', `Found ${modelCount} model files/packages in studio`);
  log('success', `Outputs verified: ${entries.length} entries in packages/studio/src/`);
  return { entryCount: entries.length, modelCount };
}

function runTests() {
  if (options.skipTests) {
    log('warn', 'Skipping tests (--skip-tests)');
    return true;
  }
  log('info', 'Running tests...');
  try {
    execCommand('npm test');
    log('success', 'All tests passed');
    return true;
  } catch (err) {
    log('error', 'Tests failed');
    return false;
  }
}

function getSyncStats() {
  const diff = execCommand(`git diff ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH} --stat`, { capture: true, ignoreFailure: true });
  let newModels = 0;
  let changedModels = 0;
  if (diff) {
    for (const line of diff.split('\n')) {
      if (line.includes('create mode') || line.includes('new file')) newModels++;
      else if (line.includes('update mode') || line.includes('modified')) changedModels++;
    }
  }
  return { newModels, changedModels };
}

async function createCommit(currentHash, syncStats) {
  log('info', 'Creating commit...');
  execCommand('git add -A');
  const timestamp = new Date().toISOString();
  const shortHash = currentHash.substring(0, 8);
  const subject = `sync: upstream models from ${UPSTREAM_REMOTE}@${shortHash}`;
  const body = [
    `Automated upstream sync`,
    ``,
    `- Upstream: ${UPSTREAM_REMOTE} (${currentHash})`,
    `- New models: ${syncStats.newModels}`,
    `- Changed models: ${syncStats.changedModels}`,
    `- Timestamp: ${timestamp}`,
  ].join('\n');
  const commitMsg = `${subject}\n\n${body}`;
  if (options.dryRun) {
    log('info', `[dry-run] Would commit with message:\n${commitMsg}`);
    return;
  }
  const msgFile = join(TEMP_DIR, 'commit-msg.txt');
  writeFileSync(msgFile, commitMsg);
  execCommand(`git commit --file=${msgFile}`);
  log('success', `Commit created: ${subject}`);
}

function updateSyncMarker(hash) {
  log('info', `Updating sync marker to ${hash.substring(0, 8)}...`);
  if (options.dryRun) {
    log('info', `[dry-run] Would write sync marker: ${hash}`);
    return;
  }
  writeFileSync(SYNC_MARKER_FILE, hash);
  execCommand('git add .last-upstream-sync');
  execCommand('git commit --amend --no-edit');
  log('success', 'Sync marker updated');
}

async function createPr(branchName) {
  if (!options.createPr) return;
  log('info', 'Creating pull request...');
  const timestamp = new Date().toISOString();
  const title = `auto: upstream sync ${timestamp.split('T')[0]}`;
  const body = [
    `## Automated Upstream Sync`,
    ``,
    `- Branch: ${branchName}`,
    `- Generated: ${timestamp}`,
    `- Trigger: sync-upstream.mjs`,
    ``,
    'Review the model catalog changes and verify health check results.',
  ].join('\n');
  if (options.dryRun) {
    log('info', `[dry-run] Would create PR: ${title}`);
    return;
  }
  const bodyFile = join(TEMP_DIR, 'pr-body.txt');
  writeFileSync(bodyFile, body);
  try {
    execCommand(`gh pr create --title "${title}" --body-file ${bodyFile} --head ${branchName}`);
    log('success', 'Pull request created');
  } catch (err) {
    log('warn', `Could not create PR automatically: ${err.message}`);
    log('info', `Create it manually with: gh pr create --head ${branchName}`);
  }
}

async function handleFailedTests(branchName, currentHash) {
  log('info', 'Tests failed — creating review branch...');
  const reviewBranch = `sync-review/upstream-muapi-${Date.now()}`;
  if (!options.dryRun) {
    execCommand(`git checkout -b ${reviewBranch}`);
    execCommand('git add -A');
    execSync('git commit --allow-empty -m "sync: upstream changes requiring manual review"', { cwd: REPO_ROOT });
    log('success', `Review branch created: ${reviewBranch}`);
    log('info', 'Manual review required — check the branch and fix test failures before merging.');
  } else {
    log('info', `[dry-run] Would create review branch: ${reviewBranch}`);
  }
}

async function main() {
  const startTime = Date.now();
  try {
    parseArgs(process.argv.slice(2));
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(130); });

    if (options.dryRun) log('info', '=== DRY RUN MODE — no changes will be made ===');
    if (options.force) log('warn', 'Force sync enabled — ignoring sync marker');

    await preflightChecks();
    await fetchUpstream();

    const updateInfo = await checkForUpdates();
    if (!updateInfo) return;

    const { currentHash } = updateInfo;

    const branchName = options.branch || `auto-sync/upstream-muapi-${Date.now()}`;
    log('info', `Target branch: ${branchName}`);

    if (!options.dryRun) {
      execCommand(`git checkout -b ${branchName}`);
    }

    runCatalogSync();
    const reportPath = runHealthCheck();
    const outputs = verifyOutputs();
    const testsPassed = runTests();
    const syncStats = getSyncStats();

    if (!testsPassed) {
      await handleFailedTests(branchName, currentHash);
      return;
    }

    await createCommit(currentHash, syncStats);
    updateSyncMarker(currentHash);
    await createPr(branchName);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log('success', `Sync completed successfully in ${duration}s`);
    log('info', `  New models: ${syncStats.newModels}`);
    log('info', `  Changed models: ${syncStats.changedModels}`);
    log('info', `  Output files: ${outputs.entryCount}`);
    log('info', `  Health report: ${reportPath}`);
    log('info', `  Branch: ${branchName}`);
  } catch (err) {
    log('error', err.message);
    if (options.verbose && err.stack) {
      console.error(err.stack);
    }
    process.exitCode = 1;
  }
}

main();
