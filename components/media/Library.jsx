import React, { useState, useRef, useEffect, Fragment } from 'react';
import { useDropzone } from 'react-dropzone';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import { CircleLoader } from 'react-spinners';
import {
  tabItems,
  perPage,
  LIBRARY_TABS,
  LIBRARY_KEYS,
} from '../../lib/constants/library';
import { LOADING_COLOR } from '../../lib/constants/ui';
import mediaConstants from '../../lib/constants/media';
import { MEDIA_TYPES } from '../../lib/constants/popcorn';
import config from '../../config/config';
import { showError } from '../../lib/services/alertService';

import Tabs from '../common/library/Tabs';
import ProviderList from '../common/library/ProviderList';
import LibraryContent from '../common/library/LibraryContent';
import { LibrarySpinner } from './Loader';
import CloseButton from '../common/CloseButton';

import useUIStore from '../hooks/useUIStore';
import useUserStore from '../hooks/useUserStore';
import useMediaStore from '../hooks/useMediaStore';
import useProjectStore from '../hooks/useProjectStore';
import AudioControls from '../common/library/AudioControls';

const Library = observer(() => {
  const uiStore = useUIStore();
  const projectStore = useProjectStore();
  const userStore = useUserStore();

  const {
    secondaryWindowType: activeTab,
    setLibraryType: setActiveTab,
    updateElementInLibrary,
    setUpdateElementInLibrary,
    openSettings,
    toggleRightBlock,
    isTimelineOpen,
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
    defaultProvidersInfo,
  } = useMediaStore();

  // =============== STATE ===============
  const [query, setQuery] = useState('');

  const [activeBtn, setActiveBtn] = useState(LIBRARY_KEYS.USER);
  const [hasMore, setHasMore] = useState(true);

  const [pageNumber, setPageNumber] = useState(1);

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isDisabledUpload, setIsDisabledUpload] = useState(false);

  const [items, setItems] = useState([]);
  const [uploadedItems, setUploadedItems] = useState([]);

  const [volume, setVolume] = useState(72);
  const [activeItem, setActiveItem] = useState(null);

  const inputRef = useRef();
  // =============== STATE ===============

  useEffect(() => () => {
    if (updateElementInLibrary) {
      setUpdateElementInLibrary();
    }
    if (libraryItemsForDelete.length) {
      bulkDeleteItems(true);
    }
  }, []);

  const updateActiveTab = React.useCallback((tab) => {
    if (!isLoading) {
      setActiveTab(tab);
    }
  }, [isLoading, setActiveTab]);
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
      default: {
        return defaultProvidersInfo;
      }
    }
  }, [activeTab, activeBtn, userStore]);

  const handleButtonClick = React.useCallback((element) => {
    if (!isLoading) {
      setActiveBtn(element);
    }
  }, [isLoading]);

  React.useEffect(() => {
    if (libraryItemsForDelete.length) {
      bulkDeleteItems();
    } else {
      fetchItems({ source: activeBtn });
    }
  }, [activeBtn, activeTab]);

  const fetchItems = async ({ source = activeBtn, queryStr = query || '', isScrolling = false }) => {
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
    if (!listProviders[source]) {
      source = LIBRARY_KEYS.USER;
      setActiveBtn(source);
    }

    try {
      const data = await getAssets({
        providerName: source,
        assetType: activeTab,
        page: currentPage,
        query: queryStr,
        filter: { _id: { $nin: uploaded } },
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
              fileType = item;
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
            if (format === extension) {
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

  const { getInputProps } = useDropzone({
    accept: mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled: false,
  });
  // === Drag and Drop ===

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      bulkDeleteItems(null, query);
    }
  };

  const handleSetFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const onSelect = async (item) => {
    if (isLoading) {
      return;
    }
    item.src = item.src || item.url;
    item.type = MEDIA_TYPES[activeTab];
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
        showError(e.message);
      } finally {
        setIsLoading(false);
        setIsInitialLoading(false);
      }
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
      .catch(e => showError(`Error while deleting items, ${e}`));
  };

  const renderSidebar = React.useCallback(() => {
    switch (activeTab) {
      case LIBRARY_TABS.AUDIO: return (
        <div className="library__audio-toolbar">
          <ProviderList
            activeItem={activeBtn}
            title={Object.keys(tabItems).length ? tabItems[activeTab].find : ''}
            userContentTitle={tabItems[activeTab].label}
            handleButtonClick={handleButtonClick}
            list={listProviders}
          />
          <AudioControls
            selected={activeItem}
            volume={volume}
            setVolume={setVolume}
          />
        </div>
      );
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
  }, [activeTab, activeBtn, volume, activeItem, listProviders, isLoading]);

  return (
    <div className={classnames('library', `library-${activeTab.toLowerCase()}`, { 'big-window': !isTimelineOpen })}>
      <Tabs setActiveTab={updateActiveTab} activeTab={activeTab} />
      <div className="library__body">
        <div className="library__row library__row-first">
          <div>
            <div className="library__add-file">
              <input id="add-file" {...getInputProps()} disabled={isDisabledUpload} />
              <label htmlFor="add-file" className="library__add">
                {
                  isDisabledUpload ? <LibrarySpinner /> : `Add ${tabItems[activeTab].label}`
                }
              </label>
            </div>
          </div>
          <div className="library__block">
            {
              activeBtn !== LIBRARY_KEYS.DROPMOCK && (
                <Fragment>
                  <input
                    className="library__search"
                    type="text"
                    value={query}
                    ref={inputRef}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleSearch}
                  />
                  {!query && (
                    <button
                      className="library__placeholder"
                      onClick={handleSetFocus}
                    >
                      {tabItems[activeTab].search.label}
                      <span>{tabItems[activeTab].search.subLabel}</span>
                    </button>
                  )}
                </Fragment>
              )
            }
          </div>
        </div>

        <div className="library__row library__row-second">
          {renderSidebar()}
          {isInitialLoading
            ? (
              <div className="library__items">
                <CircleLoader
                  size={100}
                  css={{ margin: 'auto' }}
                  loading
                  color={LOADING_COLOR}
                />
              </div>
            )
            : (
              <LibraryContent
                activeItem={activeItem}
                items={items}
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
                volume={volume}
              />
            )}
        </div>
      </div>

      <CloseButton onClick={() => toggleRightBlock(false)} />
    </div>
  );
});


export default Library;
