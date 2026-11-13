// @vitest-environment jsdom
/**
 * Stage 8 — the Personal links panel with a fake server: make links (shown once, copy/CSV), the list with counts and status,
 * revoke, every failure message, and that nothing recoverable about a link is kept after "I have saved them".
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RecipientLinksPanel } from '../RecipientLinksPanel'
import { generateRecipientToken } from '../../publish/recipientToken'

const VID = 'vidAAAAAAAA'
const row = (over: Record<string, unknown> = {}) => ({ id: 'id-1', label: 'Acme', createdAt: '2026-01-01T00:00:00Z', expiresAt: null, revokedAt: null, status: 'live', views: 2, plays: 1, completes: 0, ctaClicks: 1, leads: 1, lastSeen: '2026-01-02T00:00:00Z', ...over })
function server(over: { list?: unknown[]; post?: (b: any) => { status: number; json: unknown }; del?: number } = {}) {
  const state = { list: over.list ?? [row()] }
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (method === 'GET') return { status: 200, json: async () => ({ ok: true, links: state.list }) }
    if (method === 'POST') { const b = JSON.parse(String(init!.body)); const r = over.post ? over.post(b) : { status: 200, json: { ok: true, links: b.labels.map((l: string, i: number) => ({ id: `n${i}`, label: l, token: generateRecipientToken(), url: 'ignored' })) } }; return { status: r.status, json: async () => r.json } }
    return { status: over.del ?? 200, json: async () => ({ ok: true }) }
  })
  return Object.assign(fn as unknown as typeof fetch, { raw: fn })
}
const typeVideo = (v: string) => fireEvent.change(screen.getByLabelText('Published video address'), { target: { value: v } })
const typeNames = (v: string) => fireEvent.change(screen.getByLabelText('Recipient names'), { target: { value: v } })
afterEach(cleanup)

describe('RecipientLinksPanel', () => {
  it('nothing can be made until there is a real video address and at least one name', () => {
    render(<RecipientLinksPanel fetchFn={server()} />); const btn = () => screen.getByRole('button', { name: /^Make/ }) as HTMLButtonElement
    expect(btn().disabled).toBe(true); typeVideo('not a video'); expect(screen.getByText(/does not look like a video address/)).toBeTruthy(); typeNames('Acme'); expect(btn().disabled).toBe(true)
    typeVideo(`https://app.example.com/watch/${VID}`); expect(btn().disabled).toBe(false); typeNames('   '); expect(btn().disabled).toBe(true)
  })
  it('says nothing about an empty box or blank lines; shows what will be skipped (repeats, too long) before sending', () => {
    const r0 = render(<RecipientLinksPanel initialVideo={VID} fetchFn={server()} />); expect(r0.queryByTestId('rl-problems')).toBeNull(); typeNames('\n\n'); expect(r0.queryByTestId('rl-problems')).toBeNull(); r0.unmount()
    render(<RecipientLinksPanel initialVideo={VID} fetchFn={server()} />); typeNames('Acme\nacme\n\nBright'); expect(screen.getByTestId('rl-problems').textContent).toMatch(/"acme" \(repeated\)/); expect(screen.getByRole('button', { name: 'Make 2 links' })).toBeTruthy()
  })
  it('makes links: sends only cleaned names, shows each link ONCE built on this site\'s address, copy and CSV work, "I have saved them" removes them', async () => {
    const f = server(); const copyFn = vi.fn(); const downloadFn = vi.fn()
    render(<RecipientLinksPanel initialVideo={VID} origin="https://app.example.com" fetchFn={f} copyFn={copyFn} downloadFn={downloadFn} />)
    typeNames('Acme Roofing\nBright Plumbing'); fireEvent.change(screen.getByLabelText('Expire after days'), { target: { value: '30' } }); fireEvent.click(screen.getByRole('button', { name: 'Make 2 links' }))
    await waitFor(() => expect(screen.getByTestId('rl-fresh')).toBeTruthy())
    const post = (f as any).raw.mock.calls.find((c: any[]) => c[1]?.method === 'POST'); expect(JSON.parse(post[1].body)).toEqual({ videoId: VID, labels: ['Acme Roofing', 'Bright Plumbing'], expiresInDays: 30 })
    const input = screen.getByLabelText('Link for Acme Roofing') as HTMLInputElement; expect(input.value).toMatch(new RegExp(`^https://app\\.example\\.com/watch/${VID}\\?r=[A-Za-z0-9_-]{32}$`))
    expect(screen.getByTestId('rl-message').textContent).toMatch(/cannot be shown again/)
    fireEvent.click(screen.getAllByText('Copy')[0]); expect(copyFn).toHaveBeenCalledWith(input.value)
    fireEvent.click(screen.getByText('Download all as CSV')); expect(downloadFn.mock.calls[0][0]).toBe('personal-links.csv'); expect(downloadFn.mock.calls[0][1]).toContain('label,url'); expect(downloadFn.mock.calls[0][1]).toContain(input.value)
    fireEvent.click(screen.getByText('I have saved them')); expect(screen.queryByTestId('rl-fresh')).toBeNull(); expect(document.body.innerHTML).not.toContain(input.value.split('r=')[1]) // the token is gone from the page
  })
  it('lists links with status and counts; revoke asks the server and refreshes; revoked/expired rows have no Revoke button', async () => {
    const f = server({ list: [row(), row({ id: 'id-2', label: 'Old', status: 'revoked', revokedAt: 'x', views: 0, plays: 0, ctaClicks: 0, leads: 0, lastSeen: null }), row({ id: 'id-3', label: 'Late', status: 'expired' })] })
    render(<RecipientLinksPanel initialVideo={VID} fetchFn={f} />); fireEvent.click(screen.getByText('Show links')); await waitFor(() => expect(screen.getAllByTestId('rl-row').length).toBe(3))
    expect(screen.getAllByTestId('rl-row')[0].textContent).toMatch(/Live · 2 views · 1 play · 1 click · 1 reply/); expect(screen.getAllByTestId('rl-row').map((r) => r.dataset.status)).toEqual(['live', 'revoked', 'expired'])
    expect(screen.getAllByRole('button', { name: /Revoke the link/ })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Revoke the link for Acme' })); await waitFor(() => expect(screen.getByTestId('rl-message').textContent).toMatch(/Revoked the link for Acme/)); expect((f as any).raw.mock.calls.some((c: any[]) => c[1]?.method === 'DELETE' && String(c[0]).includes('id=id-1'))).toBe(true)
  })
  it('every failure is an alert that says what to do', async () => {
    for (const [status, json, text] of [[404, { error: 'NOT_FOUND' }, /not found in your account/], [409, { error: 'DUPLICATE_LABEL', message: 'A live link already exists for one of these names.' }, /already exists/], [409, { error: 'LINK_LIMIT_REACHED' }, /limit/], [401, {}, /Sign in/], [429, {}, /Too many/], [502, {}, /Nothing was changed/]] as const) {
      const { unmount } = render(<RecipientLinksPanel initialVideo={VID} fetchFn={server({ post: () => ({ status, json }) })} />); typeNames('Acme'); fireEvent.click(screen.getByRole('button', { name: 'Make 1 link' }))
      await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(text)); expect(screen.queryByTestId('rl-fresh')).toBeNull(); unmount()
    }
  })
  it('a list failure is reported; an empty list says so', async () => {
    const { unmount } = render(<RecipientLinksPanel initialVideo={VID} fetchFn={vi.fn(async () => { throw new Error('offline') }) as unknown as typeof fetch} />); fireEvent.click(screen.getByText('Show links')); await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not available/)); unmount()
    render(<RecipientLinksPanel initialVideo={VID} fetchFn={server({ list: [] })} />); fireEvent.click(screen.getByText('Show links')); await waitFor(() => expect(screen.getByText('No links yet.')).toBeTruthy())
  })
  it('warns that the address is private', async () => { render(<RecipientLinksPanel initialVideo={VID} fetchFn={server()} />); fireEvent.click(screen.getByText('Show links')); await waitFor(() => screen.getByTestId('rl-list')); expect(screen.getByTestId('rl-list').textContent).toMatch(/private key.*anyone who has it can open the video/) })
})
