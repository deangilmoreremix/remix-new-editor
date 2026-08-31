/**
 * Personalizer
 *
 * A visual canvas-based editor for building personalized web pages/domains.
 * Users drag DOM elements onto a canvas, personalize them with tokens,
 * and preview how the page renders for different contacts.
 *
 * Architecture:
 *  - Canvas: free-form DOM canvas with absolute positioning
 *  - Elements: text, image, button, form, video, spacer
 *  - Personalization: token-aware bindings per element
 *  - Preview: live contact switching with token resolution
 */

import { mountStudioChrome } from '../lib/studioChrome.js';
import { showToast } from '../lib/loading.js';
import { escapeHtml } from '../lib/security.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt, inspectPromptTokens, getSelectedContactId, setSelectedContactId } from './personalize/personalizePopover.js';
import { TOKEN_KEYS, TOKEN_LABELS, buildVariables } from './personalize/tokenSchema.js';
import { getActiveProfile, listProfiles } from '../lib/contactStore.js';

// ─── Canvas / element types ────────────────────────────────────────────────

const ELEMENT_TYPES = {
  TEXT: 'text',
  HEADING: 'heading',
  IMAGE: 'image',
  BUTTON: 'button',
  FORM: 'form',
  VIDEO: 'video',
  SPACER: 'spacer',
  CONTAINER: 'container',
};

