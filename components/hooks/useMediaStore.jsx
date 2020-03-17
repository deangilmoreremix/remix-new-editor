import useStores from './useStores';

export default () => {
  const { mediaStore } = useStores();
  return mediaStore;
};
