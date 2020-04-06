import React, { useState, useRef, useEffect, Fragment } from 'react';
import { useDropzone } from 'react-dropzone';

import PropTypes from '../../lib/PropTypes';
import { libraryProviders, tabItems } from '../../lib/constants/library';
import useMediaStore from '../hooks/useMediaStore';

import Tabs from '../common/library/Tabs';
import ProviderList from '../common/library/ProviderList';
import LibraryContent from '../common/library/LibraryContent';
import { LibrarySpinner } from './Loader';

import mediaConstants from '../../lib/constants/media';

const Library = (props) => {
  const { providers, label, subLabel, tab } = props;
  const perPage = 12;
  // =============== STATE ===============
  const [query, setQuery] = useState('');

  const [activeBtn, setActiveBtn] = useState(Object.keys(providers)[0]);
  const [activeTab, setActiveTab] = useState(tab);

  const [hasMore, setHasMore] = useState(true);

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
      fetchItems(activeTab);
    }
  }, [activeTab]);

  const handleButtonClick = element => {
    setActiveBtn(element);
    if (deletedItems.length) {
      onFetchDelete();
    } else {
      fetchItems(activeTab);
    }
  };

  const fetchItems = async (getTab, queryStr = '') => {
    let currentTab = '';
    let itemsLength = 0;
    let uploaded = [];

    if (getTab) {
      setIsLoading(true);
      setUploadedItems([]);
      currentTab = tabItems[getTab].label.toLowerCase();
      itemsLength = 0;
      uploaded = [];
    } else {
      currentTab = tabItems[activeTab].label.toLowerCase();
      itemsLength = items.length;
      uploaded = uploadedItems;
    }
    console.log(items);
    try {
      const data = await getAssets(
        currentTab, itemsLength, queryStr, { _id: { $nin: [...uploaded, ...deletedItems] } },
      );
      await forEachItems(data, getTab);
      setIsLoading(false);
    } catch (e) {
      setError(true);
    }
  };

  const forEachItems = (data, getTab) => {
    const elements = [];
    if (data.length) {
      setHasMore(data.length === perPage);
      console.log(data.length);

      data.forEach(item => {
        const element = {
          id: item._id,
          url: item.url,
          title: item.title,
        };
        elements.push(element);
      });

      if (getTab) {
        setItems(elements);
        // Loading new items when scrolling
      } else {
        setItems([
          ...items,
          ...elements,
        ]);
      }
    }
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
        title: item.title,
      });
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

  const handleSetFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const onSelect = (id) => {
    console.log('Select item', id);
  };

  const onDelete = (id) => {
    const newArr = items.filter(item => {
      if (item.id !== id) {
        return item;
      } else {
        return setDeletedItems([
          ...deletedItems,
          item.id,
        ]);
      }
    });
    setItems(newArr);
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
          fetchItems(activeTab, searchText);
        }
      })
      .catch(() => console.log('Error while deleting items'));
  };

  return (
    <div className="library">
      <Tabs setActiveTab={setActiveTab} />
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
                      onClick={handleSetFocus}
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
            title={Object.keys(tabItems).length ? tabItems[activeTab].find : ''}
            userContentTitle={Object.keys(tabItems).length ? tabItems[activeTab].label : ''}
            handleButtonClick={handleButtonClick}
          />
          <LibraryContent
            items={items}
            onSelect={onSelect}
            activeBtn={activeBtn}
            onDelete={onDelete}
            isLoading={isLoading}
            fetchItems={fetchItems}
            hasMore={hasMore}
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
  tab: PropTypes.string,
};

Library.defaultProps = {
  providers: libraryProviders,
  label: 'Try searching for keywords, like',
  subLabel: ' business, sports, meeting...',
  tab: Object.keys(tabItems)[0],
};

export default Library;
