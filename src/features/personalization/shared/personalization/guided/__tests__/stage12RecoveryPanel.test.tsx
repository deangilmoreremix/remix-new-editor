// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { RecoveryPanel } from '../RecoveryPanel'
import { createMemoryDraftStore } from '../../recovery/draftStore'
import { buildBackup, makeSnapshot } from '../../recovery/snapshot'
import type { ChannelLike } from '../../recovery/autosaver'
import { createDefaultPreviewSettings } from '../../preview/presets'

beforeAll(() => {
  const read = (b: Blob, how: 'readAsArrayBuffer' | 'readAsText') => new Promise<any>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr[how](b) })
  if (!Blob.prototype.arrayBuffer) Blob.prototype.arrayBuffer = function (this: Blob) { return read(this, 'readAsArrayBuffer') }
  if (!Blob.prototype.text) Blob.prototype.text = function (this: Blob) { return read(this, 'readAsText') }
})
afterEach(cleanup)

const S = (over: Record<string, unknown> = {}): any => ({ ...createDefaultPreviewSettings(), ...over })
/** A host that owns the settings like the editor does. */
function Host({ initial, store, channel, onChange, ...rest }: { initial: any; store: any; channel?: ChannelLike | null; onChange?: (s: any) => void } & Record<string, unknown>) {
  const [s, setS] = useState(initial)
  return (<><button type="button" onClick={() => setS((p: any) => ({ ...p, width: p.width + 1 }))}>edit</button><output data-testid="w">{s.width}</output>
    <RecoveryPanel settings={s} edit={(fn) => setS((p: any) => { const n = fn(p); onChange?.(n); return n })} storeFn={async () => store} channelFactory={() => channel ?? null} debounceMs={20} {...(rest as object)} /></>)
}

