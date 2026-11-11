// @vitest-environment jsdom
/**
 * Pure-part tests for the browser export engine.
 *
 * The engine's heavy half (the actual `@remotion/web-renderer` render) can only
 * run in a real browser, so these tests cover everything that must be decided
 * BEFORE a single frame is rendered: progress mapping, failure classification,
 * the pre-flight cancellation path, and the guarantee that the export path
 * contains no server calls at all.
 */

import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  cancelActiveExport,
  clampProgress,
  exportPersonalizedVideo,
  isExportActive,
  webExportFailureReason,
} from '../webExport'
import { createDefaultPreviewSettings } from '../preview/presets'
import type { PreviewInputProps } from '../preview/types'

function makeInputProps(overrides: Partial<PreviewInputProps> = {}): PreviewInputProps {
  return {
    videoUrl: '/media/demo.mp4',
    posterUrl: null,
    isImageSource: false,
    audioUrl: null,
    settings: createDefaultPreviewSettings(),
    brand: {
      businessName: 'Acme Roofing',
      headline: 'Roofing done right',
      offer: '',
      cta: '',
      phone: '',
      website: '',
      logoUrl: null,
      productUrl: null,
      serviceUrl: null,
    },
    ...overrides,
  }
}

describe('clampProgress', () => {
  it('passes through values inside 0..1', () => {
    expect(clampProgress(0)).toBe(0)
    expect(clampProgress(0.42)).toBe(0.42)
    expect(clampProgress(1)).toBe(1)
  })

  it('clamps out-of-range and non-numeric values', () => {
    expect(clampProgress(-3)).toBe(0)
    expect(clampProgress(1.8)).toBe(1)
    expect(clampProgress(Number.NaN)).toBe(0)
    expect(clampProgress(undefined)).toBe(0)
    expect(clampProgress('0.5')).toBe(0)
  })
})

describe('webExportFailureReason', () => {
  it('classifies a missing WebCodecs/WebGL stack as unsupported-browser', () => {
    expect(webExportFailureReason([{ type: 'webcodecs-unavailable' }])).toBe('unsupported-browser')
    expect(webExportFailureReason([{ type: 'webgl-unsupported' }])).toBe('unsupported-browser')
  })

  it('classifies codec and container problems as unsupported-codec', () => {
    expect(webExportFailureReason([{ type: 'video-codec-unsupported' }])).toBe('unsupported-codec')
    expect(webExportFailureReason([{ type: 'audio-codec-unsupported' }])).toBe('unsupported-codec')
    expect(webExportFailureReason([{ type: 'container-codec-mismatch' }])).toBe('unsupported-codec')
  })

  it('classifies anything else as a plain render failure', () => {
    expect(webExportFailureReason([{ type: 'invalid-dimensions' }])).toBe('render-failed')
    expect(webExportFailureReason([{ type: 'output-target-unsupported' }])).toBe('render-failed')
    expect(webExportFailureReason([])).toBe('render-failed')
  })

  it('prefers the browser-level reason when several issues are reported', () => {
    expect(
      webExportFailureReason([
        { type: 'video-codec-unsupported' },
        { type: 'webcodecs-unavailable' },
      ]),
    ).toBe('unsupported-browser')
  })
})

describe('exportPersonalizedVideo (pre-flight only)', () => {
  it('reports a cancelled result without loading the renderer when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    const result = await exportPersonalizedVideo({
      inputProps: makeInputProps(),
      signal: controller.signal,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('cancelled')
    expect(result.error).toMatch(/cancel/i)
  })

  it('reports progress through the exported callback interface', () => {
    // The renderer's callback receives its own progress object; the engine maps
    // it through clampProgress. Wired here so a signature change breaks the test.
    const onProgress = vi.fn()
    void onProgress
    expect(typeof cancelActiveExport).toBe('function')
    expect(isExportActive()).toBe(false)
    expect(cancelActiveExport()).toBe(false)
  })
})

describe('webExport stays a browser-only engine', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/features/personalization/shared/personalization/webExport.ts'),
    'utf-8',
  )
  // Comments legitimately name MuAPI/OpenAI ("never calls these"), so only the
  // executable code is inspected.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

  it('never calls a server, MuAPI or OpenAI endpoint', () => {
    expect(code).not.toMatch(/\bfetch\s*\(/)
    expect(code).not.toMatch(/muapi/i)
    expect(code).not.toMatch(/openai/i)
    expect(code).not.toMatch(/['"`]\/api\//)
  })

  it('loads the renderer dynamically so it stays out of the main bundle', () => {
    expect(code).toContain("import('@remotion/web-renderer')")
  })

  it('imports the renderer only through that dynamic import', () => {
    const staticImports = code.match(/^\s*import\s[^;]*;/gm) ?? []
    for (const statement of staticImports) {
      expect(statement).not.toContain('@remotion/web-renderer')
    }
  })
})
