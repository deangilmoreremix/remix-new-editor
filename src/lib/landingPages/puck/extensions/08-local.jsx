/** Design 08 (Local business) extras: industry tile row, follow-up flow card and service-area map card. Sample copy only. */
import { AccentText, CardShell, useTokens } from '../components.jsx';

const T = (label) => ({ type: 'text', label });
const A = (label) => ({ type: 'textarea', label });
const list = (v) => (Array.isArray(v) ? v : []);
const cols = { type: 'select', label: 'Width (columns of 4)', options: [1, 2, 3, 4].map((n) => ({ label: `${n}`, value: n })) };

function LocalIndustries({ title, text, tiles, more }) {
  const t = useTokens();
  return (
    <section className="lc-ind" aria-label="Industries">
      <div className="lc-ind-in">
        <div className="lc-ind-intro">
          <AccentText as="h2" className="lc-ind-title" text={title} />
          {text ? <p>{t(text)}</p> : null}
        </div>
        <ul className="lc-tiles">{list(tiles).map((x, i) => <li key={i} className="lc-tile"><i aria-hidden="true" /><span>{t(x.label)}</span></li>)}</ul>
        {more ? <p className="lc-more">{t(more)}</p> : null}
      </div>
    </section>
  );
}

function LocalFlowCard({ columns, title, text, steps }) {
  const t = useTokens();
  return (
    <CardShell columns={columns} className="lc-flow">
      <h3 className="pk-card-title">{t(title)}</h3>
      {text ? <p className="pk-card-text">{t(text)}</p> : null}
      <ol className="lc-steps">{list(steps).map((s, i) => <li key={i}><i aria-hidden="true" /><span>{t(s.label)}</span></li>)}</ol>
    </CardShell>
  );
}

function LocalMapCard({ columns, title, text }) {
  const t = useTokens();
  return (
    <CardShell columns={columns} className="lc-map">
      <div className="lc-map-art" role="img" aria-label={t(title)}><h3 className="pk-card-title">{t(title)}</h3></div>
      {text ? <p className="lc-map-text">{t(text)}</p> : null}
    </CardShell>
  );
}

export const components = {
  LocalIndustries: {
    label: 'Local: industry tiles',
    fields: { title: A('Heading ([[double brackets]] underline words)'), text: A('Text'), tiles: { type: 'array', label: 'Tiles', arrayFields: { label: T('Label') }, getItemSummary: (i) => i.label || 'Tile', defaultItemProps: { label: 'Industry' } }, more: A('Handwritten note at the end') },
    defaultProps: {
      title: 'Built for\nLocal & [[Service]]\nBusinesses', text: 'A simple, powerful way to connect with more people in your area.',
      tiles: ['Home Services', 'Pet Care', 'Health & Wellness', 'Salons & Spas', 'Restaurants & Cafés', 'Local Retail', 'Auto Services'].map((label) => ({ label })), more: 'And many more!',
    },
    render: (p) => <LocalIndustries {...p} />,
  },
  LocalFlowCard: {
    label: 'Local: follow-up flow card',
    fields: { columns: cols, title: A('Title'), text: A('Text'), steps: { type: 'array', label: 'Steps', arrayFields: { label: T('Label') }, getItemSummary: (i) => i.label || 'Step', defaultItemProps: { label: 'Step' } } },
    defaultProps: { columns: 1, title: 'Automatic Follow-Up\nThat Keeps Leads Moving', text: 'Turn new leads into paying customers with simple, automated video follow-ups.', steps: ['Collect Leads', 'Send a Personalized Video', 'Follow Up Automatically', 'Get Bookings & More Customers'].map((label) => ({ label })) },
    render: (p) => <LocalFlowCard {...p} />,
  },
  LocalMapCard: {
    label: 'Local: service-area map card',
    fields: { columns: cols, title: T('Title'), text: A('Text under the map') },
    defaultProps: { columns: 1, title: 'Serving Your Local Community', text: 'Proudly serving Riverside, Maple Grove, Oak Hill, Pinecrest, Lakeside, and nearby areas!' },
    render: (p) => <LocalMapCard {...p} />,
  },
};
