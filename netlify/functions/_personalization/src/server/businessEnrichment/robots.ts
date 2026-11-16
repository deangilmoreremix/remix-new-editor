/**
 * robots.txt handling. Technique reimplemented from Scrapling's RobotsTxtManager semantics:
 *  - 4xx  → no restrictions (allow all)
 *  - 5xx / network error → treat as full disallow (conservative)
 *  - Allow/Disallow with longest-match precedence, `*` and `$` wildcards
 *  - Crawl-delay and Request-rate honoured; Sitemap lines collected
 * Re-implemented in TypeScript; not the `protego` library.
 */
export interface RobotsRules {
  status: 'allow-all' | 'rules' | 'disallow-all'
  isAllowed(pathAndQuery: string): boolean
  /** Seconds between requests asked for by the site, if any. */
  crawlDelaySec: number | null
  sitemaps: string[]
}

export const ALLOW_ALL: RobotsRules = { status: 'allow-all', isAllowed: () => true, crawlDelaySec: null, sitemaps: [] }
export const DISALLOW_ALL: RobotsRules = { status: 'disallow-all', isAllowed: () => false, crawlDelaySec: null, sitemaps: [] }

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$')
  const body = (anchored ? pattern.slice(0, -1) : pattern).replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${body}${anchored ? '$' : ''}`)
}

interface Rule { allow: boolean; pattern: string; re: RegExp }

export function parseRobots(text: string, userAgent = 'OpenHiggsBoltBot'): RobotsRules {
  const ua = userAgent.toLowerCase()
  const groups: Array<{ agents: string[]; rules: Rule[]; delay: number | null }> = []
  const sitemaps: string[] = []
  let cur: (typeof groups)[number] | null = null
  let lastWasAgent = false

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    const val = line.slice(idx + 1).trim()
    if (key === 'sitemap') { if (val) sitemaps.push(val); continue }
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [], delay: null }; groups.push(cur) }
      cur.agents.push(val.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!cur) continue
    if (key === 'allow' || key === 'disallow') {
      if (val === '' && key === 'disallow') continue // empty Disallow = allow everything
      cur.rules.push({ allow: key === 'allow', pattern: val, re: patternToRegex(val) })
    } else if (key === 'crawl-delay') {
      const n = Number(val)
      if (Number.isFinite(n) && n >= 0) cur.delay = n
    } else if (key === 'request-rate') {
      const m = /^(\d+)\s*\/\s*(\d+)/.exec(val) // "1/10" → one request per 10s
      if (m && Number(m[1]) > 0) cur.delay = Math.max(cur.delay ?? 0, Number(m[2]) / Number(m[1]))
    }
  }

  // Most specific matching group wins; fall back to `*`.
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && ua.includes(a)))
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'))
  const rules = chosen.flatMap((g) => g.rules)
  const delay = chosen.map((g) => g.delay).find((d) => d !== null) ?? null

  return {
    status: rules.length ? 'rules' : 'allow-all',
    crawlDelaySec: delay,
    sitemaps,
    isAllowed(pathAndQuery: string) {
      let best: Rule | null = null
      for (const r of rules) {
        if (!r.re.test(pathAndQuery)) continue
        // Longest pattern wins; Allow wins ties.
        if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r
      }
      return best ? best.allow : true
    },
  }
}

/** Maps the robots.txt HTTP outcome to rules, per the status semantics above. */
export function robotsFromResponse(status: number | null, body: string, userAgent?: string): RobotsRules {
  if (status === null) return DISALLOW_ALL // network error / timeout
  if (status >= 500) return DISALLOW_ALL
  if (status >= 400) return ALLOW_ALL
  return parseRobots(body, userAgent)
}
