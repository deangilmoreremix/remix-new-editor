import useStores from './useStores';

export default function useProjectStore() {
  const { projectStore } = useStores();
  return projectStore;
}
