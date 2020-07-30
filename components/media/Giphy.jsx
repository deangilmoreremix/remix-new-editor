import React, { useEffect, Fragment, useCallback, useState, useRef } from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';
import { Waypoint } from 'react-waypoint';

import { CircleLoader } from 'react-spinners';
import useUIStore from '../hooks/useUIStore';
import useProjectStore from '../hooks/useProjectStore';
import useMediaStore from '../hooks/useMediaStore';
import CloseButton from '../common/CloseButton';
import ContentItem from '../common/stickers/ContentItem';
import { MEDIA_TYPES } from '../../lib/constants/popcorn';
import { search, perPage } from '../../lib/constants/library';
import { ENTER_KEY } from '../../lib/constants/keyCodes';
import { LOADING_COLOR } from '../../lib/constants/ui';
import { showError } from '../../lib/services/alertService';

const GiphyGifs = observer((props) => {
  const inputRef = useRef();
  const [searchValue, setSearchValue] = useState('');
  const { isTimelineOpen, toggleRightBlock } = useUIStore();
  const [gifs, setGifs] = useState(['']);
  const { addElement } = useProjectStore();
  const { type } = props;
  const { getGiphyData } = useMediaStore();
  const [wrappedGiphy, setWrappedGiphy] = useState([]);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setGifs(wrappedGiphy);
  }, [wrappedGiphy]);

  useEffect(() => {
    setGifs(['']);
    setSearchValue('');
    setWrappedGiphy([]);
    setOffset(0);
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
    getGiphy(value);
  }, [type]);

  const getGiphy = useCallback(async (value) => {
    let giphyData;
    try {
      setIsLoading(true);
      giphyData = await getGiphyData(value, type, offset);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      await showError('An error occurred while loading items');
    }
    const wrappedGiphyItems = giphyData.map((gif, idx) => (
      <ContentItem
          /* eslint-disable-next-line react/no-array-index-key */
        key={`${gif._id}-${idx}`}
        item={gif}
        onSelect={onSelect}
      />
    ));
    setWrappedGiphy(wrappedGiphyItems);
  }, [type]);

  const handleScroll = async () => {
    setOffset(offset + perPage);
    const onScrollGiphyData = await getGiphyData(searchValue, type, offset);
    const onScrollWrappedGiphyItems = onScrollGiphyData.map((gif) => (
      <ContentItem
        key={gif._id}
        item={gif}
        onSelect={onSelect}
      />
    ));
    setWrappedGiphy([...wrappedGiphy, ...onScrollWrappedGiphyItems]);
  };

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
        {isLoading
          ? (
            <CircleLoader
              size={100}
              css={{ margin: 'auto' }}
              loading
              color={LOADING_COLOR}
            />
          )
          : (
            <div className={classnames('library__items')}>

              {gifs.length !== 0 && gifs}
              <Waypoint
                onEnter={handleScroll}
              />
            </div>
          )}
        <CloseButton onClick={() => toggleRightBlock(false)} />
      </div>
    </div>
  );
});

export default GiphyGifs;
