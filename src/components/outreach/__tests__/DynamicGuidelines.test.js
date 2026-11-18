// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openGuidelines, GUIDELINES } from '../DynamicGuidelines.js';

const $ = (s) => document.querySelector(s);
const LANGS = [['English', 'en'], ['Spanish', 'es']];

describe('recording guidelines', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('shows the guidelines for the kind, with the language and the variables', () => {
    openGuidelines({ kind: 'variables', languages: LANGS });
    expect(document.body.textContent).toContain(GUIDELINES.variables.title);
    expect(document.body.textContent).toContain('Choose your language');
    expect(document.body.textContent).toContain('First name');
    expect(document.body.textContent).toContain('Want to change something?');
    expect($('[data-guidelines-language]').value).toBe('English');
  });

  it('Record, the other ways in, the sample, language and Go Back each hand back what was chosen', () => {
    const onRecord = vi.fn(); const onSample = vi.fn(); const onBack = vi.fn(); const onLanguage = vi.fn();
    openGuidelines({ kind: 'greeting', languages: LANGS, onRecord, onSample, onBack, onLanguage });
    const sel = $('[data-guidelines-language]'); sel.value = 'Spanish'; sel.dispatchEvent(new Event('change'));
    expect(onLanguage).toHaveBeenCalledWith('Spanish');
    $('[data-guidelines-record]').click();
    expect(onRecord).toHaveBeenCalledWith('camera');
    expect($('[data-outreach-guidelines]')).toBeNull();

    openGuidelines({ kind: 'greeting', languages: LANGS, onRecord, onSample, onBack });
    $('[data-guidelines-more]').click();
    $('[data-guidelines-mode="screen"]').click();
    expect(onRecord).toHaveBeenLastCalledWith('screen');

    openGuidelines({ kind: 'same', languages: LANGS, onSample, onBack });
    expect(document.body.textContent).toContain(GUIDELINES.same.title);
    $('[data-guidelines-sample]').click();
    expect(onSample).toHaveBeenCalled();

    openGuidelines({ kind: 'same', languages: LANGS, onBack });
    $('[data-guidelines-back]').click();
    expect(onBack).toHaveBeenCalled();
  });

  it('Esc closes without choosing', () => {
    const onClose = vi.fn(); const onRecord = vi.fn();
    openGuidelines({ kind: 'greeting', languages: LANGS, onClose, onRecord });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalled();
    expect(onRecord).not.toHaveBeenCalled();
    expect($('[data-outreach-guidelines]')).toBeNull();
  });
});
