// Public SmartWarmupAI feature pages (/email-warmup and /email-warmup/<slug>/).
// Pure data: rendered by src/components/guides/renderWarmupPages.js and written to static HTML by
// scripts/build-warmup-pages.mjs. Screenshots are dark-mode captures of the dashboard in public/email-warmup/img/.
// Copy is written for SmartWarmupAI and only claims what the studio does (see src/data/askKb/smartwarmupai.json):
// it runs on recorded demo data unless a real backend is configured, and warmup never guarantees inbox placement.

export const WARMUP_BASE = '/email-warmup';
export const STUDIO_PATH = '/smartwarmupai';
export const PRODUCT = 'SmartWarmupAI';
const SHOT = (name) => `/email-warmup/img/${name}.webp`;

/** @typedef {{ slug:string, nav:string, studio:string, studioLabel:string, title:string, h1:string, lead:string,
 *   shot:string, description:string, cards:{title:string, text:string}[], steps:string[], note?:string,
 *   faq:{q:string, a:string}[] }} WarmupPage */

/** @type {WarmupPage[]} */
export const WARMUP_PAGES = [
  {
    slug: 'warmup',
    nav: 'Warmup',
    studio: `${STUDIO_PATH}/mailboxes`,
    studioLabel: 'Open Accounts in the studio',
    title: 'Email warmup that builds sender reputation',
    h1: 'Email warmup that builds sender reputation',
    lead: 'Each mailbox trades small amounts of real email, starts slowly and ramps up day by day, so mailbox providers see a sender that behaves like a person before you send a single campaign.',
    shot: SHOT('warmup'),
    description: 'Warm up every mailbox with a gradual ramp, a sending window and sending days. Track warmup reputation and domain authentication in one place.',
    cards: [
      { title: 'A ramp you control', text: 'Set the starting volume, the daily increase, the maximum volume and the reply rate. The default plan starts at 10 emails a day and rises by 1 a day up to 40.' },
      { title: 'Sending window and days', text: 'Choose the start and end time and the days warmup runs: every day, weekdays, follow your sending plan, or single days.' },
      { title: 'Where warmup mail lands', text: 'Keep warmup messages in their own folder, leave them in the inbox, or archive them, so they never crowd out real replies.' },
      { title: 'Reputation at a glance', text: 'See warmup today, the reply target, days warming and a warmup reputation score, plus SPF, DKIM and DMARC checks for the domain.' },
    ],
    steps: [
      'Open a mailbox from Accounts and go to its Warmup tab.',
      'Pick a ramp and a sending window, then press Start warmup.',
      'Pause at any time. Pausing keeps the ramp history, and Resume continues where you stopped.',
      'Start several mailboxes at once from the list when you add a batch.',
    ],
    note: 'Warmup improves your odds, it does not guarantee inbox placement. Fix SPF, DKIM and DMARC first.',
    faq: [
      { q: 'How long should I warm a new mailbox?', a: 'Warm a new mailbox for a few weeks before sending campaigns at volume, and keep warmup running alongside campaigns so reputation stays steady.' },
      { q: 'Can I warm several mailboxes at once?', a: 'Yes. Select mailboxes in the Accounts list and start warmup for all of them in one action.' },
      { q: 'Does warmup guarantee the inbox?', a: 'No. Placement also depends on your domain setup, list quality and what you send. Use Deliverability and placement tests to check.' },
    ],
  },
  {
    slug: 'mailboxes',
    nav: 'Mailboxes',
    studio: `${STUDIO_PATH}/mailboxes`,
    studioLabel: 'Open Accounts in the studio',
    title: 'Connect every mailbox you send from',
    h1: 'Connect every mailbox you send from',
    lead: 'Add Google Workspace, Microsoft 365 or any SMTP and IMAP account, see the health of each one, and let clients connect their own mailboxes with an invite link.',
    shot: SHOT('connect-mailboxes-accounts'),
    description: 'Connect Google, Microsoft or SMTP/IMAP mailboxes, check domain health and manage warmup and sending per mailbox.',
    cards: [
      { title: 'Google, Microsoft or SMTP', text: 'Sign in with Google, use an app password, grant a Workspace domain, connect a Microsoft organization or a single mailbox, or add any SMTP and IMAP account. You can also import mailboxes in bulk.' },
      { title: 'Health filters', text: 'Filter the list by Healthy, Warming or Needs attention, search by address and group mailboxes with tags.' },
      { title: 'One drawer per mailbox', text: 'Overview, Deliverability, Analytics, Warmup, Sending and Settings live in a single drawer, so nothing is buried in menus.' },
      { title: 'Invite a client', text: 'Send a link so a client connects their own mailbox, without sharing a password with you.' },
    ],
    steps: [
      'Choose Add account and pick Google, Microsoft or Other (SMTP and IMAP).',
      'Check the domain: SPF, DKIM and DMARC are verified for you.',
      'Turn on warmup and set a daily sending limit.',
      'Add the mailbox to a campaign when it is ready.',
    ],
    faq: [
      { q: 'Can I connect a personal Gmail address?', a: 'Yes, with an app password. Workspace mailboxes can also use sign-in or a domain grant.' },
      { q: 'Where do I see my sending domains?', a: 'Sending domains lists every domain behind your mailboxes with its authentication status.' },
    ],
  },
  {
    slug: 'campaigns',
    nav: 'Campaigns',
    studio: `${STUDIO_PATH}/campaigns`,
    studioLabel: 'Open Campaigns in the studio',
    title: 'Cold email campaigns and sequences',
    h1: 'Cold email sequences that read as personal',
    lead: 'Build a multi-step sequence with follow-ups, branch on what happens, and spread sending across your mailboxes within daily limits and your chosen hours.',
    shot: SHOT('campaigns-and-sequences'),
    description: 'Build cold email sequences with follow-ups, branching, AI-written copy and per-mailbox sending limits.',
    cards: [
      { title: 'A guided wizard', text: 'Name the campaign, pick who gets it, write what they receive, set when it sends and from which mailboxes, then review the launch plan.' },
      { title: 'Steps that branch', text: 'Mix Email, If / else, If they reply, Switch, Go to a step and AI step blocks to build the sequence you want.' },
      { title: 'Write with AI', text: 'Draft email copy and subject ideas with AI, then edit them. Variables such as first name and company personalize every message.' },
      { title: 'Safe sending controls', text: 'Set a sending window, a maximum per mailbox per day, and switches for stop on reply, stop on meeting booked, tracking, UTM parameters and an unsubscribe header.' },
    ],
    steps: [
      'Press New campaign and add your leads, from a list or a CSV.',
      'Write the steps and follow-ups, or let AI draft them.',
      'Pick the mailboxes and the sending window.',
      'Review the launch plan and start the campaign.',
    ],
    faq: [
      { q: 'Does a campaign stop when someone replies?', a: 'Yes. Stop on reply is a campaign setting, and so is stop on meeting booked.' },
      { q: 'Can I group campaigns?', a: 'Yes. Folders keep campaigns for each client or offer together.' },
    ],
  },
  {
    slug: 'inbox',
    nav: 'Inbox',
    studio: `${STUDIO_PATH}/inbox`,
    studioLabel: 'Open Inbox in the studio',
    title: 'One inbox for every reply',
    h1: 'One inbox for every reply',
    lead: 'Replies from all your mailboxes land in one place, sorted into views like Action required, Hot leads and Needs a reply, so the next step is always obvious.',
    shot: SHOT('inbox'),
    description: 'A unified inbox for replies from every mailbox, with smart views, AI-drafted replies, snooze and send later.',
    cards: [
      { title: 'Views that sort themselves', text: 'Action required, Hot leads, Needs a reply, Follow up, Declined and Automated, plus Drafts, Sent, Archive, Spam and Trash.' },
      { title: 'Reply the way you work', text: 'Reply or forward, send later up to 29 days out, snooze, mark as unread, archive a thread, or pause that contact\'s follow-ups.' },
      { title: 'AI-drafted replies', text: 'Review a drafted reply and choose Approve and send or Discard. Nothing goes out without your approval.' },
      { title: 'Know who you are talking to', text: 'A contact panel shows the person, and you can add them as a contact in one click. Insert saved replies and booking links.' },
    ],
    steps: [
      'Open Inbox and pick a view, such as Hot leads.',
      'Open a conversation and read the thread and contact panel.',
      'Reply, snooze, or approve the AI-drafted reply.',
      'Move the lead into your CRM pipeline when it turns into a deal.',
    ],
    faq: [
      { q: 'Do replies from different mailboxes mix together?', a: 'Yes. That is the point: one inbox, with each message still tied to the mailbox that received it.' },
    ],
  },
  {
    slug: 'lead-finder',
    nav: 'Lead finder',
    studio: STUDIO_PATH,
    studioLabel: 'Open the studio',
    title: 'Find the businesses worth emailing',
    h1: 'Find the businesses worth emailing',
    lead: 'Search a map by business type and place, draw the exact area you want, and select the results that are worth a campaign.',
    shot: SHOT('lead-finder'),
    description: 'Map-based lead search: pick a category, search an area or draw one, and send what you find into a campaign.',
    cards: [
      { title: 'Search any area', text: 'Pick a category or type what to look for, move the map, then search this area. Or draw a rectangle, circle or custom shape.' },
      { title: 'Color the map your way', text: 'Show results by reachability, status, score or rating so the best prospects stand out.' },
      { title: 'Select in bulk', text: 'Lasso several results at once instead of clicking them one by one.' },
      { title: 'Straight into outreach', text: 'Add the people you find to your contacts and into a campaign.' },
    ],
    steps: [
      'Choose a business type and move the map to your market.',
      'Search the area, or draw the shape you want.',
      'Select the best results.',
      'Add them to contacts and start a campaign.',
    ],
    faq: [
      { q: 'Is there a deep link into Lead finder?', a: 'Open the studio and choose Lead finder from the side menu.' },
    ],
  },
  {
    slug: 'crm',
    nav: 'CRM',
    studio: `${STUDIO_PATH}/pipeline`,
    studioLabel: 'Open Deals in the studio',
    title: 'A pipeline for your deals',
    h1: 'A pipeline for your deals',
    lead: 'Move interested leads from reply to meeting to closed on a simple board, with tasks and booked calls kept next to the conversation.',
    shot: SHOT('crm-pipelines-deals-tasks-meetings'),
    description: 'Pipelines, deals, tasks and meetings built into your outreach workspace, with contacts, segments and labels.',
    cards: [
      { title: 'Pipelines and deals', text: 'Define the stages a deal moves through, then drag deals along as the conversation moves forward.' },
      { title: 'Tasks that do not slip', text: 'Keep follow-up to-dos beside the deal they belong to.' },
      { title: 'Meetings and calls', text: 'Schedule calls, see the ones prospects book, and join, reschedule or cancel from one list.' },
      { title: 'Contacts, segments, labels', text: 'Import contacts in four steps, group them into segments, label them, and keep a suppression list of people you must not email.' },
    ],
    steps: [
      'Create a pipeline with the stages you sell through.',
      'Add a deal from a reply, or let an automation create it.',
      'Add tasks and schedule the meeting.',
      'Mark the deal won or lost and keep the history.',
    ],
    faq: [
      { q: 'Can I import my existing contacts?', a: 'Yes. Upload a file, map the columns, review and import. Sheet sync keeps a spreadsheet connected.' },
    ],
  },
  {
    slug: 'automations',
    nav: 'Automations',
    studio: `${STUDIO_PATH}/automations`,
    studioLabel: 'Open Automations in the studio',
    title: 'When this happens, do that',
    h1: 'When this happens, do that',
    lead: 'Turn replies, booked meetings, bounces and warmup dips into actions: ping Slack, open a deal, update your CRM or fire a webhook.',
    shot: SHOT('automations'),
    description: 'Trigger-based automations for replies, meetings and deliverability events, connected to Slack, your CRM and webhooks.',
    cards: [
      { title: 'Pick a trigger', text: 'Start from an event such as a meeting being booked, a reply arriving or a mailbox needing attention.' },
      { title: 'Connect the action', text: 'Post to Slack, create a deal, push to your CRM or call a webhook.' },
      { title: 'See what is running', text: 'The page counts your automations, how many are active and how many action steps they contain.' },
      { title: 'Let AI help', text: 'Ask Remie, the built-in AI assistant, about your campaigns. It asks for approval before it takes an action.' },
    ],
    steps: [
      'Press New automation.',
      'Choose the trigger.',
      'Connect the actions you want to happen.',
      'Switch it on and watch the count of active automations.',
    ],
    faq: [
      { q: 'Can automations call my own tools?', a: 'Yes. Use a webhook action to send the event to any URL you control.' },
    ],
  },
  {
    slug: 'sending',
    nav: 'Sending engine',
    studio: `${STUDIO_PATH}/settings`,
    studioLabel: 'Open Settings in the studio',
    title: 'A sending engine that behaves like a person',
    h1: 'Sending that looks human, not automated',
    lead: 'Give every mailbox a workday of its own: randomized hours, daily volume, breaks and spacing between sends, in its own timezone.',
    shot: SHOT('settings'),
    description: 'Per-mailbox sending behavior with randomized hours, daily limits and spacing, spread across all connected mailboxes.',
    cards: [
      { title: 'A workday per mailbox', text: 'Set ranges instead of fixed values. Each mailbox picks its own start, finish, lunch break and daily target.' },
      { title: 'Spread across mailboxes', text: 'A campaign sends from every mailbox you assign, within a daily limit per mailbox and a pause between sends.' },
      { title: 'Timezone aware', text: 'Mailboxes and contacts keep their own timezones, so email arrives in working hours.' },
      { title: 'Compliance built in', text: 'Add an unsubscribe header and keep a suppression list so opted-out people are never emailed again.' },
    ],
    steps: [
      'Open Settings and go to Sending.',
      'Set the hours, volume and spacing you want.',
      'Assign mailboxes to a campaign.',
      'Watch the sends spread out across the day.',
    ],
    faq: [
      { q: 'Can I set different limits per mailbox?', a: 'Yes. Each mailbox has its own sending tab, and campaigns also cap the maximum per mailbox per day.' },
    ],
  },
  {
    slug: 'analytics',
    nav: 'Analytics',
    studio: `${STUDIO_PATH}/dashboard`,
    studioLabel: 'Open Analytics in the studio',
    title: 'Campaign analytics and client reports',
    h1: 'See what is working, and show clients',
    lead: 'Track emails sent, open rate and reply rate over any period, per campaign and per mailbox, and share results with a link or by email.',
    shot: SHOT('analytics-and-reports'),
    description: 'Analytics for sends, opens, replies and bounces, plus shareable reports for clients.',
    cards: [
      { title: 'The numbers that matter', text: 'Emails sent, open rate and reply rate over the period you choose.' },
      { title: 'Per campaign, per mailbox', text: 'Compare campaigns and mailboxes to find what to scale and what to pause.' },
      { title: 'Client-ready reports', text: 'Share campaign results by link or by email, with no screenshots to assemble.' },
      { title: 'Audit trail', text: 'The audit log records who changed what in your workspace.' },
    ],
    steps: [
      'Open Analytics and choose a date range.',
      'Drill into a campaign or a mailbox.',
      'Open Reports, pick a campaign and share it.',
    ],
    faq: [
      { q: 'How accurate is open tracking?', a: 'Opens are a rough signal, because mail apps can load images automatically. Weigh reply rate more heavily.' },
    ],
  },
  {
    slug: 'deliverability',
    nav: 'Deliverability',
    studio: `${STUDIO_PATH}/deliverability`,
    studioLabel: 'Open Deliverability in the studio',
    title: 'Watch your deliverability',
    h1: 'Know where your email lands',
    lead: 'See inbox rate, spam rate, bounce rate and complaint rate for every mailbox and campaign, and send placement tests to seed inboxes before you scale.',
    shot: SHOT('deliverability-and-placement-tests'),
    description: 'Inbox, spam, bounce and complaint rates per mailbox and campaign, with placement tests to seed inboxes.',
    cards: [
      { title: 'Four health rates', text: 'Inbox rate, spam rate, bounce rate and complaint rate, side by side.' },
      { title: 'Placement tests', text: 'Send test copies to seed inboxes with New test, or run several at once with New batch.' },
      { title: 'Authentication checks', text: 'SPF, DKIM and DMARC are checked for each sending domain, with a clear fix when one fails.' },
      { title: 'Spot trouble early', text: 'Filter your mailboxes by Needs attention to find the ones that are struggling before they hurt a campaign.' },
    ],
    steps: [
      'Open Deliverability and check the four rates.',
      'Run a placement test for the mailbox you plan to scale.',
      'Fix authentication issues and lower volume where needed.',
      'Test again and compare.',
    ],
    note: 'Healthy rates depend on your list and your copy as well as your setup.',
    faq: [
      { q: 'What should I fix first when mail goes to spam?', a: 'Authenticate the domain with SPF, DKIM and DMARC, lower the daily volume, and clean the list.' },
    ],
  },
  {
    slug: 'integrations',
    nav: 'Integrations',
    studio: `${STUDIO_PATH}/integrations`,
    studioLabel: 'Open Integrations in the studio',
    title: 'Connect the tools you already use',
    h1: 'Plays well with your stack',
    lead: 'Connect HubSpot, Salesforce, Pipedrive, Apollo and Clay, plus community apps, so contacts, deals and replies stay in sync.',
    shot: SHOT('integrations'),
    description: 'Integrations with HubSpot, Salesforce, Pipedrive, Apollo, Clay and community apps.',
    cards: [
      { title: 'CRMs and data tools', text: 'Link HubSpot, Salesforce, Pipedrive, Apollo and Clay, and see what is connected at a glance.' },
      { title: 'Community apps', text: 'Add apps built by the community when the built-in list is not enough.' },
      { title: 'Webhooks', text: 'Webhooks send events to your own systems.' },
      { title: 'Templates and forms', text: 'Reusable email templates, and hosted lead-capture forms you can embed anywhere.' },
    ],
    steps: [
      'Open Integrations.',
      'Choose a tool and authorize it.',
      'Use it from an automation or a campaign.',
    ],
    faq: [
      { q: 'Where do I manage connections later?', a: 'Integrations shows what is connected, and Settings holds the developer connections.' },
    ],
  },
  {
    slug: 'developers',
    nav: 'API & webhooks',
    studio: `${STUDIO_PATH}/settings`,
    studioLabel: 'Open Settings in the studio',
    title: 'API and webhooks',
    h1: 'Build on top of SmartWarmupAI',
    lead: 'Create API keys, register OAuth apps and webhooks, and read the API reference in the built-in Help site.',
    shot: SHOT('settings'),
    description: 'API keys, OAuth apps, webhooks and an API reference for developers and agents.',
    cards: [
      { title: 'API keys', text: 'Create keys for your own scripts and tools.' },
      { title: 'OAuth apps and webhooks', text: 'Register apps and webhooks from Settings under Developers.' },
      { title: 'Workspace controls', text: 'Members, teams, roles and access, branding, sending limits and inbox tagging live in Settings.' },
      { title: 'Help and docs', text: 'The Help tab has guides, learn articles, the API reference and a section for developers and agents.' },
    ],
    steps: [
      'Open Settings, then Developers.',
      'Create an API key or register a webhook.',
      'Use the Help tab to read the API reference.',
    ],
    faq: [
      { q: 'Is there a sandbox?', a: 'The studio runs on recorded demo data by default, which is a safe place to explore before you connect a real backend.' },
    ],
  },
  {
    group: 'use-case', slug: 'founders', nav: 'Founders', studio: STUDIO_PATH, studioLabel: 'Open the studio',
    title: 'Cold email for founders', h1: 'Land your first customers with cold email',
    lead: 'Set up a few mailboxes, warm them up and send your first outreach without hiring a sales team or learning five tools.',
    shot: SHOT('overview'),
    description: 'How founders use SmartWarmupAI to warm mailboxes, send sequences and handle replies in one workspace.',
    cards: [
      { title: 'One place for everything', text: 'Mailboxes, warmup, campaigns, inbox and a simple CRM, without stitching tools together.' },
      { title: 'Write fast', text: 'Draft sequences with AI, then personalize with variables such as first name and company.' },
      { title: 'Stay out of spam', text: 'Warm up first, check SPF, DKIM and DMARC, and watch placement before you scale.' },
      { title: 'Never miss a reply', text: 'Every reply lands in one inbox, sorted into hot leads and what needs an answer.' },
    ],
    steps: ['Connect one or two mailboxes on a separate sending domain.', 'Start warmup and wait before you send at volume.', 'Build a short sequence and send to a small, targeted list.', 'Reply from the inbox and move interested leads into a pipeline.'],
    faq: [{ q: 'How many mailboxes do I need?', a: 'Start with one or two and add more as volume grows, so each mailbox stays within safe daily limits.' }],
  },
  {
    group: 'use-case', slug: 'agencies', nav: 'Agencies', studio: `${STUDIO_PATH}/dashboard`, studioLabel: 'Open Analytics in the studio',
    title: 'Cold email for agencies', h1: 'Run outreach for many clients from one workspace',
    lead: 'Invite clients to connect their own mailboxes, keep campaigns organized in folders and send them reports by link or email.',
    shot: SHOT('analytics-and-reports'),
    description: 'Manage client mailboxes, campaigns and reports for many clients from a single SmartWarmupAI workspace.',
    cards: [
      { title: 'Client mailboxes without passwords', text: 'Send an invite link so a client connects their own mailbox themselves.' },
      { title: 'Folders and tags', text: 'Group campaigns and mailboxes by client so nothing gets mixed up.' },
      { title: 'Reports that explain themselves', text: 'Share campaign results by link or by email.' },
      { title: 'Roles and access', text: 'Add team members and control who can see and change what.' },
    ],
    steps: ['Create a folder per client.', 'Invite each client to connect a mailbox.', 'Run warmup and campaigns per client.', 'Share a report on a schedule you set.'],
    faq: [{ q: 'Can team members see only some clients?', a: 'Use teams, roles and access in Settings to limit what each person can open.' }],
  },
  {
    group: 'use-case', slug: 'sales', nav: 'Sales teams', studio: `${STUDIO_PATH}/pipeline`, studioLabel: 'Open Deals in the studio',
    title: 'Cold email for sales teams', h1: 'Give every rep a warmed-up mailbox and a pipeline',
    lead: 'Scale outbound across the team with shared deliverability monitoring, one inbox and deals that update themselves.',
    shot: SHOT('crm-pipelines-deals-tasks-meetings'),
    description: 'Outbound for sales teams: warmed mailboxes, sequences, a shared inbox, pipelines and automations.',
    cards: [
      { title: 'Sequences that stop on reply', text: 'Follow up automatically and stop the moment a prospect replies or books a meeting.' },
      { title: 'A pipeline built in', text: 'Move replies to meetings to closed, with tasks and calls alongside.' },
      { title: 'Automations', text: 'Open a deal, post to Slack or update your CRM when a lead turns interested.' },
      { title: 'Team visibility', text: 'Analytics per campaign and mailbox show which reps and messages work.' },
    ],
    steps: ['Connect a mailbox for each rep.', 'Warm them up and share one sequence.', 'Route replies to the inbox and create deals.', 'Review analytics weekly and adjust.'],
    faq: [{ q: 'Does it integrate with our CRM?', a: 'Yes. HubSpot, Salesforce and Pipedrive are available from Integrations.' }],
  },
  {
    group: 'use-case', slug: 'recruiters', nav: 'Recruiters', studio: `${STUDIO_PATH}/contacts`, studioLabel: 'Open Contacts in the studio',
    title: 'Cold email for recruiters', h1: 'Reach candidates and clients without landing in spam',
    lead: 'Import candidate lists, write personal outreach and keep every conversation in one inbox.',
    shot: SHOT('contacts'),
    description: 'Recruiters use SmartWarmupAI to import contacts, run personal outreach and track conversations.',
    cards: [
      { title: 'Import in minutes', text: 'Upload a file, map the columns and import, or keep a spreadsheet in sync.' },
      { title: 'Segments and labels', text: 'Group people by role, location or stage and send each group the right message.' },
      { title: 'Personal at scale', text: 'Variables and AI help every message read as written for one person.' },
      { title: 'Respect opt-outs', text: 'A suppression list keeps people who said no off every future campaign.' },
    ],
    steps: ['Import your candidate or client list.', 'Segment it by role or stage.', 'Send a short sequence from a warmed mailbox.', 'Handle replies from the inbox.'],
    faq: [{ q: 'Can I keep my own spreadsheet?', a: 'Yes. Sheet sync keeps contacts connected to your spreadsheet.' }],
  },
  {
    group: 'use-case', slug: 'fundraising', nav: 'Fundraising', studio: `${STUDIO_PATH}/campaigns`, studioLabel: 'Open Campaigns in the studio',
    title: 'Cold email for fundraising', h1: 'Reach investors with outreach that gets read',
    lead: 'Warm a mailbox, send a tight sequence to a targeted list of investors and keep every thread and follow-up in one place.',
    shot: SHOT('templates-and-forms'),
    description: 'Use SmartWarmupAI for investor outreach: templates, sequences, a shared inbox and a deals pipeline.',
    cards: [
      { title: 'Reusable templates', text: 'Save your intro, follow-up and update emails once and reuse them.' },
      { title: 'Follow-ups that stop', text: 'Sequences stop on reply so you never chase someone who already answered.' },
      { title: 'A pipeline for investors', text: 'Track each conversation from first reply to term sheet.' },
      { title: 'Hosted forms', text: 'Collect interest with an embeddable lead-capture form.' },
    ],
    steps: ['Build a targeted investor list.', 'Write the intro and one follow-up from a template.', 'Send from a warmed mailbox.', 'Track replies and next steps in a pipeline.'],
    faq: [{ q: 'How big should the first batch be?', a: 'Start small, check replies and placement, then widen the list.' }],
  },
];

