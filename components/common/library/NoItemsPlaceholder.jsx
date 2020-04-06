import React, { Fragment } from 'react';
import PropTypes from '../../../lib/PropTypes';

const NoItemsPlaceholder = ({ count }) => {
  const backgroundGrid = () => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(i);
    }
    return arr.map((item, i) => <div className="library__item" key={i} />);
  };

  return (
    <Fragment>
      {backgroundGrid()}
    </Fragment>
  );
};

NoItemsPlaceholder.propTypes = {
  count: PropTypes.number.isRequired,
};

export default NoItemsPlaceholder;
