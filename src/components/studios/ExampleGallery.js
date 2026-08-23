import { handleViewPrompt, handleCreateThisStyle } from '../../lib/exampleGalleryBridge.js';
import { MediaDetailView } from '../MediaDetailView.js';
import { getRelatedAssets } from '../../data/exampleGalleryAssets.js';

function sortAssets(assets, sortBy) {
  const sorted = [...assets];
  switch (sortBy) {
    case 'title-asc':
      sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;
    case 'title-desc':
      sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
      break;
    case 'duration-asc':
      sorted.sort((a, b) => (a.duration || 0) - (b.duration || 0));
      break;
    case 'duration-desc':
      sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      break;
    case 'source':
      sorted.sort((a, b) => (a.source || '').localeCompare(b.source || ''));
      break;
    default:
      break;
  }
  return sorted;
}

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

  // Sort control
  const sortBar = document.createElement('div');
  sortBar.className = 'eg-sort-bar';
  const sortLabel = document.createElement('span');
  sortLabel.className = 'eg-sort-label';
  sortLabel.textContent = 'Sort by:';
  const sortSelect = document.createElement('select');
  sortSelect.className = 'eg-sort-select';
  const sortOptions = [
    { value: 'default', label: 'Default' },
    { value: 'title-asc', label: 'Title A-Z' },
    { value: 'title-desc', label: 'Title Z-A' },
    { value: 'duration-asc', label: 'Duration (shortest)' },
    { value: 'duration-desc', label: 'Duration (longest)' },
    { value: 'source', label: 'Source' },
  ];
  sortOptions.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    sortSelect.appendChild(option);
  });
  sortBar.appendChild(sortLabel);
  sortBar.appendChild(sortSelect);
  section.appendChild(sortBar);

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
    if (asset.category) tagSet.add(asset.category.toLowerCase().replace(/\s+/g, '-'));
  });
  const uniqueTags = Array.from(tagSet).slice(0, 25);

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
         const cardTags = JSON.parse(card.dataset.tags || '[]');
         const matchesTag = cardTags.some((t) => t.toLowerCase() === tag.toLowerCase());
         if (cardTag === tag || matchesTag) {
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
  let currentSort = 'default';

  function renderCards(assetsToRender) {
    grid.innerHTML = '';
    cards.length = 0;
    assetsToRender.forEach((asset) => {
      const thumbnailSrc = asset.thumbnail || asset.posterSrc || PLACEHOLDER_SVG;
      const badgeText = (asset.category || '').toUpperCase();
      const tags = asset.tags || [];
      const cardTag = ((asset.category || tags[0] || '')).toLowerCase().replace(/\s+/g, '-');

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
      if (img.complete && img.naturalWidth) applyAspectRatio;

      img.src = thumbnailSrc;
      media.appendChild(img);

      function openAssetDetail(asset) {
        const url = asset.videoSrc || asset.thumbnail || '';
        const type = asset.videoSrc ? 'video' : 'image';
        const related = getRelatedAssets(asset, 8);
        const detailView = new MediaDetailView({
          mediaUrl: url,
          mediaType: type,
          title: asset.title || '',
          prompt: asset.prompt || '',
          model: asset.source || '',
          source: asset.source || '',
          author: asset.sourceAuthor || '',
          category: asset.category || '',
          date: asset.date || '',
          tags: asset.tags || [],
          relatedItems: related,
          onRelatedClick: (index) => {
            const relatedItem = related[index];
            if (relatedItem) openAssetDetail(relatedItem);
          },
          actions: [
            {
              id: 'view-prompt',
              label: 'View Prompt',
              onClick: () => handleViewPrompt(asset),
            },
            {
              id: 'create-style',
              label: 'Create This Style',
              onClick: () => handleCreateThisStyle(asset),
            },
          ],
        });
        detailView.show();
      }

      card.addEventListener('click', () => {
        openAssetDetail(asset);
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
  }

  sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    const sorted = sortAssets(filtered, currentSort);
    renderCards(sorted);
  });

  // Initial render
  const initialSorted = sortAssets(filtered, currentSort);
  renderCards(initialSorted);

  section.appendChild(grid);
  return section;
}
