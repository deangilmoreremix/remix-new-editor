import React, { Fragment, useCallback, useState } from 'react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import useUIStore from '../hooks/useUIStore';
import useProjectStore from '../hooks/useProjectStore';
import CloseButton from '../common/CloseButton';
import ContentItem from '../common/stickers/ContentItem';
import { MEDIA_TYPES } from '../../lib/constants/popcorn';
import config from '../../config/config';


const giphyFetch = new GiphyFetch(config.mediaProviders.GIPHY.apiKey);

const GiphyGifs = observer(() => {
  const { isTimelineOpen, toggleRightBlock } = useUIStore();
  const { addElement } = useProjectStore();
  const [gifs, setGifs] = useState(['']);

  const onSelect = item => {
    item.src = item.data;
    item.type = MEDIA_TYPES.IMAGE;
    return addElement(item);
  };

  const getGifs = useCallback((event) => {
    const { value } = event.target;

    giphyFetch.search(value, { type: 'gifs' }).then(res => {
      if (res.meta.status !== 200) {
        throw new Error('Something wrong: not valid response');
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
  }, []);

  return (
    <div className={classnames('gif-library', { 'big-window': !isTimelineOpen })}>
      <header className="gif-library-header">GIF</header>
      <div className={classnames('gif-library-wrapper')}>
        <Fragment>
          <input
            className="gif-library-search"
            type="text"
            onChange={getGifs}
          />
        </Fragment>
        <div className={classnames('library__items')} overflow-y="auto">
          {gifs.length && gifs}
        </div>
        <CloseButton onClick={() => toggleRightBlock(false)} />
      </div>
    </div>
  );
});

export default GiphyGifs;
