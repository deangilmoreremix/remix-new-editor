import useStores from './useStores';

export default () => {
  const stores = useStores();
  return stores.socketStore;
};
