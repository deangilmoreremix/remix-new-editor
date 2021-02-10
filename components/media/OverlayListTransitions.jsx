import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react';

import { JSON_TRANSITION_TABS } from '../../lib/constants/jsonTransition';
import { editorStyles } from '../../lib/constants/editorStyles';

import useUIStore from '../hooks/useUIStore';
import useMakeStore from '../hooks/useMakeStore';
import useProjectStore from '../hooks/useProjectStore';
import usePresetStore from '../hooks/usePresetStore';
import useTimelineStore from '../hooks/useTimelineStore';

import Tabs from '../common/overlay/Tabs';
import CloseButton from '../common/CloseButton';
import { showError } from '../../lib/services/alertService';
import List from '../common/projectDataList/List';
import Preview from '../common/projectDataList/Preview';

const perPage = 12;

const OverlayListTransitions = observer(() => {
  const [items, setItems] = React.useState([]);
  const [activeItem, setActiveItem] = useState();
  const [preview, setPreview] = useState('');
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const { getJsonTransitions } = useMakeStore();
  const { setPreviewData, updateTime } = usePresetStore();
  const { addData, item: { ratio } } = useProjectStore();
  const { timelineHeight } = useTimelineStore();

  const {
    toggleRightBlock,
    secondaryWindowType: activeTab,
    setOverlayType: setActiveTab,
  } = useUIStore();

  useEffect(() => {
    const { width, height } = ratio;
    const newTab = `${width}:${height}`;
    if (newTab === activeTab) {
      return;
    }
    setActiveItem(null);
    setActiveTab(newTab);
    getItems(newTab, true);
  }, [ratio]);

  const previewClass = useMemo(() => {
    const index = activeTab.indexOf(':');
    return `project-data-preview-${activeTab.substr(0, index)}`;
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
      showError(e.message);
    }
  }, [activeItem, addData]);

  const resetParams = () => {
    setPage(1);
    setHasMore(true);
    setItems([]);
  };

  const getItems = async (tab = activeTab, reset = false) => {
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

        if (page === 1) {
          setItems(results);
          await setPreviewData(results[0].project.data);
          setPreview(results[0].thumbnail);
          setActiveItem(results[0]);
        } else {
          setItems(elements => [...elements, ...results]);
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
      getItems();
    }
  }, [page]);

  const uploadNewItems = () => {
    if (page !== 1) {
      getItems();
    }
  };

  const libraryHeight = useMemo(() => (
    editorStyles.calculateHeight(timelineHeight)
  ), [timelineHeight]);

  return (
    <div style={{ height: libraryHeight }} className="overlay">
      <div className="flex">
        <header className="overlay__header">Overlays</header>
        <CloseButton onClick={() => toggleRightBlock(false)} />
      </div>
      <Tabs activeTab={activeTab} />
      <div className="overlay__body">
        <div className="overlay-container">
          <List
            items={items}
            hasMore={hasMore}
            uploadNewItems={uploadNewItems}
            handleSelect={handleSelect}
            activeItem={activeItem}
            isLoading={isLoading}
          />
        </div>
        <div className="overlay__control">
          <Preview
            preview={preview}
            activeItem={activeItem}
            className={previewClass}
          />
          <button className="overlay__use" onClick={addDataToCanvas}>Use</button>
        </div>
      </div>
    </div>
  );
});

export default OverlayListTransitions;
