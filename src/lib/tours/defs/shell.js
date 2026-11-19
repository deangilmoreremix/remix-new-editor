// The app-shell tour: the side menu groups, the top bar and the help buttons. Shown once, before the first studio tour.
// Targets: [data-sidebar-group] / [data-sidebar-item] (Sidebar.js), the top bar (Header.js) and Ask SmartVideo.
export default [
  {
    id: 'app',
    route: '*',
    version: 1,
    steps: [
      { title: 'Welcome to SmartVideo', body: 'A quick tour of the app. It takes about a minute, and you can replay it any time from the <b>?</b> button at the top.', target: null },
      { title: 'Image tools', body: 'Image Studio, Edit, Upscale, Character, Product Shot and Brand: everything for pictures and brand content.', target: '[data-sidebar-group="Image"]', side: 'right', sidebar: true },
      { title: 'Video tools', body: 'Video, Cinema, Storyboard, Effects, Lip Sync, Avatar, Audio and more: generate and finish video here.', target: '[data-sidebar-group="Video"]', side: 'right', sidebar: true },
      { title: 'Agents', body: 'AI agents that work for you: Video Agent, Director, Timeline editor, Workbench, Personalizer, Video Pages and the Website Builder.', target: '[data-sidebar-group="Agents"]', side: 'right', sidebar: true },
      { title: 'My Work', body: 'Everything you generate is saved to your Library automatically. Content keeps what you saved and uploaded.', target: '[data-sidebar-group="My Work"]', side: 'right', sidebar: true },
      { title: 'Apps, Explore and Templates', body: 'The top of the menu: Apps shows every tool at a glance, Explore is for inspiration, Templates are ready-made starts, and the Academy teaches the craft.', target: '[data-sidebar-item="apps"]', side: 'right', sidebar: true },
      { title: 'All apps', body: 'Click the logo any time to return to the Apps page.', target: '[aria-label="All apps"]', side: 'bottom', align: 'start' },
      { title: 'Your credit balance', body: 'Your MuAPI credit balance, refreshed after every generation.', target: 'span[title="MuAPI credit balance"]', side: 'bottom', align: 'end' },
      { title: 'Your account', body: 'Sign in, manage your account and plan here.', target: '[data-tour="account"]', side: 'bottom', align: 'end' },
      { title: 'Settings and API keys', body: 'Add your provider keys and manage settings here. You can also redo the welcome questions or reset these tours.', target: '[data-sidebar-item="settings"]', side: 'right', sidebar: true },
      { title: 'Ask SmartVideo', body: 'Stuck? Ask the assistant how to do something. It knows every studio.', target: '[data-ask="launcher"]', side: 'left', align: 'end' },
      { title: 'Replay this any time', body: 'Press <b>?</b> to replay the tour for the page you are on. Each studio also shows a short tour the first time you open it.', target: '[data-tour="replay"]', side: 'bottom', align: 'end' },
    ],
  },
];
