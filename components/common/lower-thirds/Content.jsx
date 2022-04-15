import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import { Waypoint } from 'react-waypoint';

import mediaConstants from '../../../lib/constants/media';
import { showError } from '../../../lib/services/alertService';
import { perPage } from '../../../lib/constants/library';
import { POPCORN_ELEMENT_TYPES } from '../../../lib/constants/popcorn';
import { LOWER_THIRDS_TYPE, LOWER_THIRDS_EVO_TYPE } from '../../../lib/constants/lowerThirds';
import { isValidJsonUrl } from '../../../lib/popcorn/helpers';

import useUserStore from '../../hooks/useUserStore';
import useMediaStore from '../../hooks/useMediaStore';
import useUIStore from '../../hooks/useUIStore';
import useProjectStore from '../../hooks/useProjectStore';


import plusIcon from '../../../public/static/svgImages/plus-circle.svg';

import ContentItem from './ContentItem';
import LottieItem from '../../../lib/lottie/LottieItem';
import FormTextField from '../../form/FormTextField';

const Content = () => {
  const [isLoading, setIsLoading] = useState();
  const [items, setItems] = useState([]);
  const [uploadedItems, setUploadedItems] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFirstFetch, setIsFirstFetch] = useState(true);
  const [newLottieElements, setNewLottieElements] = useState(null);

  const [filesToUpload, setFilesToUpload] = useState();
  const [urlToUpload, setUrlToUpload] = useState();

  const [inputUrl, setInputUrl] = useState('');

  const { secondaryWindowType: activeTab } = useUIStore();
  const { addElement } = useProjectStore();
  const { isSuperAdmin, lowerThirdsEnabled, evolutionLowerThirdEnabled } = useUserStore();
  const {
    uploadMedia,
    getPresets,
    addPreset,
    presetsTLItemsForDelete,
    setPresetsTLForDelete,
    deleteLTPreset,
  } = useMediaStore();

  const isReady = React.useMemo(() => (
    Boolean(filesToUpload && filesToUpload.length)
  ), [filesToUpload]);

  useEffect(() => {
    if (isReady && filesToUpload) {
      const elements = [];
      const elementsIds = [];
      Promise.all(filesToUpload.map(async data => {
        let assetJson;
        const regExp = /cdn.videoremix/gmi;
        if (!urlToUpload || !regExp.test(urlToUpload)) {
          assetJson = await uploadMedia({ data: data.data });
        }

        const previewFile = await fetch(data.preview)
          .then(res => res.blob())
          .then(blob => new File([blob], data.data.name, { type: 'image/png' }));

        const assetPreview = await uploadMedia({ data: previewFile });

        const itemDataUrl = assetJson ? assetJson.url : urlToUpload;
        const item = await addPreset(
          { data: itemDataUrl, preview: assetPreview.url },
          LOWER_THIRDS_TYPE,
        );
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
          setUrlToUpload(null);
        });
    }
  }, [filesToUpload, isReady]);

  useEffect(() => () => {
    if (presetsTLItemsForDelete.length) {
      bulkDeleteItems(true);
    }
  }, []);

  useEffect(() => {
    if (activeTab === LOWER_THIRDS_TYPE) {
      setItems([]);
      if (presetsTLItemsForDelete.length) {
        bulkDeleteItems();
      } else {
        fetchItems(LOWER_THIRDS_TYPE);
      }
    }
  }, [activeTab]);

  const fetchItems = async (currentTab) => {
    if (!currentTab && isFirstFetch) {
      return;
    }
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
      if (lowerThirdsEnabled === true) {
        const data = await getPresets(LOWER_THIRDS_TYPE, currentPage, { _id: { $nin: uploaded } });

        if (data.length) {
          if (currentTab) {
          //   setItems(data);
          //   setIsFirstFetch(false);
          //   // Loading new items when scrolling
          // } else {
          //   setItems([
          //     ...items,
          //     ...data,
          //   ]);
          // }
            setItems((prevState) => [...prevState, ...data]);
            setIsFirstFetch(false);
          }
        }
      }

      if (evolutionLowerThirdEnabled === true) {
        const data2 = await getPresets(LOWER_THIRDS_EVO_TYPE, currentPage, { _id: { $nin: uploaded } });
        if (data2.length) {
          if (currentTab) {
          //   setItems(data2);
          //   setIsFirstFetch(false);
          //   // Loading new items when scrolling
          // } else {
          //   setItems([
          //     ...items,
          //     ...data2,
          //   ]);
          // }
            setItems((prevState) => [...prevState, ...data2]);
          }
        }
      }
      setHasMore(items && items.length === perPage);
    } catch (e) {
      showError('An error occurred while loading items');
    }
  };

  const bulkDeleteItems = (unmount) => {
    deleteLTPreset()
      .then(() => {
        if (!unmount) {
          setItems([]);
        }
      })
      .then(() => {
        if (!unmount) {
          fetchItems(LOWER_THIRDS_TYPE);
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
    item.url = item.data;
    item.type = POPCORN_ELEMENT_TYPES.JSON_ANIMATION;
    return addElement(item);
  };

  const onDelete = (id) => {
    const newItems = items.filter(item => item._id !== id);
    setPresetsTLForDelete(id);
    setItems(newItems);
  };

  const onChangeInput = value => {
    setInputUrl(value);
  };

  const onEnter = () => {
    if (inputUrl && isValidJsonUrl(inputUrl)) {
      setIsLoading(true);
      setUrlToUpload(inputUrl);
    } else {
      showError('Not correct URL');
    }
  };

  return (
    <>
      {isSuperAdmin && (
        <FormTextField
          placeholder="Url"
          value={inputUrl}
          onChange={onChangeInput}
          onEnter={onEnter}
          disabled={isLoading}
        />
      )}

      <div className="lower-thirds-content">
        {isSuperAdmin && (
          <div
            {...getRootProps()}
            className={classnames(
              'lower-thirds-content__item lower-thirds-content__add',
              {
                'lower-thirds-content__add--active': isDragActive,
                'lower-thirds-content__add--disabled': isLoading,
              },
            )}
          >
            <input {...getInputProps()} disabled={isLoading} />
            <SVGInline
              className="stickers-item-plus"
              svg={plusIcon}
              cleanup={['plus']}
            />
            {((newLottieElements && newLottieElements.length > 0) || urlToUpload) && (
              <LottieItem
                items={newLottieElements}
                setFilesToUpload={setFilesToUpload}
                isReady={isReady}
                url={urlToUpload}
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
        {hasMore && <Waypoint topOffset="3%" onEnter={() => fetchItems()} />}
      </div>
    </>
  );
};

export default Content;
