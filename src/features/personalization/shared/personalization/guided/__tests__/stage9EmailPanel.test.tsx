// @vitest-environment jsdom
/**
 * Stage 9 — the Outreach email panel: live sandboxed preview, the checklist, downloads, and the single approved test send with every
 * failure message. Rendering uses the real React Email template.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EmailOutreachPanel } from '../EmailOutreachPanel'
import type { SendResult } from '../../email/outreachClient'

afterEach(cleanup)
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const fillSender = () => { type('Sender name', 'Dana Roe'); type('Reply-to email', 'dana@example.com'); type('Postal address', '1 Main St, Springfield') }
const checks = () => screen.getByTestId('email-checks')
const frame = () => screen.getByTitle('Email preview') as HTMLIFrameElement
const links = { heroUrl: 'https://cdn.example.com/hero.gif', videoUrl: 'https://app.example.com/watch/abc?r=tok' }

describe('EmailOutreachPanel', () => {
  it('shows a sandboxed preview with merge values filled in, and what still blocks sending', async () => {
    render(<EmailOutreachPanel {...links} />)
    await waitFor(() => expect(frame().getAttribute('srcdoc')).toContain('Hi Alex,'))
    expect(frame().getAttribute('sandbox')).toBe('') // no scripts, no forms, no same-origin
    expect(checks().textContent).toMatch(/sender email address/); expect(checks().textContent).toMatch(/postal address/); expect(checks().textContent).not.toMatch(/\{\{/)
    expect((screen.getByRole('button', { name: 'Send me a test' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('editing the sample values changes the preview', async () => {
    render(<EmailOutreachPanel {...links} />); fillSender()
    type('Sample first name', 'Priya'); type('Sample company', 'Bright Plumbing')
    await waitFor(() => expect(frame().getAttribute('srcdoc')).toContain('Hi Priya,')); expect(frame().getAttribute('srcdoc')).toContain('Bright Plumbing')
  })
  it('hostile sample values and text are shown escaped in the preview', async () => {
    render(<EmailOutreachPanel {...links} />)
    type('Sample first name', '<img src=x onerror=alert(1)>')
    await waitFor(() => expect(frame().getAttribute('srcdoc')).toContain('&lt;img src=x onerror=alert(1)&gt;')); expect(frame().getAttribute('srcdoc')).not.toContain('<img src=x')
  })
  it('an unsafe video or picture address is ignored rather than put in the email', async () => {
    render(<EmailOutreachPanel />)
    type('Video page address', 'javascript:alert(1)'); type('GIF or picture address', 'data:image/gif;base64,AAAA')
    await waitFor(() => expect(frame().getAttribute('srcdoc')).toBeTruthy()); expect(frame().getAttribute('srcdoc')).not.toMatch(/javascript:|data:image/)
  })
  it('downloads HTML, text and a .eml that carries the unsubscribe header', async () => {
    const dl = vi.fn(); render(<EmailOutreachPanel {...links} downloadFn={dl} />); fillSender()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Download HTML' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Download HTML' })); fireEvent.click(screen.getByRole('button', { name: 'Download text' })); fireEvent.click(screen.getByRole('button', { name: 'Download .eml' }))
    expect(dl.mock.calls.map((c) => [c[0], c[2]])).toEqual([['email.html', 'text/html'], ['email.txt', 'text/plain'], ['email.eml', 'message/rfc822']])
    expect(dl.mock.calls[0][1]).toMatch(/^<!DOCTYPE html/i); expect(dl.mock.calls[1][1]).toContain('Hi Alex,')
    expect(dl.mock.calls[2][1]).toMatch(/Content-Type: multipart\/alternative/); expect(dl.mock.calls[2][1]).toMatch(/\r\nList-Unsubscribe: /)
  })
  const ready = async (sendFn: (to: string) => Promise<SendResult>) => {
    render(<EmailOutreachPanel {...links} sendFn={sendFn as never} />); fillSender()
    // the panel's own unsubscribe address is a placeholder until the server mints a real one per recipient, so the checks pass
    await waitFor(() => expect(checks().querySelector('[data-level="error"]')).toBeNull())
  }
  it('sends ONE test to the typed address, then reports acceptance without claiming delivery', async () => {
    const sendFn = vi.fn(async (): Promise<SendResult> => ({ ok: true, messageId: '<m@x>', note: 'The mail server accepted the message. That does not prove it reached the inbox.' }))
    await ready(sendFn)
    const btn = screen.getByRole('button', { name: 'Send me a test' }) as HTMLButtonElement; expect(btn.disabled).toBe(true)
    type('Send the test to', 'not an address'); expect(btn.disabled).toBe(true)
    type('Send the test to', 'me@example.com'); expect(btn.disabled).toBe(false); fireEvent.click(btn)
    await waitFor(() => expect(screen.getByTestId('email-send-result').textContent).toMatch(/Accepted by the mail server/))
    expect(sendFn).toHaveBeenCalledTimes(1); expect((sendFn.mock.calls[0] as unknown[])[0]).toBe('me@example.com'); expect((sendFn.mock.calls[0] as unknown[])[2]).toEqual({ firstName: 'Alex', company: 'Acme Roofing' })
    expect(screen.getByTestId('email-send-result').textContent).toMatch(/not prove it reached the inbox/); expect(screen.getByTestId('email-send-result').getAttribute('role')).toBe('status')
  })
  it('shows each failure as an alert with its message and the not-ready list', async () => {
    const sendFn = vi.fn(async (): Promise<SendResult> => ({ ok: false, reason: 'not-ready', message: 'The email is not ready to send. Fix the items marked as errors first.', checks: [{ id: 'postal-address', message: 'Add a postal address for the footer.' }] }))
    await ready(sendFn); type('Send the test to', 'me@example.com'); fireEvent.click(screen.getByRole('button', { name: 'Send me a test' }))
    const out = await screen.findByTestId('email-send-result'); expect(out.getAttribute('role')).toBe('alert'); expect(out.textContent).toMatch(/not ready to send/); expect(out.textContent).toMatch(/Add a postal address/)
  })
  it('the button is disabled while sending so a double click cannot send twice', async () => {
    let release: (r: SendResult) => void = () => {}; const sendFn = vi.fn(() => new Promise<SendResult>((r) => { release = r }))
    await ready(sendFn); type('Send the test to', 'me@example.com'); fireEvent.click(screen.getByRole('button', { name: 'Send me a test' }))
    const busy = await screen.findByRole('button', { name: 'Sending…' }) as HTMLButtonElement; expect(busy.disabled).toBe(true); fireEvent.click(busy)
    release({ ok: false, reason: 'unavailable', message: 'Sending is not available here.' }); await waitFor(() => expect(screen.getByRole('button', { name: 'Send me a test' })).toBeTruthy()); expect(sendFn).toHaveBeenCalledTimes(1)
  })
  it('the Send button stays off while the email has errors, whatever is typed', async () => {
    render(<EmailOutreachPanel {...links} sendFn={vi.fn() as never} />); type('Send the test to', 'me@example.com')
    expect((screen.getByRole('button', { name: 'Send me a test' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
