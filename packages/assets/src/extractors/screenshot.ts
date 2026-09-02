// packages/assets/src/extractors/screenshot.ts
//
// Capture a website screenshot. We use a tiered strategy:
//
// 1. If the website HTML exposed an <meta property="og:image">, use that
//    — it's almost always a high-quality marketing screenshot.
// 2. If SCREENSHOT_API_URL is set, POST the page URL to it and let a
//    headless browser (Playwright/Puppeteer on Render, or a hosted API
//    like https://api.screenshotmachine.com) capture the page. This is
//    the only way to get a *true* screenshot of the rendered page.
// 3. Otherwise, return undefined — the caller should treat screenshots
//    as optional.

import type { DiscoveredAsset } from '../types.ts';

export interface ScreenshotOptions {
  /** URL of the page to capture */
  url: string;
  /** Raw HTML of the page (we use this to detect og:image) */
  html?: string;
  /** Optional screenshot API endpoint (POST { url } returns { url: 'https://...' }) */
  apiUrl?: string;
  /** API key for the screenshot service */
  apiKey?: string;
  /** Width in px (passed to the screenshot API) */
  width?: number;
  /** Height in px (passed to the screenshot API) */
  height?: number;
  /** Per-call timeout in ms */
  timeoutMs?: number;
}

export async function captureScreenshot(opts: ScreenshotOptions): Promise<DiscoveredAsset | undefined> {
  const og = detectOgImage(opts.html);
  if (og) {
    return {
      assetType: 'screenshot',
      url: og,
      source: { source: 'website', sourceUrl: og, discoveredAt: new Date().toISOString() },
      metadata: { source: 'og:image' },
    };
  }

  if (opts.apiUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
      const res = await fetch(opts.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
        },
        body: JSON.stringify({
          url: opts.url,
          width: opts.width ?? 1280,
          height: opts.height ?? 720,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return undefined;
      const data: any = await res.json().catch(() => ({}));
      const screenshotUrl = data.url || data.screenshot || data.image;
      if (screenshotUrl) {
        return {
          assetType: 'screenshot',
          url: screenshotUrl,
          source: { source: 'website', sourceUrl: opts.url, discoveredAt: new Date().toISOString() },
          metadata: { source: 'screenshot-api', width: opts.width, height: opts.height },
        };
      }
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function detectOgImage(html?: string): string | undefined {
  if (!html) return undefined;
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (!m) return undefined;
  return resolveUrl(extractBaseUrl(html) || '', m[1]);
}

function extractBaseUrl(html: string): string | undefined {
  const m = html.match(/<base[^>]+href=["']([^"']+)["']/i);
  return m?.[1];
}

function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).toString();
  } catch {
    return relative;
  }
}
