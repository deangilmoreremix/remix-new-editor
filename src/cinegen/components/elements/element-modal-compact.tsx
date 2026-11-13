

// [remix] Restored from CineGen commit 93ac07a (the one-page "New Element" modal shown in CineGen's README),
// replaced upstream on 2026-08-30 by the 4-step studio (element-modal.tsx, still available via "Continuity looks…").
// Host edits are marked [remix]: it saves through the same variation model, so cards, Director and Spaces keep working.
import { useState, useCallback, useMemo } from 'react';
import type { Element, ElementType, ElementImage, ElementVariation } from '@cinegen/types/elements';
import { prepareElementReferences } from '@cinegen/lib/cloud/elements'; // [remix]
import { createBaselineVariation } from '@cinegen/lib/elements/variations'; // [remix]
import { ElementImageUpload } from './element-image-upload';
import { ElementGenerate } from './element-generate';
import { ElementDescriptionAssistant } from './element-description-assistant';

const ELEMENT_TYPES: { id: ElementType; label: string }[] = [
  { id: 'character', label: 'Character' },
  { id: 'location', label: 'Location' },
  { id: 'prop', label: 'Prop' },
  { id: 'vehicle', label: 'Vehicle' },
];

function ElementTypeIcon({ type }: { type: ElementType }) {
  if (type === 'character') {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M6.5 19c.6-4 2.4-6 5.5-6s4.9 2 5.5 6" /></svg>;
  }
  if (type === 'location') {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 19 9.2 9l3.2 5 2.1-3.2L20 19H4Z" /><path d="m7.8 11.8 1.5 1 1.3-1.2" /></svg>;
  }
  if (type === 'prop') {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 8.5h14v10H5zM5 8.5l3-4h8l3 4" /><path d="M10 4.5 8.5 8.5M15.5 4.5 14 8.5" /></svg>;
  }
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 15.5v-4l2-4h10l3 4v4H4Z" /><circle cx="7.5" cy="16.5" r="1.8" /><circle cx="16.5" cy="16.5" r="1.8" /><path d="M6 11.5h11" /></svg>;
}

export interface ElementCompactSaveData { // [remix]
  name: string;
  type: ElementType;
  description: string;
  images: ElementImage[];
  variations: ElementVariation[];
  activeVariationId: string;
}

interface ElementModalProps {
  projectId?: string; // [remix]
  element?: Element;
  /** Prefill a new-element form (Create new from a breakdown suggestion). */
  defaults?: { name?: string; type?: ElementType; description?: string };
  onSave: (data: ElementCompactSaveData) => void;
  onDelete?: () => void;
  onClose: () => void;
  /** [remix] Opens CineGen's 4-step studio (continuity looks, voice). */
  onOpenStudio?: (draft: { name: string; type: ElementType; description: string }) => void;
}

