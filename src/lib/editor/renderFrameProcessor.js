export function applyPresetFilter(ctx, preset, width, height) {
  const presetToFinish = {
    'luxury-brand-grade': 'soft-bloom',
    'documentary-contrast': 'contrast-lift',
    'film-trailer-punch': 'cinematic-punch',
    'emotional-story-tone': 'warm-glow',
  };

  const finish = presetToFinish[preset];
  if (finish) {
    applyFinish(ctx, finish, width, height);
  }
}

export function applyFinish(ctx, finish, width, height) {
  switch (finish) {
    case 'soft-bloom':
      applySoftBloom(ctx, width, height);
      break;
    case 'contrast-lift':
      applyContrastLift(ctx, width, height);
      break;
    case 'cinematic-punch':
      applyCinematicPunch(ctx, width, height);
      break;
    case 'warm-glow':
      applyWarmGlow(ctx, width, height);
      break;
    default:
      break;
  }
}

function applySoftBloom(ctx, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.max(width, height) * 0.6;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, 'rgba(255,255,255,0.15)');
  gradient.addColorStop(1, 'rgba(255,255,255,0.0)');

  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
}

function applyContrastLift(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const factor = (259 * (128 + 255)) / (255 * (259 - 128));

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(factor * (data[i] - 128) + 128);
    data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128);
    data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128);
  }

  ctx.putImageData(imageData, 0, 0);
}

function applyCinematicPunch(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const contrastFactor = (259 * (160 + 255)) / (255 * (259 - 160));
  const saturationMix = 1.35;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    data[i] = clamp(contrastFactor * (r - 128) + 128);
    data[i + 1] = clamp(contrastFactor * (g - 128) + 128);
    data[i + 2] = clamp(contrastFactor * (b - 128) + 128);

    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = clamp(gray + saturationMix * (r - gray));
    data[i + 1] = clamp(gray + saturationMix * (g - gray));
    data[i + 2] = clamp(gray + saturationMix * (b - gray));
  }

  ctx.putImageData(imageData, 0, 0);
}

function applyWarmGlow(ctx, width, height) {
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = 'rgba(255,140,50,0.25)';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function resizeCanvas(canvas, targetWidth, targetHeight, preserveAspect) {
  if (preserveAspect) {
    const srcAspect = canvas.width / canvas.height;
    const targetAspect = targetWidth / targetHeight;

    let newWidth, newHeight, offsetX, offsetY;

    if (srcAspect > targetAspect) {
      newWidth = targetWidth;
      newHeight = Math.round(targetWidth / srcAspect);
      offsetX = 0;
      offsetY = Math.round((targetHeight - newHeight) / 2);
    } else {
      newHeight = targetHeight;
      newWidth = Math.round(targetHeight * srcAspect);
      offsetX = Math.round((targetWidth - newWidth) / 2);
      offsetY = 0;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    return { width: newWidth, height: newHeight, offsetX, offsetY };
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  return { width: targetWidth, height: targetHeight, offsetX: 0, offsetY: 0 };
}

export function drawVideoFrame(video, canvas, time) {
  const ctx = canvas.getContext('2d');
  if (typeof time === 'number') {
    video.currentTime = time;
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height };
}
