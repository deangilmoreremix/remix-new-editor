import useStores from './useStores';

const Store = () => {
  const { searchStore } = useStores();
  return searchStore;
};

export default Store;
