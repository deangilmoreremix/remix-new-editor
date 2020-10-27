import React, { useState, useRef, useEffect } from 'react';
// import { useDropzone } from 'react-dropzone';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SearchIcon from '@material-ui/icons/Search';

import { CircleLoader } from 'react-spinners';
import {
  tabItems,
  perPage,
  LIBRARY_TABS,
  LIBRARY_KEYS,
} from '../../lib/constants/library';
import { LOADING_COLOR, WINDOW_TYPES } from '../../lib/constants/ui';
import { ASSET_TYPES } from '../../lib/constants/media';
import { MEDIA_TYPES } from '../../lib/constants/popcorn';
// import { URL_RULE } from '../../lib/constants/regExps';
// import { TYPES } from '../../lib/constants/validator';
// import { ALL_VIDEO } from '../../lib/constants/formats';
import config from '../../config/config';
import { showError } from '../../lib/services/alertService';

import { TEXT_TO_SPEECH_WARNING } from '../../lib/constants/text-info';
import Tabs from '../common/library/Tabs';
import ProviderList from '../common/library/ProviderList';
import LibraryContent from '../common/library/LibraryContent';
import { LibrarySpinner } from './Loader';
import CloseButton from '../common/CloseButton';

import useUIStore from '../hooks/useUIStore';
import useUserStore from '../hooks/useUserStore';
import useMediaStore from '../hooks/useMediaStore';
import useProjectStore from '../hooks/useProjectStore';
import useMultiSelectStore from '../hooks/useMultiSelectStore';
import AudioControls from '../common/library/AudioControls';
// import DropPasteInput from './DropPasteInput';

import withModal from '../hoc/withValidation';
import Is360 from '../settings/video-settings/components/Is360';
// import LibraryVoiceFilter from '../common/library/LibraryVoiceFilter';
// import FormTextField from '../form/FormTextField';


