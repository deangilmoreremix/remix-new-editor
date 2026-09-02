import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { CircleLoader } from 'react-spinners';

import { LIBRARY_KEYS, perPage } from '../../../lib/constants/library';
import ProviderList from '../library/ProviderList';
import { MEDIA_TYPES } from '../../../lib/constants/popcorn';
import { ASSET_TYPES } from '../../../lib/constants/media';
import { TEXT_TO_SPEECH_WARNING } from '../../../lib/constants/text-info';
import { LOADING_COLOR } from '../../../lib/constants/ui';

import useMediaStore from '../../hooks/useMediaStore';
import useProjectStore from '../../hooks/useProjectStore';
import useUserStore from '../../hooks/useUserStore';

import LibraryVoiceFilter from '../library/LibraryVoiceFilter';
import TextToSpeechContent from './TextToSpeechContent';
import { showError } from '../../../lib/services/alertService';
import PropTypes from '../../../lib/PropTypes';

const TextToSpeechLibrary = observer(({ addedItems, setAddedItems, kind }) => {
  const {
    voiceProvidersInfo,
    libraryItemsForDelete,
    setLibraryItemsForDelete,
    getAssets,
    updateElementInLibrary,
    setUpdateElementInLibrary,
    deleteAsset,
  } = useMediaStore();

  const { showWarning, addElement } = useProjectStore();
  const { currentUser } = useUserStore();

  // ============ VOICE FILTER ===========
  const [voice, setVoice] = useState(null);
  const [language, setLanguage] = useState(null);
  const [voiceType, setVoiceType] = useState(null);
  const [activeTab, setActiveTab] = useState(kind || LIBRARY_KEYS.VOICE);
  // ============ VOICE FILTER ===========

  const [activeItem, setActiveItem] = useState(null);
  const [items, setItems] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [uploadedItems, setUploadedItems] = useState([]);

  useEffect(() => {
    const pixelOptions = { user_email: currentUser.email };
    if (window && window.fbq) {
      window.fbq('trackCustom', 'TextToSpeech', pixelOptions);
    }
  }, []);

  useEffect(() => () => {
    if (updateElementInLibrary) {
      setUpdateElementInLibrary();
    }
    if (libraryItemsForDelete.length) {
      bulkDeleteItems(true);
    }
  }, []);

  useEffect(() => () => setAddedItems([]), [activeTab]);

  useEffect(() => () => {
    setLanguage(null);
    setActiveTab(kind);
  }, [kind]);

  useEffect(() => {
    if (activeTab) {
      if (libraryItemsForDelete.length) {
        bulkDeleteItems();
      } else {
        fetchItems({ source: activeTab });
      }
    }
  }, [activeTab]);

  const newItems = React.useMemo(() => {
    if (!addedItems || !addedItems.length) {
      return null;
    }
    return addedItems;
  }, [addedItems, addedItems?.length]);

  useEffect(() => () => deleteAsset(true), []);

  const fetchItems = async ({ source = activeTab, isScrolling = false } = {}) => {
    let currentPage = 0;
    let uploaded = [];
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    if (!isScrolling) {
      setIsInitialLoading(true);
      setPageNumber(1);
      setUploadedItems([]);
      currentPage = 1;
      uploaded = [];
    } else {
      currentPage = pageNumber + 1;
      setPageNumber(pageNumber + 1);
      uploaded = uploadedItems;
    }

    const filter = {};
    if (source === LIBRARY_KEYS.PERSONALIZED_VOICE) {
      filter['extra.fallbackValue'] = { $exists: true };
    }
    if (newItems) {
      filter._id = { $nin: uploaded };
    }
    if (language) {
      filter['extra.language'] = language;
      filter['extra.voice'] = voice.value;
      filter['extra.engine'] = voiceType;
    }
    filter.hidden = { $ne: true };

    try {
      const data = await getAssets({
        providerName: source,
        assetType: source,
        page: currentPage,
        filter,
      });

      if (data) {
        if (!isScrolling) {
          setItems(data);
          // Loading new items when scrolling
        } else {
          setItems([
            ...items,
            ...data,
          ]);
        }
      }
      setHasMore(data && data.length === perPage);
    } catch (e) {
      showError('An error occurred while loading items');
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  };

  const onSelect = async (item) => {
    if (isLoading) {
      return;
    }
    item.src = item.src || item.url;
    item.type = MEDIA_TYPES.AUDIO;

    if (item.kind === ASSET_TYPES.PERSONALIZED_VOICE) {
      showWarning(TEXT_TO_SPEECH_WARNING.title);
    }

    setIsLoading(true);
    setIsInitialLoading(true);
    try {
      await addElement(item);
    } catch (e) {
      showError(e.message);
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  };

  const onPlay = (item) => {
    setActiveItem(item);
  };

  const onDelete = (id) => {
    const newArr = items.filter(item => item._id !== id);
    setLibraryItemsForDelete(id);
    setItems(newArr);
  };

  const bulkDeleteItems = (unmount) => {
    deleteAsset(true)
      .then(() => {
        if (!unmount) {
          setItems([]);
        }
      })
      .then(() => {
        if (!unmount) {
          fetchItems({ source: activeTab });
        }
      })
      .catch(e => showError(`Error while deleting items, ${e.message}`));
  };

  const handleButtonClick = React.useCallback((element) => {
    if (!isLoading) {
      setActiveTab(element);
    }
  }, [isLoading]);

  return (
    <div className="text-to-speech__library">
      <div className="text-to-speech__tabs">
        <ProviderList
          activeItem={activeTab || LIBRARY_KEYS.VOICE}
          handleButtonClick={handleButtonClick}
          list={voiceProvidersInfo}
        />
      </div>

      <LibraryVoiceFilter
        language={language}
        setLanguage={setLanguage}
        voice={voice || {}}
        setVoice={setVoice}
        voiceType={voiceType}
        setVoiceType={setVoiceType}
        fetchItems={() => {
          setAddedItems([]);
          return fetchItems();
        }}
        disabled={isInitialLoading}
      />

      {isInitialLoading ? (
        <CircleLoader
          size={100}
          css={{ margin: 'auto' }}
          loading
          color={LOADING_COLOR}
        />
      ) : (
        <TextToSpeechContent
          activeItem={activeItem}
          items={newItems ? [...newItems, ...items] : items}
          onSelect={onSelect}
          activeTab={activeTab}
          onDelete={onDelete}
          onPlay={onPlay}
          fetchItems={fetchItems}
          hasMore={hasMore}
          isLoading={isLoading}
        />
      )}
    </div>
  );
});

TextToSpeechLibrary.propTypes = {
  addedItems: PropTypes.arrayOrObservableArray,
  setAddedItems: PropTypes.func.isRequired,
  kind: PropTypes.string,
};

export default TextToSpeechLibrary;
