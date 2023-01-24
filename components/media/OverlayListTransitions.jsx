import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react';

import { JSON_TRANSITION_TABS } from '../../lib/constants/jsonTransition';
import { editorStyles } from '../../lib/constants/editorStyles';

import useUIStore from '../hooks/useUIStore';
import useMakeStore from '../hooks/useMakeStore';
import useProjectStore from '../hooks/useProjectStore';
import usePresetStore from '../hooks/usePresetStore';
import useTimelineStore from '../hooks/useTimelineStore';
import useUserStore from '../hooks/useUserStore';
import { Waypoint } from 'react-waypoint';
import { LibrarySpinner } from './Loader';
import PropTypes from '../../lib/PropTypes';

import Tabs from '../common/overlay/Tabs';
import CloseButton from '../common/CloseButton';
import { showError } from '../../lib/services/alertService';
import List from '../common/projectDataList/List';
import Preview from '../common/projectDataList/Preview';

const perPage = 12;

const OverlayListTransitions = observer(({className, query, handleClose}) => {
  const [items, setItems] = React.useState([]);
  const [activeItem, setActiveItem] = useState();
  const [preview, setPreview] = useState('');
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const { getJsonTransitions, getEvolutionJsonTransitionsOverlay } = useMakeStore();
  const { setPreviewData, updateTime } = usePresetStore();
  const { addData, item: { ratio } } = useProjectStore();
  const { timelineHeight } = useTimelineStore();
  const userStore = useUserStore();
  const { jsonTransitionEnabled, evolutionOverlayEnabled } = userStore;

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
    return `project-data-preview-16`;
  }, []);

  const handleSelect = React.useCallback(async (item) => {
    await setPreviewData(item.project.data);
    setPreview(item.thumbnail);
    setActiveItem(item);
    updateTime(0);
  }, []);

  const addDataToCanvas = useCallback(async (item) => {
    try {
      await setPreviewData(item.project.data);
      setPreview(item.thumbnail);
      setActiveItem(item);
      updateTime(0);
      let newData = JSON.parse(item.project.data);
      newData.media[0].tracks.reverse();
      newData = JSON.stringify(newData);
      item.project.data = newData;

      await addData(item);
      handleClose();
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
        let results = []
        let resultsEvolution = []
        if (jsonTransitionEnabled === true) {

          results = await getJsonTransitions({
            query: query,
            page,
            perPage,
            filter,
          });
          // setItems(elements => [...elements, ...results]);

          // if (page === 1) {
          //   setItems(results);
          //   await setPreviewData(results[0].project.data);
          //   setPreview(results[0].thumbnail);
          //   setActiveItem(results[0]);
          // } else {
          //   setItems(elements => [...elements, ...results]);
          // }
        }

        if (evolutionOverlayEnabled === true) {
          resultsEvolution = await getEvolutionJsonTransitionsOverlay({
            query: query,
            page,
            perPage,
            filter,
          });
          // setItems(elements => [...elements, ...resultsEvolution]);
          // if (page === 1) {
          //   setItems(resultsEvolution);
          //   await setPreviewData(resultsEvolution[0].project.data);
          //   setPreview(resultsEvolution[0].thumbnail);
          //   setActiveItem(resultsEvolution[0]);
          // } else {
          //   setItems(elements => [...elements, ...resultsEvolution]);
          // }
        }

        let transitionOverlay = results.concat(resultsEvolution);
        setItems((elements) => [...elements, ...transitionOverlay]);
        if(results || resultsEvolution){
          const hasNextPage = results.length || resultsEvolution.length === perPage;
          setHasMore(hasNextPage);

          if (hasNextPage) {
            setPage(page + 1);
          }
        }

        // if (page === 1) {
        //   setItems(results);
        //   await setPreviewData(results[0].project.data);
        //   setPreview(results[0].thumbnail);
        //   setActiveItem(results[0]);
        // } else {
        //   setItems(elements => [...elements, ...results]);
        // }

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

  React.useEffect(() => {
    getItems();
  },[query])

  const uploadNewItems = () => {
    if (page !== 1) {
      getItems();
    }
  };

  // const libraryHeight = useMemo(() => (
  //   editorStyles.calculateHeight(timelineHeight)
  // ), [timelineHeight]);

  return (
    <div className='image-lt'>
    <div className={className}>
      {
        items.map((item) => (
          <div key={item._id} className="library-cta-item">
            <div className="inner-wrapper" style={{ backgroundImage: `url(${item.thumbnail})` }}>
              <div className='lt-btn'>
                <div className='action-btn'>
                  <a className="image_lt-use" onClick={() => addDataToCanvas(item)}>Use</a>
                  <a className="image_lt-preview" onClick={(e) => handleSelect(item)}>Preiview</a>
                </div>
                <span className="title">{item.title}</span>
              </div>
            </div>
          </div>
        ))
      }
      {isLoading && hasMore && (
        (
          <tr>
            <td className="billing-history-box__table-custom-td">
              <LibrarySpinner />
            </td>
          </tr>
        ) 
      )}
      {!isLoading && hasMore && <Waypoint bottomOffset="3%" onEnter={uploadNewItems}><span className="project-data-list-waypoint" /></Waypoint>}
    </div>
    <div>

      {activeItem &&
        <div className="preview-image-lt-container">
          <div><p>{activeItem.title}</p></div>

          <Preview
            activeItem={activeItem}
            className={previewClass}
          />
          
          <button className='preview-image-lt-use-button' onClick={() => addDataToCanvas(activeItem)}>
            Use
          </button>
          <button className='preview-image-lt-cancel-button' onClick={() => setActiveItem(null)}>
            Cancel
          </button>
        </div>
      }
    </div>
  </div>
  );
});
OverlayListTransitions.propTypes = {
  instantStart: PropTypes.bool,
};
export default OverlayListTransitions;
