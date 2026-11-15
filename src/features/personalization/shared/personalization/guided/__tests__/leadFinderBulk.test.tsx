// @vitest-environment jsdom
/**
 * Lead Finder → Many recipients: the owner's saved leads feed the same batch → personal links → private video → package flow as a CSV.
 * Rendering, the batch runner and the link/upload plumbing are real; the per-recipient file making and the network are faked.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BulkPanel } from '../BulkPanel'
import { createMemoryStores, type RunDeps } from '../../bulk/batchJob'
import { createDefaultPreviewSettings } from '../../preview/presets'
import type { PreviewInputProps } from '../../preview/types'

beforeAll(() => {
  const g = globalThis as any
  g.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
  const read = (b: Blob, how: 'readAsArrayBuffer' | 'readAsText') => new Promise<any>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr[how](b) })
  if (!Blob.prototype.arrayBuffer) Blob.prototype.arrayBuffer = function (this: Blob) { return read(this, 'readAsArrayBuffer') }
  if (!Blob.prototype.text) Blob.prototype.text = function (this: Blob) { return read(this, 'readAsText') }
})
afterEach(cleanup)

const props = (): PreviewInputProps => ({ videoUrl: 'blob:x', posterUrl: null, isImageSource: false, audioUrl: null, settings: createDefaultPreviewSettings() as never,
  brand: { businessName: 'Base', headline: 'Base', offer: '', cta: 'Visit', phone: '', website: 'https://base.com', logoUrl: null, productUrl: null, serviceUrl: null } as never })
const fakeRunner = (log: string[] = []): ((b: PreviewInputProps, r: any[]) => RunDeps) => (_base, recipients) => ({
  async runStep(step, item) { const r = recipients.find((x: any) => x.id === item.id); log.push(`${step}:${r.company}`); return { blob: new Blob([`${step}-${r.company}`]), fileName: `${step}.bin` } },
})
const lead = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, business: { id: `osm-${id}`, name, category: 'Roofer', email: `${id}@x.com`, website: `${id}.example.com`, ...extra }, stage: 'New', starred: false, niche: 'roofing', location: 'Austin, TX' })
const LEADS = [lead('a1', 'Acme Roofing'), { ...lead('b2', 'Bright Plumbing'), stage: 'Contacted', starred: true }, lead('c3', 'Cedar Electric', { email: 'nope' })]
const useLeads = (leadsFn: any) => fireEvent.click(screen.getByRole('button', { name: 'Use my saved Lead Finder leads' }))

describe('BulkPanel with saved Lead Finder leads', () => {
  it('loads the owner\'s leads, shows who is ready and what was dropped, and filters by stage and star', async () => {
    const leadsFn = vi.fn(async () => ({ ok: true as const, leads: LEADS as never }))
    render(<BulkPanel inputProps={props()} storesFn={async () => createMemoryStores()} runnerFn={fakeRunner()} leadsFn={leadsFn} />); useLeads(leadsFn)
    await waitFor(() => expect(screen.getByTestId('bulk-lead-counts').textContent).toMatch(/3 leads ready/)); expect(screen.getByTestId('bulk-message').textContent).toMatch(/3 saved leads loaded/)
    expect(screen.getByTestId('bulk-lead-import').textContent).toMatch(/Cedar Electric: "nope" is not a valid email/)
    fireEvent.change(screen.getByLabelText('Lead stage'), { target: { value: 'Contacted' } }); expect(screen.getByTestId('bulk-lead-counts').textContent).toMatch(/1 lead ready/)
    fireEvent.change(screen.getByLabelText('Lead stage'), { target: { value: '' } }); fireEvent.click(screen.getByLabelText('Starred only')); expect(screen.getByTestId('bulk-lead-counts').textContent).toMatch(/1 lead ready/)
  })
  it('makes each lead\'s files from THEIR copy, then issues one personal link per lead labelled with the business', async () => {
    const log: string[] = []; const issue = vi.fn(async (_v: string, labels: string[]) => ({ ok: true as const, data: labels.map((label, i) => ({ id: `link-${i + 1}`, label, token: 't', url: `https://app.example.com/watch/abcdefgh12?r=tok${i}` })) }))
    render(<BulkPanel inputProps={props()} storesFn={async () => createMemoryStores()} runnerFn={fakeRunner(log)} issueLinksFn={issue as never} leadsFn={(async () => ({ ok: true, leads: LEADS })) as never} />); useLeads(null)
    await waitFor(() => screen.getByTestId('bulk-lead-import')); fireEvent.click(screen.getByRole('button', { name: /Start making 3 sets/ }))
    await waitFor(() => expect(screen.getByTestId('bulk-summary').textContent).toMatch(/3 of 3 done/))
    expect(log.filter((l) => l.startsWith('thumbnail:')).sort()).toEqual(['thumbnail:Acme Roofing', 'thumbnail:Bright Plumbing', 'thumbnail:Cedar Electric'])
    fireEvent.change(screen.getByLabelText('Published video address for personal links'), { target: { value: 'https://app.example.com/watch/abcdefgh12' } }); fireEvent.click(screen.getByRole('button', { name: 'Make personal links' }))
    await waitFor(() => expect(screen.getByTestId('bulk-message').textContent).toMatch(/3 personal links made/)); expect(issue.mock.calls[0][0]).toBe('abcdefgh12'); expect(issue.mock.calls[0][1]).toEqual(['Acme Roofing', 'Bright Plumbing', 'Cedar Electric'])
  })
  it('explains failures in plain words and keeps the CSV path working', async () => {
    render(<BulkPanel inputProps={props()} storesFn={async () => createMemoryStores()} runnerFn={fakeRunner()} leadsFn={(async () => ({ ok: false, message: 'Sign in to use your saved leads.' })) as never} />); useLeads(null)
    await waitFor(() => expect(screen.getByTestId('bulk-message').textContent).toBe('Sign in to use your saved leads.')); expect(screen.queryByTestId('bulk-lead-import')).toBeNull()
    fireEvent.change(screen.getByLabelText('CSV text'), { target: { value: 'Company,Email\nAcme,a@acme.com' } }); fireEvent.click(screen.getByRole('button', { name: 'Read the list' })); expect(screen.getByTestId('bulk-import')).toBeTruthy()
  })
  it('no saved leads yet: says so; reading a CSV afterwards replaces the lead list (never both)', async () => {
    render(<BulkPanel inputProps={props()} storesFn={async () => createMemoryStores()} runnerFn={fakeRunner()} leadsFn={(async () => ({ ok: true, leads: [] })) as never} />); useLeads(null)
    await waitFor(() => expect(screen.getByTestId('bulk-message').textContent).toMatch(/no saved leads yet/))
    cleanup(); render(<BulkPanel inputProps={props()} storesFn={async () => createMemoryStores()} runnerFn={fakeRunner()} leadsFn={(async () => ({ ok: true, leads: LEADS })) as never} />); useLeads(null)
    await waitFor(() => screen.getByTestId('bulk-lead-import')); fireEvent.change(screen.getByLabelText('CSV text'), { target: { value: 'Company\nZed Co' } }); fireEvent.click(screen.getByRole('button', { name: 'Read the list' }))
    expect(screen.queryByTestId('bulk-lead-import')).toBeNull(); expect(screen.getByTestId('bulk-counts').textContent).toMatch(/1 recipients ready/)
  })
})
