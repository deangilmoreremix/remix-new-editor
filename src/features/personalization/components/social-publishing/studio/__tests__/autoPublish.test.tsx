import '@testing-library/jest-dom/vitest'
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const api = vi.hoisted(() => ({
  ready: true, jobs: [] as any[],
  status: vi.fn(), enable: vi.fn(), disable: vi.fn(), schedule: vi.fn(), cancel: vi.fn(), retry: vi.fn(), reschedule: vi.fn(),
}))
vi.mock('../../../../../../lib/social/publishJobs.js', () => ({
  cloudReady: () => api.ready, listJobs: async () => api.jobs, autoPublishStatus: api.status, enableAutoPublish: api.enable,
  disableAutoPublish: api.disable, scheduleJob: api.schedule, cancelJob: api.cancel, retryJob: api.retry, rescheduleJob: api.reschedule,
  describeResult: (r: any) => (r.status === 'published' ? `Published · ${r.url}` : r.error || r.status),
}))
import { AutoPublishPanel, useCloudJobs, type PreparedSchedule } from '../AutoPublishPanel'
import { SocialStudioPanel } from '../SocialStudioPanel'

const prepared = (o: Partial<PreparedSchedule> = {}): PreparedSchedule => ({ jobs: [{ platform: 'instagram', account_id: 5, payload: { a: 1 } }], mediaUrl: 'https://cdn/a.mp4', mediaType: 'video', caption: 'hi', hashtags: [], errors: [], notes: [], ...o })
const FUTURE = Date.now() + 3 * 3600_000
const job = (o: any = {}) => ({ id: 'j1', job_key: 'k', status: 'scheduled', scheduled_for: new Date(FUTURE).toISOString(), time_zone: 'UTC', platforms: ['instagram'], caption: 'Launch day', media_url: 'https://cdn/a.mp4', results: [], attempts: 0, max_attempts: 3, last_error: null, published_at: null, ...o })

function Host(p: Partial<React.ComponentProps<typeof AutoPublishPanel>> & { prepare?: (at: number) => Promise<PreparedSchedule> }) {
  const cloud = useCloudJobs(true)
  return <AutoPublishPanel apiKey="muapi-key-0123456789" scheduledAt={FUTURE} timeZone="UTC" canPrepare onPrepare={p.prepare ?? (async () => prepared())} jobs={cloud.jobs} jobsError={cloud.error} reload={cloud.reload} {...p} />
}
beforeEach(() => { api.ready = true; api.jobs = []; Object.values(api).forEach((f: any) => f?.mockReset?.()); api.status.mockResolvedValue({ enabled: false, available: true }); api.enable.mockResolvedValue({ enabled: true }); api.schedule.mockResolvedValue({ id: 'j1' }); api.cancel.mockResolvedValue(undefined); api.retry.mockResolvedValue(undefined); api.disable.mockResolvedValue({ enabled: false }) })
afterEach(cleanup)

