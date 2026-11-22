// @vitest-environment node
// Every real answer id must survive the funnel telemetry (browser client and server function). A character the
// allowlist rejects silently drops that answer from the report ("100+" and "25+" once did).
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../muapi.js', () => ({ muapi: {} }));
const { safeProps } = await import('../telemetry.js');
const { normalizeEvent } = await import('../../../../netlify/functions/onboarding-events.js');
const { TEAM_SIZES, VOLUMES, SOURCES } = await import('../../outreach/onboarding.js');
const { GOAL_CARDS, VIDEO_TYPES, toolIds } = await import('../toolCatalog.js');

const groups = {
  goal: GOAL_CARDS.map((x) => x.id), team: TEAM_SIZES.map((x) => x.id), volume: VOLUMES.map((x) => x.id), heard: SOURCES.map((x) => x.id),
};

describe('funnel answer ids are never dropped', () => {
  it('the browser client keeps every goal, team size, volume, source, video type and studio id', () => {
    for (const [field, ids] of Object.entries(groups)) for (const id of ids) expect(safeProps({ [field]: id }), `${field}=${id}`).toEqual({ [field]: id });
    for (const id of [...VIDEO_TYPES.map((t) => t.id), ...toolIds()]) expect(safeProps({ x: id }), id).toEqual({ x: id });
  });
  it('the server keeps them in step_answer and complete events', () => {
    for (const [field, ids] of Object.entries(groups)) {
      for (const id of ids) {
        expect(normalizeEvent({ event: 'step_answer', seq: 1, step: 2, props: { field, value: id } })?.props, `${field}=${id}`).toEqual({ field, value: id });
        expect(normalizeEvent({ event: 'complete', seq: 2, props: { [field]: id } })?.props, `complete ${field}=${id}`).toEqual({ [field]: id });
      }
    }
    const types = VIDEO_TYPES.map((t) => t.id); const tools = toolIds();
    expect(normalizeEvent({ event: 'complete', seq: 3, props: { types, tools, primary: tools[0] } }).props).toEqual({ types, tools, primary: tools[0] });
  });
  it('still rejects anything that is not an id', () => {
    expect(safeProps({ v: 'Acme Corp' })).toEqual({});
    expect(normalizeEvent({ event: 'step_answer', seq: 1, props: { field: 'volume', value: '100 + <b>' } })).toBeNull();
  });
});
