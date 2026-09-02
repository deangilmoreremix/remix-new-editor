import useStores from './useStores';

export default () => {
  const { multiSelectStore } = useStores();
  return multiSelectStore;
};
