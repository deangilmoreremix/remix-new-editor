// [remix] The Projects overview inside the new editor: every video published from it, as cards with plays,
// completion and leads, headline totals, search/filter, and each project's Analytics / Audience / Retarget / Alerts.
// Same panel as the Timeline Editor's Projects section, fed by this editor's projects.
import { useEffect, useRef } from 'react';
import { createOverviewDeps, OPEN_PROJECT_EVENT } from '@cinegen/lib/leads/overview-deps';
// @ts-expect-error plain JS
import { renderProjectsPanel } from '../../../lib/editor/projectLibrary/projectsPanel.js';
import '../../../../styles/smartvideo-analytics.css';
import '../../../../styles/projects-panel.css';
import '../../styles/analytics-tab.css';

const OPEN_FLAG = 'remix_open_projects'; // set by the header bell

export function PublishedOverview({ onOpenProject, onPublish }: { onOpenProject?: (id: string) => void; onPublish?: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const open = (id: string) => (onOpenProject ? onOpenProject(id) : window.dispatchEvent(new CustomEvent(OPEN_PROJECT_EVENT, { detail: { id } })));
    const panel = renderProjectsPanel(host, createOverviewDeps({ onOpenProject: open, onPublish }));
    // The header bell lands here (home screen) on the project with the most unread alerts.
    const showAlerts = () => { try { sessionStorage.removeItem(OPEN_FLAG); } catch { /* ignore */ } void panel.openMostUnread?.(); };
    try { if (sessionStorage.getItem(OPEN_FLAG)) showAlerts(); } catch { /* storage unavailable */ }
    window.addEventListener('remix:open-projects', showAlerts);
    return () => { window.removeEventListener('remix:open-projects', showAlerts); panel.destroy?.(); };
  }, [onOpenProject, onPublish]);
  return <div className="cg-analytics cg-analytics--embedded" data-testid="published-overview"><div ref={hostRef} className="prj-root-host" /></div>;
}
