import React, { useCallback, useMemo, useState } from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import { JSON_TRANSITION_TABS } from '../../lib/constants/jsonTransition';

import useUIStore from '../hooks/useUIStore';
import useMakeStore from '../hooks/useMakeStore';
import useProjectStore from '../hooks/useProjectStore';
import usePresetStore from '../hooks/usePresetStore';

import Tabs from '../common/overlay/Tabs';
import CloseButton from '../common/CloseButton';
import { showError } from '../../lib/services/alertService';
import PresetsList from '../modals/Presets/PresetsList';
import PresetsPreview from '../modals/Presets/PresetsPreview';

const perPage = 12;

const JsonTransition = observer(() => {
  const [items, setItems] = React.useState([]);
  const [activeItem, setActiveItem] = useState();
  const [preview, setPreview] = useState('');
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const { getJsonTransitions } = useMakeStore();
  const { setPreviewData, updateTime } = usePresetStore();
  const { addData } = useProjectStore();

  const {
    toggleRightBlock,
    isTimelineOpen,
    secondaryWindowType: activeTab,
    setLibraryType: setActiveTab,
  } = useUIStore();

  const previewClass = useMemo(() => {
    const index = activeTab.indexOf(':');
    return `presets-preview-${activeTab.substr(0, index)}`;
  }, [activeTab]);

  const handleSelect = React.useCallback(async (item) => {
    await setPreviewData(item.project.data);
    setPreview(item.thumbnail);
    setActiveItem(item);
    updateTime(0);
  }, []);

  const addDataToCanvas = useCallback(async () => {
    try {
      let newData = JSON.parse(activeItem.project.data);
      newData.media[0].tracks.reverse();
      newData = JSON.stringify(newData);
      activeItem.project.data = newData;

      await addData(activeItem);
      toggleRightBlock(false);
    } catch (e) {
      await showError(e.message);
    }
  }, [activeItem, addData]);

  const updateActiveTab = useCallback(async (tab) => {
    if (!isLoading) {
      await setActiveTab(tab);
      getItems(tab, true);
    }
  }, [isLoading, setActiveTab]);

  const resetParams = () => {
    setPage(1);
    setHasMore(true);
    setItems([]);
  };

  const getItems = async (tab, reset = false) => {
    if (reset) {
      resetParams();
    }

    let filter;
    Object.keys(JSON_TRANSITION_TABS).forEach(item => {
      if (item === tab) {
        filter = JSON_TRANSITION_TABS[item].data;
      }
    });

    if (hasMore || page === 1) {
      setIsLoading(true);
      try {
        const results = await getJsonTransitions({
          query: '',
          page,
          perPage,
          filter,
        });

        setItems(elements => [...elements, ...results]);
        if (!activeItem) {
          await setPreviewData(results[0].project.data);
          setPreview(results[0].thumbnail);
          setActiveItem(results[0]);
        }
        const hasNextPage = results.length === perPage;
        setHasMore(hasNextPage);

        if (hasNextPage) {
          setPage(page + 1);
        }
        setIsLoading(false);
      } catch (e) {
        setIsLoading(false);
        showError(e.message);
      }
    }
  };

  React.useEffect(() => {
    if (page === 1) {
      getItems(activeTab);
    }
  }, [page]);

  const uploadNewItems = () => {
    if (page !== 1) {
      getItems();
    }
  };

  return (
    <div className={classnames('overlay', { 'big-window': !isTimelineOpen })}>
      <Tabs setActiveTab={updateActiveTab} activeTab={activeTab} />
      <div className="overlay__body">
        <div className="overlay-container">
          <PresetsList
            items={items}
            hasMore={hasMore}
            uploadNewItems={uploadNewItems}
            handleSelect={handleSelect}
            activeItem={activeItem}
            isLoading={isLoading}
          />
        </div>
        <div className="presets__control">
          <PresetsPreview
            preview={preview}
            activeItem={activeItem}
            className={previewClass}
          />
          <button className="presets__use" onClick={addDataToCanvas}>Use</button>
        </div>
      </div>
      <CloseButton onClick={() => toggleRightBlock(false)} />
    </div>
  );
});

export default JsonTransition;
