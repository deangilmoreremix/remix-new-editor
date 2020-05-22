import React from 'react';
import PropTypes from 'prop-types';
import { Grid, Button } from '@material-ui/core';
import { Waypoint } from 'react-waypoint';

const Row = ({ title, onSelect }) => (
  <Grid className="generator-scripts-item" container direction="row">
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

const NicheScriptsGrid = ({ items, loadMore, hasMore, onSelect }) => (
  <div className="generator-scripts">
    {
      items.map(item => (
        <Row
          key={item._id}
          title={item.title}
          onSelect={() => onSelect(item)}
        />
      ))
    }
    { hasMore && <Waypoint bottomOffset="3%" onEnter={loadMore} /> }
  </div>
);

NicheScriptsGrid.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  })),
  loadMore: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  hasMore: PropTypes.bool.isRequired,
};

export default NicheScriptsGrid;
