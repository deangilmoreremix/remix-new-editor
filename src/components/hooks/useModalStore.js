import { useContext } from 'react';
import { StoreContext, getModalStore } from '../../providers/StoreProvider';

// Returns the shared modal store instance — the exact same singleton that
// `window.openModal` / `window.closeModal` drive (see src/mountModalSystem.jsx).
// Falls back to getModalStore() so it works even outside the React provider tree.
export default function useModalStore() {
  const stores = useContext(StoreContext);
  return stores?.modalStore || getModalStore();
}
