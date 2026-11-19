// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LayerEffectsControls } from '../LayerEffectsControls'
import { createLayer } from '../../../preview/presets'
import type { LayerEffects } from '../../../preview/effects'

afterEach(cleanup)

const brand = { primary: '#d9ff00', accent: '#22c55e', text: '#ffffff' }
const layerWith = (effects?: LayerEffects) => ({ ...createLayer('logo'), id: 'l1', effects })

function setup(effects?: LayerEffects) {
  const onChange = vi.fn()
  render(<LayerEffectsControls layer={layerWith(effects)} onChange={onChange} brand={brand} />)
  return onChange
}

describe('LayerEffectsControls', () => {
  it('starts neutral with Reset disabled', () => {
    setup()
    expect((screen.getByTestId('fx-reset') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('fx-brightness') as HTMLInputElement).value).toBe('1')
    expect((screen.getByTestId('fx-blur') as HTMLInputElement).value).toBe('0')
  })

  it('changing a slider reports the full effects with only that value changed', () => {
    const onChange = setup()
    fireEvent.change(screen.getByTestId('fx-brightness'), { target: { value: '1.4' } })
    expect(onChange).toHaveBeenLastCalledWith({ brightness: 1.4, contrast: 1, saturation: 1, blur: 0 })
  })

  it('putting everything back to neutral reports undefined, so nothing is stored', () => {
    const onChange = setup({ brightness: 1.4, contrast: 1, saturation: 1, blur: 0 })
    fireEvent.change(screen.getByTestId('fx-brightness'), { target: { value: '1' } })
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it('glow shows a color control once on, and a zero shadow/glow is dropped', () => {
    const onChange = setup()
    expect(screen.queryByLabelText('Glow color')).toBeNull()
    fireEvent.change(screen.getByTestId('fx-glow'), { target: { value: '0.5' } })
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ glow: { color: '#d9ff00', amount: 0.5 } }))
    cleanup()
    const onChange2 = setup({ brightness: 1, contrast: 1, saturation: 1, blur: 0, shadow: 0.4 })
    fireEvent.change(screen.getByTestId('fx-shadow'), { target: { value: '0' } })
    expect(onChange2).toHaveBeenLastCalledWith(undefined)
  })

  it('Reset removes all effects', () => {
    const onChange = setup({ brightness: 1.5, contrast: 1, saturation: 1, blur: 3 })
    fireEvent.click(screen.getByTestId('fx-reset'))
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it('shows a glow color control when one is stored', () => {
    setup({ brightness: 1, contrast: 1, saturation: 1, blur: 0, glow: { color: '#ffee00', amount: 0.5 } })
    expect(screen.getByLabelText('Glow color')).toBeTruthy()
  })
})
