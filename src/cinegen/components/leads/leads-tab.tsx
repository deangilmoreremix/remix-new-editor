// [remix] LEADS tab: publish the interactive video and see the leads it collected.
import { usePublished } from './use-publish';
import { useLeads } from './use-leads';
import { useInsights } from './use-insights';
import { PublishCard } from './publish-card';
import { LeadsCard } from './leads-card';
import '../../styles/leads.css';

export function LeadsTab() {
  const pub = usePublished();
  const data = useLeads(pub.id, !!pub.info);
  const insights = useInsights(pub.id, !!pub.info, data.rows);
  return (
    <div className="leads-tab" data-testid="leads-tab">
      <div className="leads-tab__grid">
        <PublishCard pub={pub} leadCount={data.rows.length} />
        <LeadsCard data={data} insights={insights} published={!!pub.info} views={pub.info?.view_count ?? 0} />
      </div>
    </div>
  );
}
