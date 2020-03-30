import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAsync } from 'react-async-hook';

import PropTypes from '../../lib/PropTypes';
import { libraryProviders, tabItems } from '../../lib/constants/library';
import useMediaStore from '../hooks/useMediaStore';

import Tabs from '../common/libraryes/Tabs';
import ProviderList from '../common/libraryes/ProviderList';
import LibraryContent from '../common/libraryes/LibraryContent';
import DropzoneArea from './DropzoneArea';
import { LoaderCircle } from './Loader';

import mediaConstants from '../../lib/constants/media';

const Library = (props) => {
  const {
    providers,
    onAdd,
    onSearch,
    label,
    subLabel,
    onUploaded,
  } = props;
  // =============== USE STATE ===============
  const [query, setQuery] = useState('');
  const [activeBtn, setActiveBtn] = useState((Object.keys(providers)[0]));
  const [activeTub, setActiveTub] = useState(Object.keys(tabItems)[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState([]);
  const inputRef = useRef();
  // =============== USE STATE ===============

  const { uploadMedia, storeAsset, getAssets } = useMediaStore();
  const asyncHero = useAsync(getAssets, ['images', 0]);

  // =============== HOOKS ===============
  useEffect(() => {
    if (asyncHero.result) {
      const links = [];
      asyncHero.result.forEach(item => {
        links.push(item.url);
      });
      setItems([
        ...items,
        ...links,
      ]);
      setIsLoading(false);
    }
  }, [asyncHero.result]);
  // =============== HOOKS ===============

  // =============== FUNCTIONS ===============
  const chooseTab = (tab) => {
    setIsLoading(true);
    setActiveTub(tab);
    getAssets(tabItems[tab].text.toLowerCase(), 0)
      .then(data => {
        const links = [];
        data.forEach(item => {
          links.push(item.url);
        });
        setItems(links);
      })
      .then(() => setIsLoading(false))
      .catch(() => console.log('error load media'));
  };

  // === Drop ===
  const onDrop = (acceptedFiles) => {
    Promise.all(acceptedFiles.map(async data => {
      const asset = await uploadMedia({ data, preview: true });
      const img = await storeAsset(asset.url, asset.preview, 'images');
      setItems([
        ...items,
        img.url,
      ]);
    }));
  };

  const { getInputProps } = useDropzone({
    accept: mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled: false,
  });
  // === Drop ===

  const handleSearch = (e) => {
    if (e.key === 'Enter' && query) {
      onSearch(query);
    }
  };

  const onFocus = () => {
    inputRef.current.focus();
  };

  const onSelect = (item) => {
    console.log('Select item', item);
  };

  const onDelete = (item) => {
    console.log('Delete item', item);
  };
  // =============== FUNCTIONS ===============

  if (asyncHero.loading) {
    // todo implement loading
    return (
      <div className="library">
        <LoaderCircle />
      </div>
    );
  }

  if (asyncHero.error) {
    // todo implement err message
    return (
      <div className="library">
        <div className="library__error">{asyncHero.error.message}</div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="library">
        <DropzoneArea onUploaded={onUploaded} />
      </div>
    );
  }

  return (
    <div className="library">
      <Tabs items={tabItems} setActiveTub={chooseTab} />
      <div className="library__body">
        <div className="library__row library__row-first">
          <div>
            <div className="library__add-file">
              <input id="add-file" {...getInputProps()} />
              <label htmlFor="add-file" className="library__add">
                {Object.keys(tabItems).length ? `Add ${tabItems[activeTub].text}` : ''}
              </label>
            </div>
          </div>
          <div className="library__block">
            <input
              className="library__search"
              id="library-layout__search"
              type="text"
              value={query}
              ref={inputRef}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleSearch}
            />
            {!query && (
              <label
                htmlFor="library__search"
                className="library__placeholder"
                onClick={onFocus}
              >
                {label}
                <span>{subLabel}</span>
              </label>
            )}
          </div>
        </div>

        <div className="library__row library__row-second">
          <ProviderList
            activeItem={activeBtn}
            onSelectItem={setActiveBtn}
            items={providers}
            title={Object.keys(tabItems).length ? tabItems[activeTub].find : ''}
            userContentTitle={Object.keys(tabItems).length ? tabItems[activeTub].text : ''}
          />
          <LibraryContent
            items={items}
            onSelect={onSelect}
            activeBtn={activeBtn}
            onDelete={onDelete}
            isLoading={isLoading}
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
  onAdd: PropTypes.func.isRequired,
  onSearch: PropTypes.func.isRequired,
  label: PropTypes.string,
  subLabel: PropTypes.string,
  onUploaded: PropTypes.func.isRequired,
};

Library.defaultProps = {
  providers: libraryProviders,
  label: 'Try searching for keywords, like',
  subLabel: ' business, sports, meeting...',
};

export default Library;
