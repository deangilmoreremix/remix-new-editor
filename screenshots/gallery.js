const files = [
  'apps','image','video','cinema','cinema-template','storyboard','effects',
  'edit','audio','viral',
  'render','video-agent','director','timeline','templates',
  'explore','library','content-library','community','assist','settings',
  'image-advanced','image-tools','image-gtm-modal',
  'video-advanced','video-motion-style','video-thumbnail-modal',
  'cinema-builder',
  'effects-advanced',
  'edit-remove-object','edit-remove-background','edit-ai-edit',
  'timeline-media-preview',
  'template-tiktok-video','template-instagram-reel','template-youtube-thumbnail',
  'template-anime-converter','template-banner-creator','template-comic-book',
  'template-cyberpunk-style','template-film-noir','template-ghibli-style',
  'template-movie-poster','template-pixel-art','template-profile-picture',
  'template-short-form-ad','template-story-highlight-cover','template-vhs-retro',
  'cinema-template-cinematic-short-film','cinema-template-mini-movie','cinema-template-trailer-video',
  'cinema-template-brand-film','cinema-template-product-hero-shot',
  'cinema-template-social-reel-cinematic','cinema-template-story-highlight-cinematic'
];
const grid = document.getElementById('grid');
files.forEach(name => {
  const card = document.createElement('div');
  card.className = 'card';
  const img = document.createElement('img');
  img.src = `./${name}.png`;
  img.alt = name;
  img.loading = 'lazy';
  img.onerror = () => {
    card.innerHTML = '<div style="padding:40px 12px;color:#666;font-size:12px;">missing: ' + name + '.png</div>';
  };
  const meta = document.createElement('div');
  meta.className = 'meta';
  const nameSpan = document.createElement('span');
  nameSpan.className = 'name';
  nameSpan.textContent = name;
  const sizeSpan = document.createElement('span');
  sizeSpan.className = 'size';
  sizeSpan.textContent = '...';
  sizeSpan.dataset.src = `./${name}.png`;
  meta.appendChild(nameSpan);
  meta.appendChild(sizeSpan);
  card.appendChild(img);
  card.appendChild(meta);
  grid.appendChild(card);
});
(async () => {
  const entries = await Promise.all(
    Array.from(document.querySelectorAll('.size')).map(async el => {
      const src = el.getAttribute('data-src');
      try {
        const res = await fetch(src, { method: 'HEAD' });
        const kb = res.ok ? (res.headers.get('content-length') / 1024).toFixed(0) : '-';
        el.textContent = kb ? kb + ' KB' : '-';
      } catch {
        el.textContent = '-';
      }
    })
  );
})();
