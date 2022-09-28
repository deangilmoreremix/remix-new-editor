import React, { useCallback, useState } from 'react';

import { perPage } from '../../../lib/constants/library';

import PropTypes from '../../../lib/PropTypes';

import usePresetStore from '../../hooks/usePresetStore';
import useProjectStore from '../../hooks/useProjectStore';
import useUIStore from '../../hooks/useUIStore';

import { showError } from '../../../lib/services/alertService';

import List from '../../common/projectDataList/List';
import Preview from '../../common/projectDataList/Preview';
import CloseButton from '../../common/CloseButton';

const ViewProjectWindowImageLt = ({ handleClose, fetchItems, title, instantStart }) => {
  const [items, setItems] = useState([]);
  const [activeItem, setActiveItem] = useState();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [preview, setPreview] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { setPreviewData, updateTime } = usePresetStore();
  const { addData, moveElements} = useProjectStore();
  const { toggleLeftBlock } = useUIStore();

  const handleSelect = React.useCallback(async (item) => {
    let zIndex = 0;
    try {
      let newData = JSON.parse(item.project.data);
      newData.media[0].tracks.reverse();
      newData.media[0].tracks.forEach(element => {
        if (element.trackEvents.length) {
          element.trackEvents[0].popcornOptions.zindex = ++zIndex;
        }
      });
      newData = JSON.stringify(newData);

      await setPreviewData(newData);
      setPreview(item.thumbnail);
      setActiveItem(item);
      updateTime(0);
    } catch (e) {
      showError(e.message);
    }
  }, []);

  const addDataToCanvas = useCallback(async () => {
    try {
      let newData = JSON.parse(activeItem.project.data);
      const firstElementType = newData.media[0].target;
      newData.media[0].tracks.reverse();
      newData = JSON.stringify(newData);
      activeItem.project.data = newData;
      await addData(activeItem, true);
      handleClose();
      toggleLeftBlock(false);
      if(title == "connect form" &&  firstElementType == 'video') {
        setTimeout(() => {
          moveElements(0,2);
        }, 1000);
      }
    } catch (e) {
      showError(e.message);
    }
  }, [activeItem, addData]);


  const closeButton = () => {
    toggleLeftBlock(false);
    handleClose();
  };

  const resetParams = useCallback(() => {
    setPage(1);
    setHasMore(true);
    setItems([]);
  }, []);

  const getItems = async (reset = false) => {
    if (reset) {
      resetParams();
    }

    if (hasMore) {
      setIsLoading(true);
      try {
        const results = await fetchItems({
          query: '',
          page,
          perPage,
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
      getItems();
    }
  }, [page]);

  const uploadNewItems = () => {
    if (page !== 1) {
      getItems();
    }
  };

  return (
    <div className="view-project-window">
      <div className="flex">
        <p className="view-project-window__header">{title}</p>
        <CloseButton className="close-button" onClick={closeButton} />
      </div>
      <div className="view-project-window__body">
        <div className="view-project-window__container">
          <List
            items={items}
            hasMore={hasMore}
            uploadNewItems={uploadNewItems}
            handleSelect={handleSelect}
            activeItem={activeItem}
            isLoading={isLoading}
          />
        </div>
        <div className="view-project-window__control">
          <Preview
            preview={preview}
            activeItem={activeItem}
            instantStart={instantStart}
          />
          <button className="view-project-window__use" onClick={addDataToCanvas}>Use</button>
        </div>
      </div>
    </div>
  );
};

ViewProjectWindowImageLt.propTypes = {
  handleClose: PropTypes.func.isRequired,
  fetchItems: PropTypes.func.isRequired,
  title: PropTypes.string,
  instantStart: PropTypes.bool,
};

export default ViewProjectWindowImageLt;
