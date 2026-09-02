import { describe, it, expect } from 'vitest';
import Store from '../../stores/base/Store.js';

describe('debug', () => {
  it('store import', () => {
    console.log('Store type:', typeof Store);
    console.log('Store is function:', typeof Store === 'function');
    const s = new Store();
    console.log('instance:', !!s);
  });
});
