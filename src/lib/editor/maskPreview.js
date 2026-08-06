export async function renderMaskPreview(sourceUrl, maskUrl, mode, container) {
  if (!sourceUrl || !maskUrl || !container) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'preview-media mask-preview-canvas';

  const ctx = canvas.getContext('2d');

  let sourceImg, maskImg;
  try {
    [sourceImg, maskImg] = await Promise.all([
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load source image'));
        img.src = sourceUrl;
      }),
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load mask image'));
        img.src = maskUrl;
      })
    ]);
  } catch (err) {
    console.warn('[maskPreview] image load failed:', err.message);
    return;
  }

  const w = sourceImg.naturalWidth;
  const h = sourceImg.naturalHeight;
  canvas.width = w;
  canvas.height = h;

  if (mode === 'red-overlay') {
    ctx.drawImage(sourceImg, 0, 0, w, h);

    const temp = document.createElement('canvas');
    temp.width = w;
    temp.height = h;
    const tCtx = temp.getContext('2d');

    tCtx.drawImage(maskImg, 0, 0, w, h);
    tCtx.globalCompositeOperation = 'source-in';
    tCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    tCtx.fillRect(0, 0, w, h);

    ctx.drawImage(temp, 0, 0);

  } else if (mode === 'white-on-black') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(maskImg, 0, 0, w, h);

  } else if (mode === 'cutout') {
    const temp = document.createElement('canvas');
    temp.width = w;
    temp.height = h;
    const tCtx = temp.getContext('2d');

    tCtx.drawImage(maskImg, 0, 0, w, h);
    tCtx.globalCompositeOperation = 'source-in';
    tCtx.drawImage(sourceImg, 0, 0, w, h);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(temp, 0, 0);
  }

  container.appendChild(canvas);
}
