// Build-time rebrand of the vendored VidBee app (host layer, not upstream). The upstream sources are never edited:
// the renderer's Vite build (host/vite.web.config.ts) and the main-process esbuild (host/build-host.mjs) pass the files
// through this module as they read them. See README.md for what is and is not touched. VIDBEE_BRAND=off disables it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const brand = JSON.parse(fs.readFileSync(path.join(here, 'brand.json'), 'utf8'))
const overrides = JSON.parse(fs.readFileSync(path.join(here, 'locale-overrides.json'), 'utf8'))
const NAME = brand.name
const UP = brand.upstream.name
export const enabled = process.env.VIDBEE_BRAND !== 'off'

const word = new RegExp(`\\b${UP}\\b`, 'g')

// Technical identifiers that contain the upstream name and must survive: links (repo / issue tracker attribution,
// feedback mail), HTTP headers and user agents, on-disk folder names (existing data and the CLI/extension handshake),
// the MCP auth realm and internal API key labels.
const PROTECT = [
  /\b(?:https?:\/\/|mailto:)[^\s'"`)<>]+/g,
  /X-VidBee-[\w-]+/g,
  /\bVidBee-Desktop\b/g,
  /'User-Agent': 'VidBee'/g,
  /'Downloads', 'VidBee'/g,
  /getPath\('downloads'\), 'VidBee'/g,
  /DIRNAME = 'VidBee'/g,
  /realm="VidBee[^"]*"/g,
  /app_name: 'VidBee'/g,
  /name: 'VidBee', resolve/g,
  /nexmoe\/VidBee/gi
]

/** Swap the product name in free text, leaving PROTECT matches untouched. */
export function renameText(text) {
  const kept = []
  let out = text
  for (const re of PROTECT) out = out.replace(re, (m) => `\u0000${kept.push(m) - 1}\u0000`)
  out = out.replace(word, NAME)
  return out.replace(/\u0000(\d+)\u0000/g, (_m, i) => kept[Number(i)])
}

