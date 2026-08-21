import { handleViewPrompt, handleCreateThisStyle } from '../lib/exampleGalleryBridge.js';
import { getAssetsForStudio } from '../data/exampleGalleryAssets.js';

const PLACEHOLDER_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="232" height="131" viewBox="0 0 232 131"><rect width="232" height="131" fill="#0a0a0a"/><text x="116" y="68" text-anchor="middle" fill="#27272a" font-size="12" font-family="sans-serif">No Preview</text></svg>')}`;

const ARROW_STYLE_ID = 'example-gallery-arrow-styles';

function ensureArrowStyles() {
  if (!document.getElementById(ARROW_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = ARROW_STYLE_ID;
    style.textContent = `
      @media (max-width: 768px) {
        .example-gallery-arrow { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }
}

function createArrowButton(direction) {
  const btn = document.createElement('button');
  btn.className = 'example-gallery-arrow';
  btn.textContent = direction === 'left' ? '‹' : '›';
  btn.style.position = 'absolute';
  btn.style.top = '50%';
  btn.style.transform = 'translateY(-50%)';
  btn.style.background = 'rgba(5,5,5,0.8)';
  btn.style.border = '1px solid #27272a';
  btn.style.color = '#d9ff00';
  btn.style.borderRadius = '8px';
  btn.style.padding = '8px';
  btn.style.backdropFilter = 'blur(8px)';
  btn.style.zIndex = '2';
  btn.style.cursor = 'pointer';
  if (direction === 'left') {
    btn.style.left = '8px';
  } else {
    btn.style.right = '8px';
  }
  return btn;
}

export default function ExampleGallery({ studioId, assets, maxCards = 20 }) {
  const filtered = assets
    .filter((asset) => asset.studio === studioId || asset.studioId === studioId)
    .slice(0, maxCards);

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'No examples yet for this studio.';
    empty.style.color = '#52525b';
    empty.style.fontSize = '13px';
    empty.style.padding = '20px 0';
    return empty;
  }

  ensureArrowStyles();

  const gallery = document.createElement('div');
  gallery.style.position = 'relative';
  gallery.style.display = 'flex';
  gallery.style.gap = '16px';
  gallery.style.overflowX = 'auto';
  gallery.style.scrollSnapType = 'x mandatory';
  gallery.style.padding = '20px 0';
  gallery.style.scrollbarWidth = 'none';

  const leftArrow = createArrowButton('left');
  const rightArrow = createArrowButton('right');

  leftArrow.addEventListener('click', () => {
    gallery.scrollBy({ left: -248, behavior: 'smooth' });
  });

  rightArrow.addEventListener('click', () => {
    gallery.scrollBy({ left: 248, behavior: 'smooth' });
  });

  gallery.appendChild(leftArrow);
  gallery.appendChild(rightArrow);

  filtered.forEach((asset) => {
    const thumbnailSrc = asset.thumbnail || asset.posterSrc || PLACEHOLDER_SVG;
    const badgeText = (asset.category || asset.tags?.[0] || '').toUpperCase();

    const card = document.createElement('div');
    card.style.flex = '0 0 232px';
    card.style.scrollSnapAlign = 'start';
    card.style.background = '#141414';
    card.style.border = '1px solid #27272a';
    card.style.borderRadius = '14px';
    card.style.overflow = 'hidden';
    card.style.cursor = 'pointer';
    card.style.transition = 'border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease';

    card.addEventListener('mouseenter', () => {
      card.style.borderColor = '#d9ff00';
      card.style.background = 'rgba(20,20,20,0.9)';
      card.style.boxShadow = '0 0 20px rgba(217,255,0,0.25)';
      card.style.transform = 'translateY(-3px)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = '#27272a';
      card.style.background = '#141414';
      card.style.boxShadow = 'none';
      card.style.transform = 'translateY(0)';
    });

    const media = document.createElement('div');
    media.style.position = 'relative';
    media.style.height = '131px';
    media.style.background = '#0a0a0a';
    media.style.overflow = 'hidden';

    if (badgeText) {
      const badge = document.createElement('span');
      badge.textContent = badgeText;
      badge.style.position = 'absolute';
      badge.style.top = '8px';
      badge.style.left = '8px';
      badge.style.padding = '2px 8px';
      badge.style.background = 'rgba(5,5,5,0.8)';
      badge.style.backdropFilter = 'blur(8px)';
      badge.style.border = '1px solid #d9ff00';
      badge.style.borderRadius = '6px';
      badge.style.fontSize = '10px';
      badge.style.fontWeight = '700';
      badge.style.color = '#d9ff00';
      badge.style.textTransform = 'uppercase';
      badge.style.letterSpacing = '0.08em';
      badge.style.zIndex = '1';
      media.appendChild(badge);
    }

    const img = document.createElement('img');
    img.src = thumbnailSrc;
    img.alt = asset.title || 'Example';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.loading = 'lazy';
    media.appendChild(img);

    const body = document.createElement('div');
    body.style.padding = '12px';

    const title = document.createElement('div');
    title.textContent = asset.title || 'Untitled';
    title.style.fontSize = '13px';
    title.style.fontWeight = '700';
    title.style.color = '#fff';
    title.style.marginBottom = '10px';
    title.style.lineHeight = '1.35';
    title.style.display = '-webkit-box';
    title.style.WebkitLineClamp = '2';
    title.style.WebkitBoxOrient = 'vertical';
    title.style.overflow = 'hidden';
    body.appendChild(title);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'View Prompt';
    viewBtn.style.flex = '1';
    viewBtn.style.padding = '6px 10px';
    viewBtn.style.borderRadius = '8px';
    viewBtn.style.fontSize = '11px';
    viewBtn.style.fontWeight = '700';
    viewBtn.style.background = '#141414';
    viewBtn.style.color = '#a1a1aa';
    viewBtn.style.border = '1px solid #27272a';
    viewBtn.style.cursor = 'pointer';
    viewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleViewPrompt(asset);
    });

    const createBtn = document.createElement('button');
    createBtn.textContent = 'Create This Style';
    createBtn.style.flex = '1';
    createBtn.style.padding = '6px 10px';
    createBtn.style.borderRadius = '8px';
    createBtn.style.fontSize = '11px';
    createBtn.style.fontWeight = '700';
    createBtn.style.background = '#d9ff00';
    createBtn.style.color = '#000';
    createBtn.style.border = 'none';
    createBtn.style.cursor = 'pointer';
    createBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleCreateThisStyle(asset);
    });

    actions.appendChild(viewBtn);
    actions.appendChild(createBtn);
    body.appendChild(actions);

    card.appendChild(media);
    card.appendChild(body);
    gallery.appendChild(card);
  });

  return gallery;
}
