import React, { useState, useRef, useEffect, Fragment } from 'react';
import { useDropzone } from 'react-dropzone';

import PropTypes from '../../lib/PropTypes';
import { libraryProviders, tabItems } from '../../lib/constants/library';
import useMediaStore from '../hooks/useMediaStore';

import Tabs from '../common/libraryes/Tabs';
import ProviderList from '../common/libraryes/ProviderList';
import LibraryContent from '../common/libraryes/LibraryContent';
import { LibrarySpinner } from './Loader';

import mediaConstants from '../../lib/constants/media';

const Library = (props) => {
  const { providers, label, subLabel, tub } = props;
  // =============== STATE ===============
  const [query, setQuery] = useState('');

  const [activeBtn, setActiveBtn] = useState(Object.keys(providers)[0]);
  const [activeTub, setActiveTub] = useState(tub);

  const [pageNumber, setPageNumber] = useState(1);

  const [isDownloadAllItems, setIsDownloadAllItems] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isDisabledUpload, setIsDisabledUpload] = useState(false);
  const [error, setError] = useState(false);

  const [items, setItems] = useState([]);
  const [deletedItems, setDeletedItems] = useState([]);
  const [uploadedItems, setUploadedItems] = useState([]);

  const inputRef = useRef();
  // =============== STATE ===============

  const { uploadMedia, storeAsset, getAssets, deleteItemAsset } = useMediaStore();

  useEffect(() => {
    setQuery('');
    if (deletedItems.length) {
      onFetchDelete();
    } else {
      loadingItems(activeTub);
    }
  }, [activeTub]);

  const loadingItems = (tab, queryStr = '') => {
    let currentTub = '';
    let currentPage = 0;
    let uploaded = [];
    if (tab) {
      setIsLoading(true);
      setPageNumber(1);
      setUploadedItems([]);
      currentTub = tabItems[tab].text.toLowerCase();
      currentPage = 1;
      uploaded = [];
    } else {
      currentTub = tabItems[activeTub].text.toLowerCase();
      currentPage = pageNumber + 1;
      setPageNumber(state => state + 1);
      uploaded = uploadedItems;
    }
    getAssets(currentTub, currentPage, queryStr, uploaded)
      .then(data => {
        const elements = [];
        if (data.length) {
          setIsDownloadAllItems(false);
          data.forEach(item => {
            const element = {
              id: item._id,
              url: item.url,
            };
            elements.push(element);
          });
          if (tab) {
            setItems(elements);
          // Loading new items when scrolling
          } else {
            setItems([
              ...items,
              ...elements,
            ]);
          }
        } else {
          setIsDownloadAllItems(true);
          setPageNumber(state => state - 1);
        }
      })
      .then(() => setIsLoading(false))
      .catch(() => setError(true));
  };

  // === Drag and Drop ===
  const onDrop = (acceptedFiles) => {
    setIsDisabledUpload(true);
    const elements = [];
    const elementsIds = [];
    Promise.all(acceptedFiles.map(async data => {
      const asset = await uploadMedia({ data, preview: true });
      const item = await storeAsset(asset.url, asset.preview, 'images');
      const fileExtension = item.url.match(/\.[0-9a-z]{1,5}$/)[0];
      elements.push({
        id: item._id,
        url: item.url,
      });
      elementsIds.push(item._id);
      return fileExtension;
    })).then(fileExtension => {
      const extension = fileExtension[fileExtension.length - 1];

      Object.keys(tabItems).forEach((item, i) => {
        tabItems[item].formats.forEach(format => {
          if (format === extension) {
            setActiveTub(Object.keys(tabItems)[i]);
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
    }).catch(err => console.log(err))
      .finally(() => setIsDisabledUpload(false));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled: false,
  });
  // === Drag and Drop ===

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      onFetchDelete(null, query);
    }
  };

  const onFocus = () => {
    inputRef.current.focus();
  };

  const onSelect = (id) => {
    console.log('Select item', id);
  };

  const onDelete = (id) => {
    let index = -1;
    for (let i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        index = i;
        break;
      }
    }
    setItems([
      ...items.slice(0, index),
      ...items.slice(index + 1),
    ]);

    setDeletedItems([
      ...deletedItems,
      items[index].id,
    ]);
  };

  const onFetchDelete = (unmount, searchText) => {
    const promiseArr = [];
    deletedItems.forEach(id => promiseArr.push(deleteItemAsset(id)));
    Promise.all(promiseArr)
      .then(() => {
        if (!unmount) {
          setDeletedItems([]);
          setItems([]);
        }
      })
      .then(() => {
        if (!unmount) {
          loadingItems(activeTub, searchText);
        }
      })
      .catch(() => console.log('Error while deleting items'));
  };

  return (
    <div className="library">
      <Tabs items={tabItems} setActiveTub={setActiveTub} />
      <div className="library__body">
        <div className="library__row library__row-first">
          <div>
            <div className="library__add-file">
              <input id="add-file" {...getInputProps()} disabled={isDisabledUpload} />
              <label htmlFor="add-file" className="library__add">
                {
                  isDisabledUpload ? <LibrarySpinner /> : `Add ${tabItems[activeTub].text}`
                }
              </label>
            </div>
          </div>
          <div className="library__block">
            {
              activeBtn === Object.keys(providers)[0] && (
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
                    <div
                      role="button"
                      tabIndex={-10}
                      className="library__placeholder"
                      onClick={onFocus}
                      onKeyDown={() => {}}
                    >
                      {label}
                      <span>{subLabel}</span>
                    </div>
                  )}
                </Fragment>
              )
            }
          </div>
        </div>

        <div className="library__row library__row-second">
          <ProviderList
            activeItem={activeBtn}
            activeTub={activeTub}
            onSelectItem={setActiveBtn}
            loadingItems={loadingItems}
            items={providers}
            title={Object.keys(tabItems).length ? tabItems[activeTub].find : ''}
            userContentTitle={Object.keys(tabItems).length ? tabItems[activeTub].text : ''}
            deletedItems={deletedItems}
            onFetchDelete={onFetchDelete}
          />
          <LibraryContent
            items={items}
            onSelect={onSelect}
            activeBtn={activeBtn}
            onDelete={onDelete}
            isLoading={isLoading}
            pageNumber={pageNumber}
            loadingItems={loadingItems}
            isDownloadAllItems={isDownloadAllItems}
            getRootProps={getRootProps}
            getInputProps={getInputProps}
            isDragActive={isDragActive}
            isDisabledUpload={isDisabledUpload}
            error={error}
          />
        </div>
      </div>
    </div>
  );
};

Library.propTypes = {
  providers: PropTypes.objectOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      icon: PropTypes.string,
    }),
  ),
  label: PropTypes.string,
  subLabel: PropTypes.string,
  tub: PropTypes.string,
};

Library.defaultProps = {
  providers: libraryProviders,
  label: 'Try searching for keywords, like',
  subLabel: ' business, sports, meeting...',
  tub: Object.keys(tabItems)[0],
};

export default Library;
