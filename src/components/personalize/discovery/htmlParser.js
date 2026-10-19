// src/components/personalize/discovery/htmlParser.js
//
// HTML parsing for asset URL extraction.
//
// Tries (in order):
//   1. cheerio (if installed)
//   2. linkedom (if installed)
//   3. node-html-parser (if installed)
//   4. A small custom regex/DOM-walker fallback
//
// We use dynamic `import()` so the parser choice is decided at runtime
// and the module works whether or not any specific parser is installed.
// This is critical because the discovery module may be loaded into
// environments without npm-installed packages (e.g. certain CI runners).
//
// SECURITY: We MUST NEVER call `eval` or `Function()` on discovered content.
// We MUST NOT trust innerHTML / outerHTML in any way that could lead to
// code execution. linkedom is a pure-JS DOM implementation with no script
// execution; cheerio uses parse5/css-select; both are safe. The regex
// fallback only inspects substrings.
//
// We also resolve relative URLs against the page base URL using the
// WHATWG URL constructor, which is the standard behavior for browsers.

import { URL } from 'node:url';
import { validateAssetUrl } from './urlSafety.js';

/* ---------- Parser resolution ---------- */

let cachedParser = null;

async function resolveParser() {
  if (cachedParser !== null) return cachedParser;

  // Try cheerio first. The import spec is built at runtime (string
  // concatenation of hard-coded literals) so bundlers cannot resolve
  // it at build time and won't fail when the optional dep is absent.
  // SAFETY: The spec is fully static — no user input is ever passed to
  // import().
  const candidates = ['cheerio', 'linkedom', 'node-html-parser'];
  for (const name of candidates) {
    try {
      const spec = name; // runtime concatenation prevents static analysis
      const mod = await import(spec);
      if (name === 'cheerio' && mod && mod.load) {
        cachedParser = { name, load: mod.load };
        return cachedParser;
      }
      if (name === 'linkedom' && mod && (mod.parseHTML || mod.parseFragment)) {
        cachedParser = {
          name,
          parseHTML: mod.parseHTML,
          parseFragment: mod.parseFragment,
        };
        return cachedParser;
      }
      if (name === 'node-html-parser' && mod && mod.parse) {
        cachedParser = { name, parse: mod.parse };
        return cachedParser;
      }
    } catch { /* not installed — try next */ }
  }

  // Fallback to regex parser.
  cachedParser = { name: 'regex' };
  return cachedParser;
}

/* ---------- URL helpers ---------- */

function resolveUrl(base, relative) {
  try {
    return new URL(relative, base).toString();
  } catch {
    return null;
  }
}

function pickFirstFromSrcset(srcset) {
  if (!srcset) return null;
  // srcset is a comma-separated list of "url [descriptor]" — we just
  // want the first URL token. Split on commas that aren't inside parens
  // (URLs can in theory contain commas, but image srcsets do not).
  const first = srcset.split(',')[0].trim();
  if (!first) return null;
  // The first whitespace-separated token is the URL.
  const url = first.split(/\s+/)[0];
  return url || null;
}

/* ---------- Parser-specific extractors ---------- */

function extractWithCheerio($, baseUrl) {
  const out = new Set();

  $('img[src]').each((_, el) => {
    const v = $(el).attr('src');
    if (v) out.add(resolveUrl(baseUrl, v));
  });
  $('img[data-src]').each((_, el) => {
    const v = $(el).attr('data-src');
    if (v) out.add(resolveUrl(baseUrl, v));
  });
  $('link[rel="icon" i][href], link[rel="shortcut icon" i][href]').each((_, el) => {
    const v = $(el).attr('href');
    if (v) out.add(resolveUrl(baseUrl, v));
  });
  $('link[rel="apple-touch-icon" i][href], link[rel="apple-touch-icon-precomposed" i][href]').each((_, el) => {
    const v = $(el).attr('href');
    if (v) out.add(resolveUrl(baseUrl, v));
  });
  $('meta[property="og:image" i][content], meta[property="og:image:url" i][content]').each((_, el) => {
    const v = $(el).attr('content');
    if (v) out.add(resolveUrl(baseUrl, v));
  });
  $('meta[name="twitter:image" i][content], meta[name="twitter:image:src" i][content]').each((_, el) => {
    const v = $(el).attr('content');
    if (v) out.add(resolveUrl(baseUrl, v));
  });
  $('source[srcset]').each((_, el) => {
    const v = pickFirstFromSrcset($(el).attr('srcset'));
    if (v) out.add(resolveUrl(baseUrl, v));
  });

  return Array.from(out).filter(Boolean);
}

function extractWithLinkedom(doc, baseUrl) {
  const out = new Set();

  function addAttr(selector, attr) {
    const nodes = doc.querySelectorAll(selector);
    for (const node of nodes) {
      const v = node.getAttribute(attr);
      if (v) {
        const r = resolveUrl(baseUrl, v);
        if (r) out.add(r);
      }
    }
  }

  addAttr('img[src]', 'src');
  addAttr('img[data-src]', 'data-src');
  addAttr('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]', 'href');
  addAttr('meta[property="og:image"], meta[property="og:image:url"]', 'content');
  addAttr('meta[name="twitter:image"], meta[name="twitter:image:src"]', 'content');

  const sources = doc.querySelectorAll('source[srcset]');
  for (const src of sources) {
    const v = pickFirstFromSrcset(src.getAttribute('srcset'));
    if (v) {
      const r = resolveUrl(baseUrl, v);
      if (r) out.add(r);
    }
  }

  return Array.from(out);
}

