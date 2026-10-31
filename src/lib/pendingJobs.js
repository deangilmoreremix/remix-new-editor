const PENDING_KEY = 'muapi_pending_jobs';

export function savePendingJob(job) {
    try {
        const jobs = getAllPendingJobs().filter(j => j.requestId !== job.requestId);
        jobs.push(job);
        localStorage.setItem(PENDING_KEY, JSON.stringify(jobs));
    } catch (e) {
        console.warn('[PendingJobs] Failed to save:', e);
    }
}

export function removePendingJob(requestId) {
    try {
        const jobs = getAllPendingJobs().filter(j => j.requestId !== requestId);
        localStorage.setItem(PENDING_KEY, JSON.stringify(jobs));
    } catch (e) {
        console.warn('[PendingJobs] Failed to remove:', e);
    }
}

export function getPendingJobs(studioType) {
    const all = getAllPendingJobs();
    return studioType ? all.filter(j => j.studioType === studioType) : all;
}

function getAllPendingJobs() {
    try {
        return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    } catch {
        return [];
    }
}

// Jobs older than this are assumed finished or abandoned and are not resumed.
const MAX_JOB_AGE_MS = 60 * 60 * 1000;

// Request ids still being polled by this page. Survives in-app navigation but
// not a reload, so returning to a studio mid-generation doesn't poll twice.
const inFlight = new Set();

/**
 * Tracks one generation so it can be resumed if the page reloads mid-poll.
 * Pass `onRequestId` into the muapi generate params; call `finish()` once
 * the call settles (success, error or cancel).
 */
export function createPendingJobTracker(studioType, historyMeta = {}, { maxAttempts = 300, interval = 2000 } = {}) {
    let requestId = null;
    return {
        onRequestId(rid) {
            requestId = rid;
            inFlight.add(rid);
            savePendingJob({ requestId: rid, studioType, historyMeta, maxAttempts, interval, submittedAt: Date.now() });
        },
        finish() {
            if (!requestId) return;
            inFlight.delete(requestId);
            removePendingJob(requestId);
        },
    };
}

export function resultUrlOf(result) {
    return result?.outputs?.[0] || result?.url || result?.output?.url || null;
}

/**
 * Resumes polling for this studio's unfinished jobs and hands each recovered
 * result to `onResult(url, job)`. `poll` is muapi.pollForResult (injected so
 * this module stays free of network code). Shows a small status banner.
 */
export function resumePendingJobs(studioType, { poll, onResult, now = Date.now() } = {}) {
    const jobs = getPendingJobs(studioType);
    const live = [];
    jobs.forEach((job) => {
        if (!job?.requestId || now - (job.submittedAt || 0) > MAX_JOB_AGE_MS) removePendingJob(job?.requestId);
        else if (!inFlight.has(job.requestId)) live.push(job);
    });
    if (!live.length || typeof poll !== 'function') return Promise.resolve([]);

    let banner = null;
    if (typeof document !== 'undefined') {
        banner = document.createElement('div');
        banner.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-[#111] border border-white/10 text-white text-sm px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3';
        banner.innerHTML = '<span class="animate-spin text-primary">◌</span> <span class="banner-text"></span>';
        document.body.appendChild(banner);
    }
    let remaining = live.length;
    const updateBanner = () => {
        if (!banner) return;
        if (remaining === 0) banner.remove();
        else banner.querySelector('.banner-text').textContent = `Resuming ${remaining} pending generation${remaining > 1 ? 's' : ''}…`;
    };
    updateBanner();

    return Promise.all(live.map(async (job) => {
        const interval = job.interval || 2000;
        const elapsedAttempts = Math.floor((now - job.submittedAt) / interval);
        const attemptsLeft = Math.max(1, (job.maxAttempts || 300) - elapsedAttempts);
        inFlight.add(job.requestId);
        try {
            const url = resultUrlOf(await poll(job.requestId, attemptsLeft, interval));
            if (url) onResult?.(url, job);
            return url;
        } catch {
            return null;
        } finally {
            inFlight.delete(job.requestId);
            removePendingJob(job.requestId);
            remaining--;
            updateBanner();
        }
    }));
}