describe('RecoveryPanel', () => {
  it('autosaves after edits and shows when', async () => {
    const store = createMemoryDraftStore(); render(<Host initial={S()} store={store} />)
    await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toMatch(/saved in this browser a moment after/))
    fireEvent.click(screen.getByText('edit')); await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toMatch(/Autosaved at/))
    const saved = await store.load('default'); expect(saved.length).toBeGreaterThan(0); expect((saved[0].settings as any).width).toBe(S().width + 1)
  })
  it('offers the last draft after a "crash", pauses autosave until the owner chooses, and restoring replaces the design', async () => {
    const store = createMemoryDraftStore(); await store.save('default', [makeSnapshot(S({ width: 999 }), new Date('2026-11-14T10:00:00Z'))])
    const changes: any[] = []; render(<Host initial={S()} store={store} onChange={(s) => changes.push(s)} />)
    await screen.findByTestId('recovery-offer'); expect(screen.getByTestId('recovery-status').textContent).toMatch(/paused until you choose/)
    fireEvent.click(screen.getByText('edit')); await new Promise((r) => setTimeout(r, 120)); expect((await store.load('default'))[0].hash).toBe(makeSnapshot(S({ width: 999 })).hash) // nothing overwrote the draft while the offer was open
    fireEvent.click(screen.getByRole('button', { name: 'Restore the draft' })); await waitFor(() => expect(screen.getByTestId('w').textContent).toBe('999')); expect(screen.queryByTestId('recovery-offer')).toBeNull(); expect(screen.getByTestId('recovery-message').textContent).toMatch(/Restored the draft/)
  })
  it('discard removes the draft; "keep what is on screen" lets autosave continue; an identical draft is not offered at all', async () => {
    const a = createMemoryDraftStore(); await a.save('default', [makeSnapshot(S({ width: 5 }))]); render(<Host initial={S()} store={a} />); await screen.findByTestId('recovery-offer'); fireEvent.click(screen.getByRole('button', { name: 'Discard it' })); await waitFor(() => expect(screen.queryByTestId('recovery-offer')).toBeNull()); expect(await a.load('default')).toEqual([]); cleanup()
    const b = createMemoryDraftStore(); await b.save('default', [makeSnapshot(S({ width: 5 }))]); render(<Host initial={S()} store={b} />); await screen.findByTestId('recovery-offer'); fireEvent.click(screen.getByRole('button', { name: 'Keep what is on screen' })); await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toMatch(/Autosaved at/)); cleanup()
    const c = createMemoryDraftStore(); await c.save('default', [makeSnapshot(S())]); render(<Host initial={S()} store={c} />); await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toMatch(/a moment after/)); expect(screen.queryByTestId('recovery-offer')).toBeNull()
  })
  it('a draft with browser-memory items says what must be added again', async () => {
    const store = createMemoryDraftStore(); await store.save('default', [makeSnapshot(S({ width: 7, audio: { url: 'blob:http://x/1' } }))]); render(<Host initial={S()} store={store} />)
    await screen.findByTestId('recovery-offer'); fireEvent.click(screen.getByRole('button', { name: 'Restore the draft' })); await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/1 item that existed only in the browser's memory/))
  })
  it('a second tab saving while this one has unsaved edits is a conflict the owner decides, never a silent overwrite', async () => {
    const store = createMemoryDraftStore(); const listeners: Array<(e: { data: unknown }) => void> = []; const channel: ChannelLike = { postMessage: () => undefined, addEventListener: (_t, fn) => { listeners.push(fn) }, close: () => undefined }
    render(<Host initial={S()} store={store} channel={channel} debounceMs={5000} />); await waitFor(() => expect(listeners.length).toBe(1)); await screen.findByText(/saved in this browser a moment after/)
    fireEvent.click(screen.getByText('edit')); await store.save('default', [makeSnapshot(S({ width: 4242 }), new Date('2026-11-14T11:00:00Z'))])
    act(() => listeners[0]({ data: { type: 'draft-saved', key: 'default', tab: 'other', savedAt: '2026-11-14T11:00:00.000Z' } })); await screen.findByTestId('recovery-conflict')
    fireEvent.click(screen.getByRole('button', { name: /Use the other tab/ })); await waitFor(() => expect(screen.getByTestId('w').textContent).toBe('4242')); expect(screen.queryByTestId('recovery-conflict')).toBeNull()
  })
  it('says plainly when storage is blocked, and the backup still works', async () => {
    const dl = vi.fn(); render(<RecoveryPanel settings={S()} edit={() => undefined} storeFn={async () => null} channelFactory={() => null} downloadFn={dl} />)
    await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toMatch(/not available in this browser.*backup/)); fireEvent.click(screen.getByRole('button', { name: 'Download a backup (.zip)' })); await waitFor(() => expect(dl).toHaveBeenCalled()); expect(dl.mock.calls[0][0]).toMatch(/^design-backup-\d{4}-\d{2}-\d{2}\.zip$/)
  })
  it('restores from a backup file, and refuses a wrong file without changing anything', async () => {
    const changes: any[] = []; render(<Host initial={S()} store={createMemoryDraftStore()} onChange={(s) => changes.push(s)} />); await screen.findByTestId('recovery-status')
    const input = screen.getByLabelText('Backup file'); const good = new File([await buildBackup(S({ width: 1234, audio: { url: 'blob:x' } }), new Date('2026-11-14T09:00:00Z'))], 'b.zip')
    fireEvent.change(input, { target: { files: [good] } }); await waitFor(() => expect(screen.getByTestId('w').textContent).toBe('1234')); expect(screen.getByTestId('recovery-message').textContent).toMatch(/Restored the backup made 2026-11-14 09:00 UTC.*1 item/)
    const n = changes.length; fireEvent.change(input, { target: { files: [new File(['definitely not a zip file, long enough to pass size check....'], 'x.zip')] } }); await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not a ZIP/)); expect(changes.length).toBe(n); expect(screen.getByTestId('w').textContent).toBe('1234')
  })
})
