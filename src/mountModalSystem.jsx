import React from 'react';
import { createRoot } from 'react-dom/client';

import StoreProvider, { getModalStore } from './providers/StoreProvider';
import ModalContainer from './components/ModalContainer';

// Mounts the modal SYSTEM (StoreProvider + ModalContainer) into a dedicated
// React root, separate from the vanilla bootstrap. Open/close is driven
// through modal.store so the render happens via the ModalContainer path.
export default function mountModalSystem() {
  if (document.getElementById('modal-system-root')) {
    return;
  }

  const host = document.createElement('div');
  host.id = 'modal-system-root';
  // Container is inert until a modal renders (overlay sets its own pointer-events).
  host.style.cssText = 'position:relative;z-index:10000;';
  document.body.appendChild(host);

  const root = createRoot(host);
  root.render(
    <StoreProvider>
      <ModalContainer />
    </StoreProvider>,
  );

  // Console/dev handles that go through the SAME store instance the React
  // tree uses, driving the ModalContainer path.
  const store = getModalStore();
  window.openModal = (id, options) => store.openModal(id, options);
  window.closeModal = (id) => store.closeModal(id);
  window.__modalStore = store;
}
