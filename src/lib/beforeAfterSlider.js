export function createBeforeAfterSlider(beforeUrl, afterUrl, beforeLabel = 'Before', afterLabel = 'After') {
  const wrapper = document.createElement('div');
  wrapper.className = 'relative w-full aspect-video rounded-xl overflow-hidden cursor-col-resize select-none bg-black/50';

  const beforeImg = document.createElement('img');
  beforeImg.src = beforeUrl;
  beforeImg.className = 'absolute inset-0 w-full h-full object-contain';
  beforeImg.alt = beforeLabel;
  wrapper.appendChild(beforeImg);

  const clip = document.createElement('div');
  clip.className = 'absolute inset-0 overflow-hidden';
  clip.style.clipPath = 'inset(0 50% 0 0)';

  const afterImg = document.createElement('img');
  afterImg.src = afterUrl;
  afterImg.className = 'absolute inset-0 w-full h-full object-contain';
  afterImg.alt = afterLabel;
  clip.appendChild(afterImg);
  wrapper.appendChild(clip);

  const divider = document.createElement('div');
  divider.className = 'absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none';
  divider.style.left = '50%';
  wrapper.appendChild(divider);

  const handle = document.createElement('div');
  handle.className = 'absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-xl flex items-center justify-center pointer-events-none';
  handle.style.left = 'calc(50% - 16px)';
  handle.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3"><path d="M8 4l-6 8 6 8M16 4l6 8-6 8"/></svg>';
  wrapper.appendChild(handle);

  const beforeBadge = document.createElement('div');
  beforeBadge.className = 'absolute bottom-3 left-3 bg-black/60 backdrop-blur-md rounded-lg px-2.5 py-1 text-[10px] font-bold text-white';
  beforeBadge.textContent = beforeLabel;
  wrapper.appendChild(beforeBadge);

  const afterBadge = document.createElement('div');
  afterBadge.className = 'absolute bottom-3 right-3 bg-primary/80 backdrop-blur-md rounded-lg px-2.5 py-1 text-[10px] font-bold text-black';
  afterBadge.textContent = afterLabel;
  wrapper.appendChild(afterBadge);

  let dragging = false;

  const update = (clientX) => {
    const rect = wrapper.getBoundingClientRect();
    let pos = ((clientX - rect.left) / rect.width) * 100;
    pos = Math.max(2, Math.min(98, pos));
    clip.style.clipPath = `inset(0 ${100 - pos}% 0 0)`;
    divider.style.left = `${pos}%`;
    handle.style.left = `calc(${pos}% - 16px)`;
  };

  wrapper.addEventListener('mousedown', (e) => {
    dragging = true;
    e.preventDefault();
  });
  wrapper.addEventListener('touchstart', () => { dragging = true; }, { passive: true });

  const onMouseMove = (e) => { if (dragging) update(e.clientX); };
  const onTouchMove = (e) => { if (dragging) update(e.touches[0].clientX); };
  const onEnd = () => { dragging = false; };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchend', onEnd);

  return wrapper;
}
