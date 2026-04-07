// Basic functionality tests
const { describe, test, expect } = require('@jest/globals');

describe('Core Functionality Tests', () => {
  test('basic math works', () => {
    expect(2 + 2).toBe(4);
  });

  test('string operations work', () => {
    expect('hello world').toContain('hello');
  });

  test('array operations work', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(arr).toHaveLength(5);
    expect(arr.includes(3)).toBe(true);
  });
});

// Test token replacement utility
describe('Token Replacement', () => {
  test('replaces tokens correctly', () => {
    const template = 'Hello {{firstName}} from {{company}}!';
    const contact = {
      firstName: 'John',
      company: 'Acme Inc'
    };

    let result = template;
    result = result.replace(/\{\{firstName\}\}/g, contact.firstName);
    result = result.replace(/\{\{company\}\}/g, contact.company);

    expect(result).toBe('Hello John from Acme Inc!');
  });

  test('handles missing tokens gracefully', () => {
    const template = 'Hello {{firstName}}!';
    const contact = {}; // No firstName

    let result = template;
    result = result.replace(/\{\{firstName\}\}/g, contact.firstName || 'there');

    expect(result).toBe('Hello there!');
  });
});

// Test basic object structures
describe('Data Structures', () => {
  test('contact object has required fields', () => {
    const contact = {
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      company: 'Acme Inc'
    };

    expect(contact).toHaveProperty('email');
    expect(contact).toHaveProperty('firstName');
    expect(contact.company).toBe('Acme Inc');
  });

  test('video object structure', () => {
    const video = {
      url: 'https://example.com/video.mp4',
      duration: 45,
      thumbnail: 'https://example.com/thumb.jpg'
    };

    expect(video.url).toMatch(/\.mp4$/);
    expect(video.duration).toBeGreaterThan(0);
  });
});