function extractWithNodeHtmlParser(root, baseUrl) {
  const out = new Set();

  function addAttr(selector, attr) {
    const nodes = root.querySelectorAll(selector);
    for (const node of nodes) {
      const v = node.getAttribute(attr);
      if (v) {
        const r = resolveUrl(baseUrl, v);
        if (r) out.add(r);
      }
    }
  }

  addAttr('img[src]', 'src');
  addAttr('img[data-src]', 'data-src');
  addAttr('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]', 'href');
  addAttr('meta[property="og:image"], meta[property="og:image:url"]', 'content');
  addAttr('meta[name="twitter:image"], meta[name="twitter:image:src"]', 'content');

  const sources = root.querySelectorAll('source[srcset]');
  for (const src of sources) {
    const v = pickFirstFromSrcset(src.getAttribute('srcset'));
    if (v) {
      const r = resolveUrl(baseUrl, v);
      if (r) out.add(r);
    }
  }

  return Array.from(out);
}

/**
 * Regex fallback. Strictly substring-scans — no script execution, no DOM
 * construction, no recursion into innerHTML. Recognizes the same elements
 * the DOM extractors do.
 */
function extractWithRegex(html, baseUrl) {
  const out = new Set();
  const patterns = [
    // <img src="..."> / <img src='...'> / <img src=...>
    {
      re: /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi,
        pick: (m) => m[1] || m[2] || m[3],
    },
    // <img data-src="...">
    {
      re: /<img\b[^>]*?\bdata-src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi,
        pick: (m) => m[1] || m[2] || m[3],
    },
    // <link rel="icon" href="..."> / rel="shortcut icon" / apple-touch-icon
    {
      re: /<link\b[^>]*?\brel\s*=\s*(?:"[^"]*icon[^"]*"|'[^']*icon[^']*'|[^\s>]*icon[^\s>]*)[^>]*?\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi,
        pick: (m) => m[1] || m[2] || m[3],
    },
    // <meta property="og:image" content="...">
    {
      re: /<meta\b[^>]*?\bproperty\s*=\s*(?:"og:image"|"og:image:url"|'og:image'|'og:image:url')[^>]*?\bcontent\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi,
        pick: (m) => m[1] || m[2] || m[3],
    },
    {
      re: /<meta\b[^>]*?\bcontent\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*?\bproperty\s*=\s*(?:"og:image"|'og:image')/gi,
        pick: (m) => m[1] || m[2] || m[3],
    },
    // <meta name="twitter:image" content="...">
    {
      re: /<meta\b[^>]*?\bname\s*=\s*(?:"twitter:image"|"twitter:image:src"|'twitter:image'|'twitter:image:src')[^>]*?\bcontent\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi,
        pick: (m) => m[1] || m[2] || m[3],
    },
    {
      re: /<meta\b[^>]*?\bcontent\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*?\bname\s*=\s*(?:"twitter:image"|'twitter:image')/gi,
        pick: (m) => m[1] || m[2] || m[3],
    },
    // <source srcset="url ...">
    {
      re: /<source\b[^>]*?\bsrcset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi,
        pick: (m) => pickFirstFromSrcset(m[1] || m[2] || m[3]),
    },
  ];

  for (const { re, pick } of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const v = pick(m);
      if (!v) continue;
      const r = resolveUrl(baseUrl, v);
      if (r) out.add(r);
    }
  }
  return Array.from(out);
}

/* ---------- Public API ---------- */

/**
 * Parse an HTML string and extract all candidate asset URLs.
 *
 * @param {string} html — Raw HTML body.
 * @param {string} baseUrl — Page URL, used for resolving relative URLs.
 * @returns {Promise<{ urls: string[], parserUsed: string }>}
 */
export async function extractAssetUrls(html, baseUrl) {
  if (typeof html !== 'string' || html.length === 0) {
    return { urls: [], parserUsed: 'empty' };
  }
  const parser = await resolveParser();

  let urls;
  if (parser.name === 'cheerio') {
    const $ = parser.load(html);
    urls = extractWithCheerio($, baseUrl);
  } else if (parser.name === 'linkedom') {
    const { document } = parser.parseHTML(html);
    urls = extractWithLinkedom(document, baseUrl);
  } else if (parser.name === 'node-html-parser') {
    const root = parser.parse(html);
    urls = extractWithNodeHtmlParser(root, baseUrl);
  } else {
    urls = extractWithRegex(html, baseUrl);
  }

  // Apply extension allowlist (drop URLs whose extension is junk or
  // explicitly outside the allowed set).
  const filtered = [];
  for (const u of urls) {
    const check = validateAssetUrl(u);
    if (check.ok) filtered.push(u);
  }
  return { urls: filtered, parserUsed: parser.name };
}

/**
 * Cheap heuristic for "is this page JS-rendered?". Returns true if the
 * body text length is very short (< 500 bytes after stripping tags) but
 * the page contains a `<script>` tag suggesting a SPA framework.
 *
 * @param {string} html
 * @returns {boolean}
 */
export function looksJsRendered(html) {
  if (typeof html !== 'string' || html.length === 0) return false;
  // Strip tags crudely.
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length >= 500) return false;
  // Common SPA markers.
  const markers = [
    /<div\s+id=["']root["']/i,
    /<div\s+id=["']app["']/i,
    /<script[^>]+src=["'][^"']*\/_next\//i,
    /window\.__NEXT_DATA__/,
    /window\.__NUXT__/,
    /<script[^>]+src=["'][^"']*\/main\.[a-z0-9]+\.js/i,
  ];
  return markers.some((re) => re.test(html));
}