import React, { useState, useRef } from 'react';

import useMakeStore from '../../hooks/useMakeStore';
import usePresetStore from '../../hooks/usePresetStore';

import { showError } from '../../../lib/services/alertService';
import PresetsList from './PresetsList';
import PresetsPreview from './PresetsPreview';

const perPage = 12;

const Content = () => {
  const [items, setItems] = useState([]);
  const [activeItem, setActiveItem] = useState();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [preview, setPreview] = useState('');

  const { getPresets } = useMakeStore();
  const { setPreviewData, playPause } = usePresetStore();

  const handleSelect = React.useCallback(async (item) => {
    await setPreviewData(item.project.data);
    setPreview(item.thumbnail);
    playPause();
  }, []);


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
          setActiveItem(results[0]);
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
      <PresetsList
        items={items}
        hasMore={hasMore}
        uploadNewItems={uploadNewItems}
        handleSelect={handleSelect}
      />
      <PresetsPreview
        preview={preview}
        activeItem={activeItem}
      />
    </div>
  );
};

export default Content;