const Library = observer((props) => {
  const { setError } = props;
  const uiStore = useUIStore();
  const projectStore = useProjectStore();
  const userStore = useUserStore();
  const multiSelectStore = useMultiSelectStore();

  const {
    addSelectedElement,
    deleteSelectedElement,
    isItemPresent,
    clearAllSelectedItems,
    addAllSelectedItems,
    emptyCollections,
    selectedItemsId,
  } = multiSelectStore;

  const {
    secondaryWindowType: activeTab,
    setLibraryType: setActiveTab,
    updateElementInLibrary,
    setUpdateElementInLibrary,
    openSettings,
    toggleRightBlock,
    isTimelineOpen,
    openSecondaryModal,
    toggleVisibleCanvas,
  } = uiStore;

  const {
    uploadMedia,
    storeAsset,
    getAssets,
    deleteAsset,
    libraryItemsForDelete,
    setLibraryItemsForDelete,
    videoProvidersInfo,
    imageProvidersInfo,
    audioProvidersInfo,
    voiceProvidersInfo,
    defaultProvidersInfo,
  } = useMediaStore();

  const { video360Enabled, isSuperAdmin } = userStore;

  // =============== STATE ===============
  const [isDropMockTab, setDropMockTab] = useState(false);
  const [dropMockKey, setDropMockKey] = useState();
  const [preKeyDropMock, setPreKeyDropMock] = useState();

  const [query, setQuery] = useState('');

  const [activeBtn, setActiveBtn] = useState(LIBRARY_KEYS.USER);
  const [hasMore, setHasMore] = useState(true);

  const [pageNumber, setPageNumber] = useState(1);

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isDisabledUpload, setIsDisabledUpload] = useState(false);
  const [is360, set360] = useState(false);

  const [items, setItems] = useState([]);
  const [uploadedItems, setUploadedItems] = useState([]);

  const [volume, setVolume] = useState(72);
  const [activeItem, setActiveItem] = useState(null);

  const inputRef = useRef();
  const addFileInputRef = useRef();

  // =============== STATE ===============

  // ============ VOICE FILTER ===========
  // const [voice, setVoice] = useState(null);
  // const [language, setLanguage] = useState(null);
  // const [voiceType, setVoiceType] = useState(null);
  // ============ VOICE FILTER ===========

  useEffect(() => () => {
    if (updateElementInLibrary) {
      setUpdateElementInLibrary();
    }
    if (libraryItemsForDelete.length) {
      bulkDeleteItems(true);
    }
  }, []);

  const isVideoTab = React.useMemo(() => activeTab === LIBRARY_TABS.VIDEO, [activeTab]);

  const itemsWithSelect = React.useMemo(() => {
    if (selectedItemsId) {
      const newArr = items.map(item => {
        if (isItemPresent(item)) {
          item.selected = true;
        } else {
          item.selected = false;
        }
        return item;
      });
      return newArr;
    } else {
      return items;
    }
  }, [selectedItemsId.length, items]);

  const showed360 = React.useMemo(() => video360Enabled && isVideoTab,
    [video360Enabled, isVideoTab]);

  const updateActiveTab = React.useCallback((tab) => {
    if (!isLoading) {
      setActiveTab(tab);
    }
  }, [isLoading, setActiveTab]);

  const activeDropMockTab = React.useMemo(
    () => !!((isDropMockTab && preKeyDropMock) || !isDropMockTab), [isDropMockTab, preKeyDropMock]);

  useEffect(() => {
    async function fetchData() {
      await fetchItems({ source: activeBtn, queryStr: '' });
    }
    setQuery('');
    if (activeItem) {
      setActiveItem(null);
    }
    if (libraryItemsForDelete.length) {
      bulkDeleteItems();
    } else {
      fetchData();
    }
  }, [activeTab]);

  const listProviders = React.useMemo(() => {
    switch (activeTab) {
      case LIBRARY_TABS.IMAGE: {
        return imageProvidersInfo;
      }
      case LIBRARY_TABS.VIDEO: {
        return videoProvidersInfo;
      }
      case LIBRARY_TABS.AUDIO: {
        return audioProvidersInfo;
      }
      case LIBRARY_TABS.VOICE: {
        return voiceProvidersInfo;
      }
      default: {
        return defaultProvidersInfo;
      }
    }
  }, [activeTab, activeBtn, userStore]);

  const handleButtonClick = React.useCallback(async (element) => {
    if (element === LIBRARY_KEYS.DROPMOCK) {
      setDropMockTab(true);
      if (isSuperAdmin) {
        setDropMockKey(listProviders.DROPMOCK.apiKey);
        await onKeyEnter(listProviders.DROPMOCK.apiKey);
      }
    } else {
      setDropMockTab(false);
    }
    if (!isLoading) {
      setActiveBtn(element);
    }
  }, [isLoading]);

  useEffect(() => {
    if (activeBtn || activeTab) {
      if (libraryItemsForDelete.length) {
        bulkDeleteItems();
      } else {
        fetchItems({ source: activeBtn });
      }
    }
  }, [activeBtn]);

  const fetchItems = async ({ source = activeBtn, queryStr = query || '', isScrolling = false }) => {
    let currentPage = 0;
    let uploaded = [];
    if (isLoading) {
      return;
    }
    if (isDropMockTab && !dropMockKey) {
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
    if (!listProviders[source]) {
      source = LIBRARY_KEYS.USER;
      setActiveBtn(source);
    }

    let filter;

    if (activeTab === LIBRARY_KEYS.VOICE) {
      filter = source === LIBRARY_KEYS.PERSONALIZED_VOICE
        ? { 'extra.fallbackValue': { $exists: true } }
        : { _id: { $nin: uploaded } };
      // if (language) {
      //   filter['extra.language'] = language;
      //   filter['extra.voice'] = voice;
      //   filter['extra.engine'] = voiceType;
      // }
    } else {
      filter = { _id: { $nin: uploaded } };
    }

    try {
      const data = await getAssets({
        providerName: source,
        assetType: source === LIBRARY_KEYS.PERSONALIZED_VOICE
          ? LIBRARY_KEYS.PERSONALIZED_VOICE : activeTab,
        page: currentPage,
        query: queryStr,
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

  // === Drag and Drop ===
  const onDrop = (acceptedFiles) => {
    const wrongFormat = [];
    const wrongSize = [];
    const files = [];

    if (addFileInputRef.current) {
      addFileInputRef.current.value = '';
    }

    acceptedFiles.forEach(file => {
      const validFormat = Object.keys(tabItems).some(item => tabItems[item]
        .formats
        .some(format => format === file.name.match(/\.[0-9a-z]{1,5}$/)[0]));

      const isImage = tabItems[LIBRARY_TABS.IMAGE].formats.some(format => format === file.name.match(/\.[0-9a-z]{1,5}$/)[0]);
      const isVideo = tabItems[LIBRARY_TABS.VIDEO].formats.some(format => format === file.name.match(/\.[0-9a-z]{1,5}$/)[0]);
      const isAudio = tabItems[LIBRARY_TABS.AUDIO].formats.some(format => format === file.name.match(/\.[0-9a-z]{1,5}$/)[0]);

      if (!validFormat) {
        wrongFormat.push(file);
      } else if (isImage) {
        if (config.image.maxSize < file.size) {
          wrongSize.push(file);
        } else {
          files.push(file);
        }
      } else if (isVideo) {
        if (config.video.maxSize < file.size) {
          wrongSize.push(file);
        } else {
          files.push(file);
        }
      } else if (isAudio) {
        files.push(file);
      }
    });
    const errorFilesText = (errorFiles, text) => `
    Invalid file ${errorFiles.length > 1 ? `${text}s` : `${text}`} with ${errorFiles.length > 1 ? 'names' : 'name'}:
      ${errorFiles.map(file => (` ${file.name}`))}. \\n`;

    const invalidFormatMessage = `${errorFilesText(wrongFormat, 'format')}
      Supported Formats:
      Video: ${tabItems[LIBRARY_TABS.VIDEO].formats.map(format => (` ${format}`))}.
      Image: ${tabItems[LIBRARY_TABS.IMAGE].formats.map(format => (` ${format}`))}.
      Audio: ${tabItems[LIBRARY_TABS.AUDIO].formats.map(format => (` ${format}`))}.
    `;

    const invalidSizeMessage = `${errorFilesText(wrongSize, 'size')}
      Supported Size:
      Image: ${config.image.maxSize / 1024 / 1024} mb.
      Video: ${config.video.maxSize / 1024 / 1024} mb.`;

    if (wrongFormat.length) {
      showError(invalidFormatMessage);
    } else if (wrongSize.length) {
      showError(invalidSizeMessage);
    }

    const elements = [];
    const elementsIds = [];

    if (files.length) {
      setIsDisabledUpload(true);
      Promise.all(files.map(async data => {
        const asset = await uploadMedia({ data });

        const fileExtension = asset.url.match(/\.[0-9a-z]{1,5}$/)[0];
        let fileType = activeTab;
        Object.keys(tabItems).forEach(item => {
          tabItems[item].formats.forEach(format => {
            if (format === fileExtension) {
              if (item === LIBRARY_TABS.VOICE) {
                fileType = LIBRARY_TABS.AUDIO;
              } else {
                fileType = item;
              }
            }
          });
        });

        const item = await storeAsset(asset, fileType);
        elements.push(item);
        elementsIds.push(item._id);
        return fileExtension;
      })).then(fileExtension => {
        const extension = fileExtension[fileExtension.length - 1];

        Object.keys(tabItems).forEach((item, i) => {
          tabItems[item].formats.forEach(format => {
            if (format === extension && item !== LIBRARY_TABS.VOICE) {
              setActiveTab(Object.keys(tabItems)[i]);
            } else {
              setItems([
                ...elements,
                ...items,
              ]);
              setUploadedItems([
                ...uploadedItems,
                ...elementsIds,
              ]);
            }
          });
        });
      }).catch(err => {
        showError(err.message);
      })
        .finally(() => setIsDisabledUpload(false));
    }
  };

  // const onEnter = (url) => {
  //   if (url && !URL_RULE.test(url)) {
  //     url = `${window.location.protocol}//${url}`;
  //   }
  //   const err = checkValue(url, { type: TYPES.URL, isRequired: true });
  //   if (!err) {
  //     return onSelect({ url, is360 });
  //   }
  // };

  const onKeyEnter = async (key) => {
    listProviders.DROPMOCK.apiKey = key || dropMockKey;
    setPreKeyDropMock(key || dropMockKey);
    await fetchItems({ source: activeBtn });
  };

  // const { getInputProps } = useDropzone({
  //   accept: mediaConstants.ACCEPTED_MEDIA_TYPES,
  //   onDrop,
  //   disabled: false,
  // });

  // === Drag and Drop ===

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      bulkDeleteItems(null, query);
    }
  };

  // const handleSetFocus = () => {
  //   if (inputRef.current) {
  //     inputRef.current.focus();
  //   }
  // };

  const toogleSelectItem = (item) => {
    if (isItemPresent(item)) {
      deleteSelectedElement(item);
    } else {
      item.src = item.src || item.url;
      item.type = MEDIA_TYPES[activeTab];
      item.kind = activeTab.toLowerCase();
      item.is360 = is360;
      addSelectedElement(item);
    }
  };

  const onSelect = async (item) => {
    if (isLoading) {
      return;
    }
    item.src = item.src || item.url;
    item.is360 = is360;
    item.type = MEDIA_TYPES[activeTab];
    item.kind = activeTab;
    if (activeTab === LIBRARY_TABS.VOICE) {
      item.type = MEDIA_TYPES.AUDIO;
    } else {
      item.type = MEDIA_TYPES[activeTab];
    }

    if (item.kind === ASSET_TYPES.PERSONALIZED_VOICE) {
      projectStore.showWarning(TEXT_TO_SPEECH_WARNING.title);
    }

    if (updateElementInLibrary && activeTab === LIBRARY_TABS.IMAGE) {
      projectStore.findAndUpdate(updateElementInLibrary, item);
      openSettings();
      setUpdateElementInLibrary();
    } else {
      setIsLoading(true);
      setIsInitialLoading(true);
      try {
        await projectStore.addElement(item);
      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
        setIsInitialLoading(false);
      }
    }
  };

  const onPlay = (item) => {
    setActiveItem(item);
  };

  const addSelectedElements = async () => {
    setIsLoading(true);
    setIsInitialLoading(true);
    try {
      await addAllSelectedItems();
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
      clearAllSelectedItems();
    }
  };

  const onDelete = (id) => {
    const newArr = items.filter(item => item._id !== id);
    setLibraryItemsForDelete(id);
    setItems(newArr);
  };

  const closeLibrary = () => {
    toggleRightBlock(false);
    toggleVisibleCanvas(true);
  };

  const bulkDeleteItems = (unmount, searchText) => {
    deleteAsset()
      .then(() => {
        if (!unmount) {
          setItems([]);
        }
      })
      .then(() => {
        if (!unmount) {
          fetchItems({ source: activeBtn, queryStr: searchText });
        }
      })
      .catch(e => showError(`Error while deleting items, ${e.message}`));
  };

  const renderSidebar = React.useCallback(() => {
    switch (activeTab) {
      case LIBRARY_TABS.AUDIO:
      case LIBRARY_TABS.VOICE: {
        let audioActiveItem = '';
        if (activeTab === LIBRARY_TABS.VOICE && activeBtn === LIBRARY_KEYS.USER) {
          audioActiveItem = LIBRARY_TABS.VOICE;
        } else {
          audioActiveItem = activeBtn;
        }
        return (
          <div style={{ display: 'none' }} className="library__audio-toolbar">
            <ProviderList
              activeItem={audioActiveItem}
              title={Object.keys(tabItems).length ? tabItems[activeTab].find : ''}
              userContentTitle={tabItems[activeTab].label}
              handleButtonClick={handleButtonClick}
              list={listProviders}
            />
            <AudioControls
              selected={audioActiveItem}
              volume={volume}
              setVolume={setVolume}
            />
          </div>
        );
      }
      default: return (
        <ProviderList
          activeItem={activeBtn}
          title={Object.keys(tabItems).length ? tabItems[activeTab].find : ''}
          userContentTitle={tabItems[activeTab].label}
          handleButtonClick={handleButtonClick}
          list={listProviders}
          activeTab={activeTab}
        />
      );
    }
  }, [activeTab, activeBtn, activeItem, listProviders, isLoading, volume]);

  const openVoiceWindow = () => {
    openTextToSpeech(WINDOW_TYPES.TEXT_TO_SPEECH);
  };

  const getCurrentTab = () => {
    if (activeTab === LIBRARY_TABS.AUDIO) {
      return tabItems[activeTab].label.toLowerCase();
    } else {
      return tabItems[activeTab].label.slice(0, -1).toLowerCase();
    }
  };
  return (
    <div className={classnames('library', `library-${activeTab.toLowerCase()}`, { 'big-window': !isTimelineOpen })}>
      <Tabs setActiveTab={updateActiveTab} activeTab={activeTab} />
      <div className="library__body">
        <div className="library__row library__row-first">
          <div className="library__add-title-container">
            {
              activeTab !== LIBRARY_TABS.VOICE ? (
                <span className="library__add">
                  {
                    isDisabledUpload
                      ? <LibrarySpinner />
                      : `Choose your ${getCurrentTab()}`
                  }
                </span>
              ) : (
                // todo Open Voice Modal
                <button className="library__add-file library__open-window" onClick={openVoiceWindow}>
                  <input id="add-file" />
                  <label htmlFor="add-file" className="library__add">
                    Add Voice
                  </label>
                </button>
              )
            }
          </div>
          <div
            className={classnames(
              'library__block',
              {
                'library__block-music': activeTab.toLowerCase() === ASSET_TYPES.AUDIO,
              },
            )}
          >
            {renderSidebar()}
            {activeBtn !== LIBRARY_KEYS.DROPMOCK && (
              <>
                <div className="library__search-container">
                  <div
                    className={classnames(
                      'library__search-box',
                      {
                        'library__search-box-music': activeTab.toLowerCase() === ASSET_TYPES.AUDIO,
                      },
                    )}
                  >
                    <input
                      className="library__search"
                      type="text"
                      value={query}
                      ref={inputRef}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={handleSearch}
                      placeholder="search ..."
                    />
                    <div className="library__search-icon-box">
                      <SearchIcon />
                    </div>
                  </div>
                  <button
                    className={classnames('btn-add', { 'btn-add-disabled': emptyCollections })}
                    onClick={addAllSelectedItems}
                    disabled={emptyCollections}
                  >
                    Add to timeline
                  </button>
                </div>
                {showed360 ? (
                  <Is360
                    value={is360}
                    onChange={() => set360(!is360)}
                    className="flex-end is-360"
                    showHint
                  />
                ) : activeTab.toLowerCase() !== ASSET_TYPES.AUDIO && <div className="library__search-box-dummy" />}
              </>
            )}
          </div>
        </div>
        <div className="library__row library__row-second">
          {isInitialLoading ? (
            <div className="library__items">
              <CircleLoader
                size={100}
                css={{ margin: 'auto' }}
                loading
                color={LOADING_COLOR}
              />
            </div>
          ) : (activeDropMockTab && (
            <LibraryContent
              activeItem={activeItem}
              items={itemsWithSelect}
              onToggleSelect={toogleSelectItem}
              addToTimeLine={addSelectedElements}
              onSelect={onSelect}
              activeBtn={activeBtn}
              activeTab={activeTab}
              onDelete={onDelete}
              onPlay={onPlay}
              fetchItems={fetchItems}
              isDisabledUpload={isDisabledUpload}
              onDrop={onDrop}
              hasMore={hasMore}
              type={activeTab}
            />
          ))}
        </div>
      </div>
      <CloseButton onClick={closeLibrary} />
    </div>
  );
});
export default withModal(Library);
