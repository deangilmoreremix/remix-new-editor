// Tours for the Home pages: Apps, Explore, Templates, Academy.
import { byText, academy } from './util.js';

export default [
  {
    id: 'apps', route: 'apps', version: 1,
    steps: [
      { title: 'Every tool in one place', body: 'The Apps page lists all of SmartVideo, grouped like the side menu. Click any card to open that studio.', target: ['[data-tour="apps-hero"]', '#content-area h1'], side: 'bottom' },
      { title: 'Find a tool fast', body: 'Type to filter the cards. Try "video", "lip sync" or "product".', target: 'input[placeholder="Search apps..."]', side: 'bottom' },
      { title: 'Grouped like your menu', body: 'Image, Video, Agents and My Work sections match the side menu, so you always know where things are.', target: '[data-app-section]', side: 'top' },
      { title: 'Open a studio', body: 'Click a card to start. Each studio shows a short tour the first time you open it.', target: '[data-searchable]', side: 'right' },
    ],
  },
  {
    id: 'explore', route: 'explore', version: 1,
    steps: [
      { title: 'Explore', body: 'Inspiration: see what is possible, then start from something that already works.', target: '#content-area h1', side: 'bottom' },
      { title: 'Trending templates', body: 'Click a template to open it, add your own media and generate.', target: byText('h2', /trending templates/i), side: 'bottom' },
      { title: 'Prompt library', body: 'Ready-made prompts. "Try this prompt" sends it straight into Image Studio.', target: byText('h2', /prompt library/i), side: 'bottom' },
      { title: 'Browse by category', body: 'Jump to the tools for a style or goal: portraits, product, social and more.', target: byText('h2', /browse by category/i), side: 'top' },
    ],
  },
  {
    id: 'templates', route: 'templates', version: 1,
    steps: [
      { title: 'Templates', body: 'Ready-made starts for ads, social posts, thumbnails and more. Pick one, add your media, generate.', target: ['[data-studio-header="templates"]', '#content-area h1'], side: 'bottom' },
      { title: 'Search', body: 'Search by name or topic to narrow the list.', target: 'input[aria-label="Search templates"]', side: 'bottom' },
      { title: 'Filters', body: 'Switch between categories, or show only your favorites.', target: 'button[data-filter]', side: 'bottom' },
      { title: 'Open a template', body: 'Click a card to open it in the Template Studio.', target: '[data-searchable]', side: 'right' },
      { title: 'Save favorites', body: 'Tap the star on a card to keep it handy.', target: 'button[data-favorite]', side: 'left', wait: 800 },
    ],
  },
  {
    id: 'academy', route: 'academy', version: 1,
    steps: [
      { title: 'Smart Video Academy', body: 'Short lessons and templates that teach the craft: scripting, prompting, editing and selling your work.', target: '#content-area', side: 'over' },
      { title: 'Tracks and lessons', body: 'Pick a track to see its lessons. Mark lessons complete to keep your progress.', target: null },
      { title: 'Learn, See, Create', body: 'Each lesson has three tabs: read the idea, see examples, then build it yourself with SmartVideo.', target: null },
      { title: 'Come back any time', body: 'The Academy is in the side menu. Many studios also link to the lessons that fit them.', target: '[data-sidebar-item="academy"]', side: 'right', sidebar: true, learnMore: academy() },
    ],
  },
];
