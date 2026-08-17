// Tests for the personalization token layer.
//
// These lock down the bug that made the whole personalizer a no-op: token
// chips inserted `{{First Name}}` (display label) while the resolver only
// understood `{{firstName}}` (camelCase key), so every token survived
// untouched into the generated prompt.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TOKEN_DEFS,
  TOKEN_KEYS,
  TOKEN_LABELS,
  canonicalTokenKey,
  normalizeTokenName,
  resolveToken,
  buildVariables,
  extractTokens,
} from '../components/personalize/tokenSchema.js';

// personalizePopover reads localStorage at module scope only inside
// functions, so importing it is safe under the stubbed localStorage.
import {
  replaceTokensInPrompt,
  inspectPromptTokens,
  insertTokenAtCursor,
  getSelectedContactId,
  setSelectedContactId,
} from '../components/personalize/personalizePopover.js';

/** A realistic profile shaped like what the modal/backend persists. */
function makeProfile(overrides = {}) {
  return {
    id: 'c_1',
    contact: {
      name: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@analytical.dev',
      company: 'Analytical Engines',
      title: 'Chief Mathematician',
      location: 'London',
      avatarUrl: 'https://img.example/ada.png',
    },
    company: {
      name: 'Analytical Engines',
      industry: 'Computing',
      summary: 'Builds programmable engines.',
    },
    brand: { colors: { primary: '#d9ff00', secondary: '#111111' } },
    social: {
      github: 'https://github.com/ada',
      linkedin: 'https://linkedin.com/in/ada',
      twitter: 'https://x.com/ada',
      website: 'https://analytical.dev',
    },
    website: { url: 'https://analytical.dev', title: 'Analytical Engines' },
    assets: { avatar: ['https://img.example/ada.png'], logos: ['https://img.example/logo.svg'] },
    intelligence: {
      summary: 'Pioneer of general-purpose computing.',
      painPoints: ['Manual calculation is slow'],
      products: ['Analytical Engine'],
      services: ['Consulting'],
      interests: ['Mathematics'],
      buyingSignals: ['Published a new paper'],
      tone: 'technical',
    },
    variables: {},
    ...overrides,
  };
}

describe('tokenSchema', () => {
  it('normalizes names insensitive to case, spaces, punctuation', () => {
    const expected = 'firstname';
    for (const variant of ['firstName', 'First Name', 'first_name', 'FIRST-NAME', ' first name ']) {
      expect(normalizeTokenName(variant)).toBe(expected);
    }
  });

  it('maps canonical keys, labels and aliases to the canonical key', () => {
    expect(canonicalTokenKey('firstName')).toBe('firstName');
    expect(canonicalTokenKey('First Name')).toBe('firstName');
    expect(canonicalTokenKey('first_name')).toBe('firstName');
    expect(canonicalTokenKey('Pain Point')).toBe('painPoint');
    expect(canonicalTokenKey('X / Twitter')).toBe('twitter');
    expect(canonicalTokenKey('Summary')).toBe('intelligenceSummary');
    expect(canonicalTokenKey('not-a-real-token')).toBeNull();
  });

  it('exposes a label for every canonical key', () => {
    for (const key of TOKEN_KEYS) {
      expect(typeof TOKEN_LABELS[key]).toBe('string');
      expect(TOKEN_LABELS[key].length).toBeGreaterThan(0);
    }
  });

  it('never registers a duplicate canonical key', () => {
    expect(new Set(TOKEN_KEYS).size).toBe(TOKEN_KEYS.length);
  });

  it('resolves every token from the nested profile even when variables is empty', () => {
    const profile = makeProfile();
    // variables is {} — resolution must fall back to the nested paths.
    for (const def of TOKEN_DEFS) {
      const value = resolveToken(profile, def.key);
      expect(value, `expected ${def.key} to resolve from nested profile`).not.toBeNull();
    }
  });

  it('prefers profile.variables over the nested fallback path', () => {
    const profile = makeProfile({ variables: { firstName: 'Augusta' } });
    expect(resolveToken(profile, 'firstName')).toBe('Augusta');
    expect(resolveToken(profile, 'First Name')).toBe('Augusta');
  });

  it('resolves a legacy label-keyed variables map', () => {
    // Older persisted profiles may have been written with label keys.
    const profile = makeProfile({ contact: {}, company: {}, intelligence: {}, variables: { 'First Name': 'Grace' } });
    expect(resolveToken(profile, 'firstName')).toBe('Grace');
  });

  it('treats empty strings and whitespace as unresolved', () => {
    const profile = makeProfile({
      contact: { firstName: '   ' },
      company: {},
      social: {},
      assets: {},
      website: {},
      intelligence: {},
      brand: {},
      variables: {},
    });
    expect(resolveToken(profile, 'firstName')).toBeNull();
  });

  it('buildVariables produces a flat map covering the resolvable tokens', () => {
    const vars = buildVariables(makeProfile());
    expect(vars.firstName).toBe('Ada');
    expect(vars.industry).toBe('Computing');
    expect(vars.painPoint).toBe('Manual calculation is slow');
    expect(vars.product).toBe('Analytical Engine');
    expect(vars.service).toBe('Consulting');
    expect(vars.tone).toBe('technical');
    expect(vars.brandColor).toBe('#d9ff00');
    expect(vars.logoUrl).toBe('https://img.example/logo.svg');
    expect(vars.twitter).toBe('https://x.com/ada');
    // Regression: these four were the only enrichment fields the modal used
    // to write, and they were always empty strings.
    for (const key of ['industry', 'painPoint', 'product', 'service']) {
      expect(vars[key], `${key} must not be empty`).toBeTruthy();
    }
  });

  it('buildVariables lets the seed win', () => {
    const vars = buildVariables(makeProfile(), { firstName: 'Seeded' });
    expect(vars.firstName).toBe('Seeded');
  });

  it('extractTokens finds multi-word and punctuated tokens', () => {
    const tokens = extractTokens('Hi {{First Name}} at {{company}} — {{X / Twitter}} {{First Name}}');
    expect(tokens).toEqual(['First Name', 'company', 'X / Twitter']);
  });
});

