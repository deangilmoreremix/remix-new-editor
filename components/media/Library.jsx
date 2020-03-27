import React, {useState, useRef, useEffect} from 'react';
import {useDropzone} from "react-dropzone";
import { useAsync } from 'react-async-hook';

import PropTypes from '../../lib/PropTypes';
import { libraryProviders, tabItems } from '../../lib/constants/library';
import useMediaStore from "../hooks/useMediaStore";

import Tabs from '../common/libraryes/Tabs';
import ProviderList from '../common/libraryes/ProviderList';
import LibraryContent from '../common/libraryes/LibraryContent';
import DropzoneArea from './DropzoneArea';

import mediaConstants from "../../lib/constants/media";

const Library = (props) => {
  const {
    // items,
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
  const [items, setItems] = useState([
    "https://cdn.pixabay.com/photo/2015/04/23/22/00/tree-736885__340.jpg",
  ]);
  // =============== USE STATE ===============

  const { uploadMedia, storeAsset, getAssets } = useMediaStore();
  const asyncHero = useAsync(getAssets, ['images', 20]);

  // =============== HOOKS ===============
  useEffect(() => {
    if (asyncHero.result) {
      console.log(asyncHero.result);
      setItems(asyncHero.result);
    }
  }, [asyncHero.result]);
  // =============== HOOKS ===============

  // =============== FUNCTIONS ===============
  // === Drop ===
  const onDrop = React.useCallback(acceptedFiles => {
    Promise.all(acceptedFiles.map(async data => {
      const asset = await uploadMedia({ data, preview: true });
      const img = await storeAsset(asset.url, asset.preview, 'images');
      setItems([
        ...items,
        img.url,
      ]);
    }));
  }, [uploadMedia]);

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

  const onSelect = (item) => {
    console.log('Select item', item);
  };

  const onDelete = (item) => {
    console.log('Delete item', item);
  };
  // =============== FUNCTIONS ===============

  if (!items || items.length === 0) {
    return (
      <div className="library">
        <DropzoneArea onUploaded={onUploaded} />
      </div>
    );
  }

  if (asyncHero.loading) {
    // todo implement loading
    return (<div>Loading</div>);
  }

  if (asyncHero.error) {
    // todo implement err message
    return (<div>asyncHero.error.message</div>);
  }



  return (
    <div className="library">
      <Tabs items={tabItems} setActiveTub={setActiveTub} />

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
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleSearch}
            />
            {!query && (
              <label htmlFor="library__search">
                {label}
                <span>{subLabel}</span>
              </label>
            )}
          </div>
        </div>

        <div className="library__row">
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
          />
        </div>
      </div>
    </div>
  );
};

Library.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string.isRequired),
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
