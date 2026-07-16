import React from 'react';
import createModalStore from '../../globals/stores/modal.store';

// Plain React context replacement for mobx-react's legacy Provider/inject.
// useStores() reads from this context and expects `stores.modalStore`.
//
// SCOPE: This task instantiates ONLY modal.store. No user store, project
// store, or permission gating is created here yet — those are later tasks.
export const StoreContext = React.createContext(null);

let modalStoreSingleton = null;

const getStores = () => {
  if (!modalStoreSingleton) {
    modalStoreSingleton = createModalStore();
  }
  return { modalStore: modalStoreSingleton };
};

// Exposed so non-React callers (e.g. dev console, vanilla bootstrap) can
// reach the exact same store instance the React tree uses.
export const getModalStore = () => getStores().modalStore;

const StoreProvider = ({ children }) => {
  const stores = React.useMemo(() => getStores(), []);
  return <StoreContext.Provider value={stores}>{children}</StoreContext.Provider>;
};

export default StoreProvider;
