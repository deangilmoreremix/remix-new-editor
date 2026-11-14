/** Design 03 (Bold red outreach) extras: a trust bar with logo words and laurel rating badges. */
import { useTokens } from '../components.jsx';

const list = (v) => (Array.isArray(v) ? v : []);

function ReachTrustBar({ title, logos, badges }) {
  const t = useTokens();
  return (
    <section className="rc-trust" aria-label={t(title) || 'Trusted by'}>
      <p className="rc-trust-title">{t(title)}</p>
      <ul className="rc-trust-logos">{list(logos).map((l, i) => <li key={i} className="rc-logo">{t(l.name)}</li>)}</ul>
      <ul className="rc-trust-badges">
        {list(badges).map((b, i) => (
          <li key={i} className="rc-laurel"><span className="rc-laurel-l" aria-hidden="true" /><span className="rc-laurel-t"><b>{t(b.value)}</b><small>{t(b.label)}</small></span><span className="rc-laurel-r" aria-hidden="true" /></li>
        ))}
      </ul>
    </section>
  );
}

export const components = {
  ReachTrustBar: {
    label: 'Reach: trust bar (logos and rating laurels)',
    fields: {
      title: { type: 'text', label: 'Heading' },
      logos: { type: 'array', label: 'Company names', arrayFields: { name: { type: 'text', label: 'Name' } }, getItemSummary: (i) => i.name || 'Logo', defaultItemProps: { name: 'Company' } },
      badges: { type: 'array', label: 'Rating badges', arrayFields: { value: { type: 'text', label: 'Number' }, label: { type: 'text', label: 'Label' } }, getItemSummary: (i) => i.value || 'Badge', defaultItemProps: { value: '4.9/5', label: 'Customer Rating' } },
    },
    defaultProps: { title: 'Trusted by Growth-Focused Teams', logos: [{ name: 'HubSpot' }, { name: 'salesforce' }, { name: 'pipedrive' }], badges: [{ value: '4.9/5', label: 'Customer Rating' }] },
    render: (p) => <ReachTrustBar {...p} />,
  },
};
