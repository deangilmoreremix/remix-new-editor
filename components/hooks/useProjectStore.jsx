import useStores from './useStores';

export default () => {
  const { projectStore } = useStores();
  return projectStore;
};
