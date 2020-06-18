import React, { useState, useRef } from 'react';

import PropTypes from '../../../lib/PropTypes';

import useMakeStore from '../../hooks/useMakeStore';
import usePresetStore from '../../hooks/usePresetStore';
import useProjectStore from '../../hooks/useProjectStore';

import { showError } from '../../../lib/services/alertService';
import PresetsList from './PresetsList';
import PresetsPreview from './PresetsPreview';

const perPage = 12;

const Presets = ({ handleClose }) => {
  const [items, setItems] = useState([]);
  const [activeItem, setActiveItem] = useState();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [preview, setPreview] = useState('');

  const { getPresets } = useMakeStore();
  const { setPreviewData, playPause, updateTime } = usePresetStore();
  const { addData } = useProjectStore();

  const handleSelect = React.useCallback(async (item) => {
    await setPreviewData(item.project.data);
    setPreview(item.thumbnail);
    setActiveItem(item);
    updateTime(0);
    // playPause();
  }, []);

  const addDataToCanvas = () => {
    addData(activeItem);
    handleClose();
  };

  const resetParams = () => {
    setPage(1);
    setHasMore(true);
    setItems([]);
  };

  const getItems = async (reset = false) => {
    if (reset) {
      resetParams();
    }

    if (hasMore) {
      try {
        const results = await getPresets({
          query: '',
          page,
          perPage,
        });

        setItems([...items, ...results]);
        if (!activeItem) {
          await setPreviewData(results[0].project.data);
          setPreview(results[0].thumbnail);
          setActiveItem(results[0]);
          // handleSelect(results[0]);
        }
        const hasNextPage = results.length === perPage;
        setHasMore(hasNextPage);

        if (hasNextPage) {
          setPage(page + 1);
        }
      } catch (e) {
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
    <div className="presets">
      <p className="presets__header">LOWER THIRDS PRESETS</p>
      <div className="presets__body">
        <div className="presets-list-container">
          <PresetsList
            items={items}
            hasMore={hasMore}
            uploadNewItems={uploadNewItems}
            handleSelect={handleSelect}
          />
        </div>
        <div className="presets__control">
          <PresetsPreview
            preview={preview}
            activeItem={activeItem}
          />
          <button className="presets__use" onClick={() => addDataToCanvas()}>Use</button>
        </div>
      </div>
    </div>
  );
};

Presets.propTypes = {
  handleClose: PropTypes.func,
};

export default Presets;
