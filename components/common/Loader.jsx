import * as React from 'react';
import classnames from 'classnames';
import { CircleLoader } from 'react-spinners';
import { LOADING_COLOR } from '../../lib/constants/ui';

import PropTypes from '../../lib/PropTypes';

const Loader = ({ className, isLoading, size = 100, color, fixed = false, preloader = false }) => (
  <div className={classnames('loading-spinner', className, { fixed, active: isLoading, preloader })}>
    <CircleLoader
      size={size}
      css={{
        margin: 'auto',
        position: 'absolute',
        top: 0,
        bottom: '0',
        left: '0',
        right: '0',
        zIndex: 10000,
      }}
      loading={isLoading}
      color={color || LOADING_COLOR}
    />
  </div>
);

Loader.propTypes = {
  isLoading: PropTypes.bool.isRequired,
  fixed: PropTypes.bool,
  preloader: PropTypes.bool,
  size: PropTypes.number,
  className: PropTypes.string,
  color: PropTypes.string,
};

export default Loader;