const DEFAULT_ELEMENT_STYLES = {
  [ELEMENT_TYPES.TEXT]: {
    width: 300,
    height: 80,
    fontSize: 16,
    fontFamily: 'Inter, sans-serif',
    color: '#ffffff',
    backgroundColor: 'transparent',
    padding: 8,
    borderRadius: 0,
    text: 'Double-click to edit text. Use {{token}} for personalization.',
  },
  [ELEMENT_TYPES.HEADING]: {
    width: 400,
    height: 60,
    fontSize: 32,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 700,
    color: '#ffffff',
    backgroundColor: 'transparent',
    padding: 8,
    borderRadius: 0,
    text: 'Welcome, {{firstName}}!',
  },
  [ELEMENT_TYPES.IMAGE]: {
    width: 240,
    height: 160,
    src: '',
    alt: 'Personalized image',
    objectFit: 'cover',
    borderRadius: 8,
  },
  [ELEMENT_TYPES.BUTTON]: {
    width: 160,
    height: 44,
    text: 'Click Me',
    backgroundColor: '#d9ff00',
    color: '#000000',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    href: 'https://example.com',
  },
  [ELEMENT_TYPES.FORM]: {
    width: 320,
    height: 200,
    fields: 'name,email,company',
    submitText: 'Submit',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  [ELEMENT_TYPES.VIDEO]: {
    width: 480,
    height: 270,
    src: '',
    poster: '',
    autoplay: false,
    controls: true,
    borderRadius: 8,
  },
  [ELEMENT_TYPES.SPACER]: {
    width: 200,
    height: 40,
    backgroundColor: 'transparent',
  },
  [ELEMENT_TYPES.CONTAINER]: {
    width: 600,
    height: 400,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
};

const CANVAS_PRESETS = [
  { label: 'Blank', width: 1280, height: 720 },
  { label: 'Landing Page', width: 1280, height: 800 },
  { label: 'Email', width: 600, height: 800 },
  { label: 'Social Post', width: 1080, height: 1080 },
  { label: 'Story', width: 1080, height: 1920 },
  { label: 'Banner', width: 728, height: 90 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function generateId() {
  return `${Date.now()}/${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value, min, max) {
  if (typeof value !== 'number' || Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function createResizeHandle(elementId, onResizeStart) {
  const handle = document.createElement('div');
  handle.className = 'dom-resize-handle';
  handle.style.cssText = `
    position: absolute;
    right: 0;
    bottom: 0;
    width: 14px;
    height: 14px;
    cursor: nwse-resize;
    background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.25) 40%, rgba(255,255,255,0.25) 50%, transparent 50%);
    z-index: 5;
  `;
  handle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const wrapper = handle.parentElement;
    const startW = wrapper.offsetWidth;
    const startH = wrapper.offsetHeight;

    const onMouseMove = (moveEvent) => {
      const newW = Math.max(40, startW + (moveEvent.clientX - startX));
      const newH = Math.max(40, startH + (moveEvent.clientY - startY));
      wrapper.style.width = `${newW}px`;
      wrapper.style.height = `${newH}px`;
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (typeof onResizeStart === 'function') onResizeStart(elementId, wrapper);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
  return handle;
}

function createDeleteButton(onDelete) {
  const btn = document.createElement('button');
  btn.className = 'dom-delete-btn';
  btn.innerHTML = '&times;';
  btn.style.cssText = `
    position: absolute;
    top: -8px;
    right: -8px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid rgba(0,0,0,0.2);
    background: rgba(239, 68, 68, 0.9);
    color: white;
    font-size: 12px;
    line-height: 18px;
    text-align: center;
    cursor: pointer;
    z-index: 5;
    display: none;
    padding: 0;
  `;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onDelete();
  });
  return btn;
}

// ─── Element renderers ─────────────────────────────────────────────────────

function renderTextElement(options, onChange) {
  const el = document.createElement('div');
  el.contentEditable = 'true';
  el.innerText = options.text || '';
  el.style.cssText = `
    width: 100%;
    height: 100%;
    font-size: ${options.fontSize || 16}px;
    font-family: ${options.fontFamily || 'Inter, sans-serif'};
    font-weight: ${options.fontWeight || 400};
    color: ${options.color || '#ffffff'};
    background-color: ${options.backgroundColor || 'transparent'};
    padding: ${options.padding || 8}px;
    border-radius: ${options.borderRadius || 0}px;
    overflow: hidden;
    outline: none;
    word-break: break-word;
    line-height: 1.4;
  `;
  el.addEventListener('input', () => {
    if (typeof onChange === 'function') onChange(el.innerText);
  });
  el.addEventListener('blur', () => {
    if (typeof onChange === 'function') onChange(el.innerText);
  });
  return el;
}

function renderImageElement(options) {
  const el = document.createElement('img');
  el.src = options.src || '';
  el.alt = options.alt || '';
  el.style.cssText = `
    width: 100%;
    height: 100%;
    object-fit: ${options.objectFit || 'cover'};
    border-radius: ${options.borderRadius || 0}px;
    background: rgba(255,255,255,0.05);
    display: block;
  `;
  return el;
}

function renderButtonElement(options) {
  const el = document.createElement('a');
  el.href = options.href || '#';
  el.innerText = options.text || 'Button';
  el.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background-color: ${options.backgroundColor || '#d9ff00'};
    color: ${options.color || '#000000'};
    border-radius: ${options.borderRadius || 8}px;
    font-size: ${options.fontSize || 14}px;
    font-weight: ${options.fontWeight || 600};
    text-decoration: none;
    padding: 0 16px;
    box-sizing: border-box;
  `;
  return el;
}

function renderFormElement(options) {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 100%;
    height: 100%;
    background-color: ${options.backgroundColor || 'rgba(255,255,255,0.05)'};
    border-radius: ${options.borderRadius || 12}px;
    padding: ${options.padding || 16}px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: #ffffff;
    font-family: Inter, sans-serif;
    font-size: 14px;
  `;

  const fields = (options.fields || 'name,email').split(',').map((f) => f.trim()).filter(Boolean);
  fields.forEach((field) => {
    const input = document.createElement('input');
    input.type = field === 'email' ? 'email' : 'text';
    input.placeholder = field.charAt(0).toUpperCase() + field.slice(1);
    input.style.cssText = `
      width: 100%;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(0,0,0,0.25);
      color: #fff;
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
    `;
    el.appendChild(input);
  });

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.innerText = options.submitText || 'Submit';
  submit.style.cssText = `
    margin-top: 4px;
    padding: 8px 12px;
    border-radius: 6px;
    border: none;
    background: #d9ff00;
    color: #000;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  `;
  el.appendChild(submit);

  return el;
}

function renderVideoElement(options) {
  const el = document.createElement('video');
  el.src = options.src || '';
  el.controls = !!options.controls;
  el.style.cssText = `
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: ${options.borderRadius || 0}px;
    background: #000;
    display: block;
  `;
  return el;
}

function renderSpacerElement(options) {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 100%;
    height: 100%;
    background-color: ${options.backgroundColor || 'transparent'};
    border: 1px dashed rgba(255,255,255,0.08);
    border-radius: 4px;
  `;
  return el;
}

function renderContainerElement(options) {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 100%;
    height: 100%;
    background-color: ${options.backgroundColor || 'rgba(255,255,255,0.03)'};
    border-radius: ${options.borderRadius || 12}px;
    padding: ${options.padding || 16}px;
    box-sizing: border-box;
    border: ${options.borderWidth || 1}px solid ${options.borderColor || 'rgba(255,255,255,0.08)'};
  `;
  el.innerText = 'Container';
  el.style.color = 'rgba(255,255,255,0.4)';
  el.style.fontSize = '12px';
  return el;
}

// ─── Main Studio ───────────────────────────────────────────────────────────

export function Personalizer() {
  const container = document.createElement('div');
  container.className = 'personalizer-studio w-full h-full flex flex-col bg-app-bg overflow-hidden';

  // Top bar + drawer
  const chromeContainer = document.createElement('div');
  chromeContainer.style.cssText = 'flex: 0 0 auto;';
  mountStudioChrome(chromeContainer, { currentRoute: 'personalizer', title: 'Personalizer' });
  container.appendChild(chromeContainer);

  // Main layout: sidebar + canvas
  const main = document.createElement('div');
  main.style.cssText = `
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  `;

  // ─── Left Sidebar ───────────────────────────────────────────────────────
  const sidebar = document.createElement('aside');
  sidebar.className = 'dom-sidebar';
  sidebar.style.cssText = `
    width: 260px;
    background: rgba(0,0,0,0.25);
    border-right: 1px solid rgba(255,255,255,0.06);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex-shrink: 0;
  `;

  // Sidebar: Elements palette
  const paletteTitle = document.createElement('div');
  paletteTitle.className = 'dom-sidebar-title';
  paletteTitle.innerText = 'Elements';
  paletteTitle.style.cssText = `
    padding: 16px 16px 8px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.5);
  `;
  sidebar.appendChild(paletteTitle);

  const paletteGrid = document.createElement('div');
  paletteGrid.className = 'dom-palette-grid';
  paletteGrid.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 0 12px 12px;
  `;

  const paletteItems = [
    { type: ELEMENT_TYPES.HEADING, label: 'Heading', icon: 'H' },
    { type: ELEMENT_TYPES.TEXT, label: 'Text', icon: 'T' },
    { type: ELEMENT_TYPES.IMAGE, label: 'Image', icon: '🖼' },
    { type: ELEMENT_TYPES.BUTTON, label: 'Button', icon: '⬚' },
    { type: ELEMENT_TYPES.FORM, label: 'Form', icon: '☰' },
    { type: ELEMENT_TYPES.VIDEO, label: 'Video', icon: '▶' },
    { type: ELEMENT_TYPES.SPACER, label: 'Spacer', icon: '—' },
    { type: ELEMENT_TYPES.CONTAINER, label: 'Container', icon: '▢' },
  ];

  paletteItems.forEach(({ type, label, icon }) => {
    const btn = document.createElement('button');
    btn.className = 'dom-palette-item';
    btn.dataset.type = type;
    btn.innerHTML = `<span style="font-size:18px;">${icon}</span><span style="font-size:11px;">${label}</span>`;
    btn.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 10px 6px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.8);
      cursor: grab;
      transition: all 0.15s ease;
      font-family: inherit;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(255,255,255,0.08)';
      btn.style.borderColor = 'rgba(255,255,255,0.2)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255,255,255,0.04)';
      btn.style.borderColor = 'rgba(255,255,255,0.08)';
    });
    btn.draggable = true;
    btn.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-dom-element', type);
      e.dataTransfer.effectAllowed = 'copy';
    });
    btn.addEventListener('click', () => {
      addElement(type);
      showToast(`Added ${label}`);
    });
    paletteGrid.appendChild(btn);
  });
  sidebar.appendChild(paletteGrid);

  // Sidebar: Canvas settings
  const canvasTitle = document.createElement('div');
  canvasTitle.className = 'dom-sidebar-title';
  canvasTitle.innerText = 'Canvas';
  canvasTitle.style.cssText = `
    padding: 16px 16px 8px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.5);
  `;
  sidebar.appendChild(canvasTitle);

  const presetRow = document.createElement('div');
  presetRow.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 12px 12px;
  `;
  CANVAS_PRESETS.forEach((preset) => {
    const btn = document.createElement('button');
    btn.className = 'dom-preset-btn';
    btn.innerText = preset.label;
    btn.style.cssText = `
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.7);
      font-size: 11px;
      cursor: pointer;
      font-family: inherit;
    `;
    btn.addEventListener('click', () => {
      setCanvasSize(preset.width, preset.height);
    });
    presetRow.appendChild(btn);
  });
  sidebar.appendChild(presetRow);

  const sizeRow = document.createElement('div');
  sizeRow.style.cssText = `
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 0 12px 12px;
    font-size: 12px;
    color: rgba(255,255,255,0.6);
  `;
  const wLabel = document.createElement('span');
  wLabel.innerText = 'W';
  const wInput = document.createElement('input');
  wInput.type = 'number';
  wInput.value = 1280;
  wInput.style.cssText = `
    width: 70px;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(0,0,0,0.3);
    color: #fff;
    font-size: 12px;
  `;
  const hLabel = document.createElement('span');
  hLabel.innerText = 'H';
  const hInput = document.createElement('input');
  hInput.type = 'number';
  hInput.value = 720;
  hInput.style.cssText = wInput.style.cssText;
  sizeRow.append(wLabel, wInput, hLabel, hInput);
  sidebar.appendChild(sizeRow);

  const applySizeBtn = document.createElement('button');
  applySizeBtn.innerText = 'Apply Size';
  applySizeBtn.style.cssText = `
    margin: 0 12px 12px;
    padding: 6px 10px;
    border-radius: 6px;
    border: none;
    background: rgba(255,255,255,0.08);
    color: #fff;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  `;
  applySizeBtn.addEventListener('click', () => {
    const w = parseInt(wInput.value, 10) || 1280;
    const h = parseInt(hInput.value, 10) || 720;
    setCanvasSize(w, h);
  });
  sidebar.appendChild(applySizeBtn);

  const saveBtn = document.createElement('button');
  saveBtn.innerText = 'Save Canvas';
  saveBtn.style.cssText = `
    margin: 0 12px 12px;
    padding: 6px 10px;
    border-radius: 6px;
    border: none;
    background: rgba(255,255,255,0.08);
    color: #fff;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  `;
  saveBtn.addEventListener('click', () => {
    localStorage.setItem('personalizer-canvas', JSON.stringify({ elements, canvasWidth, canvasHeight }));
    showToast('Canvas saved');
  });
  sidebar.appendChild(saveBtn);

  const loadBtn = document.createElement('button');
  loadBtn.innerText = 'Load Canvas';
  loadBtn.style.cssText = `
    margin: 0 12px 12px;
    padding: 6px 10px;
    border-radius: 6px;
    border: none;
    background: rgba(255,255,255,0.08);
    color: #fff;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  `;
  loadBtn.addEventListener('click', () => {
    const raw = localStorage.getItem('personalizer-canvas');
    if (!raw) {
      showToast('No saved canvas found');
      return;
    }
    try {
      const data = JSON.parse(raw);
      elements = data.elements || [];
      canvasWidth = data.canvasWidth || 1280;
      canvasHeight = data.canvasHeight || 720;
      setCanvasSize(canvasWidth, canvasHeight);
      selectedElementId = null;
      renderCanvas();
      renderPropertiesPanel();
      showToast('Canvas loaded');
    } catch {
      showToast('Failed to load canvas');
    }
  });
  sidebar.appendChild(loadBtn);

  // Sidebar: Personalization
  const personalizeTitle = document.createElement('div');
  personalizeTitle.className = 'dom-sidebar-title';
  personalizeTitle.innerText = 'Personalization';
  personalizeTitle.style.cssText = `
    padding: 16px 16px 8px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.5);
  `;
  sidebar.appendChild(personalizeTitle);

  const contactRow = document.createElement('div');
  contactRow.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0 12px 12px;
  `;
  const contactLabel = document.createElement('label');
  contactLabel.innerText = 'Active Contact';
  contactLabel.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.5);';
  const contactSelect = document.createElement('select');
  contactSelect.style.cssText = `
    width: 100%;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(0,0,0,0.3);
    color: #fff;
    font-size: 12px;
    font-family: inherit;
  `;
  const profiles = listProfiles();
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.innerText = '— None —';
  contactSelect.appendChild(defaultOption);
  profiles.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.innerText = p.contact?.name || p.id;
    contactSelect.appendChild(opt);
  });
  contactSelect.addEventListener('change', () => {
    const id = contactSelect.value || null;
    setSelectedContactId(id);
    renderCanvasPreview();
  });
  contactRow.append(contactLabel, contactSelect);
  sidebar.appendChild(contactRow);

  // Quick token list
  const tokenList = document.createElement('div');
  tokenList.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 0 12px 12px;
  `;
  TOKEN_KEYS.forEach((key) => {
    const chip = document.createElement('button');
    chip.className = 'dom-token-chip';
    chip.innerText = `{{${key}}}`;
    chip.title = TOKEN_LABELS[key] || key;
    chip.style.cssText = `
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.8);
      font-size: 10px;
      font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
      cursor: pointer;
    `;
    chip.addEventListener('click', () => {
      insertTokenIntoSelectedElement(key);
    });
    tokenList.appendChild(chip);
  });
  sidebar.appendChild(tokenList);

  // Sidebar: Actions
  const actionsTitle = document.createElement('div');
  actionsTitle.className = 'dom-sidebar-title';
  actionsTitle.innerText = 'Actions';
  actionsTitle.style.cssText = `
    padding: 16px 16px 8px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.5);
  `;
  sidebar.appendChild(actionsTitle);

  const actionRow = document.createElement('div');
  actionRow.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0 12px 16px;
  `;

  const previewBtn = document.createElement('button');
  previewBtn.innerText = 'Preview Personalized';
  previewBtn.style.cssText = `
    padding: 8px 12px;
    border-radius: 6px;
    border: none;
    background: #d9ff00;
    color: #000;
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  `;
  previewBtn.addEventListener('click', () => {
    renderCanvasPreview();
    showToast('Preview updated');
  });
  actionRow.appendChild(previewBtn);

  const exportBtn = document.createElement('button');
  exportBtn.innerText = 'Export HTML';
  exportBtn.style.cssText = `
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.04);
    color: #fff;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  `;
  exportBtn.addEventListener('click', exportCanvasHtml);
  actionRow.appendChild(exportBtn);

  const clearBtn = document.createElement('button');
  clearBtn.innerText = 'Clear Canvas';
  clearBtn.style.cssText = `
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid rgba(239,68,68,0.3);
    background: rgba(239,68,68,0.08);
    color: #fca5a5;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  `;
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear all elements from the canvas?')) {
      elements.length = 0;
      renderCanvas();
    }
  });
  actionRow.appendChild(clearBtn);
  sidebar.appendChild(actionRow);

  main.appendChild(sidebar);

  // ─── Canvas Area ────────────────────────────────────────────────────────
  const canvasWrapper = document.createElement('div');
  canvasWrapper.className = 'dom-canvas-wrapper';
  canvasWrapper.style.cssText = `
    flex: 1;
    overflow: auto;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 24px;
    background:
      radial-gradient(circle at 20px 20px, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 20px 20px;
  `;

  const canvasFrame = document.createElement('div');
  canvasFrame.className = 'dom-canvas-frame';
  canvasFrame.style.cssText = `
    position: relative;
    box-shadow: 0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08);
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
    background: #0b0f17;
  `;

  const canvasEl = document.createElement('div');
  canvasEl.className = 'dom-canvas';
  canvasEl.style.cssText = `
    position: relative;
    width: 1280px;
    height: 720px;
    background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%);
    overflow: hidden;
  `;

  // Drop handling
  canvasFrame.addEventListener('dragover', (e) => {
    e.preventDefault();
    canvasFrame.style.outline = '2px dashed rgba(255,255,255,0.25)';
  });
  canvasFrame.addEventListener('dragleave', () => {
    canvasFrame.style.outline = '';
  });
  canvasFrame.addEventListener('drop', (e) => {
    e.preventDefault();
    canvasFrame.style.outline = '';
    const type = e.dataTransfer.getData('application/x-dom-element');
    if (!type) return;
    const rect = canvasEl.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    addElement(type, x, y);
  });

  canvasFrame.appendChild(canvasEl);
  canvasWrapper.appendChild(canvasFrame);
  main.appendChild(canvasWrapper);

  // ─── Right Properties Panel ─────────────────────────────────────────────
  const propertiesPanel = document.createElement('aside');
  propertiesPanel.className = 'dom-properties-panel';
  propertiesPanel.style.cssText = `
    width: 280px;
    background: rgba(0,0,0,0.25);
    border-left: 1px solid rgba(255,255,255,0.06);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex-shrink: 0;
  `;
  main.appendChild(propertiesPanel);

  container.appendChild(main);

  // ─── State ──────────────────────────────────────────────────────────────
  let elements = [];
  let selectedElementId = null;
  let canvasWidth = 1280;
  let canvasHeight = 720;
  let personalizeReady = false;

  // Best-effort personalization bootstrap; the studio must remain usable even
  // if the shared personalization stack is unavailable in this runtime.
  try {
    if (typeof getActiveProfile === 'function' && typeof listProfiles === 'function') {
      const profiles = listProfiles();
      const active = getActiveProfile();
      personalizeReady = true;
      if (contactSelect && profiles.length > 0) {
        contactSelect.value = active?.id || '';
      }
    }
  } catch (err) {
    console.warn('[Personalizer] personalization bootstrap failed:', err);
  }

  if (!personalizeReady && contactSelect) {
    contactSelect.disabled = true;
    contactSelect.value = '';
  }

  // ─── Element management ─────────────────────────────────────────────────
  function addElement(type, x = 20, y = 20) {
    const id = generateId();
    const defaults = DEFAULT_ELEMENT_STYLES[type] || {};
    const el = {
      id,
      type,
      x: clamp(x, 0, 95),
      y: clamp(y, 0, 95),
      width: defaults.width || 200,
      height: defaults.height || 100,
      ...defaults,
    };
    elements.push(el);
    selectedElementId = id;
    appendElementNode(el);
    renderPropertiesPanel();
  }

  function removeElement(id) {
    elements = elements.filter((e) => e.id !== id);
    if (selectedElementId === id) selectedElementId = null;
    const existing = canvasEl.querySelector(`[data-id="${id}"]`);
    if (existing) existing.remove();
    renderPropertiesPanel();
  }

  function updateElement(id, patch) {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    Object.assign(el, patch);
    updateElementDOM(id);
    renderPropertiesPanel();
  }

  function getElementById(id) {
    return elements.find((e) => e.id === id) || null;
  }

  // ─── Canvas rendering ────────────────────────────────────────────────────
  function renderCanvas() {
    canvasEl.innerHTML = '';
    elements.forEach((el) => appendElementNode(el));
  }

  function appendElementNode(el) {
    const wrapper = document.createElement('div');
    wrapper.className = 'dom-element-wrapper';
    wrapper.dataset.id = el.id;
    applyElementWrapperStyle(wrapper, el);

    const contentEl = renderElementContent(el);
    wrapper.appendChild(contentEl);

    const resizeHandle = createResizeHandle(el.id, (elementId, wrapper) => {
      const item = elements.find((e) => e.id === elementId);
      if (item) {
        item.width = wrapper.offsetWidth;
        item.height = wrapper.offsetHeight;
      }
      renderPropertiesPanel();
    });
    wrapper.appendChild(resizeHandle);

    const deleteBtn = createDeleteButton(() => removeElement(el.id));
    wrapper.appendChild(deleteBtn);

    wrapper.addEventListener('mouseenter', () => {
      deleteBtn.style.display = 'block';
    });
    wrapper.addEventListener('mouseleave', () => {
      if (selectedElementId !== el.id) deleteBtn.style.display = 'none';
    });

    wrapper.addEventListener('mousedown', (e) => {
      if (e.target === resizeHandle || e.target === deleteBtn) return;
      selectElement(el.id, wrapper);
      startDrag(e, wrapper, el);
    });

    if (el.type === ELEMENT_TYPES.TEXT || el.type === ELEMENT_TYPES.HEADING) {
      wrapper.addEventListener('dblclick', () => {
        const editable = wrapper.querySelector('[contenteditable]');
        if (editable) editable.focus();
      });
    }

    canvasEl.appendChild(wrapper);
  }

  function renderElementContent(el) {
    let contentEl;
    switch (el.type) {
      case ELEMENT_TYPES.HEADING:
      case ELEMENT_TYPES.TEXT:
        contentEl = renderTextElement(el, (text) => updateElement(el.id, { text }));
        break;
      case ELEMENT_TYPES.IMAGE:
        contentEl = renderImageElement(el);
        break;
      case ELEMENT_TYPES.BUTTON:
        contentEl = renderButtonElement(el);
        break;
      case ELEMENT_TYPES.FORM:
        contentEl = renderFormElement(el);
        break;
      case ELEMENT_TYPES.VIDEO:
        contentEl = renderVideoElement(el);
        break;
      case ELEMENT_TYPES.SPACER:
        contentEl = renderSpacerElement(el);
        break;
      case ELEMENT_TYPES.CONTAINER:
        contentEl = renderContainerElement(el);
        break;
      default:
        contentEl = document.createElement('div');
        contentEl.innerText = el.type;
    }

    if (el.type !== ELEMENT_TYPES.TEXT && el.type !== ELEMENT_TYPES.HEADING) {
      contentEl.style.pointerEvents = 'none';
    }
    return contentEl;
  }

  function applyElementWrapperStyle(wrapper, el) {
    wrapper.style.cssText = `
      position: absolute;
      left: ${el.x}%;
      top: ${el.y}%;
      width: ${el.width}px;
      height: ${el.height}px;
      cursor: move;
      user-select: none;
      outline: ${selectedElementId === el.id ? '2px solid rgba(217,255,0,0.6)' : '1px solid rgba(255,255,255,0.08)'};
      outline-offset: 2px;
      z-index: ${selectedElementId === el.id ? 100 : 1};
    `;
  }

  function updateElementDOM(id) {
    const el = elements.find((e) => e.id === id);
    const wrapper = canvasEl.querySelector(`[data-id="${id}"]`);
    if (!el || !wrapper) return;

    applyElementWrapperStyle(wrapper, el);
    wrapper.style.left = `${el.x}%`;
    wrapper.style.top = `${el.y}%`;
    wrapper.style.width = `${el.width}px`;
    wrapper.style.height = `${el.height}px`;

    const contentEl = wrapper.firstElementChild;
    if (!contentEl) return;

    if (el.type === ELEMENT_TYPES.TEXT || el.type === ELEMENT_TYPES.HEADING) {
      if (contentEl.innerText !== el.text) contentEl.innerText = el.text || '';
      contentEl.style.fontSize = `${el.fontSize || 16}px`;
      contentEl.style.fontFamily = `${el.fontFamily || 'Inter, sans-serif'}`;
      contentEl.style.fontWeight = `${el.fontWeight || 400}`;
      contentEl.style.color = `${el.color || '#ffffff'}`;
      contentEl.style.backgroundColor = `${el.backgroundColor || 'transparent'}`;
      contentEl.style.padding = `${el.padding || 8}px`;
      contentEl.style.borderRadius = `${el.borderRadius || 0}px`;
    } else if (el.type === ELEMENT_TYPES.IMAGE) {
      contentEl.src = el.src || '';
      contentEl.style.borderRadius = `${el.borderRadius || 0}px`;
    } else if (el.type === ELEMENT_TYPES.BUTTON) {
      contentEl.innerText = el.text || 'Button';
      contentEl.href = el.href || '#';
      contentEl.style.background = el.backgroundColor;
      contentEl.style.color = el.color;
      contentEl.style.borderRadius = `${el.borderRadius || 8}px`;
      contentEl.style.fontSize = `${el.fontSize || 14}px`;
      contentEl.style.fontWeight = `${el.fontWeight || 600}`;
    }
  }

  function selectElement(id, wrapper) {
    selectedElementId = id;
    document.querySelectorAll('.dom-element-wrapper').forEach((w) => {
      w.style.outline = '1px solid rgba(255,255,255,0.08)';
      w.style.zIndex = '1';
    });
    if (wrapper) {
      wrapper.style.outline = '2px solid rgba(217,255,0,0.6)';
      wrapper.style.zIndex = '100';
      if (wrapper._previewOriginalText !== undefined) {
        const contentEl = wrapper.firstElementChild;
        if (contentEl) {
          contentEl.contentEditable = 'true';
          contentEl.innerText = wrapper._previewOriginalText;
        }
        const el = getElementById(id);
        if (el) {
          el.text = wrapper._previewOriginalText;
        }
        delete wrapper._previewOriginalText;
      }
    }
    renderPropertiesPanel();
  }

  function startDrag(e, wrapper, el) {
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = el.x;
    const startTop = el.y;
    const canvasRect = canvasEl.getBoundingClientRect();

    const onMouseMove = (moveEvent) => {
      const dx = ((moveEvent.clientX - startX) / canvasRect.width) * 100;
      const dy = ((moveEvent.clientY - startY) / canvasRect.height) * 100;
      const newX = clamp(startLeft + dx, 0, 95);
      const newY = clamp(startTop + dy, 0, 95);
      el.x = newX;
      el.y = newY;
      wrapper.style.left = `${newX}%`;
      wrapper.style.top = `${newY}%`;
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      renderPropertiesPanel();
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function setCanvasSize(width, height) {
    canvasWidth = width;
    canvasHeight = height;
    canvasEl.style.width = `${width}px`;
    canvasEl.style.height = `${height}px`;
    canvasFrame.style.width = `${width}px`;
    canvasFrame.style.height = `${height}px`;
  }

  // ─── Properties panel ────────────────────────────────────────────────────
  function renderPropertiesPanel() {
    propertiesPanel.innerHTML = '';
    if (!selectedElementId) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding: 24px 16px; color: rgba(255,255,255,0.4); font-size: 13px; text-align: center;';
      empty.innerText = 'Select an element to edit its properties.';
      propertiesPanel.appendChild(empty);
      return;
    }

    const el = getElementById(selectedElementId);
    if (!el) return;

    const title = document.createElement('div');
    title.style.cssText = `
      padding: 16px 16px 8px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(255,255,255,0.5);
    `;
    title.innerText = `${el.type} Properties`;
    propertiesPanel.appendChild(title);

    const form = document.createElement('div');
    form.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 0 12px 16px;
    `;

    const addField = (label, value, onChange, inputType = 'text') => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
      const lbl = document.createElement('label');
      lbl.innerText = label;
      lbl.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.5);';
      const input = document.createElement('input');
      input.type = inputType;
      input.value = value ?? '';
      Object.assign(input.style, {
        width: '100%',
        padding: '6px 8px',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(0,0,0,0.3)',
        color: '#fff',
        fontSize: '12px',
        fontFamily: 'inherit',
      });
      input.addEventListener('input', () => {
        const v = inputType === 'number' ? parseFloat(input.value) : input.value;
        onChange(v);
      });
      row.append(lbl, input);
      form.appendChild(row);
    };

    addField('X (%)', el.x, (v) => updateElement(el.id, { x: clamp(v, 0, 95) }), 'number');
    addField('Y (%)', el.y, (v) => updateElement(el.id, { y: clamp(v, 0, 95) }), 'number');
    addField('Width (px)', el.width, (v) => updateElement(el.id, { width: Math.max(40, v) }), 'number');
    addField('Height (px)', el.height, (v) => updateElement(el.id, { height: Math.max(40, v) }), 'number');

    if (el.text !== undefined) {
      addField('Text', el.text, (v) => updateElement(el.id, { text: String(v) }));
    }
    if (el.src !== undefined) {
      addField('Source URL', el.src, (v) => updateElement(el.id, { src: String(v) }));
    }
    if (el.href !== undefined) {
      addField('Link URL', el.href, (v) => updateElement(el.id, { href: String(v) }));
    }
    if (el.backgroundColor !== undefined) {
      addField('Background', el.backgroundColor, (v) => updateElement(el.id, { backgroundColor: String(v) }));
    }
    if (el.color !== undefined) {
      addField('Color', el.color, (v) => updateElement(el.id, { color: String(v) }));
    }
    if (el.fontSize !== undefined) {
      addField('Font Size', el.fontSize, (v) => updateElement(el.id, { fontSize: v }), 'number');
    }
    if (el.fontFamily !== undefined) {
      addField('Font Family', el.fontFamily, (v) => updateElement(el.id, { fontFamily: String(v) }));
    }
    if (el.fontWeight !== undefined) {
      addField('Font Weight', el.fontWeight, (v) => updateElement(el.id, { fontWeight: v }), 'number');
    }

    // Personalization section
    const personalizeSection = document.createElement('div');
    personalizeSection.style.cssText = `
      margin-top: 8px;
      padding-top: 12px;
      border-top: 1px solid rgba(255,255,255,0.08);
    `;
    const ptTitle = document.createElement('div');
    ptTitle.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.5); margin-bottom: 8px;';
    ptTitle.innerText = 'Tokens in this element';
    personalizeSection.appendChild(ptTitle);

    const tokenInfo = document.createElement('div');
    tokenInfo.style.cssText = 'font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.5;';
    const textContent = [el.text, el.href, el.src].filter(Boolean).join(' ');
    const tokens = inspectPromptTokens(textContent, getActiveProfile());
    if (tokens.resolved.length === 0 && tokens.unresolved.length === 0) {
      tokenInfo.innerText = 'No tokens detected. Insert {{token}} in text or URL fields.';
    } else {
      const lines = [];
      tokens.resolved.forEach(({ token, value }) => {
        lines.push(`✅ ${token} → ${value}`);
      });
      tokens.unresolved.forEach((token) => {
        lines.push(`⚠️ ${token} (unresolved)`);
      });
      tokenInfo.innerText = lines.join('\n');
    }
    personalizeSection.appendChild(tokenInfo);
    form.appendChild(personalizeSection);

    propertiesPanel.appendChild(form);
  }

  // ─── Token insertion into selected element ───────────────────────────────
  function insertTokenIntoSelectedElement(tokenKey) {
    if (!selectedElementId) {
      showToast('Select an element first');
      return;
    }
    const el = getElementById(selectedElementId);
    if (!el) return;
    const token = `{{${tokenKey}}}`;
    if (el.text !== undefined) {
      updateElement(el.id, { text: `${el.text || ''} ${token}` });
    } else if (el.href !== undefined) {
      updateElement(el.id, { href: `${el.href || ''}${token}` });
    } else if (el.src !== undefined) {
      updateElement(el.id, { src: `${el.src || ''}${token}` });
    } else {
      showToast('This element type does not support tokens');
    }
  }

  // ─── Preview rendering ───────────────────────────────────────────────────
  function renderCanvasPreview() {
    const profile = getActiveProfile();
    if (!profile) {
      showToast('No contact selected — showing base content');
    }
    const variables = buildVariables(profile || {});

    elements.forEach((el) => {
      const wrapper = canvasEl.querySelector(`[data-id="${el.id}"]`);
      if (!wrapper) return;

      // Resolve text content
      if (el.text !== undefined) {
        const resolved = replaceTokensInPrompt(el.text, { variables });
        const contentEl = wrapper.firstElementChild;
        if (contentEl) {
          wrapper._previewOriginalText = el.text || '';
          contentEl.contentEditable = 'false';
          contentEl.innerText = resolved;
        }
      }
      // Resolve href
      if (el.href !== undefined) {
        const resolved = replaceTokensInPrompt(el.href, { variables });
        const anchor = wrapper.querySelector('a');
        if (anchor) anchor.href = resolved;
      }
      // Resolve image src
      if (el.src !== undefined && el.type === ELEMENT_TYPES.IMAGE) {
        const resolved = replaceTokensInPrompt(el.src, { variables });
        const img = wrapper.querySelector('img');
        if (img && resolved) img.src = resolved;
      }
    });
  }

  // ─── Export ──────────────────────────────────────────────────────────────
  function exportCanvasHtml() {
    const profile = getActiveProfile();
    const variables = buildVariables(profile || {});
    const canvasStyle = `
      position: relative;
      width: ${canvasWidth}px;
      height: ${canvasHeight}px;
      background: #0b0f17;
      overflow: hidden;
      margin: 0 auto;
      font-family: Inter, sans-serif;
    `;

    let body = '';
    elements.forEach((el) => {
      const resolvedText = el.text !== undefined ? replaceTokensInPrompt(el.text, { variables }) : '';
      const resolvedHref = el.href !== undefined ? replaceTokensInPrompt(el.href, { variables }) : '';
      const resolvedSrc = el.src !== undefined ? replaceTokensInPrompt(el.src, { variables }) : '';

      switch (el.type) {
        case ELEMENT_TYPES.HEADING:
          body += `<h1 style="position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}px;height:${el.height}px;font-size:${el.fontSize}px;font-weight:${el.fontWeight || 700};color:${el.color};background:${el.backgroundColor};padding:${el.padding}px;border-radius:${el.borderRadius}px;margin:0;">${escapeHtml(resolvedText)}</h1>`;
          break;
        case ELEMENT_TYPES.TEXT:
          body += `<p style="position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}px;height:${el.height}px;font-size:${el.fontSize}px;font-family:${el.fontFamily};color:${el.color};background:${el.backgroundColor};padding:${el.padding}px;border-radius:${el.borderRadius}px;margin:0;line-height:1.4;">${escapeHtml(resolvedText)}</p>`;
          break;
        case ELEMENT_TYPES.IMAGE:
          if (resolvedSrc) body += `<img src="${escapeHtml(resolvedSrc)}" style="position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}px;height:${el.height}px;object-fit:${el.objectFit};border-radius:${el.borderRadius}px;" />`;
          break;
        case ELEMENT_TYPES.BUTTON:
          body += `<a href="${escapeHtml(resolvedHref || '#')}" style="position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}px;height:${el.height}px;display:inline-flex;align-items:center;justify-content:center;background:${el.backgroundColor};color:${el.color};border-radius:${el.borderRadius}px;text-decoration:none;font-size:${el.fontSize}px;font-weight:${el.fontWeight || 600}px;">${escapeHtml(resolvedText || el.text)}</a>`;
          break;
        case ELEMENT_TYPES.FORM: {
          const fields = (el.fields || '').split(',').map((f) => f.trim()).filter(Boolean);
          let formHtml = `<div style="position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}px;background:${el.backgroundColor};border-radius:${el.borderRadius}px;padding:${el.padding}px;display:flex;flex-direction:column;gap:8px;">`;
          fields.forEach((field) => {
            const inputType = field === 'email' ? 'email' : 'text';
            formHtml += `<input type="${inputType}" placeholder="${field}" style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.25);color:#fff;font-size:13px;box-sizing:border-box;" />`;
          });
          formHtml += `<button type="button" style="margin-top:4px;padding:8px;border-radius:6px;border:none;background:#d9ff00;color:#000;font-weight:600;cursor:pointer;">${escapeHtml(el.submitText || 'Submit')}</button></div>`;
          body += formHtml;
          break;
        }
        case ELEMENT_TYPES.VIDEO:
          if (resolvedSrc) body += `<video src="${escapeHtml(resolvedSrc)}" controls style="position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}px;height:${el.height}px;object-fit:cover;border-radius:${el.borderRadius}px;background:#000;" />`;
          break;
        case ELEMENT_TYPES.SPACER:
          body += `<div style="position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}px;height:${el.height}px;background:${el.backgroundColor || 'transparent'};"></div>`;
          break;
        case ELEMENT_TYPES.CONTAINER:
          body += `<div style="position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}px;height:${el.height}px;background:${el.backgroundColor};border-radius:${el.borderRadius}px;padding:${el.padding}px;border:${el.borderWidth || 1}px solid ${el.borderColor};box-sizing:border-box;"></div>`;
          break;
        default:
          break;
      }
    });

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Personalized Page</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #000; display: flex; justify-content: center; padding: 24px; }
    .dom-canvas { ${canvasStyle} }
  </style>
</head>
<body>
  <div class="dom-canvas">${body || '<div style="color:rgba(255,255,255,0.4);padding:40px;">No elements yet</div>'}</div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      showToast('Popup blocked — please allow popups for this site');
    }
  }

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (!selectedElementId) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      removeElement(selectedElementId);
      showToast('Element deleted');
    }
  });

  // ─── Mount Personalize Trigger ───────────────────────────────────────────
  try {
    mountPersonalizeTrigger({
      controlsContainer: chromeContainer,
      appId: 'personalizer',
      appTheme: 'personalizer',
      getTextarea: () => null,
      onApply: (detail) => {
        const profile = detail?.profile;
        if (!profile) return;
        const activeId = getSelectedContactId();
        if (contactSelect) {
          contactSelect.value = activeId || '';
        }
        renderCanvasPreview();
      },
    });
  } catch (err) {
    console.warn('[Personalizer] personalize trigger failed:', err);
  }

  // Initialize canvas
  renderCanvas();
  renderPropertiesPanel();

  return container;
}

export default Personalizer;
