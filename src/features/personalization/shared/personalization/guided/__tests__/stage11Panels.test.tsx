// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ResultsPanel } from '../ResultsPanel'
import { NotificationsPanel } from '../NotificationsPanel'
import { normalizeReport } from '../../report/reportModel'

beforeAll(() => {
  const read = (b: Blob) => new Promise<any>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsArrayBuffer(b) })
  if (!Blob.prototype.arrayBuffer) Blob.prototype.arrayBuffer = function (this: Blob) { return read(this) }
})
afterEach(cleanup)

const raw = (over: Record<string, any> = {}) => ({
  video: { id: 'abcdefgh12', title: 'Spring offer', published: true }, period: { from: '2026-10-15', to: '2026-11-13' },
  summary: { page_visits: 12, plays: 9, sessions: 8, unique_viewers: 5, sessions_without_viewer_id: 2, completed_sessions: 4, completion_rate: 0.5, watch_seconds: 300, avg_watch_seconds: 37, avg_percent_watched: 0.6, repeat_view_rate: null, new_sessions: 6, returning_sessions: 2, cta_clicks: 3, call_clicks: 0, overlay_clicks: 0, product_selects: 0, leads: 2, lead_conversion_rate: 0.25, cta_conversion_rate: 0.375, errors: 0 },
  daily: [{ day: '2026-11-12', page_visits: 5, plays: 4, unique_viewers: 3, completes: 2, cta_clicks: 1, leads: 1 }], retention: [], cta: [],
  recipients: [{ id: 'a', label: 'Acme', status: 'live', views: 2, plays: 2, completes: 1, cta_clicks: 1, leads: 1, last_seen: null }, { id: 'b', label: 'Bright', status: 'live', views: 0, plays: 0, completes: 0, cta_clicks: 0, leads: 0, last_seen: null }],
  generated_at: '2026-11-13T19:50:00Z', ...over,
})
const ok = (o = {}) => vi.fn(async () => ({ ok: true as const, report: normalizeReport(raw(o))! }))