describe('replaceTokensInPrompt', () => {
  it('resolves canonical camelCase tokens', () => {
    const out = replaceTokensInPrompt('Hello {{firstName}} from {{company}}', makeProfile());
    expect(out).toBe('Hello Ada from Analytical Engines');
  });

  it('resolves display-label tokens (the original bug)', () => {
    // Before the fix this returned the input unchanged.
    const out = replaceTokensInPrompt('Hello {{First Name}} {{Last Name}}', makeProfile());
    expect(out).toBe('Hello Ada Lovelace');
    expect(out).not.toContain('{{');
  });

  it('resolves single-word labels whose case differs from the key', () => {
    // `{{Company}}` matched the old regex but looked up vars['Company'].
    const out = replaceTokensInPrompt('At {{Company}} in {{Location}}', makeProfile());
    expect(out).toBe('At Analytical Engines in London');
  });

  it('tolerates internal whitespace padding', () => {
    expect(replaceTokensInPrompt('Hi {{  firstName  }}', makeProfile())).toBe('Hi Ada');
  });

  it('leaves genuinely unknown tokens in place', () => {
    const out = replaceTokensInPrompt('Hi {{firstName}}, ref {{orderNumber}}', makeProfile());
    expect(out).toBe('Hi Ada, ref {{orderNumber}}');
  });

  it('leaves known-but-unpopulated tokens in place', () => {
    const bare = {
      contact: { firstName: 'Ada' },
      company: {},
      social: {},
      assets: {},
      website: {},
      intelligence: {},
      brand: {},
      variables: {},
    };
    const out = replaceTokensInPrompt('Hi {{firstName}} at {{industry}}', bare);
    expect(out).toBe('Hi Ada at {{industry}}');
  });

  it('resolves every label the chips can render', () => {
    const profile = makeProfile();
    profile.variables = buildVariables(profile);
    for (const def of TOKEN_DEFS) {
      // Simulate a prompt written with the human label.
      const out = replaceTokensInPrompt(`X {{${def.label}}} Y`, profile);
      expect(out, `label "${def.label}" must resolve`).not.toContain('{{');
    }
  });

  it('returns the prompt unchanged when there is no profile', () => {
    expect(replaceTokensInPrompt('Hi {{firstName}}', null)).toBe('Hi {{firstName}}');
  });

  it('does not throw on empty input', () => {
    expect(replaceTokensInPrompt('', makeProfile())).toBe('');
    expect(replaceTokensInPrompt(null, makeProfile())).toBe(null);
  });
});

describe('inspectPromptTokens', () => {
  it('separates resolved from unresolved tokens', () => {
    const { resolved, unresolved } = inspectPromptTokens(
      'Hi {{First Name}} at {{company}}, ref {{orderNumber}}',
      makeProfile()
    );
    expect(resolved.map((r) => r.token)).toEqual(['First Name', 'company']);
    expect(unresolved).toEqual(['orderNumber']);
  });

  it('reports all tokens unresolved when no profile is selected', () => {
    const { resolved, unresolved } = inspectPromptTokens('{{firstName}} {{company}}', null);
    expect(resolved).toEqual([]);
    expect(unresolved).toEqual(['firstName', 'company']);
  });
});

describe('insertTokenAtCursor', () => {
  let ta;

  beforeEach(() => {
    ta = document.createElement('textarea');
    document.body.appendChild(ta);
  });

  it('inserts at the caret and fires an input event', () => {
    ta.value = 'Hello world';
    ta.setSelectionRange(5, 5);
    const onInput = vi.fn();
    ta.addEventListener('input', onInput);

    insertTokenAtCursor(ta, '{{firstName}}');

    expect(ta.value).toBe('Hello {{firstName}} world');
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it('replaces the current selection', () => {
    ta.value = 'Hello NAME here';
    ta.setSelectionRange(6, 10);
    insertTokenAtCursor(ta, '{{firstName}}');
    expect(ta.value).toBe('Hello {{firstName}} here');
  });

  it('inserts a token that the resolver can then resolve', () => {
    ta.value = 'Hi';
    ta.setSelectionRange(2, 2);
    insertTokenAtCursor(ta, '{{firstName}}');
    expect(replaceTokensInPrompt(ta.value, makeProfile()).trim()).toBe('Hi Ada');
  });

  it('is a no-op for a missing textarea', () => {
    expect(() => insertTokenAtCursor(null, '{{firstName}}')).not.toThrow();
  });
});

describe('selected contact id', () => {
  beforeEach(() => {
    // src/test/setup.js stubs localStorage with non-storing vi.fn()s, so
    // install a real Map-backed shim for these assertions.
    const store = new Map();
    global.localStorage.getItem = vi.fn((k) => (store.has(k) ? store.get(k) : null));
    global.localStorage.setItem = vi.fn((k, v) => store.set(k, String(v)));
    global.localStorage.removeItem = vi.fn((k) => store.delete(k));
  });

  it('round-trips an id', () => {
    setSelectedContactId('c_42');
    expect(getSelectedContactId()).toBe('c_42');
  });

  it('returns null (not empty string) after clearing', () => {
    setSelectedContactId('c_42');
    setSelectedContactId(null);
    expect(getSelectedContactId()).toBeNull();
  });
});
