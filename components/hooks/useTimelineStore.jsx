import useStores from './useStores';

export default () => {
  const { timelineStore } = useStores();
  return timelineStore;
};
