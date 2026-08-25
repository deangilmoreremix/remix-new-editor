import useStores from './useStores';

export default () => {
  const { presetStore } = useStores();
  return presetStore;
};
