import useStores from './useStores';

export default function useModalStore() {
  const stores = useStores();
  return stores.modalStore;
}
