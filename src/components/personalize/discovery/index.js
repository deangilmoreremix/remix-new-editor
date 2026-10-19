// src/components/personalize/discovery/index.js
//
// Public API for the website asset discovery module.
//
// Surface:
//   - discoverAssets(url, options?) → starts a background job, returns
//     { jobId, status: 'pending' } synchronously.
//   - getJobStatus(jobId) → returns the latest { status, found, errors }.
//   - cancelJob(jobId) → marks a pending job as cancelled.
//
// The job store is in-memory only (per spec). Concurrent jobs are capped
// at 3 — new submissions above that limit receive an immediate error.
// Finished jobs are RETAINED for 60s so clients can poll their results;
// they do not occupy a concurrency slot (only `pending` / `running`
// jobs count against the limit), so three sequential jobs never block
// a fourth submission.
//
// Jobs run async via setImmediate to keep the call synchronous to the
// caller (the caller only sees the jobId and polls later). The actual
// worker is `worker.runDiscoveryWorker` which handles the full pipeline.

import { randomUUID } from 'node:crypto';
import { runDiscoveryWorker } from './worker.js';
import {
  validateUrl,
  checkSocialDomainBlock,
} from './urlSafety.js';

const MAX_CONCURRENT_JOBS = 3;
const DEFAULT_URL_TIMEOUT_MS = 60_000;

/** @type {Map<string, { status: string, found: any, errors: string[], url: string, startedAt: number, finishedAt: number|null, options: object }>} */
const jobStore = new Map();

/**
 * Count the jobs that currently occupy a concurrency slot. Completed /
 * failed / cancelled jobs stay in the store for the 60s poll window and
 * must NOT count against the limit — counting them wrongly rejected
 * every submission once three jobs had finished.
 *
 * @returns {number}
 */
function countActiveJobs() {
  let active = 0;
  for (const job of jobStore.values()) {
    if (job.status === 'pending' || job.status === 'running') {
      active += 1;
    }
  }
  return active;
}

/**
 * Submit a discovery job. Returns synchronously with a job ID; the
 * actual work runs in the background.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {boolean} [options.allowHeadless=true]
 * @returns {{ jobId: string, status: 'pending' } | { error: 'JOB_LIMIT_REACHED' | 'INVALID_URL' | 'UNSUPPORTED_DOMAIN', message: string }}
 */
export function discoverAssets(url, options = {}) {
  // Quick synchronous validation before allocating a job slot.
  if (typeof url !== 'string' || url.trim().length === 0) {
    return { error: 'INVALID_URL', message: 'URL is empty' };
  }
  const social = checkSocialDomainBlock(url);
  if (social.blocked) {
    return {
      error: 'UNSUPPORTED_DOMAIN',
      message: `Domain "${social.domain}" is not supported`,
    };
  }
  if (countActiveJobs() >= MAX_CONCURRENT_JOBS) {
    return { error: 'JOB_LIMIT_REACHED', message: `Concurrent job limit (${MAX_CONCURRENT_JOBS}) reached` };
  }
  const jobId = randomUUID();
  jobStore.set(jobId, {
    status: 'pending',
    found: null,
    errors: [],
    url,
    startedAt: Date.now(),
    finishedAt: null,
    options,
  });
  // Kick off async work — do NOT await.
  setImmediate(() => {
    executeJob(jobId, url, options);
  });
  return { jobId, status: 'pending' };
}

/**
 * Poll the status of a previously-submitted discovery job.
 *
 * @param {string} jobId
 * @returns {{ status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'not_found',
 *             found?: { urls: string[], logos: string[], products: string[], brandReferences: string[] },
 *             errors: string[] }}
 */
export function getJobStatus(jobId) {
  const job = jobStore.get(jobId);
  if (!job) {
    return { status: 'not_found', errors: [] };
  }
  const result = {
    status: job.status,
    errors: job.errors,
  };
  if (job.found) {
    result.found = job.found;
  }
  return result;
}

/**
 * Mark a pending job as cancelled. Cooperative — the worker may have
 * already started; we set a flag the worker checks at safe points (none
 * today, so cancellation is best-effort). Already-completed jobs are
 * reported as such and not changed.
 *
 * @param {string} jobId
 * @returns {boolean}
 */
export function cancelJob(jobId) {
  const job = jobStore.get(jobId);
  if (!job) return false;
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return false;
  }
  job.status = 'cancelled';
  job.finishedAt = Date.now();
  return true;
}

/**
 * List all jobs. Useful for tests and admin views.
 *
 * @returns {{ jobId: string, status: string, url: string }[]}
 */
export function listJobs() {
  const out = [];
  for (const [jobId, job] of jobStore.entries()) {
    out.push({ jobId, status: job.status, url: job.url });
  }
  return out;
}

/**
 * Clear all jobs. Test helper.
 */
export function _resetJobStore() {
  jobStore.clear();
}

/* ---------- Internal ---------- */

async function executeJob(jobId, url, options) {
  const job = jobStore.get(jobId);
  if (!job) return;
  if (job.status === 'cancelled') {
    jobStore.delete(jobId);
    return;
  }
  job.status = 'running';
  try {
    // Synchronous safety re-check (catches url mutations, expiry).
    const v = await validateUrl(url);
    if (!v.safe) {
      job.status = 'failed';
      job.errors = [v.reason];
      job.finishedAt = Date.now();
      return;
    }
    const result = await runDiscoveryWorker(url, {
      ...options,
      timeoutMs: options.timeoutMs ?? DEFAULT_URL_TIMEOUT_MS,
    });
    if (job.status === 'cancelled') return;
    job.found = {
      urls: result.urls,
      logos: result.logos,
      products: result.products,
      brandReferences: result.brandReferences,
    };
    job.errors = result.errors;
    job.status = result.ok ? 'completed' : 'failed';
    job.finishedAt = Date.now();
  } catch (err) {
    job.status = 'failed';
    job.errors = [err.message];
    job.finishedAt = Date.now();
  } finally {
    // Garbage-collect completed/failed jobs after a short window. The
    // caller has already received their jobId so losing the result
    // window is acceptable. In production this would be a TTL LRU.
    setTimeout(() => {
      const j = jobStore.get(jobId);
      if (j && (j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled')) {
        jobStore.delete(jobId);
      }
    }, 60_000);
  }
}

export const _internal = { MAX_CONCURRENT_JOBS, jobStore };