// Targeted edits applied after the name swap. Each must match, so an upstream change that moves the code fails the
// build loudly instead of silently re-showing the removed UI.
const PATCHES = [
  // VidBee Cloud / GitHub sign-in: the hosted embed has no cloud account (host/better-auth-electron-stub.mjs).
  { file: '/renderer/src/components/settings/SettingsSectionNav.tsx', find: "  { icon: UserRound, labelKey: 'settings.account.tab', value: 'account' },\n", replace: '' },
  { file: '/renderer/src/components/settings/SettingsSectionNav.tsx', find: "values: ['account', 'general']", replace: "values: ['general']" },
  { file: '/renderer/src/router.tsx', find: "const tab = search.tab === 'mcp' ? 'advanced' : search.tab", replace: "const tab = search.tab === 'mcp' ? 'advanced' : search.tab === 'account' ? 'general' : search.tab" },
  { file: '/renderer/src/pages/Settings.tsx', find: '<AccountPanel />', replace: '{null}' },
  { file: '/renderer/src/pages/Settings.tsx', find: /<CloudTranscriptionSettings\b[\s\S]*?\/>/, replace: '{null}' },
  { file: '/renderer/src/components/settings/AiProvidersPanel.tsx', find: /<div className="space-y-2">(\s*<h3[^>]*>\s*\{t\('settings\.ai\.vidbeeCloudSection'\)\})/, replace: '<div className="space-y-2" hidden>$1' },
  { file: '/renderer/src/components/transcript/TranscriptPromptGuidance.tsx', find: /<p>\s*\{t\('settings\.ai\.vidbeeCloudDescription'\)\} \{t\('settings\.ai\.vidbeeCloudPrivacy'\)\}\s*<\/p>/, replace: '' },
  { file: '/renderer/src/components/transcript/TranscriptPromptGuidance.tsx', find: /\{isCloudSignIn \? (\(\s*<Button\s+disabled=\{authWorking\})/, replace: '{false ? $1' },
  { file: '/main/lib/agent-composer.ts', find: `[{ value: 'cloud', label: '${NAME} Cloud' }]`, replace: "[{ value: 'cloud', label: 'No AI provider (add one in Settings)' }]" },
  // Logo text under the sidebar icon is 80px wide: let the long name wrap.
  { file: '/renderer/src/components/ui/sidebar.tsx', find: `appName="${NAME}"`, replace: `appName={${JSON.stringify(brand.sidebarName ?? NAME)}}` },
  // Files saved before the rebrand carry upstream's "via VidBee" suffix: keep finding them.
  ...['/downloader-core/src/download-file.ts', '/apps/desktop/src/shared/utils/download-file.ts'].map((file) => ({
    file,
    find: `[\`\${safeTitle} via ${NAME}.\${format}\`, `,
    replace: `[\`\${safeTitle} via ${NAME}.\${format}\`, \`\${safeTitle} via ${UP}.\${format}\`, `
  }))
]

// Workspace packages: packages/<pkg>/src, or pnpm's injected copy (node_modules/.pnpm/.../@vidbee/<pkg>/src, e.g. downloader-core).
const SOURCE = /\/(?:apps\/desktop\/src|packages\/[^/]+\/src|node_modules\/@vidbee\/[^/]+\/src)\/.*\.(?:[cm]?[jt]sx?)$/
const SKILL = /\/skills\/[^/]+\/SKILL\.md$/
const LOCALE = /\/packages\/i18n\/src\/locales\/([\w-]+)\.json$/

/** Should this module be rebranded? (`file` is an absolute path without query.) */
export function isBranded(file) {
  if (/\.test\.|\.nodetest\.|\/__tests__\//.test(file)) return false
  if (/node_modules/.test(file) && !/\/node_modules\/@vidbee\/[^/]+\/src\/(?!.*node_modules)/.test(file)) return false
  return SOURCE.test(file) || SKILL.test(file) || LOCALE.test(file)
}

/** Rebrand one source file's text (TS/JS, SKILL.md, or a locale JSON). Returns the original string when unchanged. */
export function rebrandSource(code, file) {
  const locale = file.match(LOCALE)
  if (locale) return rebrandLocale(code, locale[1])
  let out = renameText(code)
  for (const p of PATCHES) {
    if (!file.endsWith(p.file)) continue
    const next = out.replace(p.find, p.replace)
    if (next === out) throw new Error(`[vidbee brand] patch no longer matches ${p.file}: ${p.find}. Update apps/vidbee/brand/rebrand.mjs.`)
    out = next
  }
  return out
}

const fill = (s) => s.replaceAll('%NAME%', NAME).replaceAll('%HOST%', brand.host).replaceAll('%UPSTREAM%', UP)
const get = (o, key) => key.split('.').reduce((n, k) => (n == null ? undefined : n[k]), o)
const set = (o, key, v) => {
  const ks = key.split('.')
  const last = ks.pop()
  const parent = ks.reduce((n, k) => (n == null ? undefined : n[k]), o)
  if (!parent || !(last in parent)) return false
  if (v === undefined) delete parent[last]
  else parent[last] = v
  return true
}

/** Rebrand one locale file: swap the name in every value (except `keep`), then apply locale-overrides.json. */
export function rebrandLocale(text, lang) {
  const json = JSON.parse(text)
  const original = JSON.parse(text)
  const walk = (n) => {
    for (const [k, v] of Object.entries(n)) {
      if (typeof v === 'string') n[k] = renameText(v)
      else if (v && typeof v === 'object') walk(v)
    }
  }
  walk(json)
  for (const key of overrides.keep) set(json, key, get(original, key))
  for (const [key, text] of Object.entries(overrides.en)) {
    let value
    if (lang === 'en') value = fill(text)
    else if (overrides.fromWebKey[key]) value = get(json, overrides.fromWebKey[key])
    else value = overrides[lang]?.[key] ? fill(overrides[lang][key]) : undefined // undefined → English fallback
    if (!set(json, key, value) && lang === 'en') throw new Error(`[vidbee brand] locale key ${key} no longer exists in en.json`)
  }
  return JSON.stringify(json)
}

/** Vite plugin for the renderer build. */
export function vitePlugin() {
  let outDir
  return {
    name: 'vidbee:brand',
    enforce: 'pre',
    configResolved(c) { outDir = c.build.outDir },
    transform(code, id) {
      const file = id.split('?')[0]
      if (!enabled || !isBranded(file)) return null
      const out = rebrandSource(code, file)
      return out === code ? null : { code: out, map: null }
    },
    transformIndexHtml(html) { return enabled ? renameText(html) : html },
    closeBundle() {
      // public/web-shim.js is copied verbatim (notification fallback title).
      const shim = outDir && path.join(outDir, 'web-shim.js')
      if (enabled && shim && fs.existsSync(shim)) fs.writeFileSync(shim, fs.readFileSync(shim, 'utf8').replace(/'VidBee'/g, JSON.stringify(NAME)))
    }
  }
}

/** esbuild plugin for the main-process / worker bundles (register it after host/build-host.mjs's `vite-compat`). */
export function esbuildPlugin() {
  const loaders = { '.ts': 'ts', '.tsx': 'tsx', '.js': 'js', '.mjs': 'js', '.cjs': 'js', '.jsx': 'jsx', '.mts': 'ts', '.cts': 'ts', '.json': 'json' }
  return {
    name: 'vidbee:brand',
    setup(b) {
      if (!enabled) return
      b.onLoad({ filter: /\.(?:[cm]?[jt]sx?|json)$/ }, (a) => {
        if (!isBranded(a.path)) return undefined
        const code = fs.readFileSync(a.path, 'utf8')
        const out = rebrandSource(code, a.path)
        return out === code ? undefined : { contents: out, loader: loaders[path.extname(a.path)] }
      })
    }
  }
}
