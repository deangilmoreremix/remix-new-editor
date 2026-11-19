// Tours for the studios that are not in the side menu but are on the Apps page and in the onboarding:
// AI Influencer, Motion Director, Lead Finder, Recorder, Find My Brand and Video Render.
// (Video Outreach has its tour in agents.js.) Highlight only: nothing here clicks Generate, Record or Analyze.
import { header, byText } from './util.js';

export default [
  {
    id: 'influencer', route: 'influencer', version: 1,
    steps: [
      { title: 'AI Influencer Studio', body: 'Design a consistent AI influencer: upload a reference photo, choose their look, and generate new content with them.', target: header('influencer'), side: 'bottom' },
      { title: 'Choose a model', body: 'Pick the model that turns your photo into new images.', target: ['[data-tour="model"]'], side: 'bottom' },
      { title: 'Your photo', body: 'Upload a clear photo of the person to build the influencer from.', target: ['[data-tour="upload"]', '[data-upload-picker]'], side: 'top' },
      { title: 'Their look', body: 'Switch between face, body and style to shape the influencer.', target: ['button[data-tab-key="face"]', 'button[data-tab-key]'], side: 'bottom' },
      { title: 'Describe the content', body: 'Say what the influencer is doing and where.', target: ['textarea[aria-label="Influencer prompt"]', 'textarea[data-studio-prompt]'], side: 'top' },
      { title: 'Generate', body: 'Press Generate to create the content. You need a photo first.', target: 'button[aria-label="Generate content"]', side: 'top' },
    ],
  },
  {
    id: 'motion-director', route: 'motion-director', version: 1, firstWait: 25000,
    steps: [
      { title: 'Motion Director', body: 'Chat with an AI film director. Describe a video, and it plans a storyboard and builds an editable film.', target: ['[data-studio="motion-director"] h1'], side: 'bottom', wait: 8000 },
      { title: 'Say what you want', body: 'Describe the video you want, or paste your website address.', target: ['[aria-label="Describe your motion video"]'], side: 'top', wait: 8000 },
      { title: 'Add media', body: 'Attach images or footage to build the film around.', target: ['[data-testid="motion-prompt-media-button"]'], side: 'top', wait: 4000 },
      { title: 'Start from a template', body: 'Not sure where to begin? Pick a template.', target: ['button[aria-label^="Templates"]'], side: 'top', wait: 4000 },
      { title: 'Shape and send', body: 'Choose the aspect ratio, then press Generate. The result opens in the Motion Workbench, where you can edit it.', target: ['button[title="Aspect ratio"]', 'button[aria-label="Generate"]', 'button[aria-label="Send"]'], side: 'top', wait: 4000 },
    ],
  },
  {
    id: 'leadfinder', route: 'leadfinder', version: 1,
    steps: [
      { title: 'Lead Finder', body: 'Find local businesses that need video, then make each one a personal video.', target: ['[data-studio="leadfinder"] h1', '.studio-topbar'], side: 'bottom' },
      { title: 'Find businesses', body: 'Search a niche and a place, review the scored prospects and save the ones you want.', target: ['[data-tour="lf-find"]'], side: 'bottom' },
      { title: 'Find My Brand', body: 'Paste any business website to pull its logo, photos and branding, free.', target: ['[data-tour="lf-brand"]'], side: 'bottom' },
      { title: 'Saved leads', body: 'Your saved leads live here. Sign in to see them, and send them to Video Outreach.', target: ['[data-tour="lf-leads"]'], side: 'top', wait: 2000 },
    ],
  },
  {
    id: 'recorder', route: 'recorder', version: 1, firstWait: 15000,
    steps: [
      { title: 'Recorder', body: 'Record your screen and camera in the browser, then edit scenes and captions and export the video.', target: ['[data-recorder="studio"]', '.studio-topbar__title'], side: 'over', wait: 8000 },
      { title: 'Record, Edit, Export', body: 'Three tabs: record your sources, edit the scenes, then export.', target: ['[data-recorder-tab="record"]'], side: 'bottom', wait: 4000 },
      { title: 'Teleprompter', body: 'Read your script on screen while you record.', target: ['[data-recorder="teleprompter"]'], side: 'left', wait: 2000 },
      { title: 'Record', body: 'Pick your camera and screen, then press Record (or press R). Your browser will ask for permission first.', target: ['button[title="Press R to start recording"]', 'button[title^="Press R"]'], side: 'top', wait: 4000 },
      { title: 'Edit your video', body: 'After recording, open the project to edit scenes, takes and captions.', target: ['[data-recorder="open-project"]'], side: 'bottom', wait: 2000 },
    ],
  },
  {
    id: 'find-my-brand', route: 'find-my-brand', version: 1, firstWait: 12000,
    steps: [
      { title: 'Find My Brand', body: 'Free and no sign-in: paste a business website and see the logo, photos, products and branding found on it. Nothing is generated or saved.', target: ['[data-testid="find-my-brand"]', 'main h1'], side: 'bottom' },
      { title: 'Your website', body: 'Enter the business address, like yourbusiness.com.', target: ['#find-my-brand-url'], side: 'bottom', wait: 4000 },
      { title: 'Find it', body: 'Press the button to read the page. It only reads what is already published.', target: ['#find-my-brand-submit', '[data-testid="find-my-brand-submit"]'], side: 'top', wait: 4000 },
    ],
  },
  {
    id: 'render', route: 'render', version: 1,
    steps: [
      { title: 'Video Render', body: 'Review a video, apply a cinematic preset and output settings, then render and export it in your browser.', target: ['[data-studio="render"] h1', '[data-studio-header="render"]'], side: 'bottom' },
      { title: 'Choose a video', body: 'Pick a video from your library to render. If you opened Render from another studio, it is already loaded.', target: ['#assetEmptyState', '#previewVideo'], side: 'right', wait: 3000 },
      { title: 'Presets', body: 'One-click cinematic looks. Click one to select it.', target: ['#presetsContainer button:first-child', '#presetsContainer'], side: 'left' },
      { title: 'Output settings', body: 'Format, frame rate and quality.', target: ['#outputFormat', '#frameRate', '#quality'], side: 'left' },
      { title: 'Save a draft', body: 'Keep your settings to come back to later.', target: ['#saveDraftBtn'], side: 'bottom', wait: 800 },
      { title: 'Start render', body: 'When you are ready, press Start Render. Your queue shows progress.', target: ['.start-render-btn', byText('button', /start render/i)], side: 'top', wait: 800 },
    ],
  },
];
