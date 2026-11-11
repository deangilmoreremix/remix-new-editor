import React from 'react';
import * as Remotion from 'remotion';
import { adaptedCodeEnabled } from './adaptedPolicy';

/**
 * Runs a recipe that the AI adapted to a person's site (upstream does this by editing the demo's
 * source). The code is untrusted model output, so it only runs after a static check: a narrow
 * import list, no network / storage / DOM-global access, no escape hatches, no randomness or
 * clocks (renders must be deterministic). Anything that fails falls back to the plain recipe.
 */

export const ADAPTED_FIXTURES = ['Brand', 'Fixtures', 'Look', 'Motion', 'PageCam2D', 'Polish', 'liveTexture', 'ExportMode'] as const

const FORBIDDEN_IDENTS = new Set([
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker', 'ServiceWorker', 'importScripts',
  'eval', 'Function', 'require', 'process', 'globalThis', 'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB',
  'setTimeout', 'setInterval', 'requestAnimationFrame', 'requestIdleCallback', 'queueMicrotask', 'Reflect', 'Proxy', 'WebAssembly', 'DOMParser', 'FileReader',
])
const FORBIDDEN_PROPS = new Set(['constructor', '__proto__', 'prototype', 'innerHTML', 'outerHTML', 'dangerouslySetInnerHTML', 'srcdoc', 'cookie'])
const FORBIDDEN_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'frame', 'frameset', 'portal'])
const EXTERNAL = /(?:^|[\s("'=,])(?:https?:)?\/\/[\w.-]+|javascript:|data:text\/html|vbscript:/i

export interface AdaptCheck {
  ok: boolean
  /** Why the code was refused (first problem only; the fix loop sends it back to the model). */
  error?: string
}

const allowedImport = (spec: string): boolean => {
  if (spec === 'react' || spec === 'remotion') return true
  const m = /^(?:\.\.?\/)+(?:demosrc\/)?_fixtures\/(\w+)$/.exec(spec)
  return !!m && (ADAPTED_FIXTURES as readonly string[]).includes(m[1])
}

type TS = typeof import('typescript')
let tsPromise: Promise<TS> | null = null
const loadTs = (): Promise<TS> => (tsPromise ??= import('typescript').then((m) => ((m as unknown as { default?: TS }).default ?? (m as unknown as TS))))

/** Static check of the adapted source. Pure; does not execute anything. */
export async function checkAdaptedSource(code: string, stem?: string): Promise<AdaptCheck> {
  if (typeof code !== 'string' || !code.trim()) return { ok: false, error: 'empty source' }
  if (code.length > 120_000) return { ok: false, error: 'source is too long' }
  const ts = await loadTs()
  const sf = ts.createSourceFile('adapted.tsx', code, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX)
  const syntax = (sf as unknown as { parseDiagnostics?: Array<{ messageText: unknown }> }).parseDiagnostics
  if (syntax?.length) {
    const t = syntax[0].messageText
    return { ok: false, error: `syntax error: ${typeof t === 'string' ? t : (t as { messageText?: string }).messageText ?? 'invalid'}` }
  }
  let error: string | undefined
  let hasDefault = false
  const fail = (msg: string) => { error ??= msg }
  const visit = (node: import('typescript').Node): void => {
    if (error) return
    const k = ts.SyntaxKind
    switch (node.kind) {
      case k.ImportDeclaration: {
        const spec = (node as import('typescript').ImportDeclaration).moduleSpecifier
        if (!ts.isStringLiteral(spec) || !allowedImport(spec.text)) fail(`import not allowed: ${ts.isStringLiteral(spec) ? spec.text : '?'}`)
        break
      }
      case k.ExportDeclaration: {
        const spec = (node as import('typescript').ExportDeclaration).moduleSpecifier
        if (spec) fail('re-exports are not allowed')
        break
      }
      case k.ExportAssignment:
        hasDefault = true
        break
      case k.CallExpression: {
        const c = node as import('typescript').CallExpression
        if (c.expression.kind === k.ImportKeyword) fail('dynamic import is not allowed')
        break
      }
      case k.Identifier: {
        const name = (node as import('typescript').Identifier).text
        const p = node.parent
        const isPropName = p && ((ts.isPropertyAccessExpression(p) && p.name === node) || (ts.isPropertyAssignment(p) && p.name === node) || (ts.isJsxAttribute(p) && p.name === node))
        if (!isPropName && FORBIDDEN_IDENTS.has(name)) fail(`"${name}" is not allowed`)
        break
      }
      case k.JsxAttribute: {
        const nm = (node as import('typescript').JsxAttribute).name
        const txt = ts.isIdentifier(nm) ? nm.text : ''
        if (FORBIDDEN_PROPS.has(txt)) fail(`attribute "${txt}" is not allowed`)
        break
      }
      case k.PropertyAccessExpression: {
        const pa = node as import('typescript').PropertyAccessExpression
        if (FORBIDDEN_PROPS.has(pa.name.text)) fail(`property "${pa.name.text}" is not allowed`)
        if (ts.isIdentifier(pa.expression)) {
          const o = pa.expression.text
          const n = pa.name.text
          if ((o === 'Math' && n === 'random') || (o === 'Date' && n === 'now') || (o === 'performance' && n === 'now')) fail(`${o}.${n} makes frames non-deterministic`)
        }
        break
      }
      case k.ElementAccessExpression: {
        // Recipes index arrays by number all the time (`rows[i]`). Keys that are text are refused:
        // `o['constructor']` is how code reaches the Function constructor.
        const a = (node as import('typescript').ElementAccessExpression).argumentExpression
        const textual = (n: import('typescript').Node): boolean => ts.isStringLiteralLike(n) || ts.isTemplateExpression(n) || (ts.isBinaryExpression(n) && n.operatorToken.kind === k.PlusToken && (textual(n.left) || textual(n.right))) || (ts.isParenthesizedExpression(n) && textual(n.expression))
        if (textual(a)) fail('computed property access with text keys is not allowed')
        break
      }
      case k.NewExpression: {
        const n = node as import('typescript').NewExpression
        if (ts.isIdentifier(n.expression) && n.expression.text === 'Date' && (!n.arguments || n.arguments.length === 0)) fail('new Date() makes frames non-deterministic')
        break
      }
      case k.JsxOpeningElement:
      case k.JsxSelfClosingElement: {
        const tag = (node as import('typescript').JsxOpeningElement).tagName
        if (ts.isIdentifier(tag) && FORBIDDEN_TAGS.has(tag.text.toLowerCase())) fail(`<${tag.text}> is not allowed`)
        break
      }
      case k.StringLiteral:
      case k.NoSubstitutionTemplateLiteral:
      case k.TemplateHead:
      case k.TemplateMiddle:
      case k.TemplateTail: {
        const text = (node as import('typescript').StringLiteral).text
        if (node.parent && ts.isImportDeclaration(node.parent)) break
        if (/constructor|__proto__|prototype/i.test(text)) fail('strings naming constructor / prototype are not allowed')
        else if (EXTERNAL.test(text.replace(/https?:\/\/www\.w3\.org\/\d{4}\/[\w-]+/g, ''))) fail('external URLs and script URLs are not allowed; use the captured images passed in props')
        break
      }
      default:
        break
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  if (error) return { ok: false, error }
  const named = stem ? new RegExp(`export\\s+(?:const|function)\\s+${stem}\\b`).test(code) : /export\s+(?:const|function)\s+[A-Z]\w*/.test(code)
  if (!hasDefault && !/\bexport\s+default\b/.test(code) && !named) return { ok: false, error: stem ? `the file must export the component \`${stem}\` (or a default export)` : 'the file must export a React component' }
  return { ok: true }
}

const moduleFor = (spec: string): unknown => {
  if (spec === 'react') return React
  if (spec === 'remotion') return Remotion
  const m = /_fixtures\/(\w+)$/.exec(spec)
  const name = m?.[1]
  const loaded = name ? FIXTURE_MODULES[name] : undefined
  if (!loaded) throw new Error(`module not available: ${spec}`)
  return loaded
}

/** Fixture modules are registered by the app (kept out of this file so tests stay light). */
const FIXTURE_MODULES: Record<string, unknown> = {}
export const registerAdaptedFixtures = (mods: Record<string, unknown>) => { Object.assign(FIXTURE_MODULES, mods) }

export type AdaptedComponent = React.ComponentType<Record<string, unknown>>

/** Check, transpile and instantiate the adapted component; throws with a readable reason. */
export async function compileAdapted(code: string, stem?: string): Promise<AdaptedComponent> {
  // Off unless a deployment opts in (adaptedPolicy.ts): a static check is not a sandbox.
  if (!adaptedCodeEnabled()) throw new Error('adapted code is turned off')
  const checked = await checkAdaptedSource(code, stem)
  if (!checked.ok) throw new Error(checked.error)
  const ts = await loadTs()
  const out = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
    reportDiagnostics: false,
  }).outputText
  const mod: { exports: Record<string, unknown> } = { exports: {} }
  const requireShim = (spec: string) => {
    if (!allowedImport(spec)) throw new Error(`import not allowed: ${spec}`)
    return moduleFor(spec)
  }
  // Shadow the globals the check forbids, so a miss in the check still cannot reach them.
  const shadow = ['window', 'document', 'fetch', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB', 'navigator', 'globalThis', 'setTimeout', 'setInterval', 'Worker', 'top', 'parent', 'frames', 'self', 'caches', 'Reflect', 'Proxy']
  // eslint-disable-next-line no-new-func
  const run = new Function('require', 'module', 'exports', 'React', ...shadow, `"use strict";\n${out}`)
  run(requireShim, mod, mod.exports, React, ...shadow.map(() => undefined))
  const Comp = (mod.exports.default ?? (stem ? mod.exports[stem] : undefined) ?? Object.values(mod.exports).find((v) => typeof v === 'function')) as unknown
  if (typeof Comp !== 'function') throw new Error('the file exports no component')
  return Comp as AdaptedComponent
}

/** Catches a render error from adapted code and shows the plain recipe instead. */
export class AdaptedBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}
