import React from 'react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';
import classnames from 'classnames';
import { observer } from 'mobx-react';
import useUIStore from '../hooks/useUIStore';

const giphyFetch = new GiphyFetch('sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh');

const GridGif = observer(() => {
  const { isTimelineOpen } = useUIStore();
  const fetchGifs = () => giphyFetch.search('summer', {type: 'gifs' });
  return (
    <div className={classnames('gif-library', { 'big-window': !isTimelineOpen })}>
      <header className="gif-library-header">GIF</header>
      <Grid
        fetchGifs={fetchGifs}
        columns={3}
        gutter={6}
        width={300}
        height={500}
      />
    </div>
  );
});

export default GridGif;