export function ElementModalCompact({ projectId, element, defaults, onSave, onDelete, onClose, onOpenStudio }: ElementModalProps) {
  // [remix] Same variation model as the studio: this form edits the active look's reference images.
  const initialVariations = useMemo<ElementVariation[]>(() => {
    if (element?.variations?.length) return element.variations.map((v) => ({ ...v, images: [...v.images] }));
    return [createBaselineVariation(element?.images ?? [], new Date().toISOString(), crypto.randomUUID())];
  }, [element]);
  const [draftId] = useState(() => element?.id ?? crypto.randomUUID());
  const [variations, setVariations] = useState<ElementVariation[]>(initialVariations);
  const activeVariationId = element?.activeVariationId && initialVariations.some((v) => v.id === element.activeVariationId)
    ? element.activeVariationId : initialVariations[0].id;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [name, setName] = useState(element?.name ?? defaults?.name ?? '');
  const [type, setType] = useState<ElementType>(element?.type ?? defaults?.type ?? 'character');
  const [description, setDescription] = useState(element?.description ?? defaults?.description ?? '');
  const [pendingGeneratedImages, setPendingGeneratedImages] = useState<ElementImage[]>([]);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [characterWorkflowState, setCharacterWorkflowState] = useState<'idle' | 'in-progress' | 'ready'>('idle');
  const [activeImageTab, setActiveImageTab] = useState<'upload' | 'generate'>('upload');

  const images = variations.find((v) => v.id === activeVariationId)?.images ?? []; // [remix]
  const setImages = useCallback((update: (prev: ElementImage[]) => ElementImage[]) => {
    setVariations((cur) => cur.map((v) => v.id === activeVariationId ? { ...v, images: update(v.images), updatedAt: new Date().toISOString() } : v));
  }, [activeVariationId]);
  const handleAddImages = useCallback((newImages: ElementImage[]) => {
    setImages((prev) => [...prev, ...newImages]);
    setPendingGeneratedImages([]);
  }, [setImages]);

  const handleRemoveImage = useCallback((imageId: string) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
  }, [setImages]);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    const mergedImages = [...images, ...pendingGeneratedImages].filter((image, index, all) => (
      all.findIndex((candidate) => candidate.id === image.id || candidate.url === image.url) === index
    ));
    // [remix] Persist through the variation model (and make references durable) like the studio does.
    const merged = variations.map((v) => v.id === activeVariationId ? { ...v, images: mergedImages, updatedAt: new Date().toISOString() } : v);
    setSaving(true); setSaveError('');
    try {
      const draft: Element = { id: draftId, name: name.trim(), type, description: description.trim(), voice: element?.voice, images: mergedImages, variations: merged, activeVariationId, createdAt: element?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
      const durable = projectId ? await prepareElementReferences(draft, projectId) : draft;
      onSave({ name: durable.name, type: durable.type, description: durable.description, images: durable.images, variations: durable.variations!, activeVariationId: durable.activeVariationId! });
    } catch (error) { setSaveError(error instanceof Error ? error.message : String(error)); }
    finally { setSaving(false); }
  };

  return (
    <div className="element-modal__backdrop" onClick={onClose}>
      <div className="element-modal" onClick={(e) => e.stopPropagation()}>
        <div className="element-modal__header">
          <h3 className="element-modal__title">{element ? 'Edit Element' : 'New Element'}</h3>
          <button className="element-modal__close" onClick={onClose} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="element-modal__body">
          <div className="element-modal__field">
            <label className="element-modal__label">Name</label>
            <input
              className="element-modal__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Detective Sarah"
            />
          </div>

          <div className="element-modal__field">
            <label className="element-modal__label">Type</label>
            <div className="element-modal__type-grid">
              {ELEMENT_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`element-modal__type-btn ${type === t.id ? 'element-modal__type-btn--active' : ''}`}
                  onClick={() => setType(t.id)}
                >
                  <span><ElementTypeIcon type={t.id} /></span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="element-modal__field">
            <label className="element-modal__label">{type === 'character' ? 'Casting brief' : 'Description'}</label>
            <textarea
              className="element-modal__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === 'character'
                ? 'Describe the person you want to cast: age, appearance, build, presence, and defining features...'
                : 'Describe this element in detail...'}
              rows={3}
            />
            <ElementDescriptionAssistant
              name={name}
              type={type}
              description={description}
              onApply={setDescription}
            />
          </div>

          <div className="element-modal__field">
            <label className="element-modal__label">Reference Images</label>

            <div className="element-modal__image-tabs">
              <button
                type="button"
                className={`element-modal__image-tab ${activeImageTab === 'upload' ? 'element-modal__image-tab--active' : ''}`}
                onClick={() => setActiveImageTab('upload')}
              >
                Upload
              </button>
              <button
                type="button"
                className={`element-modal__image-tab ${activeImageTab === 'generate' ? 'element-modal__image-tab--active' : ''}`}
                onClick={() => setActiveImageTab('generate')}
              >
                Generate
              </button>
            </div>

            {activeImageTab === 'upload' && (
              <ElementImageUpload onUpload={handleAddImages} />
            )}
            {activeImageTab === 'generate' && (
              <ElementGenerate
                elementType={type}
                description={description}
                onGenerated={handleAddImages}
                onPendingGeneratedChange={setPendingGeneratedImages}
                onBusyChange={setGenerationBusy}
                onCharacterWorkflowStateChange={setCharacterWorkflowState}
                referenceImages={images}
              />
            )}

            {images.length > 0 && (
              <div className="element-modal__image-grid">
                {images.map((img) => (
                  <div key={img.id} className="element-modal__image-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="element-modal__image-thumb" />
                    <button
                      type="button"
                      className="element-modal__image-remove"
                      onClick={() => handleRemoveImage(img.id)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {saveError && <p className="director-tab__warn" style={{ margin: '0 20px 8px' }}>{saveError}</p>}
        <div className="element-modal__footer">
          {onOpenStudio && (
            <button type="button" className="element-modal__cancel-btn" onClick={() => onOpenStudio({ name, type, description })} title="Continuity looks and voice (4-step studio)">Continuity looks…</button>
          )}
          {element && onDelete && (
            <button type="button" className="element-modal__delete-btn" onClick={onDelete}>Delete</button>
          )}
          <div className="element-modal__footer-right">
            <button type="button" className="element-modal__cancel-btn" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="element-modal__save-btn"
              onClick={handleSave}
              disabled={!name.trim() || saving || generationBusy || (type === 'character' && activeImageTab === 'generate' && characterWorkflowState === 'in-progress')}
            >
              {generationBusy
                ? 'Generating…'
                : type === 'character' && activeImageTab === 'generate' && characterWorkflowState === 'in-progress'
                  ? 'Finish character sheet'
                  : element ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
