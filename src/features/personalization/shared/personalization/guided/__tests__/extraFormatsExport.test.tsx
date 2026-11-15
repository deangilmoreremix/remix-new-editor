// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { createRoot } from 'react-dom/client'
import { ExtraFormatsExport } from '../ExtraFormatsExport'
import { createDefaultPreviewSettings } from '../../preview/presets'
import type { PreviewInputProps } from '../../preview/types'

const exportFormatsMock = vi.hoisted(() => vi.fn())
vi.mock('../../preview/exportFormats', async () => {
  const actual = await vi.importActual<typeof import('../../preview/exportFormats')>('../../preview/exportFormats')
  return { ...actual, exportFormats: exportFormatsMock }
})

// The real module pulls in the whole renderer; only the download helper is used here.
vi.mock('../../webExport', () => ({ downloadWebExportBlob: vi.fn(), cancelActiveExport: vi.fn() }))

beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true })
const mounted: { root: ReturnType<typeof createRoot>; el: HTMLElement }[] = []
function mount(props: Partial<React.ComponentProps<typeof ExtraFormatsExport>> = {}) {
  const el = document.createElement('div'); document.body.appendChild(el)
  const root = createRoot(el); mounted.push({ root, el })
  const inputProps = { settings: createDefaultPreviewSettings() } as PreviewInputProps
  act(() => { root.render(<ExtraFormatsExport inputProps={inputProps} {...props} />) })
  return el
}
afterEach(() => { for (const { root, el } of mounted.splice(0)) { act(() => root.unmount()); el.remove() }; exportFormatsMock.mockReset() })
const click = (el: Element | null) => act(async () => { (el as HTMLElement).click() })
const note = (el: HTMLElement) => vi.waitFor(() => { expect(el.querySelector('[data-testid="extra-formats-note"]')).toBeTruthy() }).then(() => el.querySelector('[data-testid="extra-formats-note"]')!.textContent)

describe('ExtraFormatsExport', () => {
  it('tells the person when the export throws, and lets them try again', async () => {
    exportFormatsMock.mockRejectedValue(new Error('renderer exploded'))
    const el = mount()
    await click(el.querySelector('[data-testid="extra-format-9x16"]'))
    await click(el.querySelector('[data-testid="extra-formats-run"]'))
    expect(await note(el)).toContain('Export failed: renderer exploded')
    expect((el.querySelector('[data-testid="extra-formats-run"]') as HTMLButtonElement).disabled).toBe(false)
    expect(el.querySelector('[data-testid="extra-formats-cancel"]')).toBeNull()
  })
  it('reports how many files were saved when it succeeds', async () => {
    exportFormatsMock.mockResolvedValue([{ aspect: '9:16', result: { ok: true } }])
    const el = mount()
    await click(el.querySelector('[data-testid="extra-format-9x16"]'))
    await click(el.querySelector('[data-testid="extra-formats-run"]'))
    expect(await note(el)).toContain('1 file saved')
  })
  it('does nothing until a shape is picked', async () => {
    const el = mount()
    expect((el.querySelector('[data-testid="extra-formats-run"]') as HTMLButtonElement).disabled).toBe(true)
    expect(exportFormatsMock).not.toHaveBeenCalled()
  })
})

describe('ExtraFormatsExport lifecycle', () => {
  it('tells the parent while it runs, so the main render can wait', async () => {
    let finish!: (v: unknown) => void
    exportFormatsMock.mockReturnValue(new Promise((r) => { finish = r }))
    const states: boolean[] = []
    const el = mount({ onRunningChange: (r) => states.push(r) })
    await click(el.querySelector('[data-testid="extra-format-9x16"]'))
    await click(el.querySelector('[data-testid="extra-formats-run"]'))
    expect(states[states.length - 1]).toBe(true)
    await act(async () => { finish([{ aspect: '9:16', result: { ok: true } }]) })
    expect(states[states.length - 1]).toBe(false)
  })
  it('stops the batch when the panel is removed mid-render', async () => {
    let signal: AbortSignal | undefined
    exportFormatsMock.mockImplementation((o: { signal: AbortSignal }) => { signal = o.signal; return new Promise(() => {}) })
    const el = mount()
    await click(el.querySelector('[data-testid="extra-format-9x16"]'))
    await click(el.querySelector('[data-testid="extra-formats-run"]'))
    expect(signal?.aborted).toBe(false)
    const m = mounted[mounted.length - 1]
    act(() => { m.root.unmount() })
    expect(signal?.aborted).toBe(true)
  })
})
