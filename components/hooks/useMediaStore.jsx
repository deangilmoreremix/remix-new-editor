import useStores from './useStores';

export default function useMediaStore() {
  const { mediaStore } = useStores();
  return mediaStore;
}
