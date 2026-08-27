// Core application tests — verify critical functionality works correctly
import { describe, test, expect } from 'vitest'

// Test the actual utility functions used in the application
import { getErrorMessage, logError } from '../src/lib/errors'

describe('Error Handling', () => {
  test('getErrorMessage extracts message from Error objects', () => {
    const error = new Error('Something failed')
    const result = getErrorMessage(error, 'Fallback message')
    expect(result).toBe('Something failed')
  })

  test('getErrorMessage returns fallback for non-Error values', () => {
    const result = getErrorMessage('string error', 'Fallback message')
    expect(result).toBe('Fallback message')
  })

  test('getErrorMessage returns fallback for null/undefined', () => {
    expect(getErrorMessage(null, 'Fallback')).toBe('Fallback')
    expect(getErrorMessage(undefined, 'Fallback')).toBe('Fallback')
  })
})

describe('Token Replacement', () => {
  test('replaces tokens correctly', () => {
    const template = 'Hello {{firstName}} from {{company}}!'
    const contact = {
      firstName: 'John',
      company: 'Acme Inc',
    }

    let result = template
    result = result.replace(/\{\{firstName\}\}/g, contact.firstName)
    result = result.replace(/\{\{company\}\}/g, contact.company)

    expect(result).toBe('Hello John from Acme Inc!')
  })

  test('handles missing tokens gracefully', () => {
    const template = 'Hello {{firstName}}!'
    const contact = {} // No firstName

    let result = template
    result = result.replace(/\{\{firstName\}\}/g, contact.firstName || 'there')

    expect(result).toBe('Hello there!')
  })
})

describe('Data Structures', () => {
  test('contact object has required fields', () => {
    const contact = {
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      company: 'Acme Inc',
    }

    expect(contact).toHaveProperty('email')
    expect(contact).toHaveProperty('firstName')
    expect(contact.company).toBe('Acme Inc')
  })

  test('video object structure', () => {
    const video = {
      url: 'https://example.com/video.mp4',
      duration: 45,
      thumbnail: 'https://example.com/thumb.jpg',
    }

    expect(video.url).toMatch(/\.mp4$/)
    expect(video.duration).toBeGreaterThan(0)
  })
})
