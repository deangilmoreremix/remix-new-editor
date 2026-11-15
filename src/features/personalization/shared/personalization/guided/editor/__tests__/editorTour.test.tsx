// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EditorTour, TOUR_STEPS, TOUR_STORAGE_KEY } from '../EditorTour'

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('EditorTour', () => {
  it('opens for a first-time user and walks the steps in order', () => {
    render(<EditorTour />)
    expect(screen.getByTestId('editor-tour')).toBeTruthy()
    expect(screen.getByText(`Step 1 of ${TOUR_STEPS.length}`)).toBeTruthy()
    expect((screen.getByTestId('editor-tour-back') as HTMLButtonElement).disabled).toBe(true)
    for (let i = 1; i < TOUR_STEPS.length; i++) {
      fireEvent.click(screen.getByTestId('editor-tour-next'))
      expect(screen.getByText(`Step ${i + 1} of ${TOUR_STEPS.length}`)).toBeTruthy()
    }
    expect(screen.queryByTestId('editor-tour-next')).toBeNull()
    fireEvent.click(screen.getByTestId('editor-tour-back'))
    expect(screen.getByText(`Step ${TOUR_STEPS.length - 1} of ${TOUR_STEPS.length}`)).toBeTruthy()
  })

  it('Done and Skip close it and remember that, so it stays closed next time', () => {
    const { unmount } = render(<EditorTour />)
    fireEvent.click(screen.getByTestId('editor-tour-skip'))
    expect(screen.queryByTestId('editor-tour')).toBeNull()
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBe('1')
    unmount()
    render(<EditorTour />)
    expect(screen.queryByTestId('editor-tour')).toBeNull()
  })

  it('Quick tour reopens it from the first step after it was dismissed', () => {
    window.localStorage.setItem(TOUR_STORAGE_KEY, '1')
    render(<EditorTour />)
    expect(screen.queryByTestId('editor-tour')).toBeNull()
    fireEvent.click(screen.getByTestId('editor-tour-open'))
    expect(screen.getByText(`Step 1 of ${TOUR_STEPS.length}`)).toBeTruthy()
  })

  it('shows and hides the shortcut cheat sheet', () => {
    window.localStorage.setItem(TOUR_STORAGE_KEY, '1')
    render(<EditorTour />)
    const toggle = screen.getByTestId('editor-shortcuts-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(screen.getByTestId('editor-shortcuts').textContent).toContain('Undo')
    fireEvent.click(toggle)
    expect(screen.queryByTestId('editor-shortcuts')).toBeNull()
  })

  it('still works when storage throws', () => {
    const get = Storage.prototype.getItem
    const set = Storage.prototype.setItem
    Storage.prototype.getItem = () => { throw new Error('blocked') }
    Storage.prototype.setItem = () => { throw new Error('blocked') }
    try {
      render(<EditorTour />)
      expect(screen.getByTestId('editor-tour')).toBeTruthy()
      act(() => { fireEvent.click(screen.getByTestId('editor-tour-skip')) })
      expect(screen.queryByTestId('editor-tour')).toBeNull()
    } finally {
      Storage.prototype.getItem = get
      Storage.prototype.setItem = set
    }
  })
})
