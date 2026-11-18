// [remix] LEADS tab: publish the interactive video and see the leads it collected.
import { usePublished } from './use-publish';
import { useLeads } from './use-leads';
import { PublishCard } from './publish-card';
import { PersonalLinksCard } from './personal-links-card';
import { LeadsCard } from './leads-card';
import '../../styles/leads.css';

export function LeadsTab() {
  const pub = usePublished();
  const data = useLeads(pub.id, !!pub.info);
  return (
    <div className="leads-tab" data-testid="leads-tab">
      <div className="leads-tab__grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <PublishCard pub={pub} leadCount={data.rows.length} />
          {pub.info?.published && <PersonalLinksCard pub={pub} />}
        </div>
        <LeadsCard data={data} published={!!pub.info} views={pub.info?.view_count ?? 0} />
      </div>
    </div>
  );
}