describe('Automatic publishing panel', () => {
  it('signed out: says jobs are never browser-only and offers nothing to schedule', () => {
    api.ready = false
    render(<Host />)
    expect(screen.getByText(/never only in this browser/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Publish automatically/ })).toBeNull()
  })

  it('explains when the server is not configured', async () => {
    api.status.mockResolvedValue({ enabled: false, available: false })
    render(<Host />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/isn't set up on the server/)
  })

  it('needs explicit consent before storing the key, then turns on', async () => {
    render(<Host />)
    const on = await screen.findByRole('button', { name: 'Turn on' })
    expect(on).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(on)
    await waitFor(() => expect(api.enable).toHaveBeenCalledWith('muapi-key-0123456789'))
    expect(await screen.findByText(/stored encrypted on the server/)).toBeInTheDocument()
  })

  it('schedules a prepared job in UTC time and confirms it will run with the browser closed', async () => {
    api.status.mockResolvedValue({ enabled: true, available: true })
    render(<Host />)
    fireEvent.click(await screen.findByRole('button', { name: /Publish automatically/ }))
    await waitFor(() => expect(api.schedule).toHaveBeenCalled())
    const arg = api.schedule.mock.calls[0][0]
    expect(arg.scheduledFor).toEqual(new Date(FUTURE))
    expect(arg.jobs[0]).toMatchObject({ platform: 'instagram', account_id: 5 })
    expect(await screen.findByText(/even if you close this page/)).toBeInTheDocument()
  })

  it('blocks scheduling and shows the reasons when a destination is invalid', async () => {
    api.status.mockResolvedValue({ enabled: true, available: true })
    render(<Host prepare={async () => prepared({ errors: ['X: The X post is 300 characters; the limit is 280.'] })} />)
    fireEvent.click(await screen.findByRole('button', { name: /Publish automatically/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/limit is 280/)
    expect(api.schedule).not.toHaveBeenCalled()
  })

  it('tells the panel the chosen time so the modal can refuse temporary-link media that is too far ahead', async () => {
    api.status.mockResolvedValue({ enabled: true, available: true })
    const prepare = vi.fn(async () => { throw new Error('This file is only on this device, so it has to be uploaded to a link that expires in about an hour.') })
    render(<Host prepare={prepare as any} />)
    fireEvent.click(await screen.findByRole('button', { name: /Publish automatically/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/expires in about an hour/)
    expect(prepare).toHaveBeenCalledWith(FUTURE)
    expect(api.schedule).not.toHaveBeenCalled()
  })

  it('shows a server rejection (e.g. offline cloud) instead of pretending it was saved', async () => {
    api.status.mockResolvedValue({ enabled: true, available: true })
    api.schedule.mockRejectedValue(new Error('Could not save the job. Nothing was scheduled.'))
    render(<Host />)
    fireEvent.click(await screen.findByRole('button', { name: /Publish automatically/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Nothing was scheduled/)
  })

  it('history shows real results, post links and failures, with cancel / retry', async () => {
    api.status.mockResolvedValue({ enabled: true, available: true })
    api.jobs = [
      job({ id: 'a', status: 'posted', results: [{ platform: 'instagram', account_id: 5, status: 'published', url: 'https://instagram.com/p/1' }] }),
      job({ id: 'b', status: 'failed', results: [{ platform: 'instagram', account_id: 5, status: 'failed', error: 'This account is not connected any more.' }] }),
      job({ id: 'c', status: 'scheduled', attempts: 1, last_error: 'MuAPI is rate limiting requests.' }),
    ]
    render(<Host />)
    expect(await screen.findByText(/Published · https:\/\/instagram.com\/p\/1/)).toBeInTheDocument()
    expect(screen.getByText(/not connected any more/)).toBeInTheDocument()
    expect(screen.getByText(/Retry 1\/3 pending/)).toBeInTheDocument()
    expect(screen.getByText(/doesn't provide them/)).toBeInTheDocument() // no invented analytics
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(api.retry).toHaveBeenCalledWith('b'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith('c'))
  })

  it('turning it off deletes the stored key', async () => {
    api.status.mockResolvedValue({ enabled: true, available: true })
    render(<Host />)
    fireEvent.click(await screen.findByRole('button', { name: /Turn off/ }))
    await waitFor(() => expect(api.disable).toHaveBeenCalled())
    expect(await screen.findByText(/stored key was deleted/)).toBeInTheDocument()
  })
})

describe('server jobs on the calendar', () => {
  it('appear in the Plan tab calendar and queue counts, and can be rescheduled by drag', async () => {
    api.status.mockResolvedValue({ enabled: true, available: true })
    api.jobs = [job({ id: 'z', status: 'scheduled' })]
    api.reschedule.mockResolvedValue(undefined)
    const copy: any = { master: 'hello', platforms: {}, variants: [], title: 'T' }
    render(<SocialStudioPanel asset={{ type: 'video', url: 'https://cdn/a.mp4' }} copy={copy} writeCopy={copy} socialCopy={copy} thumbnail={{}} destinations={[]} publishResults={[]} onUpdateWriteCopy={vi.fn()} onUpdateThumbnail={vi.fn()} apiKey="k" />)
    fireEvent.click(screen.getByRole('tab', { name: /Plan/ }))
    expect(await screen.findByText(/Launch day/, { selector: 'div[draggable]' })).toBeInTheDocument()
  })
})
