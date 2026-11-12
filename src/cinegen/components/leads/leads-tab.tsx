// [remix] LEADS tab: publish the interactive video and see the leads it collected.
// Personalization cards (business assets, links) sit under Publish; they read/write the same published video.
import { usePublished } from './use-publish';
import { useLeads } from './use-leads';
import { useBusinessLibrary } from './use-business-library';
import { PublishCard } from './publish-card';
import { LeadsCard } from './leads-card';
import { AssetPicker } from './asset-picker';
import { BulkLinksCard } from './bulk-links-card';
import { useRecipients } from './use-recipients';
import '../../styles/leads.css';

export function LeadsTab() {
  const pub = usePublished();
  const data = useLeads(pub.id, !!pub.info);
  const lib = useBusinessLibrary();
  const rec = useRecipients(pub, lib);
  return (
    <div className="leads-tab" data-testid="leads-tab">
      <div className="leads-tab__grid">
        <div className="leads-col">
          <PublishCard pub={pub} leadCount={data.rows.length} />
          <AssetPicker lib={lib} usedUrls={rec.usedUrls} />
          <BulkLinksCard pub={pub} rec={rec} />
        </div>
        <LeadsCard data={data} published={!!pub.info} views={pub.info?.view_count ?? 0} />
      </div>
    </div>
  );
}
