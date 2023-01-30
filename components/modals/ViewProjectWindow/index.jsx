import React, { useCallback, useState } from 'react';

import { perPage } from '../../../lib/constants/library';

import PropTypes from '../../../lib/PropTypes';

import usePresetStore from '../../hooks/usePresetStore';
import useProjectStore from '../../hooks/useProjectStore';
import useUserStore from '../../hooks/useUserStore';
import useUIStore from '../../hooks/useUIStore';
import { Waypoint } from 'react-waypoint';
import { LibrarySpinner } from '../../media/Loader';

import { showError } from '../../../lib/services/alertService';

import List from '../../common/projectDataList/List';
import Preview from '../../common/projectDataList/Preview';
import CloseButton from '../../common/CloseButton';
import CreativePreviewModel from '../Creatives/CreativePreviewModel';

const ViewProjectWindow = ({ handleClose, fetchItems, title, instantStart, fetchItemsEvolution, query, className }) => {
  const [items, setItems] = useState([]);
  const [activeItem, setActiveItem] = useState();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [preview, setPreview] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [show,setShow] = React.useState(false);
  const userStore = useUserStore();
  const { toggleLeftBlock } = useUIStore();


  const { presetsEnabled, evolutionPresetEnabled } = userStore;
  const { setPreviewData, updateTime } = usePresetStore();
  const { addData } = useProjectStore();

  const handleSelect = React.useCallback(async (item) => {
    setShow(true);
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
    } catch (e) {
      showError(e.message);
    }
  }, []);

  const addDataToCanvas = useCallback(async () => {
    try {
      let newData = JSON.parse(activeItem.project.data);
      newData.media[0].tracks.reverse();
      newData = JSON.stringify(newData);
      activeItem.project.data = newData;

      await addData(activeItem, true);
      handleClose();
      toggleLeftBlock(false);
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
        let results = []
        let resultsEvolutions = []
        if (presetsEnabled === true) {
          results = await fetchItems({
            query: '',
            page,
            perPage,
          });
        }
        if (evolutionPresetEnabled === true) {
          resultsEvolutions = await fetchItemsEvolution({
            query: '',
            page,
            perPage,
          });
        }
        let presetsLT = results.concat(resultsEvolutions);
        setItems((elements) => [...elements, ...presetsLT]);

        // if (!activeItem) {
          // console.log(items);
          // await setPreviewData(items[0].project.data);
          // setPreview(items[0].thumbnail);
          // setActiveItem(items[0]);
          // setItems(elements => {
          //   setPreviewData(elements[0].project.data);
          //   setPreview(elements[0].thumbnail);
          //   setActiveItem(elements[0]);
          //   return [...elements];
          // });
        // }
        if (results || resultsEvolutions) {
          const hasNextPage = results.length || resultsEvolutions.length === perPage;
          setHasMore(hasNextPage);

          if (hasNextPage) {
            setPage(page + 1);
          }
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
          <CreativePreviewModel onUseHandler={() => addDataToCanvas(activeItem)} show={show} setShow={setShow} onCancelHadler={() => setActiveItem(null)} preview={null} activeItem={activeItem} instantStart={instantStart} />
        }
      </div>
    </div>
  );
};

ViewProjectWindow.propTypes = {
  handleClose: PropTypes.func.isRequired,
  fetchItems: PropTypes.func.isRequired,
  fetchItemsEvolution: PropTypes.func.isRequired,
  title: PropTypes.string,
  instantStart: PropTypes.bool,
};

export default ViewProjectWindow;
