// @vitest-environment jsdom
/** Phase 7 — undo/redo of preview edits, and Add (keep my edits) vs Replace for designs, through the real provider. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import {
  cancelActiveExport, configureCapableBrowser, getCtx, openSource, renderProvider, resetRendererMocks, type HarnessRef,
} from './_createFinalVideoHarness'
import { listRemotionDesignTemplates } from '../templates'

beforeEach(() => {
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:x') as any
  URL.revokeObjectURL = vi.fn() as any
  resetRendererMocks(); configureCapableBrowser()
  vi.useFakeTimers({ toFake: ['Date'] })
})
afterEach(() => { vi.useRealTimers(); cancelActiveExport(); document.body.innerHTML = '' })

async function setup() {
  const ref: HarnessRef = { current: null }
  await renderProvider(ref)
  await openSource(ref)
  return ref
}
const headline = (ref: HarnessRef) => getCtx(ref).previewSettings.layers.find((l: any) => l.kind === 'headline')
const tick = (ms: number) => { vi.setSystemTime(Date.now() + ms) }

describe('undo / redo', () => {
  it('undo takes back a text edit, redo restores it, and a new edit clears redo', async () => {
    const ref = await setup()
    const id = headline(ref).id
    tick(1000)
    await act(async () => { getCtx(ref).updatePreviewLayer(id, { text: 'First' }) })
    tick(1000)
    await act(async () => { getCtx(ref).updatePreviewLayer(id, { text: 'Second' }) })
    expect(headline(ref).text).toBe('Second')
    expect(getCtx(ref).canUndoPreview).toBe(true)
    await act(async () => { getCtx(ref).undoPreview() })
    expect(headline(ref).text).toBe('First')
    expect(getCtx(ref).canRedoPreview).toBe(true)
    await act(async () => { getCtx(ref).redoPreview() })
    expect(headline(ref).text).toBe('Second')
    await act(async () => { getCtx(ref).undoPreview() })
    tick(1000)
    await act(async () => { getCtx(ref).updatePreviewLayer(id, { text: 'Third' }) })
    expect(getCtx(ref).canRedoPreview).toBe(false)
  })
  it('rapid changes (a drag) are one undo step', async () => {
    const ref = await setup()
    const id = headline(ref).id
    tick(1000)
    const x0 = headline(ref).x
    for (const x of [0.2, 0.25, 0.3, 0.35]) { tick(50); await act(async () => { getCtx(ref).updatePreviewLayer(id, { x }) }) }
    await act(async () => { getCtx(ref).undoPreview() })
    expect(headline(ref).x).toBeCloseTo(x0, 5)
  })
})

describe('Add vs Replace a design (state)', () => {
  it('Add keeps the layout layers (and their edits) and is undoable; Replace swaps them', async () => {
    const ref = await setup()
    const id = headline(ref).id
    tick(1000)
    await act(async () => { getCtx(ref).updatePreviewLayer(id, { text: 'Keep me' }) })
    const before = getCtx(ref).previewSettings.layers.length
    const design = listRemotionDesignTemplates()[0].id
    tick(1000)
    await act(async () => { getCtx(ref).addRemotionDesign(design) })
    expect(getCtx(ref).previewSettings.layers.length).toBe(before + 1)
    expect(headline(ref).text).toBe('Keep me')
    await act(async () => { getCtx(ref).undoPreview() })
    expect(getCtx(ref).previewSettings.layers.length).toBe(before)
    tick(1000)
    await act(async () => { getCtx(ref).setRemotionDesign(design) })
    expect(getCtx(ref).previewSettings.layers.length).toBe(1)
    await act(async () => { getCtx(ref).undoPreview() })
    expect(headline(ref).text).toBe('Keep me') // replacing a design is undoable too
  })
})
