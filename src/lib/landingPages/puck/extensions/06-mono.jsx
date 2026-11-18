/** Mono editorial extras: logo + results strip, intro with icon features, and the three info panels. Sample copy only. */
import { useTokens, AccentText, VideoPlayer, LeadForm, SafeLink, Icon } from '../components.jsx';
import { slotFields, SLOT_DEFAULTS } from '../slotFields.js';
import { safeImageUrl, splitAccent } from '../../templates.js';

const T = (label) => ({ type: 'text', label });
const A = (label) => ({ type: 'textarea', label });
const arr = (label, arrayFields, defaultItemProps, summary) => ({ type: 'array', label, arrayFields, defaultItemProps, getItemSummary: (i) => i[summary] || 'Item' });
const img = (src) => safeImageUrl(src) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(src || '')) ? src : '');
const list = (v) => (Array.isArray(v) ? v : []);
const Img = ({ src, ...rest }) => (img(src) ? <img src={img(src)} alt="" aria-hidden="true" {...rest} /> : null);


/** Headline whose [[marked]] words get a hand-drawn SVG underline. */
function Headline({ text }) {
  const t = useTokens();
  return (
    <h1 className="pk-headline">
      {splitAccent(String(text || '')).map((p, i) => {
        const v = t(p.text);
        if (!v) return null;
        return p.accent
          ? <span key={i} className="mn-under">{v}<svg className="mn-squig" viewBox="0 0 170 14" preserveAspectRatio="none" aria-hidden="true"><path d="M3 9c14-6 30-8 52-6 22 2 40 5 62 3 18-2 32-4 50-3" /></svg></span>
          : <span key={i}>{v}</span>;
      })}
    </h1>
  );
}

function Sparkle() {
  return <svg className="mn-spark" viewBox="0 0 40 40" aria-hidden="true"><path d="M7 33l5-9M17 21l3-12M28 18l9-4" /></svg>;
}

function Hero(p) {
  const t = useTokens();
  const fields = list(p.formFields).filter((f) => f.key && f.label).map((f) => ({ ...f, key: String(f.key).replace(/[^a-z0-9_]/gi, '').toLowerCase() }));
  return (
    <header className="pk-hero pk-hero--copy-video-form mn-hero" id="top">
      <div className="pk-hero-copy">
        {p.eyebrow ? <span className="pk-eyebrow">{t(p.eyebrow)}</span> : null}
        <Headline text={p.headline} />
        {p.subhead ? <p className="pk-subhead">{t(p.subhead)}</p> : null}
        {list(p.bullets).length ? <ul className="pk-bullets">{list(p.bullets).map((b, i) => <li key={i}>{t(b.text)}</li>)}</ul> : null}
        {list(p.buttons).length ? <div className="pk-actions">{list(p.buttons).map((b, i) => <SafeLink key={i} className={`pk-btn pk-btn--${b.style === 'primary' ? 'primary' : 'secondary'}`} href={b.url || '#lead'}>{t(b.label)}</SafeLink>)}</div> : null}
      </div>
      <div className="pk-hero-video" id="video">
        <VideoPlayer poster={p.photo} slotImage={p.slotImage} slotVideo={p.slotVideo} bakedPlay={p.bakedPlay} />
        <div className="mn-greet">
          {p.greeting1 ? <AccentText as="span" className="mn-bubble" text={p.greeting1} /> : null}
          {p.greeting2 ? <span className="mn-bubble">{t(p.greeting2)}</span> : null}
          <Sparkle />
        </div>
      </div>
      <div className="pk-hero-form" id="lead"><LeadForm options={p.formOptions} title={p.formTitle} subtitle={p.formSubtitle} submitLabel={p.submitLabel} privacy={p.privacy} fields={fields.length ? fields : undefined} /></div>
    </header>
  );
}

