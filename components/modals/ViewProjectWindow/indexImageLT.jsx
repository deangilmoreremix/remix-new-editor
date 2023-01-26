import React, { useCallback, useState } from 'react';

import { perPage } from '../../../lib/constants/library';

import PropTypes from '../../../lib/PropTypes';

import usePresetStore from '../../hooks/usePresetStore';
import useProjectStore from '../../hooks/useProjectStore';
import useUIStore from '../../hooks/useUIStore';
import useModalStore from '../../hooks/useModalStore';
import CreativePreviewModel from '../Creatives/CreativePreviewModel';

import { showError } from '../../../lib/services/alertService';
import Preview from '../../common/projectDataList/Preview';
import { LibrarySpinner } from '../../media/Loader';
import { Waypoint } from 'react-waypoint';

const ViewProjectWindowImageLt = ({ handleClose, fetchItems, title, instantStart, className, query }) => {
  const [items, setItems] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { openModal } = useModalStore();

  const { setPreviewData, updateTime } = usePresetStore();
  const { addData, moveElements } = useProjectStore();
  const { toggleLeftBlock } = useUIStore();
  const [show, setShow] = useState(false);

  const handleSelect = React.useCallback(async (item) => {
    setShow(true);
    let zIndex = 0;
    try {
      let newData = JSON.parse(item.project.data);
      const firstElementType = newData.media[0].tracks[0].trackEvents[0]?.type;
      newData.media[0].tracks.reverse();
      newData.media[0].tracks.forEach(element => {
        if (element.trackEvents.length) {
          element.trackEvents[0].popcornOptions.zindex = ++zIndex;
        }
      });
      newData = JSON.stringify(newData);
      if ((title == "connect form" || "End Screens") && firstElementType == 'sequencer') {
        await setPreview(activeItem.thumbnail)
      }
      await setPreviewData(newData);
      setActiveItem(item);
    } catch (e) {
      showError(e.message);
    }
  }, []);

  const addDataToCanvas = useCallback(async (item) => {
    try {
      let newData = JSON.parse(item.project.data);
      const lastIndexOfTracks = newData.media[0]?.tracks.length - 1;
      newData.media[0].tracks.reverse();
      const firstElementType = newData.media[0].tracks[0].trackEvents[0]?.type;
      newData = JSON.stringify(newData);
      item.project.data = newData;
      await addData(item, true);
      handleClose();
      toggleLeftBlock(false);
      if ((title == "connect form" || "End Screens") && firstElementType == 'sequencer') {
        setTimeout(() => {
          moveElements(0, lastIndexOfTracks);
        }, 2000);
      }
    } catch (e) {
      showError(e.message);
    }
  }, [activeItem, addData]);


  const closeButton = () => {
    toggleLeftBlock(false);
    handleClose();
  };
  React.useEffect(() => {
    getItems();
  }, [query])
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
          query: query,
          page,
          perPage,
        });
        setItems(elements => [...elements, ...results]);
        if (!activeItem) {
          if (results[0]) {
            await setPreviewData(results[0].project.data);
            setPreview(results[0].thumbnail);
            // setActiveItem(results[0]);
          }


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
          <CreativePreviewModel onUseHandler={() => addDataToCanvas(activeItem)} show={show} setShow={setShow} onCancelHadler={() => setActiveItem(null)}   preview={null} activeItem={activeItem} instantStart={instantStart}/>
        }
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
