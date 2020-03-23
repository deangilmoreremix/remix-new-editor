import React, { useState } from 'react';

import ProviderList from '../common/libraryes/ProviderList';
import LibraryContent from '../common/libraryes/LibraryContent';
import PropTypes from '../../lib/PropTypes';
import { imageProviders } from '../../lib/constants/library';
import DropzoneArea from './DropzoneArea';

const Library = (props) => {
  const {
    items, providers, addButtonAction, title, onSearch, addButtonTitle, label, subLabel, onUploaded,
  } = props;
  const [query, setQuery] = useState('');
  const [activeBtn, setActiveBtn] = useState(null);

  const handleSearch = (e) => {
    if (e.key === 'Enter' && query) {
      onSearch(query);
    }
  };

  const onSelect = (img) => {
    console.log(img);
  };

  if (!items || items.length === 0) {
    return (
      <div className="library-layout">
        <DropzoneArea onUploaded={onUploaded} />
      </div>
    );
  }

  return (
    <div className="library-layout">
      <h2 className="library-layout__title">{title}</h2>
      <div className="library-layout__row library-layout__row-first">
        <div>
          <div className="library-layout__add-file">
            <input type="file" id="add-file" onChange={addButtonAction} />
            <label htmlFor="add-file" className="library-layout__add">
              {addButtonTitle}
            </label>
          </div>
        </div>
        <div className="library-layout__block-search">
          <input
            className="library-layout__search"
            id="library-layout__search"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
          {!query && (
          <label htmlFor="library-layout__search">
            {label}
            <span>{subLabel}</span>
          </label>
          )}
        </div>
      </div>

      <div className="library-layout__row">
        <ProviderList
          activeItem={activeBtn}
          onSelectItem={setActiveBtn}
          items={providers}
        />
        <LibraryContent items={items} onSelect={onSelect} />
      </div>
    </div>
  );
};

Library.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string),
  providers: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string, icon: PropTypes.string,
  })),
  addButtonAction: PropTypes.func.isRequired,
  title: PropTypes.string,
  onSearch: PropTypes.func.isRequired,
  addButtonTitle: PropTypes.string,
  label: PropTypes.string,
  subLabel: PropTypes.string,
  onUploaded: PropTypes.func,
};

Library.defaultProps = {
  providers: imageProviders,
  addButtonTitle: 'Add images',
  label: 'Try searching for keywords, like',
  subLabel: ' business, sports, meeting...',
  title: 'Add images',
};

export default Library;
