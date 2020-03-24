import * as React from 'react';
import classnames from 'classnames';
import isEqual from 'lodash/isEqual';

import PropTypes from '../../lib/PropTypes';

const baseDimension = 2;

const SizeSelector = ({ active, sizes, onChange }) => {
  const getStyle = ({ width, height }) => {
    const ratio = width / height;

    return {
      minWidth: `${ratio > 1 ? ratio * baseDimension : baseDimension}rem`,
      minHeight: `${ratio > 1 ? baseDimension : baseDimension / ratio}rem`,
    };
  };

  return (
    <div className="canvas-size-selector">
      {sizes.map(({ width, height }) => (
        <button
          key={`${width}:${height}`}
          className={classnames(
            'canvas-size-item',
            {
              active: isEqual({ width, height }, active),
            })}
          onClick={() => onChange({ width, height })}
          type="button"
          style={getStyle({ width, height })}
        >
          {`${width}:${height}`}
        </button>
      ))}
    </div>
  );
};

SizeSelector.propTypes = {
  active: PropTypes.shape({
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
  }).isRequired,
  sizes: PropTypes.arrayOf(
    PropTypes.shape({
      width: PropTypes.number.isRequired,
      height: PropTypes.number.isRequired,
    }).isRequired,
  ),
  onChange: PropTypes.func.isRequired,
};

export default SizeSelector;
