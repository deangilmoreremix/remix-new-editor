import '@testing-library/jest-dom/vitest'
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'
import { SocialStudioPanel, derivePlanStatus } from '../SocialStudioPanel'
import type { CopyState, Destination, PublishResult } from '../../types'

const baseCopy = (master = ''): CopyState => ({ master, platforms: {}, variants: [], title: 'My Reel' })
const dest = (o: Partial<Destination> = {}): Destination => ({ id: 'd1', platform: 'x', accountId: '7', enabled: true, ...o })

function setup(over: Partial<React.ComponentProps<typeof SocialStudioPanel>> = {}) {
  const props: React.ComponentProps<typeof SocialStudioPanel> = {
    asset: { type: 'video', url: 'https://cdn.example.com/a.mp4' },
    copy: baseCopy('Training for a marathon this spring'),
    writeCopy: baseCopy('Training for a marathon this spring'),
    socialCopy: baseCopy(),
    thumbnail: {},
    destinations: [dest()],
    publishResults: [],
    onUpdateWriteCopy: vi.fn(),
    onUpdateThumbnail: vi.fn(),
    onReplaceAsset: vi.fn(),
    onRestoreDraft: vi.fn(),
    onRetry: vi.fn(),
    ...over,
  }
  return { props, ...render(<SocialStudioPanel {...props}><div>EXISTING PREVIEW</div></SocialStudioPanel>) }
}
const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name: new RegExp(name) }))

afterEach(() => { cleanup(); vi.restoreAllMocks(); delete (globalThis as any).LanguageModel })

describe('SocialStudioPanel', () => {
  it('keeps the existing preview as the default tab', () => {
    setup()
    expect(screen.getByText('EXISTING PREVIEW')).toBeVisible()
  })

  it('shows blocking errors vs optional warnings in Optimize without hiding valid posts', () => {
    setup({ writeCopy: baseCopy('a'.repeat(300)), copy: baseCopy('a'.repeat(300)) })
    tab('Optimize')
    expect(screen.getByText(/X caption is 300\/280/)).toBeInTheDocument()
    expect(screen.getByText(/Fix the errors to publish/)).toBeInTheDocument()
  })

  it('only warns (never blocks) when the post is valid but could be better', () => {
    setup()
    tab('Optimize')
    expect(screen.getByText(/no captions\/subtitles/i)).toBeInTheDocument()
    expect(screen.getByText(/Nothing blocks publishing/)).toBeInTheDocument()
  })

  it('platform previews warn on aspect ratio and show per-platform counters', async () => {
    setup({ destinations: [dest({ platform: 'tiktok' })], copy: baseCopy('hello tiktok'), writeCopy: baseCopy('hello tiktok') })
    tab('Platforms')
    expect(screen.getByText('TikTok')).toBeInTheDocument()
    expect(screen.getByText(/Recommended: 9:16/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Safe-area guides/)).toBeInTheDocument()
  })

  it('unsupported browser AI: shows unavailable state and a clearly labelled fallback, original untouched until accepted', async () => {
    const onUpdate = vi.fn()
    setup({ onUpdateWriteCopy: onUpdate })
    tab('Optimize')
    fireEvent.change(screen.getByLabelText('Tone'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rewrite' }))
    expect(await screen.findByText(/basic, on-device rules/)).toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled() // nothing replaced yet
    fireEvent.click(screen.getByRole('button', { name: 'Replace caption' }))
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ edited: { master: true } }))
    expect(screen.getByText(/Translation isn't available/)).toBeInTheDocument()
  })

  it('never downloads a model without consent', async () => {
    const create = vi.fn()
    ;(globalThis as any).LanguageModel = { availability: async () => 'downloadable', create }
    setup()
    tab('Optimize')
    fireEvent.click(screen.getByRole('button', { name: 'Rewrite' }))
    expect(await screen.findByRole('button', { name: /Download on-device model/ })).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('autosaves a draft locally and lists it; duplicating never copies publish state', async () => {
    setup({ publishResults: [{ platform: 'x', accountId: '7', status: 'published', requestId: 'req-1' } as PublishResult] })
    tab('Plan')
    await waitFor(() => expect(screen.getByText(/Saved/)).toBeInTheDocument(), { timeout: 4000 })
    expect(await screen.findByText(/current/)).toBeInTheDocument()
    expect(screen.getAllByText('Published').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
    expect(await screen.findByText(/Duplicated as a new draft/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText(/\(copy\)/)).toHaveLength(1))
    expect(screen.getAllByText('Drafts').length).toBeGreaterThan(0)
  })

  it('rejects a past schedule with an actionable message', async () => {
    setup()
    tab('Plan')
    const input = screen.getByLabelText(/Date & time/)
    fireEvent.change(input, { target: { value: '2001-01-01T10:00' } })
    expect(await screen.findByText(/scheduled time is in the past/)).toBeInTheDocument()
  })

  it('explains notification denial/unsupported states instead of failing silently', () => {
    setup()
    tab('Plan')
    expect(screen.getByText(/doesn't support notifications/)).toBeInTheDocument()
  })

  it('surfaces failed publishes with Retry / Check again controls wired to the existing handler', async () => {
    const onRetry = vi.fn()
    setup({ onRetry, publishResults: [{ platform: 'x', accountId: '7', status: 'failed', error: 'boom', requestId: '' }, { platform: 'instagram', accountId: '9', status: 'failed', error: 'later', requestId: 'req-9' }] })
    tab('Plan')
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledWith('x', '7')
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
  })

  it('media library rejects unsupported files and accepts valid ones (drag/drop and input)', async () => {
    setup({ asset: { type: 'image', url: 'https://cdn.example.com/a.png' } })
    tab('Media')
    const input = document.querySelector('input[type=file][multiple]') as HTMLInputElement
    const bad = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
    const good = new File(['x'], 'pic.png', { type: 'image/png' })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pic')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    await act(async () => { fireEvent.change(input, { target: { files: [bad, good] } }) })
    expect(screen.getByText(/doc\.pdf: .*isn't supported/)).toBeInTheDocument()
    expect(screen.getByText(/pic\.png/)).toBeInTheDocument()
  })

  it('releases object URLs when the studio closes (resource cleanup)', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pic')
    const { unmount } = setup({ asset: { type: 'image', url: 'https://cdn.example.com/a.png' } })
    tab('Media')
    const input = document.querySelector('input[type=file][multiple]') as HTMLInputElement
    await act(async () => { fireEvent.change(input, { target: { files: [new File(['x'], 'p.png', { type: 'image/png' })] } }) })
    unmount()
    expect(revoke).toHaveBeenCalledWith('blob:pic')
  })
})

describe('derivePlanStatus (reuses the real publish statuses)', () => {
  const d = [dest()]
  const r = (status: PublishResult['status']): PublishResult => ({ platform: 'x', accountId: '7', status })
  it('maps results onto plan statuses', () => {
    expect(derivePlanStatus(d, [])).toBe('draft')
    expect(derivePlanStatus(d, [r('queued')])).toBe('queued')
    expect(derivePlanStatus(d, [r('processing')])).toBe('processing')
    expect(derivePlanStatus(d, [r('uploading')])).toBe('processing')
    expect(derivePlanStatus(d, [r('failed')])).toBe('failed')
    expect(derivePlanStatus(d, [r('published')])).toBe('published')
    expect(derivePlanStatus([], [r('published')])).toBe('draft')
  })
})
