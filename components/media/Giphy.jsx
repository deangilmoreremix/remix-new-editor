import React, { useEffect, useState, useRef, useMemo } from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';

import useUIStore from '../hooks/useUIStore';
import useMediaStore from '../hooks/useMediaStore';
import useTimelineStore from '../hooks/useTimelineStore';

import { search } from '../../lib/constants/library';
import { ENTER_KEY } from '../../lib/constants/keyCodes';
import { editorStyles } from '../../lib/constants/editorStyles';

import List from '../common/list/List';
import ImageElement from '../common/libraryElements/ImageElement';
import CloseButton from '../common/CloseButton';

import searchIcon from '../../public/static/images/search.svg';

const GiphyGifs = observer(({ type }) => {
  const inputRef = useRef();
  const [searchValue, setSearchValue] = useState('');
  const [startSearch, setStartSearch] = useState(false);

  const { getGiphyData } = useMediaStore();
  const { toggleRightBlock } = useUIStore();
  const { timelineHeight } = useTimelineStore();

  const handleSetFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyUp = (event) => {
    const { value } = event.target;
    setSearchValue(value);
    if (event.keyCode === ENTER_KEY) {
      setStartSearch(true);
    }
  };

  useEffect(() => {
    setSearchValue(type);
    setStartSearch(true);
  }, [type]);

  const libraryHeight = useMemo(() => (
    editorStyles.calculateHeight(timelineHeight)
  ), [timelineHeight]);

  return (
    <div style={{ height: libraryHeight }} className="gif-library">
      <div className="flex">
        <header className="gif-library__header">
          {type}
        </header>
        <CloseButton onClick={() => toggleRightBlock(false)} />
      </div>
      <div className="gif-library__body">
        <div className="gif-library__search">
          <input
            className="gif-library__input"
            type="text"
            ref={inputRef}
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            onKeyUp={handleKeyUp}
          />
          {!searchValue && (
            <button
              className="gif-library__placeholder"
              onClick={handleSetFocus}
            >
              <div>
                {search.label}
                <span>{search.subLabel}</span>
              </div>
            </button>
          )}
          <SVGInline
            className="gif-library__icon"
            svg={searchIcon}
          />
        </div>

        <List
          get={getGiphyData}
          className="gif-library__height"
          element={ImageElement}
          fetchAttributes={{
            type,
          }}
          searchValue={searchValue}
          startSearch={startSearch}
          setStartSearch={setStartSearch}
          searchPage
        />
      </div>
    </div>
  );
});

export default GiphyGifs;
