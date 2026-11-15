// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useSubjectFinder, type SubjectFinder } from '../useSubjectFinder'
import { createDefaultPreviewSettings } from '../../preview/presets'
import type { ProtectedZone } from '../../preview/types'

const engine = vi.hoisted(() => ({ isModelCached: vi.fn(), modelInfo: vi.fn(), cancelLocalAI: vi.fn(), grabFramePixels: vi.fn(), detectObjects: vi.fn() }))
vi.mock('../../localAI/engine', () => engine)

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
beforeEach(() => {
  engine.modelInfo.mockResolvedValue({ key: 'detr', label: 'Object detection', feature: 'x', sizeMB: 45, license: 'Apache-2.0' })
  engine.isModelCached.mockResolvedValue(true)
  engine.grabFramePixels.mockResolvedValue({ width: 1920, height: 1080, data: new Uint8ClampedArray(4) })
  engine.detectObjects.mockResolvedValue([{ label: 'person', score: 0.9, box: { xmin: 0.3, ymin: 0.2, xmax: 0.5, ymax: 0.8 } }])
})
afterEach(() => { vi.clearAllMocks(); document.body.innerHTML = '' })

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 5)) })
function mount(zones: ProtectedZone[] = [], over: { videoUrl?: string | null } = {}) {
  const setZones = vi.fn()
  const settings = { ...createDefaultPreviewSettings(), protectedZones: zones }
  const ref: { current: SubjectFinder | null } = { current: null }
  const Probe = () => { ref.current = useSubjectFinder({ settings, videoUrl: over.videoUrl === undefined ? 'https://x/clip.mp4' : over.videoUrl, isImageSource: false, setZones }); return null }
  act(() => { createRoot(document.body.appendChild(document.createElement('div'))).render(<Probe />) })
  return { ref, setZones }
}
const zone = (id: string): ProtectedZone => ({ id, label: id, source: 'user', x: 0, y: 0, w: 0.2, h: 0.2 })

describe('useSubjectFinder', () => {
  it('sets a protected zone from what it found and says what it found', async () => {
    const { ref, setZones } = mount()
    await act(async () => { void ref.current!.find() }); await flush()
    expect(engine.detectObjects).toHaveBeenCalled()
    expect(setZones).toHaveBeenCalledTimes(1)
    const zones = setZones.mock.calls[0][0] as ProtectedZone[]
    expect(zones).toHaveLength(1)
    expect(zones[0]).toMatchObject({ id: 'auto-subject', source: 'user' })
    expect(ref.current!.message).toMatch(/Found a person/)
  })
  it('replaces only its own earlier zone and keeps every other zone', async () => {
    const { ref, setZones } = mount([zone('auto-subject'), zone('template-zone')])
    await act(async () => { void ref.current!.find() }); await flush()
    const ids = (setZones.mock.calls[0][0] as ProtectedZone[]).map((z) => z.id)
    expect(ids).toEqual(['template-zone', 'auto-subject'])
  })
  it('never runs over a subject the customer marked by hand', async () => {
    const { ref, setZones } = mount([zone('customer-subject')])
    expect(ref.current!.hasCustomerMark).toBe(true)
    await act(async () => { void ref.current!.find() }); await flush()
    expect(engine.detectObjects).not.toHaveBeenCalled()
    expect(setZones).not.toHaveBeenCalled()
  })
  it('explains when nothing clear was found and leaves the zones alone', async () => {
    engine.detectObjects.mockResolvedValue([])
    const { ref, setZones } = mount()
    await act(async () => { void ref.current!.find() }); await flush()
    expect(setZones).not.toHaveBeenCalled()
    expect(ref.current!.message).toMatch(/No clear person/)
  })
  it('explains when the footage cannot be read', async () => {
    engine.grabFramePixels.mockRejectedValue(new Error('tainted canvas'))
    const { ref, setZones } = mount()
    await act(async () => { void ref.current!.find() }); await flush()
    expect(setZones).not.toHaveBeenCalled()
    expect(ref.current!.message).toMatch(/could not be read/)
  })
  it('does nothing without footage, and clears only the automatic zone', async () => {
    const none = mount([], { videoUrl: null })
    await act(async () => { void none.ref.current!.find() }); await flush()
    expect(engine.isModelCached).not.toHaveBeenCalled()
    const { ref, setZones } = mount([zone('auto-subject'), zone('template-zone')])
    expect(ref.current!.hasAuto).toBe(true)
    act(() => { ref.current!.clear() })
    expect((setZones.mock.calls[0][0] as ProtectedZone[]).map((z) => z.id)).toEqual(['template-zone'])
  })
})