export const PRODUCT_PAGES = WARMUP_PAGES.filter((p) => p.group !== 'use-case');
export const USE_CASE_PAGES = WARMUP_PAGES.filter((p) => p.group === 'use-case');

export const LEARN = [
  ['email-warmup', 'Email warmup'], ['deliverability', 'Deliverability'], ['spf-dkim-dmarc', 'SPF, DKIM and DMARC'],
  ['cold-email-rules', 'Cold email rules'], ['inbox-placement', 'Inbox placement'], ['warmup-pools', 'Warmup pools'],
  ['reputation-recovery', 'Reputation recovery'], ['personalization', 'Personalization'], ['glossary', 'Glossary'],
].map(([slug, label]) => ({ href: `/smartwarmupai-help/learn/${slug}/`, label }));

export const getWarmupPage = (slug) => WARMUP_PAGES.find((p) => p.slug === slug) || null;

export const HUB = {
  title: 'Email warmup, cold outreach and inbox in one workspace',
  h1: 'Email warmup, cold outreach and one inbox',
  lead: 'Connect mailboxes, warm them up, send sequences and handle every reply from one workspace. Explore each feature below, then open it live in the studio.',
  shot: SHOT('overview'),
  description: 'SmartWarmupAI: email warmup, cold email campaigns, a unified inbox, CRM, automations and deliverability monitoring in one workspace.',
  steps: [
    { title: 'Connect your mailboxes', text: 'Add Google, Microsoft or any SMTP and IMAP account and check its domain health.', slug: 'mailboxes' },
    { title: 'Warm them up', text: 'Each mailbox ramps up slowly with a sending window you control.', slug: 'warmup' },
    { title: 'Send your campaigns', text: 'Build a sequence, add contacts and spread sending across mailboxes.', slug: 'campaigns' },
    { title: 'Watch your deliverability', text: 'Track inbox, spam and bounce rates and run placement tests.', slug: 'deliverability' },
  ],
  demoNote: 'The studio opens on a recorded sample workspace, so you can click around safely. Nothing is sent until a real backend is connected.',
};
