import { describe, it, expect } from 'vitest';
import { contactsFromPicker, contactPickerSupported } from '../draft.js';

describe('Contact Picker', () => {
  it('is offered only where navigator.contacts.select exists', () => {
    expect(contactPickerSupported({ contacts: { select: () => {} } })).toBe(true);
    expect(contactPickerSupported({})).toBe(false);
    expect(contactPickerSupported(undefined)).toBe(false);
  });

  it('splits names, takes the first valid email, skips people without one', () => {
    const { contacts, skipped } = contactsFromPicker([
      { name: ['Mike Ross'], email: ['mike@linear.example'] },
      { name: ['Priya van der Berg'], email: ['not-an-email', 'priya@notion.example'] },
      { name: ['Cher'], email: ['cher@example.com'] },
      { name: ['No Email'], email: [] },
      { name: [], email: ['solo@example.com'] },
      null,
    ]);
    expect(contacts.map((c) => [c.firstName, c.lastName, c.email])).toEqual([
      ['Mike', 'Ross', 'mike@linear.example'],
      ['Priya', 'van der Berg', 'priya@notion.example'],
      ['Cher', '', 'cher@example.com'],
      ['', '', 'solo@example.com'],
    ]);
    expect(contacts.every((c) => c.id)).toBe(true);
    expect(skipped).toBe(2);
  });

  it('handles nothing picked', () => {
    expect(contactsFromPicker([])).toEqual({ contacts: [], skipped: 0 });
    expect(contactsFromPicker(undefined)).toEqual({ contacts: [], skipped: 0 });
  });
});