describe('ResultsPanel', () => {
  it('needs a real video address, then shows defined figures, the recipient funnel and plain facts', async () => {
    const f = ok(); render(<ResultsPanel fetchReportFn={f as never} now={() => new Date('2026-11-13T12:00:00Z')} />)
    const input = screen.getByLabelText('Published video address for results'); fireEvent.change(input, { target: { value: 'not a video' } }); fireEvent.click(screen.getByRole('button', { name: 'Show results' }))
    expect(screen.getByTestId('results-note').textContent).toMatch(/does not look like/); expect(f).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'https://app.example.com/watch/abcdefgh12' } }); fireEvent.click(screen.getByRole('button', { name: 'Show results' }))
    await screen.findByTestId('results-report'); expect(f).toHaveBeenCalledWith('abcdefgh12', { from: '2026-10-15', to: '2026-11-13' })
    expect(screen.getByTestId('tile-visits').textContent).toMatch(/12/); expect(screen.getByTestId('tile-unique').textContent).toMatch(/2 visits had none/)
    expect(screen.getByTestId('results-funnel').textContent).toMatch(/Personal links made2 · 100%/); expect(screen.getByTestId('results-observations').textContent).toMatch(/1 of 2 personal links was opened/)
    expect(screen.getByTestId('results-recipients').textContent).toMatch(/AcmeTook action/)
  })
  it('explains failures and shows nothing stale', async () => {
    const f = vi.fn().mockResolvedValueOnce({ ok: true, report: normalizeReport(raw())! }).mockResolvedValueOnce({ ok: false, reason: 'not-found', message: 'That video was not found in your account.' })
    render(<ResultsPanel initialVideo="abcdefgh12" fetchReportFn={f as never} />); fireEvent.click(screen.getByRole('button', { name: 'Show results' })); await screen.findByTestId('results-report')
    fireEvent.click(screen.getByRole('button', { name: 'Show results' })); await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not found/)); expect(screen.queryByTestId('results-report')).toBeNull()
  })
  it('downloads a real PDF and spreadsheet-safe CSVs; warns about characters a PDF cannot show', async () => {
    const dl = vi.fn(); render(<ResultsPanel initialVideo="abcdefgh12" fetchReportFn={ok() as never} downloadFn={dl} />); fireEvent.click(screen.getByRole('button', { name: 'Show results' })); await screen.findByTestId('results-report')
    fireEvent.click(screen.getByRole('button', { name: 'Download report (.pdf)' })); expect(dl.mock.calls[0][0]).toBe('results-abcdefgh12-2026-11-13.pdf')
    const head = new TextDecoder().decode(new Uint8Array(await (dl.mock.calls[0][1] as Blob).arrayBuffer()).subarray(0, 8)); expect(head).toBe('%PDF-1.4'); expect(screen.getByTestId('results-note').textContent).toBe('Report downloaded.')
    fireEvent.click(screen.getByRole('button', { name: 'Recipients (.csv)' })); expect(dl.mock.calls[1][0]).toMatch(/-recipients\.csv$/)
    cleanup(); const cjk = ok({ recipients: [{ id: 'z', label: '你好', status: 'live', views: 1 }] }); render(<ResultsPanel initialVideo="abcdefgh12" fetchReportFn={cjk as never} downloadFn={dl} />); fireEvent.click(screen.getByRole('button', { name: 'Show results' })); await screen.findByTestId('results-report')
    fireEvent.click(screen.getByRole('button', { name: 'Download report (.pdf)' })); expect(screen.getByRole('alert').textContent).toMatch(/appear as "\?"/)
  })
  it('says so when there are no personal links or no visits', async () => {
    render(<ResultsPanel initialVideo="abcdefgh12" fetchReportFn={ok({ recipients: [], daily: [] }) as never} />); fireEvent.click(screen.getByRole('button', { name: 'Show results' })); await screen.findByTestId('results-report')
    expect(screen.getByTestId('results-report').textContent).toMatch(/No personal links have been made/); expect(screen.getByTestId('results-report').textContent).toMatch(/No visits were recorded/); expect((screen.getByRole('button', { name: 'Recipients (.csv)' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

const fakeEnv = (over: { permission?: NotificationPermission; info?: any; status?: number; push?: boolean } = {}) => {
  const info = over.info ?? { configured: true, publicKey: 'A'.repeat(87), devices: [] }
  const fetchFn = vi.fn(async (_u: string, init: any) => ((init?.method ?? 'GET') === 'GET' ? { status: over.status ?? 200, json: async () => info } : { status: 200, json: async () => ({ ok: true, sent: 1, note: 'The push service accepted the message.', devices: 1 }) }))
  const reg = { pushManager: { getSubscription: vi.fn(async () => null), subscribe: vi.fn(async () => ({ toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }), unsubscribe: vi.fn() })) } }
  const sw = { register: vi.fn(async () => reg), ready: Promise.resolve(reg), getRegistration: vi.fn(async () => reg) }
  const Notification = { permission: over.permission ?? 'default', requestPermission: vi.fn(async () => 'granted' as const) }
  return { env: { isSecureContext: true, navigator: { serviceWorker: sw as never, userAgent: 'Chrome' }, Notification: Notification as never, PushManager: over.push === false ? undefined : {}, fetchFn: fetchFn as never }, fetchFn, Notification }
}
describe('NotificationsPanel', () => {
  it('asks nothing of the server or the browser until opened', () => {
    const w = fakeEnv(); render(<NotificationsPanel env={w.env} />); expect(w.fetchFn).not.toHaveBeenCalled(); expect(w.Notification.requestPermission).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Set up notifications' })).toBeTruthy()
  })
  it('turn on prompts only on the click, then offers a test', async () => {
    const w = fakeEnv(); render(<NotificationsPanel env={w.env} />); fireEvent.click(screen.getByRole('button', { name: 'Set up notifications' })); await screen.findByTestId('notify-status'); expect(screen.getByTestId('notify-status').textContent).toMatch(/off in this browser/); expect(w.Notification.requestPermission).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' })); await waitFor(() => expect(w.Notification.requestPermission).toHaveBeenCalledTimes(1)); await waitFor(() => expect(screen.getByTestId('notify-message').textContent).toMatch(/Notifications are on/))
  })
  it('explains each dead end: unsupported, not configured, blocked, signed out, storage missing', async () => {
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'Set up notifications' }))
    let w = fakeEnv({ push: false }); render(<NotificationsPanel env={w.env} />); open(); await screen.findByTestId('notify-unsupported'); cleanup()
    w = fakeEnv({ info: { configured: false, publicKey: null, devices: [] } }); render(<NotificationsPanel env={w.env} />); open(); await screen.findByTestId('notify-not-configured'); cleanup()
    w = fakeEnv({ info: { configured: true, publicKey: 'A'.repeat(87), devices: [], storage: 'unavailable' } }); render(<NotificationsPanel env={w.env} />); open(); await screen.findByTestId('notify-no-storage'); cleanup()
    w = fakeEnv({ status: 401 }); render(<NotificationsPanel env={w.env} />); open(); expect((await screen.findByTestId('notify-problem')).textContent).toMatch(/Sign in/); cleanup()
    w = fakeEnv({ permission: 'denied' }); render(<NotificationsPanel env={w.env} />); open(); await screen.findByTestId('notify-status'); expect((screen.getByRole('button', { name: 'Turn on' }) as HTMLButtonElement).disabled).toBe(true); expect(screen.getByTestId('notifications-panel').textContent).toMatch(/site settings/)
  })
})
