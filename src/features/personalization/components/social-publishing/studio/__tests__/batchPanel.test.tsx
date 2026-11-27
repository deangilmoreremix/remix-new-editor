import '@testing-library/jest-dom/vitest'
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { BatchPanel, type BatchRunners } from '../BatchPanel'

const downloads: string[] = []
vi.mock('@ohb/shared/social/exportNames', async (orig) => ({ ...(await orig<any>()), downloadBlob: (_b: Blob, name: string) => downloads.push(name) }))

const asset = { type: 'image' as const, url: 'https://cdn.example.com/a.png' }
const file = (name: string, type: string, size = 2000) => new File([new Uint8Array(size)], name, { type })
const addFiles = (...fs: File[]) => fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, { target: { files: fs } })
const ok = (type = 'image/jpeg') => ({ blob: new Blob(['out'], { type }) })

beforeEach(() => {
  downloads.length = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${Math.random()}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const runners = (over: Partial<BatchRunners> = {}): BatchRunners => ({ image: vi.fn(async () => ok()), video: vi.fn(async () => ok('video/mp4')), ...over })

describe('BatchPanel', () => {
  it('starts with the shapes your destinations recommend and counts the jobs (files × shapes)', () => {
    render(<BatchPanel asset={asset} platforms={['tiktok', 'youtube']} runners={runners()} />)
    expect(screen.getByLabelText(/Vertical 9:16/)).toBeChecked()
    expect(screen.getByLabelText(/Landscape 16:9/)).toBeChecked()
    expect(screen.getByLabelText(/Square 1:1/)).not.toBeChecked()
    addFiles(file('a.png', 'image/png'), file('b.jpg', 'image/jpeg'))
    expect(screen.getByText(/2 files × 2 shapes = 4 jobs/)).toBeInTheDocument()
  })

  it('rejects unsupported files with a reason and keeps the valid ones', () => {
    render(<BatchPanel asset={asset} platforms={[]} runners={runners()} />)
    addFiles(file('notes.pdf', 'application/pdf'), file('ok.png', 'image/png'))
    expect(screen.getByRole('alert')).toHaveTextContent(/notes\.pdf.*isn't supported/)
    expect(screen.getByText(/1 file × 1 shape = 1 jobs/)).toBeInTheDocument()
  })

  it('prepares every job, reports progress, and offers each result for download or use as the post media', async () => {
    const r = runners(); const onReplace = vi.fn()
    render(<BatchPanel asset={asset} platforms={['instagram']} runners={r} onReplaceAsset={onReplace} concurrency={2} />)
    addFiles(file('Launch.png', 'image/png'), file('Two.png', 'image/png'))
    fireEvent.click(screen.getByRole('button', { name: /Prepare 2 files/ }))
    await waitFor(() => expect(screen.getByText(/2 of 2 done/)).toBeInTheDocument())
    expect(r.image).toHaveBeenCalledTimes(2)
    const params = (r.image as any).mock.calls[0][1]
    expect(params).toMatchObject({ aspect: '9:16', mode: 'fill', longEdge: 1920, mime: 'image/jpeg' })
    const row = screen.getByText(/Launch\.png →/).closest('li') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Download' }))
    expect(downloads[0]).toMatch(/^launch_9x16_.*\.jpg$/)
    fireEvent.click(within(row).getByRole('button', { name: 'Use as post media' }))
    expect(onReplace).toHaveBeenCalledWith(expect.objectContaining({ type: 'image', url: expect.stringMatching(/^blob:/) }))
  })

  it('reports failed jobs without stopping the others, then retries only the failed ones', async () => {
    let fail = true
    const r = runners({ image: vi.fn(async (b: Blob) => { if (fail && (b as File).name === 'bad.png') throw new Error('This image could not be decoded'); return ok() }) as any })
    render(<BatchPanel asset={asset} platforms={['instagram']} runners={r} concurrency={2} />)
    addFiles(file('good.png', 'image/png'), file('bad.png', 'image/png'))
    fireEvent.click(screen.getByRole('button', { name: /Prepare 2 files/ }))
    await waitFor(() => expect(screen.getByText(/1 of 2 done · 1 failed/)).toBeInTheDocument())
    expect(screen.getByRole('alert', { name: '' })).toHaveTextContent(/could not be decoded.*unchanged/)
    fail = false
    ;(r.image as any).mockClear()
    fireEvent.click(screen.getByRole('button', { name: /Retry 1 not finished/ }))
    await waitFor(() => expect(screen.getByText(/2 of 2 done/)).toBeInTheDocument())
    expect(r.image).toHaveBeenCalledTimes(1) // only the failed file ran again
    expect(((r.image as any).mock.calls[0][0] as File).name).toBe('bad.png')
  })

  it('cancels a running batch, keeps finished results, and offers to finish the rest', async () => {
    let release!: () => void
    const gate = new Promise<void>((res) => { release = res })
    const r = runners({ image: vi.fn((b: Blob, _p: any, signal: AbortSignal) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })))
      void gate.then(() => resolve(ok()))
    })) as any })
    render(<BatchPanel asset={asset} platforms={['instagram']} runners={r} concurrency={1} />)
    addFiles(file('a.png', 'image/png'), file('b.png', 'image/png'))
    fireEvent.click(screen.getByRole('button', { name: /Prepare 2 files/ }))
    await waitFor(() => expect(r.image).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel all' }))
    await waitFor(() => expect(screen.getByText(/2 cancelled/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Retry 2 not finished/ })).toBeInTheDocument()
    release()
  })

  it('encodes videos one at a time even when images may run in parallel', async () => {
    let running = 0, peak = 0
    const r = runners({ video: vi.fn(async () => { running++; peak = Math.max(peak, running); await new Promise((res) => setTimeout(res, 10)); running--; return ok('video/mp4') }) as any })
    render(<BatchPanel asset={{ type: 'video', url: 'https://cdn.example.com/a.mp4' }} platforms={['tiktok']} runners={r} concurrency={3} />)
    addFiles(file('1.mp4', 'video/mp4'), file('2.mp4', 'video/mp4'), file('3.mp4', 'video/mp4'))
    fireEvent.click(screen.getByRole('button', { name: /Prepare 3 files/ }))
    await waitFor(() => expect(screen.getByText(/3 of 3 done/)).toBeInTheDocument())
    expect(peak).toBe(1)
    expect((r.video as any).mock.calls[0][0]).toMatchObject({ aspect: '9:16', preset: 'balanced' })
  })

  it('"Download all" saves every result, and Clear / closing the panel releases the object URLs', async () => {
    const r = runners()
    const { unmount } = render(<BatchPanel asset={asset} platforms={['instagram']} runners={r} concurrency={2} />)
    addFiles(file('a.png', 'image/png'), file('b.png', 'image/png'))
    fireEvent.click(screen.getByRole('button', { name: /Prepare 2 files/ }))
    await waitFor(() => expect(screen.getByText(/2 of 2 done/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Download all (2)' }))
    await waitFor(() => expect(downloads).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect((URL.revokeObjectURL as any).mock.calls.length).toBe(2)
    expect(screen.queryByText(/of 2 done/)).toBeNull()
    unmount()
  })

  it('says plainly when this browser cannot use background workers', () => {
    const g = globalThis as any
    const had = g.OffscreenCanvas; delete g.OffscreenCanvas
    render(<BatchPanel asset={asset} platforms={[]} runners={runners()} />)
    expect(screen.getByText(/on the main thread/)).toBeInTheDocument()
    if (had) g.OffscreenCanvas = had
  })
})
