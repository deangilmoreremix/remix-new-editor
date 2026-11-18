// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CaptionDragHandle } from '../CaptionDragHandle'

afterEach(cleanup)

function mount(props: { position?: 'top' | 'middle' | 'bottom'; offsetY?: number; onChange?: (v: number | undefined) => void; onRelease?: () => void } = {}) {
  const onChange = (props.onChange ?? vi.fn()) as ReturnType<typeof vi.fn>
  render(<div data-testid="stage" style={{ position: 'relative' }}><CaptionDragHandle position={props.position ?? 'bottom'} offsetY={props.offsetY} onChange={onChange} onRelease={props.onRelease} /></div>)
  const stage = screen.getByTestId('stage')
  stage.getBoundingClientRect = () => ({ height: 1000, width: 500, top: 0, left: 0, bottom: 1000, right: 500, x: 0, y: 0, toJSON: () => ({}) })
  const handle = screen.getByTestId('caption-drag-handle')
  ;(handle as HTMLElement).setPointerCapture = () => {}
  ;(handle as HTMLElement).releasePointerCapture = () => {}
  return { onChange, handle }
}

describe('CaptionDragHandle', () => {
  it('is a vertical slider that says where the captions are', () => {
    const { handle } = mount({ offsetY: 0.1 })
    expect(handle.getAttribute('role')).toBe('slider')
    expect(handle.getAttribute('aria-valuenow')).toBe('10')
    expect(handle.getAttribute('aria-valuemin')).toBe('-40')
    expect(handle.getAttribute('aria-valuemax')).toBe('40')
    expect(handle.style.top).toBe('78%') // bottom place (88 %) moved up by 10 %
  })
  it('moves the captions by dragging: up raises them by the dragged fraction of the stage', () => {
    const { handle, onChange } = mount()
    fireEvent.pointerDown(handle, { clientY: 800, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 700, pointerId: 1 })
    expect(onChange).toHaveBeenLastCalledWith(0.1)
    fireEvent.pointerMove(handle, { clientY: 900, pointerId: 1 })
    expect(onChange).toHaveBeenLastCalledWith(-0.1)
    fireEvent.pointerUp(handle, { clientY: 900, pointerId: 1 })
    onChange.mockClear()
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 }) // not dragging any more
    expect(onChange).not.toHaveBeenCalled()
  })
  it('turns a drag that ends where it began into "not moved"', () => {
    const { handle, onChange } = mount()
    fireEvent.pointerDown(handle, { clientY: 800, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 800, pointerId: 1 })
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })
  it('moves with the arrow keys (Shift = 5 %), and Home or a double click puts it back', () => {
    const { handle, onChange } = mount({ offsetY: 0.1 })
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(0.11)
    fireEvent.keyDown(handle, { key: 'ArrowDown', shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith(0.05)
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith(undefined)
    onChange.mockClear()
    fireEvent.doubleClick(handle)
    expect(onChange).toHaveBeenLastCalledWith(undefined)
    fireEvent.keyDown(handle, { key: 'a' })
    expect(onChange).toHaveBeenCalledTimes(1)
  })
  it('tells the editor when a drag ends, but not for a plain click or a key press', () => {
    const onRelease = vi.fn()
    const { handle } = mount({ onRelease })
    fireEvent.pointerUp(handle, { clientY: 10, pointerId: 1 }) // no drag was started
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(onRelease).not.toHaveBeenCalled()
    fireEvent.pointerDown(handle, { clientY: 800, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 700, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 700, pointerId: 1 })
    expect(onRelease).toHaveBeenCalledTimes(1)
  })
})
