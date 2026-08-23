import { handleViewPrompt, handleCreateThisStyle } from '../../lib/exampleGalleryBridge.js';
import { createFullscreenPreview } from '../MediaPreview.js';

const PLACEHOLDER_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225"><rect width="400" height="225" fill="#0a0a0a"/><text x="200" y="118" text-anchor="middle" fill="#27272a" font-size="14" font-family="sans-serif">No Preview</text></svg>')}`;

const fullscreenPreview = createFullscreenPreview();
document.body.appendChild(fullscreenPreview.element);

export default function ExampleGallery({ studioId, assets, maxCards = 20 }) {
  const filtered = assets
    .filter((asset) => asset.studio === studioId || asset.studioId === studioId)
    .slice(0, maxCards);

  const section = document.createElement('section');
  section.className = 'eg-section';

  // Header
  const header = document.createElement('div');
  header.className = 'eg-header';
  header.innerHTML = `
    <div>
      <div class="eg-title">Example Gallery</div>
      <div class="eg-subtitle">Click any card to view the prompt or create in this style</div>
    </div>
    <div class="eg-count">${filtered.length} example${filtered.length === 1 ? '' : 's'}</div>
  `;
  section.appendChild(header);

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'eg-empty';
    empty.innerHTML = `
      <div class="eg-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
      </div>
      <span>No examples yet for this studio.</span>
    `;
    section.appendChild(empty);
    return section;
  }

  // Extract unique tags for filters
  const tagSet = new Set();
  filtered.forEach((asset) => {
    (asset.tags || []).forEach((tag) => tagSet.add(tag));
    if (asset.category) tagSet.add(asset.category.toLowerCase());
  });
  const uniqueTags = Array.from(tagSet).slice(0, 10);

  // Filter bar
  const filters = document.createElement('div');
  filters.className = 'eg-filters';
  
  const allChip = document.createElement('button');
  allChip.className = 'eg-filter-chip active';
  allChip.textContent = 'All';
  allChip.addEventListener('click', () => {
    filters.querySelectorAll('.eg-filter-chip').forEach((c) => c.classList.remove('active'));
    allChip.classList.add('active');
    cards.forEach((card) => {
      const tag = card.dataset.tag;
      card.style.display = 'flex';
    });
  });
  filters.appendChild(allChip);

  uniqueTags.forEach((tag) => {
    const chip = document.createElement('button');
    chip.className = 'eg-filter-chip';
    chip.textContent = tag;
    chip.addEventListener('click', () => {
      filters.querySelectorAll('.eg-filter-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      cards.forEach((card) => {
        const cardTag = card.dataset.tag;
        if (cardTag === tag || card.dataset.tags?.includes(tag)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
    filters.appendChild(chip);
  });
  section.appendChild(filters);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'eg-grid';

  const cards = [];

  filtered.forEach((asset) => {
    const thumbnailSrc = asset.thumbnail || asset.posterSrc || PLACEHOLDER_SVG;
    const badgeText = (asset.category || '').toUpperCase();
    const tags = asset.tags || [];
    const cardTag = badgeText || tags[0] || '';

    const card = document.createElement('div');
    card.className = 'eg-card';
    card.dataset.tag = cardTag;
    card.dataset.tags = JSON.stringify(tags);

    card.addEventListener('mouseenter', () => {
      card.style.borderColor = '#d9ff00';
      card.style.boxShadow = '0 0 24px rgba(217,255,0,0.2)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = '#27272a';
      card.style.boxShadow = 'none';
    });

    const media = document.createElement('div');
    media.className = 'eg-media';

    if (badgeText) {
      const badge = document.createElement('span');
      badge.className = 'eg-badge';
      badge.textContent = badgeText;
      media.appendChild(badge);
    }

    const img = document.createElement('img');
    img.alt = asset.title || 'Example';
    img.loading = 'lazy';

    const applyAspectRatio = () => {
      if (img.naturalWidth && img.naturalHeight) {
        media.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
      }
    };
    img.onload = applyAspectRatio;
    if (img.complete && img.naturalWidth) applyAspectRatio();

    img.src = thumbnailSrc;
    media.appendChild(img);

    card.addEventListener('click', () => {
      const url = asset.videoSrc || thumbnailSrc;
      const type = asset.videoSrc ? 'video' : 'image';
      fullscreenPreview.show(url, {
        type,
        prompt: asset.prompt || '',
        model: asset.source || '',
      });
    });
    card.appendChild(media);

    const body = document.createElement('div');
    body.className = 'eg-body';

    const title = document.createElement('div');
    title.className = 'eg-title-text';
    title.textContent = asset.title || 'Untitled';
    body.appendChild(title);

    // Meta row
    const meta = document.createElement('div');
    meta.className = 'eg-meta';

    const author = document.createElement('div');
    author.className = 'eg-author';
    author.textContent = asset.sourceAuthor || asset.source || '';
    meta.appendChild(author);

    body.appendChild(meta);

    // Tags
    if (tags.length > 0) {
      const tagRow = document.createElement('div');
      tagRow.className = 'eg-tags';
      tags.slice(0, 3).forEach((tag) => {
        const tagEl = document.createElement('span');
        tagEl.className = 'eg-tag';
        tagEl.textContent = tag;
        tagRow.appendChild(tagEl);
      });
      body.appendChild(tagRow);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'eg-actions';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'eg-btn eg-btn-view';
    viewBtn.textContent = 'View Prompt';
    viewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleViewPrompt(asset);
    });

    const createBtn = document.createElement('button');
    createBtn.className = 'eg-btn eg-btn-create';
    createBtn.textContent = 'Create This Style';
    createBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleCreateThisStyle(asset);
    });

    actions.appendChild(viewBtn);
    actions.appendChild(createBtn);
    body.appendChild(actions);
    card.appendChild(body);
    grid.appendChild(card);
    cards.push(card);
  });

  section.appendChild(grid);
  return section;
}
