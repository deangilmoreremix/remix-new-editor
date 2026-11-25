// Drop-in lazy autoplay for <video data-lazy-src="clip.mp4" poster="clip.poster.jpg" muted loop playsinline>.
// Loads the file only when it scrolls near the viewport, pauses it when it leaves, and under
// prefers-reduced-motion shows just the poster image (no <video> is started).
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('video[data-lazy-src]').forEach(function (v) {
    v.muted = true; v.setAttribute('playsinline', '');
    if (reduce) { var img = new Image(); img.src = v.getAttribute('poster'); img.alt = v.getAttribute('aria-label') || ''; img.className = v.className; v.replaceWith(img); return; }
    var loaded = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { if (!loaded) { v.src = v.dataset.lazySrc; loaded = true; } var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else if (loaded) v.pause();
      });
    }, { rootMargin: '200px 0px' });
    io.observe(v);
  });
})();
