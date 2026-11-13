import { describe, it, expect } from 'vitest';
import { parseCSV, renderScript, normalizeKey } from '../lib/personalizedVideoEngine.js';

describe('personalizedVideoEngine', () => {
  it('normalizes headers', () => {
    expect(normalizeKey('First Name')).toBe('first_name');
  });

  it('parses quoted CSV with commas, escaped quotes and CRLF', () => {
    const rows = parseCSV('First Name,Company\r\nAda,"Acme, Inc"\r\nBob,"He said ""hi"""\r\n');
    expect(rows).toEqual([
      { first_name: 'Ada', company: 'Acme, Inc' },
      { first_name: 'Bob', company: 'He said "hi"' },
    ]);
  });

  it('renders tokens and reports missing ones', () => {
    const r = renderScript('Hi {{First_Name}} at {{company}}', { first_name: 'Ada' });
    expect(r.text).toBe('Hi Ada at');
    expect(r.missing).toEqual(['company']);
  });
});
