import { describe, expect, it } from 'vitest';
import { isDataKey, patchDataBlob } from '../../lib/editor/remotion/hyperframes/config.js';
import { validateOverrides } from '../../lib/editor/remotion/hyperframes/security.js';

const BLOB = '{ "messages": [ { "side": "incoming", "text": "hi", "sender": "A" }, { "side": "outgoing", "text": "yo" } ], "stagger": 0.8 }';

describe('data.* overrides (JSON data blob of a block)', () => {
  it('accepts plain paths with array indices and rejects unsafe ones', () => {
    expect(isDataKey('data.messages.0.text')).toBe(true);
    for (const k of ['data.', 'data.__proto__.x', 'data.a.constructor', 'data.a..b', 'data.a-b', 'data.0.x', 'cfg.a', 'data.' + 'x'.repeat(130)]) expect(isDataKey(k)).toBe(false);
  });
  it('replaces only existing leaves of the same type', () => {
    const out = JSON.parse(patchDataBlob(BLOB, { 'data.messages.0.text': 'Hello', 'data.messages.1.text': 'Yes', 'data.stagger': 0.5, 'data.messages.5.text': 'nope', 'data.messages.0.extra': 'nope', 'data.stagger2': 1 }));
    expect(out.messages[0].text).toBe('Hello'); expect(out.messages[1].text).toBe('Yes'); expect(out.stagger).toBe(0.5);
    expect(out.messages[0].extra).toBeUndefined(); expect(out.messages.length).toBe(2);
  });
  it('rejects a type change and leaves invalid JSON untouched', () => {
    expect(patchDataBlob(BLOB, { 'data.stagger': 'fast' })).toBe(BLOB);
    expect(patchDataBlob('not json', { 'data.a': 'x' })).toBe('not json');
  });
  it('validates values through the shared override validator', () => {
    const { cleaned, rejected } = validateOverrides({ 'data.messages.0.text': 'Hello', 'data.__proto__.x': 'bad', 'data.a': { x: 1 } as unknown as string }, {});
    expect(cleaned['data.messages.0.text']).toBe('Hello'); expect(Object.keys(cleaned)).toEqual(['data.messages.0.text']); expect(rejected.length).toBe(2);
  });
});