function Proof({ title, logos, stats }) {
  const t = useTokens();
  return (
    <section className="mn-proof">
      <p className="mn-proof-title">{t(title)}</p>
      <ul className="mn-logos">{list(logos).map((l, i) => <li key={i}><Img src={l.icon} width="24" height="22" /><span>{t(l.name)}</span></li>)}</ul>
      <ul className="mn-stats">{list(stats).map((s, i) => <li key={i}><b>{t(s.value)}</b><span>{t(s.label)}</span></li>)}</ul>
    </section>
  );
}

function Intro({ eyebrow, title, text, features }) {
  const t = useTokens();
  return (
    <section className="mn-intro">
      <div className="mn-intro-head">
        {eyebrow ? <span className="pk-eyebrow-plain">{t(eyebrow)}</span> : null}
        <h2>{t(title)}</h2>
        {text ? <p>{t(text)}</p> : null}
      </div>
      <ul className="mn-feats">{list(features).map((f, i) => <li key={i}><Img src={f.icon} width="36" height="32" /><b>{t(f.title)}</b><span>{t(f.text)}</span></li>)}</ul>
    </section>
  );
}

function Panels(p) {
  const t = useTokens();
  return (
    <section className="mn-panels">
      <article className="mn-panel mn-quotes">
        <h3>{t(p.quotesTitle)}</h3>
        <div className="mn-quote-row">
          {list(p.quotes).map((q, i) => (
            <figure key={i}>
              <blockquote>{`“${t(q.text)}”`}</blockquote>
              <figcaption><Img src={q.avatar} width="36" height="36" className="mn-av" /><span><b>{t(q.name)}</b><small>{t(q.role)}</small></span></figcaption>
            </figure>
          ))}
        </div>
      </article>
      <article className="mn-panel mn-dash">
        <h3>{t(p.dashTitle)}</h3>
        <div className="mn-win">
          <div className="mn-side">
            <b className="mn-side-brand"><Img src={p.dashLogo} width="16" height="16" />{t(p.dashBrand)}</b>
            <ul>{list(p.dashMenu).map((m, i) => <li key={i} className={i === 0 ? 'is-on' : ''}>{m.icon ? <Icon name={m.icon} className="mn-mi" /> : null}<span>{t(m.label)}</span></li>)}</ul>
          </div>
          <div className="mn-main">
            <div className="mn-main-bar"><b>{t(p.dashHeading)}</b><span>{t(p.dashRange)}</span></div>
            <div className="mn-kpis">{list(p.kpis).map((k, i) => <div key={i}><small>{t(k.label)}</small><b>{t(k.value)}</b>{k.delta ? <em>{t(k.delta)}</em> : null}</div>)}</div>
            <Img src={p.chart} className="mn-chart" />
          </div>
        </div>
      </article>
      <article className="mn-panel mn-check">
        <h3>{t(p.checkTitle)}</h3>
        <ul>{list(p.checks).map((c, i) => <li key={i} className={c.done === 'yes' ? 'is-done' : ''}><i aria-hidden="true" /><span>{t(c.label)}</span></li>)}</ul>
      </article>
    </section>
  );
}

