import { describe, it, expect } from 'vitest';
import { insertAt, removeNode, updateNode, walkFlow, validateFlow, newTrigger, newAction, newCondition, newDelay, findNode, countNodes, linearToFlow, normalizeAutomation, formatDelay, describeNode } from '../domain/flow';
import { layoutCanvas, type CNode } from '../ui/canvas/layout';
import type { Contact, FlowNode } from '../types';

const contact = { id: 'c', firstName: 'A', lastName: 'B', company: 'Acme', email: 'a@acme.com' } as Contact;
const ctx = (label: string) => ({ trigger: 'reply-received' as const, contact, label });
const sample = (): FlowNode => {
  let f = newTrigger();
  const cond = newCondition(); cond.conditions = [{ field: 'label', op: 'equals', value: 'interested' }]; cond.id = 'cond';
  f = insertAt(f, f.id, 'next', cond);
  f = insertAt(f, 'cond', 'yes', { ...newAction('create-deal', '5000'), id: 'deal' });
  f = insertAt(f, 'deal', 'next', { ...newDelay(60), id: 'wait' });
  f = insertAt(f, 'wait', 'next', { ...newAction('create-task', 'Follow up'), id: 'task' });
  f = insertAt(f, 'cond', 'no', { ...newAction('tag', 'cold'), id: 'cold' });
  return f;
};

describe('flow ops', () => {
  it('walks the yes and no branches with delays accumulating', () => {
    const f = sample();
    const yes = walkFlow(f, ctx('interested')); expect(yes.branches['cond']).toBe('yes');
    expect(yes.steps.map(s => [s.action ?? 'delay', s.atMinutes])).toEqual([['create-deal', 0], ['delay', 60], ['create-task', 60]]);
    const no = walkFlow(f, ctx('question')); expect(no.branches['cond']).toBe('no'); expect(no.steps.map(s => s.action)).toEqual(['tag']);
  });
  it('insert between keeps the continuation after the new node', () => {
    let f = sample(); f = insertAt(f, 'deal', 'next', { ...newAction('notify', 'hi'), id: 'mid' });
    expect(findNode(f, 'mid')!.next!.id).toBe('wait'); expect(countNodes(f)).toBe(7);
  });
  it('inserting a condition into an occupied slot moves the old chain to Yes', () => {
    let f = sample(); const c2 = newCondition(); c2.id = 'c2'; f = insertAt(f, 'cond', 'yes', c2);
    expect(findNode(f, 'c2')!.yes!.id).toBe('deal');
  });
  it('removes a node by splicing, keeps the trigger, and is immutable', () => {
    const f = sample(); const before = JSON.stringify(f);
    const g = removeNode(f, 'deal'); expect(findNode(g, 'cond')!.yes!.id).toBe('wait'); expect(JSON.stringify(f)).toBe(before);
    expect(removeNode(f, f.id)).toBe(f);
    const h = removeNode(f, 'cond'); expect(h.next!.id).toBe('deal'); // condition removal keeps its Yes branch
  });
  it('updates a node immutably', () => {
    const f = sample(); const g = updateNode(f, 'deal', { value: '9' }); expect(findNode(g, 'deal')!.value).toBe('9'); expect(findNode(f, 'deal')!.value).toBe('5000');
  });
  it('validates', () => {
    expect(validateFlow(sample())).toEqual([]);
    expect(validateFlow(newTrigger())).toContain('Add at least one action');
    const bad = insertAt(newTrigger(), newTrigger().id, 'next', newAction('tag', ''));
    expect(validateFlow(bad).length).toBeGreaterThan(0);
    expect(validateFlow(insertAt(sample(), 'cold', 'next', newDelay(0)))).toContain('A delay must be longer than zero');
  });
  it('migrates the old linear shape', () => {
    const f = linearToFlow('reply-received', [{ field: 'label', op: 'equals', value: 'interested' }], [{ kind: 'tag', value: 'hot' }]);
    expect(f.next!.kind).toBe('condition'); expect(f.next!.yes!.action).toBe('tag');
    const a = normalizeAutomation({ id: 'x', name: 'n', enabled: true, trigger: 'reply-received', runs: 0, createdAt: '', conditions: [], actions: [{ kind: 'tag', value: 't' }] } as never);
    expect(a.flow.next!.action).toBe('tag');
  });
  it('formats', () => { expect(formatDelay(1440)).toBe('1 day'); expect(formatDelay(120)).toBe('2 hours'); expect(formatDelay(45)).toBe('45 min'); expect(describeNode(newDelay(90)).title).toBe('Wait 90 min'); });
});

const cn = (id: string, slots: CNode['slots'] = [{ slot: 'next', node: null }], kind: CNode['kind'] = 'step'): CNode => ({ id, kind, icon: 'x', title: id, slots });
describe('canvas layout', () => {
  it('stacks a linear chain centred with edges and one end plus', () => {
    const l = layoutCanvas(cn('a', [{ slot: 'next', node: cn('b', [{ slot: 'next', node: cn('c') }]) }]));
    expect(l.nodes.map(n => n.x + n.w / 2)).toEqual([0, 0, 0]);
    expect(l.nodes.map(n => n.y)).toEqual([0, 124, 248]);
    expect(l.edges.length).toBe(3); expect(l.plus.filter(p => !p.atEdge).length).toBe(1); expect(l.plus.filter(p => p.atEdge).length).toBe(2);
  });
  it('splits a condition into symmetric non-overlapping branches', () => {
    const l = layoutCanvas(cn('t', [{ slot: 'next', node: cn('if', [{ slot: 'yes', label: 'Yes', node: cn('y') }, { slot: 'no', label: 'No', node: cn('n') }], 'condition') }]));
    const y = l.nodes.find(n => n.id === 'y')!, n = l.nodes.find(n => n.id === 'n')!;
    expect(y.x + y.w / 2).toBeLessThan(0); expect(n.x + n.w / 2).toBeGreaterThan(0); expect(y.x + y.w).toBeLessThan(n.x);
    expect(l.edges.filter(e => e.label).map(e => e.label!.text).sort()).toEqual(['No', 'Yes']);
  });
  it('gives nested branches enough room (no overlaps on any row)', () => {
    const inner = (id: string) => cn(id, [{ slot: 'yes', label: 'Yes', node: cn(id + 'y') }, { slot: 'no', label: 'No', node: cn(id + 'n') }], 'condition');
    const l = layoutCanvas(cn('t', [{ slot: 'next', node: cn('r', [{ slot: 'yes', label: 'Yes', node: inner('i1') }, { slot: 'no', label: 'No', node: inner('i2') }], 'condition') }]));
    const rows = new Map<number, typeof l.nodes>(); l.nodes.forEach(n => rows.set(n.y, [...(rows.get(n.y) ?? []), n]));
    for (const r of rows.values()) { const s = [...r].sort((a, b) => a.x - b.x); for (let i = 1; i < s.length; i++) expect(s[i].x).toBeGreaterThanOrEqual(s[i - 1].x + s[i - 1].w); }
  });
  it('puts an empty branch placeholder plus', () => {
    const l = layoutCanvas(cn('if', [{ slot: 'yes', label: 'Yes', node: null }, { slot: 'no', label: 'No', node: null }], 'condition'));
    expect(l.plus.length).toBe(2); expect(l.edges.every(e => e.dashed)).toBe(true);
  });
  it('delay pills are compact', () => { const l = layoutCanvas(cn('a', [{ slot: 'next', node: cn('d', [{ slot: 'next', node: null }], 'delay') }])); expect(l.nodes[1].h).toBe(30); });
});
