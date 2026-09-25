const TOOL_LABELS = {
  brush: 'Brush',
  eraser: 'Erase',
  rectangle: 'Box',
  ellipse: 'Ellipse',
  lasso: 'Lasso',
};

export function apiMaskAlphaForSelectionAlpha(selectionAlpha) {
  return Number(selectionAlpha) > 0 ? 0 : 255;
}

function pointFromEvent(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / Math.max(rect.width, 1)),
    y: (event.clientY - rect.top) * (canvas.height / Math.max(rect.height, 1)),
  };
}

function stripDataUrl(value) {
  if (typeof value !== 'string') return '';
  const comma = value.indexOf(',');
  return comma >= 0 ? value.slice(comma + 1) : value;
}

export function mountPersonalizationMaskEditor(container, {
  imageUrl,
  onMaskChange = () => {},
  initialBrushSize = 64,
  initialMaskB64 = '',
} = {}) {
  if (!container) throw new Error('Mask editor container is required.');
  if (!imageUrl) throw new Error('Mask editor imageUrl is required.');

  let tool = 'brush';
  let brushSize = initialBrushSize;
  let drawing = false;
  let shapeStart = null;
  let previousPoint = null;
  let lassoPoints = [];
  let hasMask = false;
  let currentMaskB64 = '';

  container.innerHTML = `
    <div class="pm-mask-editor">
      <div class="pm-mask-toolbar" role="toolbar" aria-label="Mask selection tools">
        <div class="pm-mask-tools">
          ${Object.entries(TOOL_LABELS).map(([id, label]) => `
            <button type="button" class="pm-small-btn pm-mask-tool" data-mask-tool="${id}" aria-pressed="${id === 'brush' ? 'true' : 'false'}">${label}</button>
          `).join('')}
        </div>
        <label class="pm-mask-brush-label">
          <span>Brush</span>
          <input type="range" min="8" max="240" value="${brushSize}" data-mask-brush />
          <span data-mask-brush-value>${brushSize}px</span>
        </label>
        <div class="pm-mask-actions">
          <button type="button" class="pm-small-btn" data-mask-invert disabled>Invert</button>
          <button type="button" class="pm-small-btn" data-mask-clear disabled>Clear</button>
        </div>
      </div>
      <div class="pm-mask-stage">
        <img class="pm-mask-image" data-mask-image alt="Mask target" />
        <canvas class="pm-mask-canvas" data-mask-canvas aria-label="Editable mask selection canvas"></canvas>
      </div>
      <p class="pm-mask-help">
        Select the region SmartVideo AI should change. Cyan is the editable selection. The exported API mask automatically uses transparent pixels for the editable region and opaque pixels for protected content.
      </p>
    </div>
  `;

  const image = container.querySelector('[data-mask-image]');
  const canvas = container.querySelector('[data-mask-canvas]');
  const brushInput = container.querySelector('[data-mask-brush]');
  const brushValue = container.querySelector('[data-mask-brush-value]');
  const invertButton = container.querySelector('[data-mask-invert]');
  const clearButton = container.querySelector('[data-mask-clear]');
  const toolButtons = Array.from(container.querySelectorAll('[data-mask-tool]'));

  const ctx = canvas?.getContext('2d');
  if (!image || !canvas || !ctx) throw new Error('Mask editor canvas is unavailable.');

  function syncButtons() {
    toolButtons.forEach((button) => {
      const active = button.dataset.maskTool === tool;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('active', active);
    });
    invertButton.disabled = !hasMask;
    clearButton.disabled = !hasMask;
  }

  function exportMask() {
    if (!canvas.width || !canvas.height) return;
    const selection = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const apiCanvas = document.createElement('canvas');
    apiCanvas.width = canvas.width;
    apiCanvas.height = canvas.height;
    const apiCtx = apiCanvas.getContext('2d');
    if (!apiCtx) return;

    const apiMask = apiCtx.createImageData(canvas.width, canvas.height);
    let selectedPixels = 0;
    for (let i = 0; i < selection.data.length; i += 4) {
      const alpha = selection.data[i + 3];
      if (alpha > 0) selectedPixels += 1;
      apiMask.data[i] = 255;
      apiMask.data[i + 1] = 255;
      apiMask.data[i + 2] = 255;
      apiMask.data[i + 3] = apiMaskAlphaForSelectionAlpha(alpha);
    }

    if (!selectedPixels) {
      hasMask = false;
      currentMaskB64 = '';
      onMaskChange(null);
      syncButtons();
      return;
    }

    apiCtx.putImageData(apiMask, 0, 0);
    currentMaskB64 = stripDataUrl(apiCanvas.toDataURL('image/png'));
    hasMask = Boolean(currentMaskB64);
    onMaskChange(currentMaskB64 || null);
    syncButtons();
  }

  async function initialize() {
    canvas.width = image.naturalWidth || image.width || 1024;
    canvas.height = image.naturalHeight || image.height || 1024;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (initialMaskB64) {
      try {
        const apiMaskImage = new Image();
        await new Promise((resolve, reject) => {
          apiMaskImage.onload = resolve;
          apiMaskImage.onerror = reject;
          apiMaskImage.src = `data:image/png;base64,${initialMaskB64}`;
        });
        const temp = document.createElement('canvas');
        temp.width = canvas.width;
        temp.height = canvas.height;
        const tempCtx = temp.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(apiMaskImage, 0, 0, temp.width, temp.height);
          const apiData = tempCtx.getImageData(0, 0, temp.width, temp.height);
          const selection = ctx.createImageData(temp.width, temp.height);
          let selectedPixels = 0;
          for (let i = 0; i < apiData.data.length; i += 4) {
            const apiAlpha = apiData.data[i + 3];
            const selectedAlpha = 255 - apiAlpha;
            if (selectedAlpha > 0) selectedPixels += 1;
            selection.data[i] = 41;
            selection.data[i + 1] = 211;
            selection.data[i + 2] = 242;
            selection.data[i + 3] = selectedAlpha;
          }
          ctx.putImageData(selection, 0, 0);
          hasMask = selectedPixels > 0;
          currentMaskB64 = hasMask ? initialMaskB64 : '';
          onMaskChange(currentMaskB64 || null);
          syncButtons();
          return;
        }
      } catch {
        // Fall through to a clear mask if the stored mask cannot be restored.
      }
    }

    hasMask = false;
    currentMaskB64 = '';
    onMaskChange(null);
    syncButtons();
  }

  function paintCircle(point, erase = false) {
    ctx.save();
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.fillStyle = 'rgba(41,211,242,1)';
    ctx.beginPath();
    ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function paintLine(from, to, erase = false) {
    if (!from) {
      paintCircle(to, erase);
      return;
    }
    ctx.save();
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = 'rgba(41,211,242,1)';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  function pointerDown(event) {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    const point = pointFromEvent(event, canvas);
    drawing = true;
    previousPoint = point;

    if (tool === 'rectangle' || tool === 'ellipse') {
      shapeStart = point;
      return;
    }
    if (tool === 'lasso') {
      lassoPoints = [point];
      return;
    }
    paintCircle(point, tool === 'eraser');
  }

  function pointerMove(event) {
    if (!drawing) return;
    const point = pointFromEvent(event, canvas);
    if (tool === 'brush' || tool === 'eraser') {
      paintLine(previousPoint, point, tool === 'eraser');
      previousPoint = point;
      return;
    }
    if (tool === 'lasso') {
      const last = lassoPoints[lassoPoints.length - 1];
      if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= 3) {
        lassoPoints.push(point);
      }
    }
  }

  function pointerUp(event) {
    if (!drawing) return;
    const end = pointFromEvent(event, canvas);

    if (shapeStart && tool === 'rectangle') {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(41,211,242,1)';
      ctx.fillRect(shapeStart.x, shapeStart.y, end.x - shapeStart.x, end.y - shapeStart.y);
      ctx.restore();
    } else if (shapeStart && tool === 'ellipse') {
      const centerX = (shapeStart.x + end.x) / 2;
      const centerY = (shapeStart.y + end.y) / 2;
      const radiusX = Math.abs(end.x - shapeStart.x) / 2;
      const radiusY = Math.abs(end.y - shapeStart.y) / 2;
      if (radiusX > 0 && radiusY > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(41,211,242,1)';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (tool === 'lasso') {
      const points = [...lassoPoints, end];
      if (points.length >= 3) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(41,211,242,1)';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    drawing = false;
    previousPoint = null;
    shapeStart = null;
    lassoPoints = [];
    exportMask();
  }

  function clearMask() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasMask = false;
    currentMaskB64 = '';
    lassoPoints = [];
    onMaskChange(null);
    syncButtons();
  }

  function invertMask() {
    if (!canvas.width || !canvas.height) return;
    const selection = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < selection.data.length; i += 4) {
      const alpha = selection.data[i + 3];
      selection.data[i] = 41;
      selection.data[i + 1] = 211;
      selection.data[i + 2] = 242;
      selection.data[i + 3] = 255 - alpha;
    }
    ctx.putImageData(selection, 0, 0);
    exportMask();
  }

  toolButtons.forEach((button) => {
    button.addEventListener('click', () => {
      tool = button.dataset.maskTool || 'brush';
      syncButtons();
    });
  });

  brushInput.addEventListener('input', () => {
    brushSize = Number(brushInput.value) || 64;
    brushValue.textContent = `${brushSize}px`;
  });
  invertButton.addEventListener('click', invertMask);
  clearButton.addEventListener('click', clearMask);
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  image.addEventListener('load', initialize);
  image.src = imageUrl;
  syncButtons();

  return {
    getMaskB64: () => currentMaskB64,
    clear: clearMask,
    destroy() {
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      image.removeEventListener('load', initialize);
      container.innerHTML = '';
    },
  };
}
