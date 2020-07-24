import React, { useEffect, Fragment, useCallback, useState, useRef } from 'react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import useUIStore from '../hooks/useUIStore';
import useProjectStore from '../hooks/useProjectStore';
import CloseButton from '../common/CloseButton';
import ContentItem from '../common/stickers/ContentItem';
import { MEDIA_TYPES } from '../../lib/constants/popcorn';
import config from '../../config/config';
import { search } from '../../lib/constants/library';

const giphyFetch = new GiphyFetch(config.mediaProviders.GIPHY.apiKey);

const GiphyGifs = observer((props) => {
  const inputRef = useRef();
  const [searchValue, setSearchValue] = useState('');
  const { isTimelineOpen, toggleRightBlock } = useUIStore();
  const [gifs, setGifs] = useState(['']);
  const { addElement } = useProjectStore();
  const { type } = props;

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

  const onChangeValue = useCallback((event) => {
    const { value } = event.target;
    setSearchValue(value);
    getGifs(value);
  }, [type]);

  const getGifs = useCallback((value) => {
    giphyFetch.search(value, { type }).then(res => {
      if (res.meta.status !== 200) {
        throw new Error('Something wrong: An error while fetching data');
      }
      const result = res.data.map((gif) => {
        const item = {
          data: gif.images.original.url,
          preview: gif.images.preview_gif.url,
          _id: gif.id,
        };

        return (
          <ContentItem
            key={item._id}
            item={item}
            onSelect={onSelect}
            onDelete={() => {}}
          />
        );
      });
      setGifs(result);
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
            onChange={onChangeValue}
          />
          {!searchValue && (
            <button
              className="gif-library-placeholder"
              onClick={handleSetFocus}
            >
              {search.label}
              <span>{search.subLabel}</span>
            </button>
          )}
        </Fragment>
        <div className={classnames('library__items')} overflow-y="auto">
          {gifs.length !== 0 && gifs}
        </div>
        <CloseButton onClick={() => toggleRightBlock(false)} />
      </div>
    </div>
  );
});

export default GiphyGifs;
