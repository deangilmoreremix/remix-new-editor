/**
 * Puck configuration: the sections an editor can add, and the fields that edit each one.
 * Every visible string, image, link and list item is a field.
 */
import * as C from './components.jsx';
import { withImagePickers } from './ImageField.jsx';
import { FONT_OPTIONS, fontStack } from './fontChoices.js';
import { ICON_KEYS } from '../siteIcons.js';
import { PUCK_TEMPLATES } from './designs.js';
import { slotFields, SLOT_DEFAULTS } from './slotFields.js';
import { ThanksContext, FormSettingsContext } from './context.js';
import { choicesField } from './choicesField.jsx';
import { ListBuilderForm, OptinGate, PixelLoader, optinConfigField, defaultListBuilder, publicOptinConfig } from './optinForm.jsx';

// Designs may ship extra components (puck/extensions/NN-name.jsx exporting `components`), merged in automatically.
const EXT = Object.entries(import.meta.glob('./extensions/*.jsx', { eager: true })).sort(([a], [b]) => a.localeCompare(b)).map(([, m]) => m);
const EXT_COMPONENTS = Object.assign({}, ...EXT.map((m) => m.components || {}));

const T = (label) => ({ type: 'text', label });
const A = (label) => ({ type: 'textarea', label });
const iconField = { type: 'select', label: 'Icon', options: [{ label: 'None', value: '' }, ...ICON_KEYS.map((k) => ({ label: k, value: k }))] };
const cols = { type: 'select', label: 'Width (grid columns)', options: [1, 2, 3, 4, 5, 6].map((n) => ({ label: `${n}`, value: n })) };
const buttonArray = { type: 'array', label: 'Buttons', arrayFields: { label: T('Text'), url: T('Link (https, mailto: or tel:)'), style: { type: 'radio', label: 'Style', options: [{ label: 'Primary', value: 'primary' }, { label: 'Secondary', value: 'secondary' }] } }, getItemSummary: (i) => i.label || 'Button', defaultItemProps: { label: 'Button', url: '', style: 'secondary' } };
const linkArray = (label) => ({ type: 'array', label, arrayFields: { label: T('Text'), url: T('Link (optional)') }, getItemSummary: (i) => i.label || 'Link', defaultItemProps: { label: 'Link', url: '' } });
const formFieldArray = { type: 'array', label: 'Form fields', arrayFields: { key: T('Field name (a-z)'), label: T('Label / placeholder'), type: { type: 'select', label: 'Type', options: ['text', 'email', 'tel', 'number', 'date', 'textarea', 'select'].map((v) => ({ label: v === 'select' ? 'dropdown' : v === 'tel' ? 'phone' : v, value: v })) }, options: choicesField('Dropdown choices'), placeholder: T('Placeholder (shown before a choice is picked)'), required: { type: 'radio', label: 'Required', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] } }, getItemSummary: (i) => i.label || 'Field', defaultItemProps: { key: 'name', label: 'Name', type: 'text', required: true } };

const HERO_FIELDS = [{ key: 'name', label: 'Your Name', type: 'text', required: true }, { key: 'email', label: 'Your Email', type: 'email', required: true }, { key: 'company', label: 'Your Company', type: 'text', required: false }];

