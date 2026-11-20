import { describe, it, expect } from 'vitest';
import { gatesOnTimeline } from '@cinegen/lib/overlays/overlays';

describe('gatesOnTimeline', () => {
  it('a Lead Generator follows the timeline by default or when set to "time"', () => {
    expect(gatesOnTimeline({ type: 'lead-form' })).toBe(true);
    expect(gatesOnTimeline({ type: 'lead-form', trigger: 'time' })).toBe(true);
    expect(gatesOnTimeline({ type: 'lead-form', trigger: '' })).toBe(true);
  });
  it('"at the end", "when the viewer pauses" and "exit intent" do not gate the editor preview', () => {
    for (const trigger of ['end', 'pause', 'exit']) expect(gatesOnTimeline({ type: 'lead-form', trigger })).toBe(false);
  });
  it('everything else always follows the timeline, whatever a stray trigger says', () => {
    expect(gatesOnTimeline({ type: 'list-builder', trigger: 'pause' })).toBe(true);
    expect(gatesOnTimeline({ type: 'click-to-call', trigger: 'exit' })).toBe(true);
  });
});
