import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import { Waypoint } from 'react-waypoint';
import { observer } from 'mobx-react';

import mediaConstants from '../../../lib/constants/media';
import { showError } from '../../../lib/services/alertService';
import { perPage } from '../../../lib/constants/library';
import { MEDIA_TYPES } from '../../../lib/constants/popcorn';

import useUserStore from '../../hooks/useUserStore';
import useMediaStore from '../../hooks/useMediaStore';
import useUIStore from '../../hooks/useUIStore';
import useProjectStore from '../../hooks/useProjectStore';

import plusIcon from '../../../public/static/svgImages/plus-circle.svg';

import ContentItem from './ContentItem';
import LottieItem from '../../../lib/lottie/LottieItem';

const Content = observer(() => {
  const [isLoading, setIsLoading] = useState();
  const [items, setItems] = useState([]);
  const [uploadedItems, setUploadedItems] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFirstFetch, setIsFirstFetch] = useState(true);
  const [newLottieElements, setNewLottieElements] = useState(null);

  const [filesToUpload, setFilesToUpload] = useState();

  const { secondaryWindowType: activeTab } = useUIStore();
  const { addElement } = useProjectStore();
  const { isSuperAdmin } = useUserStore();
  const {
    uploadMedia,
    getPresets,
    addPreset,
    presetsItemsForDelete,
    setPresetsForDelete,
    deletePreset,
  } = useMediaStore();

  const isReady = React.useMemo(() => (
    Boolean(filesToUpload && filesToUpload.length)
  ), [filesToUpload]);

  useEffect(() => {
    if (isReady && filesToUpload) {
      const elements = [];
      const elementsIds = [];
      Promise.all(filesToUpload.map(async data => {
        const assetJson = await uploadMedia({ data: data.data });

        const previewFile = await fetch(data.preview)
          .then(res => res.blob())
          .then(blob => new File([blob], data.data.name, { type: 'image/png' }));

        const assetPreview = await uploadMedia({ data: previewFile });

        const item = await addPreset({ data: assetJson.url, preview: assetPreview.url }, activeTab);
        elements.push(item);
        elementsIds.push(item._id);
      }))
        .then(() => {
          setItems([
            ...elements,
            ...items,
          ]);
          setUploadedItems([
            ...uploadedItems,
            ...elementsIds,
          ]);
        })
        .catch(e => showError(e.message))
        .finally(() => {
          setIsLoading(false);
          setNewLottieElements(null);
          setFilesToUpload(null);
        });
    }
  }, [filesToUpload, isReady]);

  useEffect(() => () => {
    if (presetsItemsForDelete.length) {
      bulkDeleteItems(true);
    }
  }, []);

  useEffect(() => {
    setIsFirstFetch(true);
    setItems([]);
    if (presetsItemsForDelete.length) {
      bulkDeleteItems();
    } else {
      fetchItems(activeTab);
    }
  }, [activeTab]);

  const fetchItems = async (currentTab) => {
    if (!currentTab && isFirstFetch) {
      return;
    }

    setIsFirstFetch(false);
    let currentPage = 0;
    let uploaded = [];

    if (currentTab) {
      setPageNumber(1);
      setUploadedItems([]);
      currentPage = 1;
    } else {
      currentPage = pageNumber + 1;
      setPageNumber(pageNumber + 1);
      uploaded = uploadedItems;
    }

    try {
      const data = await getPresets(activeTab, currentPage, { _id: { $nin: uploaded } });

      if (data.length) {
        setItems(elements => [...elements, ...data]);
      }
      setHasMore(data && data.length === perPage);
    } catch (e) {
      showError('An error occurred while loading items');
    }
  };

  const bulkDeleteItems = (unmount) => {
    deletePreset()
      .then(() => {
        if (!unmount) {
          setItems([]);
        }
      })
      .then(() => {
        if (!unmount) {
          fetchItems(activeTab);
        }
      })
      .catch(e => showError(`Error while deleting items, ${e.message}`));
  };

  // === Drag and Drop ===
  const onDrop = files => {
    setIsLoading(true);
    setNewLottieElements(files);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: mediaConstants.JSON_CONTENT_TYPE,
    onDrop,
    disabled: false,
  });

  const onSelect = item => {
    item.src = item.data;
    item.type = MEDIA_TYPES.LOTTIE_JSON;
    return addElement(item);
  };

  const onDelete = (id) => {
    const newItems = items.filter(item => item._id !== id);
    setPresetsForDelete(id);
    setItems(newItems);
  };

  return (
    <div className="stickers-content">
      {isSuperAdmin && (
        <div
          {...getRootProps()}
          className={classnames(
            'stickers-content__item stickers-content__add',
            {
              'stickers-content__add--active': isDragActive,
              'stickers-content__add--disabled': isLoading,
            },
          )}
        >
          <input {...getInputProps()} disabled={isLoading} />
          <SVGInline
            className="stickers-item-plus"
            svg={plusIcon}
            cleanup={['plus']}
          />
          {newLottieElements && newLottieElements.length > 0 && (
            <LottieItem
              items={newLottieElements}
              setFilesToUpload={setFilesToUpload}
              isReady={isReady}
            />
          )}
        </div>
      )}

      {
        items.map(item => (
          <ContentItem
            key={item._id}
            item={item}
            onDelete={onDelete}
            onSelect={onSelect}
          />
        ))
      }
      {hasMore && (
        <Waypoint bottomOffset="3%" onEnter={() => fetchItems()} />
      )}
    </div>
  );
});

export default Content;
