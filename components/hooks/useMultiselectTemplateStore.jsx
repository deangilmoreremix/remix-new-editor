import useStores from './useStores';

export default () => {
  const { multiSelectTemplateStore } = useStores();
  return multiSelectTemplateStore;
};
