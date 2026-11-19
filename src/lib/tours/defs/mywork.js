// Tours for My Work: Library and Content.
import { header } from './util.js';

export default [
  {
    id: 'library', route: 'library', version: 1,
    steps: [
      { title: 'Library', body: 'Everything you generate and upload, saved automatically in one place.', target: header('library'), side: 'bottom' },
      { title: 'Filter by type', body: 'Show everything, or only images, videos, audio or uploads.', target: 'button[data-library-filter]', side: 'bottom' },
      { title: 'Search', body: 'Search by prompt or model name.', target: 'input[placeholder="Search by prompt or model..."]', side: 'bottom' },
      { title: 'Your creations', body: 'Hover a card for download, copy prompt and more. Use "Use in studio" to continue a piece somewhere else.', target: ['[data-tour="library-grid"]', 'button[data-library-action]'], side: 'top' },
    ],
  },
  {
    id: 'content-library', route: 'content-library', version: 1,
    steps: [
      { title: 'Content', body: 'Your saved content: generations, uploads, PDFs and stock media, ready to reuse.', target: ['[data-studio="content-library"] h1', '#content-area h1', '.studio-topbar'], side: 'bottom' },
      { title: 'Add media', body: 'Upload a file, or pull stock media.', target: ['button[title="Reference media"]'], side: 'bottom' },
      { title: 'Filter', body: 'Switch between saved items, images, videos, audio and PDFs.', target: ['[data-tour="content-filters"]'], side: 'bottom' },
      { title: 'Search', body: 'Find anything you saved.', target: 'input[placeholder="Search saved content..."]', side: 'bottom' },
    ],
  },
];
