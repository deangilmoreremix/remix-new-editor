const GIF89a_HEADER = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

function writeShort(buf, val) {
  buf.push(val & 0xff, (val >> 8) & 0xff);
}

function writeString(buf, str) {
  for (let i = 0; i < str.length; i++) buf.push(str.charCodeAt(i));
}

function quantizeColors(data, maxColors = 256) {
  const colorMap = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = (r << 16) | (g << 8) | b;
    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  }
  let entries = [...colorMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxColors);
  if (entries.length === 0) entries = [[0, 1]];
  const palette = entries.map(([rgb]) => [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff]);
  while (palette.length < maxColors) palette.push([0, 0, 0]);
  const indexMap = new Map(entries.map(([rgb], i) => [rgb, i]));
  return { palette, indexMap };
}

function lzwEncode(pixelIndices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  const maxCode = 4096;
  const dict = new Map();
  for (let i = 0; i < clearCode; i++) dict.set(String(i), i);

  const output = [];
  let buf = 0, bits = 0;

  function emit(code) {
    buf |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      output.push(buf & 0xff);
      buf >>>= 8;
      bits -= 8;
    }
  }

  emit(clearCode);
  let current = String(pixelIndices[0]);

  for (let i = 1; i < pixelIndices.length; i++) {
    const next = String(pixelIndices[i]);
    const combined = current + ',' + next;
    if (dict.has(combined)) {
      current = combined;
    } else {
      emit(dict.get(current));
      if (nextCode < maxCode) {
        dict.set(combined, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        emit(clearCode);
        dict.clear();
        for (let j = 0; j < clearCode; j++) dict.set(String(j), j);
        nextCode = eoiCode + 1;
        codeSize = minCodeSize + 1;
      }
      current = next;
    }
  }
  emit(dict.get(current));
  emit(eoiCode);
  if (bits > 0) output.push(buf & 0xff);

  const subBlocks = [];
  for (let i = 0; i < output.length; i += 255) {
    const chunk = output.slice(i, i + 255);
    subBlocks.push(chunk.length, ...chunk);
  }
  return [minCodeSize, ...subBlocks, 0];
}

export function encodeGif(frameDataUrls, width, height, delayMs = 500) {
  if (!Array.isArray(frameDataUrls) || frameDataUrls.length === 0) {
    console.warn('[gifEncoder] No frames provided');
    return '';
  }

  const delayCentiseconds = Math.max(2, Math.round(delayMs / 10));
  const globalColors = new Uint8Array(256 * 3);
  const allPixels = [];

  for (const src of frameDataUrls) {
    const dataUrl = typeof src === 'string' ? src.replace(/^data:image\/\w+;base64,/, '') : '';
    if (!dataUrl) continue;
    const binary = atob(dataUrl);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    let img;
    try {
      const offscreen = new OffscreenCanvas(width, height);
      const ctx = offscreen.getContext('2d');
      const blob = new Blob([bytes], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.src = url;
      ctx.drawImage(image, 0, 0, width, height);
      img = ctx.getImageData(0, 0, width, height);
      URL.revokeObjectURL(url);
    } catch {
      continue;
    }
    if (!img) continue;
    allPixels.push(img.data);
  }

  if (allPixels.length === 0) {
    console.warn('[gifEncoder] No valid frames decoded');
    return '';
  }

  const { palette } = quantizeColors(allPixels[0]);
  for (let i = 0; i < 256; i++) {
    globalColors[i * 3] = palette[i][0];
    globalColors[i * 3 + 1] = palette[i][1];
    globalColors[i * 3 + 2] = palette[i][2];
  }

  const buf = [...GIF89a_HEADER];
  buf.push(...[(width & 0xff), (width >> 8) & 0xff, (height & 0xff), (height >> 8) & 0xff]);
  buf.push(0xf7);
  buf.push(0);
  buf.push(0);
  buf.push(...globalColors);
  buf.push(0x21, 0xff, 0x0b);
  writeString(buf, 'NETSCAPE2.0');
  buf.push(0x03, 0x01);
  writeShort(buf, 0);
  buf.push(0x00);

  const framesToEncode = allPixels.length < frameDataUrls.length ? allPixels : frameDataUrls;

  for (const frame of framesToEncode) {
    let raw;
    if (frame instanceof Uint8ClampedArray) {
      raw = frame;
    } else {
      const dataUrl = typeof frame === 'string' ? frame.replace(/^data:image\/\w+;base64,/, '') : '';
      if (!dataUrl) continue;
      const binary = atob(dataUrl);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      try {
        const offscreen = new OffscreenCanvas(width, height);
        const ctx = offscreen.getContext('2d');
        const blob = new Blob([bytes], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.src = url;
        ctx.drawImage(image, 0, 0, width, height);
        raw = ctx.getImageData(0, 0, width, height).data;
        URL.revokeObjectURL(url);
      } catch {
        continue;
      }
    }
    if (!raw) continue;

    const { indexMap } = quantizeColors(raw);
    const indices = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = raw[i * 4], g = raw[i * 4 + 1], b = raw[i * 4 + 2];
      const key = (r << 16) | (g << 8) | b;
      indices[i] = indexMap.get(key) || 0;
    }

    buf.push(0x21, 0xf9, 0x04, 0x00);
    writeShort(buf, delayCentiseconds);
    buf.push(0x00, 0x00);
    buf.push(0x2c);
    writeShort(buf, 0);
    writeShort(buf, 0);
    writeShort(buf, width);
    writeShort(buf, height);
    buf.push(0x00);
    const encoded = lzwEncode(indices, 8);
    buf.push(...encoded);
  }

  buf.push(0x3b);

  const bytes = new Uint8Array(buf.length);
  for (let i = 0; i < buf.length; i++) bytes[i] = buf[i];
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:image/gif;base64,' + btoa(binary);
}
