import React, { useState } from 'react';
import SearchIcon from '@material-ui/icons/Search';
import PropTypes from '../../lib/PropTypes';

const SearchInput = ({ onSearch, placeholder }) => {
  const [query, setQuery] = useState('');

  const onSearchElement = (event) => {
    const { key, target } = event;
    if (key === 'Enter') {
      onSearch(query);
    }
    setQuery(target.value);
  };

  return (
    <>
      <input
        className="library__search white-text-input"
        type="text"
        value={query}
        onChange={onSearchElement}
        onKeyDown={onSearchElement}
        placeholder={placeholder}
      />
      <div className="library__search-icon-box">
        <SearchIcon onClick={() => onSearch(query)} />
      </div>
    </>
  );
};

SearchInput.defaultProps = {
  placeholder: 'Search through your content...',
};

SearchInput.propTypes = {
  onSearch: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

export default SearchInput;
