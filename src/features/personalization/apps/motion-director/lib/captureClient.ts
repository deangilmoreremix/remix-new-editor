/**
 * Browser client for the Motion Studio page-capture service (POST /api/motion-studio/capture and its status route).
 *
 * Kept in its own small module — it needs nothing but `fetch` — so editors that only want to capture a website (the
 * personalization modal's "Website background") do not have to load the Motion Studio store, card registry and demo
 * compositions that `directorClient` needs. `directorClient` re-exports everything here, so existing imports keep working.
 */
import type { SiteContent } from './filmChat';

export interface SiteCapture {
  url: string;
  title: string;
  /** True when the host ran out of time before a picture was taken: only the site's words and colours came back. */
  partial?: boolean;
  page: { url: string; width: number; height: number };
  crops: string[];
  /** What each crop shows, same order as `crops` (src/server/browserDiscovery CropInfo). */
  cropInfo?: Array<{ route: string; cut: 'card' | 'band'; width: number; height: number; text: string; imageShare: number; portraits: number; map: boolean }>;
  /** The site's own images (product shots, hero art), largest first. */
  images?: string[];
  /** The site's logo (transparent PNG), when one was found. */
  logo?: string | null;
  brand: { background: string | null; text: string | null; accent: string | null; fontFamily: string | null; surface?: string | null; field?: string | null; muted?: string | null; border?: string | null; bodyFont?: string | null; radius?: number | null };
  /** The site's pages found in its links (captured or not), for a targeted capture after the storyboard. */
  links?: Array<{ name: string; path: string; url: string }>;
  /** Every route captured, the page asked for first (upstream captures several routes of the site). */
  pages?: Array<{ name: string; path: string; url: string; width: number; height: number; layout?: CaptureLayout | null }>;
  /** Pictures of the site found by the asset finder (people, team, products…), with what each one shows. */
  assets?: Array<{ url: string; category: string; alt: string }>;
  /** Floating UI cutouts: the nav bar, and transparent PNGs of the search pill and main button. */
  cutouts?: { nav: string | null; search: string | null; button: string | null };
  /** The page with its cards hidden, for fly-in shots. */
  emptyPlate?: string | null;
  /** What the site says about itself: headline, section headings, calls to action. */
  content?: SiteContent | null;
  transient: boolean;
}

interface CaptureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Element positions on a captured page, in page CSS px (upstream's layout.json). */
export interface CaptureLayout {
  pageH: number;
  sections: CaptureRect[];
  cards: CaptureRect[];
}

export class DirectorError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
  }
}

/** A request that never answers must not leave the chat waiting: give up after `timeoutMs`. */
export async function post<T>(path: string, body: unknown, timeoutMs = 0): Promise<T> {
  const controller = timeoutMs ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const timedOut = () => new DirectorError(`it took longer than ${Math.round(timeoutMs / 1000)} seconds`, 'TIMEOUT', 408);
  let res: Response;
  let data: any;
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller?.signal });
    // The timer keeps running while the body is read: headers can arrive and the body still stall.
    data = await res.json().catch((error) => {
      if (controller?.signal.aborted) throw error;
      return {};
    });
  } catch (error) {
    if (controller?.signal.aborted) throw timedOut();
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!res.ok) {
    throw new DirectorError(String(data?.message || data?.error || `Request failed (${res.status})`), String(data?.code || data?.error || 'FAILED'), res.status);
  }
  return data as T;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Capture a site. On the host the server starts a background capture (a web request lasts only ~30 s, too
 * little to photograph a heavy page) and answers with a job id; this polls the job until it is done. Where the
 * capture runs inside the request (local development) the answer is the capture itself.
 */
export async function captureSite(
  url: string,
  opts: { onProgress?: (elapsedSec: number) => void; cancelled?: () => boolean; pollMs?: number; maxWaitMs?: number; targeted?: boolean } = {},
): Promise<SiteCapture> {
  const first = await post<SiteCapture & { jobId?: string }>('/api/motion-studio/capture', { url, ...(opts.targeted ? { targeted: true } : {}) }, 32_000);
  if (!first.jobId) return first;
  const started = Date.now();
  // The quick capture is done in about 2 minutes; past 4 the film goes on with what it has (the words, no pictures).
  const maxWait = opts.maxWaitMs ?? 270_000;
  let failures = 0;
  while (Date.now() - started < maxWait) {
    await sleep(opts.pollMs ?? 2_000);
    if (opts.cancelled?.()) throw new DirectorError('Stopped', 'CANCELLED', 0);
    opts.onProgress?.(Math.round((Date.now() - started) / 1000));
    try {
      const res = await fetch(`/api/motion-studio/capture/status?jobId=${encodeURIComponent(first.jobId)}`, { cache: 'no-store' });
      const job = (await res.json().catch(() => ({}))) as { state?: string; capture?: SiteCapture; code?: string; error?: string; timing?: Record<string, number> };
      if (!res.ok) throw new DirectorError(String(job.error || `Request failed (${res.status})`), String(job.code || 'FAILED'), res.status);
      if (job.state === 'done' && job.capture) return job.capture;
      if (job.state === 'error') {
        // Say where the time went, so a failure explains itself.
        const steps = Object.entries(job.timing ?? {}).filter(([, ms]) => typeof ms === 'number').map(([k, ms]) => `${k} ${(ms / 1000).toFixed(1)}s`).join(', ');
        throw new DirectorError(`${job.error || 'The page could not be captured'}${steps ? ` (${steps})` : ''}`, job.code || 'CAPTURE_FAILED', 422);
      }
      failures = 0;
    } catch (error) {
      // A poll that fails (network blip, record not visible yet) is tried again a few times; the capture goes on without it.
      if (error instanceof DirectorError && error.code !== 'NOT_FOUND' && error.status !== 0 && error.status < 500) throw error;
      if (++failures > 5) throw error;
    }
  }
  throw new DirectorError('it took longer than 2½ minutes', 'TIMEOUT', 408);
}
