// Tours for the Agents group (and Outreach, which opens at #/outreach). Studios that embed another app in an
// iframe (Video Agent, Workbench, Website Builder) are toured from the outside: the page chrome and the frame.
import { byText, header, academy } from './util.js';

export default [
  {
    id: 'video-agent', route: 'video-agent', version: 1,
    steps: [
      { title: 'Video Agent', body: 'Describe an animation and an AI agent writes the code, previews it live and renders an MP4 in your browser.', target: header('video-agent'), side: 'bottom' },
      { title: 'The agent workspace', body: 'Type what you want to see in the prompt box. Pick a model, attach images, or start from an example. After the first result you can keep chatting to refine it.', target: 'iframe[title="SmartVid Video Agent"]', side: 'over' },
      { title: 'Needs your API key', body: 'This studio uses your own OpenAI key. Add it in Settings if the agent asks for one.', target: '[data-sidebar-item="settings"]', side: 'right', sidebar: true },
    ],
  },
  {
    id: 'zackd', route: 'zackd', version: 1,
    steps: [
      { title: 'Zack D Studio', body: 'One curiosity question becomes a script, 3D character sheets, keyframes, video clips and a final cut.', target: header('zackd'), side: 'bottom' },
      { title: 'Ask your question', body: 'Type one curious question. Keep it simple and specific.', target: '#z-prompt-textarea', side: 'top' },
      { title: 'Look and voice', body: 'Choose the visual style and the narrator voice.', target: ['#z-look-btn', '#z-voice-btn'], side: 'top' },
      { title: 'Templates and advanced', body: 'Start from a template, or open Advanced for fine control.', target: ['#z-templates-btn', '#z-advanced-btn'], side: 'top' },
      { title: 'Build it step by step', body: 'The main button moves you through the pipeline: script, approve, character sheets, keyframes, clips, final.', target: 'button[data-step]', side: 'top' },
    ],
  },
  {
    id: 'director', route: 'director', version: 1,
    steps: [
      { title: 'Director', body: 'An AI editor with 48 agents. Chat with it to summarise, clip, caption, dub or enhance a video.', target: header('director'), side: 'bottom' },
      { title: 'Pick an agent type', body: 'Filter the agents by category.', target: '#category-filter', side: 'bottom' },
      { title: 'The agents', body: 'Each button is a specialist. Click one to start with its job.', target: '#agents-grid', side: 'right' },
      { title: 'Quick actions', body: 'One-click starting points for common edits.', target: '.action-btn', side: 'top' },
      { title: 'Tell it what to do', body: 'Type an instruction and press send. Director works on a loaded video: open it from the Render studio or with a video link.', target: '#command-input', side: 'top' },
    ],
  },
  {
    id: 'timeline', route: 'timeline', version: 1,
    steps: [
      { title: 'Timeline Editor', body: 'A multi-track editor with a media pool, AI generation tools, effects, captions and MP4 export.', target: ['.pm-window', '.cinegen-root'], side: 'over' },
      { title: 'Your projects', body: 'Projects and finished videos live here. Create a new project or open an existing one.', target: ['[data-testid="home-view-projects"]', '.pm-bottombar__btn'], side: 'bottom' },
      { title: 'Workspace tabs', body: 'Once a project is open, these tabs switch between Elements, Director, Edit, Export and more.', target: '.top-nav__tab', side: 'bottom' },
      { title: 'Media', body: 'Import your clips, images and audio, or pull stock media.', target: ['.mp__tool-btn[title="Import media files"]', '.left-panel__switch-btn'], side: 'right' },
      { title: 'Cut and play', body: 'Use the tool rail to cut clips, and the play button to preview.', target: ['.tool-sidebar__btn', '.timeline-viewer__btn--play'], side: 'right' },
      { title: 'Export', body: 'When you are happy, open the Export tab to render your video.', target: '.top-nav__tab:nth-of-type(6)', side: 'bottom' },
    ],
  },
  {
    id: 'workbench', route: 'workbench', version: 1,
    steps: [
      { title: 'Workbench', body: 'A multi-track bench: arrange your generations with motion cards and sound, edit with an AI chat, and export an MP4.', target: header('workbench'), side: 'bottom' },
      { title: 'Add your generations', body: 'Bring your Library videos and images onto the bench.', target: '.studio-topbar button.btn-primary-modern', side: 'bottom' },
      { title: 'The bench', body: 'Upload media, arrange it on the timeline, and use the AI chat to describe edits. A demo project is open so you can look around.', target: 'iframe[title="SmartVid Workbench"]', side: 'over' },
    ],
  },
  {
    id: 'viral', route: 'viral', version: 1,
    steps: [
      { title: 'Smart Video Viral', body: 'A live feed of trending AI image and video prompts. Copy one, or send it into a studio.', target: header('viral'), side: 'bottom' },
      { title: 'Search', body: 'Search prompts, tags or authors. Press / to jump here.', target: '#viral-search', side: 'bottom' },
      { title: 'Filter', body: 'Show images or videos, and narrow by category, model and sort order.', target: ['#viral-media-filter', '#viral-category'], side: 'bottom' },
      { title: 'Browse', body: 'Each card is a prompt with its result.', target: '#viral-grid .smart-card', side: 'right', wait: 5000 },
      { title: 'Use a prompt', body: 'Copy the prompt, or use it in a studio to make your own version.', target: ['.copy-prompt-btn', '.create-style-btn'], side: 'top' },
    ],
  },
  {
    id: 'personalizer', route: 'personalizer', version: 1,
    steps: [
      { title: 'Personalizer', body: 'Design a page on a free canvas with tokens like {{company}}, then preview and export it personalised for each contact.', target: header('personalizer'), side: 'bottom' },
      { title: 'Elements', body: 'Drag headings, text, images, buttons, forms and video onto the canvas.', target: '.dom-palette-item', side: 'right' },
      { title: 'The canvas', body: 'Arrange your page here. Click an element to edit it.', target: '.dom-canvas', side: 'left' },
      { title: 'Tokens', body: 'Insert tokens such as the contact name or company; each contact gets their own version.', target: '.dom-token-chip', side: 'right' },
      { title: 'Properties', body: 'Select an element to change its text, size and style.', target: '.dom-properties-panel', side: 'left' },
    ],
  },
  {
    id: 'video-pages', route: 'video-pages', version: 1,
    steps: [
      { title: 'Video Pages', body: 'Turn any video into a branded landing page with a call to action, a lead form and analytics.', target: header('video-pages'), side: 'bottom' },
      { title: 'Create a page', body: 'Press New page, choose your video, pick a template and create it.', target: ['[data-tour="new-page"]', byText('button', /new page/i)], side: 'bottom' },
      { title: 'Your pages', body: 'Edit a page, copy its link or see who watched. Open one to change the design, contacts and analytics.', target: '#content-area', side: 'over' },
    ],
  },
  {
    id: 'website-builder', route: 'website-builder', version: 1,
    steps: [
      { title: 'Website Builder', body: 'Build a full website from a prompt and publish it. Bring your own AI key.', target: header('website-builder'), side: 'bottom' },
      { title: 'Your builder', body: 'Describe the site in the prompt box, pick a template or provider, then deploy or download the code. Sign in first if you see a sign-in card.', target: ['iframe[title="Smart Website Builder"]', '[data-builder-gate]'], side: 'over' },
    ],
  },
  {
    id: 'outreach', route: 'outreach', version: 1,
    steps: [
      { title: 'Video Outreach', body: 'Record once, greet every contact by name, add a landing page, and track who watched.', target: ['[data-outreach-library]', '[data-outreach-editor]'], side: 'over' },
      { title: 'Create a video', body: 'Start a dynamic video: record or upload one video, then personalise it for each contact.', target: '[data-outreach-new]', side: 'bottom' },
      { title: 'Your videos', body: 'Every campaign is listed here with its link and results.', target: '[data-outreach-library]', side: 'top', learnMore: academy('#/academy', 'Outreach lessons in the Academy') },
      { title: 'Four steps', body: 'The wizard moves from recording to AI intro, page, prospects, then generate and share.', target: null },
    ],
  },
];
