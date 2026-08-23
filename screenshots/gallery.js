const files = [
  'apps','image','video','cinema','cinema-template','storyboard','effects',
  'edit','upscale','audio','avatar','training','academy','viral','videotools',
  'render','video-agent','director','timeline','chat','commercial','templates',
  'explore','library','content-library','community','assist','commits','ai-vfx','pexels-media','settings',
  'template-tiktok-video','template-instagram-reel','template-youtube-thumbnail','template-short-form-ad',
  'template-story-highlight-cover','template-profile-picture','template-banner-creator',
  'template-anime-converter','template-comic-book','template-pixel-art','template-ghibli-style',
  'template-cyberpunk-style','template-vhs-retro','template-film-noir','template-movie-poster',
  'cinema-template-tiktok-video','cinema-template-instagram-reel','cinema-template-youtube-thumbnail',
  'cinema-template-short-form-ad','cinema-template-story-highlight-cover','cinema-template-profile-picture',
  'cinema-template-banner-creator','cinema-template-anime-converter','cinema-template-comic-book',
  'cinema-template-pixel-art','cinema-template-ghibli-style','cinema-template-cyberpunk-style',
  'cinema-template-vhs-retro','cinema-template-film-noir','cinema-template-movie-poster'
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