export const components = {
  MonoHero: {
    label: 'Mono: hero with greeting bubbles',
    fields: {
      eyebrow: T('Small label above the headline'), headline: A('Headline (wrap words in [[double brackets]] to underline)'), subhead: A('Sub-headline'),
      bullets: arr('Tick list', { text: T('Text') }, { text: 'New point' }, 'text'),
      buttons: arr('Buttons', { label: T('Text'), url: T('Link (https, #lead, #video)'), style: { type: 'radio', label: 'Style', options: [{ label: 'Filled', value: 'primary' }, { label: 'Outline', value: 'secondary' }] } }, { label: 'Button', url: '#lead', style: 'primary' }, 'label'),
      greeting1: T('Greeting bubble 1 (wrap the name in [[ ]] to colour it)'), greeting2: T('Greeting bubble 2'),
      photo: T('Placeholder image before the video plays'),
      ...slotFields(),
      formTitle: T('Form title'), formSubtitle: T('Form subtitle'),
      formFields: arr('Form fields', { key: T('Key (name, email, company...)'), label: T('Label'), type: { type: 'select', label: 'Type', options: [{ label: 'Text', value: 'text' }, { label: 'Email', value: 'email' }, { label: 'Phone', value: 'tel' }] }, required: { type: 'radio', label: 'Required', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] } }, { key: 'name', label: 'Name', type: 'text', required: true }, 'label'),
      submitLabel: T('Form button text'), privacy: T('Line under the form button'),
    },
    defaultProps: { eyebrow: 'Personalized Video Lead Generation', headline: 'A Video That Speaks to You, [[Personally.]]', subhead: 'Say what you do.', bullets: [], buttons: [{ label: 'Get My Video', url: '#lead', style: 'primary' }], greeting1: 'Hi [[Alex]],', greeting2: 'I made this just for you.', ...SLOT_DEFAULTS, photo: '', formTitle: 'Get Your Video', formSubtitle: '', formFields: [{ key: 'name', label: 'First name', type: 'text', required: true }, { key: 'email', label: 'Work email', type: 'email', required: true }], submitLabel: 'Get My Video', privacy: '' },
    render: (p) => <Hero {...p} />,
  },
  MonoProof: {
    label: 'Mono: logos and results strip',
    fields: { title: T('Label'), logos: arr('Logos', { name: T('Name'), icon: T('Icon image link') }, { name: 'Brand', icon: '' }, 'name'), stats: arr('Results', { value: T('Number'), label: T('Label') }, { value: '0%', label: 'Label' }, 'value') },
    defaultProps: { title: 'Trusted by growth-focused teams', logos: [{ name: 'Brand', icon: '' }], stats: [{ value: '3.8×', label: 'Higher opt-in rate' }] },
    render: (p) => <Proof {...p} />,
  },
  MonoIntro: {
    label: 'Mono: intro with four features',
    fields: { eyebrow: T('Small label'), title: T('Title'), text: A('Text'), features: arr('Features', { icon: T('Icon image link'), title: T('Title'), text: A('Text') }, { icon: '', title: 'Feature', text: '' }, 'title') },
    defaultProps: { eyebrow: 'Build a high-quality list', title: 'Convert Viewers Into Leads', text: 'Say what you do.', features: [{ icon: '', title: 'Feature', text: 'Describe it.' }] },
    render: (p) => <Intro {...p} />,
  },
  MonoPanels: {
    label: 'Mono: testimonials, dashboard and checklist',
    fields: {
      quotesTitle: T('Testimonials heading'),
      quotes: arr('Testimonials', { text: A('Quote'), name: T('Name'), role: T('Role / company'), avatar: T('Photo link') }, { text: 'Add a quote you have permission to use.', name: 'Name', role: 'Role, Company', avatar: '' }, 'name'),
      dashTitle: T('Dashboard heading'), dashBrand: T('Dashboard brand'), dashLogo: T('Dashboard logo image link'), dashHeading: T('Dashboard title'), dashRange: T('Date range'),
      dashMenu: arr('Dashboard menu', { label: T('Label'), icon: T('Icon (home, users, video, mail, gear, chart...)') }, { label: 'Item', icon: 'check' }, 'label'),
      kpis: arr('Dashboard numbers', { label: T('Label'), value: T('Number'), delta: T('Change') }, { label: 'Label', value: '0', delta: '' }, 'label'),
      chart: T('Chart image link'),
      checkTitle: T('Checklist heading'),
      checks: arr('Checklist', { label: T('Text'), done: { type: 'radio', label: 'Ticked', options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }] } }, { label: 'Item', done: 'yes' }, 'label'),
    },
    defaultProps: { quotesTitle: 'What our customers say', quotes: [], dashTitle: 'Your leads at a glance', dashBrand: 'Brand', dashLogo: '', dashHeading: 'Dashboard', dashRange: 'Last 30 days', dashMenu: [{ label: 'Dashboard', icon: 'home' }], kpis: [], chart: '', checkTitle: 'Checklist', checks: [] },
    render: (p) => <Panels {...p} />,
  },
};
