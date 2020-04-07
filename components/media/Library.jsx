import React, { useState, useRef, useEffect, Fragment } from 'react';
import { useDropzone } from 'react-dropzone';

import PropTypes from '../../lib/PropTypes';
import { USER_ITEMS, tabItems, perPage } from '../../lib/constants/library';
import useMediaStore from '../hooks/useMediaStore';
import mediaConstants from '../../lib/constants/media';
import { showError } from '../../lib/services/alertService';

import Tabs from '../common/library/Tabs';
import ProviderList from '../common/library/ProviderList';
import LibraryContent from '../common/library/LibraryContent';
import { LibrarySpinner, LoaderCircle } from './Loader';

const Library = (props) => {
  const { label, subLabel, tab } = props;

  // =============== STATE ===============
  const [query, setQuery] = useState('');

  const [activeBtn, setActiveBtn] = useState(USER_ITEMS);
  const [activeTab, setActiveTab] = useState(tab);
  const [hasMore, setHasMore] = useState(true);

  const [pageNumber, setPageNumber] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isDisabledUpload, setIsDisabledUpload] = useState(false);

  const [items, setItems] = useState([]);
  const [deletedItems, setDeletedItems] = useState([]);
  const [uploadedItems, setUploadedItems] = useState([]);

  const inputRef = useRef();
  // =============== STATE ===============

  const { uploadMedia, storeAsset, getAssets, deleteAsset } = useMediaStore();

  useEffect(() => {
    setQuery('');
    if (deletedItems.length) {
      bulkDeleteItems();
    } else {
      fetchItems(activeTab);
    }
  }, [activeTab]);

  const handleButtonClick = element => {
    setActiveBtn(element);
    if (deletedItems.length) {
      bulkDeleteItems();
    } else {
      fetchItems(activeTab);
    }
  };

  const fetchItems = async (currentTab, queryStr = '') => {
    let section = '';
    let currentPage = 0;
    let uploaded = [];

    if (currentTab) {
      setIsLoading(true);
      setPageNumber(1);
      setUploadedItems([]);
      section = tabItems[currentTab].label.toLowerCase();
      currentPage = 1;
      uploaded = [];
    } else {
      section = tabItems[activeTab].label.toLowerCase();
      currentPage = pageNumber + 1;
      setPageNumber(pageNumber + 1);
      uploaded = uploadedItems;
    }

    try {
      const data = await getAssets(
        section, currentPage, queryStr, { _id: { $nin: uploaded } },
      );

      if (data.length) {
        if (currentTab) {
          setItems(data);
          // Loading new items when scrolling
        } else {
          setItems([
            ...items,
            ...data,
          ]);
        }
      }
      setIsLoading(false);
      setHasMore(!!(data && data.length === perPage));
    } catch (e) {
      showError('An error occurred while loading items');
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
    }).catch(err => showError(err))
      .finally(() => setIsDisabledUpload(false));
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

  const bulkDeleteItems = (unmount, searchText) => {
    const promiseArr = deletedItems.map(id => deleteAsset(id));

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
      .catch(e => showError(`Error while deleting items, ${e}`));
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
              activeBtn === USER_ITEMS && (
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
                      {label}
                      <span>{subLabel}</span>
                    </button>
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
            userContentTitle={tabItems[activeTab].label}
            handleButtonClick={handleButtonClick}
          />
          {isLoading
            ? (
              <div className="library__items">
                <LoaderCircle />
              </div>
            )
            : (
              <LibraryContent
                items={items}
                onSelect={onSelect}
                activeBtn={activeBtn}
                onDelete={onDelete}
                fetchItems={fetchItems}
                isDisabledUpload={isDisabledUpload}
                onDrop={onDrop}
                hasMore={hasMore}
              />
            )}
        </div>
      </div>
    </div>
  );
};

Library.propTypes = {
  label: PropTypes.string,
  subLabel: PropTypes.string,
  tab: PropTypes.string,
};

Library.defaultProps = {
  label: 'Try searching for keywords, like',
  subLabel: ' business, sports, meeting...',
  tab: Object.keys(tabItems)[0],
};

export default Library;
