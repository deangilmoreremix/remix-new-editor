import { useState, useCallback } from 'react';
import { ElementCard } from './element-card';
import { ElementModal } from './element-modal';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'character', label: 'Characters' },
  { id: 'location', label: 'Locations' },
  { id: 'prop', label: 'Props' },
  { id: 'vehicle', label: 'Vehicles' },
];

export function ElementsTab({ elements, onAdd, onUpdate, onDelete }) {
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingElement, setEditingElement] = useState();

  const filtered = filter === 'all'
    ? elements
    : elements.filter((el) => el.type === filter);

  const handleAdd = useCallback(() => {
    setEditingElement(undefined);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((element) => {
    setEditingElement(element);
    setModalOpen(true);
  }, []);

  const handleSave = useCallback((data) => {
    if (editingElement) {
      onUpdate(editingElement.id, data);
    } else {
      onAdd(data);
    }
    setModalOpen(false);
    setEditingElement(undefined);
  }, [editingElement, onAdd, onUpdate]);

  const handleDelete = useCallback(() => {
    if (!editingElement) return;
    onDelete(editingElement.id);
    setModalOpen(false);
    setEditingElement(undefined);
  }, [editingElement, onDelete]);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setEditingElement(undefined);
  }, []);

  return (
    <div className="elements-tab">
      <div className="elements-tab__header">
        <h2 className="elements-tab__title">Elements</h2>
        <button className="elements-tab__add-btn" onClick={handleAdd} type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Element
        </button>
      </div>

      <div className="elements-tab__filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`elements-tab__filter ${filter === f.id ? 'elements-tab__filter--active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="elements-tab__empty">
          <span className="elements-tab__empty-icon">📦</span>
          <span className="elements-tab__empty-text">
            {elements.length === 0
              ? 'Add your first element to get started'
              : 'No elements match this filter'}
          </span>
          {elements.length === 0 && (
            <button className="elements-tab__add-btn" onClick={handleAdd} type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Element
            </button>
          )}
        </div>
      ) : (
        <div className="elements-tab__grid">
          {filtered.map((el) => (
            <ElementCard key={el.id} element={el} onClick={() => handleEdit(el)} />
          ))}
        </div>
      )}

      {modalOpen && (
        <ElementModal
          element={editingElement}
          onSave={handleSave}
          onDelete={editingElement ? handleDelete : undefined}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
