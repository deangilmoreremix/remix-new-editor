// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ResultView } from '../PersonalizationModal'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }) }))

const base = (original: string, resultTab = 'prompt') => ({
  result: { type: 'prompt' },
  resultTab,
  setResultTab: vi.fn(),
  source: {},
  promptState: { original, personalized: original, edited: '' },
  generateAgain: vi.fn(),
  retryBranding: vi.fn(),
  outputType: 'prompt',
  setOutputType: vi.fn(),
  download: vi.fn(),
  editInImageStudio: vi.fn(),
  editInVideoStudio: vi.fn(),
  publish: vi.fn(),
  sharedMediaCount: 0,
  isVideo: false,
  eligibleModes: [],
  mode: null,
  setMode: vi.fn(),
})

afterEach(cleanup)

describe('ResultView Email tab', () => {
  it('is hidden when the prompt has no {{tokens}}', () => {
    render(<ResultView {...base('A plain prompt')} />)
    expect(screen.queryByRole('button', { name: 'Email' })).toBeNull()
  })

  it('appears when the prompt uses {{tokens}} and switches tabs on click', () => {
    const props = base('Hi {{firstName}} at {{company}}')
    render(<ResultView {...props} />)
    const tab = screen.getByRole('button', { name: 'Email' })
    fireEvent.click(tab)
    expect(props.setResultTab).toHaveBeenCalledWith('email')
  })

  it('shows the email panel with the prompt\'s tokens when the Email tab is active', () => {
    window.localStorage.setItem('pz-email-link-base', 'https://watch.example/v/abc')
    render(<ResultView {...base('Hi {{firstName}} at {{company}}', 'email')} />)
    expect(screen.getByTestId('pz-email-panel')).toBeTruthy()
    expect(screen.getByTestId('pz-email-link').textContent).toMatch(/firstName=.*company=/)
    window.localStorage.clear()
  })
})
