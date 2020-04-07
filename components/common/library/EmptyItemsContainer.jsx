import React, { Fragment } from 'react';
import PropTypes from '../../../lib/PropTypes';

const EmptyItemsContainer = ({ count }) => {
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push(i);
  }

  return (
    <Fragment>
      {arr && arr.map(item => (
        <div className="library__item" key={item} />
      ))}
    </Fragment>
  );
};

EmptyItemsContainer.propTypes = {
  count: PropTypes.number.isRequired,
};

export default EmptyItemsContainer;
