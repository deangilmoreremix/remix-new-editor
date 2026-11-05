/**
 * A Cinema still (Image output mode) that finishes while the page is reloaded
 * must come back as an image, not a video.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import { createPendingJobTracker, getPendingJobs } from '../lib/pendingJobs.js';

describe('Cinema still recovery', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

  it('the pending-job record keeps the image kind', () => {
    const job = createPendingJobTracker('cinema', { kind: 'image', settings: { prompt: 'x' } });
    job.onRequestId('req-1');
    const [saved] = getPendingJobs('cinema');
    expect(saved.historyMeta.kind).toBe('image');
    job.finish();
  });

  it('the stills branch records it and the recovery callback forwards it', () => {
    const src = fs.readFileSync('src/components/CinemaStudio.js', 'utf8');
    expect(src).toMatch(/createPendingJobTracker\('cinema', \{\s*kind: 'image'/);
    expect(src).toContain('addToHistory({ url, kind: job.historyMeta.kind');
  });
});