export const puckConfig = {
  root: {
    fields: {
      design: { type: 'select', label: 'Look', options: [{ label: 'Clean', value: 'clean' }, ...PUCK_TEMPLATES.filter((t) => t.designClass).map((t) => ({ label: t.name, value: t.designClass }))] },
      accent: T('Accent colour (#hex)'),
      background: T('Page background (#hex)'),
      text: T('Text colour (#hex)'),
      surface: T('Card colour (#hex)'),
      headingFont: { type: 'select', label: 'Heading font', options: FONT_OPTIONS },
      bodyFont: { type: 'select', label: 'Body font', options: FONT_OPTIONS },
      thanks: T('Thank-you message after an email sign-up'),
      afterSubmit: { type: 'radio', label: 'After a form is sent', options: [{ label: 'Show the thank-you message', value: 'message' }, { label: 'Open another page (https link)', value: 'redirect' }] },
      afterSubmitUrl: T('Page to open after a form is sent (https link)'),
      greeting: T('Greeting strip shown only on a personal link (e.g. "A personal video for {{firstname|you}}"; empty = none)'),
    },
    defaultProps: { design: 'clean', accent: '#2563eb', background: '#ffffff', text: '#0f172a', surface: '', headingFont: '', bodyFont: '', thanks: 'Thanks! Check your inbox.', greeting: '', afterSubmit: 'message', afterSubmitUrl: '' },
    render: ({ children, design, accent, background, text, surface, headingFont, bodyFont, thanks, greeting, afterSubmit, afterSubmitUrl }) => {
      const ok = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : d);
      const acc = ok(accent, '#2563eb');
      // Button text: white on dark accents, near-black on light ones, so every accent stays readable.
      const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const style = { '--pk-accent': acc, '--pk-on-accent': lum(acc) > 0.4 ? '#0b0f19' : '#ffffff', '--pk-bg': ok(background, '#ffffff'), '--pk-text': ok(text, '#0f172a') };
      if (ok(surface, '')) style['--pk-card'] = surface;
      // Optional font overrides: only allow-listed keys map to a CSS stack (see fontChoices.js).
      const fh = fontStack(headingFont); const fb = fontStack(bodyFont);
      if (fh) style['--pk-fh'] = fh;
      if (fb) style['--pk-fb'] = fb;
      return <div className={`pk-page pk-d-${String(design || 'clean').replace(/[^a-z0-9-]/gi, '')}`} style={style} {...(fh ? { 'data-fh': '' } : {})} {...(fb ? { 'data-fb': '' } : {})}><ThanksContext.Provider value={thanks || 'Thanks! Check your inbox.'}><FormSettingsContext.Provider value={{ action: afterSubmit === 'redirect' ? 'redirect' : 'message', url: afterSubmitUrl || '' }}><C.LeadAnchorFallback /><C.PersonalGreeting text={greeting} />{children}</FormSettingsContext.Provider></ThanksContext.Provider></div>;
    },
  },
  categories: {
    sections: { title: 'Sections', components: ['NavBar', 'Hero', 'Strip', 'TextBlock', 'Grid', 'Band', 'ContactBand', 'ListBuilderForm', 'LeadGeneratorForm', 'CtaBar', 'Showcase', 'Footer', 'PageImage'] },
    extras: { title: 'Design extras', components: Object.keys(EXT_COMPONENTS), defaultExpanded: false },
    cards: { title: 'Cards (drop into a Grid)', components: ['LeadMagnetCard', 'TableCard', 'StatsCard', 'ChecklistCard', 'QuoteCard', 'StepsCard', 'FeaturesCard', 'FaqCard', 'KpiCard', 'ScheduleCard', 'ButtonCard'] },
  },
  components: {
    ...EXT_COMPONENTS,
    NavBar: {
      label: 'Menu bar',
      fields: { brand: T('Brand name'), logo: T('Logo image (https link)'), links: linkArray('Menu links'), loginLabel: T('Log-in text (empty = none)'), loginUrl: T('Log-in link'), ctaLabel: T('Button text (scrolls to the form)') },
      defaultProps: { brand: 'Your brand', logo: '', links: [{ label: 'Product', url: '' }, { label: 'Pricing', url: '' }], loginLabel: 'Log In', loginUrl: '', ctaLabel: 'Book a Demo' },
      render: (p) => <C.NavBar {...p} />,
    },
    Hero: {
      label: 'Hero (headline, video, form)',
      fields: {
        variant: { type: 'radio', label: 'Arrangement', options: [{ label: 'Headline, video, form', value: 'copy-video-form' }, { label: 'Video, headline, form', value: 'video-copy-form' }, { label: 'Photo story (photo behind the headline)', value: 'story' }, { label: 'Headline + form left, big video right', value: 'duo' }] },
        background: T('Background photo (https link)'),
        eyebrow: T('Small label above the headline'),
        headline: A('Headline (wrap words in [[double brackets]] to highlight)'),
        subhead: A('Sub-headline'),
        bullets: { type: 'array', label: 'Tick list', arrayFields: { text: T('Text') }, getItemSummary: (i) => i.text || 'Item', defaultItemProps: { text: 'New point' } },
        buttons: buttonArray,
        chip: T("Label on the video (your own words over the picture; text inside a photo can't be edited, so swap the picture)"),
        photo: T('Placeholder image before the video plays (https link)'),
        ...slotFields(),
        showForm: { type: 'radio', label: 'Lead form', options: [{ label: 'Show', value: 'yes' }, { label: 'Hide', value: 'no' }] },
        formTitle: T('Form title'),
        formSubtitle: T('Form subtitle'),
        formFields: formFieldArray,
        submitLabel: T('Form button text'),
        privacy: T('Line under the form button'),
      },
      defaultProps: {
        variant: 'copy-video-form', eyebrow: 'A video made for you', headline: 'Hi {{firstname|there}}, here is a smarter way to [[grow your business.]]',
        subhead: 'Press play for a short video, then tell us what you think.', bullets: [{ text: 'Made for {{company|your team}}' }, { text: 'Takes two minutes' }],
        buttons: [], chip: 'Hi {{firstname|there}}!', photo: '', ...SLOT_DEFAULTS, showForm: 'yes', formTitle: 'Want to talk it through?', formSubtitle: 'Leave your details and we will be in touch.',
        formFields: HERO_FIELDS, submitLabel: 'Send', privacy: '',
      },
      render: (p) => <C.Hero {...p} />,
    },
    Strip: {
      label: 'Strip (logos, icons or numbers)',
      fields: { kind: { type: 'radio', label: 'Style', options: [{ label: 'Company names', value: 'logos' }, { label: 'Icons with text', value: 'benefits' }, { label: 'Big numbers', value: 'stats' }] }, title: T('Heading (optional)'), items: { type: 'array', label: 'Items', arrayFields: { title: T('Title / name'), text: T('Short text (icons style)'), value: T('Number (numbers style)'), icon: iconField, image: T('Small picture (icons style; https link)') }, getItemSummary: (i) => i.title || i.value || 'Item', defaultItemProps: { title: 'Item', text: '', value: '', icon: 'check', image: '' } } },
      defaultProps: { kind: 'logos', title: 'Trusted by growth-focused teams', items: [{ title: 'Acme', text: '', value: '', icon: '' }, { title: 'Globex', text: '', value: '', icon: '' }, { title: 'Initech', text: '', value: '', icon: '' }] },
      render: (p) => <C.Strip {...p} />,
    },
    TextBlock: {
      label: 'Heading and text',
      fields: { eyebrow: T('Small label'), title: T('Heading (wrap words in [[double brackets]] to highlight)'), text: A('Text'), align: { type: 'radio', label: 'Align', options: [{ label: 'Centre', value: 'center' }, { label: 'Left', value: 'left' }] } },
      defaultProps: { eyebrow: '', title: 'A complete platform for [[video-led growth]]', text: 'Say what you do in one or two sentences.', align: 'center' },
      render: (p) => <C.TextBlock {...p} />,
    },
    Grid: {
      label: 'Card grid',
      fields: { columns: { type: 'select', label: 'Columns on a desktop', options: [2, 3, 4, 5, 6].map((n) => ({ label: `${n}`, value: n })) }, items: { type: 'slot', allow: ['LeadMagnetCard', 'TableCard', 'StatsCard', 'ChecklistCard', 'QuoteCard', 'StepsCard', 'FeaturesCard', 'FaqCard', 'KpiCard', 'ScheduleCard', 'ButtonCard'] } },
      defaultProps: { columns: 3 },
      render: ({ columns, items: Items }) => <section className="pk-grid" style={{ '--pk-cols': columns }}><Items className="pk-grid-in" /></section>,
    },
    Band: {
      label: 'Sign-up band (email)',
      fields: { brand: T('Brand name (optional)'), tagline: T('Tagline (optional)'), title: T('Headline'), text: T('Text'), placeholder: T('Email box hint'), buttonLabel: T('Button text'), social: T('Label above social links (optional)') },
      defaultProps: { brand: '', tagline: '', title: 'Get tips and updates in your inbox', text: '', placeholder: 'Enter your email', buttonLabel: 'Subscribe', social: '' },
      render: (p) => <C.Band {...p} />,
    },
    ContactBand: {
      label: 'Contact form band',
      fields: { eyebrow: T('Small label'), title: T('Headline'), text: A('Text'), fields: formFieldArray, submitLabel: T('Button text'), successMessage: T('Thank-you message') },
      defaultProps: { eyebrow: "Let's talk", title: 'Ready to get started?', text: 'Tell us a little about your team and we will get back to you.', fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'email', label: 'Work email', type: 'email', required: true }, { key: 'message', label: 'How can we help?', type: 'textarea', required: false }], submitLabel: 'Contact us', successMessage: 'Thanks! We will be in touch.' },
      render: (p) => <C.ContactBand {...p} />,
    },
    ListBuilderForm: {
      label: 'Sign-up form (List Builder)',
      fields: { config: optinConfigField('List Builder settings', 'list-builder') },
      defaultProps: { config: publicOptinConfig(defaultListBuilder('list-builder')) },
      render: (p) => <><ListBuilderForm {...p} /><OptinGate config={p.config} /><PixelLoader config={p.config} /></>,
    },
    LeadGeneratorForm: {
      label: 'Lead form (Lead Generator)',
      fields: { config: optinConfigField('Lead Generator settings', 'lead-generator') },
      defaultProps: { config: publicOptinConfig(defaultListBuilder('lead-generator')) },
      render: (p) => <><ListBuilderForm {...p} kind="lead-generator" /><OptinGate config={p.config} /><PixelLoader config={p.config} /></>,
    },
    CtaBar: { label: 'Bottom button bar', fields: { text: T('Text beside the button (empty = button only)'), label: T('Button text'), url: T('Link (https, mailto:, tel: or #lead)'), icon: iconField, icons: { type: 'array', label: 'Social icons (button-only bar)', arrayFields: { icon: iconField, url: T('Link (https)') }, getItemSummary: (i) => i.icon || 'Icon', defaultItemProps: { icon: 'facebook', url: '' } } }, defaultProps: { text: '', label: 'Book a Free Consultation', url: '#lead', icon: 'calendar', icons: [] }, render: (p) => <C.CtaBar {...p} /> },
    Footer: { label: 'Footer', fields: { text: T('Footer text'), links: linkArray('Footer links') }, defaultProps: { text: 'Sent by {{sender|us}} · {{brand|your brand}}', links: [] }, render: (p) => <C.Footer {...p} /> },
    Showcase: {
      label: 'Text + picture (or photo banner)',
      fields: {
        variant: { type: 'radio', label: 'Style', options: [{ label: 'Text next to a picture', value: 'split' }, { label: 'Banner with a photo behind', value: 'band' }] },
        side: { type: 'radio', label: 'Picture side', options: [{ label: 'Right', value: 'right' }, { label: 'Left', value: 'left' }] },
        title: A('Heading (wrap words in [[double brackets]] to highlight)'),
        text: A('Text'),
        bullets: { type: 'array', label: 'Tick list', arrayFields: { text: T('Text') }, getItemSummary: (i) => i.text || 'Item', defaultItemProps: { text: 'New point' } },
        buttonLabel: T('Button text'),
        buttonUrl: T('Button link (https, mailto:, tel: or #video / #lead)'),
        image: T('Picture (https link)'),
        imageAlt: T('Picture description for screen readers'),
        background: T('Banner photo (https link)'),
        points: { type: 'array', label: 'Points beside a banner', arrayFields: { text: T('Text') }, getItemSummary: (i) => i.text || 'Point', defaultItemProps: { text: 'New point' } },
      },
      defaultProps: { variant: 'split', side: 'right', title: 'See it in [[action]]', text: 'Say what the picture shows in a sentence or two.', bullets: [{ text: 'First point' }, { text: 'Second point' }], buttonLabel: 'Watch the demo video', buttonUrl: '#video', image: '', imageAlt: '', background: '', points: [] },
      render: (p) => <C.Showcase {...p} />,
    },
    PageImage: { label: 'Image', fields: { src: T('Image link (https)'), alt: T('Description for screen readers'), rounded: { type: 'radio', label: 'Rounded corners', options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }] } }, defaultProps: { src: '', alt: '', rounded: 'yes' }, render: (p) => <C.PageImage {...p} /> },

    LeadMagnetCard: { label: 'Download / sign-up card', fields: { columns: cols, tag: T('Small label'), title: T('Title'), cover: T('Text on the book cover'), text: A('Text'), placeholder: T('Email box hint'), buttonLabel: T('Button text') }, defaultProps: { columns: 2, tag: 'FREE RESOURCE', title: 'Get the free playbook', cover: 'The Personalized Video Playbook', text: 'A short guide with templates and scripts.', placeholder: 'Enter your email', buttonLabel: 'Send me the playbook' }, render: (p) => <C.LeadMagnetCard {...p} /> },
    TableCard: { label: 'Table (e.g. leads)', fields: { columns: cols, title: T('Title'), windowTitle: T('Window title (shows a product window)'), windowSubtitle: T('Window subtitle'), sidebar: { type: 'array', label: 'Window sidebar', arrayFields: { label: T('Label') }, getItemSummary: (i) => i.label || 'Item', defaultItemProps: { label: 'Item' } }, kpis: { type: 'array', label: 'Numbers above the table', arrayFields: { value: T('Number'), label: T('Label') }, getItemSummary: (i) => i.value || 'KPI', defaultItemProps: { value: '0', label: 'Label' } }, headings: T('Column headings (comma separated)'), rows: { type: 'array', label: 'Rows', arrayFields: { name: T('Name'), col2: T('Column 2'), col3: T('Column 3'), tag: T('Status') }, getItemSummary: (i) => i.name || 'Row', defaultItemProps: { name: 'Name', col2: '', col3: '', tag: '' } } }, defaultProps: { columns: 2, title: 'Lead tracker', windowTitle: '', windowSubtitle: '', sidebar: [], kpis: [], headings: 'Lead, Company, Status', rows: [{ name: 'Sarah Chen', col2: 'Acme Co.', col3: '', tag: 'Hot lead' }, { name: 'James Miller', col2: 'BrightTech', col3: '', tag: 'New' }] }, render: (p) => <C.TableCard {...p} /> },
    StatsCard: { label: 'Big numbers card', fields: { columns: cols, title: T('Title'), items: { type: 'array', label: 'Numbers', arrayFields: { value: T('Number'), label: T('Label'), icon: iconField }, getItemSummary: (i) => i.value || 'Number', defaultItemProps: { value: '0%', label: 'Label', icon: '' } } }, defaultProps: { columns: 2, title: 'Real results', items: [{ value: '+317%', label: 'Lead conversion', icon: 'target' }, { value: '4.2x', label: 'List growth', icon: 'users' }] }, render: (p) => <C.StatsCard {...p} /> },
    ChecklistCard: { label: 'Checklist card', fields: { columns: cols, title: T('Title'), text: A('Text'), items: { type: 'array', label: 'Items', arrayFields: { label: T('Text'), value: T('Number (optional)') }, getItemSummary: (i) => i.label || 'Item', defaultItemProps: { label: 'Item', value: '' } } }, defaultProps: { columns: 1, title: 'Why teams love it', text: '', items: [{ label: 'Easy to set up', value: '' }, { label: 'Works with your tools', value: '' }] }, render: (p) => <C.ChecklistCard {...p} /> },
    QuoteCard: { label: 'Testimonial card', fields: { columns: cols, heading: T('Heading (optional)'), quotes: { type: 'array', label: 'Testimonials', arrayFields: { text: A('Quote'), name: T('Name'), role: T('Role / company'), avatar: T('Photo (https link)') }, getItemSummary: (i) => i.name || 'Quote', defaultItemProps: { text: 'Add a quote you have permission to use.', name: 'Name', role: 'Role, Company' } } }, defaultProps: { columns: 1, heading: '', quotes: [{ text: 'Add a quote you have permission to use.', name: 'Name', role: 'Role, Company' }] }, render: (p) => <C.QuoteCard {...p} /> },
    StepsCard: { label: 'Steps card', fields: { columns: cols, title: T('Title'), layout: { type: 'radio', label: 'Layout', options: [{ label: 'List', value: 'list' }, { label: 'Row', value: 'row' }] }, items: { type: 'array', label: 'Steps', arrayFields: { title: T('Title'), text: T('Text'), icon: iconField }, getItemSummary: (i) => i.title || 'Step', defaultItemProps: { title: 'Step', text: '', icon: '' } } }, defaultProps: { columns: 2, title: 'Get started in 3 steps', layout: 'row', items: [{ title: 'Connect', text: 'Add your brand.', icon: 'video' }, { title: 'Import', text: 'Add your list.', icon: 'users' }, { title: 'Send', text: 'Watch it grow.', icon: 'send' }] }, render: (p) => <C.StepsCard {...p} /> },
    FeaturesCard: { label: 'Feature list card', fields: { columns: cols, title: T('Title'), items: { type: 'array', label: 'Features', arrayFields: { icon: iconField, title: T('Title'), text: T('Text') }, getItemSummary: (i) => i.title || 'Feature', defaultItemProps: { icon: 'check', title: 'Feature', text: '' } } }, defaultProps: { columns: 2, title: 'Key features', items: [{ icon: 'video', title: 'Personalized video', text: 'One-to-one videos in minutes.' }, { icon: 'chart', title: 'Insights', text: 'Track views and replies.' }] }, render: (p) => <C.FeaturesCard {...p} /> },
    FaqCard: { label: 'Questions card', fields: { columns: cols, title: T('Title'), items: { type: 'array', label: 'Questions', arrayFields: { q: T('Question'), a: A('Answer') }, getItemSummary: (i) => i.q || 'Question', defaultItemProps: { q: 'Question?', a: 'Answer.' } } }, defaultProps: { columns: 2, title: 'Frequently asked questions', items: [{ q: 'Is there a free trial?', a: 'Add your answer here.' }] }, render: (p) => <C.FaqCard {...p} /> },
    KpiCard: { label: 'Single big number card', fields: { columns: cols, title: T('Title'), value: T('Number'), note: T('Note') }, defaultProps: { columns: 1, title: 'Leads captured', value: '128,349', note: '+37% in the last 30 days' }, render: (p) => <C.KpiCard {...p} /> },
    ScheduleCard: { label: 'Date-picker card', fields: { columns: cols, title: T('Title'), text: T('Text'), month: T('Month label'), weekdays: T('Weekday labels, comma separated (7)'), days: T('Days, comma separated (start the selected one with *)'), time: T('Time line'), buttonLabel: T('Button text (scrolls to the form)') }, defaultProps: { columns: 1, title: 'Book a demo', text: 'Pick a time that works for you.', month: 'Mar 2025', weekdays: 'Sun, Mon, Tue, Wed, Thu, Fri, Sat', days: '9, 10, 11, *12, 13, 14, 15', time: '10:00 AM (30 min)', buttonLabel: 'Confirm demo' }, render: (p) => <C.ScheduleCard {...p} /> },
    ButtonCard: { label: 'Text and buttons card', fields: { columns: cols, eyebrow: T('Small label'), title: T('Title'), text: A('Text'), buttons: buttonArray }, defaultProps: { columns: 2, eyebrow: 'Have a question?', title: "Let's connect", text: 'Our team is here to help.', buttons: [{ label: 'Contact our team', url: 'mailto:hello@example.com', style: 'secondary' }] }, render: (p) => <C.ButtonCard {...p} /> },
  },
};

// Every image-link field also offers "Choose from my library" (images made in any studio).
withImagePickers(puckConfig.components);
