// @vitest-environment jsdom
/**
 * Stage 10 — the Many-recipients panel (CSV → mapping → batch → package, pause/resume, saved batch after a "reload", design change,
 * personal links) and the Outreach sequence panel (React Flow). Rendering and the batch runner are real; the per-recipient file
 * making is faked here (the real pipelines are exercised in the browser check).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BulkPanel } from '../BulkPanel'
import { OutreachFlowPanel } from '../OutreachFlowPanel'
import { OutreachFlowSection } from '../OutreachFlowSection'
import { createMemoryStores, type RunDeps } from '../../bulk/batchJob'
import { createDefaultPreviewSettings } from '../../preview/presets'
import { defaultFlow } from '../../flow/outreachFlow'
import type { PreviewInputProps } from '../../preview/types'

beforeAll(() => {
  const g = globalThis as any
  g.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
  g.DOMMatrixReadOnly ??= class { m22 = 1; constructor(t?: string) { const m = /scale\(([\d.]+)\)/.exec(t ?? ''); if (m) this.m22 = Number(m[1]) } }
  g.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} }
  // jsdom's Blob predates these (every real browser has them)
  const read = (b: Blob, how: 'readAsArrayBuffer' | 'readAsText') => new Promise<any>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr[how](b) })
  if (!Blob.prototype.arrayBuffer) Blob.prototype.arrayBuffer = function (this: Blob) { return read(this, 'readAsArrayBuffer') }
  if (!Blob.prototype.text) Blob.prototype.text = function (this: Blob) { return read(this, 'readAsText') }
})
afterEach(cleanup)

const props = (over: Partial<PreviewInputProps['brand']> = {}, settings: Partial<PreviewInputProps['settings']> = {}): PreviewInputProps => ({ videoUrl: 'blob:x', posterUrl: null, isImageSource: false, audioUrl: null, settings: { ...createDefaultPreviewSettings(), ...settings } as never,
  brand: { businessName: 'Base', headline: 'Base', offer: '', cta: 'Visit base.com', phone: '', website: 'https://base.com', logoUrl: null, productUrl: null, serviceUrl: null, ...over } as never })
const CSV = 'Company,Email,Website,First name\nAcme Roofing,ann@acme.com,acme.com,Ann\nBright Plumbing,bo@bright.com,bright.com,Bo\nBright Plumbing,BO@bright.com,,Bo\n,,,\nCedar,bad-email,,Cy'
const fakeRunner = (log: string[] = [], fail?: (step: string, id: string) => boolean): ((b: PreviewInputProps, r: any[]) => RunDeps) => (base, recipients) => ({
  async runStep(step, item) {
    const r = recipients.find((x: any) => x.id === item.id); log.push(`${step}:${r.company}:${base.brand.businessName}`)
    if (fail?.(step, item.id)) throw new Error('could not draw')
    return { blob: new Blob([`${step}-${r.company}`]), fileName: `${step}.bin` }
  },
})
const load = (csv = CSV) => { fireEvent.change(screen.getByLabelText('CSV text'), { target: { value: csv } }); fireEvent.click(screen.getByRole('button', { name: 'Read the list' })) }

describe('BulkPanel', () => {
  it('reads the list, maps columns, and reports what it will skip and why before anything starts', async () => {
    const m = createMemoryStores(); render(<BulkPanel inputProps={props()} storesFn={async () => m} runnerFn={fakeRunner()} />)
    load()
    expect(screen.getByTestId('bulk-counts').textContent).toMatch(/2 recipients ready; 2 rows skipped \(1 repeats\)/)
    const imp = screen.getByTestId('bulk-import'); expect(imp.textContent).toMatch(/Row 4: Skipped: same email address as row 3/); expect(imp.textContent).toMatch(/Row 6: .*not a valid email/)
    expect((screen.getByLabelText('Use column Company as') as HTMLSelectElement).value).toBe('company'); expect((screen.getByLabelText('Use column First name as') as HTMLSelectElement).value).toBe('custom')
    expect(screen.getByRole('button', { name: /Start making 2 sets/ })).toBeTruthy()
  })
  it('changing a column mapping changes who is accepted, and a field can only come from one column', () => {
    render(<BulkPanel inputProps={props()} storesFn={async () => createMemoryStores()} runnerFn={fakeRunner()} />); load('Name,Company\nAnn Lee,Acme\nBo Ray,Bright')
    fireEvent.change(screen.getByLabelText('Use column Name as'), { target: { value: 'company' } })
    expect((screen.getByLabelText('Use column Company as') as HTMLSelectElement).value).toBe('') // taken over by "Name"
    fireEvent.change(screen.getByLabelText('Use column Name as'), { target: { value: '' } }); fireEvent.change(screen.getByLabelText('Use column Company as'), { target: { value: '' } })
    expect(screen.getByTestId('bulk-counts').textContent).toMatch(/0 recipients ready/); expect((screen.getByRole('button', { name: /Start making/ }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('makes every recipient\'s files from THEIR copy of the design, shows progress, then downloads a package', async () => {
    const m = createMemoryStores(); const log: string[] = []; const dl = vi.fn()
    render(<BulkPanel inputProps={props()} storesFn={async () => m} runnerFn={fakeRunner(log)} downloadFn={dl} />); load()
    fireEvent.click(screen.getByRole('button', { name: /Start making 2 sets/ }))
    await waitFor(() => expect(screen.getByTestId('bulk-summary').textContent).toMatch(/2 of 2 done.*finished/))
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')
    expect(log).toEqual(['thumbnail:Acme Roofing:Base', 'gif:Acme Roofing:Base', 'thumbnail:Bright Plumbing:Base', 'gif:Bright Plumbing:Base']) // runner receives the BASE design; per-recipient copies are made inside the real runner
    fireEvent.click(screen.getByRole('button', { name: 'Download package (.zip)' })); await waitFor(() => expect(dl).toHaveBeenCalled())
    expect(dl.mock.calls[0][0]).toBe('personalized-videos.zip'); expect((dl.mock.calls[0][1] as Blob).size).toBeGreaterThan(100)
  })
  it('lists the recipients that could not be made with the reason, and "try the failed ones again" retries only them', async () => {
    const m = createMemoryStores(); let broken = true
    render(<BulkPanel inputProps={props()} storesFn={async () => m} runnerFn={(b, r) => fakeRunner([], (s, id) => broken && s === 'gif' && id === r[1].id)(b, r)} retryDelayMs={0} />); load()
    fireEvent.click(screen.getByRole('button', { name: /Start making/ }))
    await waitFor(() => expect(screen.getByTestId('bulk-summary').textContent).toMatch(/1 of 2 done, 1 could not be made/)); expect(screen.getByTestId('bulk-job').textContent).toMatch(/Bright Plumbing: gif: could not draw/)
    broken = false; fireEvent.click(screen.getByRole('button', { name: 'Try the failed ones again' }))
    await waitFor(() => expect(screen.getByTestId('bulk-summary').textContent).toMatch(/2 of 2 done/))
  })
  it('pause stops promptly and resume finishes without redoing finished recipients', async () => {
    const m = createMemoryStores(); const log: string[] = []; let gate: () => void = () => {}; let hold = true
    const runner = (b: PreviewInputProps, r: any[]): RunDeps => ({ async runStep(step, item, { signal }) {
      log.push(`${step}:${item.id}`)
      if (hold && item.id === r[1].id) await new Promise<void>((res, rej) => { gate = res; signal.addEventListener('abort', () => rej(new DOMException('x', 'AbortError'))) })
      return { blob: new Blob(['x']), fileName: 'f' } } })
    render(<BulkPanel inputProps={props()} storesFn={async () => m} runnerFn={runner} />); load(); fireEvent.click(screen.getByRole('button', { name: /Start making/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()); fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    await waitFor(() => expect(screen.getByTestId('bulk-summary').textContent).toMatch(/1 of 2 done — paused/)); void gate
    const before = log.length; hold = false; fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    await waitFor(() => expect(screen.getByTestId('bulk-summary').textContent).toMatch(/2 of 2 done — finished/))
    const firstId = (await m.store.load())!.items[0].id
    expect(log.slice(before).every((l) => !l.includes(firstId))).toBe(true) // the recipient finished before the pause is not redone
  })
  it('after a reload, a saved batch comes back with its recipients and can be resumed or discarded', async () => {
    const m = createMemoryStores(); const first = render(<BulkPanel inputProps={props()} storesFn={async () => m} runnerFn={fakeRunner()} />); load()
    fireEvent.click(screen.getByRole('button', { name: /Start making/ })); await waitFor(() => expect(screen.getByTestId('bulk-summary').textContent).toMatch(/finished/)); first.unmount()
    render(<BulkPanel inputProps={props()} storesFn={async () => m} runnerFn={fakeRunner()} />)
    await waitFor(() => expect(screen.getByTestId('bulk-summary').textContent).toMatch(/2 of 2 done/)); expect(screen.getByRole('button', { name: 'Download package (.zip)' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Discard batch' })); await waitFor(() => expect(screen.queryByTestId('bulk-job')).toBeNull()); expect(await m.store.load()).toBeNull(); expect(m.artifacts.size()).toBe(0)
  })
  it('a changed video design blocks resuming (so every recipient gets the same design) but still allows downloading what exists', async () => {
    const m = createMemoryStores(); const slow: RunDeps = { async runStep() { return { blob: new Blob(['x']), fileName: 'f' } } }
    const a = render(<BulkPanel inputProps={props()} storesFn={async () => m} runnerFn={() => slow} />); load(); fireEvent.click(screen.getByRole('button', { name: /Start making/ }))
    await waitFor(() => expect(screen.getByTestId('bulk-summary').textContent).toMatch(/finished/)); a.unmount()
    // simulate an interrupted job by editing the saved state, then reopen with a different design
    const saved = (await m.store.load())!; saved.state = 'paused'; saved.items[1].status = 'pending'; await m.store.save(saved)
    render(<BulkPanel inputProps={props({ businessName: 'Changed' })} storesFn={async () => m} runnerFn={() => slow} />)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/design changed/)); expect((screen.getByRole('button', { name: 'Resume' }) as HTMLButtonElement).disabled).toBe(true); expect(screen.getByRole('button', { name: 'Download package (.zip)' })).toBeTruthy()
  })
  it('a second tab running the same batch is refused with a clear message', async () => {
    const m = createMemoryStores(); const locks = { request: async (_n: string, _o: unknown, cb: (l: unknown) => Promise<unknown>) => cb(null) } as unknown as LockManager
    render(<BulkPanel inputProps={props()} storesFn={async () => m} runnerFn={fakeRunner()} locks={locks} />); load(); fireEvent.click(screen.getByRole('button', { name: /Start making/ }))
    await waitFor(() => expect(screen.getByTestId('bulk-message').textContent).toMatch(/already running in another tab/))
  })
  it('files lost from browser storage: no short package is handed over; Resume remakes exactly those, then the download works', async () => {
    const m = createMemoryStores(); const dl = vi.fn(); const log: string[] = []; let broken = true
    const stale = () => { const b = new Blob(['x']); (b as any).slice = () => ({ arrayBuffer: async () => { throw new DOMException('gone', 'NotFoundError') } }); return b }
    const flaky = { store: m.store, artifacts: { ...m.artifacts, get: async (k: string) => (broken && k.endsWith('/gif') && k.includes('r0002') ? stale() : m.artifacts.get(k)) } }
    render(<BulkPanel inputProps={props()} storesFn={async () => flaky} runnerFn={fakeRunner(log)} downloadFn={dl} />); load(); fireEvent.click(screen.getByRole('button', { name: /Start making/ }))
    await waitFor(() => expect(screen.getByTestId('bulk-summary').textContent).toMatch(/finished/)); log.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Download package (.zip)' }))
    await waitFor(() => expect(screen.getByTestId('bulk-message').textContent).toMatch(/1 file was lost.*Press Resume/)); expect(dl).not.toHaveBeenCalled()
    expect(screen.getByTestId('bulk-summary').textContent).toMatch(/1 of 2 done/); expect(screen.getByRole('button', { name: 'Download without them' })).toBeTruthy()
    broken = false; fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    await waitFor(() => expect(screen.getByTestId('bulk-summary').textContent).toMatch(/2 of 2 done — finished/)); expect(log).toEqual(['gif:Bright Plumbing:Base']) // only the lost file was remade
    fireEvent.click(screen.getByRole('button', { name: 'Download package (.zip)' })); await waitFor(() => expect(dl).toHaveBeenCalledTimes(1))
  })
  it('"Download without them" gives the owner the partial package when they choose it', async () => {
    const m = createMemoryStores(); const dl = vi.fn(); const stale = () => { const b = new Blob(['x']); (b as any).slice = () => ({ arrayBuffer: async () => { throw new DOMException('gone', 'NotFoundError') } }); return b }
    const flaky = { store: m.store, artifacts: { ...m.artifacts, get: async (k: string) => (k.endsWith('/gif') && k.includes('r0002') ? stale() : m.artifacts.get(k)) } }
    render(<BulkPanel inputProps={props()} storesFn={async () => flaky} runnerFn={fakeRunner()} downloadFn={dl} />); load(); fireEvent.click(screen.getByRole('button', { name: /Start making/ }))
    await waitFor(() => expect(screen.getByTestId('bulk-summary').textContent).toMatch(/finished/)); fireEvent.click(screen.getByRole('button', { name: 'Download package (.zip)' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download without them' })).toBeTruthy()); fireEvent.click(screen.getByRole('button', { name: 'Download without them' }))
    await waitFor(() => expect(dl).toHaveBeenCalledTimes(1)); expect(screen.getByTestId('bulk-message').textContent).toMatch(/Package downloaded: 3 files\. 1 file is missing; those recipients show as not finished in the manifest/)
  })
  it('personal links: needs a real published address, is chunked, and the links go into the package manifest', async () => {
    const m = createMemoryStores(); const dl = vi.fn(); const issue = vi.fn(async (_v: string, labels: string[]) => ({ ok: true as const, data: labels.map((label, i) => ({ id: `i${i}`, label, token: 't', url: `https://app.example.com/watch/abcdefgh12?r=tok${i}` })) }))
    render(<BulkPanel inputProps={props()} storesFn={async () => m} runnerFn={fakeRunner()} downloadFn={dl} issueLinksFn={issue as never} />); load(); fireEvent.click(screen.getByRole('button', { name: /Start making/ }))
    await waitFor(() => expect(screen.getByTestId('bulk-summary').textContent).toMatch(/finished/))
    fireEvent.change(screen.getByLabelText('Published video address for personal links'), { target: { value: 'not a video address' } }); fireEvent.click(screen.getByRole('button', { name: 'Make personal links' }))
    expect(screen.getByTestId('bulk-message').textContent).toMatch(/does not look like a published video/); expect(issue).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Published video address for personal links'), { target: { value: 'https://app.example.com/watch/abcdefgh12' } }); fireEvent.click(screen.getByRole('button', { name: 'Make personal links' }))
    await waitFor(() => expect(screen.getByTestId('bulk-message').textContent).toMatch(/2 personal links made/)); expect(issue.mock.calls[0][0]).toBe('abcdefgh12'); expect(issue.mock.calls[0][1]).toEqual(['Acme Roofing', 'Bright Plumbing'])
    fireEvent.click(screen.getByRole('button', { name: 'Download package (.zip)' })); await waitFor(() => expect(dl).toHaveBeenCalled())
    const text = new TextDecoder('latin1').decode(new Uint8Array(await (dl.mock.calls[0][1] as Blob).arrayBuffer())); expect(text).toMatch(/watch\/abcdefgh12\?r=tok0/); expect(text).toMatch(/watch\/abcdefgh12\?r=tok1/)
  })
  it('does not start a batch it could not keep: blocked or full storage is explained, nothing runs', async () => {
    const dead = { store: { load: async () => null, save: async () => { throw new Error('blocked') }, clear: async () => {} }, artifacts: { put: async () => { throw new Error('blocked') }, get: async () => null, clearJob: async () => {} } }
    const log: string[] = []; render(<BulkPanel inputProps={props()} storesFn={async () => dead} runnerFn={fakeRunner(log)} />); load(); fireEvent.click(screen.getByRole('button', { name: /Start making/ }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/would not let the batch keep its files/)); expect(log).toEqual([]); expect(screen.queryByTestId('bulk-job')).toBeNull()
  })
})

describe('OutreachFlowSection (lazy)', () => {
  it('is closed by default (the diagram library is not loaded), and opens the planner on request', async () => {
    const g = globalThis as any; const saved = g.ResizeObserver; delete g.ResizeObserver // proves nothing React Flow needs is touched until the planner is opened
    try { render(<OutreachFlowSection />); expect(screen.getByTestId('flow-section').textContent).toMatch(/nothing is sent automatically/); expect(screen.queryByTestId('flow-panel')).toBeNull() } finally { g.ResizeObserver = saved }
    fireEvent.click(screen.getByRole('button', { name: 'Plan a sequence' })); expect(await screen.findByTestId('flow-panel')).toBeTruthy()
  })
})

describe('OutreachFlowPanel (React Flow)', () => {
  const none = { getItem: () => null, setItem: () => {} }
  it('shows the example sequence as a diagram, says it is a plan, and the sequence is valid', async () => {
    render(<OutreachFlowPanel storage={none} />)
    await waitFor(() => expect(screen.getByTestId('flow-node-n3')).toBeTruthy()); expect(screen.getByTestId('flow-panel').textContent).toMatch(/This is a plan only/); expect(screen.getByTestId('flow-issues').textContent).toMatch(/sequence is valid/)
    for (const id of ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8']) expect(screen.getByTestId(`flow-node-${id}`)).toBeTruthy()
  })
  it('simulates different recipients: watching ends early, not watching gets the follow-up, unsubscribing stops everything', async () => {
    render(<OutreachFlowPanel storage={none} />); const sim = () => screen.getByTestId('flow-simulation').textContent!
    expect(sim()).toMatch(/Day 3: Send email: Did you get a chance/); expect(sim()).toMatch(/2 emails in total/)
    fireEvent.click(screen.getByLabelText('watches the video')); expect(sim()).not.toMatch(/Did you get a chance/); expect(sim()).toMatch(/1 email in total/)
    fireEvent.click(screen.getByLabelText('unsubscribes')); expect(sim()).toMatch(/Stopped \(unsubscribed\)\. 0 emails/)
  })
  it('editing through the inspector works without dragging: change a subject, a wait, re-wire a step, remove a step; errors appear and block the plan download', async () => {
    const dl = vi.fn(); render(<OutreachFlowPanel storage={none} downloadFn={dl} />)
    fireEvent.click(screen.getByTestId('flow-node-n3')); const insp = () => screen.getByTestId('flow-inspector')
    fireEvent.change(within(insp()).getByLabelText('Email subject'), { target: { value: 'Hello {{firstName}}' } }); expect(screen.getByTestId('flow-node-n3').textContent).toMatch(/Hello \{\{firstName\}\}/)
    fireEvent.click(screen.getByTestId('flow-node-n4')); fireEvent.change(within(insp()).getByLabelText('Days to wait'), { target: { value: '99' } }); expect(screen.getByTestId('flow-node-n4').textContent).toMatch(/30 days/) // clamped
    fireEvent.click(screen.getByRole('button', { name: 'Download plan (.csv)' })); expect(dl).toHaveBeenCalledTimes(1); expect(dl.mock.calls[0][0]).toBe('outreach-plan.csv')
    fireEvent.click(screen.getByTestId('flow-node-n5')); fireEvent.change(within(insp()).getByLabelText('Go to if no'), { target: { value: '' } })
    expect(screen.getByTestId('flow-issues').textContent).toMatch(/needs a "No" path/); expect((screen.getByRole('button', { name: 'Download plan (.csv)' }) as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText('Fix the errors above to see the plan.')).toBeTruthy()
    fireEvent.change(within(insp()).getByLabelText('Go to if no'), { target: { value: 'n6' } }); expect(screen.getByTestId('flow-issues').textContent).toMatch(/sequence is valid/)
    fireEvent.click(screen.getByTestId('flow-node-n6')); fireEvent.click(within(insp()).getByRole('button', { name: 'Remove this step' })); expect(screen.queryByTestId('flow-node-n6')).toBeNull(); expect(screen.getByTestId('flow-issues').textContent).toMatch(/needs a "No" path/)
  })
  it('adding steps and connecting them can create a loop, which is refused as an error', async () => {
    render(<OutreachFlowPanel storage={none} />); fireEvent.click(screen.getByRole('button', { name: 'Add: Send email' }))
    const added = screen.getAllByTestId(/^flow-node-n[a-z0-9]+\d$/).find((e) => /a quick video/.test(e.textContent ?? ''))!; fireEvent.click(added)
    fireEvent.change(within(screen.getByTestId('flow-inspector')).getByLabelText('Go to'), { target: { value: 'n3' } }) // new email → first email: a loop
    expect(screen.getByTestId('flow-issues').textContent).toMatch(/not connected to the start|loops back/)
  })
  it('keeps a draft in storage and restores it; corrupt drafts fall back to the example', () => {
    const saved: Record<string, string> = {}; const storage = { getItem: (k: string) => saved[k] ?? null, setItem: (k: string, v: string) => { saved[k] = v } }
    const a = render(<OutreachFlowPanel storage={storage} />); fireEvent.click(screen.getByTestId('flow-node-n3')); fireEvent.change(within(screen.getByTestId('flow-inspector')).getByLabelText('Email subject'), { target: { value: 'Kept' } }); a.unmount()
    render(<OutreachFlowPanel storage={storage} />); expect(screen.getByTestId('flow-node-n3').textContent).toMatch(/Kept/); cleanup()
    render(<OutreachFlowPanel storage={{ getItem: () => '{not json', setItem: () => { throw new Error('private mode') } }} />); expect(screen.getByTestId('flow-node-n3')).toBeTruthy()
    cleanup(); render(<OutreachFlowPanel initial={{ ...defaultFlow(), nodes: [] }} storage={none} />); expect(screen.getByTestId('flow-issues').textContent).toMatch(/empty/)
  })
})
