import { handleViewPrompt, handleCreateThisStyle } from '../../lib/exampleGalleryBridge.js';

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
  btn.style.cssText = `
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(5,5,5,0.8);
    border: 1px solid #27272a;
    color: #d9ff00;
    border-radius: 8px;
    padding: 8px;
    backdrop-filter: blur(8px);
    z-index: 2;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
  `;
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
    empty.style.cssText = 'color: #52525b; font-size: 13px; padding: 20px 0;';
    return empty;
  }

  ensureArrowStyles();

  const gallery = document.createElement('div');
  gallery.style.cssText = 'position: relative;';

  const scrollContainer = document.createElement('div');
  scrollContainer.style.cssText = `
    display: flex;
    gap: 16px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding: 20px 0;
    scrollbar-width: none;
    -ms-overflow-style: none;
  `;

  const leftArrow = createArrowButton('left');
  const rightArrow = createArrowButton('right');

  leftArrow.addEventListener('click', () => {
    scrollContainer.scrollBy({ left: -248, behavior: 'smooth' });
  });

  rightArrow.addEventListener('click', () => {
    scrollContainer.scrollBy({ left: 248, behavior: 'smooth' });
  });

  filtered.forEach((asset) => {
    const thumbnailSrc = asset.thumbnail || asset.posterSrc || PLACEHOLDER_SVG;
    const badgeText = (asset.category || asset.tags?.[0] || '').toUpperCase();

    const card = document.createElement('div');
    card.style.cssText = `
      flex: 0 0 232px;
      scroll-snap-align: start;
      background: #141414;
      border: 1px solid #27272a;
      border-radius: 14px;
      overflow: hidden;
      cursor: pointer;
      transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    `;

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
    media.style.cssText = 'position: relative; height: 131px; background: #0a0a0a; overflow: hidden;';

    if (badgeText) {
      const badge = document.createElement('span');
      badge.textContent = badgeText;
      badge.style.cssText = `
        position: absolute;
        top: 8px;
        left: 8px;
        padding: 2px 8px;
        background: rgba(5,5,5,0.8);
        backdrop-filter: blur(8px);
        border: 1px solid #d9ff00;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 700;
        color: #d9ff00;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        z-index: 1;
      `;
      media.appendChild(badge);
    }

    const img = document.createElement('img');
    img.src = thumbnailSrc;
    img.alt = asset.title || 'Example';
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
    img.loading = 'lazy';
    media.appendChild(img);

    const body = document.createElement('div');
    body.style.cssText = 'padding: 12px;';

    const title = document.createElement('div');
    title.textContent = asset.title || 'Untitled';
    title.style.cssText = `
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 10px;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    `;
    body.appendChild(title);

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 8px;';

    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'View Prompt';
    viewBtn.style.cssText = `
      flex: 1;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      background: #141414;
      color: #a1a1aa;
      border: 1px solid #27272a;
      cursor: pointer;
    `;
    viewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleViewPrompt(asset);
    });

    const createBtn = document.createElement('button');
    createBtn.textContent = 'Create This Style';
    createBtn.style.cssText = `
      flex: 1;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      background: #d9ff00;
      color: #000;
      border: none;
      cursor: pointer;
    `;
    createBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleCreateThisStyle(asset);
    });

    actions.appendChild(viewBtn);
    actions.appendChild(createBtn);
    body.appendChild(actions);

    card.appendChild(media);
    card.appendChild(body);
    scrollContainer.appendChild(card);
  });

  gallery.appendChild(leftArrow);
  gallery.appendChild(rightArrow);
  gallery.appendChild(scrollContainer);

  return gallery;
}
