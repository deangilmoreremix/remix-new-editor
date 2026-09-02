/**
 * SmartVideo Studio — SmartFieldRenderer
 *
 * Renders individual form fields based on their normalized type.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SmartFieldType =
  | 'text'
  | 'textarea'
  | 'negative-prompt'
  | 'image-upload'
  | 'multi-image-upload'
  | 'video-upload'
  | 'audio-upload'
  | 'reference-image'
  | 'first-frame'
  | 'last-frame'
  | 'mask-picker'
  | 'select'
  | 'multi-select'
  | 'slider'
  | 'number'
  | 'toggle'
  | 'seed'
  | 'lora'
  | 'camera-motion'
  | 'duration'
  | 'aspect-ratio'
  | 'resolution'
  | 'quality'
  | 'output-count'
  | 'fps'
  | 'output-format'
  | 'voice'
  | 'repeater'
  | 'unknown';

export interface SmartField {
  key: string;
  rawKey: string;
  normalizedKey: string;
  type: SmartFieldType;
  label: string;
  section: string;
  advanced: boolean;
  required: boolean;
  schema: Record<string, unknown>;
  defaultValue?: unknown;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  repeaterFields?: SmartField[];
  repeaterLabel?: string;
  visibleWhen?: { field: string; value: unknown }[];
}

// ---------------------------------------------------------------------------
// Field Components
// ---------------------------------------------------------------------------

function TextField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      placeholder={field.schema.description ? String(field.schema.description) : `Enter ${field.label}...`}
      className="smart-field-input"
      aria-label={field.label}
    />
  );
}

function TextAreaField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  return (
    <textarea
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      placeholder={field.schema.description ? String(field.schema.description) : `Enter ${field.label}...`}
      className="smart-field-textarea"
      aria-label={field.label}
    />
  );
}

function NegativePromptField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  return (
    <div className="smart-field-negative">
      <textarea
        value={String(value ?? '')}
        onChange={e => onChange(e.target.value)}
        placeholder="Enter negative prompt..."
        className="smart-field-textarea"
        aria-label={field.label}
      />
    </div>
  );
}

function ImageUploadField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'upload' | 'stock' | 'library' | 'url'>('upload');
  const urls = Array.isArray(value) ? value : value ? [String(value)] : [];
  const [urlInput, setUrlInput] = useState('');

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newUrls = Array.from(files).map(f => URL.createObjectURL(f));
    onChange([...urls, ...newUrls]);
  };

  const addUrl = () => {
    if (!urlInput.trim()) return;
    onChange([...urls, urlInput.trim()]);
    setUrlInput('');
  };

  const removeUrl = (idx: number) => {
    onChange(urls.filter((_: unknown, i: number) => i !== idx));
  };

  const isMulti = field.normalizedKey === 'reference_image' || field.normalizedKey === 'multi-image-upload';

  const handleStockSelect = useCallback((asset: { url: string; [key: string]: unknown }) => {
    if (!asset?.url) return;
    if (isMulti) {
      onChange([...urls, asset.url]);
    } else {
      onChange(asset.url);
    }
  }, [isMulti, onChange, urls]);

  return (
    <div className="smart-field-upload">
      <div className="smart-field-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upload'}
          className={`smart-field-tab ${tab === 'upload' ? 'is-active' : ''}`}
          onClick={() => setTab('upload')}
        >
          Upload
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'stock'}
          className={`smart-field-tab ${tab === 'stock' ? 'is-active' : ''}`}
          onClick={() => setTab('stock')}
        >
          Stock
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'library'}
          className={`smart-field-tab ${tab === 'library' ? 'is-active' : ''}`}
          onClick={() => setTab('library')}
        >
          Library
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'url'}
          className={`smart-field-tab ${tab === 'url' ? 'is-active' : ''}`}
          onClick={() => setTab('url')}
        >
          URL
        </button>
      </div>

      {tab === 'upload' && (
        <div
          className="smart-field-upload-zone"
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={e => {
            e.preventDefault();
            e.stopPropagation();
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label={`Upload ${field.label}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple={isMulti}
            onChange={e => handleFiles(e.target.files)}
            className="hidden"
          />
          <div className="smart-field-upload-icon">📁</div>
          <p className="smart-field-upload-text">Drop image or click to upload</p>
        </div>
      )}

      {tab === 'stock' && (
        <div className="smart-field-stock">
          <p className="smart-field-library-hint">Search stock images from Pexels, Pixabay, and Giphy</p>
          <button
            type="button"
            onClick={() => import('../../lib/studioStockMedia.js').then(m => m.browseStockImages({ onSelect: handleStockSelect }))}
            className="smart-btn-secondary"
          >
            Browse Stock Media
          </button>
        </div>
      )}

      {tab === 'library' && (
        <div className="smart-field-library">
          <p className="smart-field-library-hint">Select from your media library</p>
          <div className="smart-field-library-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="smart-field-library-item">
                <div className="smart-field-library-placeholder">IMG {i}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'url' && (
        <div className="smart-field-url">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="smart-field-input"
            onKeyDown={e => e.key === 'Enter' && addUrl()}
          />
          <button type="button" onClick={addUrl} className="smart-btn-secondary" disabled={!urlInput.trim()}>
            Add URL
          </button>
        </div>
      )}

      {urls.length > 0 && (
        <div className="smart-field-upload-preview">
          {urls.map((url, idx) => (
            <div key={idx} className="smart-field-upload-thumb">
              <img src={url} alt={`Upload ${idx + 1}`} />
              <button
                type="button"
                onClick={() => removeUrl(idx)}
                className="smart-field-upload-remove"
                aria-label={`Remove image ${idx + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VideoUploadField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'upload' | 'stock' | 'library' | 'url'>('upload');
  const current = value ? String(value) : '';
  const [urlInput, setUrlInput] = useState('');

  const addUrl = () => {
    if (!urlInput.trim()) return;
    onChange(urlInput.trim());
    setUrlInput('');
  };

  const handleStockSelect = useCallback((asset: { url: string; [key: string]: unknown }) => {
    if (!asset?.url) return;
    onChange(asset.url);
  }, [onChange]);

  return (
    <div className="smart-field-upload">
      <div className="smart-field-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upload'}
          className={`smart-field-tab ${tab === 'upload' ? 'is-active' : ''}`}
          onClick={() => setTab('upload')}
        >
          Upload
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'stock'}
          className={`smart-field-tab ${tab === 'stock' ? 'is-active' : ''}`}
          onClick={() => setTab('stock')}
        >
          Stock
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'library'}
          className={`smart-field-tab ${tab === 'library' ? 'is-active' : ''}`}
          onClick={() => setTab('library')}
        >
          Library
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'url'}
          className={`smart-field-tab ${tab === 'url' ? 'is-active' : ''}`}
          onClick={() => setTab('url')}
        >
          URL
        </button>
      </div>

      {tab === 'upload' && (
        <div
          className="smart-field-upload-zone"
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label={`Upload ${field.label}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            onChange={e => {
              if (e.target.files?.[0]) {
                onChange(URL.createObjectURL(e.target.files[0]));
              }
            }}
            className="hidden"
          />
          <div className="smart-field-upload-icon">🎬</div>
          <p className="smart-field-upload-text">Drop video or click to upload</p>
        </div>
      )}

      {tab === 'stock' && (
        <div className="smart-field-stock">
          <p className="smart-field-library-hint">Search stock videos from Pexels and Pixabay</p>
          <button
            type="button"
            onClick={() => import('../../lib/studioStockMedia.js').then(m => m.browseStockVideos({ onSelect: handleStockSelect }))}
            className="smart-btn-secondary"
          >
            Browse Stock Videos
          </button>
        </div>
      )}

      {tab === 'library' && (
        <div className="smart-field-library">
          <p className="smart-field-library-hint">Select from your media library</p>
          <div className="smart-field-library-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="smart-field-library-item">
                <div className="smart-field-library-placeholder">VID {i}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'url' && (
        <div className="smart-field-url">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://example.com/video.mp4"
            className="smart-field-input"
            onKeyDown={e => e.key === 'Enter' && addUrl()}
          />
          <button type="button" onClick={addUrl} className="smart-btn-secondary" disabled={!urlInput.trim()}>
            Add URL
          </button>
        </div>
      )}

      {current && (
        <video src={current} controls className="smart-field-upload-preview-video" />
      )}
    </div>
  );
}

function AudioUploadField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'upload' | 'library' | 'url'>('upload');
  const current = value ? String(value) : '';
  const [urlInput, setUrlInput] = useState('');

  const addUrl = () => {
    if (!urlInput.trim()) return;
    onChange(urlInput.trim());
    setUrlInput('');
  };

  return (
    <div className="smart-field-upload">
      <div className="smart-field-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upload'}
          className={`smart-field-tab ${tab === 'upload' ? 'is-active' : ''}`}
          onClick={() => setTab('upload')}
        >
          Upload
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'library'}
          className={`smart-field-tab ${tab === 'library' ? 'is-active' : ''}`}
          onClick={() => setTab('library')}
        >
          Library
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'url'}
          className={`smart-field-tab ${tab === 'url' ? 'is-active' : ''}`}
          onClick={() => setTab('url')}
        >
          URL
        </button>
      </div>

      {tab === 'upload' && (
        <div
          className="smart-field-upload-zone"
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label={`Upload ${field.label}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            onChange={e => {
              if (e.target.files?.[0]) {
                onChange(URL.createObjectURL(e.target.files[0]));
              }
            }}
            className="hidden"
          />
          <div className="smart-field-upload-icon">🎵</div>
          <p className="smart-field-upload-text">Drop audio or click to upload</p>
        </div>
      )}

      {tab === 'library' && (
        <div className="smart-field-library">
          <p className="smart-field-library-hint">Select from your media library</p>
          <div className="smart-field-library-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="smart-field-library-item">
                <div className="smart-field-library-placeholder">AUD {i}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'url' && (
        <div className="smart-field-url">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://example.com/audio.mp3"
            className="smart-field-input"
            onKeyDown={e => e.key === 'Enter' && addUrl()}
          />
          <button type="button" onClick={addUrl} className="smart-btn-secondary" disabled={!urlInput.trim()}>
            Add URL
          </button>
        </div>
      )}

      {current && (
        <audio src={current} controls className="smart-field-upload-preview-audio" />
      )}
    </div>
  );
}

function ReferenceImageField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  return <ImageUploadField field={field} value={value} onChange={onChange} />;
}

function FirstFrameField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  return <ImageUploadField field={field} value={value} onChange={onChange} />;
}

function LastFrameField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  return <ImageUploadField field={field} value={value} onChange={onChange} />;
}

function MaskPickerField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  return <ImageUploadField field={field} value={value} onChange={onChange} />;
}

function SelectField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const options = field.options || [];
  return (
    <select
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      className="smart-field-select"
      aria-label={field.label}
    >
      <option value="">Select...</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function MultiSelectField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const selected = Array.isArray(value) ? value : [];
  const options = field.options || [];

  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter((v: string) => v !== opt) : [...selected, opt];
    onChange(next);
  };

  return (
    <div className="smart-field-multiselect">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`smart-field-multiselect-option ${selected.includes(opt) ? 'is-selected' : ''}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function SliderField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const num = typeof value === 'number' ? value : (typeof field.defaultValue === 'number' ? field.defaultValue : 0);
  return (
    <div className="smart-field-slider">
      <input
        type="range"
        min={field.min ?? 0}
        max={field.max ?? 100}
        step={field.step ?? 1}
        value={num}
        onChange={e => onChange(Number(e.target.value))}
        className="smart-field-slider-input"
        aria-label={field.label}
      />
      <span className="smart-field-slider-value">{num}</span>
    </div>
  );
}

function NumberField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  return (
    <input
      type="number"
      value={typeof value === 'number' ? value : ''}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : '')}
      placeholder={String(field.defaultValue ?? '')}
      className="smart-field-input"
      aria-label={field.label}
    />
  );
}

function ToggleField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const checked = Boolean(value);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`smart-field-toggle ${checked ? 'is-on' : ''}`}
    >
      <span className="smart-field-toggle-thumb" />
    </button>
  );
}

function SeedField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const [randomizing, setRandomizing] = useState(false);

  const randomize = () => {
    setRandomizing(true);
    onChange(Math.floor(Math.random() * 4294967295));
    setTimeout(() => setRandomizing(false), 300);
  };

  return (
    <div className="smart-field-seed">
      <input
        type="number"
        value={typeof value === 'number' ? value : ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : '')}
        placeholder="Random"
        className="smart-field-input"
        aria-label={field.label}
      />
      <button
        type="button"
        onClick={randomize}
        className={`smart-field-seed-btn ${randomizing ? 'is-randomizing' : ''}`}
        aria-label="Randomize seed"
      >
        🎲
      </button>
    </div>
  );
}

function LoraField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      placeholder="LoRA model name or URL"
      className="smart-field-input"
      aria-label={field.label}
    />
  );
}

function CameraMotionField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const options = field.options || ['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right'];
  return (
    <select
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      className="smart-field-select"
      aria-label={field.label}
    >
      <option value="">Select motion...</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function DurationField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  return (
    <div className="smart-field-duration">
      <input
        type="number"
        value={typeof value === 'number' ? value : ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : '')}
        min={field.min ?? 1}
        max={field.max ?? 60}
        className="smart-field-input"
        aria-label={field.label}
      />
      <span className="smart-field-unit">sec</span>
    </div>
  );
}

function AspectRatioField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const options = field.options || ['1:1', '16:9', '9:16', '4:3', '3:4'];
  return (
    <div className="smart-field-aspect-ratio">
      <select
        value={String(value ?? '')}
        onChange={e => onChange(e.target.value)}
        className="smart-field-select"
        aria-label={field.label}
      >
        <option value="">Select ratio...</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function ResolutionField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const options = field.options || ['720p', '1080p', '4K'];
  return (
    <select
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      className="smart-field-select"
      aria-label={field.label}
    >
      <option value="">Select resolution...</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function QualityField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const options = field.options || ['standard', 'high', 'ultra'];
  return (
    <select
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      className="smart-field-select"
      aria-label={field.label}
    >
      <option value="">Select quality...</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function OutputCountField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  return (
    <div className="smart-field-output-count">
      <input
        type="number"
        value={typeof value === 'number' ? value : ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : '')}
        min={1}
        max={field.max ?? 4}
        className="smart-field-input"
        aria-label={field.label}
      />
    </div>
  );
}

function FpsField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const options = field.options || ['24', '30', '60'];
  return (
    <select
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      className="smart-field-select"
      aria-label={field.label}
    >
      <option value="">Select FPS...</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function OutputFormatField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const options = field.options || ['mp4', 'webm', 'mov'];
  return (
    <select
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      className="smart-field-select"
      aria-label={field.label}
    >
      <option value="">Select format...</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function VoiceField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const options = field.options || ['male', 'female', 'neutral'];
  return (
    <select
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      className="smart-field-select"
      aria-label={field.label}
    >
      <option value="">Select voice...</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function RepeaterField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  const [items, setItems] = useState<Record<string, unknown>[]>(
    Array.isArray(value) && value.length > 0 ? value as Record<string, unknown>[] : [{}]
  );

  const updateItem = useCallback((index: number, key: string, val: unknown) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: val };
      onChange(next);
      return next;
    });
  }, [onChange]);

  const addItem = useCallback(() => {
    setItems(prev => {
      const next = [...prev, {}];
      onChange(next);
      return next;
    });
  }, [onChange]);

  const removeItem = useCallback((index: number) => {
    setItems(prev => {
      const next = prev.filter((_, i) => i !== index);
      onChange(next);
      return next;
    });
  }, [onChange]);

  return (
    <div className="smart-field-repeater">
      <div className="smart-field-repeater-header">
        <span className="smart-field-label">{field.label}</span>
        <button
          type="button"
          onClick={addItem}
          className="smart-field-repeater-add"
          aria-label={`Add ${field.repeaterLabel || 'item'}`}
        >
          + Add {field.repeaterLabel || 'Item'}
        </button>
      </div>

      {items.map((item, idx) => (
        <div key={idx} className="smart-field-repeater-item">
          <div className="smart-field-repeater-item-header">
            <span>Item {idx + 1}</span>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="smart-field-repeater-remove"
                aria-label={`Remove item ${idx + 1}`}
              >
                Remove
              </button>
            )}
          </div>
          <div className="smart-field-repeater-fields">
            {field.repeaterFields?.map(subField => (
              <SmartFieldRenderer
                key={subField.key}
                field={subField}
                value={item[subField.normalizedKey] ?? subField.defaultValue}
                onChange={(val) => updateItem(idx, subField.normalizedKey, val)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function UnknownField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (val: unknown) => void }) {
  return (
    <div className="smart-field-unknown">
      <input
        type="text"
        value={String(value ?? '')}
        onChange={e => onChange(e.target.value)}
        placeholder={field.rawKey}
        className="smart-field-input"
        aria-label={`${field.label} (unsupported)`}
      />
      <span className="smart-field-unknown-badge">Custom</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field router
// ---------------------------------------------------------------------------

const FIELD_COMPONENTS: Record<SmartFieldType, React.FC<{
  field: SmartField;
  value: unknown;
  onChange: (val: unknown) => void;
}>> = {
  text: TextField,
  textarea: TextAreaField,
  'negative-prompt': NegativePromptField,
  'image-upload': ImageUploadField,
  'multi-image-upload': ImageUploadField,
  'video-upload': VideoUploadField,
  'audio-upload': AudioUploadField,
  'reference-image': ReferenceImageField,
  'first-frame': FirstFrameField,
  'last-frame': LastFrameField,
  'mask-picker': MaskPickerField,
  select: SelectField,
  'multi-select': MultiSelectField,
  slider: SliderField,
  number: NumberField,
  toggle: ToggleField,
  seed: SeedField,
  lora: LoraField,
  'camera-motion': CameraMotionField,
  duration: DurationField,
  'aspect-ratio': AspectRatioField,
  resolution: ResolutionField,
  quality: QualityField,
  'output-count': OutputCountField,
  fps: FpsField,
  'output-format': OutputFormatField,
  voice: VoiceField,
  repeater: RepeaterField,
  unknown: UnknownField,
};

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

export default function SmartFieldRenderer({ field, value, onChange }: {
  field: SmartField;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const Component = FIELD_COMPONENTS[field.type] || UnknownField;
  const coerced = value ?? field.defaultValue;

  return (
    <div className={`smart-field smart-field--${field.type} ${field.advanced ? 'smart-field--advanced' : ''}`}>
      <label className="smart-field-label">
        {field.label}
        {field.required && <span className="smart-field-required">*</span>}
        {field.advanced && <span className="smart-field-advanced-tag">Advanced</span>}
      </label>
      <Component field={field} value={coerced} onChange={onChange} />
    </div>
  );
}
