import useStores from './useStores';

export default () => {
  const { makeStore } = useStores();
  return makeStore;
};
