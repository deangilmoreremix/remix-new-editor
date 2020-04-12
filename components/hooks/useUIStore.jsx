import useStores from './useStores';

export default () => {
  const { uiStore } = useStores();
  return uiStore;
};
