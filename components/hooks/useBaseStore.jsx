import useStores from './useStores';

const Store = () => {
  const { baseStore } = useStores();
  return baseStore;
};

export default Store;
