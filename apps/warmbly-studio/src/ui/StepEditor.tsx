import { useWb } from './store';
import { Btn, Field } from './kit';
import type { SequenceStep } from '../types';
import { spamCheck } from '../domain/template';

/** Editing fields for one sequence step; shared by the campaign canvas inspector and the new-campaign modal. */
export function StepFields({ st, index, onChange, showKind = false }: { st: SequenceStep; index: number; onChange: (p: Partial<SequenceStep>) => void; showKind?: boolean }) {
  const { ws } = useWb();
  const n = index + 1;
  const spam = st.kind === 'email' ? spamCheck(st.subject ?? '', st.body ?? '') : null;
  return <div>
    {showKind && <select aria-label={`Step ${n} type`} style={{ marginBottom: 8 }} value={st.kind} onChange={e => onChange({ kind: e.target.value as SequenceStep['kind'] })}><option value="email">Email</option><option value="wait">Wait</option><option value="condition">Condition</option><option value="task">Task</option></select>}
    {st.kind === 'email' && <>
      <input aria-label={`Step ${n} subject`} placeholder={index === 0 ? 'Subject (spintax {a|b} and {{variables}} supported)' : 'Subject (leave empty to reply in thread)'} value={st.subject ?? ''} onChange={e => onChange({ subject: e.target.value })} style={{ marginBottom: 6 }} />
      <textarea aria-label={`Step ${n} body`} placeholder="Hi {{firstName | there}}, …" value={st.body ?? ''} onChange={e => onChange({ body: e.target.value })} style={{ minHeight: 140 }} />
      <div className="wb-row wrap wb-sm" style={{ marginTop: 6 }}><span className="wb-mute">Insert:</span>{['firstName', 'company', 'title', 'sender'].map(v => <Btn key={v} sm onClick={() => onChange({ body: `${st.body ?? ''}{{${v}}}` })}>{v}</Btn>)}</div>
      <select aria-label="Apply template" style={{ marginTop: 8 }} value="" onChange={e => { const t = ws.templates.find(x => x.id === e.target.value); if (t) onChange({ subject: t.subject, body: t.body }); }}><option value="">Apply template…</option>{ws.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      {spam && <div className="wb-sm" style={{ marginTop: 8, color: spam.score < 20 ? 'var(--good)' : spam.score < 40 ? 'var(--warn)' : 'var(--bad)' }}>Spam score {spam.score}/100{spam.issues[0] ? ` · ${spam.issues[0]}` : ''}</div>}</>}
    {st.kind === 'wait' && <div className="wb-row"><span>Wait</span><input aria-label="Wait days" type="number" min={1} style={{ width: 90 }} value={st.waitDays ?? 1} onChange={e => onChange({ waitDays: Math.max(1, Number(e.target.value) || 1) })} /><span>days</span></div>}
    {st.kind === 'condition' && <div className="wb-grid">
      <Field label="Continue only if the contact">{id => <select id={id} aria-label="Negate" value={st.negate ? 'not' : 'has'} onChange={e => onChange({ negate: e.target.value === 'not' })}><option value="has">has</option><option value="not">has not</option></select>}</Field>
      <Field label="Action">{id => <select id={id} aria-label="Condition" value={st.condition ?? 'opened'} onChange={e => onChange({ condition: e.target.value as SequenceStep['condition'] })}><option value="opened">opened</option><option value="clicked">clicked</option><option value="replied">replied</option></select>}</Field></div>}
    {st.kind === 'task' && <input aria-label="Task title" placeholder="Task title" value={st.taskTitle ?? ''} onChange={e => onChange({ taskTitle: e.target.value })} />}
  </div>;
}
