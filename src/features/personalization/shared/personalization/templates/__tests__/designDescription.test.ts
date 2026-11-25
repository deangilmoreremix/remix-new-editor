import { describe, it, expect } from 'vitest'
import { designDescription } from '../designDescription'

describe('designDescription', () => {
  it('tells the customer a transition plays at the start', () => {
    expect(designDescription({ description: 'Blinds open.', category: 'transition' })).toBe('Blinds open. Plays at the start of your video.')
  })
  it('leaves every other category unchanged', () => {
    expect(designDescription({ description: 'A headline.', category: 'animated-headline' })).toBe('A headline.')
  })
})
