import React from 'react';
import { observer } from 'mobx-react';

import useModalStore from '../../components/hooks/useModalStore';
import { MODAL_CONFIG } from '../../lib/constants/modals';

// MUI-free modal renderer. Reads active modal IDs from modal.store, looks
// each up in MODAL_CONFIG, and renders an overlay + centered panel using the
// same inline-style pattern as the vanilla bootstrap in src/main.js (~line 250).
//
// Deliberately out of scope for this task (logged, not implemented):
//   - header.tabs
//   - themeChange
//   - permission gating (upstream checked hasPermissions here)

const MAX_WIDTH_MAP = {
  md: 960,
  lg: 1280,
  xl: 1920,
  false: 'none',
};

const resolveMaxWidth = (maxWidth) => {
  if (maxWidth === false) return 'none';
  if (maxWidth == null) return 'none';
  const mapped = MAX_WIDTH_MAP[maxWidth];
  return mapped != null ? mapped : 'none';
};

const OVERLAY_STYLE = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  pointerEvents: 'auto',
};

const BACKDROP_STYLE = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0,0,0,0.75)',
  backdropFilter: 'blur(4px)',
};

const CLOSE_BUTTON_STYLE = {
  position: 'absolute',
  top: 12,
  right: 12,
  zIndex: 2,
  width: 32,
  height: 32,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(0,0,0,0.4)',
  color: '#fff',
  fontSize: 18,
  lineHeight: '1',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const HEADER_TITLE_STYLE = {
  margin: 0,
  padding: '20px 56px 12px 24px',
  color: '#fff',
  fontSize: 18,
  fontWeight: 700,
};

const SingleModal = observer(({ config, modalStore }) => {
  const { id, renderer: Renderer, className, maxWidth, header } = config;

  const contentStyle = {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: resolveMaxWidth(maxWidth),
    maxHeight: '88vh',
    overflow: 'auto',
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(180deg,#0b0f1920,#0a0d16f0)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
  };

  // Out-of-scope header features: warn but do not render them.
  if (header && Array.isArray(header.tabs) && header.tabs.length) {
    console.warn(`[ModalContainer] modal "${id}" declares header.tabs — skipped in this task.`);
  }
  if (config.themeChange) {
    console.warn(`[ModalContainer] modal "${id}" declares themeChange — skipped in this task.`);
  }

  const handleClose = React.useCallback(() => {
    modalStore.closeModal(id);
  }, [modalStore, id]);

  if (!Renderer) {
    console.warn(`[ModalContainer] modal "${id}" has no renderer — skipped.`);
    return null;
  }

  return (
    <div style={OVERLAY_STYLE} data-modal-id={id}>
      <div style={BACKDROP_STYLE} onClick={handleClose} />
      <div style={contentStyle} className={className}>
        <button
          type="button"
          aria-label="Close"
          style={CLOSE_BUTTON_STYLE}
          onClick={handleClose}
        >
          &times;
        </button>
        {header && header.title ? <h2 style={HEADER_TITLE_STYLE}>{header.title}</h2> : null}
        <React.Suspense fallback={<div style={{ padding: 32, color: '#fff' }}>Loading…</div>}>
          <Renderer handleClose={handleClose} closeModal={handleClose} options={modalStore.options} />
        </React.Suspense>
      </div>
    </div>
  );
});

const ModalContainer = observer(() => {
  const modalStore = useModalStore();

  if (!modalStore) {
    return null;
  }

  const activeIds = Array.from(modalStore.modalIds);
  if (!activeIds.length) {
    return null;
  }

  return (
    <>
      {activeIds.map((id) => {
        const config = MODAL_CONFIG.find((m) => m.id === id);
        if (!config) {
          console.warn(`[ModalContainer] no MODAL_CONFIG entry for active id "${id}".`);
          return null;
        }
        return <SingleModal key={id} config={config} modalStore={modalStore} />;
      })}
    </>
  );
});

export default ModalContainer;
