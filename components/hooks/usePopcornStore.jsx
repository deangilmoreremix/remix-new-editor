import useStores from './useStores';

const PopcornStore = () => {
  const { popcornStore } = useStores();
  return popcornStore;
};

export default PopcornStore;
