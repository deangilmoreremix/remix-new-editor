// [remix] The effect / look / transition thumbnails are drawn from three sample pictures that sampleFrames.ts loads from /library-previews/.
// They once lived only in the upstream app, so every thumbnail stayed blank here; this keeps them in public/.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('library preview sample pictures', () => {
  const src = readFileSync(resolve(__dirname, '../../openchatcut/gl/sampleFrames.ts'), 'utf8');
  const urls = [...src.matchAll(/'(\/library-previews\/[^'?]+)/g)].map((m) => m[1]);
  it('lists the three sample frames', () => { expect(urls.length).toBe(3); });
  it.each(urls)('%s exists under public/', (u) => { expect(existsSync(resolve(__dirname, '../../../public', u.slice(1)))).toBe(true); });
});
