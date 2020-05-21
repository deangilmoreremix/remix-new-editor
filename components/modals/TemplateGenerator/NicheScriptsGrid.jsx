import React from 'react';
import PropTypes from 'prop-types';
import Gallery from 'react-masonry-infinite';
import { Grid, Button } from '@material-ui/core';

import { LibrarySpinner } from '../../media/Loader';

const Row = ({ title, onSelect }) => (
  <Grid container direction="row">
    <Grid item xs={9}><span>{title}</span></Grid>
    <Grid item xs={3}>
      <Button onClick={onSelect} className="generator-use">use</Button>
    </Grid>
  </Grid>
);

Row.propTypes = {
  title: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
};

const NicheScriptsGrid = (props) => {
  const { items, loadMore, hasMore, inWindow, onSelect, initialLoad } = props;
  const sizes = [
    { columns: 1, gutter: 20 },
  ];

  return (
    <Gallery
      initialLoad={initialLoad}
      hasMore={hasMore}
      className="generator-scripts"
      loadMore={loadMore}
      useWindow={inWindow}
      loader={<LibrarySpinner />}
      sizes={sizes}
    >
      {
        items
          .map(item => <Row key={item._id} title={item.title} onSelect={() => onSelect(item)} />)
      }
    </Gallery>
  );
};

NicheScriptsGrid.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  })),
  loadMore: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  hasMore: PropTypes.bool.isRequired,
  initialLoad: PropTypes.bool,
  inWindow: PropTypes.bool,
};

NicheScriptsGrid.defaultProps = {
  inWindow: false,
  initialLoad: false,
};

export default NicheScriptsGrid;
