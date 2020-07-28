import React, { useEffect, Fragment, useCallback, useState, useRef } from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import useUIStore from '../hooks/useUIStore';
import useProjectStore from '../hooks/useProjectStore';
import useMediaStore from '../hooks/useMediaStore';
import CloseButton from '../common/CloseButton';
import ContentItem from '../common/stickers/ContentItem';
import { MEDIA_TYPES } from '../../lib/constants/popcorn';
import { search } from '../../lib/constants/library';
import { ENTER_KEY } from '../../lib/constants/keyCodes';

const GiphyGifs = observer((props) => {
  const inputRef = useRef();
  const [searchValue, setSearchValue] = useState('');
  const { isTimelineOpen, toggleRightBlock } = useUIStore();
  const [gifs, setGifs] = useState(['']);
  const { addElement } = useProjectStore();
  const { type } = props;
  const { getGiphyData } = useMediaStore();

  useEffect(() => {
    setGifs(['']);
    setSearchValue('');
  }, [type]);

  const onSelect = item => {
    item.src = item.data;
    item.type = MEDIA_TYPES.IMAGE;
    return addElement(item);
  };

  const handleSetFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyUp = (event) => {
    const { value } = event.target;
    setSearchValue(value);
    if (event.keyCode === ENTER_KEY) {
      onChangeValue(event);
    }
  };

  const onChangeValue = useCallback((event) => {
    const { value } = event.target;
    getGifs(value);
  }, [type]);

  const getGifs = useCallback((value) => {
    getGiphyData(value, type).then((gifsData) => {
      const wrappedGifs = gifsData.map((gif) => (
        <ContentItem
          key={gif._id}
          item={gif}
          onSelect={onSelect}
        />
      ));
      setGifs(wrappedGifs);
    });
  }, [type]);

  return (
    <div className={classnames('gif-library', { 'big-window': !isTimelineOpen })}>
      <header className="gif-library-header">
        {type.toUpperCase()}
      </header>
      <div className={classnames('gif-library-wrapper')}>
        <Fragment>
          <input
            className="gif-library-search"
            type="text"
            ref={inputRef}
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            onKeyUp={handleKeyUp}
          />
          {!searchValue && gifs.length <= 1 && (
            <button
              className="gif-library-placeholder"
              onClick={handleSetFocus}
            >
              {search.label}
              <span>{search.subLabel}</span>
            </button>
          )}
        </Fragment>
        <div className={classnames('library__items')}>
          {gifs.length !== 0 && gifs}
        </div>
        <CloseButton onClick={() => toggleRightBlock(false)} />
      </div>
    </div>
  );
});

export default GiphyGifs;
