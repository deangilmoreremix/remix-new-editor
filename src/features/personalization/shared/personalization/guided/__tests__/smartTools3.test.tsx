// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createDefaultPreviewSettings } from '../../preview/presets'

const ctx: Record<string, unknown> = {}
vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ctx }))
const audio = vi.hoisted(() => ({ decodeMediaAudio: vi.fn() }))
vi.mock('../../intelligence/audioIntel', async () => ({ ...(await vi.importActual<object>('../../intelligence/audioIntel')), ...audio }))
const proc = vi.hoisted(() => ({ renderVoiceClarity: vi.fn() }))
vi.mock('../../intelligence/audioProcess', async () => ({ ...(await vi.importActual<object>('../../intelligence/audioProcess')), ...proc }))
import { OnDeviceAI, ProtectedZonesEditor, VoiceClarityControls } from '../SmartTools'

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; URL.createObjectURL = vi.fn(() => 'blob:clear'); URL.revokeObjectURL = vi.fn() })
afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); delete (globalThis as { LanguageModel?: unknown }).LanguageModel })
const mount = (node: React.JSX.Element) => { const el = document.createElement('div'); document.body.appendChild(el); act(() => { createRoot(el).render(node) }); return el }
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 20)) }) }
const click = (el: Element | null) => act(() => { (el as HTMLElement).click() })

describe('VoiceClarityControls', () => {
  const setup = (over: object = {}) => {
    const updatePreviewComposition = vi.fn()
    Object.assign(ctx, { previewSettings: { ...createDefaultPreviewSettings(), videoMuted: false, audioTracks: [], ...over }, updatePreviewComposition })
    audio.decodeMediaAudio.mockResolvedValue({ samples: new Float32Array(100), sampleRate: 8000 })
    proc.renderVoiceClarity.mockResolvedValue({ samples: new Float32Array(100), sampleRate: 8000, gainDb: 3.5 })
    return { updatePreviewComposition, el: mount(<VoiceClarityControls url="blob:v" advanced />) }
  }
  it('adds a processed voice track, mutes the original in the mix, and undo restores both', async () => {
    const { el, updatePreviewComposition } = setup()
    click(el.querySelector('[data-testid="voice-apply"]')); await flush()
    const patch = updatePreviewComposition.mock.calls[0]![0]
    expect(patch.videoMuted).toBe(true)
    expect(patch.audioTracks).toHaveLength(1)
    expect(patch.audioTracks[0]).toMatchObject({ name: 'Clearer voice', kind: 'voiceover', url: 'blob:clear' })
    expect(el.querySelector('[data-testid="voice-note"]')!.textContent).toMatch(/\+3.5 dB/)
    ctx.previewSettings = { ...(ctx.previewSettings as object), audioTracks: patch.audioTracks, videoMuted: true }
    click(el.querySelector('[data-testid="voice-undo"]'))
    expect(updatePreviewComposition).toHaveBeenLastCalledWith({ audioTracks: [], videoMuted: undefined })
  })
  it('reports unreadable audio instead of a fake success', async () => {
    const { el, updatePreviewComposition } = setup()
    audio.decodeMediaAudio.mockResolvedValue(null)
    click(el.querySelector('[data-testid="voice-apply"]')); await flush()
    expect(updatePreviewComposition).not.toHaveBeenCalled()
    expect(el.querySelector('[data-testid="smart-job-error"]')!.textContent).toMatch(/could not be read/)
  })
  it('refuses when the mix is full', async () => {
    const full = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, url: 'u', name: 'n', kind: 'music', volume: 1, fadeIn: 0, fadeOut: 0, start: 0, trimStart: 0, muted: false }))
    const { el, updatePreviewComposition } = setup({ audioTracks: full })
    click(el.querySelector('[data-testid="voice-apply"]')); await flush()
    expect(updatePreviewComposition).not.toHaveBeenCalled()
    expect(el.querySelector('[data-testid="smart-job-error"]')!.textContent).toMatch(/full/)
  })
})

describe('ProtectedZonesEditor', () => {
  it('adds, edits and removes zones', () => {
    const setZones = vi.fn()
    Object.assign(ctx, { previewSettings: { ...createDefaultPreviewSettings(), protectedZones: [{ id: 'z1', label: 'Presenter', source: 'user', x: 0.1, y: 0.1, w: 0.3, h: 0.5 }] }, setPreviewProtectedZones: setZones })
    const el = mount(<ProtectedZonesEditor />)
    expect(el.querySelectorAll('[data-testid="zone-row"]').length).toBe(1)
    click(el.querySelector('[data-testid="zone-remove"]'))
    expect(setZones).toHaveBeenLastCalledWith([])
    click(el.querySelector('[data-testid="zone-add"]'))
    expect(setZones.mock.calls.at(-1)![0]).toHaveLength(2)
    const w = el.querySelector('[data-testid="zone-w"]') as HTMLInputElement
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(w, '0.5'); w.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(setZones.mock.calls.at(-1)![0][0]).toMatchObject({ id: 'z1', w: 0.5 })
  })
})

describe('OnDeviceAI', () => {
  const facts = { businessName: 'Sunny Dental', industry: 'Dentist' }
  it('says so and calls nothing when the browser has no built-in AI', async () => {
    const el = mount(<OnDeviceAI facts={facts} onPick={vi.fn()} />); await flush()
    expect(el.querySelector('[data-testid="ondevice-ai"]')!.textContent).toMatch(/no built-in on-device AI/)
    expect(el.querySelector('[data-testid="ai-headline"]')).toBeNull()
  })
  it('asks before a model download, filters ungrounded lines, and applies only on click', async () => {
    const create = vi.fn(async () => ({ prompt: async () => 'Smiles made simple\n50% off cleanings', destroy: vi.fn() }))
    ;(globalThis as { LanguageModel?: unknown }).LanguageModel = { availability: async () => 'downloadable', create }
    const onPick = vi.fn()
    const el = mount(<OnDeviceAI facts={facts} onPick={onPick} />); await flush()
    click(el.querySelector('[data-testid="ai-headline"]'))
    expect(create).not.toHaveBeenCalled()
    expect(el.querySelector('[data-testid="ai-consent"]')).not.toBeNull()
    click(el.querySelector('[data-testid="ai-consent-yes"]')); await flush()
    expect([...el.querySelectorAll('[data-testid="ai-line"]')].map((b) => b.textContent)).toEqual(['Smiles made simple'])
    expect(el.textContent).toMatch(/1 suggestion was dropped/)
    expect(onPick).not.toHaveBeenCalled()
    click(el.querySelector('[data-testid="ai-line"]'))
    expect(onPick).toHaveBeenCalledWith('ctaHeadline', 'Smiles made simple', 'headline')
  })
})
