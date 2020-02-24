import useStores from './useStores';

export default () => {
  const { api } = useStores();
  return api;
};
