import useStores from './useStores';

export default () => {
  const { common } = useStores();
  return common;
};
