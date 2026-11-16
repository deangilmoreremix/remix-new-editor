import { useEffect, useMemo, useRef, useState } from 'react';
import type { WarmblyAdapter } from './api/actions';
import { createLocalAdapter } from './api/localAdapter';
import { CSS } from './ui/styles';
import { WarmblyProvider, useWb } from './ui/store';
import { Icon } from './ui/kit';
import { Dashboard } from './ui/views/Dashboard';
import { Campaigns } from './ui/views/Campaigns';
import { Inbox } from './ui/views/Inbox';
import { Contacts } from './ui/views/Contacts';
import { Pipeline } from './ui/views/Pipeline';
import { Mailboxes } from './ui/views/Mailboxes';
import { Deliverability } from './ui/views/Deliverability';
import { Automations } from './ui/views/Automations';
import { Integrations } from './ui/views/Integrations';
import { Settings } from './ui/views/Settings';

export const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home', C: Dashboard }, { id: 'campaigns', label: 'Campaigns', icon: 'send', C: Campaigns },
  { id: 'inbox', label: 'Inbox', icon: 'inbox', C: Inbox }, { id: 'contacts', label: 'Contacts', icon: 'users', C: Contacts },
  { id: 'pipeline', label: 'CRM Pipeline', icon: 'kanban', C: Pipeline }, { id: 'mailboxes', label: 'Mailboxes & Warmup', icon: 'mail', C: Mailboxes },
  { id: 'deliverability', label: 'Deliverability', icon: 'shield', C: Deliverability }, { id: 'automations', label: 'Automations', icon: 'zap', C: Automations },
  { id: 'integrations', label: 'Integrations', icon: 'plug', C: Integrations }, { id: 'settings', label: 'Settings', icon: 'gear', C: Settings },
] as const;
export type ViewId = typeof VIEWS[number]['id'];

export interface WarmblyStudioProps {
  /** Data source. Defaults to a local sandbox adapter; pass an adapter backed by the Warmbly API once the backend is connected. */
  adapter?: WarmblyAdapter;
  initialView?: ViewId;
  /** Called when the user navigates, so hosts can sync the URL. */
  onNavigate?: (view: ViewId, arg?: string) => void;
}

function Shell({ view, setView }: { view: ViewId; setView: (v: ViewId, a?: string) => void }) {
  const { ws, toast, nav } = useWb();
  const unread = ws.threads.filter(t => t.unread && !t.archived && t.messages.some(m => m.direction === 'in')).length;
  const seen = useRef(unread);
  useEffect(() => { if (unread > seen.current) toast(`${unread - seen.current} new repl${unread - seen.current === 1 ? 'y' : 'ies'} in your inbox`); seen.current = unread; }, [unread, toast]);
  const cur = VIEWS.find(v => v.id === view) ?? VIEWS[0];
  const online = ws.team.filter(m => m.online);
  return <div className="wb">
    <nav className="wb-nav" aria-label="Warmbly navigation"><div className="wb-brand"><i />Warmbly</div>
      {VIEWS.map(v => <button key={v.id} className={v.id === view ? 'on' : ''} aria-current={v.id === view ? 'page' : undefined} onClick={() => nav(v.id)}><Icon name={v.icon} />{v.label}{v.id === 'inbox' && unread > 0 && <span className="cnt">{unread}</span>}</button>)}</nav>
    <div className="wb-main"><header className="wb-top"><h1>{cur.label}</h1><span className="wb-mute wb-sm">{ws.settings.workspaceName}</span>
      <div className="wb-presence" aria-label={`${online.length} teammates online`}>{online.map(m => <i key={m.id} title={`${m.name} (online)`}>{m.name.split(' ').map(p => p[0]).join('')}</i>)}</div></header>
      <main className="wb-body"><cur.C /></main></div></div>;
}

export function WarmblyStudio({ adapter, initialView = 'dashboard', onNavigate }: WarmblyStudioProps) {
  const fallback = useMemo(() => adapter ?? createLocalAdapter(), [adapter]);
  const [state, setState] = useState<{ view: ViewId; arg?: string }>({ view: initialView });
  useEffect(() => { setState(s => s.view === initialView ? s : { view: initialView }); }, [initialView]);
  const nav = (v: string, arg?: string) => { const view = (VIEWS.find(x => x.id === v)?.id ?? 'dashboard') as ViewId; setState({ view, arg }); onNavigate?.(view, arg); };
  return <><style>{CSS}</style><WarmblyProvider adapter={fallback} nav={nav} arg={state.arg}><Shell view={state.view} setView={(v, a) => nav(v, a)} /></WarmblyProvider></>;
}
