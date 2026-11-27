// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorView, RETRY_LABELS } from '../RecoveryViews'

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
afterEach(() => { document.body.innerHTML = '' })

const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null
function mount(props: Partial<React.ComponentProps<typeof ErrorView>> = {}) {
  const retry = vi.fn(); const returnToEditing = vi.fn()
  const el = document.createElement('div'); document.body.appendChild(el)
  act(() => { createRoot(el).render(<ErrorView errorMessage="MuAPI is unavailable" retry={retry} returnToEditing={returnToEditing} {...props} />) })
  return { el, retry, returnToEditing }
}

describe('ErrorView (AI-failure recovery)', () => {
  it('shows the reason and says what was kept', () => {
    const { el } = mount()
    expect(el.querySelector('[role="alert"]')!.textContent).toBe('MuAPI is unavailable')
    expect(el.textContent).toContain('client, assets, footage, template and edits have been kept')
  })
  it('offers exactly two choices: retry what failed, or return to editing. Nothing that starts a different run', () => {
    const { el } = mount({ stage: 'generation' })
    const buttons = Array.from(el.querySelectorAll('button'))
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Retry Generation', 'Return to editing'])
    expect(el.textContent).not.toContain('Try Again')
  })
  it('labels the retry by the stage that failed, with a neutral default', () => {
    for (const [stage, label] of Object.entries(RETRY_LABELS)) {
      const { el } = mount({ stage: stage as keyof typeof RETRY_LABELS })
      expect(q(el, 'pz-error-retry')!.textContent).toContain(label)
      document.body.innerHTML = ''
    }
    expect(q(mount().el, 'pz-error-retry')!.textContent).toContain('Retry failed operation')
  })
  it('Retry calls retry once; Return calls only returnToEditing', () => {
    const { el, retry, returnToEditing } = mount()
    act(() => { q(el, 'pz-error-retry')!.click() })
    expect(retry).toHaveBeenCalledTimes(1); expect(returnToEditing).not.toHaveBeenCalled()
    act(() => { q(el, 'pz-error-return')!.click() })
    expect(returnToEditing).toHaveBeenCalledTimes(1); expect(retry).toHaveBeenCalledTimes(1)
  })
  it('is disabled while a run is already in flight, so a retry cannot be started twice', () => {
    const { el, retry } = mount({ busy: true })
    expect(q(el, 'pz-error-retry')!.disabled).toBe(true)
    expect(q(el, 'pz-error-return')!.disabled).toBe(true)
    act(() => { q(el, 'pz-error-retry')!.click() })
    expect(retry).not.toHaveBeenCalled()
  })
  it('warns that a retry may use credits again, and never starts a different operation', () => {
    expect(mount().el.textContent).toContain('may use credits again')
  })
  it('falls back to a generic message when none is given', () => {
    expect(mount({ errorMessage: null }).el.textContent).toContain('An unexpected error occurred.')
  })
})
