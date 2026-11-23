// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CaptionDragHandle } from '../CaptionDragHandle'

afterEach(cleanup)

function mount(props: { y?: number; onChange?: (v: number | undefined) => void; onRelease?: () => void } = {}) {
  const onChange = (props.onChange ?? vi.fn()) as ReturnType<typeof vi.fn>
  render(<div data-testid="stage" style={{ position: 'relative' }}><CaptionDragHandle y={props.y ?? 0.8} onChange={onChange} onRelease={props.onRelease} /></div>)
  const stage = screen.getByTestId('stage')
  stage.getBoundingClientRect = () => ({ height: 1000, width: 500, top: 0, left: 0, bottom: 1000, right: 500, x: 0, y: 0, toJSON: () => ({}) })
  const handle = screen.getByTestId('caption-drag-handle')
  ;(handle as HTMLElement).setPointerCapture = () => {}
  ;(handle as HTMLElement).releasePointerCapture = () => {}
  return { onChange, handle }
}

describe('CaptionDragHandle', () => {
  it('is a vertical slider level with the captions', () => {
    const { handle } = mount({ y: 0.8 })
    expect(handle.getAttribute('role')).toBe('slider')
    expect(handle.getAttribute('aria-valuenow')).toBe('80')
    expect(handle.style.top).toBe('80%')
  })
  it('moves the captions by dragging: down raises the height by the dragged fraction of the stage', () => {
    const { handle, onChange } = mount({ y: 0.5 })
    fireEvent.pointerDown(handle, { clientY: 500, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 600, pointerId: 1 })
    expect(onChange).toHaveBeenLastCalledWith(0.6)
    fireEvent.pointerMove(handle, { clientY: 400, pointerId: 1 })
    expect(onChange).toHaveBeenLastCalledWith(0.4)
    fireEvent.pointerUp(handle, { clientY: 400, pointerId: 1 })
    onChange.mockClear()
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 }) // not dragging any more
    expect(onChange).not.toHaveBeenCalled()
  })
  it('moves with the arrow keys (Shift = 5 %), and Home or a double click puts it back in its place', () => {
    const { handle, onChange } = mount({ y: 0.5 })
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(0.49)
    fireEvent.keyDown(handle, { key: 'ArrowDown', shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith(0.55)
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith(undefined)
    onChange.mockClear()
    fireEvent.doubleClick(handle)
    expect(onChange).toHaveBeenLastCalledWith(undefined)
    fireEvent.keyDown(handle, { key: 'a' })
    expect(onChange).toHaveBeenCalledTimes(1)
  })
  it('tells the editor when a drag that moved ends, but not for a click, a key press or a press that never moved', () => {
    const onRelease = vi.fn()
    const { handle } = mount({ onRelease })
    fireEvent.pointerUp(handle, { clientY: 10, pointerId: 1 }) // no drag was started
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    fireEvent.pointerDown(handle, { clientY: 800, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 800, pointerId: 1 }) // pressed and let go without moving
    expect(onRelease).not.toHaveBeenCalled()
    fireEvent.pointerDown(handle, { clientY: 800, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 700, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 700, pointerId: 1 })
    expect(onRelease).toHaveBeenCalledTimes(1)
  })
})
