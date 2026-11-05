import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { leadFieldTokens } from '../index.js';

const page = readFileSync(resolve(__dirname, '../../../../components/TimelineEditorPage.jsx'), 'utf8');

describe('Lead Generator fields (upstream form.js parity)', () => {
  it('keys answers by the upper-cased label token, suffixing duplicates', () => {
    expect(leadFieldTokens([
      { id: 'email', label: 'Email' },
      { id: 'field_2', label: 'Phone number' },
      { id: 'field_3', label: 'email' },
      { id: 'x', label: '' },
    ])).toEqual(['EMAIL', 'PHONE NUMBER', 'EMAIL_2', 'X']);
  });

  it('preview caps single-line at 80 and multiline at 250, with digit-only Number', () => {
    expect(page).toMatch(/<textarea name="\$\{token\}"[^`]*maxlength="250"/);
    expect(page).toMatch(/inputmode="numeric" pattern="\\\\d\*" maxlength="80" data-digits-only/);
    expect(page).toContain("' maxlength=\"80\"'");
    expect(page).toContain("input.value = input.value.replace(/[^0-9]/g, '')");
  });

  it('fields are optional unless marked required, with a per-field checkbox', () => {
    expect(page).toContain("const req = f.required ? ' required' : '';");
    expect(page).not.toMatch(/name="\$\{f\.id\}"[^`]*required \/>/);
    expect(page).toContain('class="lf-field-required"');
    expect(page).toContain('clip.fields[index].required = e.target.checked;');
  });
});
