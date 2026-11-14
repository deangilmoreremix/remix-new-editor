/** Design 07 "Street poster" as an editable Puck page. All names, figures and quotes are SAMPLE copy. */
const f = (key, label, type = 'text', required = true) => ({ key, label, type, required });

export default {
  id: 'puck-poster',
  name: 'Street poster',
  description: 'Loud magenta, orange and purple poster look with a tilted video, form card, agency logos, case studies and a chevron pipeline (sample content).',
  designClass: 'poster',
  theme: { mode: 'light', accent: '#d6177f', highlight: '#ffd60a', bg: '#fbf9fd', text: '#1c0f3a', font: 'system' },
  layout: 'puck',
  puck: true,
  radius: 10,
  puckData: {
    root: { props: { design: 'poster', accent: '#d6177f', background: '#fbf9fd', text: '#1c0f3a', surface: '#ffffff' } },
    content: [
      { type: 'NavBar', props: { id: 'poster-nav', brand: 'SmartVideo AI', logo: '/landing-art/07/logo.webp', links: ['How It Works', 'Case Studies', 'Features', 'Pricing', 'Resources'].map((label) => ({ label, url: '' })), loginLabel: '', loginUrl: '', ctaLabel: 'Book a Strategy Call' } },
      { type: 'Hero', props: {
        id: 'poster-hero', variant: 'copy-video-form', eyebrow: 'Personalized video at scale',
        headline: 'Turn Cold\nContacts Into [[Hot Leads]] With Personalized\nVideo',
        subhead: 'A done-for-you personalized video platform that helps agencies and growth teams start more conversations, book more meetings, and build predictable pipeline.',
        bullets: [{ text: 'Personalized at scale' }, { text: 'Higher response rates' }, { text: 'More booked meetings' }],
        buttons: [{ label: 'Get Started Free', url: 'https://example.com/start', style: 'primary' }, { label: 'Book a Strategy Call', url: 'https://example.com/book', style: 'secondary' }],
        chip: 'Hey {First Name}!', photo: '/landing-art/07/presenter.webp', showForm: 'yes',
        formTitle: 'See How Personalized Video Can Fill Your Pipeline', formSubtitle: 'Get a 2-minute custom video example and a plan for your business.',
        formFields: [f('name', 'Your Name'), f('email', 'Work Email', 'email'), f('company', 'Company Name'), f('goal', 'Monthly Lead Goal?', 'text', false)],
        submitLabel: 'Send My Personalized Video', privacy: 'We’ll only use your info to send your video and relevant resources. No spam, ever.',
      } },
      { type: 'Strip', props: { id: 'poster-logos', kind: 'logos', title: 'Trusted by growth-focused agencies & brands', items: ['NorthPeak Digital', 'Brightside Media', 'ScaleHouse Agency', 'Momentum Creative', 'LaunchLab Growth'].map((title) => ({ title, text: '', value: '', icon: '' })) } },
      { type: 'PosterFeatures', props: {"id": "poster-feats", "heading": "Everything You Need to Generate Leads [[with Video]]", "text": "A full lead generation system — from contact import to personalized video creation to a booked pipeline.", "items": [{"icon": "video", "title": "Personalized Videos at Scale", "text": "Create 1:1 videos for hundreds or thousands of contacts."}, {"icon": "bolt", "title": "Higher Response Rates", "text": "Cut through the noise with a personal, human touch."}, {"icon": "target", "title": "More Booked Meetings", "text": "Turn views into conversations, demos, and sales calls."}, {"icon": "layers", "title": "Agency-Ready & Done-for-You", "text": "White-labeled, campaign support, and creative execution from our team."}]} },
      { type: 'PosterProof', props: {"id": "poster-proof", "casesTitle": "Agency Case Studies", "casesText": "Real results from teams using personalized video to build pipeline.", "cases": [{"photo": "/landing-art/07/case1.webp", "brand": "NorthPeak Digital", "logo": "/landing-art/07/cl1.webp", "value1": "+317%", "label1": "More Replies", "value2": "+4.2x", "label2": "Booked Meetings"}, {"photo": "/landing-art/07/case2.webp", "brand": "Brightside Media", "logo": "/landing-art/07/cl2.webp", "value1": "+268%", "label1": "Lead Conversion", "value2": "+6.1x", "label2": "Pipeline Value"}], "quote": "This completely changed our outreach. The personalized videos feel high-touch, but we’re sending them at scale and booking more meetings than ever.", "quoteName": "Jordan Ellis", "quoteRole": "CEO, ScaleHouse Agency", "quotePhoto": "/landing-art/07/jordan.webp", "pipelineTitle": "Your Lead Pipeline, Visualized", "pipelineText": "From contacts to conversations to closed deals.", "steps": [{"icon": "users", "label": "Import Contacts"}, {"icon": "play", "label": "Create Personalized Videos"}, {"icon": "send", "label": "Launch Outreach"}, {"icon": "calendar", "label": "Book Meetings"}, {"icon": "chart", "label": "Fill Your Pipeline"}]} },
      { type: 'PosterCta', props: {"id": "poster-cta", "heading": "Bring Your Contacts. We’ll Do the Rest.", "text": "Import your existing leads and instantly create personalized video outreach campaigns.", "dropTitle": "Import Contacts", "dropHint": "Drag & drop a CSV, or click to upload", "checks": [{"text": "Works with your existing contact lists"}, {"text": "Map personalized fields (name, company, etc.)"}, {"text": "Launch your first campaign in minutes"}], "ctaTitle": "Ready to Turn More Contacts into Customers?", "buttons": [{"label": "Get Started Free", "url": "https://example.com/start", "style": "primary"}, {"label": "Book a Strategy Call", "url": "https://example.com/book", "style": "secondary"}]} },
      { type: 'Footer', props: { id: 'poster-footer', text: 'Sample content for demonstration. Replace before sending.', links: [] } },
    ],
    zones: {},
  },
};
