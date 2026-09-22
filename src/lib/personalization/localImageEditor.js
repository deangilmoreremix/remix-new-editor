const ASPECT_CANVAS = {
  '9:16': [1024, 1792],
  '16:9': [1792, 1024],
  '1:1': [1024, 1024],
  '4:5': [1024, 1280],
};

export const DEFAULT_LOCAL_IMAGE_CONTROLS = Object.freeze({
  aspectRatio: 'original',
  outputFormat: 'png',
  rotation: 0,
  flipX: false,
  flipY: false,
  zoom: 100,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  opacity: 100,
  blur: 0,
  grayscale: 0,
  sepia: 0,
  padding: 0,
  borderSize: 0,
  shadow: 0,
  fitMode: 'contain',
  backgroundColor: 'transparent',
  overlayText: '',
  textSize: 48,
  textPosition: 'bottom',
});

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load image for local editing.'));
    image.src = dataUrl;
  });
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

export function normalizeLocalImageControls(input = {}) {
  const aspectRatio = ['original', '9:16', '16:9', '1:1', '4:5'].includes(input.aspectRatio)
    ? input.aspectRatio
    : 'original';
  const outputFormat = ['png', 'webp', 'jpeg'].includes(input.outputFormat)
    ? input.outputFormat
    : 'png';
  const fitMode = ['contain', 'cover'].includes(input.fitMode) ? input.fitMode : 'contain';
  const textPosition = ['top', 'center', 'bottom'].includes(input.textPosition)
    ? input.textPosition
    : 'bottom';

  return {
    aspectRatio,
    outputFormat,
    rotation: clamp(input.rotation, 0, 359, 0),
    flipX: Boolean(input.flipX),
    flipY: Boolean(input.flipY),
    zoom: clamp(input.zoom, 10, 300, 100),
    brightness: clamp(input.brightness, 0, 250, 100),
    contrast: clamp(input.contrast, 0, 250, 100),
    saturation: clamp(input.saturation, 0, 300, 100),
    opacity: clamp(input.opacity, 0, 100, 100),
    blur: clamp(input.blur, 0, 30, 0),
    grayscale: clamp(input.grayscale, 0, 100, 0),
    sepia: clamp(input.sepia, 0, 100, 0),
    padding: clamp(input.padding, 0, 500, 0),
    borderSize: clamp(input.borderSize, 0, 100, 0),
    shadow: clamp(input.shadow, 0, 100, 0),
    fitMode,
    backgroundColor: typeof input.backgroundColor === 'string' && input.backgroundColor
      ? input.backgroundColor
      : 'transparent',
    overlayText: typeof input.overlayText === 'string' ? input.overlayText.slice(0, 300) : '',
    textSize: clamp(input.textSize, 12, 240, 48),
    textPosition,
  };
}

export async function applyLocalImageAdjustments(sourceDataUrl, inputControls = {}) {
  if (!sourceDataUrl?.startsWith('data:image/')) {
    throw new Error('Local image editing requires prepared image data.');
  }

  const controls = normalizeLocalImageControls(inputControls);
  const image = await loadImage(sourceDataUrl);

  let canvasWidth = image.naturalWidth || image.width;
  let canvasHeight = image.naturalHeight || image.height;
  if (controls.aspectRatio !== 'original') {
    [canvasWidth, canvasHeight] = ASPECT_CANVAS[controls.aspectRatio];
  }

  const maxEdge = 2048;
  const edgeScale = Math.min(1, maxEdge / Math.max(canvasWidth, canvasHeight));
  canvasWidth = Math.max(1, Math.round(canvasWidth * edgeScale));
  canvasHeight = Math.max(1, Math.round(canvasHeight * edgeScale));

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser canvas is unavailable.');

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  if (controls.backgroundColor !== 'transparent') {
    ctx.fillStyle = controls.backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  const padding = Math.min(controls.padding, Math.max(0, Math.min(canvasWidth, canvasHeight) / 2 - 1));
  const innerWidth = Math.max(1, canvasWidth - padding * 2);
  const innerHeight = Math.max(1, canvasHeight - padding * 2);
  const containScale = Math.min(innerWidth / image.naturalWidth, innerHeight / image.naturalHeight);
  const coverScale = Math.max(innerWidth / image.naturalWidth, innerHeight / image.naturalHeight);
  const scale = (controls.fitMode === 'cover' ? coverScale : containScale) * (controls.zoom / 100);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;

  ctx.save();
  ctx.translate(canvasWidth / 2, canvasHeight / 2);
  ctx.rotate((controls.rotation * Math.PI) / 180);
  ctx.scale(controls.flipX ? -1 : 1, controls.flipY ? -1 : 1);
  ctx.globalAlpha = controls.opacity / 100;
  ctx.filter =
    `brightness(${controls.brightness}%) contrast(${controls.contrast}%) saturate(${controls.saturation}%) ` +
    `blur(${controls.blur}px) grayscale(${controls.grayscale}%) sepia(${controls.sepia}%)`;
  if (controls.shadow > 0) {
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = controls.shadow;
    ctx.shadowOffsetY = Math.max(2, controls.shadow / 3);
  }
  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();

  if (controls.borderSize > 0) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = controls.borderSize;
    ctx.strokeRect(
      controls.borderSize / 2,
      controls.borderSize / 2,
      Math.max(0, canvasWidth - controls.borderSize),
      Math.max(0, canvasHeight - controls.borderSize),
    );
    ctx.restore();
  }

  if (controls.overlayText.trim()) {
    ctx.save();
    const scaledSize = Math.max(18, Math.round(controls.textSize * edgeScale));
    ctx.font = `700 ${scaledSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, scaledSize * 0.08);
    ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.fillStyle = '#ffffff';
    const y = controls.textPosition === 'top'
      ? scaledSize * 1.3
      : controls.textPosition === 'center'
        ? canvasHeight / 2
        : canvasHeight - scaledSize * 1.3;
    ctx.strokeText(controls.overlayText.trim(), canvasWidth / 2, y, canvasWidth * 0.9);
    ctx.fillText(controls.overlayText.trim(), canvasWidth / 2, y, canvasWidth * 0.9);
    ctx.restore();
  }

  const format = controls.backgroundColor === 'transparent' && controls.outputFormat === 'jpeg'
    ? 'png'
    : controls.outputFormat;
  const mime = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
  const quality = format === 'jpeg' || format === 'webp' ? 0.92 : undefined;

  return {
    dataUrl: canvas.toDataURL(mime, quality),
    outputFormat: format,
    transparent: controls.backgroundColor === 'transparent' && format !== 'jpeg',
    width: canvasWidth,
    height: canvasHeight,
    controls,
  };
}
